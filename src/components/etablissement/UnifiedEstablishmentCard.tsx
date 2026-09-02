import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  MapPin,
  Calendar,
  MoreVertical,
  Trash2,
  Edit,
  Eye,
  AlertCircle,
  DollarSign,
} from 'lucide-react'
import { EntityAvatar } from '@/components/ui/EntityAvatar'
import { cn } from '@/lib/utils'
import type { EtablissementWithGroupLogo as Etablissement } from '@/hooks/crm/useEtablissements'
import type { HealthScore } from '@/hooks/production/useDeploymentHealth'
import type { CustomerHealthScore } from '@/hooks/crm/useCustomerHealth'
import {
  getStatusBorderColor,
  getStatusBadgeVariant,
  getPhaseFromStatus,
  type EstablishmentPhase,
} from '@/config/statusConfig'
import { getCardConfig } from '@/config/cardConfig'
import { calculateEtablissementValue } from '@/lib/valueCalculations'
import { formatCurrency, getMonthsInProduction, getRenewalInfo } from '@/lib/productionUtils'

interface UnifiedEstablishmentCardProps {
  etablissement: Etablissement
  /** Force une phase spécifique (sinon auto-détectée via statut) */
  phase?: EstablishmentPhase
  /** Profils pour afficher les noms de l'équipe */
  profiles?: any[]
  /** Score de santé déploiement */
  deploymentHealth?: HealthScore
  /** Score de santé production */
  productionHealth?: CustomerHealthScore
  /** Métriques de santé production */
  healthMetrics?: any
  /** Mode sélection active */
  isSelectionMode?: boolean
  /** Carte sélectionnée */
  isSelected?: boolean
  /** Callback de sélection */
  onSelect?: (id: string) => void
  /** Callback d'édition */
  onEdit?: (etablissement: Etablissement) => void
  /** Callback de suppression */
  onDelete?: (etablissement: Etablissement) => void
}

export function UnifiedEstablishmentCard({
  etablissement,
  phase: forcedPhase,
  profiles,
  deploymentHealth,
  productionHealth,
  healthMetrics,
  isSelectionMode,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
}: UnifiedEstablishmentCardProps) {
  const navigate = useNavigate()

  // Déterminer la phase
  const phase = forcedPhase || getPhaseFromStatus(etablissement.statut)
  const config = getCardConfig(phase)

  // Calculer les données selon la phase
  const revenue = calculateEtablissementValue(etablissement)
  const monthsInProduction = getMonthsInProduction(etablissement.date_go_live)
  const adoptionRate = healthMetrics?.adoption_rate || 0
  const npsScore = healthMetrics?.nps_score
  const renewalInfo = getRenewalInfo(healthMetrics?.contract_end_date)

  // Health data unifiée
  const health =
    productionHealth ||
    (deploymentHealth
      ? {
          status: deploymentHealth.status,
          score: deploymentHealth.score,
          alerts: deploymentHealth.reasons,
        }
      : null)

  // Nouveau badge (créé dans les 7 derniers jours)
  const isNew = () => {
    const diff = Date.now() - new Date(etablissement.created_at).getTime()
    return diff / (1000 * 60 * 60 * 24) <= 7
  }

  // Helpers pour les profils
  const getProfileInitials = (profileId: string | null) => {
    if (!profileId || !profiles) return '?'
    const profile = profiles.find((p) => p.id === profileId)
    return profile ? `${profile.prenom?.[0] || ''}${profile.nom?.[0] || ''}`.toUpperCase() : '?'
  }

  const getProfileName = (profileId: string | null) => {
    if (!profileId || !profiles) return 'Non assigné'
    const profile = profiles.find((p) => p.id === profileId)
    return profile ? `${profile.prenom || ''} ${profile.nom || ''}`.trim() : 'Non assigné'
  }

  // Indicateur de santé
  const getHealthIndicator = () => {
    if (health) {
      const status = health.status as string
      if (status === 'healthy' || status === 'on-track')
        return { color: 'bg-success', label: 'Bon' }
      if (status === 'at-risk' || status === 'delayed')
        return { color: 'bg-warning', label: 'Attention' }
      if (status === 'churn-risk' || status === 'blocked')
        return { color: 'bg-destructive', label: 'Critique' }
      if (status === 'onboarding') return { color: 'bg-primary', label: 'Onboarding' }
    }
    // Fallback sur progression
    const progression = etablissement.progression || 0
    if (progression < 30) return { color: 'bg-destructive', label: 'Critique' }
    if (progression < 70) return { color: 'bg-warning', label: 'Attention' }
    return { color: 'bg-success', label: 'Bon' }
  }

  const healthIndicator = getHealthIndicator()

  const handleCardClick = (e: React.MouseEvent) => {
    if (
      (e.target as HTMLElement).closest('button, [role="checkbox"], [data-radix-collection-item]')
    ) {
      return
    }
    if (!isSelectionMode) {
      navigate(`/etablissements/${etablissement.id}`)
    }
  }

  const handleCardKeyDown = (e: React.KeyboardEvent) => {
    if (isSelectionMode) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      navigate(`/etablissements/${etablissement.id}`)
    }
  }

  return (
    <Card
      className={cn(
        'hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer h-full flex flex-col border-l-4 bg-card/80 backdrop-blur-sm border-primary/10 shadow-lg group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        getStatusBorderColor(etablissement.statut),
        isSelected && 'ring-2 ring-primary ring-offset-2'
      )}
      onClick={handleCardClick}
      role={isSelectionMode ? undefined : 'button'}
      tabIndex={isSelectionMode ? undefined : 0}
      aria-label={
        isSelectionMode ? undefined : `Ouvrir la fiche établissement ${etablissement.nom}`
      }
      onKeyDown={handleCardKeyDown}
    >
      {/* HEADER */}
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Checkbox */}
            {isSelectionMode && (
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onSelect?.(etablissement.id)}
                onClick={(e) => e.stopPropagation()}
                className="mt-1"
              />
            )}

            {/* Avatar */}
            <EntityAvatar
              name={etablissement.nom}
              logoUrl={etablissement.logo_url || etablissement.groupe_logo_url}
              size="sm"
              className="flex-shrink-0 mt-0.5"
            />

            {/* Titre et localisation */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-base truncate">{etablissement.nom}</CardTitle>
                {isNew() && (
                  <Badge className="text-xs bg-gradient-to-r from-primary/20 to-primary/5 border-primary/20 text-primary backdrop-blur-sm">
                    Nouveau
                  </Badge>
                )}
                {/* Health indicator avec pulse */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <div className="relative">
                        <div
                          className={cn(
                            'absolute inset-0 rounded-full animate-ping',
                            healthIndicator.color,
                            'opacity-40'
                          )}
                        />
                        <div
                          className={cn(
                            'relative w-2.5 h-2.5 rounded-full ring-2 ring-white',
                            healthIndicator.color
                          )}
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="rounded-xl">
                      <p>Santé: {healthIndicator.label}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <CardDescription className="flex items-center gap-1 mt-1">
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="truncate">
                  {etablissement.ville}, {etablissement.region}
                </span>
              </CardDescription>
            </div>
          </div>

          {/* Menu dropdown - glassmorphism */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Plus d'options"
                title="Plus d'options"
                className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all rounded-xl hover:bg-primary/10 h-8 w-8"
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="rounded-xl border-primary/10 shadow-lg bg-card/95 backdrop-blur-sm"
            >
              <DropdownMenuItem
                onClick={() => navigate(`/etablissements/${etablissement.id}`)}
                className="rounded-lg"
              >
                <Eye className="w-4 h-4 mr-2" />
                Voir détails
              </DropdownMenuItem>
              {onEdit && (
                <DropdownMenuItem onClick={() => onEdit(etablissement)} className="rounded-lg">
                  <Edit className="w-4 h-4 mr-2" />
                  Modifier
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {onDelete && (
                <DropdownMenuItem
                  onClick={() => onDelete(etablissement)}
                  className="text-destructive rounded-lg"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Supprimer
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      {/* BODY */}
      <CardContent className="space-y-3 flex-1 flex flex-col">
        {/* Statut et Progression */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Badge variant={getStatusBadgeVariant(etablissement.statut)}>
              {etablissement.statut}
            </Badge>
            {config.showProgressBar && (
              <span className="text-sm font-medium">{etablissement.progression || 0}%</span>
            )}
          </div>

          {config.showProgressBar && (
            <div className="w-full bg-secondary/50 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-primary to-primary/60 h-full rounded-full transition-all duration-500"
                style={{ width: `${etablissement.progression || 0}%` }}
              />
            </div>
          )}
        </div>

        {/* Métriques spécifiques à la phase */}
        {phase === 'production' && (
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground text-xs">En production</span>
              <div className="font-medium">{monthsInProduction} mois</div>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">CA annuel</span>
              <div className="font-medium">
                {revenue > 0 ? (
                  formatCurrency(revenue)
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </div>
            </div>
            {adoptionRate > 0 && (
              <div>
                <span className="text-muted-foreground text-xs">Adoption</span>
                <div className="font-medium flex items-center gap-1">
                  {adoptionRate.toFixed(0)}%
                  {adoptionRate >= 75 ? '✅' : adoptionRate >= 50 ? '⚠️' : '❌'}
                </div>
              </div>
            )}
            {npsScore !== undefined && npsScore !== null && (
              <div>
                <span className="text-muted-foreground text-xs">NPS</span>
                <div className="font-medium flex items-center gap-1">
                  {npsScore.toFixed(1)}/10
                  {npsScore > 8 ? '😊' : npsScore > 6 ? '😐' : '😞'}
                </div>
              </div>
            )}
          </div>
        )}

        {phase === 'prospect' && etablissement.valeur_potentielle && (
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">CA potentiel:</span>
            <span className="font-medium">{formatCurrency(etablissement.valeur_potentielle)}</span>
          </div>
        )}

        {/* Dates clés */}
        {config.showDates && (
          <div className="space-y-1 text-sm">
            {config.dates.includes('signature') && etablissement.date_signature && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="w-3 h-3" />
                <span>
                  Signé: {new Date(etablissement.date_signature).toLocaleDateString('fr-FR')}
                </span>
              </div>
            )}
            {config.dates.includes('go_live') && etablissement.date_go_live && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="w-3 h-3" />
                <span>
                  Go-Live: {new Date(etablissement.date_go_live).toLocaleDateString('fr-FR')}
                </span>
              </div>
            )}
            {config.dates.includes('fin_contrat') && renewalInfo && (
              <div
                className={cn(
                  'flex items-center gap-2',
                  renewalInfo.alert ? 'text-destructive' : 'text-muted-foreground'
                )}
              >
                <Calendar className="w-3 h-3" />
                <span>
                  Renouvellement: {renewalInfo.label} {renewalInfo.alert && '⚠️'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Équipe */}
        {config.showTeam && (
          <TooltipProvider>
            <div className="flex -space-x-2">
              {config.teamMembers.includes('commercial') && etablissement.commercial_id && (
                <Tooltip>
                  <TooltipTrigger>
                    <Avatar className="h-7 w-7 border-2 border-background">
                      <AvatarFallback className="text-xs bg-chart-1 text-chart-1-foreground">
                        {getProfileInitials(etablissement.commercial_id)}
                      </AvatarFallback>
                    </Avatar>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Commercial: {getProfileName(etablissement.commercial_id)}</p>
                  </TooltipContent>
                </Tooltip>
              )}
              {config.teamMembers.includes('chef_projet') && etablissement.chef_projet_id && (
                <Tooltip>
                  <TooltipTrigger>
                    <Avatar className="h-7 w-7 border-2 border-background">
                      <AvatarFallback className="text-xs bg-chart-2 text-chart-2-foreground">
                        {getProfileInitials(etablissement.chef_projet_id)}
                      </AvatarFallback>
                    </Avatar>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Chef de projet: {getProfileName(etablissement.chef_projet_id)}</p>
                  </TooltipContent>
                </Tooltip>
              )}
              {config.teamMembers.includes('csm') && etablissement.csm_id && (
                <Tooltip>
                  <TooltipTrigger>
                    <Avatar className="h-7 w-7 border-2 border-background">
                      <AvatarFallback className="text-xs bg-chart-3 text-chart-3-foreground">
                        {getProfileInitials(etablissement.csm_id)}
                      </AvatarFallback>
                    </Avatar>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>CSM: {getProfileName(etablissement.csm_id)}</p>
                  </TooltipContent>
                </Tooltip>
              )}
              {/* Afficher les noms inline si joints */}
              {etablissement.csm && config.teamMembers.includes('csm') && !etablissement.csm_id && (
                <span className="text-sm text-muted-foreground ml-2">
                  CSM: {etablissement.csm.prenom} {etablissement.csm.nom}
                </span>
              )}
              {etablissement.chef_projet &&
                config.teamMembers.includes('chef_projet') &&
                !etablissement.chef_projet_id && (
                  <span className="text-sm text-muted-foreground ml-2">
                    CP: {etablissement.chef_projet.prenom} {etablissement.chef_projet.nom}
                  </span>
                )}
            </div>
          </TooltipProvider>
        )}

        {/* Alertes */}
        {config.showAlerts &&
          health &&
          'alerts' in health &&
          health.alerts &&
          health.alerts.length > 0 && (
            <div className="space-y-1 pt-2 border-t">
              <div className="flex items-center gap-1 text-xs font-medium text-warning">
                <AlertCircle className="w-3 h-3" />
                Alertes
              </div>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                {health.alerts.slice(0, 2).map((alert, idx) => (
                  <li key={idx} className="truncate">
                    • {alert}
                  </li>
                ))}
                {health.alerts.length > 2 && (
                  <li className="text-muted-foreground">+{health.alerts.length - 2} autres</li>
                )}
              </ul>
            </div>
          )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Actions rapides - Glassmorphism */}
        <div className="flex gap-2 pt-3 border-t border-border/50">
          {(config.quickActions ?? []).slice(0, 3).map((action) => (
            <Button
              key={action.id}
              variant="outline"
              size="sm"
              className="flex-1 h-8 rounded-xl bg-card/60 backdrop-blur-sm border-primary/10 hover:bg-primary/10 hover:border-primary/20 transition-all"
              onClick={(e) => {
                e.stopPropagation()
                navigate(action.getUrl(etablissement.id))
              }}
            >
              <action.icon className="w-3 h-3 mr-1" />
              <span className="hidden sm:inline">{action.shortLabel || action.label}</span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
