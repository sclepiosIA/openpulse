import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CompetencesKPIs } from '@/types/competences';
import { addDays } from 'date-fns';

export function useCompetencesKPIs() {
  return useQuery({
    queryKey: ['competences-kpis'],
    queryFn: async (): Promise<CompetencesKPIs> => {
      // Count total competences in referentiel
      const { count: totalCompetences } = await supabase
        .from('referentiel_competences')
        .select('id', { count: 'exact', head: true })
        .eq('est_actif', true);

      // Count employees with at least one competence
      const { data: employeesWithComp } = await supabase
        .from('employee_competences')
        .select('profile_id')
        .limit(1000);

      const uniqueEmployees = new Set(employeesWithComp?.map(e => e.profile_id) || []);
      const totalEmployeesWithCompetences = uniqueEmployees.size;

      // Average competences per employee
      const { count: totalEmployeeCompetences } = await supabase
        .from('employee_competences')
        .select('id', { count: 'exact', head: true });

      const averageCompetencesPerEmployee = totalEmployeesWithCompetences > 0 
        ? Math.round((totalEmployeeCompetences || 0) / totalEmployeesWithCompetences * 10) / 10
        : 0;

      // Certifications expiring in 30 days
      const in30Days = addDays(new Date(), 30).toISOString().split('T')[0];
      const { count: certExpiring30 } = await supabase
        .from('employee_certifications')
        .select('id', { count: 'exact', head: true })
        .lte('date_expiration', in30Days)
        .gte('date_expiration', new Date().toISOString().split('T')[0])
        .eq('statut', 'valide');

      // Certifications expiring in 90 days
      const in90Days = addDays(new Date(), 90).toISOString().split('T')[0];
      const { count: certExpiring90 } = await supabase
        .from('employee_certifications')
        .select('id', { count: 'exact', head: true })
        .lte('date_expiration', in90Days)
        .gte('date_expiration', new Date().toISOString().split('T')[0])
        .eq('statut', 'valide');

      // Plans en cours
      const { count: plansEnCours } = await supabase
        .from('plans_developpement')
        .select('id', { count: 'exact', head: true })
        .eq('statut', 'en_cours');

      // Average progression of active plans
      const { data: activePlans } = await supabase
        .from('plans_developpement')
        .select('progression')
        .eq('statut', 'en_cours');

      const progressionMoyenne = activePlans && activePlans.length > 0
        ? Math.round(activePlans.reduce((sum, p) => sum + (p.progression || 0), 0) / activePlans.length)
        : 0;

      return {
        totalCompetences: totalCompetences || 0,
        totalEmployeesWithCompetences,
        averageCompetencesPerEmployee,
        certificationExpiringIn30Days: certExpiring30 || 0,
        certificationExpiringIn90Days: certExpiring90 || 0,
        plansEnCours: plansEnCours || 0,
        progressionMoyenne,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
