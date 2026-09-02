-- =============================================================================
-- OpenPulse — jeu de demonstration pour une instance fraiche
-- =============================================================================
--
-- Objectif : donner a un evaluateur une application VIVANTE (une organisation, des
-- clients, des contacts, des taches, des factures) sans jamais manipuler de donnee
-- reelle. Tout ce qui suit est fictif :
--
--   * les etablissements, villes et adresses sont inventes ;
--   * les adresses de messagerie utilisent les domaines reserves par la RFC 2606
--     (`example.org`, `example.com`, `.test`), qu aucun tiers ne peut enregistrer ;
--   * les numeros de telephone appartiennent aux plages francaises reservees a la
--     fiction (01 99 00 xx xx, 02 61 91 xx xx, 03 53 01 xx xx, 04 65 71 xx xx,
--     05 36 49 xx xx pour le fixe, 06 39 98 xx xx pour le mobile). Ces formats
--     satisfont `isValidFrenchPhone` (`src/lib/validationHelpers.ts`) et
--     `formatPhone` (`src/lib/formatters.ts`).
--
-- Proprietes
-- ----------
-- * IDEMPOTENT : rejouable sans erreur ni doublon. Toutes les insertions utilisent
--   `ON CONFLICT DO NOTHING` (sans cible, donc valable pour toute contrainte d unicite)
--   et des identifiants fixes.
-- * SANS EXTENSION EXOTIQUE : aucun appel a `unaccent`, `uuid-ossp`, `pgcrypto`,
--   `postgis`. Les UUID sont ecrits en clair ; les `slug` sont fournis explicitement,
--   ce qui court-circuite le declencheur `set_slug_on_insert` (lequel appelle `unaccent`).
-- * TRANSACTIONNEL : tout ou rien.
--
-- Comment l appliquer
-- -------------------
--   psql "$DATABASE_URL" -f supabase/seed-demo.sql
--   # ou, en local :  supabase db reset && psql ... -f supabase/seed-demo.sql
--
-- A executer avec le role proprietaire de la base (ou la cle de service), PAS avec la
-- cle anonyme : les tables visees sont protegees par RLS.
--
-- Utilisateurs
-- ------------
-- Ce script ne cree AUCUN compte. `public.profiles.user_id` reference `auth.users`,
-- qui se peuple par l API d authentification, pas par SQL. Les colonnes de
-- responsabilite (`commercial_id`, `chef_projet_id`, `csm_id`, `responsable_id`) sont
-- donc laissees nulles : creez un compte par l ecran d inscription, puis affectez-le
-- depuis l interface.
--
-- Effet de bord attendu
-- ---------------------
-- L insertion d un etablissement declenche `create_tasks_from_models_on_insert`, qui
-- ajoute des taches issues de `modeles_taches` selon le statut. Les taches nommees
-- ci-dessous s ajoutent a celles-la ; c est voulu, le tableau de bord n en est que
-- plus credible.
--
-- Purge
-- -----
-- Un bloc de suppression est fourni, commente, en fin de fichier.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Categories de taches (garantie de presence avant toute insertion de tache)
-- -----------------------------------------------------------------------------
INSERT INTO public.categories_taches (nom, description, ordre, couleur) VALUES
  ('Contractuel', 'Signature et formalites contractuelles',   1, '#64748B'),
  ('Conformité',  'Validation RGPD, DPO et securite',          2, '#F59E0B'),
  ('Déploiement', 'Installation et integration technique',     3, '#3B82F6'),
  ('Formation',   'Formation des utilisateurs',                4, '#8B5CF6'),
  ('Go-Live',     'Mise en production et suivi initial',       5, '#10B981'),
  ('Suivi',       'Suivi post-deploiement et support',         6, '#06B6D4')
ON CONFLICT (nom) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2. Identite de l organisation qui heberge l instance
--    Ecrite uniquement si la cle est encore vierge : un deploiement deja configure
--    n est jamais ecrase.
-- -----------------------------------------------------------------------------
INSERT INTO public.app_config (key, value, category, description) VALUES (
  'company_info',
  '{
    "name": "Alcyon Santé (démonstration)",
    "address": "14 rue des Marronniers",
    "city": "37000 Villebrume",
    "siret": "00000000000000",
    "tva_intracom": "FR00000000000",
    "email": "contact@alcyon-sante.example.org",
    "phone": "01 99 00 00 01",
    "iban": "FR7630001007941234567890185",
    "bic": "BANKFRPPXXX",
    "logo_url": null
  }'::jsonb,
  'company',
  'Informations legales de l organisation, affichees sur les factures et documents'
)
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      updated_at = now()
  WHERE app_config.value->>'name' IS NULL
     OR app_config.value->>'name' IN ('', '[À RENSEIGNER]');

INSERT INTO public.app_config (key, value, category, description) VALUES (
  'email_sender',
  '{
    "default_from": "noreply@alcyon-sante.example.org",
    "notifications_from": "notifications@alcyon-sante.example.org",
    "formations_from": "formations@alcyon-sante.example.org",
    "support_from": "support@alcyon-sante.example.org"
  }'::jsonb,
  'company',
  'Adresses expeditrices par categorie'
)
ON CONFLICT (key) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. Etablissements clients (4 comptes couvrant tout le cycle de vie)
--    Les dates sont relatives a CURRENT_DATE : la demonstration reste fraiche
--    quelle que soit la date d installation.
-- -----------------------------------------------------------------------------
INSERT INTO public.etablissements (
  id, nom, slug, type, ville, region, adresse, code_postal,
  telephone, email, statut, date_signature, progression, notes
) VALUES
  (
    'a0000000-0000-4000-8000-000000000001',
    'CH Villebrume', 'demo-ch-villebrume', 'CH',
    'Villebrume', 'Centre-Val de Loire',
    '14 rue des Marronniers', '37000',
    '02.61.91.00.10', 'contact@ch-villebrume.example.org',
    'Production', (CURRENT_DATE - INTERVAL '14 months')::date, 100,
    'Compte de démonstration OpenPulse — données fictives.'
  ),
  (
    'a0000000-0000-4000-8000-000000000002',
    'CHU Montaubry', 'demo-chu-montaubry', 'CHU',
    'Montaubry', 'Auvergne-Rhône-Alpes',
    '9 avenue du Parc', '69008',
    '04.65.71.00.20', 'contact@chu-montaubry.example.org',
    'Déploiement', (CURRENT_DATE - INTERVAL '5 months')::date, 55,
    'Compte de démonstration OpenPulse — données fictives.'
  ),
  (
    'a0000000-0000-4000-8000-000000000003',
    'Clinique des Glycines', 'demo-clinique-glycines', 'Privé',
    'Chandreux', 'Provence-Alpes-Côte d''Azur',
    '6 chemin des Vignes', '13009',
    '04.65.71.00.30', 'direction@clinique-glycines.example.org',
    'Formation', (CURRENT_DATE - INTERVAL '2 months')::date, 30,
    'Compte de démonstration OpenPulse — données fictives.'
  ),
  (
    'a0000000-0000-4000-8000-000000000004',
    'GHT Rives de Vègre', 'demo-ght-rives-de-vegre', 'GHT',
    'Aubercourt', 'Hauts-de-France',
    '25 rue de la Boule', '59000',
    '03.53.01.00.40', 'contact@ght-vegre.example.org',
    'Négociation', NULL, 0,
    'Prospect de démonstration OpenPulse — données fictives.'
  )
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- 4. Contacts clients (2 par etablissement)
-- -----------------------------------------------------------------------------
INSERT INTO public.contacts (
  id, etablissement_id, nom, prenom, fonction, email, telephone,
  est_contact_principal, type_contact
) VALUES
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'Marchand', 'Hélène', 'Directrice des finances',
   'helene.marchand@ch-villebrume.example.org', '02.61.91.00.11', true, 'principal'),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
   'Vasseur', 'Pierre', 'Directeur des systèmes d''information',
   'pierre.vasseur@ch-villebrume.example.org', '06.39.98.00.11', false, 'dsi'),

  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000002',
   'Grandjean', 'Sophie', 'Directrice générale',
   'sophie.grandjean@chu-montaubry.example.org', '04.65.71.00.21', true, 'principal'),
  ('b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000002',
   'Charpentier', 'Inès', 'Déléguée à la protection des données',
   'ines.charpentier@chu-montaubry.example.org', '04.65.71.00.22', false, 'dpo'),

  ('b0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000003',
   'Chauvin', 'Patrick', 'Directeur général',
   'patrick.chauvin@clinique-glycines.example.org', '04.65.71.00.31', true, 'principal'),
  ('b0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000003',
   'Marty', 'Élodie', 'Responsable de la facturation',
   'elodie.marty@clinique-glycines.example.org', '06.39.98.00.31', false, 'autre'),

  ('b0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000004',
   'Thibault', 'Valérie', 'Directrice générale',
   'valerie.thibault@ght-vegre.example.org', '03.53.01.00.41', true, 'principal'),
  ('b0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000004',
   'Garnier', 'Antoine', 'Responsable de la sécurité des SI',
   'antoine.garnier@ght-vegre.example.org', '03.53.01.00.42', false, 'rssi')
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- 5. Taches — un melange volontaire : en retard, du jour, a venir, terminees.
--    La categorie est resolue par son nom, garanti present a l etape 1.
-- -----------------------------------------------------------------------------
INSERT INTO public.taches (
  id, etablissement_id, categorie_id, titre, description, statut, priorite, echeance, ordre
) VALUES
  ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   (SELECT id FROM public.categories_taches WHERE nom = 'Suivi' LIMIT 1),
   'Point trimestriel de suivi',
   'Revue d''usage et recueil des irritants avec la direction des soins.',
   'A faire', 'medium', CURRENT_DATE + 12, 1),
  ('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
   (SELECT id FROM public.categories_taches WHERE nom = 'Go-Live' LIMIT 1),
   'Clôturer le rapport de mise en production',
   'Rapport de bascule à archiver dans le dossier du compte.',
   'Terminé', 'low', CURRENT_DATE - 210, 2),

  ('c0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000002',
   (SELECT id FROM public.categories_taches WHERE nom = 'Déploiement' LIMIT 1),
   'Recette de l''interface avec le dossier patient',
   'Jeu de recette à dérouler avec la direction des systèmes d''information.',
   'En cours', 'high', CURRENT_DATE + 5, 1),
  ('c0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000002',
   (SELECT id FROM public.categories_taches WHERE nom = 'Conformité' LIMIT 1),
   'Obtenir la validation de la déléguée à la protection des données',
   'Analyse d''impact à faire viser avant la bascule.',
   'Bloqué', 'high', CURRENT_DATE - 6, 2),
  ('c0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000002',
   (SELECT id FROM public.categories_taches WHERE nom = 'Formation' LIMIT 1),
   'Planifier les sessions de formation des référents',
   'Deux sessions de 3 heures à caler avec l''encadrement.',
   'A faire', 'medium', CURRENT_DATE + 21, 3),

  ('c0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000003',
   (SELECT id FROM public.categories_taches WHERE nom = 'Formation' LIMIT 1),
   'Animer la session de formation des utilisateurs',
   'Session sur site, salle de formation du premier étage.',
   'En cours', 'high', CURRENT_DATE, 1),
  ('c0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000003',
   (SELECT id FROM public.categories_taches WHERE nom = 'Suivi' LIMIT 1),
   'Envoyer le questionnaire de satisfaction',
   'À envoyer une semaine après la dernière session.',
   'A faire', 'low', CURRENT_DATE + 9, 2),

  ('c0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000004',
   (SELECT id FROM public.categories_taches WHERE nom = 'Contractuel' LIMIT 1),
   'Relancer sur la proposition commerciale',
   'Relance à J+15 de l''envoi de la proposition.',
   'A faire', 'high', CURRENT_DATE - 2, 1)
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- 6. Partenaires — identifiants alignes sur `src/data/apporteursSeed.ts`,
--    pour que l ecran « Apporteurs d affaires » soit coherent avec la base.
-- -----------------------------------------------------------------------------
INSERT INTO public.partenaires (
  id, nom, type_partenaire, sous_type, statut_relation,
  date_debut_partenariat, date_fin_partenariat, ville, region,
  email, telephone, site_web, tags, notes
) VALUES
  ('11111111-1111-4111-8111-111111111111',
   'Boréale Systèmes', 'industriel', 'Éditeur de dossier patient', 'actif',
   '2026-03-01', '2029-03-01', 'Montaubry', 'Auvergne-Rhône-Alpes',
   'partenariats@boreale-systemes.example.org', '04.65.71.00.50',
   'https://boreale-systemes.example.org', ARRAY['apporteur-affaires'],
   'Partenaire de démonstration — données fictives.'),
  ('22222222-2222-4222-8222-222222222222',
   'Altiora Advisors', 'prestataire', 'Intégrateur de dossier patient', 'actif',
   '2025-02-15', NULL, 'Lorgeval', 'Grand Est',
   'contact@altiora-advisors.example.org', '03.53.01.00.50',
   'https://altiora-advisors.example.org', ARRAY['apporteur-affaires'],
   'Partenaire de démonstration — données fictives.'),
  ('33333333-3333-4333-8333-333333333333',
   'Groupement Vésone', 'institutionnel', 'Groupement d''achat hospitalier', 'prospect',
   '2026-05-10', NULL, 'Saint-Elme', 'Nouvelle-Aquitaine',
   'secretariat@groupement-vesone.example.org', '05.36.49.00.50',
   'https://groupement-vesone.example.org', ARRAY['apporteur-affaires'],
   'Partenaire de démonstration — données fictives.')
ON CONFLICT DO NOTHING;

INSERT INTO public.partenaires_contacts (
  id, partenaire_id, nom, prenom, fonction, email, telephone, est_contact_principal, notes
) VALUES
  ('d0000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'Berthier', 'Claire', 'Directrice des partenariats',
   'claire.berthier@boreale-systemes.example.org', '06.39.98.00.51', true,
   'Contact de démonstration — donnée fictive.'),
  ('d0000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222',
   'Maillard', 'Cédric', 'Responsable des comptes publics',
   'cedric.maillard@altiora-advisors.example.org', '06.39.98.00.52', true,
   'Contact de démonstration — donnée fictive.'),
  ('d0000000-0000-4000-8000-000000000003', '33333333-3333-4333-8333-333333333333',
   'Rollin', 'Agnès', 'Chargée du référencement',
   'agnes.rollin@groupement-vesone.example.org', '05.36.49.00.51', true,
   'Contact de démonstration — donnée fictive.')
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- 7. Catalogue de produits et services (code unique = cle d idempotence)
-- -----------------------------------------------------------------------------
INSERT INTO public.catalogue_produits (
  id, code, nom, description, type, prix_unitaire_ht, taux_tva, unite, est_actif
) VALUES
  ('e0000000-0000-4000-8000-000000000001', 'DEMO-LIC-ANN',
   'Abonnement annuel — module de pilotage',
   'Droit d''usage annuel, par établissement.', 'licence',
   24000.00, 20.00, 'an', true),
  ('e0000000-0000-4000-8000-000000000002', 'DEMO-SETUP',
   'Mise en service et paramétrage',
   'Installation, paramétrage initial et recette.', 'service',
   9500.00, 20.00, 'forfait', true),
  ('e0000000-0000-4000-8000-000000000003', 'DEMO-FORM-J',
   'Journée de formation sur site',
   'Une journée d''animation, jusqu''à 12 participants.', 'formation',
   1400.00, 20.00, 'jour', true)
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- 8. Factures — les montants ne sont PAS saisis : le declencheur
--    `trigger_recalculate_facture_totals` les recalcule a partir des lignes.
-- -----------------------------------------------------------------------------
INSERT INTO public.factures (
  id, numero, etablissement_id, contact_id,
  client_nom, client_adresse, client_email, client_telephone,
  date_emission, date_echeance, statut, montant_paye,
  conditions_paiement, notes_client
) VALUES
  ('f0000000-0000-4000-8000-000000000001', 'DEMO-2026-0001',
   'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
   'CH Villebrume', '14 rue des Marronniers, 37000 Villebrume',
   'helene.marchand@ch-villebrume.example.org', '02.61.91.00.11',
   (CURRENT_DATE - INTERVAL '75 days')::date, (CURRENT_DATE - INTERVAL '45 days')::date,
   'payee', 28800.00,
   'Paiement à 30 jours', 'Abonnement annuel — reconduction.'),
  ('f0000000-0000-4000-8000-000000000002', 'DEMO-2026-0002',
   'a0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000003',
   'CHU Montaubry', '9 avenue du Parc, 69008 Montaubry',
   'sophie.grandjean@chu-montaubry.example.org', '04.65.71.00.21',
   (CURRENT_DATE - INTERVAL '20 days')::date, (CURRENT_DATE + INTERVAL '10 days')::date,
   'envoyee', 0.00,
   'Paiement à 30 jours', 'Mise en service et première année d''abonnement.'),
  ('f0000000-0000-4000-8000-000000000003', 'DEMO-2026-0003',
   'a0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000006',
   'Clinique des Glycines', '6 chemin des Vignes, 13009 Chandreux',
   'elodie.marty@clinique-glycines.example.org', '06.39.98.00.31',
   (CURRENT_DATE - INTERVAL '50 days')::date, (CURRENT_DATE - INTERVAL '20 days')::date,
   'partiellement_payee', 1680.00,
   'Paiement à 30 jours', 'Deux journées de formation sur site.')
ON CONFLICT DO NOTHING;

INSERT INTO public.factures_lignes (
  id, facture_id, produit_id, ordre, designation, description,
  quantite, unite, prix_unitaire_ht, taux_tva, remise_pourcent
) VALUES
  ('f1000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000001', 1,
   'Abonnement annuel — module de pilotage', 'Période de 12 mois.',
   1, 'an', 24000.00, 20.00, 0),

  ('f1000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000002',
   'e0000000-0000-4000-8000-000000000002', 1,
   'Mise en service et paramétrage', 'Installation, paramétrage et recette.',
   1, 'forfait', 9500.00, 20.00, 0),
  ('f1000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000002',
   'e0000000-0000-4000-8000-000000000001', 2,
   'Abonnement annuel — module de pilotage', 'Première année, remise de lancement.',
   1, 'an', 24000.00, 20.00, 10),

  ('f1000000-0000-4000-8000-000000000004', 'f0000000-0000-4000-8000-000000000003',
   'e0000000-0000-4000-8000-000000000003', 1,
   'Journée de formation sur site', 'Deux journées, groupes de 12 participants.',
   2, 'jour', 1400.00, 20.00, 0)
ON CONFLICT DO NOTHING;

COMMIT;

-- =============================================================================
-- Purge du jeu de demonstration (a decommenter si besoin)
-- -----------------------------------------------------------------------------
-- Les suppressions en cascade se chargent des contacts, taches et lignes de facture.
-- Les categories de taches et le catalogue sont conserves : ce sont des referentiels.
--
-- BEGIN;
--   DELETE FROM public.factures WHERE numero LIKE 'DEMO-%';
--   DELETE FROM public.partenaires_contacts
--     WHERE partenaire_id IN (
--       '11111111-1111-4111-8111-111111111111',
--       '22222222-2222-4222-8222-222222222222',
--       '33333333-3333-4333-8333-333333333333');
--   DELETE FROM public.partenaires
--     WHERE id IN (
--       '11111111-1111-4111-8111-111111111111',
--       '22222222-2222-4222-8222-222222222222',
--       '33333333-3333-4333-8333-333333333333');
--   DELETE FROM public.etablissements WHERE slug LIKE 'demo-%';
--   DELETE FROM public.catalogue_produits WHERE code LIKE 'DEMO-%';
-- COMMIT;
-- =============================================================================
