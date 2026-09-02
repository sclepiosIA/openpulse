// Types pour les Avoirs (Notes de Crédit)

export interface Avoir {
  id: string;
  numero: string;
  facture_id: string;
  etablissement_id: string | null;
  
  client_nom: string;
  client_adresse: string | null;
  client_email: string | null;
  client_siret: string | null;
  
  date_emission: string;
  
  motif: AvoirMotif;
  motif_detail: string | null;
  
  montant_ht: number;
  montant_tva: number;
  montant_ttc: number;
  
  statut: AvoirStatut;
  
  mode_remboursement: 'virement' | 'avoir_compte' | 'cheque' | null;
  date_remboursement: string | null;
  reference_remboursement: string | null;
  
  notes_internes: string | null;
  
  created_by: string | null;
  created_at: string;
  updated_at: string;
  
  // Relations
  facture?: {
    id: string;
    numero: string;
    client_nom: string;
    montant_ttc: number;
  };
  etablissement?: {
    id: string;
    nom: string;
    ville: string | null;
  };
  lignes?: AvoirLigne[];
}

export type AvoirMotif = 
  | 'erreur_facturation'
  | 'retour_marchandise'
  | 'remise_commerciale'
  | 'annulation_partielle'
  | 'annulation_totale'
  | 'geste_commercial'
  | 'autre';

export type AvoirStatut = 
  | 'brouillon'
  | 'emis'
  | 'rembourse'
  | 'impute'
  | 'annule';

export interface AvoirLigne {
  id: string;
  avoir_id: string;
  facture_ligne_id: string | null;
  
  designation: string;
  description: string | null;
  quantite: number;
  prix_unitaire_ht: number;
  taux_tva: number;
  
  montant_ht: number;
  montant_tva: number;
  montant_ttc: number;
  
  created_at: string;
}

// Labels et couleurs
export const AVOIR_MOTIF_LABELS: Record<AvoirMotif, string> = {
  erreur_facturation: 'Erreur de facturation',
  retour_marchandise: 'Retour de marchandise',
  remise_commerciale: 'Remise commerciale',
  annulation_partielle: 'Annulation partielle',
  annulation_totale: 'Annulation totale',
  geste_commercial: 'Geste commercial',
  autre: 'Autre'
};

export const AVOIR_STATUT_LABELS: Record<AvoirStatut, string> = {
  brouillon: 'Brouillon',
  emis: 'Émis',
  rembourse: 'Remboursé',
  impute: 'Imputé sur facture',
  annule: 'Annulé'
};

export const AVOIR_STATUT_COLORS: Record<AvoirStatut, string> = {
  brouillon: 'bg-gray-100 text-gray-700',
  emis: 'bg-blue-100 text-blue-700',
  rembourse: 'bg-green-100 text-green-700',
  impute: 'bg-emerald-100 text-emerald-700',
  annule: 'bg-red-100 text-red-700'
};
