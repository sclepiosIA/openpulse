import { supabase } from '@/integrations/supabase/client';

/**
 * Service Enquêtes Dashboard (audit Fable 5 · action 180.1).
 */

export interface EnquetesDashboardData {
  formation: any[];
  ces: any[];
  solution: any[];
  csm: any[];
  campagnes: any[];
  v3: SatisfactionV3DashboardRow[];
}

export interface SatisfactionV3DashboardRow {
  source: string | null;
  satisfaction: number | string | null;
  recommendation: number | null;
  created_at: string | null;
}

export const fetchEnquetesDashboard = async (): Promise<EnquetesDashboardData> => {
  const [formation, ces, solution, csm, campagnes, v3] = await Promise.all([
    supabase.from('enquetes_satisfaction_formation').select('*, etablissements(nom)').order('date_reponse', { ascending: false }).limit(500),
    supabase.from('enquetes_ces').select('*, etablissements(nom)').order('date_reponse', { ascending: false }).limit(500),
    supabase.from('enquetes_satisfaction_solution').select('*, etablissements(nom)').order('date_reponse', { ascending: false }).limit(500),
    // La relation profiles n'est pas garantie par le schéma/RLS de cette table et ne sert pas au rendu.
    // Garder uniquement l'établissement évite qu'une jointure optionnelle rende tout le dashboard indisponible.
    supabase.from('enquetes_suivi_csm').select('*, etablissements(nom)').order('date_reponse', { ascending: false }).limit(500),
    supabase.from('enquetes_campagnes').select('*').order('created_at', { ascending: false }).limit(500),
    supabase.from('satisfaction_v3_responses').select('source, satisfaction, recommendation, created_at').order('created_at', { ascending: false }).limit(10000),
  ]);
  const failure = [formation, ces, solution, csm, campagnes, v3].find((result) => result.error);
  if (failure?.error) throw failure.error;
  return {
    formation: formation.data || [],
    ces: ces.data || [],
    solution: solution.data || [],
    csm: csm.data || [],
    campagnes: campagnes.data || [],
    v3: v3.data || [],
  };
};
