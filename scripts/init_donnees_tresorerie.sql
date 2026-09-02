-- ==================================================
-- SCRIPT D'INITIALISATION TRÉSORERIE & RH
-- ==================================================

-- 1. INSÉRER DES SALAIRES DE TEST (4 employés × 3 mois)
INSERT INTO rh_salaires_mensuels (profile_id, mois, salaire_brut, salaire_net, cotisations_patronales, cotisations_salariales)
SELECT 
  id,
  mois,
  COALESCE(salaire_brut, 3500) as salaire_brut,
  COALESCE(salaire_brut, 3500) * 0.77 as salaire_net,
  COALESCE(salaire_brut, 3500) * 0.45 as cotisations_patronales,
  COALESCE(salaire_brut, 3500) * 0.23 as cotisations_salariales
FROM profiles
CROSS JOIN (
  SELECT to_char(date_trunc('month', CURRENT_DATE - interval '2 months'), 'YYYY-MM-01') as mois
  UNION ALL
  SELECT to_char(date_trunc('month', CURRENT_DATE - interval '1 month'), 'YYYY-MM-01')
  UNION ALL
  SELECT to_char(date_trunc('month', CURRENT_DATE), 'YYYY-MM-01')
) mois_data
WHERE actif = true
ON CONFLICT (profile_id, mois) DO NOTHING;

-- Vérification
SELECT COUNT(*), mois FROM rh_salaires_mensuels GROUP BY mois ORDER BY mois;

-- 2. GÉNÉRER DES DÉPENSES SALAIRES (synchronisées avec RH)
INSERT INTO tresorerie_depenses (
  nom, 
  categorie_code, 
  montant, 
  date_prevue, 
  statut, 
  source, 
  source_id
)
SELECT 
  'Salaire ' || p.prenom || ' ' || p.nom,
  'DEP_SALAIRES_NETS',
  s.salaire_net,
  (s.mois || '-05')::date, -- Le 5 du mois
  'en_attente',
  'rh_salaires',
  s.id
FROM rh_salaires_mensuels s
JOIN profiles p ON p.id = s.profile_id
ON CONFLICT DO NOTHING;

-- 3. GÉNÉRER DES DÉPENSES FIXES RÉCURRENTES
INSERT INTO tresorerie_depenses (nom, categorie_code, montant, date_prevue, statut, est_recurrent, recurrence)
VALUES
  ('URSSAF', 'DEP_URSSAF', 3200, DATE_TRUNC('month', CURRENT_DATE) + interval '15 days', 'en_attente', true, 'mensuel'),
  ('TVA', 'DEP_TVA', 2500, DATE_TRUNC('month', CURRENT_DATE) + interval '20 days', 'en_attente', true, 'mensuel'),
  ('Loyer bureau', 'DEP_LOYER', 1800, DATE_TRUNC('month', CURRENT_DATE) + interval '1 days', 'en_attente', true, 'mensuel'),
  ('GitHub Teams', 'DEP_LICENCES', 89, DATE_TRUNC('month', CURRENT_DATE) + interval '10 days', 'en_attente', true, 'mensuel'),
  ('Supabase Pro', 'DEP_LICENCES', 25, DATE_TRUNC('month', CURRENT_DATE) + interval '10 days', 'en_attente', true, 'mensuel'),
  ('Azure OpenAI', 'DEP_LICENCES', 450, DATE_TRUNC('month', CURRENT_DATE) + interval '10 days', 'en_attente', true, 'mensuel')
ON CONFLICT DO NOTHING;

-- 4. CALCULER ET SAUVEGARDER LE SOLDE INITIAL
DO $$
DECLARE
  solde_debut NUMERIC := 50000; -- Solde initial fictif
  total_recettes NUMERIC;
  total_depenses NUMERIC;
BEGIN
  -- Calculer le total des recettes (0 pour l'instant)
  SELECT COALESCE(SUM(montant_prevu), 0) INTO total_recettes
  FROM tresorerie_recettes_mensuelles
  WHERE mois = to_char(CURRENT_DATE, 'YYYY-MM-01');
  
  -- Calculer le total des dépenses du mois
  SELECT COALESCE(SUM(montant), 0) INTO total_depenses
  FROM tresorerie_depenses
  WHERE date_prevue >= DATE_TRUNC('month', CURRENT_DATE)
    AND date_prevue < DATE_TRUNC('month', CURRENT_DATE) + interval '1 month';
  
  -- Insérer le solde du mois
  INSERT INTO tresorerie_solde (date, solde_debut, solde_fin, total_recettes, total_depenses)
  VALUES (
    DATE_TRUNC('month', CURRENT_DATE),
    solde_debut,
    solde_debut + total_recettes - total_depenses,
    total_recettes,
    total_depenses
  )
  ON CONFLICT (date) DO UPDATE SET
    total_recettes = EXCLUDED.total_recettes,
    total_depenses = EXCLUDED.total_depenses,
    solde_fin = EXCLUDED.solde_fin;
  
  RAISE NOTICE 'Solde créé: début=%, recettes=%, dépenses=%, fin=%',
    solde_debut, total_recettes, total_depenses, solde_debut + total_recettes - total_depenses;
END $$;

-- 5. AFFICHER LES STATISTIQUES
SELECT 
  'Salaires' as table_name, 
  COUNT(*) as count,
  TO_CHAR(SUM(salaire_brut), '999,999€') as total
FROM rh_salaires_mensuels
UNION ALL
SELECT 
  'Dépenses', 
  COUNT(*),
  TO_CHAR(SUM(montant), '999,999€')
FROM tresorerie_depenses
UNION ALL
SELECT 
  'Recettes', 
  COUNT(*),
  TO_CHAR(SUM(montant_prevu), '999,999€')
FROM tresorerie_recettes_mensuelles
UNION ALL
SELECT 
  'Soldes', 
  COUNT(*),
  TO_CHAR(AVG(solde_fin), '999,999€')
FROM tresorerie_solde;
