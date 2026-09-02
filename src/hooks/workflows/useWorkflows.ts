import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/shared/use-toast'
import { useAuth } from '@/hooks/shared/useAuth'
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer'
import type { Workflow, WorkflowGraph, WorkflowTriggerType } from '@/types/workflow'

const WORKFLOWS_KEY = ['workflows'] as const

export function useWorkflows() {
  return useQuery({
    queryKey: WORKFLOWS_KEY,
    queryFn: async (): Promise<Workflow[]> => {
      const { data, error } = await supabase
        .from('workflows')
        .select('*')
        .order('updated_at', { ascending: false })
      if (error) throw error
      return (data || []) as unknown as Workflow[]
    },
    staleTime: 30_000,
  })
}

export function useWorkflow(id: string | undefined) {
  return useQuery({
    queryKey: [...WORKFLOWS_KEY, id],
    enabled: !!id,
    queryFn: async (): Promise<Workflow | null> => {
      if (!id) return null
      const { data, error } = await supabase
        .from('workflows')
        .select('*')
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      return data as unknown as Workflow | null
    },
  })
}

interface CreateWorkflowInput {
  nom: string
  description?: string
  trigger_type: WorkflowTriggerType
  trigger_config?: Record<string, unknown>
  graph?: WorkflowGraph
  is_active?: boolean
  template_id?: string
}

export function useCreateWorkflow() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (input: CreateWorkflowInput): Promise<Workflow> => {
      if (!user) throw new Error('Non authentifié')

      let graph = input.graph
      let trigger_type = input.trigger_type
      let trigger_config = input.trigger_config || {}
      let nom = input.nom
      let description = input.description

      // Si on duplique un template
      if (input.template_id) {
        const { data: tpl, error: tplErr } = await supabase
          .from('workflows')
          .select('*')
          .eq('id', input.template_id)
          .maybeSingle()
        if (tplErr) throw tplErr
        if (!tpl) throw new Error('Template workflow introuvable')
        graph = tpl.graph as unknown as WorkflowGraph
        trigger_type = tpl.trigger_type as WorkflowTriggerType
        trigger_config = (tpl.trigger_config as Record<string, unknown>) || {}
        if (!nom) nom = `${tpl.nom} (copie)`
        if (!description) description = tpl.description ?? undefined
      }

      const { data, error } = await supabase
        .from('workflows')
        .insert({
          nom,
          description: description ?? null,
          trigger_type: trigger_type as never,
          trigger_config: trigger_config as never,
          graph: (graph || { nodes: [], edges: [] }) as never,
          is_active: input.is_active ?? false,
          is_template: false,
          created_by: user.id,
        })
        .select()
        // safe: guaranteed-row
        .single()
      if (error) throw error
      return data as unknown as Workflow
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKFLOWS_KEY })
      toast({ title: 'Workflow créé', description: "L'automatisation a été créée." })
    },
    onError: (err) => {
      toast({ title: 'Erreur', description: sanitizeSupabaseError(err), variant: 'destructive' })
    },
  })
}

export function useUpdateWorkflow() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Workflow> & { id: string }) => {
      const { data, error } = await supabase
        .from('workflows')
        .update(patch as never)
        .eq('id', id)
        .select()
        // safe: guaranteed-row
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: WORKFLOWS_KEY })
      queryClient.invalidateQueries({ queryKey: [...WORKFLOWS_KEY, variables.id] })
    },
    onError: (err) => {
      toast({ title: 'Erreur', description: sanitizeSupabaseError(err), variant: 'destructive' })
    },
  })
}

export function useDeleteWorkflow() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('workflows').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKFLOWS_KEY })
      toast({ title: 'Workflow supprimé' })
    },
    onError: (err) => {
      toast({ title: 'Erreur', description: sanitizeSupabaseError(err), variant: 'destructive' })
    },
  })
}

export function useToggleWorkflowActive() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('workflows').update({ is_active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, v) => {
      queryClient.invalidateQueries({ queryKey: WORKFLOWS_KEY })
      toast({
        title: v.is_active ? 'Workflow activé' : 'Workflow mis en pause',
      })
    },
    onError: (err) => {
      toast({ title: 'Erreur', description: sanitizeSupabaseError(err), variant: 'destructive' })
    },
  })
}

export function useTriggerWorkflowManual() {
  const { toast } = useToast()
  return useMutation({
    mutationFn: async ({
      workflow_id,
      payload,
    }: {
      workflow_id: string
      payload?: Record<string, unknown>
    }) => {
      const { data, error } = await supabase.functions.invoke('workflow-engine', {
        body: { workflow_id, trigger_payload: payload ?? {}, manual: true },
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast({ title: 'Workflow lancé', description: "L'exécution a démarré." })
    },
    onError: (err) => {
      toast({ title: 'Erreur', description: sanitizeSupabaseError(err), variant: 'destructive' })
    },
  })
}
