-- =====================================================================
-- Applications externes déclarées par l'exploitant.
--
-- POURQUOI CETTE CLÉ EXISTE
-- Le menu portait une liste d'applications COMPILÉE : libellé, icône, section
-- et équipes autorisées étaient dans le code, et seule l'adresse de cinq
-- emplacements prédéfinis pouvait être changée. Un exploitant ne pouvait donc
-- pas ajouter l'outil qu'il utilise réellement, ni retirer ceux qu'il n'a pas.
-- Il restait au passage un lien codé en dur vers un domaine d'exemple, affiché
-- dans le menu de toutes les instances et cliquable dans le vide.
--
-- La liste vit maintenant en base et s'édite depuis Paramètres → Configuration.
--
-- IDEMPOTENCE, ET POURQUOI LA GRAINE EST VIDE
-- `ON CONFLICT DO NOTHING` : une instance déjà configurée n'est jamais écrasée.
-- La graine est un tableau vide et non un exemple, parce qu'une entrée
-- d'exemple laissée en place devient un lien mort dans le menu — c'est
-- exactement le défaut que cette clé corrige.
--
-- La clé DOIT exister avant toute écriture : l'écran de configuration met à
-- jour la ligne, il ne la crée pas. Sans cette graine, l'enregistrement ne
-- toucherait aucune ligne et ne remonterait aucune erreur.
--
-- À appliquer après le schéma initial. Idempotent.
-- =====================================================================

DO $$
BEGIN
  IF to_regclass('public.app_config') IS NULL THEN
    RAISE NOTICE 'app_config absente : graine des applications externes ignorée';
    RETURN;
  END IF;

  INSERT INTO public.app_config (key, value, category, description)
  VALUES (
    'applications_externes',
    '[]'::jsonb,
    'infrastructure',
    'Applications externes affichées dans le menu, déclarées par l''exploitant'
  )
  ON CONFLICT (key) DO NOTHING;

  RAISE NOTICE 'applications externes : clé de configuration disponible';
END $$;

-- --- contrôle ---------------------------------------------------------
-- Une clé absente ferait échouer l'enregistrement en silence : l'écran de
-- configuration met à jour la ligne existante et ne la crée pas.
DO $$
DECLARE
  presente boolean;
BEGIN
  IF to_regclass('public.app_config') IS NULL THEN
    RETURN;
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.app_config WHERE key = 'applications_externes')
    INTO presente;

  IF NOT presente THEN
    RAISE EXCEPTION 'la clé applications_externes n''a pas été créée';
  END IF;
END $$;
