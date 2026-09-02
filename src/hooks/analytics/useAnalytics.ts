/**
 * Hooks pour le Module 9: Prédiction & Analytics Avancés
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/shared/use-toast';
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import type { Json } from '@/integrations/supabase/types';
import { useAuth } from "@/components/AuthProvider";
import type {
  ChurnPrediction,
  ClientSegment,
  UpsellRecommendation,
  CAForecast,
  ProactiveAlert,
  RegulatoryReport,
  RegulatoryReportData,
  RegulatoryReportType,
  AnalyticsKPIs,
  RiskLevel,
  UpsellStatus,
  AlertStatus,
  RegulatoryReportStatus,
} from '@/types/analytics';

// ===== CHURN PREDICTIONS =====

export function useChurnPredictions() {
  return useQuery({
    queryKey: ['churn-predictions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('churn_predictions')
        .select(`
          *,
          etablissement:etablissements(id, nom, statut)
        `)
        .order('score', { ascending: false });

      if (error) throw error;
      return data as unknown as ChurnPrediction[];
    }
  });
}

export function useChurnPredictionsByRisk(riskLevel: RiskLevel) {
  return useQuery({
    queryKey: ['churn-predictions', 'risk', riskLevel],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('churn_predictions')
        .select(`
          *,
          etablissement:etablissements(id, nom, statut)
        `)
        .eq('risk_level', riskLevel)
        .order('score', { ascending: false });

      if (error) throw error;
      return data as unknown as ChurnPrediction[];
    }
  });
}

// ===== CLIENT SEGMENTS =====

export function useClientSegments() {
  return useQuery({
    queryKey: ['client-segments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_segments')
        .select('id, nom, description, criteres, couleur, est_actif, created_at, updated_at')
        .order('nom')
        .limit(200);

      if (error) throw error;
      return data as ClientSegment[];
    }
  });
}

export function useCreateSegment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (segment: Omit<ClientSegment, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('client_segments')
        .insert({
          nom: segment.nom,
          description: segment.description,
          criteres: segment.criteres as unknown as Json,
          couleur: segment.couleur,
          est_actif: segment.est_actif
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-segments'] });
      toast({ title: 'Segment créé avec succès' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: sanitizeSupabaseError(error), variant: 'destructive' });
    }
  });
}

export function useAssignSegment() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ etablissement_id, segment_id, score_appartenance }: {
      etablissement_id: string;
      segment_id: string;
      score_appartenance?: number;
    }) => {
      
      
      const { data, error } = await supabase
        .from('etablissement_segments')
        .upsert({
          etablissement_id,
          segment_id,
          score_appartenance: score_appartenance || 100,
          assigned_by: user?.id
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['etablissement-segments'] });
      toast({ title: 'Segment assigné' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: sanitizeSupabaseError(error), variant: 'destructive' });
    }
  });
}

// ===== UPSELL RECOMMENDATIONS =====

export function useUpsellRecommendations(status?: UpsellStatus) {
  return useQuery({
    queryKey: ['upsell-recommendations', status],
    queryFn: async () => {
      let query = supabase
        .from('upsell_recommendations')
        .select(`
          *,
          etablissement:etablissements(id, nom)
        `)
        .order('score_confiance', { ascending: false });

      if (status) {
        query = query.eq('statut', status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as UpsellRecommendation[];
    }
  });
}

export function useUpdateUpsellStatus() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, statut }: { id: string; statut: UpsellStatus }) => {
      
      
      const { data, error } = await supabase
        .from('upsell_recommendations')
        .update({
          statut,
          processed_at: new Date().toISOString(),
          processed_by: user?.id
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['upsell-recommendations'] });
      toast({ title: 'Statut mis à jour' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: sanitizeSupabaseError(error), variant: 'destructive' });
    }
  });
}

// ===== CA FORECASTS =====

export function useCAForecasts(typePeriode?: string) {
  return useQuery({
    queryKey: ['ca-forecasts', typePeriode],
    queryFn: async () => {
      let query = supabase
        .from('ca_forecasts')
        .select('id, etablissement_id, commercial_id, periode, type_periode, montant_prevu, montant_realise, ecart_pourcentage, facteurs_influence, model_version, created_at, updated_at')
        .order('periode', { ascending: false })
        .limit(500);

      if (typePeriode) {
        query = query.eq('type_periode', typePeriode);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as CAForecast[];
    }
  });
}

// ===== PROACTIVE ALERTS =====

export function useProactiveAlerts(status?: AlertStatus) {
  return useQuery({
    queryKey: ['proactive-alerts', status],
    queryFn: async () => {
      let query = supabase
        .from('proactive_alerts')
        .select(`
          *,
          etablissement:etablissements(id, nom)
        `)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('statut', status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ProactiveAlert[];
    }
  });
}

export function useUpdateAlertStatus() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, statut }: { id: string; statut: AlertStatus }) => {
      
      const now = new Date().toISOString();
      
      // Type strict pour les mises à jour d'alerte
      interface AlertUpdate {
        statut: AlertStatus;
        acknowledged_at?: string;
        acknowledged_by?: string;
        resolved_at?: string;
        resolved_by?: string;
      }
      
      const updates: AlertUpdate = { statut };
      
      if (statut === 'acknowledged') {
        updates.acknowledged_at = now;
        updates.acknowledged_by = user?.id;
      } else if (statut === 'resolved') {
        updates.resolved_at = now;
        updates.resolved_by = user?.id;
      }

      const { data, error } = await supabase
        .from('proactive_alerts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proactive-alerts'] });
      toast({ title: 'Alerte mise à jour' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: sanitizeSupabaseError(error), variant: 'destructive' });
    }
  });
}

// ===== REGULATORY REPORTS =====

export function useRegulatoryReports() {
  return useQuery({
    queryKey: ['regulatory-reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('regulatory_reports')
        .select('id, titre, type_rapport, statut, periode_debut, periode_fin, donnees, fichier_path, created_by, submitted_at, submitted_by, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      return (data || []).map(report => ({
        ...report,
        donnees: report.donnees as unknown as RegulatoryReportData,
        statut: report.statut as RegulatoryReportStatus,
        type_rapport: report.type_rapport as RegulatoryReportType,
        created_at: report.created_at || '',
        updated_at: report.updated_at || '',
      })) as RegulatoryReport[];
    }
  });
}

export function useCreateRegulatoryReport() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (report: Omit<RegulatoryReport, 'id' | 'created_at' | 'updated_at' | 'submitted_at' | 'submitted_by'>) => {
      const { data, error } = await supabase
        .from('regulatory_reports')
        .insert({
          type_rapport: report.type_rapport,
          titre: report.titre,
          periode_debut: report.periode_debut,
          periode_fin: report.periode_fin,
          donnees: report.donnees as unknown as Json,
          statut: report.statut,
          fichier_path: report.fichier_path,
          created_by: report.created_by
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['regulatory-reports'] });
      toast({ title: 'Rapport créé avec succès' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: sanitizeSupabaseError(error), variant: 'destructive' });
    }
  });
}

export function useUpdateReportStatus() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, statut }: { id: string; statut: RegulatoryReportStatus }) => {
      
      
      // Type strict pour les mises à jour de rapport
      interface ReportUpdate {
        statut: RegulatoryReportStatus;
        submitted_at?: string;
        submitted_by?: string;
      }
      
      const updates: ReportUpdate = { statut };
      
      if (statut === 'submitted') {
        updates.submitted_at = new Date().toISOString();
        updates.submitted_by = user?.id;
      }

      const { data, error } = await supabase
        .from('regulatory_reports')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['regulatory-reports'] });
      toast({ title: 'Statut mis à jour' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: sanitizeSupabaseError(error), variant: 'destructive' });
    }
  });
}

// ===== ANALYTICS KPIs =====

export function useAnalyticsKPIs() {
  return useQuery({
    queryKey: ['analytics-kpis'],
    queryFn: async () => {
      // Use RPC to avoid exposing churn_predictions, proactive_alerts, etc.
      const { data, error } = await supabase.rpc('get_analytics_overview' as never);
      if (error) throw error;

      const result = data as Record<string, number>;
      return {
        total_etablissements: result.total_etablissements || 0,
        high_risk_count: result.high_risk_count || 0,
        medium_risk_count: result.medium_risk_count || 0,
        low_risk_count: result.low_risk_count || 0,
        average_churn_score: result.average_churn_score || 0,
        active_alerts: result.active_alerts || 0,
        pending_upsells: result.pending_upsells || 0,
        upsell_potential: result.upsell_potential || 0,
        forecasted_ca: result.forecasted_ca || 0,
        realized_ca: result.realized_ca || 0,
      } as AnalyticsKPIs;
    }
  });
}
