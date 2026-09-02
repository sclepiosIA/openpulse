import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseBrowser'
import { toast } from 'sonner'
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer'

export function useCsmComptesMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['production'] })

  // Champs de type date: empty string doit devenir null pour éviter
  // "invalid input syntax for type date" côté Postgres.
  const DATE_FIELDS = new Set([
    'date_signature',
    'date_previsionnelle_signature',
    'date_fin_contrat',
    'date_go_live',
    'date_prise_contact',
    'date_action_orga',
    'date_action_csm',
    'date_premier_paiement',
    'derniere_venue_site',
  ])

  const updateCompte = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: unknown }) => {
      const normalized = DATE_FIELDS.has(field) && (value === '' || value === undefined) ? null : value
      const { error } = await supabase.from('etablissements').update({ [field]: normalized } as never).eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(sanitizeSupabaseError(error)),
  })

  const addCompte = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('etablissements').insert({
        nom: 'Nouveau compte',
        statut: 'Prospect',
        type_etablissement: 'Public',
      } as never)
      if (error) throw error
    },
    onSuccess: () => { invalidate(); toast.success('Compte ajouté') },
    onError: (error: Error) => toast.error(sanitizeSupabaseError(error)),
  })

  const deleteCompte = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('etablissements').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { invalidate(); toast.success('Compte supprimé') },
    onError: (error: Error) => toast.error(sanitizeSupabaseError(error)),
  })

  return {
    handleUpdate: (id: string, field: string, value: unknown) => updateCompte.mutate({ id, field, value }),
    handleAdd: () => addCompte.mutate(),
    handleDelete: (id: string, nom: string) => {
      if (!confirm(`Supprimer le compte "${nom}" ?`)) return
      deleteCompte.mutate(id)
    },
  }
}
