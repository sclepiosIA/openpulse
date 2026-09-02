import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer'
import type { Database } from '@/integrations/supabase/types'
import { useAuth } from '@/components/AuthProvider'

type PendingContactRow = Database['public']['Tables']['pending_contacts']['Row']

interface ExtractedContactData {
  nom: string
  prenom?: string
  fonction?: string
  email?: string
  telephone?: string
}

interface PendingContact extends Omit<PendingContactRow, 'extracted_data'> {
  extracted_data: ExtractedContactData
}

export function usePendingContactsByPartenaire(partenaireId: string) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { data: pendingContacts = [], isLoading } = useQuery({
    queryKey: ['pending-contacts-partenaire', partenaireId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pending_contacts')
        .select(
          'id, partenaire_id, etablissement_id, email_thread_id, extracted_data, confidence, status, rejection_reason, reviewed_by, reviewed_at, created_at, updated_at'
        )
        .eq('partenaire_id', partenaireId)
        .eq('status', 'pending')
        .order('confidence', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(200)

      if (error) throw error
      return (data || []).map((item) => ({
        ...item,
        extracted_data: item.extracted_data as unknown as ExtractedContactData,
      })) as PendingContact[]
    },
    enabled: !!partenaireId,
  })

  const approvePendingContact = useMutation({
    mutationFn: async (id: string) => {
      const { data: pendingContact } = await supabase
        .from('pending_contacts')
        .select(
          'id, partenaire_id, etablissement_id, email_thread_id, extracted_data, confidence, status, reviewed_by, reviewed_at'
        )
        .eq('id', id)
        .maybeSingle()

      if (!pendingContact) throw new Error('Contact non trouvé')
      if (!user) throw new Error('User not authenticated')

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      const extractedData = pendingContact.extracted_data as unknown as ExtractedContactData

      // Vérifier si un contact avec cet email existe déjà
      if (extractedData.email) {
        const { data: existingContact } = await supabase
          .from('partenaires_contacts')
          .select('id')
          .eq('partenaire_id', pendingContact.partenaire_id!)
          .eq('email', extractedData.email)
          .maybeSingle()

        if (existingContact) {
          // Mettre à jour le contact existant
          const { error: updateContactError } = await supabase
            .from('partenaires_contacts')
            .update({
              nom: extractedData.nom,
              prenom: extractedData.prenom,
              fonction: extractedData.fonction,
              telephone: extractedData.telephone,
            })
            .eq('id', existingContact.id)

          if (updateContactError) throw updateContactError
        } else {
          // Créer un nouveau contact
          const { error: insertError } = await supabase.from('partenaires_contacts').insert({
            partenaire_id: pendingContact.partenaire_id!,
            nom: extractedData.nom,
            prenom: extractedData.prenom,
            fonction: extractedData.fonction,
            email: extractedData.email,
            telephone: extractedData.telephone,
            created_source: 'email_ai',
            created_metadata: {
              email_thread_id: pendingContact.email_thread_id,
              confidence: pendingContact.confidence,
              approved_at: new Date().toISOString(),
              reviewed_by: profile?.id,
            },
          })

          if (insertError) throw insertError
        }
      } else {
        // Créer un nouveau contact sans email
        const { error: insertError } = await supabase.from('partenaires_contacts').insert({
          partenaire_id: pendingContact.partenaire_id!,
          nom: extractedData.nom,
          prenom: extractedData.prenom,
          fonction: extractedData.fonction,
          telephone: extractedData.telephone,
          created_source: 'email_ai',
          created_metadata: {
            email_thread_id: pendingContact.email_thread_id,
            confidence: pendingContact.confidence,
            approved_at: new Date().toISOString(),
            reviewed_by: profile?.id,
          },
        })

        if (insertError) throw insertError
      }

      // Mettre à jour le statut
      const { error: updateError } = await supabase
        .from('pending_contacts')
        .update({
          status: 'approved',
          reviewed_by: profile?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (updateError) throw updateError
    },
    onSuccess: () => {
      toast.success('Contact validé avec succès')
      queryClient.invalidateQueries({ queryKey: ['pending-contacts-partenaire'] })
      queryClient.invalidateQueries({ queryKey: ['partenaires-contacts'] })
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error))
    },
  })

  const rejectPendingContact = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('User not authenticated')

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      const { error } = await supabase
        .from('pending_contacts')
        .update({
          status: 'rejected',
          rejection_reason: 'Rejeté manuellement',
          reviewed_by: profile?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Contact rejeté')
      queryClient.invalidateQueries({ queryKey: ['pending-contacts-partenaire'] })
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error))
    },
  })

  return {
    pendingContacts,
    isLoading,
    approvePendingContact: approvePendingContact.mutate,
    rejectPendingContact: rejectPendingContact.mutate,
    isApproving: approvePendingContact.isPending,
    isRejecting: rejectPendingContact.isPending,
  }
}
