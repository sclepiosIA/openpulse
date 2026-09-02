-- =====================================================================
-- Pages rédigées : le wiki, dans l'arborescence des documents.
--
-- POURQUOI CE FICHIER EXISTE
-- La distribution remplace une base de connaissances propre à l'éditeur
-- d'origine par un outil de rédaction utilisable par n'importe quelle
-- organisation. Le besoin est celui d'un wiki : écrire une page, la ranger, la
-- retrouver, la partager, voir qui l'a changée.
--
-- LE CHOIX STRUCTURANT : UNE SEULE ARBORESCENCE
-- Tout cela existe déjà pour les fichiers — `document_folders` et ses
-- permissions, `document_versions`, `document_shares`, le journal d'audit. Une
-- table de pages séparée aurait signifié une SECONDE arborescence, un second
-- jeu de droits, une seconde recherche : deux endroits où ranger, deux endroits
-- où chercher, et deux fois la même question « qui a accès à quoi ».
--
-- Une page est donc une ligne de `documents`, comme un fichier. Ce qui les
-- distingue tient en une colonne : `content`.
--
-- CE QUE LA CONTRAINTE GARANTIT
-- Une ligne est un fichier OU une page, jamais les deux ni ni l'un ni l'autre.
-- Sans cette règle, on obtiendrait au bout d'un an des lignes mi-fichier
-- mi-page que plus aucun écran ne saurait afficher.
--
-- Idempotent : rejouable sans dommage.
-- =====================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'documents'
  ) THEN
    RAISE EXCEPTION
      'public.documents est absente : appliquez le schéma applicatif avant ce fichier.';
  END IF;
END $$;

-- --- le contenu rédigé -------------------------------------------------

ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS content text;

COMMENT ON COLUMN public.documents.content IS
  'Contenu rédigé d''une page, en HTML produit par l''éditeur. NULL pour un fichier téléversé.';

-- Un fichier a un chemin de stockage et une taille ; une page n'a ni l'un ni
-- l'autre. Ces deux colonnes étaient NOT NULL : sans les assouplir, il faudrait
-- inventer un faux chemin par page, c'est-à-dire mentir dans la base pour
-- satisfaire une contrainte qui ne la concerne pas.
ALTER TABLE public.documents ALTER COLUMN storage_path DROP NOT NULL;
ALTER TABLE public.documents ALTER COLUMN file_size_bytes DROP NOT NULL;

-- --- fichier ou page, jamais les deux ---------------------------------

ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_fichier_ou_page;
ALTER TABLE public.documents ADD CONSTRAINT documents_fichier_ou_page CHECK (
  (storage_path IS NOT NULL AND content IS NULL)    -- un fichier
  OR
  (content IS NOT NULL AND storage_path IS NULL)     -- une page
);

-- --- recherche : le corps des pages, pas seulement leur titre ---------
--
-- L'index existant ne couvrait que le nom et la description. Sur un wiki, c'est
-- précisément l'inverse de ce qu'on cherche : on se souvient d'un mot lu dans
-- une page, pas de son titre. Le contenu est du HTML — les balises sont
-- retirées avant indexation, sans quoi « div » et « strong » deviendraient des
-- mots-clés de la base.

-- Configuration de recherche insensible aux accents. La configuration
-- « french » livrée par PostgreSQL ne les retire pas : « teletravail » ne
-- trouvait pas « télétravail », alors que c'est exactement ce qu'un francophone
-- tape. Mesuré avant correction : 0 résultat.
--
-- L'extension unaccent est fournie par le schéma d'amorçage. Si elle manque, on
-- garde la configuration standard plutôt que d'échouer : une recherche stricte
-- vaut mieux que pas de wiki.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'unaccent') THEN
    RAISE NOTICE 'unaccent absente : la recherche restera sensible aux accents';
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'francais_sans_accent') THEN
    CREATE TEXT SEARCH CONFIGURATION public.francais_sans_accent (COPY = french);
    ALTER TEXT SEARCH CONFIGURATION public.francais_sans_accent
      ALTER MAPPING FOR hword, hword_part, word
      WITH unaccent, french_stem;
  END IF;
END $$;

-- Le nom de configuration est résolu à la création de la colonne engendrée :
-- il doit donc exister une fonction qui rende toujours le même résultat pour
-- la même entrée, quelle que soit la configuration disponible.
CREATE OR REPLACE FUNCTION public.vecteur_recherche_document(
  nom text, description text, contenu text
) RETURNS tsvector
  LANGUAGE plpgsql IMMUTABLE
  SET search_path TO 'public', 'pg_temp'
  AS $vecteur$
BEGIN
  RETURN to_tsvector('public.francais_sans_accent',
                     public.texte_indexable_document(nom, description, contenu));
EXCEPTION WHEN undefined_object THEN
  RETURN to_tsvector('french', public.texte_indexable_document(nom, description, contenu));
END;
$vecteur$;

CREATE OR REPLACE FUNCTION public.texte_indexable_document(
  nom text, description text, contenu text
) RETURNS text
  LANGUAGE sql IMMUTABLE
  SET search_path TO 'public', 'pg_temp'
  AS $fonction$
  SELECT nom || ' ' || coalesce(description, '') || ' ' ||
         coalesce(regexp_replace(contenu, '<[^>]*>', ' ', 'g'), '');
$fonction$;

-- La recherche passe par une COLONNE ENGENDRÉE, non par un index d'expression.
-- La raison est pratique : l'API REST dérivée du schéma sait interroger une
-- colonne (`.textSearch('recherche', …)`), elle ne sait pas reproduire une
-- expression d'index. Un index d'expression aurait donc existé sans que rien
-- ne s'en serve — c'était déjà le cas de l'index précédent, que le code
-- contournait par un `ILIKE`.
ALTER TABLE public.documents DROP COLUMN IF EXISTS recherche;
ALTER TABLE public.documents ADD COLUMN recherche tsvector
  GENERATED ALWAYS AS (
    public.vecteur_recherche_document(name, description, content)
  ) STORED;

COMMENT ON COLUMN public.documents.recherche IS
  'Index de recherche : titre, description et corps de page, balises HTML retirées.';

DROP INDEX IF EXISTS public.idx_documents_fulltext;
CREATE INDEX idx_documents_fulltext ON public.documents USING gin (recherche);

-- --- vérification ------------------------------------------------------

DO $$
DECLARE
  essai_page uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='documents' AND column_name='content'
  ) THEN
    RAISE EXCEPTION 'la colonne content n''a pas ete ajoutee';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'documents_fichier_ou_page'
  ) THEN
    RAISE EXCEPTION 'la contrainte fichier-ou-page n''a pas ete posee';
  END IF;

  -- Une ligne qui serait les deux à la fois doit être refusée : on l'éprouve,
  -- plutôt que de supposer que la contrainte fait ce qu'elle annonce.
  BEGIN
    INSERT INTO public.documents (name, mime_type, storage_path, content, created_by)
    VALUES ('controle', 'text/html', 'x/y.pdf', '<p>a</p>',
            (SELECT id FROM public.profiles LIMIT 1))
    RETURNING id INTO essai_page;
    DELETE FROM public.documents WHERE id = essai_page;
    RAISE EXCEPTION 'la contrainte a laisse passer une ligne mi-fichier mi-page';
  EXCEPTION
    WHEN check_violation THEN NULL;  -- refus attendu
    WHEN not_null_violation THEN NULL;
  END;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='documents' AND column_name='recherche'
  ) THEN
    RAISE EXCEPTION 'la colonne de recherche n''a pas ete engendree';
  END IF;

  RAISE NOTICE 'pages activees : colonne content, contrainte fichier-ou-page, recherche sur le corps';
END $$;
