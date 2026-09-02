-- ============================================
-- Script d'initialisation PostgreSQL
-- OpenPulse - Self-Hosted
-- ============================================

-- Créer les extensions nécessaires
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================
-- Types énumérés
-- ============================================

DO $$
BEGIN
    -- Rôle utilisateur
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE app_role AS ENUM ('admin', 'direction', 'chef_projet', 'csm', 'commercial', 'rh', 'user');
    END IF;

    -- Statut établissement
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'statut_etablissement') THEN
        CREATE TYPE statut_etablissement AS ENUM (
            'Prospect', 'Attente RDV', 'RDV pris', 'Contractualisation',
            'Contractuel avant sig', 'Contractuel post-sig',
            'Phase conformité', 'Déploiement', 'Production'
        );
    END IF;

    -- Priorité tâche
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'priorite_tache') THEN
        CREATE TYPE priorite_tache AS ENUM ('Basse', 'Moyenne', 'Haute', 'Urgente');
    END IF;

    -- Statut tâche
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'statut_tache') THEN
        CREATE TYPE statut_tache AS ENUM ('À faire', 'En cours', 'Terminée', 'Annulée');
    END IF;
END$$;

-- ============================================
-- Table des profils utilisateurs
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    role app_role DEFAULT 'user',
    est_actif BOOLEAN DEFAULT TRUE,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Table des rôles utilisateurs (many-to-many)
-- ============================================
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    role app_role NOT NULL,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    assigned_by UUID REFERENCES profiles(id),
    UNIQUE(user_id, role)
);

-- ============================================
-- Table des secrets 2FA
-- ============================================
CREATE TABLE IF NOT EXISTS profiles_secrets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
    two_factor_secret TEXT,
    backup_codes TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Index pour les performances
-- ============================================
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);

-- ============================================
-- Fonction helper pour vérifier les rôles
-- ============================================
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

-- ============================================
-- Fonction pour vérifier admin
-- ============================================
CREATE OR REPLACE FUNCTION is_admin_user(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN has_role(check_user_id, 'admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ============================================
-- Trigger pour updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Appliquer le trigger aux tables
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('profiles', 'profiles_secrets')
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS update_%I_updated_at ON %I', t, t);
        EXECUTE format('CREATE TRIGGER update_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', t, t);
    END LOOP;
END$$;

-- ============================================
-- Utilisateur admin par défaut
-- ============================================
INSERT INTO profiles (id, email, full_name, role, est_actif)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'admin@exploitant.example.org',
    'Administrateur',
    'admin',
    TRUE
) ON CONFLICT (email) DO NOTHING;

-- ============================================
-- Message de fin
-- ============================================
DO $$
BEGIN
    RAISE NOTICE 'Database initialization completed successfully!';
END$$;
