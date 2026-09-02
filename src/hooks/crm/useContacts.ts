import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseBrowser'
import { useToast } from '@/hooks/shared/use-toast'
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { queryPresets } from '@/lib/queryPresets'
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types'
import { debug } from '@/lib/debug'

// Export des types pour utilisation dans d'autres composants
export type Contact = Tables<'contacts'> & {
  latest_source?: string;
  latest_update?: string;
  // CSM extension fields (added via migration, not yet in generated types)
  interlocuteur_csm?: boolean;
  influence?: string | null;
  engagement?: string | null;
}
export type InsertContact = TablesInsert<'contacts'>
export type UpdateContact = TablesUpdate<'contacts'>

const CONTACTS_QUERY_KEY = (etablissementId: string) => ['contacts', etablissementId]

export const useContacts = (etablissementId: string) => {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // UUID v4 validation regex
  const isValidUUID = (uuid: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    return uuidRegex.test(uuid)
  }

  // Fetcher function for React Query
  const fetchContacts = async (): Promise<Contact[]> => {
    if (!etablissementId || !isValidUUID(etablissementId)) {
      return []
    }
    
    try {
      // Ajouter breadcrumb Sentry pour observabilité
      if ((window as unknown as { Sentry?: { addBreadcrumb: (data: unknown) => void } }).Sentry) {
        (window as unknown as { Sentry: { addBreadcrumb: (data: unknown) => void } }).Sentry.addBreadcrumb({
          message: 'Fetching contacts via RPC',
          category: 'data.rpc',
          data: { etablissement_id: etablissementId, method: 'get_contacts_secure' }
        })
      }

      // Fetch contacts with their latest change source from history
      const { data: contactsData, error: contactsError } = await supabase
        .from('contacts')
        .select('id, etablissement_id, nom, prenom, email, telephone, fonction, type_contact, created_at, updated_at, groupe_id, niveau_contact, interlocuteur_csm, influence, engagement, est_contact_principal, created_metadata, created_source, updated_by')
        .eq('etablissement_id', etablissementId)

      if (contactsError) {
        // Handle access denied vs other errors differently
        if (contactsError.message?.includes('Access denied')) {
          toast({
            title: "Accès refusé",
            description: "Vous n'avez pas accès aux contacts de cet établissement",
            variant: "destructive"
          })
          return []
        }
        
        toast({
          title: "Erreur",
          description: "Impossible de charger les contacts",
          variant: "destructive"
        })
        throw contactsError
      }

      // For each contact, get the most recent history entry
      const contactsWithHistory = await Promise.all(
        (contactsData || []).map(async (contact) => {
          const { data: historyData } = await supabase
            .from('contacts_history')
            .select('change_source, changed_at, changed_fields')
            .eq('contact_id', contact.id)
            .order('changed_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          return {
            ...contact,
            latest_source: historyData?.change_source || 'manual',
            latest_update: historyData?.changed_at || contact.updated_at
          }
        })
      )

      return (contactsWithHistory as unknown as Contact[]).sort(
        (a: { created_at: string }, b: { created_at: string }) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    } catch (error) {
      // Handle access denied silently
      if (error instanceof Error && error.message?.includes('Access denied')) {
        return []
      }
      
      throw error
    }
  }

  // React Query hook with standardized options
  const { 
    data: contacts = [], 
    error, 
    refetch,
    isPending,
    isFetching
  } = useQuery({
    queryKey: CONTACTS_QUERY_KEY(etablissementId),
    queryFn: fetchContacts,
    enabled: !!etablissementId && isValidUUID(etablissementId),
    ...queryPresets.standard,
    retry: 3,
    meta: {
      errorMessage: "Impossible de charger les contacts"
    }
  })

  // Mutation pour ajouter un contact
  const addContactMutation = useMutation({
    mutationFn: async (contactData: Omit<InsertContact, 'etablissement_id'>) => {
      // Vérifier si un contact avec cet email existe déjà
      if (contactData.email) {
        const { data: existingContact } = await supabase
          .from('contacts')
          .select('id, nom, prenom, email')
          .eq('etablissement_id', etablissementId)
          .eq('email', contactData.email)
          .maybeSingle()
        
        if (existingContact) {
          throw new Error(`Un contact avec cet email existe déjà : ${existingContact.prenom} ${existingContact.nom}`)
        }
      }

      const { data, error } = await supabase
        .from('contacts')
        .insert({
          ...contactData,
          etablissement_id: etablissementId
        })
        .select()
        // safe: guaranteed-row
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTACTS_QUERY_KEY(etablissementId) })
      toast({
        title: "Contact ajouté",
        description: "Le contact a été ajouté avec succès"
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: sanitizeSupabaseError(error) || "Impossible d'ajouter le contact",
        variant: "destructive"
      })
    }
  })

  // Mutation pour mettre à jour un contact
  const updateContactMutation = useMutation({
    mutationFn: async ({ contactId, updates }: { contactId: string; updates: UpdateContact }) => {
      const { data, error } = await supabase
        .from('contacts')
        .update(updates)
        .eq('id', contactId)
        .select()
        // safe: guaranteed-row
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTACTS_QUERY_KEY(etablissementId) })
      toast({
        title: "Contact modifié",
        description: "Le contact a été modifié avec succès"
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: sanitizeSupabaseError(error) || "Impossible de modifier le contact",
        variant: "destructive"
      })
    }
  })

  // Mutation pour supprimer un contact
  const deleteContactMutation = useMutation({
    mutationFn: async (contactId: string) => {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', contactId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTACTS_QUERY_KEY(etablissementId) })
      toast({
        title: "Contact supprimé",
        description: "Le contact a été supprimé avec succès"
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: sanitizeSupabaseError(error) || "Impossible de supprimer le contact",
        variant: "destructive"
      })
    }
  })

  // Simplified wrapper functions using mutation's built-in state
  const addContact = (contactData: Omit<InsertContact, 'etablissement_id'>) => 
    addContactMutation.mutateAsync(contactData)

  const updateContact = (contactId: string, updates: UpdateContact) => 
    updateContactMutation.mutateAsync({ contactId, updates })

  const deleteContact = (contactId: string) => 
    deleteContactMutation.mutateAsync(contactId)

  // Mettre à jour le rôle d'un contact
  const updateContactRole = async (contactId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from('contacts')
        .update({ 
          type_contact: newRole,
          updated_at: new Date().toISOString(),
        })
        .eq('id', contactId);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: CONTACTS_QUERY_KEY(etablissementId) })
      
      toast({
        title: "Rôle mis à jour",
        description: `Le rôle du contact a été mis à jour avec succès.`,
      });
    } catch (error) {
      debug.error('Error updating contact role:', error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le rôle du contact",
        variant: "destructive",
      });
      throw error;
    }
  };

  // Attribuer un contact au groupe parent
  const assignToGroup = async (contactId: string) => {
    try {
      // Récupérer le groupe parent de l'établissement
      const { data: groupeData, error: groupeError } = await supabase
        .from('etablissements_groupes')
        .select('groupe_id, groupes_etablissements!inner(id, nom)')
        .eq('etablissement_id', etablissementId)
        .maybeSingle()

      if (groupeError) throw groupeError

      if (!groupeData || !groupeData.groupe_id) {
        toast({
          title: "Aucun groupe",
          description: "Cet établissement n'appartient à aucun groupe",
          variant: "destructive"
        })
        return
      }

      // Mettre à jour le contact
      const { error: updateError } = await supabase
        .from('contacts')
        .update({
          groupe_id: groupeData.groupe_id,
          niveau_contact: 'groupe'
        })
        .eq('id', contactId)

      if (updateError) throw updateError

      // Mise à jour du cache
      queryClient.invalidateQueries({ queryKey: CONTACTS_QUERY_KEY(etablissementId) })
      
      const groupeNom = (groupeData.groupes_etablissements as { nom?: string })?.nom || 'groupe parent'
      toast({
        title: "Contact attribué au groupe",
        description: `Le contact a été attribué au groupe "${groupeNom}"`
      })
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: sanitizeSupabaseError(error),
        variant: "destructive"
      })
      throw error
    }
  }

  // Obtenir les contacts par établissement (alias pour contacts)
  const getContactsByEtablissement = (id: string) => {
    if (id !== etablissementId) {
      // Si on demande les contacts d'un autre établissement, faire une requête directe
      return Promise.resolve([])
    }
    return Promise.resolve(contacts)
  }

  return {
    contacts,
    isLoading: isPending || isFetching,
    isPending,
    isFetching,
    error,
    addContact,
    updateContact,
    deleteContact,
    updateContactRole,
    assignToGroup,
    getContactsByEtablissement,
    refetch,
    // Expose mutation states for granular UI feedback
    isAdding: addContactMutation.isPending,
    isUpdating: updateContactMutation.isPending,
    isDeleting: deleteContactMutation.isPending
  }
}
