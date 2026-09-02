-- ============================================
-- SCRIPTS DE VALIDATION DES DONNÉES
-- Phase 2.4 : Vérifier l'intégrité des données
-- ============================================

-- ========================================
-- 1. VALIDATION DES SALAIRES RH
-- ========================================

-- Vérifier l'import des salaires
SELECT 
  COUNT(*) as total_salaires,
  SUM(salaire_brut) as masse_salariale_brute,
  COUNT(DISTINCT profile_id) as nb_employes,
  COUNT(DISTINCT mois) as nb_mois,
  MIN(mois) as premier_mois,
  MAX(mois) as dernier_mois
FROM rh_salaires_mensuels;
-- ATTENDU: 40+ salaires, 4 employés, 10+ mois

-- Détail par employé
SELECT 
  p.prenom || ' ' || p.nom as employe,
  COUNT(*) as nb_salaires,
  SUM(s.salaire_brut) as total_brut,
  AVG(s.salaire_brut) as moyenne_brut
FROM rh_salaires_mensuels s
JOIN profiles p ON p.id = s.profile_id
GROUP BY p.id, p.prenom, p.nom
ORDER BY p.nom;

-- Vérifier les salaires par mois
SELECT 
  mois,
  COUNT(*) as nb_employes,
  SUM(salaire_brut) as masse_salariale,
  SUM(salaire_net) as masse_nette,
  SUM(cotisations_patronales) as total_cotisations
FROM rh_salaires_mensuels
GROUP BY mois
ORDER BY mois DESC
LIMIT 12;

-- ========================================
-- 2. VALIDATION SYNC RH → TRÉSORERIE
-- ========================================

-- Vérifier la synchronisation RH → Trésorerie
SELECT 
  COUNT(*) as depenses_salaires,
  SUM(montant) as total_montant,
  COUNT(DISTINCT DATE_TRUNC('month', date_prevue)) as nb_mois,
  MIN(date_prevue) as premiere_depense,
  MAX(date_prevue) as derniere_depense
FROM tresorerie_depenses
WHERE source = 'rh_salaires';
-- ATTENDU: 40+ dépenses synchronisées

-- Vérifier la correspondance RH ↔ Trésorerie
SELECT 
  'RH' as source,
  COUNT(*) as count
FROM rh_salaires_mensuels
UNION ALL
SELECT 
  'Trésorerie (sync RH)' as source,
  COUNT(*) as count
FROM tresorerie_depenses
WHERE source = 'rh_salaires';
-- Les deux counts doivent être identiques

-- Vérifier les incohérences (salaires RH sans dépense associée)
SELECT 
  s.id as salaire_id,
  p.prenom || ' ' || p.nom as employe,
  s.mois,
  s.salaire_net
FROM rh_salaires_mensuels s
JOIN profiles p ON p.id = s.profile_id
WHERE NOT EXISTS (
  SELECT 1 
  FROM tresorerie_depenses d
  WHERE d.source = 'rh_salaires' 
    AND d.source_id = s.id::text
);
-- ATTENDU: 0 lignes (toutes les salaires doivent avoir une dépense)

-- ========================================
-- 3. VALIDATION DES RECETTES
-- ========================================

-- Vérifier les recettes générées
SELECT 
  COUNT(*) as nb_recettes,
  SUM(montant_prevu) as ca_prevu_total,
  COUNT(DISTINCT etablissement_id) as nb_clients,
  COUNT(DISTINCT mois) as nb_mois,
  MIN(mois) as premier_mois,
  MAX(mois) as dernier_mois
FROM tresorerie_recettes_mensuelles;
-- ATTENDU: ~180+ recettes (15 clients × 12 mois)

-- Détail par client
SELECT 
  e.nom as client,
  COUNT(*) as nb_recettes,
  SUM(r.montant_prevu) as ca_prevu_annuel,
  MIN(r.mois) as debut,
  MAX(r.mois) as fin
FROM tresorerie_recettes_mensuelles r
JOIN etablissements e ON e.id = r.etablissement_id
GROUP BY e.id, e.nom
ORDER BY ca_prevu_annuel DESC;

-- Vérifier les recettes par mois
SELECT 
  mois,
  COUNT(*) as nb_recettes,
  SUM(montant_prevu) as ca_prevu,
  SUM(montant_paye) as ca_realise,
  ROUND((SUM(montant_paye) * 100.0 / NULLIF(SUM(montant_prevu), 0))::numeric, 2) as taux_realisation
FROM tresorerie_recettes_mensuelles
GROUP BY mois
ORDER BY mois DESC
LIMIT 12;

-- ========================================
-- 4. VALIDATION DES DÉPENSES RÉCURRENTES
-- ========================================

-- Vérifier les dépenses récurrentes générées
SELECT 
  categorie_code,
  COUNT(*) as nb_occurrences,
  SUM(montant) as total,
  AVG(montant) as moyenne,
  MIN(date_prevue) as premiere_occurence,
  MAX(date_prevue) as derniere_occurence
FROM tresorerie_depenses
WHERE est_recurrent = true
GROUP BY categorie_code
ORDER BY total DESC;
-- ATTENDU: URSSAF, TVA, Mutuelle, Retraite, etc.

-- Total des dépenses récurrentes par mois
SELECT 
  DATE_TRUNC('month', date_prevue) as mois,
  COUNT(*) as nb_depenses,
  SUM(montant) as total_depenses
FROM tresorerie_depenses
WHERE est_recurrent = true
GROUP BY DATE_TRUNC('month', date_prevue)
ORDER BY mois DESC
LIMIT 6;

-- ========================================
-- 5. VALIDATION DU SOLDE DE TRÉSORERIE
-- ========================================

-- Vérifier le solde actuel
SELECT 
  date,
  solde_debut,
  total_recettes,
  total_depenses,
  solde_fin,
  CASE 
    WHEN solde_fin >= 0 THEN '✅ POSITIF'
    ELSE '❌ NÉGATIF'
  END as statut
FROM tresorerie_solde
WHERE date >= CURRENT_DATE - INTERVAL '1 month'
ORDER BY date DESC
LIMIT 3;
-- Le solde_fin DOIT être positif

-- Évolution du solde sur 12 mois
SELECT 
  date,
  solde_fin,
  LAG(solde_fin) OVER (ORDER BY date) as solde_precedent,
  solde_fin - LAG(solde_fin) OVER (ORDER BY date) as variation
FROM tresorerie_solde
WHERE date >= CURRENT_DATE - INTERVAL '12 months'
ORDER BY date DESC;

-- ========================================
-- 6. VALIDATION GLOBALE
-- ========================================

-- Résumé complet
SELECT 
  'Salaires RH' as table_name,
  COUNT(*) as nb_lignes
FROM rh_salaires_mensuels
UNION ALL
SELECT 
  'Dépenses Trésorerie (RH)',
  COUNT(*)
FROM tresorerie_depenses
WHERE source = 'rh_salaires'
UNION ALL
SELECT 
  'Dépenses récurrentes',
  COUNT(*)
FROM tresorerie_depenses
WHERE est_recurrent = true
UNION ALL
SELECT 
  'Recettes mensuelles',
  COUNT(*)
FROM tresorerie_recettes_mensuelles
UNION ALL
SELECT 
  'Soldes de trésorerie',
  COUNT(*)
FROM tresorerie_solde;

-- ========================================
-- 7. DÉTECTION D'ANOMALIES
-- ========================================

-- Salaires RH sans dépense associée
SELECT 
  'ANOMALIE: Salaires sans dépense' as type_anomalie,
  COUNT(*) as count
FROM rh_salaires_mensuels s
WHERE NOT EXISTS (
  SELECT 1 FROM tresorerie_depenses d
  WHERE d.source = 'rh_salaires' AND d.source_id = s.id::text
)
HAVING COUNT(*) > 0

UNION ALL

-- Dépenses avec montant négatif
SELECT 
  'ANOMALIE: Dépenses négatives',
  COUNT(*)
FROM tresorerie_depenses
WHERE montant < 0
HAVING COUNT(*) > 0

UNION ALL

-- Recettes avec montant négatif
SELECT 
  'ANOMALIE: Recettes négatives',
  COUNT(*)
FROM tresorerie_recettes_mensuelles
WHERE montant_prevu < 0
HAVING COUNT(*) > 0

UNION ALL

-- Soldes incohérents
SELECT 
  'ANOMALIE: Soldes incohérents',
  COUNT(*)
FROM tresorerie_solde
WHERE ABS(solde_fin - (solde_debut + total_recettes - total_depenses)) > 0.01
HAVING COUNT(*) > 0;

-- ========================================
-- 8. EXPORT POUR RAPPORTS
-- ========================================

-- Vue complète pour export Excel
CREATE OR REPLACE VIEW v_tresorerie_rapport_complet AS
SELECT 
  mois,
  
  -- Recettes
  (SELECT COALESCE(SUM(montant_prevu), 0) 
   FROM tresorerie_recettes_mensuelles r 
   WHERE r.mois::date = mois) as recettes_prevues,
  
  (SELECT COALESCE(SUM(montant_paye), 0) 
   FROM tresorerie_recettes_mensuelles r 
   WHERE r.mois::date = mois) as recettes_realisees,
  
  -- Dépenses salaires
  (SELECT COALESCE(SUM(montant), 0)
   FROM tresorerie_depenses d
   WHERE DATE_TRUNC('month', d.date_prevue) = mois
     AND d.source = 'rh_salaires') as depenses_salaires,
  
  -- Dépenses récurrentes
  (SELECT COALESCE(SUM(montant), 0)
   FROM tresorerie_depenses d
   WHERE DATE_TRUNC('month', d.date_prevue) = mois
     AND d.est_recurrent = true
     AND d.source != 'rh_salaires') as depenses_recurrentes,
  
  -- Total dépenses
  (SELECT COALESCE(SUM(montant), 0)
   FROM tresorerie_depenses d
   WHERE DATE_TRUNC('month', d.date_prevue) = mois) as total_depenses,
  
  -- Solde
  ts.solde_debut,
  ts.solde_fin
  
FROM generate_series(
  DATE_TRUNC('month', CURRENT_DATE - INTERVAL '6 months'),
  DATE_TRUNC('month', CURRENT_DATE + INTERVAL '12 months'),
  '1 month'::interval
) AS mois
LEFT JOIN tresorerie_solde ts ON ts.date::date = mois::date
ORDER BY mois;

-- Utilisation: SELECT * FROM v_tresorerie_rapport_complet;
