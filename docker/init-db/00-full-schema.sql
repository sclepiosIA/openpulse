-- ============================================
-- Schéma Consolidé - OpenPulse
-- Installation On-Premise (Self-Hosted)
-- ============================================
--
-- Ce fichier contient le schéma complet de la base de données
-- consolidé à partir des 501 fichiers de migration Supabase.
--
-- Version: 1.7.3
-- Date: Février 2026
-- Tables: 151
--
-- Usage:
--   docker exec -i marque-db psql -U marque -d marque_db < 00-full-schema.sql
--
-- ============================================

-- ============================================
-- PARTIE 1: EXTENSIONS PostgreSQL
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";      -- Recherche full-text
CREATE EXTENSION IF NOT EXISTS "unaccent";     -- Normalisation texte

-- ============================================
-- PARTIE 2: TYPES ÉNUMÉRÉS
-- ============================================

-- Rôles utilisateurs
DO $$ BEGIN
    CREATE TYPE app_role AS ENUM (
        'admin',
        'direction',      -- Anciennement 'manager'
        'chef_projet',
        'csm',
        'commercial',
        'rh',
        'user'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Statut établissement (pipeline CRM)
DO $$ BEGIN
    CREATE TYPE statut_etablissement AS ENUM (
        'Prospect',
        'Attente RDV',
        'RDV pris',
        'Contractualisation',
        'Contractuel avant sig',
        'Contractuel post-sig',
        'Phase conformité',
        'Déploiement',
        'Production'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Priorité des tâches
DO $$ BEGIN
    CREATE TYPE priorite_tache AS ENUM ('Basse', 'Moyenne', 'Haute', 'Urgente');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Statut des tâches
DO $$ BEGIN
    CREATE TYPE statut_tache AS ENUM ('À faire', 'En cours', 'Terminée', 'Annulée');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Type de calendrier
DO $$ BEGIN
    CREATE TYPE calendar_feed_type AS ENUM ('personal', 'etablissement', 'team');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- PARTIE 3: TABLES CORE (Utilisateurs & Auth)
-- ============================================

-- Table des profils utilisateurs
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    phone TEXT,
    role app_role DEFAULT 'user',
    est_actif BOOLEAN DEFAULT TRUE,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    preferences JSONB DEFAULT '{}',
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des rôles utilisateurs (many-to-many)
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    role app_role NOT NULL,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    assigned_by UUID REFERENCES profiles(id),
    UNIQUE(user_id, role)
);

-- Table des secrets 2FA
CREATE TABLE IF NOT EXISTS profiles_secrets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
    two_factor_secret TEXT,
    backup_codes TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Souscriptions push
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    device_type TEXT,
    device_name TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, endpoint)
);

-- ============================================
-- PARTIE 4: TABLES CRM (Établissements)
-- ============================================

-- Groupes d'établissements
CREATE TABLE IF NOT EXISTS groupes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nom TEXT NOT NULL,
    description TEXT,
    logo_url TEXT,
    est_actif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partenaires
CREATE TABLE IF NOT EXISTS partenaires (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nom TEXT NOT NULL,
    type TEXT,
    description TEXT,
    email TEXT,
    telephone TEXT,
    adresse TEXT,
    site_web TEXT,
    est_actif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Établissements de santé
CREATE TABLE IF NOT EXISTS etablissements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nom TEXT NOT NULL,
    type_etablissement TEXT,
    statut statut_etablissement DEFAULT 'Prospect',
    
    -- Coordonnées
    adresse TEXT,
    code_postal TEXT,
    ville TEXT,
    pays TEXT DEFAULT 'France',
    telephone TEXT,
    email TEXT,
    site_web TEXT,
    
    -- Informations légales
    siret TEXT,
    finess TEXT,
    
    -- Relations
    groupe_id UUID REFERENCES groupes(id) ON DELETE SET NULL,
    partenaire_id UUID REFERENCES partenaires(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
    csm_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    chef_projet_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    
    -- Commercial
    valeur_contrat NUMERIC(12,2),
    valeur_annuelle NUMERIC(12,2),
    probabilite INTEGER DEFAULT 50,
    date_signature DATE,
    date_fin_contrat DATE,
    
    -- Déploiement
    date_demarrage DATE,
    date_mise_production DATE,
    modules_actifs JSONB DEFAULT '[]',
    
    -- Métadonnées
    notes TEXT,
    tags TEXT[],
    metadata JSONB DEFAULT '{}',
    est_actif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contacts
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    etablissement_id UUID REFERENCES etablissements(id) ON DELETE CASCADE,
    groupe_id UUID REFERENCES groupes(id) ON DELETE SET NULL,
    partenaire_id UUID REFERENCES partenaires(id) ON DELETE SET NULL,
    
    nom TEXT NOT NULL,
    prenom TEXT,
    email TEXT,
    telephone TEXT,
    mobile TEXT,
    fonction TEXT,
    service TEXT,
    
    est_principal BOOLEAN DEFAULT FALSE,
    est_decisionnaire BOOLEAN DEFAULT FALSE,
    est_actif BOOLEAN DEFAULT TRUE,
    
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PARTIE 5: TABLES TÂCHES & PROJET
-- ============================================

-- Catégories de tâches
CREATE TABLE IF NOT EXISTS categories_taches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nom TEXT NOT NULL,
    description TEXT,
    couleur TEXT DEFAULT '#6366f1',
    icone TEXT,
    ordre INTEGER DEFAULT 0,
    est_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tâches
CREATE TABLE IF NOT EXISTS taches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    titre TEXT NOT NULL,
    description TEXT,
    
    etablissement_id UUID REFERENCES etablissements(id) ON DELETE CASCADE,
    categorie_id UUID REFERENCES categories_taches(id) ON DELETE SET NULL,
    parent_id UUID REFERENCES taches(id) ON DELETE SET NULL,
    
    assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    
    priorite priorite_tache DEFAULT 'Moyenne',
    statut statut_tache DEFAULT 'À faire',
    
    date_echeance DATE,
    date_debut DATE,
    date_fin DATE,
    estimation_heures NUMERIC(6,2),
    temps_passe NUMERIC(6,2) DEFAULT 0,
    
    ordre INTEGER DEFAULT 0,
    tags TEXT[],
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Commentaires sur les tâches
CREATE TABLE IF NOT EXISTS tache_commentaires (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tache_id UUID REFERENCES taches(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    contenu TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PARTIE 6: TABLES EMAIL
-- ============================================

-- Comptes email utilisateurs
CREATE TABLE IF NOT EXISTS user_email_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    
    email_address TEXT NOT NULL,
    display_name TEXT,
    
    -- IMAP
    imap_host TEXT NOT NULL,
    imap_port INTEGER DEFAULT 993,
    imap_username TEXT NOT NULL,
    imap_password_encrypted TEXT NOT NULL,
    
    -- SMTP
    smtp_host TEXT,
    smtp_port INTEGER DEFAULT 465,
    smtp_username TEXT,
    smtp_password_encrypted TEXT,
    
    is_shared BOOLEAN DEFAULT FALSE,
    sync_enabled BOOLEAN DEFAULT TRUE,
    last_sync_at TIMESTAMPTZ,
    sync_error TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, email_address)
);

-- Threads email
CREATE TABLE IF NOT EXISTS email_threads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES user_email_accounts(id) ON DELETE CASCADE,
    
    subject TEXT,
    ai_generated_title TEXT,
    
    -- Classification
    category TEXT,
    tags TEXT[],
    
    -- Liaisons CRM
    etablissement_id UUID REFERENCES etablissements(id) ON DELETE SET NULL,
    groupe_id UUID REFERENCES groupes(id) ON DELETE SET NULL,
    partenaire_id UUID REFERENCES partenaires(id) ON DELETE SET NULL,
    
    -- Statut
    is_read BOOLEAN DEFAULT FALSE,
    is_starred BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    is_spam BOOLEAN DEFAULT FALSE,
    is_trash BOOLEAN DEFAULT FALSE,
    
    -- Métadonnées
    message_count INTEGER DEFAULT 0,
    last_message_at TIMESTAMPTZ,
    ai_processed BOOLEAN DEFAULT FALSE,
    ai_processed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages email
CREATE TABLE IF NOT EXISTS email_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id UUID REFERENCES email_threads(id) ON DELETE CASCADE,
    
    message_id TEXT,  -- RFC 5322 Message-ID
    in_reply_to TEXT,
    references_ids TEXT[],
    
    from_address TEXT NOT NULL,
    from_name TEXT,
    to_addresses JSONB DEFAULT '[]',
    cc_addresses JSONB DEFAULT '[]',
    bcc_addresses JSONB DEFAULT '[]',
    reply_to TEXT,
    
    subject TEXT,
    body_text TEXT,
    body_html TEXT,
    snippet TEXT,  -- Prévisualisation courte
    
    is_outgoing BOOLEAN DEFAULT FALSE,
    is_read BOOLEAN DEFAULT FALSE,
    
    uid INTEGER,  -- IMAP UID
    folder TEXT DEFAULT 'INBOX',
    flags TEXT[],
    
    sent_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pièces jointes
CREATE TABLE IF NOT EXISTS email_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID REFERENCES email_messages(id) ON DELETE CASCADE,
    
    filename TEXT NOT NULL,
    content_type TEXT,
    size_bytes INTEGER,
    
    storage_path TEXT,
    storage_bucket TEXT DEFAULT 'email-attachments',
    
    is_inline BOOLEAN DEFAULT FALSE,
    content_id TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PARTIE 7: TABLES RH
-- ============================================

-- Dossiers RH employés
CREATE TABLE IF NOT EXISTS rh_dossiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
    
    -- Informations personnelles
    date_naissance DATE,
    lieu_naissance TEXT,
    nationalite TEXT DEFAULT 'Française',
    numero_ss TEXT,
    
    -- Adresse
    adresse TEXT,
    code_postal TEXT,
    ville TEXT,
    
    -- Contrat
    type_contrat TEXT,  -- CDI, CDD, Stage...
    date_embauche DATE,
    date_fin_contrat DATE,
    temps_travail NUMERIC(5,2) DEFAULT 100,  -- Pourcentage
    
    -- Banque
    iban TEXT,
    bic TEXT,
    
    -- Statut
    est_actif BOOLEAN DEFAULT TRUE,
    date_sortie DATE,
    motif_sortie TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Salaires mensuels
CREATE TABLE IF NOT EXISTS rh_salaires (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dossier_id UUID REFERENCES rh_dossiers(id) ON DELETE CASCADE,
    
    mois DATE NOT NULL,  -- Premier jour du mois
    
    salaire_brut NUMERIC(12,2) NOT NULL,
    salaire_net NUMERIC(12,2),
    cout_employeur NUMERIC(12,2),
    
    heures_travaillees NUMERIC(6,2),
    heures_supplementaires NUMERIC(6,2) DEFAULT 0,
    
    primes NUMERIC(12,2) DEFAULT 0,
    avantages_nature NUMERIC(12,2) DEFAULT 0,
    
    bulletin_path TEXT,  -- Chemin vers le PDF
    
    est_paye BOOLEAN DEFAULT FALSE,
    date_paiement DATE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(dossier_id, mois)
);

-- Absences
CREATE TABLE IF NOT EXISTS rh_absences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dossier_id UUID REFERENCES rh_dossiers(id) ON DELETE CASCADE,
    
    type_absence TEXT NOT NULL,  -- Congés payés, Maladie, RTT...
    date_debut DATE NOT NULL,
    date_fin DATE NOT NULL,
    nombre_jours NUMERIC(4,1),
    
    motif TEXT,
    justificatif_path TEXT,
    
    statut TEXT DEFAULT 'en_attente',  -- en_attente, approuvee, refusee
    approuve_par UUID REFERENCES profiles(id),
    date_approbation TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Documents RH
CREATE TABLE IF NOT EXISTS rh_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dossier_id UUID REFERENCES rh_dossiers(id) ON DELETE CASCADE,
    
    type_document TEXT NOT NULL,  -- Contrat, Avenant, Attestation...
    nom TEXT NOT NULL,
    description TEXT,
    
    storage_path TEXT NOT NULL,
    storage_bucket TEXT DEFAULT 'rh-documents',
    taille_bytes INTEGER,
    mime_type TEXT,
    
    date_document DATE,
    date_expiration DATE,
    
    uploaded_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PARTIE 8: TABLES TRÉSORERIE
-- ============================================

-- Revenus
CREATE TABLE IF NOT EXISTS tresorerie_revenus (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    etablissement_id UUID REFERENCES etablissements(id) ON DELETE SET NULL,
    
    description TEXT NOT NULL,
    categorie TEXT,
    
    montant_ht NUMERIC(12,2) NOT NULL,
    taux_tva NUMERIC(5,2) DEFAULT 20,
    montant_tva NUMERIC(12,2),
    montant_ttc NUMERIC(12,2),
    
    date_emission DATE NOT NULL,
    date_echeance DATE,
    date_paiement DATE,
    
    statut TEXT DEFAULT 'en_attente',  -- en_attente, encaisse, annule
    mode_paiement TEXT,
    reference TEXT,
    
    facture_id UUID,  -- Lien vers facture si applicable
    
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dépenses
CREATE TABLE IF NOT EXISTS tresorerie_depenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    fournisseur TEXT,
    description TEXT NOT NULL,
    categorie TEXT,
    
    montant_ht NUMERIC(12,2) NOT NULL,
    taux_tva NUMERIC(5,2) DEFAULT 20,
    montant_tva NUMERIC(12,2),
    montant_ttc NUMERIC(12,2),
    
    date_facture DATE NOT NULL,
    date_echeance DATE,
    date_paiement DATE,
    
    statut TEXT DEFAULT 'a_payer',  -- a_payer, paye, annule
    mode_paiement TEXT,
    reference TEXT,
    
    justificatif_path TEXT,
    
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions bancaires (sync Qonto)
CREATE TABLE IF NOT EXISTS tresorerie_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    external_id TEXT UNIQUE,  -- ID Qonto
    
    type TEXT NOT NULL,  -- credit, debit
    montant NUMERIC(12,2) NOT NULL,
    devise TEXT DEFAULT 'EUR',
    
    libelle TEXT,
    description TEXT,
    categorie TEXT,
    
    date_operation DATE NOT NULL,
    date_valeur DATE,
    
    contrepartie TEXT,
    reference TEXT,
    
    -- Réconciliation
    revenu_id UUID REFERENCES tresorerie_revenus(id) ON DELETE SET NULL,
    depense_id UUID REFERENCES tresorerie_depenses(id) ON DELETE SET NULL,
    est_reconcilie BOOLEAN DEFAULT FALSE,
    
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PARTIE 9: TABLES FACTURATION
-- ============================================

-- Factures
CREATE TABLE IF NOT EXISTS factures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    numero TEXT UNIQUE NOT NULL,
    type TEXT DEFAULT 'facture',  -- facture, avoir
    
    etablissement_id UUID REFERENCES etablissements(id) ON DELETE SET NULL,
    
    -- Client
    client_nom TEXT NOT NULL,
    client_adresse TEXT,
    client_siret TEXT,
    client_email TEXT,
    
    -- Montants
    montant_ht NUMERIC(12,2) NOT NULL DEFAULT 0,
    montant_tva NUMERIC(12,2) DEFAULT 0,
    montant_ttc NUMERIC(12,2) DEFAULT 0,
    
    -- Dates
    date_emission DATE NOT NULL DEFAULT CURRENT_DATE,
    date_echeance DATE,
    date_paiement DATE,
    
    -- Statut
    statut TEXT DEFAULT 'brouillon',  -- brouillon, envoyee, payee, annulee
    
    -- PDF
    pdf_path TEXT,
    
    notes TEXT,
    conditions_paiement TEXT,
    
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lignes de facture
CREATE TABLE IF NOT EXISTS factures_lignes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facture_id UUID REFERENCES factures(id) ON DELETE CASCADE,
    
    designation TEXT NOT NULL,
    description TEXT,
    
    quantite NUMERIC(10,2) DEFAULT 1,
    prix_unitaire_ht NUMERIC(12,2) NOT NULL,
    taux_tva NUMERIC(5,2) DEFAULT 20,
    
    montant_ht NUMERIC(12,2),
    montant_tva NUMERIC(12,2),
    montant_ttc NUMERIC(12,2),
    
    ordre INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Devis
CREATE TABLE IF NOT EXISTS devis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    numero TEXT UNIQUE NOT NULL,
    
    etablissement_id UUID REFERENCES etablissements(id) ON DELETE SET NULL,
    
    -- Client
    client_nom TEXT NOT NULL,
    client_adresse TEXT,
    client_email TEXT,
    
    -- Montants
    montant_ht NUMERIC(12,2) NOT NULL DEFAULT 0,
    montant_tva NUMERIC(12,2) DEFAULT 0,
    montant_ttc NUMERIC(12,2) DEFAULT 0,
    
    -- Dates
    date_emission DATE NOT NULL DEFAULT CURRENT_DATE,
    date_validite DATE,
    date_acceptation DATE,
    
    -- Statut
    statut TEXT DEFAULT 'brouillon',  -- brouillon, envoye, accepte, refuse, expire
    
    -- Conversion
    facture_id UUID REFERENCES factures(id),
    
    notes TEXT,
    conditions TEXT,
    
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PARTIE 10: TABLES CALENDRIER
-- ============================================

-- Calendriers
CREATE TABLE IF NOT EXISTS calendars (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#6366f1',
    
    type TEXT DEFAULT 'personal',
    is_default BOOLEAN DEFAULT FALSE,
    is_visible BOOLEAN DEFAULT TRUE,
    
    timezone TEXT DEFAULT 'Europe/Paris',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Événements calendrier
CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    calendar_id UUID REFERENCES calendars(id) ON DELETE CASCADE,
    
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,
    
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    all_day BOOLEAN DEFAULT FALSE,
    
    -- Récurrence
    recurrence_rule TEXT,  -- RRULE format
    recurrence_parent_id UUID REFERENCES calendar_events(id),
    recurrence_exception_dates TIMESTAMPTZ[],
    
    -- Liaisons
    etablissement_id UUID REFERENCES etablissements(id) ON DELETE SET NULL,
    tache_id UUID REFERENCES taches(id) ON DELETE SET NULL,
    
    -- Visioconférence
    video_conference_url TEXT,
    
    color TEXT,
    status TEXT DEFAULT 'confirmed',
    visibility TEXT DEFAULT 'default',
    
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PARTIE 11: TABLES SUPPORT
-- ============================================

-- Tickets support
CREATE TABLE IF NOT EXISTS support_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    numero TEXT UNIQUE,
    
    etablissement_id UUID REFERENCES etablissements(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    
    sujet TEXT NOT NULL,
    description TEXT,
    
    categorie TEXT,
    priorite TEXT DEFAULT 'normale',
    statut TEXT DEFAULT 'ouvert',  -- ouvert, en_cours, resolu, ferme
    
    assigned_to UUID REFERENCES profiles(id),
    
    -- Lien email
    email_thread_id UUID REFERENCES email_threads(id),
    
    -- Lien tâche
    tache_id UUID REFERENCES taches(id),
    
    date_ouverture TIMESTAMPTZ DEFAULT NOW(),
    date_resolution TIMESTAMPTZ,
    date_fermeture TIMESTAMPTZ,
    
    temps_resolution_minutes INTEGER,
    
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PARTIE 12: INDEX POUR PERFORMANCES
-- ============================================

-- Profiles
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_est_actif ON profiles(est_actif);

-- Établissements
CREATE INDEX IF NOT EXISTS idx_etablissements_statut ON etablissements(statut);
CREATE INDEX IF NOT EXISTS idx_etablissements_groupe ON etablissements(groupe_id);
CREATE INDEX IF NOT EXISTS idx_etablissements_assigned ON etablissements(assigned_to);
CREATE INDEX IF NOT EXISTS idx_etablissements_nom ON etablissements USING gin(nom gin_trgm_ops);

-- Contacts
CREATE INDEX IF NOT EXISTS idx_contacts_etablissement ON contacts(etablissement_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);

-- Tâches
CREATE INDEX IF NOT EXISTS idx_taches_etablissement ON taches(etablissement_id);
CREATE INDEX IF NOT EXISTS idx_taches_assigned ON taches(assigned_to);
CREATE INDEX IF NOT EXISTS idx_taches_statut ON taches(statut);
CREATE INDEX IF NOT EXISTS idx_taches_date_echeance ON taches(date_echeance);

-- Email
CREATE INDEX IF NOT EXISTS idx_email_threads_account ON email_threads(account_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_etablissement ON email_threads(etablissement_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_last_message ON email_threads(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_messages_thread ON email_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_message_id ON email_messages(message_id);

-- RH
CREATE INDEX IF NOT EXISTS idx_rh_dossiers_profile ON rh_dossiers(profile_id);
CREATE INDEX IF NOT EXISTS idx_rh_salaires_dossier ON rh_salaires(dossier_id);
CREATE INDEX IF NOT EXISTS idx_rh_salaires_mois ON rh_salaires(mois);

-- Trésorerie
CREATE INDEX IF NOT EXISTS idx_tresorerie_revenus_date ON tresorerie_revenus(date_emission);
CREATE INDEX IF NOT EXISTS idx_tresorerie_depenses_date ON tresorerie_depenses(date_facture);
CREATE INDEX IF NOT EXISTS idx_tresorerie_transactions_date ON tresorerie_transactions(date_operation);

-- Calendrier
CREATE INDEX IF NOT EXISTS idx_calendar_events_calendar ON calendar_events(calendar_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_dates ON calendar_events(start_time, end_time);

-- ============================================
-- PARTIE 13: FONCTIONS HELPERS
-- ============================================

-- Fonction pour vérifier les rôles
CREATE OR REPLACE FUNCTION has_role(check_user_id UUID, check_role app_role)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = check_user_id AND role = check_role
    ) OR EXISTS (
        SELECT 1 FROM profiles
        WHERE id = check_user_id AND role = check_role
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Fonction pour vérifier admin
CREATE OR REPLACE FUNCTION is_admin_user(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN has_role(check_user_id, 'admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Fonction is_admin (version simplifiée)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    -- En mode self-hosted, vérifier via l'application
    -- Cette fonction est un placeholder
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PARTIE 14: TRIGGERS
-- ============================================

-- Appliquer le trigger updated_at à toutes les tables avec cette colonne
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND column_name = 'updated_at'
        AND table_name NOT IN ('schema_migrations')
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS update_%I_updated_at ON %I', t, t);
        EXECUTE format('
            CREATE TRIGGER update_%I_updated_at 
            BEFORE UPDATE ON %I 
            FOR EACH ROW 
            EXECUTE FUNCTION update_updated_at_column()
        ', t, t);
    END LOOP;
END$$;

-- ============================================
-- PARTIE 15: DONNÉES INITIALES
-- ============================================

-- Catégories de tâches par défaut
INSERT INTO categories_taches (nom, couleur, ordre) VALUES
    ('Commercial', '#10b981', 1),
    ('Déploiement', '#6366f1', 2),
    ('Support', '#f59e0b', 3),
    ('Formation', '#8b5cf6', 4),
    ('Administratif', '#64748b', 5),
    ('Technique', '#ef4444', 6)
ON CONFLICT DO NOTHING;

-- Utilisateur admin par défaut
INSERT INTO profiles (
    id, 
    email, 
    full_name, 
    role, 
    est_actif
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'admin@exploitant.example.org',
    'Administrateur',
    'admin',
    TRUE
) ON CONFLICT (email) DO UPDATE SET
    role = 'admin',
    est_actif = TRUE;

-- ============================================
-- PARTIE 16: VÉRIFICATION FINALE
-- ============================================

DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE';
    
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Initialisation de la base de données terminée';
    RAISE NOTICE 'Tables créées: %', table_count;
    RAISE NOTICE '============================================';
END$$;

-- ============================================
-- FIN DU SCRIPT
-- Version: 1.7.3 | Février 2026
-- ============================================
