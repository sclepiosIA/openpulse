import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MapPin, Calendar, FileText, MoreVertical, Trash2, Mail } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useSmartNavigation } from '@/hooks/shared/useSmartNavigation'
import type { EtablissementWithGroupLogo } from '@/hooks/crm/useEtablissements'
import { cn } from '@/lib/utils'
import { EntityAvatar } from '@/components/ui/EntityAvatar'
import { supabase } from '@/integrations/supabase/client'
import { getApporteurAbbreviation } from '@/lib/apporteurAbbreviation'

/** Type pour les profils affichés dans la carte */
interface CardProfile {
  id: string
  prenom: string | null
  nom: string | null
  avatar_url?: string | null
}

interface EnhancedEtablissementCardProps {
  etablissement: EtablissementWithGroupLogo
  profiles?: CardProfile[]
  isSelectionMode?: boolean
  isSelected?: boolean
  onSelect?: (id: string) => void
  onEdit?: (etablissement: EtablissementWithGroupLogo) => void
  onDelete?: (etablissement: EtablissementWithGroupLogo) => void
}

export function EnhancedEtablissementCard({
  etablissement,
  profiles,
  isSelectionMode,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
}: EnhancedEtablissementCardProps) {
  const { smartNavigate, navigate } = useSmartNavigation()

  // Liste partagée des apporteurs d'affaires (mise en cache par React Query)
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

  const getStatutBorderColor = (statut: string) => {
    switch (statut) {
      case 'Production':
      case 'Go-Live':
        return 'border-l-success'
      case 'Déploiement':
      case 'Formation':
        return 'border-l-primary'
      case 'Négociation':
        return 'border-l-warning'
      case 'Prospect':
        return 'border-l-muted-foreground'
      default:
        return 'border-l-muted'
    }
  }

  const getStatutBadgeVariant = (statut: string) => {
    switch (statut) {
      case 'Production':
      case 'Go-Live':
        return 'default'
      case 'Déploiement':
      case 'Formation':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  const getProfileInitials = (profileId: string | null) => {
    if (!profileId || !profiles) return '?'
    const profile = profiles.find((p) => p.id === profileId)
    if (!profile) return '?'
    return `${profile.prenom?.[0] || ''}${profile.nom?.[0] || ''}`.toUpperCase()
  }

  const getProfileName = (profileId: string | null) => {
    if (!profileId || !profiles) return 'Non assigné'
    const profile = profiles.find((p) => p.id === profileId)
    if (!profile) return 'Non assigné'
    return `${profile.prenom || ''} ${profile.nom || ''}`.trim()
  }

  const isNew = () => {
    const diff = Date.now() - new Date(etablissement.created_at).getTime()
    const days = diff / (1000 * 60 * 60 * 24)
    return days <= 7
  }

  const getHealthIndicator = () => {
    const progression = etablissement.progression || 0
    if (progression < 30) return { color: 'bg-destructive', label: 'Critique' }
    if (progression < 70) return { color: 'bg-warning', label: 'Attention' }
    return { color: 'bg-success', label: 'Bon' }
  }

  const health = getHealthIndicator()

  // NOTE a11y : la carte n'a plus `role="button"` — elle contenait plusieurs
  // éléments interactifs (checkbox, menu, boutons Tâches/Emails) ce qui
  // déclenchait la règle axe `nested-interactive`. À la place, on garde le
  // clic souris pour l'ergonomie (div cliquable non-interactive au sens ARIA),
  // et le titre est un vrai <Link> pour le clavier / lecteurs d'écran.
  return (
    <Card
      data-testid="etablissement-card"
      className={cn(
        'hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer h-full flex flex-col border-l-4',
        getStatutBorderColor(etablissement.statut),
        isSelected && 'ring-2 ring-primary'
      )}
      onClick={(e) => {
        if (isSelectionMode) return
        // Ne pas re-déclencher si le clic vient d'un élément interactif enfant
        const target = e.target as HTMLElement
        if (target.closest('a, button, [role="button"], input, [role="menuitem"]')) return
        smartNavigate(e, `/etablissements/${etablissement.id}`)
      }}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {isSelectionMode && (
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onSelect?.(etablissement.id)}
                onClick={(e) => e.stopPropagation()}
                aria-label={`Sélectionner ${etablissement.nom}`}
                className="mt-1"
              />
            )}

            <EntityAvatar
              name={etablissement.nom}
              logoUrl={etablissement.logo_url || etablissement.groupe_logo_url}
              size="sm"
              className="flex-shrink-0 mt-0.5"
            />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-base break-words">
                  <Link
                    to={`/etablissements/${etablissement.id}`}
                    className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                  >
                    {etablissement.nom}
                  </Link>
                </CardTitle>
                {isNew() && (
                  <Badge variant="secondary" className="text-xs">
                    Nouveau
                  </Badge>
                )}
              </div>
              <CardDescription className="flex items-center gap-1 mt-1">
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="truncate">
                  {etablissement.ville}, {etablissement.region}
                </span>
              </CardDescription>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Plus d'options"
                title="Plus d'options"
                className="flex-shrink-0"
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/etablissements/${etablissement.id}`)}>
                Voir détails
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit?.(etablissement)}>Modifier</DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate(`/etablissements/${etablissement.id}?tab=taches`)}
              >
                Voir tâches
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate(`/emails?etablissement=${etablissement.id}`)}
              >
                <Mail className="w-4 h-4 mr-2" />
                Emails
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete?.(etablissement)}
                className="text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 flex-1 flex flex-col justify-between">
        {/* Statut, Santé et Progression */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge variant={getStatutBadgeVariant(etablissement.statut)}>
                {etablissement.statut}
              </Badge>
              <TooltipProvider>
                <Tooltip>
                  {/* Radix rend ici un <button> ne contenant qu'une pastille
                      colorée : l'information « santé » n'est portée que par la
                      couleur et le tooltip, invisible pour un lecteur d'écran
                      (axe `button-name`, critical). Le libellé le rend explicite. */}
                  <TooltipTrigger aria-label={`Santé : ${health.label}`}>
                    <div className={cn('w-2 h-2 rounded-full', health.color)} />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Santé: {health.label}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <span className="text-sm font-medium">{etablissement.progression || 0}%</span>
          </div>

          <div className="w-full bg-secondary rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all"
              style={{ width: `${etablissement.progression || 0}%` }}
            />
          </div>
        </div>

        {/* Informations clés */}
        <div className="space-y-2 text-sm">
          {etablissement.dpi && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                DPI: {etablissement.dpi}
              </Badge>
              {etablissement.type_offre && (
                <Badge variant="outline" className="text-xs">
                  {etablissement.type_offre}
                </Badge>
              )}
            </div>
          )}

          {apporteursCibles.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {apporteursCibles.map((a) => (
                <Badge
                  key={`aa-${a.id}`}
                  variant="outline"
                  className="text-xs"
                  title={`Apporteur d'affaires : ${a.nom}`}
                >
                  {getApporteurAbbreviation(a.nom)}
                </Badge>
              ))}
            </div>
          )}

          {etablissement.date_signature && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="w-3 h-3" />
              <span>
                Signé le {new Date(etablissement.date_signature).toLocaleDateString('fr-FR')}
              </span>
            </div>
          )}

          {/* Équipe */}
          {(etablissement.commercial_id ||
            etablissement.chef_projet_id ||
            etablissement.csm_id) && (
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <div className="flex -space-x-2">
                  {etablissement.commercial_id && (
                    <Tooltip>
                      <TooltipTrigger>
                        <Avatar className="h-7 w-7 border-2 border-background">
                          <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                            {getProfileInitials(etablissement.commercial_id)}
                          </AvatarFallback>
                        </Avatar>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Commercial: {getProfileName(etablissement.commercial_id)}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {etablissement.chef_projet_id && (
                    <Tooltip>
                      <TooltipTrigger>
                        <Avatar className="h-7 w-7 border-2 border-background">
                          <AvatarFallback className="text-xs bg-secondary text-secondary-foreground">
                            {getProfileInitials(etablissement.chef_projet_id)}
                          </AvatarFallback>
                        </Avatar>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Chef de projet: {getProfileName(etablissement.chef_projet_id)}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {etablissement.csm_id && (
                    <Tooltip>
                      <TooltipTrigger>
                        <Avatar className="h-7 w-7 border-2 border-background">
                          <AvatarFallback className="text-xs bg-accent text-accent-foreground">
                            {getProfileInitials(etablissement.csm_id)}
                          </AvatarFallback>
                        </Avatar>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>CSM: {getProfileName(etablissement.csm_id)}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </TooltipProvider>
            </div>
          )}
        </div>

        {/* Actions rapides */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-8"
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/etablissements/${etablissement.id}?tab=taches`)
            }}
          >
            <FileText className="w-3 h-3 mr-1" />
            Tâches
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-8"
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/emails?etablissement=${etablissement.id}`)
            }}
          >
            <Mail className="w-3 h-3 mr-1" />
            Emails
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
