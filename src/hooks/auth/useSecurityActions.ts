import { supabase } from '@/integrations/supabase/client';

/**
 * Hook for security scan and database export actions.
 * Extracted from GestionSecurite.tsx and GestionBaseDonnees.tsx.
 */
export function useAdminDataActions() {
  const runSecurityScan = async (): Promise<{ success: boolean }> => {
    // Test DB connection
    const { error } = await supabase.from('profiles').select('id').limit(1);
    if (error) throw error;

    // Log the scan
    await supabase.from('system_stats').insert({
      metric_name: 'security_scan',
      metric_value: new Date().toISOString(),
      metric_type: 'event'
    });

    return { success: true };
  };

  const exportDatabase = async (): Promise<{
    etablissements: unknown[];
    taches: unknown[];
    contacts: unknown[];
    exportedAt: string;
  }> => {
    const { data: etablissements } = await supabase.from('etablissements').select('id, nom, ville, statut, created_at').limit(5000);
    const { data: taches } = await supabase.from('taches').select('id, titre, statut, priorite, etablissement_id, assigned_to, created_at').limit(5000);
    const { data: contacts } = await supabase.from('contacts').select('id, nom, prenom, email, telephone, fonction, etablissement_id, created_at').limit(5000);

    return {
      etablissements: etablissements || [],
      taches: taches || [],
      contacts: contacts || [],
      exportedAt: new Date().toISOString()
    };
  };

  return { runSecurityScan, exportDatabase };
}
