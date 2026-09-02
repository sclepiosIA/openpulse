-- =====================================================================
-- Durcissement du module documentaire.
--
-- Trois défauts mesurés sur une instance neuve, corrigés ici.
--
-- 1. UN DOCUMENT SANS DOSSIER ÉTAIT VISIBLE DE TOUS
--    La règle de lecture disait : « (folder_id IS NULL) OR
--    can_access_folder(folder_id, auth.uid()) ». Or supprimer un dossier met
--    ses documents à NULL — la clé étrangère est en SET NULL — tout en
--    supprimant ses permissions, qui sont en CASCADE.
--
--    Enchaînement mesuré : un dossier « Confidentiel RH » marqué restreint,
--    contenant salaires.pdf ; on supprime le dossier ; le document passe à
--    folder_id NULL, et devient donc lisible par TOUT compte authentifié.
--    Supprimer un dossier confidentiel publiait son contenu.
--
--    Un document orphelin appartient désormais à qui l'a déposé, et aux
--    administrateurs. Rien de plus.
--
-- 2. L'HISTORIQUE DES VERSIONS N'ÉTAIT VISIBLE QUE DE SON AUTEUR
--    Les quatre règles de `document_versions` filtraient sur
--    « user_id = auth.uid() », c'est-à-dire l'auteur de LA VERSION, non les
--    personnes qui ont accès au document. Sur un document partagé, chacun ne
--    voyait donc que ses propres révisions : l'historique paraissait vide ou
--    troué, sans que rien ne signale un refus.
--
--    L'accès à l'historique suit maintenant l'accès au document. C'est le seul
--    critère qui ait un sens : qui peut lire un document peut voir comment il
--    en est arrivé là.
--
-- 3. LA RECHERCHE NE VOYAIT PAS LE CONTENU
--    L'index plein texte ne couvrait que le nom et la description. Traité
--    séparément, avec l'ajout du contenu rédigé.
--
-- Idempotent : rejouable sans dommage.
-- =====================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'document_versions'
  ) THEN
    RAISE EXCEPTION
      'les tables documentaires sont absentes : appliquez le schéma applicatif avant ce fichier.';
  END IF;
END $$;

-- --- 1. document sans dossier -----------------------------------------

DROP POLICY IF EXISTS "Authenticated users can view accessible documents" ON public.documents;
CREATE POLICY "Authenticated users can view accessible documents"
  ON public.documents FOR SELECT TO authenticated
  USING (
    CASE
      -- Rangé : l'accès au dossier fait foi, comme avant.
      WHEN folder_id IS NOT NULL THEN public.can_access_folder(folder_id, auth.uid())
      -- Orphelin : celui qui l'a déposé, et l'administration. L'ancienne règle
      -- ouvrait ce cas à tout le monde, ce qui transformait la suppression d'un
      -- dossier en publication de son contenu.
      ELSE created_by = auth.uid() OR public.has_role(auth.uid(), 'admin')
    END
  );

-- --- 2. historique des versions ---------------------------------------
--
-- Le critère devient « qui peut lire le document », pas « qui a écrit la
-- version ». Une version dont le document a disparu reste visible de son
-- auteur : sans cela, une suppression de document rendrait des révisions
-- définitivement inaccessibles, y compris à qui les a écrites.

DROP POLICY IF EXISTS "Users read their own document versions" ON public.document_versions;
CREATE POLICY "Lecture des versions d un document accessible"
  ON public.document_versions FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_versions.document_id
        AND (
          CASE
            WHEN d.folder_id IS NOT NULL THEN public.can_access_folder(d.folder_id, auth.uid())
            ELSE d.created_by = auth.uid()
          END
        )
    )
  );

-- L'écriture, elle, reste le fait de qui agit : une version porte le nom de son
-- auteur, et personne ne doit pouvoir en fabriquer au nom d'un autre.
DROP POLICY IF EXISTS "Users insert their own document versions" ON public.document_versions;
CREATE POLICY "Depot d une version par son auteur"
  ON public.document_versions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- --- vérification ------------------------------------------------------

DO $$
DECLARE
  ouverte integer;
BEGIN
  -- Plus aucune règle de lecture ne doit accorder l'accès sur la seule absence
  -- de dossier.
  SELECT count(*) INTO ouverte FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'documents' AND cmd = 'SELECT'
     AND coalesce(qual, '') ILIKE '%folder_id IS NULL) OR%';

  IF ouverte > 0 THEN
    RAISE EXCEPTION 'une regle de lecture ouvre encore les documents sans dossier';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'document_versions'
       AND policyname = 'Lecture des versions d un document accessible'
  ) THEN
    RAISE EXCEPTION 'la regle de lecture des versions n a pas ete posee';
  END IF;

  RAISE NOTICE 'documents orphelins fermes, historique des versions aligne sur l acces au document';
END $$;
