-- =====================================================================
-- Temps réel : droits du service, et publication des tables écoutées.
--
-- POURQUOI CE FICHIER EXISTE
-- Sur une instance fraîchement installée, aucune mise à jour en direct
-- n'arrive jamais. Rien ne le signale : les conteneurs démarrent, leur état
-- est « Up », l'application se charge et fonctionne. Seuls les badges, les
-- notifications et les fils de discussion restent figés jusqu'au prochain
-- rechargement manuel.
--
-- Deux causes distinctes, mesurées sur cette instance.
--
-- 1. LE SERVICE N'A PAS ACCÈS À SON PROPRE SCHÉMA
--    Le schéma `realtime` — celui des abonnements, à ne pas confondre avec
--    `_realtime` qui porte la configuration — appartenait à `postgres`, sans
--    aucun droit accordé à `supabase_admin`. Or c'est avec ce rôle que le
--    service se connecte. Mesuré :
--
--      has_schema_privilege('supabase_admin','realtime','USAGE')  -> false
--      has_schema_privilege('supabase_admin','realtime','CREATE') -> false
--
--    et, dans les traces du service, en boucle :
--
--      (MatchError) ... :insufficient_privilege,
--      message: "permission denied for schema realtime",
--      internal_query: "delete from realtime.subscription"
--
--    Le gestionnaire d'abonnements s'arrêtait donc à chaque connexion.
--
-- 2. LA PUBLICATION ÉTAIT VIDE
--    `supabase_realtime` existait, mais ne publiait AUCUNE table :
--
--      select count(*) from pg_publication_tables
--       where pubname = 'supabase_realtime';   -> 0
--
--    Même les droits rétablis, PostgreSQL n'aurait rien eu à diffuser. Ce
--    second défaut est le plus trompeur des deux : la connexion s'établit,
--    le canal s'ouvre, l'abonnement est accepté — et aucun événement n'arrive.
--
-- CE QUI EST PUBLIÉ, ET POURQUOI PAS TOUT
-- Une publication `FOR ALL TABLES` aurait été plus courte à écrire. Elle
-- aurait aussi versé dans le flux de réplication le contenu de toutes les
-- tables de la base, y compris celles qu'aucun écran n'écoute. La liste
-- ci-dessous est celle des tables réellement abonnées par l'application.
-- Elle est filtrée à l'exécution sur ce qui existe et qui est une vraie
-- table : une vue ou une table absente est ignorée sans faire échouer la
-- pose, ce qui laisse le fichier rejouable sur une base partielle.
--
-- REPLICA IDENTITY FULL
-- Sans elle, un événement de suppression ne transporte que la clé primaire,
-- et les règles de sécurité au niveau ligne n'ont pas de quoi décider qui a
-- le droit de le recevoir : l'événement est alors écarté sans message. Le
-- coût est réel — les journaux d'écriture grossissent, puisque l'ancienne
-- version de chaque ligne y est consignée — et il est assumé ici : il ne
-- porte que sur les tables effectivement écoutées.
--
-- CE QUE CE FICHIER NE FAIT PAS, ET POURQUOI
-- Il ne crée AUCUN objet dans le schéma `realtime`. Le service porte ses
-- propres migrations et les rejoue à chaque connexion de locataire : il crée
-- lui-même sa table `subscription`, ses types, ses fonctions et ses index.
--
-- Une version précédente de ce fichier posait un index à la main et annonçait
-- « un schéma à porter depuis le projet amont ». C'était un mauvais diagnostic,
-- établi sur une instance où l'amorçage pré-créait des objets approchants qui
-- bloquaient les migrations du service. En cessant de les pré-créer, le service
-- migre seul, et il n'y a rien à porter. Voir l'en-tête « temps réel » de
-- supabase/schema-00-bootstrap.sql.
--
-- Ce fichier ne traite donc que ce qui est du ressort de l'INSTALLATION, et que
-- le service ne peut pas décider : quels droits il a, et quelles tables de
-- l'application sont publiées.
--
-- Idempotent : rejouable sans dommage.
-- =====================================================================

-- --- 1. droits du service sur son schéma ------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN
    RAISE EXCEPTION 'le role supabase_admin est absent : appliquez l''amorcage avant ce fichier.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'realtime') THEN
    RAISE EXCEPTION 'le schema realtime est absent : appliquez le schema applicatif avant ce fichier.';
  END IF;
END $$;

ALTER SCHEMA realtime OWNER TO supabase_admin;

GRANT USAGE, CREATE ON SCHEMA realtime TO supabase_admin;
GRANT ALL ON ALL TABLES IN SCHEMA realtime TO supabase_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA realtime TO supabase_admin;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA realtime TO supabase_admin;

-- Les objets que le service crée lui-même ensuite doivent lui rester
-- accessibles, sans quoi le défaut réapparaîtrait à la première migration
-- interne du service.
ALTER DEFAULT PRIVILEGES IN SCHEMA realtime
  GRANT ALL ON TABLES TO supabase_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA realtime
  GRANT ALL ON SEQUENCES TO supabase_admin;

-- Les tables déjà en place appartiennent encore à `postgres` : le service ne
-- peut ni les vider ni les faire évoluer tant qu'il n'en est pas propriétaire.
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'realtime'
  LOOP
    EXECUTE format('ALTER TABLE realtime.%I OWNER TO supabase_admin', t.tablename);
  END LOOP;
END $$;

-- --- 1 ter. lecture des autres schémas --------------------------------
--
-- Pour décider qui a le droit de recevoir un événement, le service rejoue les
-- règles de sécurité au niveau ligne de la table concernée. Ces règles
-- appellent des fonctions, qui en appellent d'autres, réparties dans les
-- schémas de la plateforme. Il suffit qu'un maillon soit hors de portée pour
-- que l'abonnement échoue :
--
--   ERROR 42501 (insufficient_privilege) permission denied for schema cron
--
-- Mesuré : `supabase_admin` n'avait accès qu'à trois schémas sur douze.
--
-- ON POSE UNE RÈGLE, PAS UNE LISTE. Accorder l'accès au schéma nommé dans le
-- message aurait fait apparaître le suivant, puis le suivant : la liste des
-- schémas traversés dépend des règles écrites par chaque installation, et
-- aucune énumération ne peut être juste durablement. La boucle ci-dessous
-- couvre tous les schémas non système, présents comme futurs.
--
-- LECTURE SEULE, ET PAS DE SUPERUTILISATEUR. La distribution d'origine résout
-- ce point en faisant de `supabase_admin` un superutilisateur, ce qui lui
-- donne bien plus que ce dont il a besoin ici : évaluer des règles se fait en
-- lisant. Le rôle reste donc sans droit d'écriture sur les schémas des autres
-- services, et sans capacité d'élévation.

DO $$
DECLARE
  sch record;
BEGIN
  FOR sch IN
    SELECT nspname FROM pg_namespace
     WHERE nspname NOT LIKE 'pg\_%'
       AND nspname <> 'information_schema'
  LOOP
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO supabase_admin', sch.nspname);
    EXECUTE format('GRANT SELECT ON ALL TABLES IN SCHEMA %I TO supabase_admin', sch.nspname);
    EXECUTE format('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA %I TO supabase_admin', sch.nspname);
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT ON TABLES TO supabase_admin',
      sch.nspname);
  END LOOP;
END $$;

-- --- 1 bis. ce que ce fichier NE fait plus -----------------------------
--
-- Une version précédente posait ici l'index unique
-- `subscription_subscription_id_entity_filters_key`, parce que le service
-- échouait sans lui sur « no unique or exclusion constraint matching the
-- ON CONFLICT specification ».
--
-- C'était traiter le symptôme. La vraie cause était que l'amorçage pré-créait
-- `realtime.subscription` dans une forme approchante, ce qui empêchait le
-- service d'appliquer ses propres migrations — dont la n°13, qui crée cet index
-- exact. Le « correctif » entrait ensuite en collision avec elle : la migration
-- fait `create unique index` SANS `if not exists`, et se voyait refuser un nom
-- déjà pris. Le remède était devenu le blocage.
--
-- L'amorçage ne pré-crée plus rien dans ce schéma. Le service crée sa table,
-- ses types, ses fonctions et cet index. Il n'y a donc plus rien à poser ici.

-- --- 1 ter. lecture des autres schémas --------------------------------
--
-- Pour décider qui a le droit de recevoir un événement, le service rejoue les
-- règles de sécurité au niveau ligne de la table concernée. Ces règles
-- appellent des fonctions, qui en appellent d'autres, réparties dans les
-- schémas de la plateforme. Il suffit qu'un maillon soit hors de portée pour
-- que l'abonnement échoue :
--
--   ERROR 42501 (insufficient_privilege) permission denied for schema cron
--
-- Mesuré : `supabase_admin` n'avait accès qu'à trois schémas sur douze.
--
-- ON POSE UNE RÈGLE, PAS UNE LISTE. Accorder l'accès au schéma nommé dans le
-- message aurait fait apparaître le suivant, puis le suivant : la liste des
-- schémas traversés dépend des règles écrites par chaque installation, et
-- aucune énumération ne peut être juste durablement. La boucle ci-dessous
-- couvre tous les schémas non système, présents comme futurs.
--
-- LECTURE SEULE, ET PAS DE SUPERUTILISATEUR. La distribution d'origine résout
-- ce point en faisant de `supabase_admin` un superutilisateur, ce qui lui
-- donne bien plus que ce dont il a besoin ici : évaluer des règles se fait en
-- lisant. Le rôle reste donc sans droit d'écriture sur les schémas des autres
-- services, et sans capacité d'élévation.

DO $$
DECLARE
  sch record;
BEGIN
  FOR sch IN
    SELECT nspname FROM pg_namespace
     WHERE nspname NOT LIKE 'pg\_%'
       AND nspname <> 'information_schema'
  LOOP
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO supabase_admin', sch.nspname);
    EXECUTE format('GRANT SELECT ON ALL TABLES IN SCHEMA %I TO supabase_admin', sch.nspname);
    EXECUTE format('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA %I TO supabase_admin', sch.nspname);
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT ON TABLES TO supabase_admin',
      sch.nspname);
  END LOOP;
END $$;

-- --- 2. publication des tables écoutées -------------------------------

DO $$
DECLARE
  ecoutees text[] := ARRAY[
    'activity_feed_reactions','apporteur_exchanges','apporteur_manual_scores',
    'apporteur_next_steps','bookings','calendar_events',
    'calendar_invitation_suggestions','calendars','calls','churn_predictions',
    'compta_budget_lignes','compta_budgets','editorial_calendar_state',
    'email_domain_mappings','email_folders','email_messages',
    'email_thread_folders','email_threads','enquetes_satisfaction_formation',
    'enquetes_satisfaction_solution','etablissements','etablissements_groupes',
    'event_attendees','event_reminders','factures','formation_sessions',
    'in_app_notifications','jarvis_background_jobs','jarvis_proactive_alerts',
    'live_chat_conversations','live_chat_messages','messages','notes',
    'partenaires','partenaires_contacts','pending_contacts','personal_todos',
    'profiles','pulse_message_receipts','pulse_messages','pulse_presence',
    'pulse_reactions','pulse_visio_participants','push_notification_preferences',
    'push_subscriptions','rd_tasks','satisfaction_surveys','signature_events',
    'signature_requests','support_tickets','system_config','taches',
    'tresorerie_operations_bancaires','tresorerie_revenus',
    'visio_transcription_participants','visio_transcription_segments',
    'workflow_runs'
  ];
  nom text;
  posees integer := 0;
  ignorees integer := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  FOREACH nom IN ARRAY ecoutees LOOP
    -- `BASE TABLE` écarte les vues, qu'une publication ne peut pas porter, et
    -- les tables qu'un profil d'installation restreint n'a pas créées.
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = nom AND table_type = 'BASE TABLE'
    ) THEN
      ignorees := ignorees + 1;
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = nom
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', nom);
    END IF;

    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', nom);
    posees := posees + 1;
  END LOOP;

  RAISE NOTICE 'temps reel : % table(s) publiee(s), % ignoree(s) (absente ou vue)', posees, ignorees;
END $$;

-- --- vérification ------------------------------------------------------

DO $$
DECLARE
  publiees integer;
  sans_identite integer;
BEGIN
  IF NOT has_schema_privilege('supabase_admin', 'realtime', 'USAGE')
     OR NOT has_schema_privilege('supabase_admin', 'realtime', 'CREATE') THEN
    RAISE EXCEPTION 'supabase_admin n''a toujours pas acces au schema realtime';
  END IF;

  SELECT count(*) INTO publiees
  FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

  IF publiees = 0 THEN
    RAISE EXCEPTION
      'la publication supabase_realtime est vide : aucun evenement ne serait diffusé';
  END IF;

  -- Une table publiée sans identité complète diffuse des suppressions que la
  -- sécurité au niveau ligne ne saura pas filtrer : elles seront écartées.
  SELECT count(*) INTO sans_identite
  FROM pg_publication_tables pt
  JOIN pg_class c ON c.relname = pt.tablename
  JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = pt.schemaname
  WHERE pt.pubname = 'supabase_realtime' AND c.relreplident <> 'f';

  IF sans_identite > 0 THEN
    RAISE EXCEPTION
      '% table(s) publiee(s) sans REPLICA IDENTITY FULL', sans_identite;
  END IF;

  SELECT count(*) INTO sans_identite
  FROM pg_namespace
  WHERE nspname NOT LIKE 'pg\_%' AND nspname <> 'information_schema'
    AND NOT has_schema_privilege('supabase_admin', nspname, 'USAGE');

  IF sans_identite > 0 THEN
    RAISE EXCEPTION
      '% schema(s) restent hors de portee du service temps reel', sans_identite;
  END IF;

  RAISE NOTICE 'temps reel : schema accessible, % table(s) publiee(s) avec identite complete', publiees;
END $$;
