import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/shared/use-toast'
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer'

interface EmailTemplate {
  id: string
  name: string
  subject: string
  content: string
  category: string | null
  variables: string[]
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export function useEmailTemplates() {
  return useQuery({
    queryKey: ['email-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_templates')
        .select(
          'id, name, subject, content, category, variables, is_active, created_by, created_at, updated_at'
        )
        .order('created_at', { ascending: false })
        .limit(500)

      if (error) throw error
      return data as EmailTemplate[]
    },
  })
}

export function useCreateEmailTemplate() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (
      template: Omit<EmailTemplate, 'id' | 'created_at' | 'updated_at' | 'created_by'>
    ) => {
      const { data, error } = await supabase
        .from('email_templates')
        .insert([template])
        .select()
        // safe: guaranteed-row
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] })
      toast({
        title: 'Succès',
        description: "Modèle d'email créé avec succès",
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur',
        description: sanitizeSupabaseError(error) || 'Erreur lors de la création du modèle',
        variant: 'destructive',
      })
    },
  })
}

export function useUpdateEmailTemplate() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ id, ...template }: Partial<EmailTemplate> & { id: string }) => {
      const { data, error } = await supabase
        .from('email_templates')
        .update(template)
        .eq('id', id)
        .select()
        // safe: guaranteed-row
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] })
      toast({
        title: 'Succès',
        description: "Modèle d'email mis à jour avec succès",
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur',
        description: sanitizeSupabaseError(error) || 'Erreur lors de la mise à jour du modèle',
        variant: 'destructive',
      })
    },
  })
}

export function useDeleteEmailTemplate() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('email_templates').delete().eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] })
      toast({
        title: 'Succès',
        description: "Modèle d'email supprimé avec succès",
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur',
        description: sanitizeSupabaseError(error) || 'Erreur lors de la suppression du modèle',
        variant: 'destructive',
      })
    },
  })
}
