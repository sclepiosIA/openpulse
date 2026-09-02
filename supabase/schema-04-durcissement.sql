-- =====================================================================
-- Durcissement des policies laxistes du schema consolide.
--
-- Le schema est extrait d'une base reelle : il porte donc les choix qui y ont
-- ete faits, y compris ceux qui ne conviennent pas a une distribution destinee
-- a etre installee telle quelle par des tiers.
--
-- Ce fichier ne touche QUE ce qui est defendable objectivement. Sur les 48
-- policies « USING (true) » du schema :
--   36 sont restreintes a TO authenticated. Sur une application dont tous les
--      utilisateurs appartiennent a la meme organisation, un partage interne
--      est un choix assume, pas un defaut. Elles sont conservees.
--   11 sont restreintes a TO service_role, qui contourne deja la securite au
--      niveau ligne par construction : elles n'ont aucun effet de securite.
--    1 n'a AUCUNE restriction de role. C'est la seule corrigee ici.
--
-- A appliquer apres le schema initial. Idempotent.
-- =====================================================================

-- --- forum_votes : suppression ouverte a tous -------------------------
-- La policy d'origine, « Public can delete votes », est FOR DELETE USING (true)
-- sans clause TO : elle s'applique donc a tous les roles, y compris au role
-- anonyme. Concretement, un visiteur non authentifie peut supprimer n'importe
-- quel vote de n'importe quel utilisateur.
--
-- La regle retenue : on ne supprime que son propre vote, et il faut etre
-- authentifie pour cela.
DO $$
BEGIN
  IF to_regclass('public.forum_votes') IS NULL THEN
    RAISE NOTICE 'forum_votes absente, durcissement sans objet';
    RETURN;
  END IF;

  DROP POLICY IF EXISTS "Public can delete votes" ON public.forum_votes;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'forum_votes' AND column_name = 'user_id'
  ) THEN
    DROP POLICY IF EXISTS "Un utilisateur supprime ses propres votes" ON public.forum_votes;
    CREATE POLICY "Un utilisateur supprime ses propres votes"
      ON public.forum_votes FOR DELETE TO authenticated
      USING (user_id = auth.uid());
    RAISE NOTICE 'forum_votes : suppression restreinte a l''auteur du vote';
  ELSE
    -- Sans colonne d'appartenance, aucune regle sure n'est derivable : on
    -- ferme, plutot que de laisser ouvert.
    RAISE NOTICE 'forum_votes sans colonne user_id : suppression fermee';
  END IF;
END $$;

-- --- tables du module Drive sans securite au niveau ligne -------------
-- Huit tables du module Drive n'ont aucune securite au niveau ligne. Sur une
-- API REST derivee du schema, cela signifie que tout porteur d'un jeton valide
-- peut lire les fichiers, les dossiers et les permissions de tout le monde.
--
-- Constat qui permet de trancher sans rien casser :
--   - aucun fichier de l'interface n'interroge ces tables par l'API REST ;
--   - le service Drive se connecte DIRECTEMENT a la base avec son propre role.
--
-- On active donc la securite au niveau ligne SANS aucune policy : l'API REST
-- publique ne sert plus rien sur ces tables, et le service continue de
-- fonctionner par sa connexion directe. Une organisation qui souhaite exposer
-- le Drive par l'API REST devra ecrire ses policies, ce qui est un choix
-- explicite et non un defaut hérité.
DO $$
DECLARE
  t text;
  n integer := 0;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables tb
    JOIN pg_class c ON c.relname = tb.tablename
    JOIN pg_namespace ns ON ns.oid = c.relnamespace AND ns.nspname = tb.schemaname
    WHERE tb.schemaname = 'public'
      AND tb.tablename LIKE 'drive\_%'
      AND NOT c.relrowsecurity
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    n := n + 1;
  END LOOP;
  IF n > 0 THEN
    RAISE NOTICE 'securite au niveau ligne activee sur % table(s) du module Drive', n;
  END IF;
END $$;

-- --- controle ---------------------------------------------------------
-- Une policy permissive sans restriction de role qui subsisterait apres ce
-- fichier serait un defaut non traite : on echoue plutot que de le taire.
DO $$
DECLARE
  restantes integer;
  detail text;
BEGIN
  SELECT count(*), string_agg(schemaname || '.' || tablename || ' / ' || policyname, ', ')
    INTO restantes, detail
  FROM pg_policies
  WHERE schemaname = 'public'
    AND qual = 'true'
    AND (roles = '{public}' OR roles IS NULL);

  IF restantes > 0 THEN
    RAISE EXCEPTION 'policies permissives sans restriction de role encore presentes (%) : %', restantes, detail;
  END IF;
  RAISE NOTICE 'aucune policy permissive sans restriction de role';
END $$;

-- =====================================================================
-- Ecritures anonymes sur des journaux internes.
--
-- La verification finale de ce fichier ne regarde que `qual = 'true'`, ce qui
-- couvre lecture, modification et suppression. Elle laisse passer les policies
-- d'INSERT, dont la contrainte vit dans `with_check` : huit d'entre elles
-- acceptaient une insertion de n'importe quel role, anonyme compris.
--
-- Six concernent un forum et une messagerie publics : y ecrire sans compte est
-- la fonction meme de ces ecrans, on n'y touche pas. Les deux autres sont des
-- journaux internes, et rien ne justifie qu'un visiteur non authentifie y
-- ajoute des lignes -- a fortiori dans un journal d'audit de second facteur,
-- ou des ecritures fabriquees noient les vraies.
-- =====================================================================

DROP POLICY IF EXISTS "Insert activities" ON public.contrat_activities;
CREATE POLICY "Un utilisateur connecte journalise une activite de contrat"
  ON public.contrat_activities FOR INSERT TO authenticated
  WITH CHECK (performed_by IS NULL OR performed_by = auth.uid());

DROP POLICY IF EXISTS "System can insert 2FA audit" ON public.two_factor_audit;
CREATE POLICY "Le journal d audit du second facteur n accepte que le service"
  ON public.two_factor_audit FOR INSERT TO authenticated, service_role
  WITH CHECK (user_id IS NULL OR user_id = auth.uid() OR auth.role() = 'service_role');

-- Verification : plus aucune insertion anonyme hors surfaces publiques.
DO $$
DECLARE
  restantes integer;
  detail text;
  SURFACES_PUBLIQUES text[] := ARRAY[
    'forum_comments', 'forum_posts', 'forum_votes',
    'live_chat_conversations', 'live_chat_messages', 'live_chat_sessions'
  ];
BEGIN
  SELECT count(*), string_agg(tablename || ' / ' || policyname, ', ')
    INTO restantes, detail
  FROM pg_policies
  WHERE schemaname = 'public'
    AND cmd = 'INSERT'
    AND (roles = '{public}' OR roles IS NULL)
    AND (with_check IS NULL OR btrim(with_check) = 'true')
    AND NOT (tablename = ANY (SURFACES_PUBLIQUES));

  IF restantes > 0 THEN
    RAISE EXCEPTION 'insertions anonymes sans contrainte hors surfaces publiques (%) : %', restantes, detail;
  END IF;
  RAISE NOTICE 'insertions anonymes limitees aux six surfaces publiques assumees';
END $$;

DO $$
DECLARE
  sans_rls integer;
  detail text;
BEGIN
  SELECT count(*), string_agg(tb.tablename, ', ')
    INTO sans_rls, detail
  FROM pg_tables tb
  JOIN pg_class c ON c.relname = tb.tablename
  JOIN pg_namespace ns ON ns.oid = c.relnamespace AND ns.nspname = tb.schemaname
  WHERE tb.schemaname = 'public' AND NOT c.relrowsecurity;

  IF sans_rls > 0 THEN
    RAISE EXCEPTION 'tables sans securite au niveau ligne (%) : %', sans_rls, detail;
  END IF;
  RAISE NOTICE 'toutes les tables du schema applicatif sont protegees';
END $$;

-- --- creation de groupe : une autorisation portee par une chaine libre ------
--
-- LA CHAINE, EN TROIS REQUETES
-- (1) « Authenticated users can create groups » autorise TOUT compte connecte a
--     inserer un groupe et a en choisir le nom ; la table n'a aucune contrainte
--     d'unicite sur `name`.
-- (2) « Group creators can add members » laisse le createur ajouter qui il veut.
-- (3) `is_member_of_group(nom)` compare `lower(ug.name) = lower(nom)` et ne
--     regarde JAMAIS qui a cree le groupe.
--
-- Un compte ordinaire se cree donc un groupe nomme « dev », s'y ajoute, et
-- `is_member_of_group('dev')` lui repond vrai. Les trois policies d'api_keys
-- qui s'appuient dessus lui sont alors ouvertes : il fabrique des cles.
--
-- Portee mesuree : `is_member_of_group` n'apparait que dans ces trois policies,
-- toutes sur api_keys, toutes avec « dev ». Fermer la creation de groupe
-- suffit donc a couper la chaine, sans toucher au reste.
--
-- Le nom reste libre pour un administrateur : c'est lui qui decide qui est
-- « dev ». Ce qui change, c'est qu'un compte ordinaire ne se decerne plus le
-- titre lui-meme.
DO $$
BEGIN
  IF to_regclass('public.user_groups') IS NULL THEN
    RAISE NOTICE 'user_groups absente : durcissement ignore';
    RETURN;
  END IF;

  DROP POLICY IF EXISTS "Authenticated users can create groups" ON public.user_groups;
  CREATE POLICY "Un administrateur cree les groupes"
    ON public.user_groups FOR INSERT TO authenticated
    WITH CHECK (public.is_admin());

  RAISE NOTICE 'user_groups : creation reservee aux administrateurs';
END $$;

-- --- api_keys : le champ « permissions » est ecrit par le navigateur --------
--
-- `permissions` EST le vecteur d'autorisation. Dix fonctions de bord le lisent
-- par `_shared/platform-auth.ts`, qui retient la premiere entree commencant par
-- « platform: » et s'en sert comme portee, sans jamais verifier qui a cree la
-- cle. D'autres fonctions y cherchent « write » ou « admin ».
--
-- Or la colonne n'a aucune contrainte, et la policy « Dev members can create
-- api_keys » n'autorise l'insertion que sur `created_by = auth.uid()` et
-- l'appartenance au groupe « dev » : elle ne regarde pas ce qui est ecrit dans
-- `permissions`. Un membre du groupe « dev », NON administrateur, pouvait donc
-- inserer directement une ligne portant une portee « platform: » et obtenir les
-- droits correspondants.
--
-- La regle retenue : les portees privilegiees restent reservees aux
-- administrateurs. Un declencheur, et non une contrainte CHECK, parce que la
-- decision depend de l'appelant et pas seulement de la valeur.
CREATE OR REPLACE FUNCTION public.api_keys_refuser_portee_privilegiee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  portee text;
BEGIN
  -- Le role de service cree des cles cote serveur -- platform-admin valide la
  -- portee dans son propre code, contre une liste blanche. Il contourne deja
  -- la securite au niveau ligne par construction.
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- LISTE D'AUTORISATION, ET NON DE REFUS. Une liste de refus manque toujours
  -- une portee : la premiere version ne refusait que « platform:* » et
  -- « admin », alors que api-v1-tickets accorde l'ecriture sur la seule
  -- presence de « write » (index.ts:81) et s'execute avec le role de service,
  -- donc hors securite au niveau ligne. Un membre du groupe « dev » pouvait
  -- ainsi se delivrer une cle d'ecriture depuis le navigateur.
  --
  -- Un compte non administrateur ne peut donc ecrire que « read ». Toute
  -- portee ajoutee plus tard par une fonction de bord est refusee par defaut
  -- au lieu d'etre accordee par oubli.
  FOR portee IN SELECT jsonb_array_elements_text(COALESCE(NEW.permissions, '[]'::jsonb))
  LOOP
    IF lower(trim(portee)) <> 'read' THEN
      RAISE EXCEPTION
        'portee « % » reservee aux administrateurs', portee
        USING ERRCODE = '42501';
    END IF;
  END LOOP;

  -- REACTIVATION D'UNE CLE REVOQUEE.
  -- La revocation n'ecrit que trois colonnes : est_active, revoked_at et
  -- revoked_by. Et c'est exactement ce que la verification de cle regarde.
  -- Or la policy « Dev members can update own api_keys » autorise la mise a
  -- jour de ses propres lignes SANS restriction de colonne : le porteur d'une
  -- cle revoquee la remettait en service par un simple UPDATE. Tant que ce
  -- declencheur ne se posait que « OF permissions », cette mise a jour ne le
  -- reveillait meme pas.
  IF TG_OP = 'UPDATE' THEN
    IF (OLD.est_active IS DISTINCT FROM true AND NEW.est_active IS TRUE)
       OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS NULL) THEN
      RAISE EXCEPTION
        'la remise en service d''une cle revoquee est reservee aux administrateurs'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END $$;

DO $$
BEGIN
  IF to_regclass('public.api_keys') IS NULL THEN
    RAISE NOTICE 'api_keys absente : durcissement ignore';
    RETURN;
  END IF;

  DROP TRIGGER IF EXISTS api_keys_portee_privilegiee ON public.api_keys;
  CREATE TRIGGER api_keys_portee_privilegiee
    BEFORE INSERT OR UPDATE ON public.api_keys
    FOR EACH ROW
    EXECUTE FUNCTION public.api_keys_refuser_portee_privilegiee();

  RAISE NOTICE 'api_keys : portees privilegiees reservees aux administrateurs';
END $$;
