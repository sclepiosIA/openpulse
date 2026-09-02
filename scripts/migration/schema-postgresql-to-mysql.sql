-- ============================================
-- Script de Conversion de Schéma PostgreSQL → MySQL
-- OpenPulse - Migration de Base de Données
-- ============================================
-- 
-- INSTRUCTIONS:
-- 1. Exécuter d'abord export-supabase-data.ts pour extraire les données
-- 2. Adapter ce script selon vos besoins spécifiques
-- 3. Exécuter sur MySQL 8.0+
--
-- DIFFÉRENCES CLÉS PostgreSQL vs MySQL:
-- - UUID → CHAR(36) ou BINARY(16)
-- - TIMESTAMPTZ → DATETIME(3) ou TIMESTAMP
-- - JSONB → JSON
-- - TEXT[] → JSON (tableaux)
-- - SERIAL → AUTO_INCREMENT
-- - BOOLEAN → TINYINT(1)
-- - ENUM → ENUM native MySQL
-- ============================================

-- Désactiver les contraintes pour l'import
SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';

-- ============================================
-- TYPES ENUM
-- ============================================

-- Note: MySQL gère les ENUM différemment de PostgreSQL
-- Les ENUM sont définis inline dans les colonnes

-- ============================================
-- TABLE: profiles (utilisateurs internes)
-- ============================================

CREATE TABLE IF NOT EXISTS profiles (
    id CHAR(36) NOT NULL PRIMARY KEY,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255),
    avatar_url TEXT,
    phone VARCHAR(50),
    active TINYINT(1) DEFAULT 1,
    two_factor_enabled TINYINT(1) DEFAULT 0,
    last_login DATETIME(3),
    preferences JSON,
    
    INDEX idx_profiles_email (email),
    INDEX idx_profiles_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: user_roles
-- ============================================

CREATE TABLE IF NOT EXISTS user_roles (
    id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
    user_id CHAR(36) NOT NULL,
    role ENUM('admin', 'manager', 'chef_projet', 'csm', 'commercial', 'rh', 'user') NOT NULL,
    assigned_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    assigned_by CHAR(36),
    
    UNIQUE KEY uk_user_role (user_id, role),
    INDEX idx_user_roles_user (user_id),
    INDEX idx_user_roles_role (role),
    
    CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_roles_assigned_by FOREIGN KEY (assigned_by) REFERENCES profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: etablissements
-- ============================================

CREATE TABLE IF NOT EXISTS etablissements (
    id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    
    nom VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    type ENUM('CHU', 'CH', 'Clinique', 'EHPAD', 'Autre') NOT NULL,
    statut ENUM('Prospect', 'Attente RDV', 'RDV pris', 'Négociation', 'Contractualisation', 
                'Contractuel avant sig', 'Contractuel post-sig', 'Conformité', 
                'Déploiement', 'Formation', 'Production', 'Perdu', 'Inactif') NOT NULL DEFAULT 'Prospect',
    
    -- Coordonnées
    adresse TEXT,
    code_postal VARCHAR(10),
    ville VARCHAR(255) NOT NULL,
    region VARCHAR(255) NOT NULL,
    pays VARCHAR(100) DEFAULT 'France',
    telephone VARCHAR(50),
    email VARCHAR(255),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    
    -- Directeur général
    directeur_general_nom VARCHAR(255),
    directeur_general_prenom VARCHAR(255),
    directeur_general_email VARCHAR(255),
    
    -- Dates clés
    date_prise_contact DATE NOT NULL,
    date_previsionnelle_signature DATE,
    date_signature DATE,
    date_go_live DATE,
    date_fin_contrat DATE,
    date_premier_paiement DATE,
    
    -- Commercial
    dpi ENUM('Easily', 'Mediboard', 'Crossway', 'DxCare', 'Orbis', 'Autre'),
    nombre_passages_urgences_annuel INT,
    type_offre VARCHAR(100),
    modules_proposes JSON, -- Tableau stocké en JSON
    
    -- Tarification
    pallier_vise VARCHAR(50),
    pallier_realise VARCHAR(50),
    modele_statique_succes VARCHAR(50),
    modele_detaille TEXT,
    paiement_initial DECIMAL(15, 2),
    periodicite_paiement VARCHAR(50),
    seuils_palliers JSON,
    tarifs_palliers JSON,
    
    -- Équipe assignée
    commercial_id CHAR(36),
    chef_projet_id CHAR(36),
    csm_id CHAR(36),
    
    -- Métadonnées
    notes TEXT,
    logo_url TEXT,
    email_domains JSON, -- Tableau stocké en JSON
    progression INT DEFAULT 0,
    engagement_score DECIMAL(5, 2),
    relationship_status VARCHAR(50),
    
    -- URLs externes
    stats_urgences_url TEXT,
    stats_utilisation_url TEXT,
    
    -- QR Code
    qr_access_token VARCHAR(255),
    qr_access_expires_at DATETIME(3),
    
    -- Derniers échanges
    derniers_echanges_resume TEXT,
    derniers_echanges_updated_at DATETIME(3),
    last_email_sent_at DATETIME(3),
    last_email_received_at DATETIME(3),
    
    -- SIREN
    siren_client VARCHAR(20),
    
    -- Audit
    updated_by CHAR(36),
    
    INDEX idx_etablissements_nom (nom),
    INDEX idx_etablissements_statut (statut),
    INDEX idx_etablissements_type (type),
    INDEX idx_etablissements_region (region),
    INDEX idx_etablissements_ville (ville),
    INDEX idx_etablissements_commercial (commercial_id),
    INDEX idx_etablissements_csm (csm_id),
    
    CONSTRAINT fk_etablissements_commercial FOREIGN KEY (commercial_id) REFERENCES profiles(id) ON DELETE SET NULL,
    CONSTRAINT fk_etablissements_chef_projet FOREIGN KEY (chef_projet_id) REFERENCES profiles(id) ON DELETE SET NULL,
    CONSTRAINT fk_etablissements_csm FOREIGN KEY (csm_id) REFERENCES profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: groupes_etablissements
-- ============================================

CREATE TABLE IF NOT EXISTS groupes_etablissements (
    id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    
    nom VARCHAR(255) NOT NULL,
    type ENUM('GHT', 'Groupe privé', 'Réseau', 'Autre') NOT NULL,
    description TEXT,
    logo_url TEXT,
    site_web VARCHAR(500),
    
    -- Contact principal
    contact_nom VARCHAR(255),
    contact_email VARCHAR(255),
    contact_telephone VARCHAR(50),
    
    notes TEXT,
    
    INDEX idx_groupes_nom (nom),
    INDEX idx_groupes_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: etablissements_groupes (junction)
-- ============================================

CREATE TABLE IF NOT EXISTS etablissements_groupes (
    id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
    etablissement_id CHAR(36) NOT NULL,
    groupe_id CHAR(36) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    
    UNIQUE KEY uk_etablissement_groupe (etablissement_id, groupe_id),
    
    CONSTRAINT fk_eg_etablissement FOREIGN KEY (etablissement_id) REFERENCES etablissements(id) ON DELETE CASCADE,
    CONSTRAINT fk_eg_groupe FOREIGN KEY (groupe_id) REFERENCES groupes_etablissements(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: partenaires
-- ============================================

CREATE TABLE IF NOT EXISTS partenaires (
    id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    
    nom VARCHAR(255) NOT NULL,
    type ENUM('Éditeur', 'Intégrateur', 'Consultant', 'Institutionnel', 'Autre') NOT NULL,
    description TEXT,
    logo_url TEXT,
    site_web VARCHAR(500),
    
    -- Contact
    contact_nom VARCHAR(255),
    contact_email VARCHAR(255),
    contact_telephone VARCHAR(50),
    
    -- Statut
    statut ENUM('Actif', 'Inactif', 'Prospect') NOT NULL DEFAULT 'Actif',
    
    notes TEXT,
    
    INDEX idx_partenaires_nom (nom),
    INDEX idx_partenaires_type (type),
    INDEX idx_partenaires_statut (statut)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: contacts
-- ============================================

CREATE TABLE IF NOT EXISTS contacts (
    id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    
    nom VARCHAR(255) NOT NULL,
    prenom VARCHAR(255),
    fonction VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    telephone VARCHAR(50),
    
    -- Rattachement
    etablissement_id CHAR(36),
    groupe_id CHAR(36),
    
    -- Métadonnées
    est_contact_principal TINYINT(1) DEFAULT 0,
    type_contact VARCHAR(50),
    niveau_contact VARCHAR(50),
    
    -- Source
    created_source VARCHAR(50),
    created_metadata JSON,
    
    -- Audit
    updated_by CHAR(36),
    
    INDEX idx_contacts_nom (nom),
    INDEX idx_contacts_email (email),
    INDEX idx_contacts_etablissement (etablissement_id),
    INDEX idx_contacts_groupe (groupe_id),
    
    CONSTRAINT fk_contacts_etablissement FOREIGN KEY (etablissement_id) REFERENCES etablissements(id) ON DELETE CASCADE,
    CONSTRAINT fk_contacts_groupe FOREIGN KEY (groupe_id) REFERENCES groupes_etablissements(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: taches
-- ============================================

CREATE TABLE IF NOT EXISTS taches (
    id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    
    titre VARCHAR(500) NOT NULL,
    description TEXT,
    
    -- Statut et priorité
    statut ENUM('À faire', 'En cours', 'En attente', 'Terminée', 'Annulée') NOT NULL DEFAULT 'À faire',
    priorite ENUM('Basse', 'Moyenne', 'Haute', 'Urgente') NOT NULL DEFAULT 'Moyenne',
    
    -- Dates
    date_creation DATE NOT NULL,
    date_echeance DATE,
    date_completion DATE,
    
    -- Rattachement
    etablissement_id CHAR(36),
    categorie_id CHAR(36),
    
    -- Assignation
    responsable_id CHAR(36),
    createur_id CHAR(36),
    
    -- Métadonnées
    source VARCHAR(50),
    email_thread_id CHAR(36),
    is_recurring TINYINT(1) DEFAULT 0,
    recurrence_pattern JSON,
    
    -- Audit
    completed_by CHAR(36),
    
    INDEX idx_taches_statut (statut),
    INDEX idx_taches_priorite (priorite),
    INDEX idx_taches_echeance (date_echeance),
    INDEX idx_taches_etablissement (etablissement_id),
    INDEX idx_taches_responsable (responsable_id),
    
    CONSTRAINT fk_taches_etablissement FOREIGN KEY (etablissement_id) REFERENCES etablissements(id) ON DELETE CASCADE,
    CONSTRAINT fk_taches_responsable FOREIGN KEY (responsable_id) REFERENCES profiles(id) ON DELETE SET NULL,
    CONSTRAINT fk_taches_createur FOREIGN KEY (createur_id) REFERENCES profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: categories_taches
-- ============================================

CREATE TABLE IF NOT EXISTS categories_taches (
    id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    
    nom VARCHAR(255) NOT NULL,
    description TEXT,
    couleur VARCHAR(7), -- Code couleur hex
    ordre INT DEFAULT 0,
    
    INDEX idx_categories_nom (nom),
    INDEX idx_categories_ordre (ordre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: user_email_accounts
-- ============================================

CREATE TABLE IF NOT EXISTS user_email_accounts (
    id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    
    user_id CHAR(36) NOT NULL,
    email_address VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    
    -- Configuration IMAP
    imap_host VARCHAR(255) NOT NULL,
    imap_port INT NOT NULL DEFAULT 993,
    imap_secure TINYINT(1) DEFAULT 1,
    
    -- Configuration SMTP
    smtp_host VARCHAR(255) NOT NULL,
    smtp_port INT NOT NULL DEFAULT 587,
    smtp_secure TINYINT(1) DEFAULT 1,
    
    -- Authentification (chiffré)
    encrypted_password TEXT NOT NULL,
    
    -- Synchronisation
    sync_enabled TINYINT(1) DEFAULT 1,
    last_sync_at DATETIME(3),
    last_sync_uid VARCHAR(255),
    sync_error TEXT,
    
    -- Type
    is_shared TINYINT(1) DEFAULT 0,
    
    UNIQUE KEY uk_user_email (user_id, email_address),
    INDEX idx_email_accounts_user (user_id),
    INDEX idx_email_accounts_sync (sync_enabled, last_sync_at),
    
    CONSTRAINT fk_email_accounts_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: email_threads
-- ============================================

CREATE TABLE IF NOT EXISTS email_threads (
    id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    
    thread_id VARCHAR(255) NOT NULL,
    user_email_account_id CHAR(36) NOT NULL,
    
    subject VARCHAR(1000) NOT NULL,
    participants JSON NOT NULL,
    
    -- Compteurs
    message_count INT DEFAULT 1,
    unread_count INT DEFAULT 1,
    
    -- Dates
    last_message_date DATETIME(3) NOT NULL,
    
    -- Classification
    category VARCHAR(100),
    tags JSON,
    priority ENUM('Basse', 'Moyenne', 'Haute', 'Urgente'),
    
    -- Rattachement
    etablissement_id CHAR(36),
    groupe_id CHAR(36),
    partenaire_id CHAR(36),
    is_hors_etablissement TINYINT(1) DEFAULT 0,
    
    -- IA
    ai_generated_title VARCHAR(255),
    ai_summary TEXT,
    ai_confidence_score DECIMAL(5, 4),
    ai_extracted_data JSON,
    ai_last_processed_at DATETIME(3),
    
    -- Statut
    is_archived TINYINT(1) DEFAULT 0,
    is_deleted TINYINT(1) DEFAULT 0,
    is_spam TINYINT(1) DEFAULT 0,
    needs_manual_review TINYINT(1) DEFAULT 0,
    
    -- Révision
    reviewed_by CHAR(36),
    reviewed_at DATETIME(3),
    
    -- Auto-création
    auto_created_etablissement TINYINT(1) DEFAULT 0,
    
    UNIQUE KEY uk_thread (thread_id, user_email_account_id),
    INDEX idx_threads_account (user_email_account_id),
    INDEX idx_threads_etablissement (etablissement_id),
    INDEX idx_threads_last_message (last_message_date DESC),
    INDEX idx_threads_category (category),
    INDEX idx_threads_unread (unread_count),
    
    CONSTRAINT fk_threads_account FOREIGN KEY (user_email_account_id) REFERENCES user_email_accounts(id) ON DELETE CASCADE,
    CONSTRAINT fk_threads_etablissement FOREIGN KEY (etablissement_id) REFERENCES etablissements(id) ON DELETE SET NULL,
    CONSTRAINT fk_threads_groupe FOREIGN KEY (groupe_id) REFERENCES groupes_etablissements(id) ON DELETE SET NULL,
    CONSTRAINT fk_threads_partenaire FOREIGN KEY (partenaire_id) REFERENCES partenaires(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: email_messages
-- ============================================

CREATE TABLE IF NOT EXISTS email_messages (
    id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    
    thread_id CHAR(36) NOT NULL,
    message_id VARCHAR(500) NOT NULL,
    imap_uid VARCHAR(100) NOT NULL,
    
    -- Expéditeur
    from_address VARCHAR(255) NOT NULL,
    from_name VARCHAR(255),
    reply_to VARCHAR(255),
    
    -- Destinataires
    to_addresses JSON NOT NULL,
    cc_addresses JSON,
    bcc_addresses JSON,
    
    -- Contenu
    subject VARCHAR(1000) NOT NULL,
    body_text LONGTEXT,
    body_html LONGTEXT,
    
    -- Dates
    sent_date DATETIME(3) NOT NULL,
    received_date DATETIME(3) NOT NULL,
    
    -- Pièces jointes
    has_attachments TINYINT(1) DEFAULT 0,
    attachments_count INT DEFAULT 0,
    
    -- Références
    in_reply_to VARCHAR(500),
    reference_headers JSON,
    
    -- Flags
    flags JSON,
    is_read TINYINT(1) DEFAULT 0,
    is_sent TINYINT(1) DEFAULT 0,
    is_draft TINYINT(1) DEFAULT 0,
    
    INDEX idx_messages_thread (thread_id),
    INDEX idx_messages_message_id (message_id),
    INDEX idx_messages_from (from_address),
    INDEX idx_messages_date (sent_date DESC),
    
    CONSTRAINT fk_messages_thread FOREIGN KEY (thread_id) REFERENCES email_threads(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: rh_employees
-- ============================================

CREATE TABLE IF NOT EXISTS rh_employees (
    id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    
    -- Identité
    profile_id CHAR(36),
    nom VARCHAR(255) NOT NULL,
    prenom VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    telephone VARCHAR(50),
    
    -- Poste
    poste VARCHAR(255) NOT NULL,
    departement VARCHAR(255),
    manager_id CHAR(36),
    
    -- Contrat
    type_contrat ENUM('CDI', 'CDD', 'Alternance', 'Stage', 'Freelance') NOT NULL,
    date_entree DATE NOT NULL,
    date_sortie DATE,
    temps_travail DECIMAL(5, 2) DEFAULT 100.00, -- Pourcentage
    
    -- Statut
    statut ENUM('en_cours', 'actif', 'sortie_prevue', 'sorti') NOT NULL DEFAULT 'actif',
    
    -- RH
    numero_securite_sociale VARCHAR(20),
    adresse TEXT,
    
    INDEX idx_employees_nom (nom, prenom),
    INDEX idx_employees_email (email),
    INDEX idx_employees_statut (statut),
    INDEX idx_employees_departement (departement),
    
    CONSTRAINT fk_employees_profile FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL,
    CONSTRAINT fk_employees_manager FOREIGN KEY (manager_id) REFERENCES rh_employees(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: rh_salaires_mensuels
-- ============================================

CREATE TABLE IF NOT EXISTS rh_salaires_mensuels (
    id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    
    employee_id CHAR(36) NOT NULL,
    mois DATE NOT NULL, -- Premier jour du mois
    
    -- Montants
    salaire_brut DECIMAL(15, 2) NOT NULL,
    salaire_net DECIMAL(15, 2) NOT NULL,
    net_paye DECIMAL(15, 2), -- Montant réellement versé
    cotisations_salariales DECIMAL(15, 2),
    cotisations_patronales DECIMAL(15, 2),
    
    -- Primes et déductions
    primes JSON,
    deductions JSON,
    
    -- Document
    bulletin_path TEXT,
    bulletin_metadata JSON,
    
    UNIQUE KEY uk_employee_mois (employee_id, mois),
    INDEX idx_salaires_employee (employee_id),
    INDEX idx_salaires_mois (mois),
    
    CONSTRAINT fk_salaires_employee FOREIGN KEY (employee_id) REFERENCES rh_employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: tresorerie_revenus
-- ============================================

CREATE TABLE IF NOT EXISTS tresorerie_revenus (
    id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    
    etablissement_id CHAR(36),
    
    -- Montants
    montant DECIMAL(15, 2) NOT NULL,
    montant_ht DECIMAL(15, 2),
    tva DECIMAL(15, 2),
    
    -- Type et catégorie
    type_revenu VARCHAR(100) NOT NULL,
    categorie VARCHAR(100),
    description TEXT,
    
    -- Dates
    date_revenu DATE NOT NULL,
    date_echeance DATE,
    date_encaissement DATE,
    
    -- Statut
    statut ENUM('prévu', 'facturé', 'encaissé', 'en_retard', 'annulé') NOT NULL DEFAULT 'prévu',
    
    -- Référence
    numero_facture VARCHAR(100),
    reference_externe VARCHAR(255),
    
    -- Récurrence
    is_recurring TINYINT(1) DEFAULT 0,
    recurrence_pattern JSON,
    
    INDEX idx_revenus_etablissement (etablissement_id),
    INDEX idx_revenus_date (date_revenu),
    INDEX idx_revenus_statut (statut),
    INDEX idx_revenus_type (type_revenu),
    
    CONSTRAINT fk_revenus_etablissement FOREIGN KEY (etablissement_id) REFERENCES etablissements(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: tresorerie_depenses
-- ============================================

CREATE TABLE IF NOT EXISTS tresorerie_depenses (
    id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    
    -- Montants
    montant DECIMAL(15, 2) NOT NULL,
    montant_ht DECIMAL(15, 2),
    tva DECIMAL(15, 2),
    
    -- Type et catégorie
    type_depense VARCHAR(100) NOT NULL,
    categorie VARCHAR(100),
    description TEXT,
    
    -- Dates
    date_depense DATE NOT NULL,
    date_echeance DATE,
    date_paiement DATE,
    
    -- Statut
    statut ENUM('prévue', 'à_payer', 'payée', 'en_retard', 'annulée') NOT NULL DEFAULT 'prévue',
    
    -- Référence
    numero_facture VARCHAR(100),
    fournisseur VARCHAR(255),
    reference_externe VARCHAR(255),
    
    -- Source
    source_code VARCHAR(50), -- 'rh_salaires_net', 'rh_cotisations', etc.
    source_id CHAR(36),
    
    -- Récurrence
    is_recurring TINYINT(1) DEFAULT 0,
    recurrence_pattern JSON,
    
    INDEX idx_depenses_date (date_depense),
    INDEX idx_depenses_statut (statut),
    INDEX idx_depenses_type (type_depense),
    INDEX idx_depenses_source (source_code, source_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABLE: support_tickets
-- ============================================

CREATE TABLE IF NOT EXISTS support_tickets (
    id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    
    -- Référence
    ticket_number VARCHAR(50) NOT NULL UNIQUE,
    
    -- Contenu
    subject VARCHAR(500) NOT NULL,
    description TEXT,
    
    -- Classification
    priority ENUM('Basse', 'Moyenne', 'Haute', 'Urgente') NOT NULL DEFAULT 'Moyenne',
    category VARCHAR(100),
    tags JSON,
    
    -- Statut
    status ENUM('Nouveau', 'En cours', 'En attente', 'Résolu', 'Fermé') NOT NULL DEFAULT 'Nouveau',
    
    -- Rattachement
    etablissement_id CHAR(36),
    email_thread_id CHAR(36),
    tache_id CHAR(36),
    
    -- Assignation
    assigned_to CHAR(36),
    
    -- SLA
    sla_due_date DATETIME(3),
    first_response_at DATETIME(3),
    resolved_at DATETIME(3),
    
    -- IA
    ai_analysis JSON,
    
    INDEX idx_tickets_number (ticket_number),
    INDEX idx_tickets_status (status),
    INDEX idx_tickets_priority (priority),
    INDEX idx_tickets_etablissement (etablissement_id),
    INDEX idx_tickets_assigned (assigned_to),
    
    CONSTRAINT fk_tickets_etablissement FOREIGN KEY (etablissement_id) REFERENCES etablissements(id) ON DELETE SET NULL,
    CONSTRAINT fk_tickets_assigned FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- VUES (Équivalents des vues PostgreSQL)
-- ============================================

-- Vue pour les threads avec enrichissement
CREATE OR REPLACE VIEW email_threads_list_view AS
SELECT 
    t.*,
    e.nom AS etablissement_nom,
    e.logo_url AS etablissement_logo,
    g.nom AS groupe_nom,
    g.logo_url AS groupe_logo,
    p.nom AS partenaire_nom
FROM email_threads t
LEFT JOIN etablissements e ON t.etablissement_id = e.id
LEFT JOIN groupes_etablissements g ON t.groupe_id = g.id
LEFT JOIN partenaires p ON t.partenaire_id = p.id
WHERE t.is_deleted = 0;

-- ============================================
-- PROCÉDURES STOCKÉES (Équivalents des fonctions PostgreSQL)
-- ============================================

DELIMITER //

-- Vérification de rôle
CREATE PROCEDURE has_role(IN p_user_id CHAR(36), IN p_role VARCHAR(50), OUT result TINYINT)
BEGIN
    SELECT COUNT(*) > 0 INTO result
    FROM user_roles
    WHERE user_id = p_user_id AND role = p_role;
END //

-- Vérification admin
CREATE FUNCTION is_admin(p_user_id CHAR(36)) RETURNS TINYINT
DETERMINISTIC
BEGIN
    DECLARE result TINYINT;
    SELECT COUNT(*) > 0 INTO result
    FROM user_roles
    WHERE user_id = p_user_id AND role = 'admin';
    RETURN result;
END //

DELIMITER ;

-- ============================================
-- INDEXES ADDITIONNELS POUR PERFORMANCE
-- ============================================

-- Index full-text pour la recherche
ALTER TABLE etablissements ADD FULLTEXT INDEX ft_etablissements_search (nom, ville, notes);
ALTER TABLE email_threads ADD FULLTEXT INDEX ft_threads_search (subject, ai_generated_title);
ALTER TABLE taches ADD FULLTEXT INDEX ft_taches_search (titre, description);

-- ============================================
-- RÉACTIVER LES CONTRAINTES
-- ============================================

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================
-- NOTES DE MIGRATION
-- ============================================
-- 
-- 1. Les UUID PostgreSQL sont convertis en CHAR(36)
-- 2. Les TIMESTAMPTZ sont convertis en DATETIME(3) pour la précision milliseconde
-- 3. Les tableaux PostgreSQL (TEXT[], etc.) sont stockés en JSON
-- 4. Les ENUM PostgreSQL sont convertis en ENUM MySQL natifs
-- 5. Les fonctions SECURITY DEFINER doivent être implémentées côté application
-- 6. Row Level Security doit être géré par middleware applicatif
-- 7. Les triggers PostgreSQL doivent être recréés en MySQL
-- 
-- IMPORTANT: Ce script est un point de départ. Adaptez-le selon vos besoins.
-- ============================================
