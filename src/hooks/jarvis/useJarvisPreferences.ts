/**
 * useJarvisPreferences - Hook pour gérer les préférences Jarvis
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import type { JarvisPreferences } from '@/types/jarvis'
import { useToast } from '@/hooks/shared/use-toast'
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer'
import { debug } from '@/lib/debug'

const JARVIS_PREFS_KEY = 'jarvis-preferences'

const DEFAULT_PREFERENCES: Omit<JarvisPreferences, 'user_id' | 'created_at' | 'updated_at'> = {
  enabled: true,
  voice_enabled: false,
  proactive_mode: true,
  confidence_threshold: 0.85,
  auto_approve_above: 0.95,
  notification_frequency: 'immediate',
  quiet_hours_enabled: false,
  quiet_hours_start: '22:00',
  quiet_hours_end: '07:00',
  preferred_voice: 'fr-FR-DeniseNeural',
  voice_speed: 1.0,
  wake_word: 'Jarvis',
  formal_tone: true,
  include_sources: true,
  max_actions_per_hour: 20,
  triggers_enabled: {
    new_email: true,
    task_due: true,
    calendar_reminder: true,
    support_ticket: true,
  },
}

export function useJarvisPreferences(userId: string | undefined) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Récupérer les préférences
  const query = useQuery({
    queryKey: [JARVIS_PREFS_KEY, userId],
    queryFn: async () => {
      if (!userId) return null

      const { data, error } = await supabase
        .from('jarvis_preferences')
        .select(
          `
          user_id, enabled, voice_enabled, proactive_mode,
          confidence_threshold, auto_approve_above,
          notification_frequency, quiet_hours_enabled,
          quiet_hours_start, quiet_hours_end,
          preferred_voice, voice_speed, wake_word,
          formal_tone, include_sources, max_actions_per_hour,
          triggers_enabled, created_at, updated_at
        `
        )
        .eq('user_id', userId)
        .maybeSingle()

      if (error) {
        debug.error('[useJarvisPreferences] Error:', error)
        throw error
      }

      // Si pas de préférences, créer les valeurs par défaut
      if (!data) {
        const { data: newData, error: insertError } = await supabase
          .from('jarvis_preferences')
          .insert({ user_id: userId, ...DEFAULT_PREFERENCES })
          .select()
          // safe: guaranteed-row
          .single()

        if (insertError) {
          debug.error('[useJarvisPreferences] Insert error:', insertError)
          return { user_id: userId, ...DEFAULT_PREFERENCES } as JarvisPreferences
        }

        return newData as unknown as JarvisPreferences
      }

      return data as unknown as JarvisPreferences
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Mettre à jour les préférences
  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<JarvisPreferences>) => {
      if (!userId) throw new Error('User not authenticated')

      const { error } = await supabase.from('jarvis_preferences').upsert({
        user_id: userId,
        ...updates,
        updated_at: new Date().toISOString(),
      })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [JARVIS_PREFS_KEY, userId] })
      toast({
        title: 'Préférences sauvegardées',
        description: 'Vos paramètres Jarvis ont été mis à jour',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur',
        description: sanitizeSupabaseError(error),
        variant: 'destructive',
      })
    },
  })

  // Toggle rapide pour enabled
  const toggleEnabled = () => {
    const currentEnabled = query.data?.enabled ?? true
    updateMutation.mutate({ enabled: !currentEnabled })
  }

  // Toggle rapide pour voice
  const toggleVoice = () => {
    const currentVoice = query.data?.voice_enabled ?? false
    updateMutation.mutate({ voice_enabled: !currentVoice })
  }

  // Toggle rapide pour proactive mode
  const toggleProactiveMode = () => {
    const currentProactive = query.data?.proactive_mode ?? true
    updateMutation.mutate({ proactive_mode: !currentProactive })
  }

  return {
    preferences: query.data,
    isLoading: query.isLoading,
    error: query.error,

    updatePreferences: (updates: Partial<JarvisPreferences>) => updateMutation.mutate(updates),
    isUpdating: updateMutation.isPending,

    toggleEnabled,
    toggleVoice,
    toggleProactiveMode,

    isEnabled: query.data?.enabled ?? true,
    isVoiceEnabled: query.data?.voice_enabled ?? false,
    isProactiveMode: query.data?.proactive_mode ?? true,
  }
}
