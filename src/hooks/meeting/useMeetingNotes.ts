import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_URL } from '@/lib/supabaseBrowser';
import { useToast } from '@/hooks/shared/use-toast';
import { useAuth } from '@/hooks/shared/useAuth';
import type { TranscriptionSessionWithDetails, TranscriptionNextStep } from '@/types/transcription';

export interface MeetingNotesFilters {
  status?: string;
  search?: string;
  etablissementId?: string;
}

export interface UploadOptions {
  title: string;
  language?: string;
  etablissementId?: string;
  partenaireId?: string;
  groupeId?: string;
}

export function useMeetingNotes(filters?: MeetingNotesFilters) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploadProgress, setUploadProgress] = useState<{ status: 'idle' | 'uploading' | 'processing' | 'done' | 'error'; message: string }>({ status: 'idle', message: '' });

  // List sessions
  const { data: sessions = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['meeting-notes', filters],
    queryFn: async () => {
      let query = supabase
        .from('visio_transcription_sessions')
        .select('id, title, status, summary, decisions, next_steps, full_transcript, language, created_at, created_by, started_at, ended_at, etablissement_id, partenaire_id, groupe_id, room_code, calendar_event_id, conversation_id, external_meeting_url, updated_at')
        .order('created_at', { ascending: false })
        .limit(100);

      // Only show uploaded notes (no room_code = not a live visio session)
      query = query.is('room_code', null);

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters?.etablissementId) {
        query = query.eq('etablissement_id', filters.etablissementId);
      }
      if (filters?.search) {
        query = query.ilike('title', `%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map(s => ({
        ...s,
        decisions: Array.isArray(s.decisions) ? s.decisions : [],
        next_steps: Array.isArray(s.next_steps) ? s.next_steps : [],
      })) as unknown as TranscriptionSessionWithDetails[];
    },
    enabled: !!user,
  });

  // Get single session
  const getSession = useCallback(async (sessionId: string): Promise<TranscriptionSessionWithDetails | null> => {
    const { data, error } = await supabase
      .from('visio_transcription_sessions')
      .select('id, title, status, summary, decisions, next_steps, full_transcript, language, created_at, created_by, started_at, ended_at, etablissement_id, partenaire_id, groupe_id, room_code, calendar_event_id, conversation_id, external_meeting_url, updated_at')
      .eq('id', sessionId)
      .maybeSingle();

    if (error || !data) return null;
    return {
      ...data,
      decisions: Array.isArray(data.decisions) ? data.decisions : [],
      next_steps: Array.isArray(data.next_steps) ? data.next_steps : [],
    } as unknown as TranscriptionSessionWithDetails;
  }, []);

  // Upload & process
  const uploadAndProcess = useCallback(async (file: File, options: UploadOptions) => {
    if (!user) throw new Error('Non authentifié');

    setUploadProgress({ status: 'uploading', message: 'Envoi du fichier audio...' });

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', options.title);
      formData.append('language', options.language || 'fr');
      formData.append('userId', user.id);
      if (options.etablissementId) formData.append('etablissementId', options.etablissementId);
      if (options.partenaireId) formData.append('partenaireId', options.partenaireId);
      if (options.groupeId) formData.append('groupeId', options.groupeId);

      setUploadProgress({ status: 'processing', message: 'Transcription et analyse IA en cours...' });

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/meeting-notes-process`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Erreur serveur' }));
        throw new Error(err.error || `Erreur ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Échec du traitement');

      setUploadProgress({ status: 'done', message: 'Traitement terminé !' });
      queryClient.invalidateQueries({ queryKey: ['meeting-notes'] });

      toast({
        title: 'Note de réunion créée',
        description: `${result.segmentsCount} segments transcrits, résumé généré.`,
      });

      // Auto-reset
      setTimeout(() => setUploadProgress({ status: 'idle', message: '' }), 3000);

      return result.sessionId as string;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setUploadProgress({ status: 'error', message });
      toast({
        title: 'Erreur',
        description: message,
        variant: 'destructive',
      });
      setTimeout(() => setUploadProgress({ status: 'idle', message: '' }), 5000);
      return null;
    }
  }, [user, toast, queryClient]);

  // Create task from next step
  const createTaskFromStep = useCallback(async (
    step: TranscriptionNextStep,
    etablissementId?: string,
    categorieId?: string,
  ) => {
    if (!user) return;

    // Get a default category if none provided
    let catId = categorieId;
    if (!catId) {
      const { data: defaultCat } = await supabase
        .from('categories_taches')
        .select('id')
        .limit(1)
        .single();
      catId = defaultCat?.id;
    }
    if (!catId) {
      toast({ title: 'Erreur', description: 'Aucune catégorie de tâche disponible', variant: 'destructive' });
      return;
    }

    const { error } = await supabase
      .from('taches')
      .insert({
        titre: step.task,
        description: `Tâche issue d'une note de réunion.\nAssigné à: ${step.assignee || 'Non défini'}`,
        etablissement_id: etablissementId || null,
        categorie_id: catId,
        echeance: step.deadline || null,
      });

    if (error) {
      toast({ title: 'Erreur', description: 'Impossible de créer la tâche', variant: 'destructive' });
      throw error;
    }

    toast({ title: 'Tâche créée', description: step.task });
    queryClient.invalidateQueries({ queryKey: ['taches'] });
  }, [user, toast, queryClient]);

  // Create calendar event from next step
  const createEventFromStep = useCallback(async (
    step: TranscriptionNextStep,
    calendarId: string,
    etablissementId?: string,
  ) => {
    if (!user || !step.deadline) return;

    const startTime = new Date(step.deadline);
    startTime.setHours(9, 0, 0, 0);
    const endTime = new Date(startTime);
    endTime.setHours(10, 0, 0, 0);

    const { error } = await supabase
      .from('calendar_events')
      .insert({
        title: step.task,
        description: `Événement issu d'une note de réunion.\nAssigné à: ${step.assignee || 'Non défini'}`,
        calendar_id: calendarId,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        etablissement_id: etablissementId || null,
        created_by: user.id,
      });

    if (error) {
      toast({ title: 'Erreur', description: 'Impossible de créer l\'événement', variant: 'destructive' });
      throw error;
    }

    toast({ title: 'Événement créé', description: step.task });
    queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
  }, [user, toast, queryClient]);

  return {
    sessions,
    isLoading,
    isError,
    error,
    refetch,
    uploadProgress,
    uploadAndProcess,
    getSession,
    createTaskFromStep,
    createEventFromStep,
  };
}
