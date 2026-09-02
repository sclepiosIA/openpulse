import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';

export interface SequenceStep {
  delay_days: number;
  subject: string;
  body_html: string;
  condition?: 'no_reply' | 'always';
}

export interface EmailSequence {
  id: string;
  nom: string;
  description: string | null;
  etapes: SequenceStep[];
  statut: 'draft' | 'active' | 'paused' | 'archived';
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SequenceEnrollment {
  id: string;
  sequence_id: string;
  etablissement_id: string;
  contact_email: string;
  contact_name: string | null;
  etape_courante: number;
  statut: 'active' | 'paused' | 'completed' | 'cancelled' | 'bounced';
  prochaine_action_at: string | null;
  derniere_action_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  etablissement?: { id: string; nom: string };
}

export function useEmailSequences() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['email-sequences'],
    queryFn: async (): Promise<EmailSequence[]> => {
      const { data, error } = await supabase
        .from('email_sequences')
        .select('id, nom, description, etapes, statut, created_by, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data as unknown as EmailSequence[]) ?? [];
    },
    enabled: !!user,
  });
}

export function useSequenceEnrollments(sequenceId?: string) {
  return useQuery({
    queryKey: ['sequence-enrollments', sequenceId],
    queryFn: async (): Promise<SequenceEnrollment[]> => {
      let query = supabase
        .from('email_sequence_enrollments')
        .select('*, etablissement:etablissements(id, nom)')
        .order('created_at', { ascending: false });
      
      if (sequenceId) {
        query = query.eq('sequence_id', sequenceId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as unknown as SequenceEnrollment[]) ?? [];
    },
    enabled: !!sequenceId,
  });
}

export function useCreateSequence() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: { nom: string; description?: string; etapes: SequenceStep[] }) => {
      const { data: result, error } = await supabase
        .from('email_sequences')
        .insert([{
          nom: data.nom,
          description: data.description || null,
          etapes: data.etapes as unknown as import('@/integrations/supabase/types').Json,
          statut: 'draft',
          created_by: user?.id,
        }])
        .select()
        // safe: guaranteed-row
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-sequences'] });
      toast.success('Séquence créée avec succès');
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });
}

export function useUpdateSequence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; nom?: string; description?: string; etapes?: SequenceStep[]; statut?: string }) => {
      const payload = { ...data, etapes: data.etapes ? (data.etapes as unknown as import('@/integrations/supabase/types').Json) : undefined };
      const { error } = await supabase
        .from('email_sequences')
        .update(payload)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-sequences'] });
      toast.success('Séquence mise à jour');
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });
}

export function useDeleteSequence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('email_sequences')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-sequences'] });
      toast.success('Séquence supprimée');
    },
  });
}

export function useEnrollInSequence() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      sequence_id: string;
      etablissement_id: string;
      contact_email: string;
      contact_name?: string;
    }) => {
      // Calculate first action time based on step 0 delay (seq may be null if deleted)
      const { data: seq } = await supabase
        .from('email_sequences')
        .select('etapes')
        .eq('id', data.sequence_id)
        .maybeSingle();

      const steps = (seq?.etapes as unknown as SequenceStep[]) || [];
      const firstDelay = steps[0]?.delay_days || 0;
      const prochaine = new Date(Date.now() + firstDelay * 24 * 60 * 60 * 1000).toISOString();

      const { error } = await supabase
        .from('email_sequence_enrollments')
        .insert({
          ...data,
          contact_name: data.contact_name || null,
          etape_courante: 0,
          statut: 'active',
          prochaine_action_at: prochaine,
          created_by: user?.id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sequence-enrollments'] });
      toast.success('Contact inscrit dans la séquence');
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });
}

export function useCancelEnrollment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('email_sequence_enrollments')
        .update({ statut: 'cancelled' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sequence-enrollments'] });
      toast.success('Inscription annulée');
    },
  });
}
