import { useForm } from 'react-hook-form'
import { debug } from '@/lib/debug'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useCreateEtablissement, type CreateEtablissementData } from '@/hooks/crm/useEtablissements'
import { CreateEtablissementSchema } from '@/lib/validations'
import { useProfilesWithRoles } from '@/hooks/profile/useProfilesWithRoles'
import { EtablissementForm } from '@/components/etablissement/EtablissementForm'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { removeUndefinedFields } from '@/lib/utils/objectHelpers'

interface EtablissementCreateFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialDomain?: string
  /**
   * Contexte d'appel (ex: "prospect") pour adapter le wording du dialogue.
   * Un prospect EST un établissement avec statut = "Prospect" en base, mais on évite
   * le wording « Créer un nouvel établissement » dans le pipeline commercial pour
   * lever l'ambiguïté UX remontée par l'audit browser-use 2026-05-28.
   */
  context?: 'etablissement' | 'prospect'
}

export function EtablissementCreateForm({
  open,
  onOpenChange,
  initialDomain,
  context = 'etablissement',
}: EtablissementCreateFormProps) {
  const { data: allProfiles } = useProfilesWithRoles()
  const createEtablissement = useCreateEtablissement()
  const queryClient = useQueryClient()

  const form = useForm<CreateEtablissementData>({
    resolver: zodResolver(CreateEtablissementSchema),
    mode: 'onBlur',
    defaultValues: {
      nom: '',
      type: 'CH',
      ville: '',
      region: '',
      date_prise_contact: new Date().toISOString().split('T')[0],
      date_signature: '',
      date_fin_contrat: '',
      statut: 'Prospect',
      adresse: '',
      code_postal: '',
      telephone: '',
      email: '',
      type_offre: '',
      notes: initialDomain ? `Domaine email détecté: ${initialDomain}` : '',
      commercial_id: '',
      chef_projet_id: '',
      csm_id: '',
      nombre_passages_urgences_annuel: undefined,
      dpi: undefined,
      directeur_general_nom: '',
      directeur_general_prenom: '',
      directeur_general_email: '',
      siren_client: '',
      date_previsionnelle_signature: '',
      date_go_live: '',
      modules_proposes: [],
      modele_statique_succes: '',
      stats_utilisation_url: '',
      stats_urgences_url: '',
    },
  })

  const onSubmit = async (data: CreateEtablissementData) => {
    try {
      // Préparer les données avec conversions
      const preparedData = {
        ...data,
        // UUIDs : "" ou "none" ou "unassigned" → undefined (couverture complète)
        commercial_id:
          !data.commercial_id ||
          data.commercial_id === 'none' ||
          data.commercial_id === 'unassigned'
            ? undefined
            : data.commercial_id,
        chef_projet_id:
          !data.chef_projet_id ||
          data.chef_projet_id === 'none' ||
          data.chef_projet_id === 'unassigned'
            ? undefined
            : data.chef_projet_id,
        csm_id:
          !data.csm_id || data.csm_id === 'none' || data.csm_id === 'unassigned'
            ? undefined
            : data.csm_id,

        // Dates : "" → undefined
        date_signature: data.date_signature === '' ? undefined : data.date_signature,
        date_fin_contrat: data.date_fin_contrat === '' ? undefined : data.date_fin_contrat,
        date_previsionnelle_signature:
          data.date_previsionnelle_signature === ''
            ? undefined
            : data.date_previsionnelle_signature,
        date_go_live: data.date_go_live === '' ? undefined : data.date_go_live,

        // Textes optionnels : "" → undefined
        adresse: data.adresse === '' ? undefined : data.adresse,
        code_postal: data.code_postal === '' ? undefined : data.code_postal,
        telephone: data.telephone === '' ? undefined : data.telephone,
        email: data.email === '' ? undefined : data.email,
        type_offre: data.type_offre === '' ? undefined : data.type_offre,
        notes: data.notes === '' ? undefined : data.notes,
        directeur_general_nom:
          data.directeur_general_nom === '' ? undefined : data.directeur_general_nom,
        directeur_general_prenom:
          data.directeur_general_prenom === '' ? undefined : data.directeur_general_prenom,
        directeur_general_email:
          data.directeur_general_email === '' ? undefined : data.directeur_general_email,
        siren_client: data.siren_client === '' ? undefined : data.siren_client,
        modele_statique_succes:
          data.modele_statique_succes === '' ? undefined : data.modele_statique_succes,
        stats_utilisation_url:
          data.stats_utilisation_url === '' ? undefined : data.stats_utilisation_url,
        stats_urgences_url: data.stats_urgences_url === '' ? undefined : data.stats_urgences_url,

        // Numériques : null → undefined
        nombre_passages_urgences_annuel:
          data.nombre_passages_urgences_annuel === null
            ? undefined
            : data.nombre_passages_urgences_annuel,
        // DPI : falsy → undefined
        dpi: !data.dpi ? undefined : data.dpi,
      }

      // Nettoyer l'objet en supprimant toutes les clés avec undefined
      const cleanedData = removeUndefinedFields(preparedData) as CreateEtablissementData

      // Envoyer uniquement les champs définis
      const result = await createEtablissement.mutateAsync(cleanedData)

      // Si un domaine initial a été fourni, créer automatiquement le mapping
      if (initialDomain && result?.id) {
        await supabase.from('email_domain_mappings').insert({
          etablissement_id: result.id,
          domain: initialDomain.toLowerCase().trim(),
          niveau_mapping: 'etablissement',
          confidence_level: 'high',
          verified: true,
          is_excluded: false,
        })

        // Invalider les caches pour rafraîchir les listes
        queryClient.invalidateQueries({ queryKey: ['unclassified-domains'] })
        queryClient.invalidateQueries({ queryKey: ['email-domain-mappings'] })
        queryClient.invalidateQueries({ queryKey: ['email-threads'] })
      }

      form.reset()
      onOpenChange(false)
    } catch (error) {
      debug.error('Error creating etablissement:', error)
    }
  }

  const handleCancel = () => {
    form.reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {context === 'prospect' ? 'Créer un nouveau prospect' : 'Créer un nouvel établissement'}
          </DialogTitle>
          <DialogDescription>
            {context === 'prospect'
              ? 'Ajoutez un nouveau prospect à votre pipeline commercial'
              : 'Ajoutez un nouvel établissement à votre portefeuille'}
          </DialogDescription>
        </DialogHeader>

        <EtablissementForm
          form={form}
          onSubmit={onSubmit}
          onCancel={handleCancel}
          submitLabel={context === 'prospect' ? 'Créer le prospect' : "Créer l'établissement"}
          isLoading={createEtablissement.isPending}
          allProfiles={allProfiles}
        />
      </DialogContent>
    </Dialog>
  )
}
