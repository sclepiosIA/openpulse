import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import { useToast } from '@/hooks/shared/use-toast'
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer'
import type { Devis, DevisLigne, DevisStatut } from '@/types/facturation'
import type { Database } from '@/integrations/supabase/types'

// Type aliases for insert operations
type FacturesInsert = Database['public']['Tables']['factures']['Insert']
type FacturesLignesInsert = Database['public']['Tables']['factures_lignes']['Insert']

export function useDevis(filters?: { statut?: DevisStatut; etablissementId?: string }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { user } = useAuth()

  const {
    data: devis = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['devis', filters],
    queryFn: async () => {
      let query = supabase
        .from('devis')
        .select(
          `
          *,
          etablissement:etablissements(id, nom, ville),
          contact:contacts(id, nom, prenom, email),
          commercial:profiles!devis_commercial_id_fkey(id, prenom, nom)
        `
        )
        .order('created_at', { ascending: false })

      if (filters?.statut) {
        query = query.eq('statut', filters.statut)
      }
      if (filters?.etablissementId) {
        query = query.eq('etablissement_id', filters.etablissementId)
      }

      const { data, error } = await query
      if (error) throw error
      return data as Devis[]
    },
  })

  const createDevisMutation = useMutation({
    mutationFn: async (devisData: Partial<Devis> & { lignes?: Partial<DevisLigne>[] }) => {
      const { lignes, ...devisFields } = devisData

      const insertData = {
        client_nom: devisFields.client_nom || '',
        client_adresse: devisFields.client_adresse,
        client_email: devisFields.client_email,
        client_telephone: devisFields.client_telephone,
        client_siret: devisFields.client_siret,
        etablissement_id: devisFields.etablissement_id,
        groupe_id: devisFields.groupe_id,
        partenaire_id: devisFields.partenaire_id,
        contact_id: devisFields.contact_id,
        date_emission: devisFields.date_emission,
        date_validite: devisFields.date_validite,
        conditions_paiement: devisFields.conditions_paiement,
        notes_internes: devisFields.notes_internes,
        notes_client: devisFields.notes_client,
        created_by: user?.id,
        commercial_id: devisFields.commercial_id || user?.id,
      }

      const { data: newDevis, error: devisError } = await supabase
        .from('devis')
        .insert(insertData)
        .select()
        // safe: guaranteed-row
        .single()

      if (devisError) throw devisError

      // Insert lines if provided
      if (lignes && lignes.length > 0) {
        const lignesWithDevisId = lignes.map((l, idx) => ({
          ...l,
          devis_id: newDevis.id,
          ordre: l.ordre ?? idx,
        }))

        const { error: lignesError } = await supabase.from('devis_lignes').insert(lignesWithDevisId as never)

        if (lignesError) throw lignesError
      }

      return newDevis
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devis'] })
      toast({ title: 'Devis créé avec succès' })
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur lors de la création du devis',
        description: sanitizeSupabaseError(error),
        variant: 'destructive',
      })
    },
  })

  const updateDevisMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Devis> & { id: string }) => {
      const { data, error } = await supabase
        .from('devis')
        .update(updates as never)
        .eq('id', id)
        .select()
        // safe: guaranteed-row
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devis'] })
      toast({ title: 'Devis mis à jour' })
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur lors de la mise à jour',
        description: sanitizeSupabaseError(error),
        variant: 'destructive',
      })
    },
  })

  const deleteDevisMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('devis').delete().eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devis'] })
      toast({ title: 'Devis supprimé' })
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur lors de la suppression',
        description: sanitizeSupabaseError(error),
        variant: 'destructive',
      })
    },
  })

  const convertToFactureMutation = useMutation({
    mutationFn: async (devisId: string) => {
      // Get devis with lines
      const { data: devisData, error: fetchError } = await supabase
        .from('devis')
        .select(
          `
          *,
          lignes:devis_lignes(*)
        `
        )
        .eq('id', devisId)
        .maybeSingle()

      if (fetchError) throw fetchError
      if (!devisData) throw new Error('Devis introuvable ou supprimé')

      // Create facture - use type assertion for insert compatibility
      interface FactureInsertData {
        etablissement_id: string | null
        groupe_id: string | null
        partenaire_id: string | null
        contact_id: string | null
        client_nom: string
        client_adresse: string | null
        client_email: string | null
        client_telephone: string | null
        client_siret: string | null
        conditions_paiement: string | null
        notes_internes: string | null
        notes_client: string | null
        devis_id: string
        created_by: string | undefined
        commercial_id: string | null
        statut: string
      }

      const factureInsertData: FactureInsertData = {
        etablissement_id: devisData.etablissement_id,
        groupe_id: devisData.groupe_id,
        partenaire_id: devisData.partenaire_id,
        contact_id: devisData.contact_id,
        client_nom: devisData.client_nom,
        client_adresse: devisData.client_adresse,
        client_email: devisData.client_email,
        client_telephone: devisData.client_telephone,
        client_siret: devisData.client_siret,
        conditions_paiement: devisData.conditions_paiement,
        notes_internes: devisData.notes_internes,
        notes_client: devisData.notes_client,
        devis_id: devisId,
        created_by: user?.id,
        commercial_id: devisData.commercial_id,
        statut: 'brouillon',
      }

      const { data: newFacture, error: factureError } = await supabase
        .from('factures')
        .insert(factureInsertData as unknown as FacturesInsert)
        .select()
        // safe: guaranteed-row
        .single()

      if (factureError) throw factureError

      // Copy lines with proper typing
      interface DevisLigneData {
        id: string
        produit_id: string | null
        ordre: number
        designation: string
        description: string | null
        quantite: number
        unite: string
        prix_unitaire_ht: number
        taux_tva: number
        remise_pourcent: number | null
      }

      if (devisData.lignes && devisData.lignes.length > 0) {
        const factureLines: FacturesLignesInsert[] = (devisData.lignes as DevisLigneData[]).map(
          (l) => ({
            facture_id: newFacture.id,
            produit_id: l.produit_id,
            devis_ligne_id: l.id,
            ordre: l.ordre,
            designation: l.designation,
            description: l.description,
            quantite: l.quantite,
            unite: l.unite || 'unité',
            prix_unitaire_ht: l.prix_unitaire_ht,
            taux_tva: l.taux_tva,
            remise_pourcent: l.remise_pourcent,
          })
        )

        const { error: lignesError } = await supabase.from('factures_lignes').insert(factureLines)

        if (lignesError) throw lignesError
      }

      // Update devis status
      await supabase
        .from('devis')
        .update({ statut: 'converti', facture_id: newFacture.id })
        .eq('id', devisId)

      return newFacture
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devis'] })
      queryClient.invalidateQueries({ queryKey: ['factures'] })
      toast({ title: 'Devis converti en facture' })
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur lors de la conversion',
        description: sanitizeSupabaseError(error),
        variant: 'destructive',
      })
    },
  })

  return {
    devis,
    isLoading,
    error,
    createDevis: createDevisMutation.mutateAsync,
    updateDevis: updateDevisMutation.mutateAsync,
    deleteDevis: deleteDevisMutation.mutateAsync,
    convertToFacture: convertToFactureMutation.mutateAsync,
    isCreating: createDevisMutation.isPending,
    isUpdating: updateDevisMutation.isPending,
    isDeleting: deleteDevisMutation.isPending,
    isConverting: convertToFactureMutation.isPending,
  }
}

export function useDevisDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['devis', id],
    queryFn: async () => {
      if (!id) return null

      const { data, error } = await supabase
        .from('devis')
        .select(
          `
          *,
          etablissement:etablissements(id, nom, ville, adresse),
          contact:contacts(id, nom, prenom, email, telephone),
          commercial:profiles!devis_commercial_id_fkey(id, prenom, nom),
          lignes:devis_lignes(
            *,
            produit:catalogue_produits(*)
          )
        `
        )
        .eq('id', id)
        .maybeSingle()

      if (error) throw error
      return (data ?? null) as Devis | null
    },
    enabled: !!id,
  })
}
