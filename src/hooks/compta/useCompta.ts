import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

export interface ComptaCompte {
  id: string
  numero: string
  libelle: string
  classe: number
  type: string
  parent_id: string | null
  lettrable: boolean
  auxiliaire: boolean
  actif: boolean
}

export interface ComptaJournal {
  id: string
  code: string
  libelle: string
  type: string
  actif: boolean
}

export interface ComptaExercice {
  id: string
  libelle: string
  date_debut: string
  date_fin: string
  statut: string
}

export interface ComptaEcriture {
  id: string
  exercice_id: string | null
  journal_id: string
  date_ecriture: string
  numero_piece: string | null
  libelle: string
  reference_externe: string | null
  source_type: string | null
  statut: 'brouillon' | 'validee' | 'cloturee'
  created_at: string
}

export interface ComptaLigne {
  id: string
  ecriture_id: string
  compte_id: string
  libelle: string | null
  debit: number
  credit: number
  lettrage: string | null
  tiers_type: string | null
  tiers_id: string | null
  date_echeance: string | null
  ordre: number
}

export function useComptaComptes() {
  return useQuery({
    queryKey: ['compta', 'comptes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('compta_comptes' as any)
        .select('*')
        .eq('actif', true)
        .order('numero')
      if (error) throw error
      return (data || []) as unknown as ComptaCompte[]
    },
  })
}

export function useComptaJournaux() {
  return useQuery({
    queryKey: ['compta', 'journaux'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('compta_journaux' as any)
        .select('*')
        .eq('actif', true)
        .order('code')
      if (error) throw error
      return (data || []) as unknown as ComptaJournal[]
    },
  })
}

export function useComptaExercices() {
  return useQuery({
    queryKey: ['compta', 'exercices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('compta_exercices' as any)
        .select('*')
        .order('date_debut', { ascending: false })
      if (error) throw error
      return (data || []) as unknown as ComptaExercice[]
    },
  })
}

export function useComptaEcritures(filters?: {
  journalId?: string
  dateFrom?: string
  dateTo?: string
  statut?: string
}) {
  return useQuery({
    queryKey: ['compta', 'ecritures', filters],
    queryFn: async () => {
      let q = supabase
        .from('compta_ecritures' as any)
        .select('*')
        .order('date_ecriture', { ascending: false })
        .limit(500)
      if (filters?.journalId) q = q.eq('journal_id', filters.journalId)
      if (filters?.statut) q = q.eq('statut', filters.statut)
      if (filters?.dateFrom) q = q.gte('date_ecriture', filters.dateFrom)
      if (filters?.dateTo) q = q.lte('date_ecriture', filters.dateTo)
      const { data, error } = await q
      if (error) throw error
      return (data || []) as unknown as ComptaEcriture[]
    },
  })
}

export function useComptaLignes(ecritureId: string | null) {
  return useQuery({
    queryKey: ['compta', 'lignes', ecritureId],
    enabled: !!ecritureId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('compta_lignes' as any)
        .select('*')
        .eq('ecriture_id', ecritureId!)
        .order('ordre')
      if (error) throw error
      return (data || []) as unknown as ComptaLigne[]
    },
  })
}

export function useBalance(exerciceId?: string) {
  return useQuery({
    queryKey: ['compta', 'balance', exerciceId],
    queryFn: async () => {
      let q = supabase
        .from('v_compta_balance' as any)
        .select('*')
        .order('numero')
      if (exerciceId) q = q.eq('exercice_id', exerciceId)
      const { data, error } = await q
      if (error) throw error
      return (data || []) as any[]
    },
  })
}

export function useGrandLivre(compteId: string | null) {
  return useQuery({
    queryKey: ['compta', 'grand-livre', compteId],
    enabled: !!compteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_compta_grand_livre' as any)
        .select('*')
        .eq('compte_id', compteId!)
        .order('date_ecriture')
      if (error) throw error
      return (data || []) as any[]
    },
  })
}

export function useCreateEcriture() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      journal_id: string
      date_ecriture: string
      libelle: string
      numero_piece?: string
      exercice_id?: string
      lignes: Array<{
        compte_id: string
        libelle?: string
        debit: number
        credit: number
        tiers_type?: string
        tiers_id?: string
        date_echeance?: string
      }>
    }) => {
      const totalDebit = payload.lignes.reduce((s, l) => s + (l.debit || 0), 0)
      const totalCredit = payload.lignes.reduce((s, l) => s + (l.credit || 0), 0)
      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        throw new Error(`Écriture non équilibrée: débit ${totalDebit} ≠ crédit ${totalCredit}`)
      }
      const { data: ecr, error: e1 } = await supabase
        .from('compta_ecritures' as any)
        .insert({
          journal_id: payload.journal_id,
          date_ecriture: payload.date_ecriture,
          libelle: payload.libelle,
          numero_piece: payload.numero_piece || null,
          exercice_id: payload.exercice_id || null,
          source_type: 'manuel',
          statut: 'brouillon',
        })
        .select()
        .single()
      if (e1) throw e1
      const ecrId = (ecr as any).id
      const rows = payload.lignes.map((l, idx) => ({
        ecriture_id: ecrId,
        compte_id: l.compte_id,
        libelle: l.libelle || null,
        debit: l.debit || 0,
        credit: l.credit || 0,
        tiers_type: l.tiers_type || null,
        tiers_id: l.tiers_id || null,
        date_echeance: l.date_echeance || null,
        ordre: idx,
      }))
      const { error: e2 } = await supabase.from('compta_lignes' as any).insert(rows)
      if (e2) throw e2
      return ecr
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compta'] })
      toast.success('Écriture créée')
    },
    onError: (e: any) => toast.error(e.message),
  })
}

export function useValidateEcriture() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('compta_ecritures' as any)
        .update({ statut: 'validee' })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compta'] })
      toast.success('Écriture validée')
    },
    onError: (e: any) => toast.error(e.message),
  })
}

export function useDeleteEcriture() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('compta_ecritures' as any)
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compta'] })
      toast.success('Écriture supprimée')
    },
  })
}

export function useCreateCompte() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<ComptaCompte>) => {
      const { error } = await supabase.from('compta_comptes' as any).insert(payload as any)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compta', 'comptes'] })
      toast.success('Compte ajouté')
    },
    onError: (e: any) => toast.error(e.message),
  })
}
