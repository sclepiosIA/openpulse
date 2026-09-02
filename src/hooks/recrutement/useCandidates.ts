import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer'
import type { Candidate, CandidateStatus } from '@/types/recrutement'
import { useAuth } from '@/components/AuthProvider'
import { sanitizePostgrestValue } from '@/lib/sanitize'

const RECRUTEMENT_QUERY_TIMEOUT_MS = 8000

async function withRecrutementTimeout<T>(promise: PromiseLike<T>, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () =>
            reject(
              new Error(
                `Délai dépassé lors du chargement des ${label} (${RECRUTEMENT_QUERY_TIMEOUT_MS / 1000}s)`
              )
            ),
          RECRUTEMENT_QUERY_TIMEOUT_MS
        )
      }),
    ])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

export function useCandidates(filters?: {
  jobOfferId?: string
  status?: CandidateStatus[]
  search?: string
}) {
  const { user, loading: authLoading } = useAuth()

  return useQuery({
    queryKey: ['candidates', filters, user?.id],
    enabled: !authLoading && !!user?.id,
    retry: false,
    queryFn: async () => {
      let query = supabase
        .from('candidates')
        .select(
          `
          id, job_offer_id, prenom, nom, email, telephone, linkedin_url, portfolio_url,
          statut, source, source_detail, annees_experience, salaire_souhaite, disponibilite,
          date_disponibilite, competences, notes, note_globale, tags, assignee_id, cooptation_par,
          date_candidature, date_derniere_action, date_embauche, created_at, updated_at,
          job_offer:job_offers!candidates_job_offer_id_fkey(id, titre, type_contrat)
        `
        )
        .limit(200)
        .order('date_candidature', { ascending: false })

      if (filters?.jobOfferId) {
        query = query.eq('job_offer_id', filters.jobOfferId)
      }

      if (filters?.status && filters.status.length > 0) {
        query = query.in('statut', filters.status)
      }

      if (filters?.search) {
        query = query.or(
          `nom.ilike.%${sanitizePostgrestValue(filters.search)}%,prenom.ilike.%${sanitizePostgrestValue(filters.search)}%,email.ilike.%${sanitizePostgrestValue(filters.search)}%`
        )
      }

      const { data, error } = await withRecrutementTimeout(query, 'candidats')

      if (error) throw error
      return (data || []) as unknown as Candidate[]
    },
  })
}

export function useCandidate(id: string | undefined) {
  return useQuery({
    queryKey: ['candidate', id],
    queryFn: async () => {
      if (!id) return null

      const { data, error } = await supabase
        .from('candidates')
        .select(
          `
          id, job_offer_id, prenom, nom, email, telephone, linkedin_url, portfolio_url,
          statut, source, source_detail, annees_experience, salaire_souhaite, disponibilite,
          date_disponibilite, competences, notes, note_globale, tags, assignee_id, cooptation_par,
          date_candidature, date_derniere_action, date_embauche, created_at, updated_at,
          job_offer:job_offers!candidates_job_offer_id_fkey(id, titre, type_contrat, departement),
          assignee:profiles!candidates_assignee_id_fkey(id, prenom, nom, avatar_url)
        `
        )
        .eq('id', id)
        .maybeSingle()

      if (error) throw error
      return data ? (data as unknown as Candidate) : null
    },
    enabled: !!id,
  })
}

export function useCreateCandidate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (candidate: Partial<Candidate>) => {
      const { data, error } = await supabase
        .from('candidates')
        .insert({
          job_offer_id: candidate.job_offer_id!,
          prenom: candidate.prenom || '',
          nom: candidate.nom || '',
          email: candidate.email || '',
          telephone: candidate.telephone,
          linkedin_url: candidate.linkedin_url,
          portfolio_url: candidate.portfolio_url,
          statut: candidate.statut || 'new',
          source: candidate.source,
          source_detail: candidate.source_detail,
          annees_experience: candidate.annees_experience,
          salaire_souhaite: candidate.salaire_souhaite,
          disponibilite: candidate.disponibilite,
          date_disponibilite: candidate.date_disponibilite,
          competences: candidate.competences,
          notes: candidate.notes,
          tags: candidate.tags,
          assignee_id: candidate.assignee_id,
          cooptation_par: candidate.cooptation_par,
        })
        .select(
          'id, job_offer_id, prenom, nom, email, telephone, statut, source, assignee_id, date_candidature, created_at, updated_at'
        )
        // safe: guaranteed-row
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
      queryClient.invalidateQueries({ queryKey: ['job-offers-kpis'] })
      toast.success('Candidat ajouté')
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error))
    },
  })
}

export function useUpdateCandidate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Candidate> & { id: string }) => {
      const { data, error } = await supabase
        .from('candidates')
        .update({
          prenom: updates.prenom,
          nom: updates.nom,
          email: updates.email,
          telephone: updates.telephone,
          linkedin_url: updates.linkedin_url,
          portfolio_url: updates.portfolio_url,
          statut: updates.statut,
          source: updates.source,
          source_detail: updates.source_detail,
          annees_experience: updates.annees_experience,
          salaire_souhaite: updates.salaire_souhaite,
          disponibilite: updates.disponibilite,
          date_disponibilite: updates.date_disponibilite,
          competences: updates.competences,
          notes: updates.notes,
          note_globale: updates.note_globale,
          tags: updates.tags,
          assignee_id: updates.assignee_id,
          date_derniere_action: new Date().toISOString(),
        })
        .eq('id', id)
        .select(
          'id, job_offer_id, prenom, nom, email, telephone, statut, source, assignee_id, note_globale, tags, date_derniere_action, created_at, updated_at'
        )
        // safe: guaranteed-row
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
      queryClient.invalidateQueries({ queryKey: ['candidate', variables.id] })
      queryClient.invalidateQueries({ queryKey: ['job-offers-kpis'] })
      toast.success('Candidat mis à jour')
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error))
    },
  })
}

export function useUpdateCandidateStatus() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: CandidateStatus }) => {
      // Get current status for history (may be null if just deleted by another user)
      const { data: current } = await supabase
        .from('candidates')
        .select('statut')
        .eq('id', id)
        .maybeSingle()

      // Update status
      const updateData: Record<string, unknown> = {
        statut: status,
        date_derniere_action: new Date().toISOString(),
      }

      if (status === 'offer_accepted') {
        updateData.date_embauche = new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('candidates')
        .update(updateData as never)
        .eq('id', id)
        .select('id, statut, date_derniere_action, date_embauche, created_at, updated_at')
        // safe: guaranteed-row
        .single()

      if (error) throw error

      // Add history entry
      await supabase.from('candidate_history').insert({
        candidate_id: id,
        action_type: 'status_change',
        description: `Statut changé de ${current?.statut} à ${status}`,
        old_value: { statut: current?.statut },
        new_value: { statut: status },
        performed_by: user?.id,
      })

      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
      queryClient.invalidateQueries({ queryKey: ['candidate', variables.id] })
      queryClient.invalidateQueries({ queryKey: ['candidate-history'] })
      queryClient.invalidateQueries({ queryKey: ['job-offers-kpis'] })
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error))
    },
  })
}

export function useDeleteCandidate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('candidates').delete().eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
      queryClient.invalidateQueries({ queryKey: ['job-offers-kpis'] })
      toast.success('Candidat supprimé')
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error))
    },
  })
}

export function useCandidateHistory(candidateId: string | undefined) {
  return useQuery({
    queryKey: ['candidate-history', candidateId],
    queryFn: async () => {
      if (!candidateId) return []

      const { data, error } = await supabase
        .from('candidate_history')
        .select(
          `
          id, candidate_id, action_type, description, old_value, new_value, performed_by, created_at,
          performer:profiles!candidate_history_performed_by_fkey(id, prenom, nom, avatar_url)
        `
        )
        .eq('candidate_id', candidateId)
        .limit(100)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data
    },
    enabled: !!candidateId,
  })
}
