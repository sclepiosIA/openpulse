-- =====================================================================
-- Le premier administrateur, et la porte dérobée qui en tenait lieu.
--
-- POURQUOI CE FICHIER EXISTE
-- Un déclencheur refuse d'attribuer le rôle `admin` à un compte dont le second
-- facteur n'est pas activé. L'intention est bonne. Mais sur une instance
-- fraîchement installée, elle produit une impasse :
--
--   - le premier administrateur ne peut pas recevoir son rôle sans avoir activé
--     son second facteur ;
--   - il ne peut pas activer son second facteur sans ouvrir une session ;
--   - et l'application n'est utilisable par personne tant qu'aucun
--     administrateur n'existe.
--
-- Mesuré : `scripts/creer-admin.sh` échoue sur « Cannot assign admin role
-- without 2FA enabled ». Aucune instance neuve ne pouvait donc être ouverte.
--
-- LA PORTE DÉROBÉE
-- Le déclencheur prévoyait une seule échappatoire : un compte marqué
-- « bac à sable » portant l'adresse `test-admin@exemple.fr`, écrite en dur.
-- C'était le contournement de l'éditeur pour ses propres essais. Dans une
-- distribution publique, c'est une adresse connue de tous qui obtient le rôle
-- d'administrateur sans second facteur : il suffit de la créer. Elle disparaît.
--
-- CE QUI LA REMPLACE
-- Le PREMIER administrateur — et lui seul, tant qu'aucun autre n'existe — reçoit
-- son rôle sans second facteur. Dès qu'un administrateur existe, l'exigence
-- s'applique à tous les suivants, sans exception.
--
-- L'assouplissement est donc borné par un fait vérifiable en base, non par une
-- adresse, un drapeau ou une variable que l'on peut se donner à soi-même.
--
-- Idempotent : rejouable sans dommage.
-- =====================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'enforce_2fa_for_admin'
  ) THEN
    RAISE EXCEPTION
      'public.enforce_2fa_for_admin() est absente : appliquez le schéma applicatif avant ce fichier.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.enforce_2fa_for_admin() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $fonction$
DECLARE
  administrateurs_existants integer;
BEGIN
  IF NEW.role <> 'admin' THEN
    RETURN NEW;
  END IF;

  -- Second facteur activé : rien à discuter, c'est le cas normal.
  IF EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = NEW.user_id AND p.two_factor_enabled = true
  ) THEN
    RETURN NEW;
  END IF;

  -- Sinon, le seul cas toléré est l'amorçage : aucun administrateur n'existe
  -- encore. On compte les AUTRES comptes, pour qu'un administrateur ne puisse
  -- pas se réattribuer son propre rôle en contournant l'exigence.
  SELECT count(*) INTO administrateurs_existants
  FROM public.user_roles ur
  WHERE ur.role = 'admin' AND ur.user_id <> NEW.user_id;

  IF administrateurs_existants = 0 THEN
    RAISE NOTICE
      'premier administrateur cree sans second facteur : activez-le des la premiere session';
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'le role administrateur exige un second facteur actif (% administrateur(s) deja en place)',
    administrateurs_existants;
END;
$fonction$;

-- --- vérification ------------------------------------------------------

DO $$
DECLARE
  definition text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO definition
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'enforce_2fa_for_admin';

  -- L'adresse en dur ne doit plus ouvrir aucun droit.
  IF definition ILIKE '%test-admin@exemple.fr%' THEN
    RAISE EXCEPTION 'l''adresse de contournement figure encore dans le declencheur';
  END IF;

  IF definition NOT ILIKE '%administrateurs_existants%' THEN
    RAISE EXCEPTION 'le declencheur n''a pas ete remplace';
  END IF;

  RAISE NOTICE 'premier administrateur autorise sans second facteur, porte derobee retiree';
END $$;
