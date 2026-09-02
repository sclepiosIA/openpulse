import { Database } from '@/integrations/supabase/types';

// ============================================
// Types directs depuis la BDD (source de vérité)
// ============================================
export type RevenuRow = Database['public']['Tables']['tresorerie_revenus']['Row'];
export type RevenuInsert = Database['public']['Tables']['tresorerie_revenus']['Insert'];
export type RevenuUpdate = Database['public']['Tables']['tresorerie_revenus']['Update'];

export type DepenseRow = Database['public']['Tables']['tresorerie_depenses']['Row'];
export type DepenseInsert = Database['public']['Tables']['tresorerie_depenses']['Insert'];
export type DepenseUpdate = Database['public']['Tables']['tresorerie_depenses']['Update'];

export type SoldeRow = Database['public']['Tables']['tresorerie_solde']['Row'];

// ============================================
// Types de revenus valides (contrainte CHECK BDD)
// ============================================
export type TypeRevenu = 'abonnement_mensuel' | 'paiement_initial' | 'etude_medico_eco' | 'autre';

// ============================================
// Statuts de revenus
// ============================================
export type StatutRevenu = 
  | 'pipeline'        // Opportunité en cours
  | 'contractualise'  // Contrat signé, facturation à venir
  | 'a_facturer'      // Prêt à être facturé
  | 'facture'         // Facture émise, en attente de paiement
  | 'paye'            // Payé
  | 'en_retard'       // Paiement en retard
  | 'annule';         // Annulé

// ============================================
// Statuts de dépenses
// ============================================
export type StatutDepense = 
  | 'en_attente'  // À valider
  | 'valide'      // Validée
  | 'paye'        // Payée
  | 'payee'       // Alias pour compatibilité
  | 'en_retard'   // En retard
  | 'annule';     // Annulée

// ============================================
// Interface Revenu avec relations
// ============================================
export interface Revenu extends RevenuRow {
  etablissements?: {
    id: string;
    nom: string;
    ville: string;
    type_offre: string | null;
    modele_detaille: string | null;
    periodicite_paiement: string | null;
    logo_url: string | null;
  } | null;
}

// ============================================
// Interface Dépense avec relations
// ============================================
export interface Depense extends DepenseRow {
  categories?: {
    code: string;
    nom: string;
    couleur: string | null;
  } | null;
}

// ============================================
// Données pour création de revenu
// ============================================
export interface CreateRevenuData {
  etablissement_id: string;
  mois: string;
  date_prevue?: string;
  montant_prevu: number;
  statut?: StatutRevenu;
  type_revenu?: TypeRevenu;
  probabilite_signature?: number;
  date_signature_estimee?: string;
  notes?: string;
}

// ============================================
// Données pour mise à jour de revenu
// ============================================
export interface UpdateRevenuData {
  date_prevue?: string;
  date_facture?: string;
  date_paiement_reel?: string;
  montant_prevu?: number;
  montant_facture?: number;
  montant_paye?: number;
  statut?: StatutRevenu;
  probabilite_signature?: number;
  numero_facture?: string;
  reference_paiement?: string;
  notes?: string;
}

// ============================================
// Données pour création de dépense
// ============================================
export interface CreateDepenseData {
  nom: string;
  montant: number;
  date_prevue: string;
  categorie_code?: string;
  statut?: StatutDepense;
  notes?: string;
  est_recurrent?: boolean;
  recurrence?: string;
}

// ============================================
// Données pour mise à jour de dépense
// ============================================
export interface UpdateDepenseData {
  nom?: string;
  montant?: number;
  date_prevue?: string;
  date_paiement_reel?: string;
  statut?: StatutDepense;
  categorie_code?: string;
  notes?: string;
  est_recurrent?: boolean;
  recurrence?: string;
}

// ============================================
// Statistiques des revenus
// ============================================
export interface RevenusStats {
  pipeline: {
    total: number;
    montantBrut: number;
    montantPondere: number;
    moyenneProbabilite: number;
  };
  contractualise: {
    total: number;
    montantMensuel: number;
    montantAnnuel: number;
  };
  facture: {
    total: number;
    montantEnAttente: number;
    montantEnRetard: number;
  };
  paye: {
    total: number;
    montantRecu: number;
    montantMoisCourant: number;
  };
}

// ============================================
// Statistiques des dépenses
// ============================================
export interface DepensesStats {
  total: number;
  totalMontant: number;
  enAttente: number;
  payees: number;
  parCategorie: Record<string, { montant: number; count: number }>;
}

// ============================================
// Données pour le solde
// ============================================
export interface SoldeData {
  solde: SoldeRow | null;
  totalRevenusPrevu: number;
  totalRevenusPaye: number;
  totalDepensesPrevu: number;
  totalDepensesPaye: number;
  soldeProjecte: number;
  soldeReel: number;
}

// ============================================
// Point de données pour la timeline
// ============================================
export interface TimelineDataPoint {
  mois: string;
  moisFormate?: string;
  recettes: number;
  depenses: number;
  solde: number;
}

// ============================================
// Export de données Excel
// ============================================
export interface ExcelExportRow {
  [key: string]: string | number | boolean | null | undefined;
}

// ============================================
// Types pour les factures workflow (legacy)
// ============================================
export type StatutFacture = 'non_emise' | 'emise' | 'en_attente' | 'payee' | 'encaissee' | 'en_negociation' | 'negociation_avancee' | 'annulee';

export interface FactureFormData {
  nom_client: string;
  date_emission: string;
  montant_ttc: number;
  taux_tva: number;
  delai_paiement_jours: number;
  date_paiement_attendue: string;
  numero_facture?: string;
  mois_facturation: string;
  notes?: string;
  statut?: StatutFacture;
}

export interface FactureComplete {
  id: string;
  nom_client: string;
  date_emission: string;
  montant_ttc: number;
  taux_tva: number;
  delai_paiement_jours: number;
  date_paiement_attendue: string;
  numero_facture?: string;
  mois_facturation: string;
  notes?: string;
  statut: StatutFacture;
  created_at: string;
  updated_at: string;
}

// ============================================
// Types pour le journal d'opérations (legacy)
// ============================================
export type TypeOperation = 'recette' | 'depense';
export type StatutOperation = 'prevu' | 'realise' | 'comptabilise';

export interface CreateOperationData {
  date: string;
  libelle: string;
  montant: number;
  type: TypeOperation;
  statut?: StatutOperation;
  categorie_code?: string;
  notes?: string;
}

export interface OperationJournaliere {
  id: string;
  date: string;
  libelle: string;
  montant: number;
  solde_apres: number;
  type: TypeOperation;
  statut: StatutOperation;
  categorie_code: string | null;
  source_id: string | null;
  source_type: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// Types pour les paiements de factures (legacy)
// ============================================
export type MoyenPaiement = 'virement' | 'prelevement' | 'cheque' | 'especes' | 'autre';

export interface PaiementFacture {
  id: string;
  facture_id: string;
  montant: number;
  date_paiement: string;
  moyen_paiement: MoyenPaiement | null;
  reference_bancaire: string | null;
  notes: string | null;
  created_at: string;
}

export interface CreatePaiementData {
  facture_id: string;
  montant: number;
  date_paiement: string;
  moyen_paiement?: MoyenPaiement | null;
  reference_bancaire?: string;
  notes?: string;
}

export interface FactureWithPaiements {
  montant_ttc: number;
  statut: 'payee' | 'emise' | 'non_emise';
}
