/**
 * useJarvisAutopilot - Gestion des règles d'automatisation Jarvis
 *
 * Permet aux utilisateurs de configurer des actions automatiques
 * basées sur des triggers temporels ou événementiels.
 */

import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { debug } from '@/lib/debug'
import { useAuth } from '@/hooks/shared/useAuth'
import { useToast } from '@/hooks/shared/use-toast'

export type TriggerType = 'schedule' | 'event' | 'condition'

export interface AutopilotRule {
  id: string
  user_id: string
  name: string
  description: string | null
  trigger_type: TriggerType
  trigger_config: {
    // Schedule trigger
    cron?: string
    time?: string
    days?: string[]
    // Event trigger
    event_type?: string
    table?: string
    conditions?: Record<string, unknown>
    // Condition trigger
    metric?: string
    operator?: 'gt' | 'lt' | 'eq' | 'gte' | 'lte'
    threshold?: number
  }
  action_type: string
  action_config: {
    command?: string
    tool?: string
    parameters?: Record<string, unknown>
    notify?: boolean
  }
  is_active: boolean
  last_executed_at: string | null
  execution_count: number
  created_at: string
  updated_at: string
}

export interface AutopilotExecution {
  id: string
  rule_id: string
  user_id: string
  trigger_data: Record<string, unknown> | null
  action_result: Record<string, unknown> | null
  status: 'pending' | 'running' | 'success' | 'failure' | 'skipped'
  error_message: string | null
  duration_ms: number | null
  executed_at: string
}

interface CreateRuleParams {
  name: string
  description?: string
  trigger_type: TriggerType
  trigger_config: AutopilotRule['trigger_config']
  action_type: string
  action_config: AutopilotRule['action_config']
}

const AUTOPILOT_RULES_KEY = 'jarvis-autopilot-rules'
const AUTOPILOT_EXECUTIONS_KEY = 'jarvis-autopilot-executions'

export function useJarvisAutopilot() {
  const { user } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Fetch all rules for the current user
  const { data: rules, isLoading: isLoadingRules } = useQuery({
    queryKey: [AUTOPILOT_RULES_KEY, user?.id],
    queryFn: async () => {
      if (!user?.id) return []

      const { data, error } = await supabase
        .from('jarvis_autopilot_rules')
        .select(
          'id, user_id, name, description, trigger_type, trigger_config, action_type, action_config, is_active, last_executed_at, execution_count, created_at, updated_at'
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(200)

      if (error) {
        debug.error('Error fetching autopilot rules:', error)
        return []
      }

      return (data || []) as AutopilotRule[]
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  })

  // Fetch recent executions
  const { data: executions, isLoading: isLoadingExecutions } = useQuery({
    queryKey: [AUTOPILOT_EXECUTIONS_KEY, user?.id],
    queryFn: async () => {
      if (!user?.id) return []

      const { data, error } = await supabase
        .from('jarvis_autopilot_executions')
        .select(
          'id, rule_id, user_id, trigger_data, action_result, status, error_message, duration_ms, executed_at'
        )
        .eq('user_id', user.id)
        .order('executed_at', { ascending: false })
        .limit(50)

      if (error) {
        debug.error('Error fetching autopilot executions:', error)
        return []
      }

      return (data || []) as AutopilotExecution[]
    },
    enabled: !!user?.id,
    staleTime: 60 * 1000,
  })

  // Create a new rule
  const createRuleMutation = useMutation({
    mutationFn: async (params: CreateRuleParams) => {
      if (!user?.id) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('jarvis_autopilot_rules')
        .insert([
          {
            user_id: user.id,
            name: params.name,
            description: params.description || null,
            trigger_type: params.trigger_type,
            trigger_config: params.trigger_config,
            action_type: params.action_type,
            action_config: params.action_config,
            is_active: true,
          } as never,
        ])
        .select()
        // safe: guaranteed-row
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [AUTOPILOT_RULES_KEY, user?.id] })
      toast({
        title: 'Règle créée',
        description: "La règle d'automatisation a été créée avec succès",
      })
    },
    onError: (error) => {
      debug.error('Error creating autopilot rule:', error)
      toast({
        title: 'Erreur',
        description: "Impossible de créer la règle d'automatisation",
        variant: 'destructive',
      })
    },
  })

  // Toggle rule active state
  const toggleRuleMutation = useMutation({
    mutationFn: async ({ ruleId, isActive }: { ruleId: string; isActive: boolean }) => {
      if (!user?.id) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('jarvis_autopilot_rules')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', ruleId)
        .eq('user_id', user.id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [AUTOPILOT_RULES_KEY, user?.id] })
    },
  })

  // Delete a rule
  const deleteRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      if (!user?.id) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('jarvis_autopilot_rules')
        .delete()
        .eq('id', ruleId)
        .eq('user_id', user.id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [AUTOPILOT_RULES_KEY, user?.id] })
      toast({
        title: 'Règle supprimée',
        description: "La règle d'automatisation a été supprimée",
      })
    },
  })

  // Get rule by ID
  const getRuleById = useCallback(
    (ruleId: string) => {
      return rules?.find((r) => r.id === ruleId)
    },
    [rules]
  )

  // Get executions for a specific rule
  const getExecutionsForRule = useCallback(
    (ruleId: string) => {
      return executions?.filter((e) => e.rule_id === ruleId) || []
    },
    [executions]
  )

  // Get active rules count
  const activeRulesCount = rules?.filter((r) => r.is_active).length || 0

  // Get rules by trigger type
  const getRulesByTriggerType = useCallback(
    (type: TriggerType) => {
      return rules?.filter((r) => r.trigger_type === type) || []
    },
    [rules]
  )

  return {
    rules,
    executions,
    isLoadingRules,
    isLoadingExecutions,
    createRule: createRuleMutation.mutateAsync,
    toggleRule: toggleRuleMutation.mutateAsync,
    deleteRule: deleteRuleMutation.mutateAsync,
    getRuleById,
    getExecutionsForRule,
    activeRulesCount,
    getRulesByTriggerType,
    isCreating: createRuleMutation.isPending,
    isDeleting: deleteRuleMutation.isPending,
  }
}

export default useJarvisAutopilot
