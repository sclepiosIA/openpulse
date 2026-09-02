/**
 * Types pour le Module 9: Prédiction & Analytics Avancés
 */

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ChurnFactor = {
  factor: string;
  impact: number;
  description: string;
};

export interface ChurnPrediction {
  id: string;
  etablissement_id: string;
  score: number;
  risk_level: RiskLevel;
  factors: ChurnFactor[];
  recommendations: string[];
  predicted_at: string;
  model_version: string;
  created_at: string;
  updated_at: string;
  etablissement?: {
    id: string;
    nom: string;
    statut: string;
  };
}

// Types stricts pour les critères de segmentation client
export interface SegmentCriteria {
  statut?: string[];
  type_offre?: string[];
  periodicite?: string[];
  ca_min?: number;
  ca_max?: number;
  date_signature_min?: string;
  date_signature_max?: string;
  nb_utilisateurs_min?: number;
  nb_utilisateurs_max?: number;
  score_satisfaction_min?: number;
  score_satisfaction_max?: number;
  region?: string[];
  commercial_id?: string[];
  csm_id?: string[];
  custom_field?: string;
  custom_value?: string | number | boolean;
}

export interface ClientSegment {
  id: string;
  nom: string;
  description: string | null;
  criteres: SegmentCriteria;
  couleur: string;
  est_actif: boolean;
  created_at: string;
  updated_at: string;
  etablissements_count?: number;
}

export interface EtablissementSegment {
  id: string;
  etablissement_id: string;
  segment_id: string;
  score_appartenance: number;
  assigned_at: string;
  assigned_by: string | null;
  segment?: ClientSegment;
  etablissement?: {
    id: string;
    nom: string;
  };
}

export type UpsellStatus = 'pending' | 'contacted' | 'accepted' | 'rejected' | 'expired';

export interface UpsellRecommendation {
  id: string;
  etablissement_id: string;
  produit_recommande: string;
  raison: string | null;
  score_confiance: number;
  statut: UpsellStatus;
  montant_estime: number | null;
  created_at: string;
  updated_at: string;
  processed_at: string | null;
  processed_by: string | null;
  etablissement?: {
    id: string;
    nom: string;
  };
}

export type ForecastPeriodType = 'monthly' | 'quarterly' | 'yearly';

export interface CAForecast {
  id: string;
  periode: string;
  type_periode: ForecastPeriodType;
  commercial_id: string | null;
  etablissement_id: string | null;
  montant_prevu: number;
  montant_realise: number | null;
  ecart_pourcentage: number | null;
  facteurs_influence: string[];
  model_version: string;
  created_at: string;
  updated_at: string;
  commercial?: {
    id: string;
    nom: string;
    prenom: string;
  };
}

export type AlertType = 'engagement_drop' | 'payment_delay' | 'support_spike' | 'usage_decline' | 'contract_expiry' | 'custom';
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type AlertStatus = 'active' | 'acknowledged' | 'resolved' | 'dismissed';

// Types stricts pour les données d'alerte proactive
export interface AlertData {
  metric_name?: string;
  current_value?: number;
  threshold?: number;
  previous_value?: number;
  change_percentage?: number;
  days_overdue?: number;
  amount_overdue?: number;
  ticket_count?: number;
  usage_trend?: 'increasing' | 'stable' | 'decreasing';
  contract_end_date?: string;
  days_until_expiry?: number;
  custom_message?: string;
  related_entity_id?: string;
  related_entity_type?: string;
}

export interface ProactiveAlert {
  id: string;
  etablissement_id: string | null;
  type_alerte: AlertType;
  titre: string;
  description: string | null;
  severite: AlertSeverity;
  donnees: AlertData;
  statut: AlertStatus;
  created_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  etablissement?: {
    id: string;
    nom: string;
  };
}

export type RegulatoryReportType = 'ars' | 'has' | 'cnil' | 'ans' | 'custom';
export type RegulatoryReportStatus = 'draft' | 'pending_review' | 'approved' | 'submitted' | 'rejected';

// Types stricts pour les données de rapport réglementaire
export interface RegulatoryReportData {
  periode_debut: string;
  periode_fin: string;
  nb_etablissements?: number;
  nb_utilisateurs?: number;
  incidents_securite?: number;
  conformite_rgpd?: boolean;
  audit_results?: {
    passed: number;
    failed: number;
    pending: number;
  };
  metrics?: {
    name: string;
    value: number | string;
    unit?: string;
  }[];
  notes?: string;
}

export interface RegulatoryReport {
  id: string;
  type_rapport: RegulatoryReportType;
  titre: string;
  periode_debut: string;
  periode_fin: string;
  donnees: RegulatoryReportData;
  statut: RegulatoryReportStatus;
  fichier_path: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  submitted_by: string | null;
}

export interface AnalyticsKPIs {
  total_etablissements: number;
  high_risk_count: number;
  medium_risk_count: number;
  low_risk_count: number;
  average_churn_score: number;
  active_alerts: number;
  pending_upsells: number;
  upsell_potential: number;
  forecasted_ca: number;
  realized_ca: number;
}
