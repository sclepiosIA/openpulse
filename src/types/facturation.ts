// Types pour le module Facturation & Devis

export type CatalogueRecurrence = 'none' | 'monthly' | 'quarterly' | 'yearly';

export interface CatalogueProduit {
  id: string;
  code: string;
  nom: string;
  description: string | null;
  type: 'service' | 'produit' | 'licence' | 'formation' | 'maintenance';
  prix_unitaire_ht: number;
  taux_tva: number;
  unite: string;
  est_actif: boolean;
  categorie?: string | null;
  recurrence?: CatalogueRecurrence;
  prix_min_ht?: number | null;
  prix_max_ht?: number | null;
  remise_max_pct?: number;
  notes_internes?: string | null;
  ordre_affichage?: number;
  created_at: string;
  updated_at: string;
}

export const RECURRENCE_LABELS: Record<CatalogueRecurrence, string> = {
  none: 'Ponctuel',
  monthly: 'Mensuel',
  quarterly: 'Trimestriel',
  yearly: 'Annuel',
};

export interface Devis {
  id: string;
  numero: string;
  etablissement_id: string | null;
  groupe_id: string | null;
  partenaire_id: string | null;
  contact_id: string | null;
  
  client_nom: string;
  client_adresse: string | null;
  client_email: string | null;
  client_telephone: string | null;
  client_siret: string | null;
  
  date_emission: string;
  date_validite: string;
  date_signature: string | null;
  
  statut: DevisStatut;
  
  montant_ht: number;
  montant_tva: number;
  montant_ttc: number;
  remise_globale_pourcent: number | null;
  remise_globale_montant: number | null;
  
  conditions_paiement: string | null;
  notes_internes: string | null;
  notes_client: string | null;
  
  signature_url: string | null;
  signe_par: string | null;
  signe_le: string | null;
  
  created_by: string | null;
  commercial_id: string | null;
  facture_id: string | null;
  created_at: string;
  updated_at: string;
  
  // Relations
  etablissement?: { id: string; nom: string; ville: string | null } | null;
  contact?: { id: string; nom: string; prenom: string | null; email: string | null } | null;
  commercial?: { id: string; first_name: string | null; last_name: string | null } | null;
  lignes?: DevisLigne[];
}

export type DevisStatut = 'brouillon' | 'envoye' | 'en_negociation' | 'accepte' | 'refuse' | 'expire' | 'converti';

export interface DevisLigne {
  id: string;
  devis_id: string;
  produit_id: string | null;
  
  ordre: number;
  designation: string;
  description: string | null;
  quantite: number;
  unite: string;
  prix_unitaire_ht: number;
  taux_tva: number;
  remise_pourcent: number | null;
  
  montant_ht: number;
  montant_tva: number;
  montant_ttc: number;
  
  created_at: string;
  
  // Relations
  produit?: CatalogueProduit | null;
}

export interface Facture {
  id: string;
  numero: string;
  etablissement_id: string | null;
  groupe_id: string | null;
  partenaire_id: string | null;
  contact_id: string | null;
  
  client_nom: string;
  client_adresse: string | null;
  client_email: string | null;
  client_telephone: string | null;
  client_siret: string | null;
  
  date_emission: string;
  date_echeance: string;
  
  statut: FactureStatut;
  
  montant_ht: number;
  montant_tva: number;
  montant_ttc: number;
  montant_paye: number;
  remise_globale_pourcent: number | null;
  remise_globale_montant: number | null;
  
  conditions_paiement: string | null;
  mode_paiement: string | null;
  notes_internes: string | null;
  notes_client: string | null;
  
  devis_id: string | null;
  numero_bon_commande: string | null;
  
  created_by: string | null;
  commercial_id: string | null;
  created_at: string;
  updated_at: string;
  
  // Relations
  etablissement?: { id: string; nom: string; ville: string | null } | null;
  contact?: { id: string; nom: string; prenom: string | null; email: string | null } | null;
  commercial?: { id: string; first_name: string | null; last_name: string | null } | null;
  devis?: { id: string; numero: string } | null;
  lignes?: FactureLigne[];
  paiements?: PaiementFacture[];
}

export type FactureStatut = 'brouillon' | 'emise' | 'envoyee' | 'en_attente' | 'partiellement_payee' | 'payee' | 'annulee' | 'contentieux';

export interface FactureLigne {
  id: string;
  facture_id: string;
  produit_id: string | null;
  devis_ligne_id: string | null;
  
  ordre: number;
  designation: string;
  description: string | null;
  quantite: number;
  unite: string;
  prix_unitaire_ht: number;
  taux_tva: number;
  remise_pourcent: number | null;
  
  montant_ht: number;
  montant_tva: number;
  montant_ttc: number;
  
  created_at: string;
  
  // Relations
  produit?: CatalogueProduit | null;
}

export interface PaiementFacture {
  id: string;
  facture_id: string;
  
  montant: number;
  date_paiement: string;
  mode_paiement: 'virement' | 'cheque' | 'carte' | 'prelevement' | 'especes' | 'autre';
  reference_paiement: string | null;
  notes: string | null;
  
  created_by: string | null;
  created_at: string;
}

// Labels et couleurs
export const DEVIS_STATUT_LABELS: Record<DevisStatut, string> = {
  brouillon: 'Brouillon',
  envoye: 'Envoyé',
  en_negociation: 'En négociation',
  accepte: 'Accepté',
  refuse: 'Refusé',
  expire: 'Expiré',
  converti: 'Converti en facture'
};

export const DEVIS_STATUT_COLORS: Record<DevisStatut, string> = {
  brouillon: 'bg-gray-100 text-gray-700',
  envoye: 'bg-blue-100 text-blue-700',
  en_negociation: 'bg-amber-100 text-amber-700',
  accepte: 'bg-green-100 text-green-700',
  refuse: 'bg-red-100 text-red-700',
  expire: 'bg-gray-200 text-gray-600',
  converti: 'bg-emerald-100 text-emerald-700'
};

export const FACTURE_STATUT_LABELS: Record<FactureStatut, string> = {
  brouillon: 'Brouillon',
  emise: 'Émise',
  envoyee: 'Envoyée',
  en_attente: 'En attente',
  partiellement_payee: 'Partiellement payée',
  payee: 'Payée',
  annulee: 'Annulée',
  contentieux: 'Contentieux'
};

export const FACTURE_STATUT_COLORS: Record<FactureStatut, string> = {
  brouillon: 'bg-gray-100 text-gray-700',
  emise: 'bg-blue-100 text-blue-700',
  envoyee: 'bg-sky-100 text-sky-700',
  en_attente: 'bg-amber-100 text-amber-700',
  partiellement_payee: 'bg-orange-100 text-orange-700',
  payee: 'bg-green-100 text-green-700',
  annulee: 'bg-red-100 text-red-700',
  contentieux: 'bg-red-200 text-red-800'
};

export const PRODUIT_TYPE_LABELS: Record<string, string> = {
  service: 'Service',
  produit: 'Produit',
  licence: 'Licence',
  formation: 'Formation',
  maintenance: 'Maintenance'
};

export const MODE_PAIEMENT_LABELS: Record<string, string> = {
  virement: 'Virement bancaire',
  cheque: 'Chèque',
  carte: 'Carte bancaire',
  prelevement: 'Prélèvement',
  especes: 'Espèces',
  autre: 'Autre'
};
