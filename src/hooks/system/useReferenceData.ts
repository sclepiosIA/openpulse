/**
 * Hook centralisé pour accéder aux données de référence
 * Remplace toutes les listes hardcodées (statuts, types, régions, DPI, rôles, etc.)
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/shared/use-toast';
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';

export interface ReferenceDataRow {
  id: string;
  type: string;
  code: string;
  label: string;
  color: string | null;
  ordre: number;
  metadata: Record<string, any>;
  active: boolean;
  created_at: string;
  updated_at: string;
}

// Fetch all reference data (cached aggressively)
export function useAllReferenceData() {
  return useQuery({
    queryKey: ['reference-data'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reference_data')
        .select('id, type, code, label, color, ordre, metadata, active, created_at, updated_at')
        .eq('active', true)
        .order('ordre');
      if (error) throw error;
      return data as ReferenceDataRow[];
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

// Get reference data by type
export function useReferenceDataByType(type: string) {
  const { data: allData, ...rest } = useAllReferenceData();
  const filtered = allData?.filter(d => d.type === type) || [];
  return { ...rest, data: filtered };
}

// Typed helpers
export function useStatutsEtablissement() {
  return useReferenceDataByType('statut_etablissement');
}

export function useTypesEtablissement() {
  return useReferenceDataByType('type_etablissement');
}

export function useDpiList() {
  return useReferenceDataByType('dpi');
}

export function useRegions() {
  return useReferenceDataByType('region');
}

export function useRolesReference() {
  return useReferenceDataByType('role');
}

export function useTypesOffre() {
  return useReferenceDataByType('type_offre');
}

export function usePalliers() {
  return useReferenceDataByType('pallier');
}

export function useDureesPhases() {
  return useReferenceDataByType('duree_phase');
}

export function usePhasesReference() {
  return useReferenceDataByType('phase');
}

// Helper: get status style from reference data
export function getStatusStyleFromRef(ref: ReferenceDataRow) {
  return {
    badgeVariant: ref.metadata?.badge_variant || 'outline',
    borderColor: ref.metadata?.border_color || 'border-l-muted',
    bgColor: ref.metadata?.bg_color || 'bg-muted/50',
    textColor: ref.metadata?.text_color || 'text-muted-foreground',
    phase: ref.metadata?.phase || 'commercial',
  };
}

// Helper: get statuts for a given phase
export function getStatutsByPhase(statuts: ReferenceDataRow[], phase: string) {
  return statuts.filter(s => s.metadata?.phase === phase);
}

// Mutations
export function useUpdateReferenceData() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (item: Partial<ReferenceDataRow> & { id: string }) => {
      const { id, ...updates } = item;
      const { error } = await supabase
        .from('reference_data')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reference-data'] });
      toast({ title: 'Donnée de référence mise à jour' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: sanitizeSupabaseError(error), variant: 'destructive' });
    },
  });
}

export function useCreateReferenceData() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (item: Omit<ReferenceDataRow, 'id' | 'created_at' | 'updated_at'>) => {
      const { error } = await supabase
        .from('reference_data')
        .insert(item);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reference-data'] });
      toast({ title: 'Donnée de référence créée' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: sanitizeSupabaseError(error), variant: 'destructive' });
    },
  });
}

export function useDeleteReferenceData() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('reference_data')
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reference-data'] });
      toast({ title: 'Donnée désactivée' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: sanitizeSupabaseError(error), variant: 'destructive' });
    },
  });
}
