import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseBrowser'
import { toast } from 'sonner'
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer'

export function useCsmContactsMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['csm-contacts-all'] })

  const updateContact = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: unknown }) => {
      const { error } = await supabase.from('contacts').update({ [field]: value } as never).eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(sanitizeSupabaseError(error)),
  })

  const addContact = useMutation({
    mutationFn: async (etablissementId: string) => {
      const { error } = await supabase.from('contacts').insert({
        etablissement_id: etablissementId,
        nom: '',
        prenom: '',
      } as never)
      if (error) throw error
    },
    onSuccess: () => { invalidate(); toast.success('Contact ajouté') },
    onError: (error: Error) => toast.error(sanitizeSupabaseError(error)),
  })

  const deleteContact = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('contacts').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { invalidate(); toast.success('Contact supprimé') },
    onError: (error: Error) => toast.error(sanitizeSupabaseError(error)),
  })

  return {
    handleUpdate: (id: string, field: string, value: unknown) => updateContact.mutate({ id, field, value }),
    handleAdd: (etablissementId: string) => addContact.mutate(etablissementId),
    handleDelete: (id: string) => deleteContact.mutate(id),
  }
}
