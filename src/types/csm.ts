/**
 * Types pour le module CSM (Customer Success Manager)
 */

// ============= Santé du compte =============

export type WeatherType = 'sunny' | 'partly-cloudy' | 'cloudy' | 'rainy' | 'stormy' | 'not-started'
export type TrendType = 'up' | 'down' | 'stable'

export interface CsmSanteCompte {
  id: string
  etablissement_id: string
  weather: WeatherType
  taux_utilisation: number | null
  taux_utilisation_trend: TrendType
  taux_uhcd: number | null
  taux_uhcd_dim: number | null
  taux_uhcd_trend: TrendType
  objectif_eme: string | null
  dossiers_traites: number | null
  passages_total: number | null
  periode_reference: string | null
  paliers_uhcd: string | null
  resume_sante: string | null
  actions: string[]
  created_at: string
  updated_at: string
}

// ============= Parcours jalons =============

export type JalonType = 'presentation' | 'pre_deploiement' | 'cadrage' | 'deploiement' | 'suivi_t1' | 'suivi_t2' | 'bilan_annuel'
export type JalonStatut = 'done' | 'planned' | 'planning' | 'pending' | 'skipped' | ''

export const JALON_TYPES: { value: JalonType; label: string }[] = [
  { value: 'presentation', label: 'Présentation' },
  { value: 'pre_deploiement', label: 'Pré-déploiement' },
  { value: 'cadrage', label: 'Cadrage' },
  { value: 'deploiement', label: 'Déploiement' },
  { value: 'suivi_t1', label: 'Suivi T1' },
  { value: 'suivi_t2', label: 'Suivi T2' },
  { value: 'bilan_annuel', label: 'Bilan annuel' },
]

export interface CsmParcoursJalon {
  id: string
  etablissement_id: string
  jalon_type: JalonType
  statut: JalonStatut
  date_jalon: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

// ============= Facturation suivi =============

export type FacturationStatut = 'OUI' | 'NON - En cours' | 'NA'

export interface CsmFacturationSuivi {
  id: string
  etablissement_id: string
  modele_facturation: string | null
  date_deploiement: string | null
  date_debut_periode: string | null
  date_fin_periode: string | null
  derniere_relance: string | null
  facturation_effectuee: FacturationStatut
  notes: string | null
  created_at: string
  updated_at: string
}

// ============= KPIs mensuels =============

export interface CsmKpiMensuel {
  id: string
  etablissement_id: string
  mois: string
  taux_uhcd_backend: number | null
  taux_uhcd_compte: number | null
  palier_eme: string | null
  objectif_eme: string | null
  taux_utilisation: number | null
  passages_total: number | null
  dossiers_traites: number | null
  eme: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

// ============= KPIs trimestriels =============

export interface CsmKpiTrimestriel {
  id: string
  etablissement_id: string
  periode: string
  taux_satisfaction: number | null
  dossiers_traites: number | null
  taux_utilisation_formatage: number | null
  taux_utilisation_ocr: number | null
  taux_utilisation_cotations: number | null
  taux_utilisation_courriers: number | null
  taux_utilisation_traduction: number | null
  taux_utilisation_examens: number | null
  taux_utilisation_chatbot: number | null
  taux_uhcd_marque: number | null
  taux_uhcd_compte: number | null
  ccm2_plus: number | null
  ccmu3_plus: number | null
  avis_specialise: number | null
  temps_passage_urgences: number | null
  sort_order: number
  created_at: string
  updated_at: string
}

// ============= Vue CSM =============

export type CsmView = 'comptes' | 'contacts' | 'parcours' | 'facturation' | 'utilisation' | 'kpis'

export const CSM_VIEWS: { value: CsmView; label: string }[] = [
  { value: 'comptes', label: 'Comptes' },
  { value: 'contacts', label: 'Contacts' },
  { value: 'parcours', label: 'Parcours' },
  { value: 'facturation', label: 'Facturation' },
  { value: 'utilisation', label: 'Utilisation' },
  { value: 'kpis', label: 'KPIs' },
]
