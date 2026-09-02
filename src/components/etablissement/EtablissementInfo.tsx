import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { supabase } from '@/integrations/supabase/client'
import { etablissementKeys } from '@/hooks/crm/useEtablissements'
import { toast } from 'sonner'

import { formatCurrency } from '@/lib/formatters'
import { DatePickerWithInput } from '@/components/ui/date-picker-input'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { SimulatorSection } from '@/components/simulator'
import { CallButton } from '@/components/cti/CallButton'
import { useEtablissementGroupeFacturation } from '@/hooks/crm/useEtablissementGroupeFacturation'
import { Users, Building2, Lock } from 'lucide-react'

const PERIODICITE_LABELS: Record<string, string> = {
  mensuel: 'Mensuel',
  trimestriel: 'Trimestriel',
  semestriel: 'Semestriel',
  annuel: 'Annuel',
}

const MODE_PAIEMENT_LABELS: Record<string, string> = {
  virement: 'Virement bancaire',
  prelevement: 'Prélèvement SEPA',
  cheque: 'Chèque',
  carte: 'Carte bancaire',
}

const VECTEUR_ACHAT_LABELS: Record<string, string> = {
  direct: 'Direct',
  resah_asm: 'Resah - ASM',
  ugap_scc: 'UGAP - SCC',
  softway: 'Softway',
  softway_markdown: 'Softway Markdown',
  inconnu: 'Inconnu',
}

const PALIER_KEYS = ['palier1', 'palier2', 'palier3', 'palier4'] as const
const PALIER_COLORS = [
  { border: 'border-red-200 bg-red-50', dot: 'bg-red-500', text: 'text-red-700' },
  { border: 'border-orange-200 bg-orange-50', dot: 'bg-orange-500', text: 'text-orange-700' },
  { border: 'border-yellow-200 bg-yellow-50', dot: 'bg-yellow-500', text: 'text-yellow-700' },
  { border: 'border-green-200 bg-green-50', dot: 'bg-green-500', text: 'text-green-700' },
]

const normalizePalierValue = (value?: string | null) => {
  if (!value) return ''
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s_-]/g, '')
}

const formatPalierLabel = (value?: string | null) => {
  const normalized = normalizePalierValue(value)
  const match = normalized.match(/pall?ier(\d+)/) || normalized.match(/^(\d+)$/)
  if (match?.[1]) return `Palier ${match[1]}`
  return value || null
}

const isPalierSelected = (value: string | null | undefined, key: string, index: number) => {
  const normalized = normalizePalierValue(value)
  const number = String(index + 1)
  return (
    normalized === key ||
    normalized === `palier${number}` ||
    normalized === `pallier${number}` ||
    normalized === number
  )
}

const hasDisplayableAmount = (value: unknown) =>
  value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))

interface EtablissementInfoProps {
  etablissement: {
    id: string
    nom: string
    type: string
    statut: string
    adresse: string
    code_postal: string
    ville: string
    region: string
    telephone?: string
    email?: string
    date_signature?: string
    date_previsionnelle_signature?: string
    date_go_live?: string
    notes?: string
    type_offre?: string
    pallier_vise?: string
    pallier_realise?: string
    date_fin_contrat?: string
    nombre_passages_urgences_annuel?: number
    dpi?: string
    directeur_general_nom?: string
    directeur_general_prenom?: string
    directeur_general_email?: string
    siren_client?: string
    modele_statique_succes?: string
    modules_proposes?: string[]
    apporteurs_affaires_ids?: string[]

    client_facturation?: string | null
    periodicite_paiement?: string | null
    paiement_initial?: number | null
    email_facturation?: string | null
    adresse_facturation?: string | null
    siret_facturation?: string | null
    conditions_paiement_defaut?: string | null
    mode_paiement_prefere?: string | null
    vecteur_achat?: string | null

    seuils_palliers?: any
    tarifs_palliers?: any
  }
}

export function EtablissementInfo({ etablissement }: EtablissementInfoProps) {
  const [isUpdating, setIsUpdating] = useState(false)
  const queryClient = useQueryClient()

  // Apporteurs d'affaires (partenaires taggés "apporteur-affaires")
  const { data: apporteursList = [] } = useQuery({
    queryKey: ['partenaires', 'apporteurs-affaires'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partenaires')
        .select('id, nom')
        .contains('tags', ['apporteur-affaires'])
        .order('nom')
      if (error) throw error
      return (data ?? []) as { id: string; nom: string }[]
    },
    staleTime: 5 * 60 * 1000,
  })

  const apporteursCibles = (etablissement.apporteurs_affaires_ids ?? [])
    .map((id) => apporteursList.find((a) => a.id === id))
    .filter((a): a is { id: string; nom: string } => Boolean(a))

  // Mode facturation : groupe vs établissement (fallback = établissement)
  const isGroupeMode = etablissement.client_facturation === 'groupe'

  // Récupérer les données du groupe si mode groupe
  const { data: groupeData, isLoading: isLoadingGroupeFacturation } =
    useEtablissementGroupeFacturation(etablissement.id, isGroupeMode)

  // Source unifiée de la configuration contractuelle
  const contractReady = !isGroupeMode || Boolean(groupeData)
  const contract =
    isGroupeMode && groupeData
      ? {
          source: 'groupe' as const,
          sourceLabel: 'Groupe' as const,
          groupe_nom: groupeData.groupe_nom,
          type_offre: groupeData.type_offre,
          periodicite_paiement: groupeData.periodicite_paiement,
          pallier_vise: groupeData.pallier_vise,
          pallier_realise: null as string | null,
          modele_statique_succes: groupeData.modele_statique_succes as string | number | null,
          tarifs_palliers: (groupeData.tarifs_palliers || {}) as Record<string, number>,
          paiement_initial: groupeData.paiement_initial,
          email_facturation: groupeData.email_facturation,
          adresse_facturation: groupeData.adresse_facturation,
          siret_facturation: groupeData.siret_facturation,
          conditions_paiement_defaut: groupeData.conditions_paiement_defaut,
          mode_paiement_prefere: groupeData.mode_paiement_prefere,
          vecteur_achat: groupeData.vecteur_achat,
          seuils_palliers: null as any,
        }
      : {
          source: 'etablissement' as const,
          sourceLabel: 'Établissement' as const,
          groupe_nom: null as string | null,
          type_offre: etablissement.type_offre ?? null,
          periodicite_paiement: etablissement.periodicite_paiement ?? null,
          pallier_vise: etablissement.pallier_vise ?? null,
          pallier_realise: etablissement.pallier_realise ?? null,
          modele_statique_succes: etablissement.modele_statique_succes ?? null,
          tarifs_palliers: (etablissement.tarifs_palliers || {}) as Record<string, number>,
          paiement_initial: etablissement.paiement_initial ?? null,
          email_facturation: etablissement.email_facturation ?? null,
          adresse_facturation: etablissement.adresse_facturation ?? null,
          siret_facturation: etablissement.siret_facturation ?? null,
          conditions_paiement_defaut: etablissement.conditions_paiement_defaut ?? null,
          mode_paiement_prefere: etablissement.mode_paiement_prefere ?? null,
          vecteur_achat: etablissement.vecteur_achat ?? null,
          seuils_palliers: etablissement.seuils_palliers,
        }

  const contractReadOnly = isGroupeMode
  const isStaticModelActive = contract.type_offre === 'Statique' || contract.type_offre === 'Mixte'
  const isSuccessModelActive =
    contract.type_offre === 'Au succès' || contract.type_offre === 'Mixte'

  // Vérifier si aucune offre n'est définie
  const hasNoOffer = contractReady && (!contract.type_offre || contract.type_offre === 'non_defini')

  // Vérifier si aucun chiffre n'est présent
  const tarifsKeys = Object.keys(contract.tarifs_palliers)
  const hasNoNumbers =
    contractReady &&
    !contract.modele_statique_succes &&
    (tarifsKeys.length === 0 || (tarifsKeys.length === 1 && (contract.tarifs_palliers as any).fixe))

  // Afficher le simulateur si les deux conditions sont vraies
  const shouldShowSimulator = hasNoOffer && hasNoNumbers

  const updateField = async (
    field: string,
    value: string | number | string[] | null | undefined | Record<string, number>
  ) => {
    if (isUpdating) return
    setIsUpdating(true)

    const { error } = await supabase
      .from('etablissements')
      .update({ [field]: value } as never)
      .eq('id', etablissement.id)

    if (error) {
      toast.error(`Erreur lors de la mise à jour`)
    } else {
      toast.success('Mis à jour avec succès')
      // Invalidate queries instead of reloading the page
      queryClient.invalidateQueries({ queryKey: etablissementKeys.detail(etablissement.id) })
    }

    setIsUpdating(false)
  }

  const getStatutBadge = (statut: string) => {
    switch (statut) {
      case 'Contractuel':
        return <Badge variant="secondary">Contractuel</Badge>
      case 'Conformité':
        return <Badge className="bg-warning text-warning-foreground">Conformité</Badge>
      case 'Déploiement':
        return <Badge className="bg-primary text-primary-foreground">Déploiement</Badge>
      case 'Formation':
        return <Badge className="bg-accent text-accent-foreground">Formation</Badge>
      case 'Go-Live':
        return <Badge className="bg-success text-success-foreground">Go-Live</Badge>
      case 'Production':
        return <Badge className="bg-success text-success-foreground">Production</Badge>
      default:
        return <Badge variant="outline">{statut}</Badge>
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Informations générales - Style glassmorphism */}
      <Card className="bg-card/80 backdrop-blur-sm border-l-4 border-l-primary border-primary/10 shadow-lg hover:shadow-xl transition-shadow">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <span className="text-primary text-sm">📋</span>
            </div>
            Informations générales
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Type</label>
              <p className="text-sm font-medium">{etablissement.type}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Statut</label>
              <Select
                value={etablissement.statut}
                onValueChange={async (value) => {
                  const { error } = await supabase
                    .from('etablissements')
                    .update({ statut: value as any })
                    .eq('id', etablissement.id)

                  if (error) {
                    toast.error('Erreur lors de la mise à jour du statut')
                  } else {
                    toast.success('Statut mis à jour')
                    queryClient.invalidateQueries({
                      queryKey: etablissementKeys.detail(etablissement.id),
                    })
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>{getStatutBadge(etablissement.statut)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Prospect">Prospect</SelectItem>
                  <SelectItem value="Négociation">Négociation</SelectItem>
                  <SelectItem value="Contractuel">Contractuel</SelectItem>
                  <SelectItem value="Conformité">Conformité</SelectItem>
                  <SelectItem value="Déploiement">Déploiement</SelectItem>
                  <SelectItem value="Formation">Formation</SelectItem>
                  <SelectItem value="Go-Live">Go-Live</SelectItem>
                  <SelectItem value="Production">Production</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">Adresse complète</label>
            <p className="text-sm">
              {etablissement.adresse}
              <br />
              {etablissement.code_postal} {etablissement.ville}
              <br />
              {etablissement.region}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Téléphone</label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  type="tel"
                  defaultValue={etablissement.telephone || ''}
                  onBlur={(e) => {
                    if (e.target.value !== etablissement.telephone) {
                      updateField('telephone', e.target.value || null)
                    }
                  }}
                  placeholder="Téléphone"
                  disabled={isUpdating}
                  className="flex-1"
                />
                {etablissement.telephone && (
                  <CallButton
                    phoneNumber={etablissement.telephone}
                    displayName={etablissement.nom}
                    etablissementId={etablissement.id}
                    iconOnly
                    variant="outline"
                  />
                )}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Email</label>
              <Input
                type="email"
                defaultValue={etablissement.email || ''}
                onBlur={(e) => {
                  if (e.target.value !== etablissement.email) {
                    updateField('email', e.target.value || null)
                  }
                }}
                placeholder="Email"
                disabled={isUpdating}
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Date de signature</label>
              <DatePickerWithInput
                value={etablissement.date_signature || null}
                onChange={(dateStr) => updateField('date_signature', dateStr)}
                disabled={isUpdating}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Date de signature prévisionnelle
              </label>
              <DatePickerWithInput
                value={etablissement.date_previsionnelle_signature || null}
                onChange={(dateStr) => updateField('date_previsionnelle_signature', dateStr)}
                disabled={isUpdating}
              />
            </div>
          </div>

          {etablissement.statut === 'Production' && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Date de déploiement
              </label>
              <DatePickerWithInput
                value={etablissement.date_go_live || null}
                onChange={(dateStr) => updateField('date_go_live', dateStr)}
                disabled={isUpdating}
              />
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Nombre de passages aux urgences annuel
            </label>
            <Input
              type="number"
              defaultValue={etablissement.nombre_passages_urgences_annuel || ''}
              onBlur={(e) => {
                const newValue = e.target.value ? parseInt(e.target.value) : null
                if (newValue !== etablissement.nombre_passages_urgences_annuel) {
                  updateField('nombre_passages_urgences_annuel', newValue)
                }
              }}
              placeholder="Nombre de passages"
              disabled={isUpdating}
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">DPI</label>
            <Select
              value={etablissement.dpi || ''}
              onValueChange={(value) => updateField('dpi', value || null)}
              disabled={isUpdating}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Sélectionner le DPI" />
              </SelectTrigger>
              <SelectContent className="z-50 bg-popover">
                <SelectItem value="Hopital Manager">Hopital Manager</SelectItem>
                <SelectItem value="ORBIS">ORBIS</SelectItem>
                <SelectItem value="Care4U">Care4U</SelectItem>
                <SelectItem value="Easily">Easily</SelectItem>
                <SelectItem value="Axigate">Axigate</SelectItem>
                <SelectItem value="ResUrgences">ResUrgences</SelectItem>
                <SelectItem value="Terminal Urgences">Terminal Urgences</SelectItem>
                <SelectItem value="Sillage">Sillage</SelectItem>
                <SelectItem value="Cerner">Cerner</SelectItem>
                <SelectItem value="UrQual">UrQual</SelectItem>
                <SelectItem value="TrakCare">TrakCare</SelectItem>
                <SelectItem value="DxCare">DxCare</SelectItem>
                <SelectItem value="Xtreme Santé">Xtreme Santé</SelectItem>
                <SelectItem value="M-Crossway">M-Crossway</SelectItem>
                <SelectItem value="Mediburn">Mediburn</SelectItem>
                <SelectItem value="Maincare">Maincare</SelectItem>
                <SelectItem value="Autre Lourd">Autre Lourd</SelectItem>
                <SelectItem value="Autre Web">Autre Web</SelectItem>
                <SelectItem value="Inconnu">Inconnu</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">SIREN client</label>
            <Input
              type="text"
              defaultValue={etablissement.siren_client || ''}
              onBlur={(e) => {
                if (e.target.value !== etablissement.siren_client) {
                  updateField('siren_client', e.target.value || null)
                }
              }}
              placeholder="SIREN"
              disabled={isUpdating}
              className="mt-1"
            />
          </div>

          {(etablissement.notes || true) && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Notes</label>
              <Textarea
                defaultValue={etablissement.notes || ''}
                onBlur={(e) => {
                  if (e.target.value !== etablissement.notes) {
                    updateField('notes', e.target.value || null)
                  }
                }}
                placeholder="Notes..."
                disabled={isUpdating}
                className="mt-1"
                rows={3}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Informations contractuelles - Style glassmorphism */}
      <Card className="bg-card/80 backdrop-blur-sm border-l-4 border-l-amber-500 border-amber-500/10 shadow-lg hover:shadow-xl transition-shadow">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-500/5 flex items-center justify-center">
              <span className="text-amber-600 text-sm">📄</span>
            </div>
            Informations contractuelles
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {/* Bandeau mode de facturation */}
          <div
            className={`flex items-start gap-3 p-3 rounded-lg border ${isGroupeMode ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'}`}
          >
            {isGroupeMode ? (
              <Users className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            ) : (
              <Building2 className="h-5 w-5 text-slate-600 mt-0.5 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant={isGroupeMode ? 'default' : 'secondary'}
                  className={isGroupeMode ? 'bg-blue-600' : ''}
                >
                  {isGroupeMode ? 'Facturation Groupe' : 'Facturation Établissement'}
                </Badge>
                {isGroupeMode && groupeData?.groupe_nom && (
                  <span className="text-sm font-medium text-blue-900 truncate">
                    {groupeData.groupe_nom}
                  </span>
                )}
              </div>
              {isGroupeMode && groupeData && (
                <p className="text-xs text-blue-700 mt-1 flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  Configuration partagée avec {groupeData.etablissements_en_facturation_groupe}{' '}
                  établissement{groupeData.etablissements_en_facturation_groupe > 1 ? 's' : ''} —
                  modifiable dans l'onglet Facturation
                </p>
              )}
            </div>
          </div>

          {isGroupeMode && isLoadingGroupeFacturation && (
            <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
              Chargement de la configuration de facturation du groupe…
            </div>
          )}

          {isGroupeMode && !isLoadingGroupeFacturation && !groupeData && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
              Aucune configuration groupe n'a été trouvée pour cet établissement. Vérifiez
              l'association au groupe dans l'onglet Facturation.
            </div>
          )}

          {contractReady && (
            <>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Type d'offre</label>
                <Select
                  value={contract.type_offre || 'non_defini'}
                  disabled={contractReadOnly || isUpdating}
                  onValueChange={async (value) => {
                    if (contractReadOnly) return
                    const updateData: Record<string, any> = {
                      type_offre: value === 'non_defini' ? null : value,
                    }
                    if (value !== 'Au succès' && value !== 'Mixte') {
                      updateData.pallier_vise = null
                    }
                    if (value === 'non_defini') {
                      updateData.tarifs_palliers = null
                      updateData.seuils_palliers = null
                      updateData.modele_statique_succes = null
                    }
                    const { error } = await supabase
                      .from('etablissements')
                      .update(updateData as never)
                      .eq('id', etablissement.id)
                    if (error) {
                      toast.error("Erreur lors de la mise à jour du type d'offre")
                    } else {
                      toast.success("Type d'offre mis à jour")
                      queryClient.invalidateQueries({
                        queryKey: etablissementKeys.detail(etablissement.id),
                      })
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sélectionner le type d'offre" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Statique">Statique</SelectItem>
                    <SelectItem value="Au succès">Au succès</SelectItem>
                    <SelectItem value="Mixte">Mixte</SelectItem>
                    <SelectItem value="non_defini">Non défini</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Données reprises de l'onglet Facturation */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Client de facturation
                  </label>
                  <p className="text-sm font-medium mt-1">{contract.sourceLabel}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Groupe de facturation
                  </label>
                  <p className="text-sm font-medium mt-1">
                    {contract.groupe_nom || (
                      <span className="text-muted-foreground italic">Non applicable</span>
                    )}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Périodicité de paiement
                  </label>
                  <p className="text-sm font-medium mt-1">
                    {contract.periodicite_paiement ? (
                      PERIODICITE_LABELS[contract.periodicite_paiement] ||
                      contract.periodicite_paiement
                    ) : (
                      <span className="text-muted-foreground italic">Non définie</span>
                    )}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Paiement initial
                  </label>
                  <p className="text-sm font-medium mt-1">
                    {hasDisplayableAmount(contract.paiement_initial) ? (
                      formatCurrency(Number(contract.paiement_initial))
                    ) : (
                      <span className="text-muted-foreground italic">Aucun</span>
                    )}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Conditions de paiement
                  </label>
                  <p className="text-sm font-medium mt-1">
                    {contract.conditions_paiement_defaut || (
                      <span className="text-muted-foreground italic">Non définies</span>
                    )}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Mode de paiement
                  </label>
                  <p className="text-sm font-medium mt-1">
                    {contract.mode_paiement_prefere ? (
                      MODE_PAIEMENT_LABELS[contract.mode_paiement_prefere] ||
                      contract.mode_paiement_prefere
                    ) : (
                      <span className="text-muted-foreground italic">Non défini</span>
                    )}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Vecteur d'achat
                  </label>
                  <p className="text-sm font-medium mt-1">
                    {contract.vecteur_achat ? (
                      VECTEUR_ACHAT_LABELS[contract.vecteur_achat] || contract.vecteur_achat
                    ) : (
                      <span className="text-muted-foreground italic">Non défini</span>
                    )}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Email de facturation
                  </label>
                  <p className="text-sm font-medium mt-1 break-words">
                    {contract.email_facturation || (
                      <span className="text-muted-foreground italic">Non renseigné</span>
                    )}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    SIRET de facturation
                  </label>
                  <p className="text-sm font-medium mt-1 break-words">
                    {contract.siret_facturation || (
                      <span className="text-muted-foreground italic">Non renseigné</span>
                    )}
                  </p>
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Adresse de facturation
                  </label>
                  <p className="text-sm font-medium mt-1 whitespace-pre-wrap break-words">
                    {contract.adresse_facturation || (
                      <span className="text-muted-foreground italic">Non renseignée</span>
                    )}
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Section Statique */}
          {contractReady &&
            (contract.modele_statique_succes ||
              (isStaticModelActive && contract.tarifs_palliers?.frais_acces)) && (
              <div className={`space-y-4 ${!isStaticModelActive ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-semibold text-muted-foreground">
                    Modèle Statique
                  </label>
                  {isStaticModelActive && (
                    <Badge variant="default" className="text-xs">
                      Actif
                    </Badge>
                  )}
                </div>

                {contract.tarifs_palliers?.frais_acces && isStaticModelActive && (
                  <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-amber-700">Frais d'accès</span>
                        <p className="text-xs text-amber-600">Facturé une seule fois</p>
                      </div>
                      <span className="text-xl font-bold text-amber-700">
                        {formatCurrency(Number(contract.tarifs_palliers.frais_acces))}
                      </span>
                    </div>
                  </div>
                )}

                {contract.modele_statique_succes && (
                  <div className="bg-primary/10 p-4 rounded-lg border border-primary/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-primary">Tarif annuel</span>
                        <p className="text-xs text-muted-foreground">Abonnement statique</p>
                      </div>
                      <span className="text-2xl font-bold text-primary">
                        {formatCurrency(Number(contract.modele_statique_succes))}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

          {/* Modules proposés */}
          {etablissement.modules_proposes && etablissement.modules_proposes.length > 0 && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Modules proposés</label>
              <div className="flex flex-wrap gap-1 mt-1">
                {etablissement.modules_proposes.map((module) => (
                  <Badge key={`module-${module}`} variant="secondary" className="text-xs">
                    {module}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Ciblage apporteurs d'affaires */}
          {apporteursCibles.length > 0 && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Ciblage apporteurs d'affaires
              </label>
              <div className="flex flex-wrap gap-1 mt-1">
                {apporteursCibles.map((a) => (
                  <Badge key={`aa-${a.id}`} variant="secondary" className="text-xs">
                    {a.nom}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Section Au Succès - toujours 4 paliers */}
          {contractReady &&
            (isSuccessModelActive || PALIER_KEYS.some((k) => contract.tarifs_palliers?.[k])) && (
              <div className={`space-y-4 ${!isSuccessModelActive ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-semibold text-muted-foreground">
                    Modèle Au Succès
                  </label>
                  {isSuccessModelActive && (
                    <Badge variant="default" className="text-xs">
                      Actif
                    </Badge>
                  )}
                </div>

                <div className="space-y-4">
                  {/* Palliers visés et réalisés */}
                  {(contract.pallier_vise || contract.pallier_realise) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {contract.pallier_vise && (
                        <div className="bg-muted/30 p-3 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-3 h-3 rounded-full bg-primary"></div>
                            <span className="text-sm font-medium">Palier visé</span>
                          </div>
                          <p className="text-lg font-semibold text-primary break-words">
                            {formatPalierLabel(contract.pallier_vise)}
                          </p>
                        </div>
                      )}
                      {contract.pallier_realise && (
                        <div className="bg-success/10 p-3 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-3 h-3 rounded-full bg-success"></div>
                            <span className="text-sm font-medium">Palier réalisé</span>
                          </div>
                          <p className="text-lg font-semibold text-success break-words">
                            {contract.pallier_realise}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Frais d'accès */}
                  {contract.tarifs_palliers?.frais_acces && (
                    <div className="bg-accent/10 p-4 rounded-lg">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <span className="text-sm font-medium text-muted-foreground">
                          Frais d'accès au service (facturé une fois)
                        </span>
                        <span className="text-xl font-bold text-accent">
                          {formatCurrency(Number(contract.tarifs_palliers.frais_acces))}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Tarification par palier - toujours 4 emplacements */}
                  <div className="space-y-3">
                    <h6 className="text-sm font-semibold">Tarification par palier</h6>
                    <div className="space-y-2">
                      {PALIER_KEYS.map((key, index) => {
                        const tarif = contract.tarifs_palliers?.[key]
                        const seuil = contract.seuils_palliers?.[key]
                        const seuilValue =
                          typeof seuil === 'object' && seuil !== null
                            ? Object.values(seuil)[0]
                            : seuil
                        const c = PALIER_COLORS[index]
                        const pallierNum = index + 1
                        const isVise = isPalierSelected(contract.pallier_vise, key, index)
                        const hasValue = hasDisplayableAmount(tarif)

                        return (
                          <div
                            key={key}
                            className={`p-4 rounded-lg border-2 ${c.border} ${!hasValue ? 'opacity-60' : ''} ${isVise ? 'ring-2 ring-primary/40' : ''} animate-fade-in`}
                          >
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <div className="flex items-center gap-2">
                                <div className={`w-4 h-4 rounded-full ${c.dot}`}></div>
                                <div>
                                  <span className={`font-semibold ${c.text}`}>
                                    Palier {pallierNum}
                                  </span>
                                  {seuilValue != null && seuilValue !== '' && (
                                    <span className="text-xs text-muted-foreground ml-2">
                                      (≥ {String(seuilValue)}%)
                                    </span>
                                  )}
                                  {isVise && (
                                    <Badge
                                      variant="outline"
                                      className="ml-2 text-[10px] border-primary text-primary"
                                    >
                                      Visé
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <div
                                  className={`text-lg font-bold ${hasValue ? c.text : 'text-muted-foreground'}`}
                                >
                                  {hasValue ? formatCurrency(Number(tarif)) : '—'}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

          {etablissement.date_fin_contrat && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Fin de contrat</label>
              <DatePickerWithInput
                value={etablissement.date_fin_contrat || null}
                onChange={(dateStr) => updateField('date_fin_contrat', dateStr)}
                disabled={isUpdating}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Simulateur de devis - Affiché uniquement si aucune offre ni aucun chiffre n'est défini */}
      {shouldShowSimulator && (
        <SimulatorSection
          etablissementId={etablissement.id}
          etablissementNom={etablissement.nom}
          initialPassages={etablissement.nombre_passages_urgences_annuel || undefined}
        />
      )}

      {/* Informations directeur général */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Directeur général</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Prénom</label>
              <Input
                type="text"
                defaultValue={etablissement.directeur_general_prenom || ''}
                onBlur={(e) => {
                  if (e.target.value !== etablissement.directeur_general_prenom) {
                    updateField('directeur_general_prenom', e.target.value || null)
                  }
                }}
                placeholder="Prénom"
                disabled={isUpdating}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Nom</label>
              <Input
                type="text"
                defaultValue={etablissement.directeur_general_nom || ''}
                onBlur={(e) => {
                  if (e.target.value !== etablissement.directeur_general_nom) {
                    updateField('directeur_general_nom', e.target.value || null)
                  }
                }}
                placeholder="Nom"
                disabled={isUpdating}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Email</label>
              <Input
                type="email"
                defaultValue={etablissement.directeur_general_email || ''}
                onBlur={(e) => {
                  if (e.target.value !== etablissement.directeur_general_email) {
                    updateField('directeur_general_email', e.target.value || null)
                  }
                }}
                placeholder="Email"
                disabled={isUpdating}
                className="mt-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
