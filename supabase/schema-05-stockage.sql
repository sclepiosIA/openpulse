-- =====================================================================
-- Espaces de stockage et leurs règles d'accès.
--
-- POURQUOI CE FICHIER EXISTE
-- Le code écrit dans dix-neuf espaces de stockage. Aucun n'est créé
-- par le corpus de migrations : sur la plateforme hébergée, ils avaient été
-- créés à la main, hors migration. Sur une instance auto-hébergée, le premier
-- envoi de fichier échoue donc sur « Bucket not found », et rien dans
-- l'installation ne le laissait prévoir.
--
-- Créer les espaces ne suffit pas : `storage.objects` est protégé par la
-- sécurité au niveau ligne, et sans règle explicite, personne ne lit ni
-- n'écrit — pas même l'utilisateur qui vient de déposer le fichier.
--
-- QUAND L'APPLIQUER
-- Après le démarrage du service de stockage, qui crée et fait évoluer
-- storage.buckets et storage.objects. L'installateur s'en charge.
--
-- Ce fichier est idempotent.
-- =====================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'storage' AND table_name = 'buckets'
  ) THEN
    RAISE EXCEPTION
      'storage.buckets est absent : démarrez le service de stockage avant ce fichier.';
  END IF;
END $$;

-- --- espaces ---------------------------------------------------------
--
-- Six seulement sont publics, et leur contenu est fait pour être affiché sans
-- session : photos et logos, images de notes ou d'éditeur, captures de retour.
-- Tous les autres sont privés.
--
-- ATTENTION — `ressources-documentaires` et `rh-onboarding-documents` sont
-- privés ICI alors que le code y appelle `getPublicUrl()`. Ce n'est pas un
-- oubli : ils portent des documents internes et des pièces d'intégration de
-- salariés, qu'un espace public exposerait à quiconque devine une URL. La
-- conséquence est réelle et assumée : ces deux appels renvoient une URL qui
-- répond 403 tant qu'ils n'ont pas été portés sur `createSignedUrl()`. Une
-- fuite silencieuse coûte plus cher qu'un lien mort visible.

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('avatars',                   'avatars',                   true),
  ('notes-images',              'notes-images',              true),
  ('documents',                 'documents',                 false),
  ('contrats',                  'contrats',                  false),
  ('taches-documents',          'taches-documents',          false),
  ('rh-documents',              'rh-documents',              false),
  ('rh-onboarding-documents',   'rh-onboarding-documents',   false),
  ('ressources-documentaires',  'ressources-documentaires',  false),
  ('email-attachments',         'email-attachments',         false),
  ('email-transfers',           'email-transfers',           false),
  ('reports-exports',           'reports-exports',           false),
  ('call-recordings',           'call-recordings',           false),
  -- Ajoutes apres coup : ils etaient utilises en production par
  -- EntityLogoUpload et UserAvatarUpload, et ne figuraient nulle part. Un
  -- premier releve les avait manques parce qu'il ne cherchait que les
  -- apostrophes simples, quand ces deux fichiers ecrivent from("..."). Tous
  -- deux servent des images affichees sans session, d'ou le drapeau public.
  ('entity-logos',              'entity-logos',              true),
  ('user-avatars',              'user-avatars',              true),
  -- Utilises par des fonctions de bord, que le releve manuel ne parcourait
  -- meme pas. Prives : une feuille d'emargement signee et une piece jointe de
  -- ticket n'ont aucune raison d'etre lisibles sans session.
  ('emargements',               'emargements',               false),
  ('ticket-attachments',        'ticket-attachments',        false),
  -- Troisieme releve, troisieme angle mort. Les deux precedents ne voyaient
  -- que `storage.from('litteral')`. Ces quatre-la echappaient autrement :
  -- trois passent par une CONSTANTE (`storage.from(PULSE_MEDIA_BUCKET)`), et
  -- le quatrieme par une FONCTION D'AIDE, `uploadPublicFile('...')`, ou le nom
  -- ne figure meme pas au point d'appel du stockage.
  --
  -- Le drapeau suit ce que le code fait, et non ce qui semblerait prudent :
  -- pulse-media et rd-attachments signent leurs URL (`createSignedUrl`), donc
  -- prives ; editor-images et feedback-screenshots lisent `getPublicUrl`, donc
  -- publics. Les declarer prives ne les aurait pas proteges, seulement rendus
  -- muets -- une URL publique sur un espace prive repond 403 sans rien dire.
  ('pulse-media',               'pulse-media',               false),
  ('rd-attachments',            'rd-attachments',            false),
  ('editor-images',             'editor-images',             true),
  ('feedback-screenshots',      'feedback-screenshots',      true),
  -- Quatrieme releve : arrive avec la fonction de bord jarvis-tts, recuperee
  -- de l'amont le 2026-09-01. Elle depose l'audio synthetise en service_role
  -- (supabase/functions/jarvis-tts/index.ts:113) puis le sert par URL signee
  -- d'une heure (:126) : prive, comme pulse-media. Le portillon de publication
  -- l'a signale des le portage — c'est exactement le trou que ses trois
  -- releves precedents avaient appris a voir.
  ('jarvis-tts',                'jarvis-tts',                false)
ON CONFLICT (id) DO NOTHING;

-- --- règles d'accès --------------------------------------------------
--
-- Le critère retenu est l'authentification, pas l'appartenance à une
-- organisation : le découpage par organisation dépend de la façon dont chaque
-- exploitant structure ses données, et une règle inventée ici serait fausse
-- pour la plupart. Ce socle est donc volontairement simple et restrictif —
-- il se resserre, il ne s'ouvre pas.

-- La liste des espaces publics etait ecrite en dur, et DEUX FOIS -- une fois
-- en inclusion, une fois en exclusion. Ajouter un espace public obligeait donc
-- a modifier les deux ; en oublier une le rendait illisible des deux cotes, et
-- le symptome -- un 403 sur une URL publique -- ne designe pas sa cause.
-- Le drapeau `public` de storage.buckets est deja la source de verite : les
-- deux regles le lisent maintenant, et un espace ajoute plus haut est couvert
-- sans autre intervention.
DROP POLICY IF EXISTS "Lecture publique des espaces publics" ON storage.objects;
CREATE POLICY "Lecture publique des espaces publics"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id IN (SELECT id FROM storage.buckets WHERE public));

DROP POLICY IF EXISTS "Lecture des espaces prives par un compte" ON storage.objects;
CREATE POLICY "Lecture des espaces prives par un compte"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id NOT IN (SELECT id FROM storage.buckets WHERE public));

DROP POLICY IF EXISTS "Depot de fichier par un compte" ON storage.objects;
CREATE POLICY "Depot de fichier par un compte"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (owner = auth.uid() OR owner IS NULL);

-- Modifier ou retirer un fichier reste le fait de qui l'a déposé. Le rôle de
-- service, lui, n'est pas soumis à ces règles : il les contourne par
-- construction, ce qui laisse les traitements serveur faire leur travail.
DROP POLICY IF EXISTS "Remplacement de son propre fichier" ON storage.objects;
CREATE POLICY "Remplacement de son propre fichier"
  ON storage.objects FOR UPDATE TO authenticated
  USING (owner = auth.uid()) WITH CHECK (owner = auth.uid());

DROP POLICY IF EXISTS "Retrait de son propre fichier" ON storage.objects;
CREATE POLICY "Retrait de son propre fichier"
  ON storage.objects FOR DELETE TO authenticated
  USING (owner = auth.uid());

-- --- vérification ----------------------------------------------------

DO $$
DECLARE
  espaces integer;
  regles integer;
  ouvertes integer;
BEGIN
  SELECT count(*) INTO espaces FROM storage.buckets;
  SELECT count(*) INTO regles FROM pg_policies
   WHERE schemaname = 'storage' AND tablename = 'objects';

  -- Une règle sans clause TO s'applique à tous les rôles, anonyme compris :
  -- sur du stockage, c'est une fuite, pas une commodité.
  SELECT count(*) INTO ouvertes FROM pg_policies
   WHERE schemaname = 'storage' AND tablename = 'objects'
     AND (roles = '{public}' OR roles IS NULL)
     AND (qual IS NULL OR btrim(qual) = 'true');

  IF espaces < 21 THEN
    RAISE EXCEPTION 'seulement % espace(s) de stockage créé(s), 21 attendus', espaces;
  END IF;
  IF ouvertes > 0 THEN
    RAISE EXCEPTION '% règle(s) de stockage sans restriction de rôle', ouvertes;
  END IF;
  RAISE NOTICE '% espaces de stockage, % règles, aucune sans restriction', espaces, regles;
END $$;
