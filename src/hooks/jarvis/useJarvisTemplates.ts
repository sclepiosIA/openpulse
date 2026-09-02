/**
 * useJarvisTemplates - Gestion des templates d'actions Jarvis
 *
 * Permet de créer, modifier, supprimer et utiliser des templates
 * d'actions prédéfinies pour Jarvis.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/shared/useAuth'
import { useToast } from '@/hooks/shared/use-toast'
import { debug } from '@/lib/debug'
import type { JarvisActionType } from '@/types/jarvis'

export interface JarvisTemplate {
  id: string
  user_id: string | null
  name: string
  description: string | null
  action_type: JarvisActionType
  template_data: Record<string, string>
  variables: string[]
  usage_count: number
  is_system: boolean
  created_at: string
  updated_at: string
}

interface CreateTemplateParams {
  name: string
  description?: string
  action_type: JarvisActionType
  template_data: Record<string, string>
  variables?: string[]
}

interface UpdateTemplateParams {
  id: string
  name?: string
  description?: string
  template_data?: Record<string, string>
  variables?: string[]
}

const TEMPLATES_QUERY_KEY = 'jarvis-templates'

export function useJarvisTemplates() {
  const { user } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Récupérer tous les templates (système + utilisateur)
  const {
    data: templates,
    isLoading,
    error,
  } = useQuery({
    queryKey: [TEMPLATES_QUERY_KEY, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jarvis_action_templates')
        .select(
          'id, name, description, action_type, template_data, variables, is_system, usage_count, user_id, created_at, updated_at'
        )
        .order('is_system', { ascending: false })
        .order('usage_count', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(200)

      if (error) {
        debug.error('Error fetching Jarvis templates:', error)
        throw error
      }

      return (data || []) as JarvisTemplate[]
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Créer un nouveau template
  const createMutation = useMutation({
    mutationFn: async (params: CreateTemplateParams) => {
      if (!user?.id) throw new Error('Non authentifié')

      // Extraire les variables du template
      const variables = params.variables || extractVariables(JSON.stringify(params.template_data))

      const { data, error } = await supabase
        .from('jarvis_action_templates')
        .insert({
          user_id: user.id,
          name: params.name,
          description: params.description || null,
          action_type: params.action_type,
          template_data: params.template_data,
          variables,
          is_system: false,
        })
        .select()
        // safe: guaranteed-row
        .single() // safe: guaranteed-row

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TEMPLATES_QUERY_KEY] })
      toast({
        title: '✅ Template créé',
        description: 'Votre nouveau template est prêt à être utilisé',
      })
    },
    onError: (error) => {
      debug.error('Error creating template:', error)
      toast({
        title: 'Erreur',
        description: 'Impossible de créer le template',
        variant: 'destructive',
      })
    },
  })

  // Mettre à jour un template
  const updateMutation = useMutation({
    mutationFn: async (params: UpdateTemplateParams) => {
      if (!user?.id) throw new Error('Non authentifié')

      const updates: Record<string, unknown> = {}
      if (params.name !== undefined) updates.name = params.name
      if (params.description !== undefined) updates.description = params.description
      if (params.template_data !== undefined) {
        updates.template_data = params.template_data
        updates.variables =
          params.variables || extractVariables(JSON.stringify(params.template_data))
      }

      const { data, error } = await supabase
        .from('jarvis_action_templates')
        .update(updates as never)
        .eq('id', params.id)
        .eq('user_id', user.id) // Sécurité: seulement ses propres templates
        .select()
        // safe: guaranteed-row
        .single() // safe: guaranteed-row

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TEMPLATES_QUERY_KEY] })
      toast({
        title: '✅ Template mis à jour',
      })
    },
    onError: (error) => {
      debug.error('Error updating template:', error)
      toast({
        title: 'Erreur',
        description: 'Impossible de modifier le template',
        variant: 'destructive',
      })
    },
  })

  // Supprimer un template
  const deleteMutation = useMutation({
    mutationFn: async (templateId: string) => {
      if (!user?.id) throw new Error('Non authentifié')

      const { error } = await supabase
        .from('jarvis_action_templates')
        .delete()
        .eq('id', templateId)
        .eq('user_id', user.id) // Sécurité: seulement ses propres templates

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TEMPLATES_QUERY_KEY] })
      toast({
        title: '🗑️ Template supprimé',
      })
    },
    onError: (error) => {
      debug.error('Error deleting template:', error)
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer le template',
        variant: 'destructive',
      })
    },
  })

  // Incrémenter le compteur d'utilisation
  const useTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      // Récupérer le template actuel
      const template = templates?.find((t) => t.id === templateId)
      if (!template) throw new Error('Template non trouvé')

      const { error } = await supabase
        .from('jarvis_action_templates')
        .update({ usage_count: (template.usage_count || 0) + 1 })
        .eq('id', templateId)

      if (error) throw error
      return template
    },
    onSuccess: (template) => {
      queryClient.invalidateQueries({ queryKey: [TEMPLATES_QUERY_KEY] })
      toast({
        title: '📋 Template copié',
        description: `"${template.name}" est prêt à être utilisé`,
      })
    },
  })

  // Dupliquer un template système vers l'utilisateur
  const duplicateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      if (!user?.id) throw new Error('Non authentifié')

      const template = templates?.find((t) => t.id === templateId)
      if (!template) throw new Error('Template non trouvé')

      const { data, error } = await supabase
        .from('jarvis_action_templates')
        .insert({
          user_id: user.id,
          name: `${template.name} (copie)`,
          description: template.description,
          action_type: template.action_type,
          template_data: template.template_data,
          variables: template.variables,
          is_system: false,
        })
        .select()
        // safe: guaranteed-row
        .single() // safe: guaranteed-row

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TEMPLATES_QUERY_KEY] })
      toast({
        title: '📋 Template dupliqué',
        description: 'Vous pouvez maintenant le personnaliser',
      })
    },
    onError: (error) => {
      debug.error('Error duplicating template:', error)
      toast({
        title: 'Erreur',
        description: 'Impossible de dupliquer le template',
        variant: 'destructive',
      })
    },
  })

  return {
    templates: templates || [],
    isLoading,
    error,
    createTemplate: createMutation.mutateAsync,
    updateTemplate: updateMutation.mutateAsync,
    deleteTemplate: deleteMutation.mutateAsync,
    useTemplate: useTemplateMutation.mutateAsync,
    duplicateTemplate: duplicateMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  }
}

// Fonction utilitaire pour extraire les variables {{variable}} d'une chaîne
function extractVariables(text: string): string[] {
  const regex = /\{\{(\w+)\}\}/g
  const variables = new Set<string>()
  let match
  while ((match = regex.exec(text)) !== null) {
    variables.add(match[1])
  }
  return Array.from(variables)
}
