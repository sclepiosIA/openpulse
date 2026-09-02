/**
 * Types étendus pour les relations Supabase
 * 
 * Ces types permettent de typer correctement les résultats de requêtes
 * avec jointures, évitant ainsi les casts `as any` dans le code.
 * 
 * @example
 * ```typescript
 * const { data } = await supabase
 *   .from('etablissements')
 *   .select('*, groupe:groupes_etablissements(id, nom)')
 *   .single();
 * 
 * // Au lieu de: (data.groupe as any).nom
 * // Utiliser: const typedData = data as EtablissementWithGroupe;
 * //          typedData.groupe?.nom
 * ```
 */

import type { Tables } from '@/integrations/supabase/types';

// ============================================
// Types de base réutilisables
// ============================================

/** Relation minimale vers un groupe */
export interface GroupeRelation {
  id: string;
  nom: string;
}

/** Relation minimale vers un établissement */
export interface EtablissementRelation {
  id: string;
  nom: string;
  ville?: string | null;
}

/** Relation minimale vers un profil utilisateur */
export interface ProfileRelation {
  id: string;
  prenom: string | null;
  nom: string | null;
  email?: string | null;
  avatar_url?: string | null;
}

/** Relation minimale vers un projet R&D */
export interface ProjetRelation {
  id: string;
  nom: string;
}

/** Relation minimale vers un sprint */
export interface SprintRelation {
  id: string;
  nom: string;
  numero?: number | null;
}

/** Relation minimale vers un epic */
export interface EpicRelation {
  id: string;
  titre: string;
}

/** Relation minimale vers un partenaire */
export interface PartenaireRelation {
  id: string;
  nom: string;
  type_partenaire?: string | null;
}

// ============================================
// Types étendus pour le module CRM
// ============================================

/** Établissement avec sa relation groupe */
export type EtablissementWithGroupe = Tables<'etablissements'> & {
  groupe?: GroupeRelation | null;
};

/** Établissement avec son partenaire apporteur */
export type EtablissementWithPartenaire = Tables<'etablissements'> & {
  partenaire_apporteur?: PartenaireRelation | null;
};

/** Établissement avec toutes les relations courantes */
export type EtablissementWithRelations = Tables<'etablissements'> & {
  groupe?: GroupeRelation | null;
  partenaire_apporteur?: PartenaireRelation | null;
  commercial?: ProfileRelation | null;
  csm?: ProfileRelation | null;
};

/** Contact avec son établissement */
export type ContactWithEtablissement = Tables<'contacts'> & {
  etablissement?: EtablissementRelation | null;
};

/** Contact avec son groupe */
export type ContactWithGroupe = Tables<'contacts'> & {
  groupe?: GroupeRelation | null;
};

/** Tâche avec son établissement et assigné */
export type TacheWithRelations = Tables<'taches'> & {
  etablissement?: EtablissementRelation | null;
  assigned_user?: ProfileRelation | null;
  created_by_user?: ProfileRelation | null;
};

// ============================================
// Types étendus pour le module R&D
// ============================================

/** User Story avec son projet */
export type StoryWithProjet = Tables<'rd_user_stories'> & {
  projet?: ProjetRelation | null;
};

/** User Story avec son epic */
export type StoryWithEpic = Tables<'rd_user_stories'> & {
  epic?: EpicRelation | null;
};

/** User Story avec toutes les relations */
export type StoryWithRelations = Tables<'rd_user_stories'> & {
  projet?: ProjetRelation | null;
  epic?: EpicRelation | null;
  sprint?: SprintRelation | null;
  assignee?: ProfileRelation | null;
};

/** Sprint avec son projet */
export type SprintWithProjet = Tables<'rd_sprints'> & {
  projet?: ProjetRelation | null;
};

/** Task avec sa user story */
export type RdTaskWithStory = Tables<'rd_tasks'> & {
  user_story?: { id: string; titre: string; code?: string | null } | null;
  assignee?: ProfileRelation | null;
};

// ============================================
// Types étendus pour le module Support
// ============================================

/** Ticket avec son établissement */
export type TicketWithEtablissement = Tables<'support_tickets'> & {
  etablissement?: EtablissementRelation | null;
};

/** Ticket avec toutes les relations */
export type TicketWithRelations = Tables<'support_tickets'> & {
  etablissement?: EtablissementRelation | null;
  assigned_to_user?: ProfileRelation | null;
  created_by_user?: ProfileRelation | null;
};

// ============================================
// Types étendus pour le module RH
// ============================================

/** Salaire mensuel avec le profil */
export type SalaireMensuelWithProfile = Tables<'rh_salaires_mensuels'> & {
  profile?: ProfileRelation | null;
};

/** Absence avec le profil */
export type AbsenceWithProfile = Tables<'rh_absences'> & {
  profile?: ProfileRelation | null;
};

/** Document RH avec le profil */
export type DocumentRhWithProfile = Tables<'rh_documents_employes'> & {
  profile?: ProfileRelation | null;
};

// ============================================
// Types étendus pour le module Email
// ============================================

/** Thread avec son établissement */
export type ThreadWithEtablissement = Tables<'email_threads'> & {
  etablissement?: EtablissementRelation | null;
};

/** Thread avec toutes les relations */
export type ThreadWithRelations = Tables<'email_threads'> & {
  etablissement?: EtablissementRelation | null;
  groupe?: GroupeRelation | null;
  partenaire?: PartenaireRelation | null;
};

// ============================================
// Types étendus pour le module Facturation
// ============================================

/** Facture avec son établissement */
export type FactureWithEtablissement = Tables<'factures'> & {
  etablissement?: EtablissementRelation | null;
};

/** Devis avec son établissement */
export type DevisWithEtablissement = Tables<'devis'> & {
  etablissement?: EtablissementRelation | null;
  commercial?: ProfileRelation | null;
};

// ============================================
// Types étendus pour le module Booking
// ============================================

/** Booking avec toutes les relations */
export type BookingWithRelations = Tables<'bookings'> & {
  etablissement?: EtablissementRelation | null;
  booking_type?: { id: string; name: string; duration_minutes: number } | null;
  host?: ProfileRelation | null;
};

// ============================================
// Types étendus pour le module Recrutement
// ============================================

/** Candidat avec ses évaluations */
export type CandidatWithEvaluations = Tables<'candidates'> & {
  evaluations?: Array<{
    id: string;
    note_globale: number | null;
    evaluator?: ProfileRelation | null;
  }>;
};

// ============================================
// Helpers pour le typage des réponses Supabase
// ============================================

/**
 * Helper pour créer un type avec relations optionnelles
 * @example
 * type MyEtab = WithOptionalRelations<Tables<'etablissements'>, {
 *   groupe: GroupeRelation;
 *   commercial: ProfileRelation;
 * }>;
 */
export type WithOptionalRelations<
  TBase,
  TRelations extends Record<string, unknown>
> = TBase & {
  [K in keyof TRelations]?: TRelations[K] | null;
};

// ============================================
// Types pour les Mutations (Insert/Update)
// ============================================

import type { TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

/** Type pour mise à jour de booking page */
export type BookingPageUpdate = TablesUpdate<'booking_pages'>;

/** Type pour mise à jour de booking (statut, dates, etc.) */
export interface BookingStatusUpdate {
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  confirmed_at?: string;
  cancelled_at?: string;
  cancelled_by?: 'host' | 'guest';
  cancellation_reason?: string;
}

/** Type pour insertion de contact depuis pending_contacts */
export type ContactInsertFromPending = TablesInsert<'contacts'> & {
  created_source?: 'email_ai' | 'manual' | 'import';
  created_metadata?: {
    email_thread_id?: string;
    confidence?: number;
    approved_at?: string;
    reviewed_by?: string;
  };
};

/** Type pour mise à jour de bulletin de salaire */
export interface BulletinSalaireUpdate {
  salaire_brut?: number;
  salaire_net?: number;
  cout_employeur?: number;
  conges_payes?: number;
}
