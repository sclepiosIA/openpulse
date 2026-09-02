import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseBrowser'
import { toast } from 'sonner'
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer'

// Types pour les différentes actions possibles
export interface CreateTaskActionData {
  title: string
  description?: string
  priority?: string
  deadline?: string
  category?: string
}

export interface UpdateTaskActionData {
  task_id: string
  title: string
  status?: string
  priority?: string
}

export interface SendEmailActionData {
  title?: string
  to: string
  subject: string
  body: string
}

export interface ScheduleFollowUpActionData {
  title: string
  date: string
  type: string
  note?: string
}

export interface GenericActionData {
  title?: string
  [key: string]: unknown
}

export type ActionData =
  | CreateTaskActionData
  | UpdateTaskActionData
  | SendEmailActionData
  | ScheduleFollowUpActionData
  | GenericActionData

export interface AISuggestion {
  id: string
  email_thread_id: string
  etablissement_id: string
  partenaire_id?: string
  action_type: string
  action_data: ActionData
  confidence_score: number
  status: 'pending' | 'approved' | 'rejected'
  reason: string
  created_at: string
  reviewed_by?: string
  reviewed_at?: string
  etablissement?: {
    nom: string
    ville?: string
  }
  email_thread?: {
    subject: string
    last_message_date: string
  }
}

// Types d'actions CRM
export const CRM_ACTION_TYPES = [
  'send_email_response',
  'schedule_follow_up',
  'update_engagement_score',
  'create_activity_note',
  'suggest_meeting',
]

// Types d'actions opérationnelles
export const OPERATIONAL_ACTION_TYPES = [
  'update_task',
  'create_task',
  'change_status',
  'update_summary',
]

/**
 * Extrait les mots-clés significatifs d'un titre (ignore les stop words)
 */
function extractKeywords(title: string): string[] {
  const stopWords = [
    'suivre',
    'confirmer',
    'relancer',
    'vérifier',
    'organiser',
    'planifier',
    'le',
    'la',
    'les',
    'de',
    'du',
    'des',
    'pour',
    'avec',
    'sur',
    'dans',
    'un',
    'une',
    'et',
    'ou',
    'mais',
    'donc',
    'car',
    'si',
    'que',
    'qui',
  ]

  return title
    .toLowerCase()
    .replace(/[^\w\sàéèêëïîôùûç]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopWords.includes(w))
    .sort()
}

/**
 * Vérifie si deux suggestions sont sémantiquement similaires
 */
function areSuggestionsSimilar(s1: AISuggestion, s2: AISuggestion): boolean {
  if (s1.action_type !== s2.action_type) return false

  const getTitle = (data: ActionData): string => {
    if ('title' in data && typeof data.title === 'string') return data.title
    return ''
  }

  const kw1 = extractKeywords(getTitle(s1.action_data))
  const kw2 = extractKeywords(getTitle(s2.action_data))

  if (kw1.length === 0 || kw2.length === 0) return false

  const commonWords = kw1.filter((w) => kw2.includes(w))
  const similarityRatio = commonWords.length / Math.max(kw1.length, kw2.length)

  return similarityRatio >= 0.6
}

/**
 * Groupe les suggestions similaires ensemble
 */
function groupSimilarSuggestions(suggestions: AISuggestion[]): {
  primary: AISuggestion
  similar: AISuggestion[]
}[] {
  const groups: { primary: AISuggestion; similar: AISuggestion[] }[] = []
  const processed = new Set<string>()

  for (const sugg of suggestions) {
    if (processed.has(sugg.id)) continue

    const similar = suggestions.filter(
      (s) => !processed.has(s.id) && s.id !== sugg.id && areSuggestionsSimilar(sugg, s)
    )

    groups.push({ primary: sugg, similar })
    processed.add(sugg.id)
    similar.forEach((s) => processed.add(s.id))
  }

  return groups
}

export function useAISuggestions(etablissementId?: string, filterType?: 'crm' | 'operational') {
  const queryClient = useQueryClient()

  const removeSuggestionFromCaches = (suggestionId: string) => {
    queryClient.setQueriesData<AISuggestion[]>(
      { queryKey: ['ai-suggestions'], exact: false },
      (current) => current?.filter((suggestion) => suggestion.id !== suggestionId) ?? current
    )
  }

  const { data: rawSuggestions = [], isLoading } = useQuery({
    queryKey: ['ai-suggestions', etablissementId, filterType],
    queryFn: async () => {
      let query = supabase
        .from('ai_suggested_actions')
        .select(
          `
          *,
          etablissement:etablissements!etablissement_id(nom, ville),
          email_thread:email_threads!email_thread_id(subject, last_message_date)
        `
        )
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (etablissementId) {
        query = query.eq('etablissement_id', etablissementId)
      }

      const { data, error } = await query
      if (error) throw error

      // Filtrer par type si spécifié
      let filteredData = data as AISuggestion[]
      if (filterType === 'crm') {
        filteredData = filteredData.filter((s) => CRM_ACTION_TYPES.includes(s.action_type))
      } else if (filterType === 'operational') {
        filteredData = filteredData.filter((s) => OPERATIONAL_ACTION_TYPES.includes(s.action_type))
      }

      return filteredData
    },
    enabled: true,
  })

  // Grouper les suggestions similaires
  const suggestionGroups = groupSimilarSuggestions(rawSuggestions)

  const approveSuggestion = useMutation({
    mutationFn: async (suggestionId: string) => {
      if (!suggestionId) throw new Error('Suggestion ciblée introuvable')

      const { data, error } = await supabase.functions.invoke('apply-ai-suggestion', {
        body: { suggestion_id: suggestionId },
      })

      if (error) throw error
      return data
    },
    onSuccess: (_data, suggestionId) => {
      toast.success('Suggestion appliquée avec succès')
      removeSuggestionFromCaches(suggestionId)
      queryClient.invalidateQueries({ queryKey: ['etablissements'] })
      queryClient.invalidateQueries({ queryKey: ['taches'] })
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error))
    },
  })

  const rejectSuggestion = useMutation({
    mutationFn: async (suggestionId: string) => {
      if (!suggestionId) throw new Error('Suggestion ciblée introuvable')

      const { data, error } = await supabase
        .from('ai_suggested_actions')
        .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
        .eq('id', suggestionId)
        .eq('status', 'pending')
        .select('id')
        // safe: guaranteed-row
        .single()

      if (error) throw error
      if (data?.id !== suggestionId) {
        throw new Error('La suggestion ignorée ne correspond pas à la suggestion ciblée')
      }
    },
    onSuccess: (_data, suggestionId) => {
      toast.success('Suggestion rejetée')
      removeSuggestionFromCaches(suggestionId)
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error))
    },
  })

  const approveSuggestionAndRejectSimilar = useMutation({
    mutationFn: async ({ primaryId, similarIds }: { primaryId: string; similarIds: string[] }) => {
      // Appliquer la principale
      const { data, error: applyError } = await supabase.functions.invoke('apply-ai-suggestion', {
        body: { suggestion_id: primaryId },
      })
      if (applyError) throw applyError

      // Rejeter les similaires
      if (similarIds.length > 0) {
        const { error: rejectError } = await supabase
          .from('ai_suggested_actions')
          .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
          .in('id', similarIds)
        if (rejectError) throw rejectError
      }

      return data
    },
    onSuccess: () => {
      toast.success('Suggestion appliquée et similaires ignorées')
      queryClient.invalidateQueries({ queryKey: ['ai-suggestions'] })
      queryClient.invalidateQueries({ queryKey: ['etablissements'] })
      queryClient.invalidateQueries({ queryKey: ['taches'] })
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error))
    },
  })

  return {
    suggestions: rawSuggestions,
    suggestionGroups,
    isLoading,
    approveSuggestion: approveSuggestion.mutate,
    rejectSuggestion: rejectSuggestion.mutate,
    approveSuggestionAsync: approveSuggestion.mutateAsync,
    rejectSuggestionAsync: rejectSuggestion.mutateAsync,
    approveSuggestionAndRejectSimilar: approveSuggestionAndRejectSimilar.mutate,
    isApproving: approveSuggestion.isPending,
    isRejecting: rejectSuggestion.isPending,
  }
}
