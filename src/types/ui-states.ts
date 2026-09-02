/**
 * Types pour les états UI des pages majeures
 * 
 * Ces types remplacent les usages de `any` pour les états locaux
 * des composants, améliorant la sécurité du typage et l'autocomplétion.
 */

import type { ProfileWithRole } from '@/hooks/profile/useProfilesWithRoles';
import type { Tables } from '@/integrations/supabase/types';

// ============================================
// Types pour GestionUtilisateurs.tsx
// ============================================

/** Type pour l'utilisateur en cours d'édition */
export type EditingUser = ProfileWithRole | null;

/** Type pour l'utilisateur dont on reset le mot de passe */
export type ResetPasswordUser = Pick<ProfileWithRole, 'id' | 'prenom' | 'nom' | 'email'> | null;

/** Type pour les comptes email d'un utilisateur (vue sécurisée) */
export interface UserEmailAccountSafe {
  id: string;
  email_address: string;
  is_active: boolean;
  sync_enabled: boolean;
  last_sync_at: string | null;
}

// ============================================
// Types pour Equipe.tsx
// ============================================

/** Type pour le profil sélectionné dans la page équipe */
export type SelectedProfile = ProfileWithRole | null;

// ============================================
// Types pour EtablissementDetail.tsx
// ============================================

/** 
 * Type pour la tâche sélectionnée - utilise le type de base avec relations optionnelles
 * Ce type est flexible pour accepter les tâches venant de différents composants
 */
export interface SelectedTacheData {
  id: string;
  titre: string;
  description?: string | null;
  statut: string;
  priorite?: string | null;
  echeance?: string | null;
  date_debut?: string | null;
  date_realisation?: string | null;
  etablissement_id?: string | null;
  responsable_id?: string | null;
  archive?: boolean;
  // Relations optionnelles provenant des jointures
  categorie?: { id: string; nom: string; couleur?: string | null } | null;
  responsable?: { id: string; prenom: string | null; nom: string | null } | null;
  etablissement?: { id: string; nom: string } | null;
  // Permettre des propriétés additionnelles
  [key: string]: unknown;
}

export type SelectedTache = SelectedTacheData | null;

// ============================================
// Types pour BookingPage.tsx
// ============================================

/** Type pour le statut d'une réservation */
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';

/** Type pour les mises à jour de statut de booking */
export interface BookingStatusUpdate {
  status: BookingStatus;
  confirmed_at?: string;
  cancelled_at?: string;
  cancelled_by?: 'host' | 'guest';
  cancellation_reason?: string;
}

// ============================================
// Types pour les formulaires
// ============================================

/** Données de formulaire pour création/édition utilisateur */
export interface UserFormData {
  prenom: string;
  nom: string;
  email: string;
  role: ProfileWithRole['role'];
  password: string;
  actif: boolean;
}

/** Données de formulaire pour configuration email */
export interface EmailConfigFormData {
  email_address: string;
  password: string;
  imap_host: string;
  imap_port: number;
  smtp_host: string;
  smtp_port: number;
}

// ============================================
// Types pour Contrats.tsx
// ============================================

/** Type pour le contrat en cours d'édition */
export type EditingContrat = Tables<'contrats'> | null;

// ============================================
// Types pour CatalogueProduits.tsx
// ============================================

/** Type pour le produit en cours d'édition */
export interface CatalogueProduit {
  id: string;
  code: string;
  nom: string;
  description?: string | null;
  type: 'service' | 'produit' | 'licence' | 'formation' | 'maintenance';
  prix_unitaire_ht: number;
  taux_tva: number;
  unite: string;
  est_actif: boolean;
  created_at?: string;
  updated_at?: string;
}

export type EditingProduit = CatalogueProduit | null;

// ============================================
// Types pour RHSalairesTable.tsx
// ============================================

/** Type pour les valeurs d'édition de salaire */
export interface SalaireEditValues {
  salaire_brut: number;
  primes: number;
  heures_supplementaires: number;
}

// ============================================
// Types pour RHPlanningAbsencesVisuel.tsx
// ============================================

/** Type pour l'absence sélectionnée */
export interface SelectedAbsence {
  id: string;
  profile_id: string;
  type: string;
  date_debut: string;
  date_fin: string;
  statut: string;
  motif?: string | null;
  commentaire?: string | null;
  created_at: string;
  updated_at: string;
  profile?: {
    id: string;
    prenom: string | null;
    nom: string | null;
  } | null;
}

// ============================================
// Types pour RHEntretienDetail.tsx
// ============================================

/** Type pour la préparation IA d'un entretien */
export interface PreparationIA {
  questions_suggerees: string[];
  points_attention: string[];
  objectifs_proposes: string[];
  synthese: string;
}

// ============================================
// Types pour AnalyseGeographique.tsx
// ============================================

/** Type pour les filtres avancés de l'analyse géographique */
export interface GeoAdvancedFilters {
  search: string;
  regions: string[];
  types: string[];
  phases: string[];
  dpis: string[];
}

// ============================================
// Types pour PWA/Mobile
// ============================================

/** Type pour le prompt d'installation PWA (BeforeInstallPromptEvent) */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
