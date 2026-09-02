import { useEffect, useMemo } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export type Canal = 'Email' | 'Visio' | 'Téléphone' | 'RDV'

export interface ExchangeRow {
  id: string
  apporteur_id: string
  date_echange: string
  canal: Canal
  resume: string
}

export interface NextStepRow {
  id: string
  apporteur_id: string
  action: string
  echeance: string
  owner: string | null
}

export interface ExchangeItem {
  id: string
  date: string
  canal: Canal
  resume: string
}

export interface NextStepItem {
  id: string
  action: string
  echeance: string
  owner: string
}

const EXCHANGES_KEY = (id: string) => ['apporteur-exchanges', id]
const NEXT_STEPS_KEY = (id: string) => ['apporteur-next-steps', id]

/**
 * Lit et écrit les échanges et prochaines étapes d'un AA depuis Supabase.
 * Données partagées entre tous les utilisateurs authentifiés.
 */
export function useApporteurContextData(apporteurId: string | undefined) {
  const queryClient = useQueryClient()
  const enabled = Boolean(apporteurId)

  const exchangesQuery = useQuery({
    queryKey: EXCHANGES_KEY(apporteurId ?? ''),
    enabled,
    queryFn: async (): Promise<ExchangeItem[]> => {
      const { data, error } = await supabase
        .from('apporteur_exchanges' as never)
        .select('id, date_echange, canal, resume')
        .eq('apporteur_id', apporteurId!)
        .order('date_echange', { ascending: false })
      if (error) throw error
      return (
        data as unknown as Array<Pick<ExchangeRow, 'id' | 'date_echange' | 'canal' | 'resume'>>
      ).map((r) => ({ id: r.id, date: r.date_echange, canal: r.canal, resume: r.resume }))
    },
  })

  const nextStepsQuery = useQuery({
    queryKey: NEXT_STEPS_KEY(apporteurId ?? ''),
    enabled,
    queryFn: async (): Promise<NextStepItem[]> => {
      const { data, error } = await supabase
        .from('apporteur_next_steps' as never)
        .select('id, action, echeance, owner')
        .eq('apporteur_id', apporteurId!)
        .order('echeance', { ascending: true })
      if (error) throw error
      return (
        data as unknown as Array<Pick<NextStepRow, 'id' | 'action' | 'echeance' | 'owner'>>
      ).map((r) => ({ id: r.id, action: r.action, echeance: r.echeance, owner: r.owner ?? '' }))
    },
  })

  // Realtime : rafraîchit les listes dès qu'un autre utilisateur modifie
  useEffect(() => {
    if (!apporteurId) return
    const channel = supabase
      .channel(`apporteur-context-${apporteurId}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'apporteur_exchanges',
          filter: `apporteur_id=eq.${apporteurId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: EXCHANGES_KEY(apporteurId) })
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'apporteur_next_steps',
          filter: `apporteur_id=eq.${apporteurId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: NEXT_STEPS_KEY(apporteurId) })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [apporteurId, queryClient])

  const invalidateExchanges = () =>
    queryClient.invalidateQueries({ queryKey: EXCHANGES_KEY(apporteurId ?? '') })
  const invalidateNextSteps = () =>
    queryClient.invalidateQueries({ queryKey: NEXT_STEPS_KEY(apporteurId ?? '') })

  const addExchange = useMutation({
    mutationFn: async (payload: { date: string; canal: Canal; resume: string }) => {
      if (!apporteurId) throw new Error('apporteurId manquant')
      const { data: userData } = await supabase.auth.getUser()
      const { error } = await supabase.from('apporteur_exchanges' as never).insert({
        apporteur_id: apporteurId,
        date_echange: payload.date,
        canal: payload.canal,
        resume: payload.resume,
        created_by: userData.user?.id ?? null,
      } as never)
      if (error) throw error
    },
    onSuccess: invalidateExchanges,
  })

  const updateExchange = useMutation({
    mutationFn: async (payload: { id: string; date: string; canal: Canal; resume: string }) => {
      const { error } = await supabase
        .from('apporteur_exchanges' as never)
        .update({
          date_echange: payload.date,
          canal: payload.canal,
          resume: payload.resume,
        } as never)
        .eq('id', payload.id)
      if (error) throw error
    },
    onSuccess: invalidateExchanges,
  })

  const deleteExchange = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('apporteur_exchanges' as never)
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidateExchanges,
  })

  const addNextStep = useMutation({
    mutationFn: async (payload: { action: string; echeance: string; owner: string }) => {
      if (!apporteurId) throw new Error('apporteurId manquant')
      const { data: userData } = await supabase.auth.getUser()
      const { error } = await supabase.from('apporteur_next_steps' as never).insert({
        apporteur_id: apporteurId,
        action: payload.action,
        echeance: payload.echeance,
        owner: payload.owner || null,
        created_by: userData.user?.id ?? null,
      } as never)
      if (error) throw error
    },
    onSuccess: invalidateNextSteps,
  })

  const updateNextStep = useMutation({
    mutationFn: async (payload: {
      id: string
      action: string
      echeance: string
      owner: string
    }) => {
      const { error } = await supabase
        .from('apporteur_next_steps' as never)
        .update({
          action: payload.action,
          echeance: payload.echeance,
          owner: payload.owner || null,
        } as never)
        .eq('id', payload.id)
      if (error) throw error
    },
    onSuccess: invalidateNextSteps,
  })

  const deleteNextStep = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('apporteur_next_steps' as never)
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidateNextSteps,
  })

  const exchanges = useMemo(() => exchangesQuery.data ?? [], [exchangesQuery.data])
  const nextSteps = useMemo(() => nextStepsQuery.data ?? [], [nextStepsQuery.data])

  return {
    exchanges,
    nextSteps,
    isLoading: exchangesQuery.isLoading || nextStepsQuery.isLoading,
    addExchange,
    updateExchange,
    deleteExchange,
    addNextStep,
    updateNextStep,
    deleteNextStep,
  }
}
