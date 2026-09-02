import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import { toast } from 'sonner'
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer'
import type { JobOffer, JobOfferStatus, JobContractType } from '@/types/recrutement'
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

export function useJobOffers(filters?: {
  status?: JobOfferStatus[]
  contractType?: JobContractType[]
  search?: string
}) {
  const { user, loading: authLoading } = useAuth()

  return useQuery({
    queryKey: ['job-offers', filters, user?.id],
    enabled: !authLoading && !!user?.id,
    retry: false,
    queryFn: async () => {
      let query = supabase
        .from('job_offers')
        .select(
          `
          *
        `
        )
        .order('created_at', { ascending: false })

      if (filters?.status && filters.status.length > 0) {
        query = query.in('statut', filters.status)
      }

      if (filters?.contractType && filters.contractType.length > 0) {
        query = query.in('type_contrat', filters.contractType)
      }

      if (filters?.search) {
        query = query.or(
          `titre.ilike.%${sanitizePostgrestValue(filters.search)}%,description.ilike.%${sanitizePostgrestValue(filters.search)}%`
        )
      }

      const { data, error } = await withRecrutementTimeout(query, "offres d'emploi")

      if (error) throw error
      return (data || []) as unknown as JobOffer[]
    },
  })
}

export function useJobOffer(id: string | undefined) {
  return useQuery({
    queryKey: ['job-offer', id],
    queryFn: async () => {
      if (!id) return null

      const { data, error } = await supabase
        .from('job_offers')
        .select(
          `
          *,
          responsable:profiles!job_offers_responsable_id_fkey(id, prenom, nom, avatar_url)
        `
        )
        .eq('id', id)
        .maybeSingle()

      if (error) throw error
      return (data ?? null) as unknown as JobOffer | null
    },
    enabled: !!id,
  })
}

export function useCreateJobOffer() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (offer: Partial<JobOffer>) => {
      const { data, error } = await supabase
        .from('job_offers')
        .insert({
          titre: offer.titre || '',
          description: offer.description,
          description_html: offer.description_html,
          type_contrat: offer.type_contrat || 'cdi',
          statut: offer.statut || 'draft',
          localisation: offer.localisation,
          departement: offer.departement,
          salaire_min: offer.salaire_min,
          salaire_max: offer.salaire_max,
          experience_minimum: offer.experience_minimum,
          niveau_etudes: offer.niveau_etudes,
          competences_requises: offer.competences_requises,
          avantages: offer.avantages,
          date_publication: offer.date_publication,
          date_cloture: offer.date_cloture,
          nombre_postes: offer.nombre_postes,
          diffusion_externe: offer.diffusion_externe,
          priorite: offer.priorite,
          responsable_id: offer.responsable_id,
          created_by: user?.id,
        })
        .select()
        // safe: guaranteed-row
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-offers'] })
      toast.success("Offre d'emploi créée")
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error))
    },
  })
}

export function useUpdateJobOffer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<JobOffer> & { id: string }) => {
      const { data, error } = await supabase
        .from('job_offers')
        .update({
          titre: updates.titre,
          description: updates.description,
          description_html: updates.description_html,
          type_contrat: updates.type_contrat,
          statut: updates.statut,
          localisation: updates.localisation,
          departement: updates.departement,
          salaire_min: updates.salaire_min,
          salaire_max: updates.salaire_max,
          experience_minimum: updates.experience_minimum,
          niveau_etudes: updates.niveau_etudes,
          competences_requises: updates.competences_requises,
          avantages: updates.avantages,
          date_publication: updates.date_publication,
          date_cloture: updates.date_cloture,
          nombre_postes: updates.nombre_postes,
          postes_pourvus: updates.postes_pourvus,
          diffusion_externe: updates.diffusion_externe,
          priorite: updates.priorite,
          responsable_id: updates.responsable_id,
        })
        .eq('id', id)
        .select()
        // safe: guaranteed-row
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['job-offers'] })
      queryClient.invalidateQueries({ queryKey: ['job-offer', variables.id] })
      toast.success('Offre mise à jour')
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error))
    },
  })
}

export function useDeleteJobOffer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('job_offers').delete().eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-offers'] })
      toast.success('Offre supprimée')
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error))
    },
  })
}

export function useJobOffersKPIs() {
  const { user, loading: authLoading } = useAuth()

  return useQuery({
    queryKey: ['job-offers-kpis', user?.id],
    enabled: !authLoading && !!user?.id,
    retry: false,
    queryFn: async () => {
      const { data: offers, error } = await withRecrutementTimeout(
        supabase.from('job_offers').select('statut, nombre_postes, postes_pourvus'),
        'indicateurs des offres'
      )

      if (error) throw error

      const { data: candidates, error: candError } = await withRecrutementTimeout(
        supabase.from('candidates').select('statut, job_offer_id'),
        'indicateurs des candidatures'
      )

      if (candError) throw candError

      const totalOffers = offers?.length || 0
      const activeOffers = offers?.filter((o) => o.statut === 'published').length || 0
      const totalCandidates = candidates?.length || 0
      const newCandidates = candidates?.filter((c) => c.statut === 'new').length || 0
      const hiredCandidates = candidates?.filter((c) => c.statut === 'offer_accepted').length || 0
      const inProgress =
        candidates?.filter((c) =>
          [
            'screening',
            'phone_interview',
            'technical_interview',
            'final_interview',
            'offer_sent',
          ].includes(c.statut)
        ).length || 0

      return {
        totalOffers,
        activeOffers,
        totalCandidates,
        newCandidates,
        hiredCandidates,
        inProgress,
        conversionRate:
          totalCandidates > 0 ? Math.round((hiredCandidates / totalCandidates) * 100) : 0,
      }
    },
  })
}
