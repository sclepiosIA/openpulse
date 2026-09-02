import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MapPin, Calendar, Users, AlertCircle, Eye, ListTodo, Columns, MoreHorizontal } from 'lucide-react'
import { DeploymentHealthIndicator } from './DeploymentHealthIndicator'
import { DeploymentQuickActions } from './DeploymentQuickActions'
import { EntityAvatar } from '@/components/ui/EntityAvatar'
import { getStatutColor } from '@/lib/deploymentUtils'
import type { Etablissement } from '@/hooks/crm/useEtablissements'
import type { HealthScore } from '@/hooks/production/useDeploymentHealth'

interface EnrichedDeploymentCardProps {
  etablissement: Etablissement
  health?: HealthScore
  isSelected?: boolean
  onSelectionChange?: (id: string, selected: boolean) => void
}

export function EnrichedDeploymentCard({ 
  etablissement, 
  health,
  isSelected = false,
  onSelectionChange
}: EnrichedDeploymentCardProps) {
  const navigate = useNavigate()

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on interactive elements
    if ((e.target as HTMLElement).closest('button, [role="checkbox"], [data-radix-collection-item]')) {
      return
    }
    navigate(`/etablissements/${etablissement.id}`)
  }

  const handleCardKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      navigate(`/etablissements/${etablissement.id}`)
    }
  }

  const handleCheckboxChange = (checked: boolean) => {
    onSelectionChange?.(etablissement.id, checked)
  }

  return (
    <Card
      className="hover:shadow-lg transition-shadow cursor-pointer group h-full flex flex-col overflow-hidden max-h-[420px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      aria-label={`Ouvrir la fiche établissement ${etablissement.nom}`}
      onKeyDown={handleCardKeyDown}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          {/* Checkbox de sélection */}
          {onSelectionChange && (
            <div className="pt-1" onClick={e => e.stopPropagation()}>
              <Checkbox
                checked={isSelected}
                onCheckedChange={handleCheckboxChange}
                aria-label={`Sélectionner ${etablissement.nom}`}
              />
            </div>
          )}

          <div className="flex-1 space-y-2">
            <div className="flex items-start gap-3">
              <EntityAvatar
                name={etablissement.nom}
                logoUrl={etablissement.logo_url || ('groupe_logo_url' in etablissement ? (etablissement as { groupe_logo_url?: string }).groupe_logo_url : undefined)}
                size="md"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg leading-tight truncate">{etablissement.nom}</CardTitle>
                  {health && (
                    <DeploymentHealthIndicator
                      status={health.status}
                      score={health.score}
                      reasons={health.reasons}
                      size="sm"
                    />
                  )}
                </div>
                
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <span className="truncate">{etablissement.type}</span>
                  <span>•</span>
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{etablissement.region}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            <DeploymentQuickActions etablissement={etablissement} />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 flex-1 flex flex-col">
        {/* Statut et progression */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Statut:</span>
            <Badge className={getStatutColor(etablissement.statut)}>
              {etablissement.statut}
            </Badge>
          </div>

          {etablissement.progression !== null && (
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progression</span>
                <span className="font-medium">{Math.round(etablissement.progression || 0)}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${etablissement.progression}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Équipe */}
        {(etablissement.csm || etablissement.chef_projet) && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span>Équipe</span>
            </div>
            <div className="space-y-1 text-sm pl-6">
              {etablissement.csm && (
                <div className="text-muted-foreground">
                  CSM: <span className="text-foreground">{etablissement.csm.prenom} {etablissement.csm.nom}</span>
                </div>
              )}
              {etablissement.chef_projet && (
                <div className="text-muted-foreground">
                  CP: <span className="text-foreground">{etablissement.chef_projet.prenom} {etablissement.chef_projet.nom}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Dates clés */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span>Jalons</span>
          </div>
          <div className="space-y-1 text-xs pl-6">
            {etablissement.date_signature && (
              <div className="flex justify-between text-muted-foreground">
                <span>Signé:</span>
                <span className="text-foreground font-medium">
                  {new Date(etablissement.date_signature).toLocaleDateString('fr-FR')}
                </span>
              </div>
            )}
            {etablissement.date_fin_contrat && (
              <div className="flex justify-between text-muted-foreground">
                <span>Fin contrat:</span>
                <span className="text-foreground font-medium">
                  {new Date(etablissement.date_fin_contrat).toLocaleDateString('fr-FR')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Alertes */}
        {health && health.reasons.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-orange-600 dark:text-orange-400">
              <AlertCircle className="w-4 h-4" />
              <span>Alertes</span>
            </div>
            <div className="space-y-1 pl-6">
              {health.reasons.slice(0, 2).map((reason, idx) => (
                <div key={idx} className="text-xs text-muted-foreground flex items-start gap-1">
                  <span className="text-orange-600 dark:text-orange-400">•</span>
                  <span className="line-clamp-1">{reason}</span>
                </div>
              ))}
              {health.reasons.length > 2 && (
                <span className="text-xs text-muted-foreground">
                  +{health.reasons.length - 2} autres alertes
                </span>
              )}
            </div>
          </div>
        )}

        {/* Spacer pour pousser les actions en bas */}
        <div className="flex-1" />

        {/* Actions rapides */}
        <div className="flex gap-2 pt-2 border-t mt-auto">
          {/* Mobile: menu déroulant unifié */}
          <div className="sm:hidden flex-1" onClick={e => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="w-full">
                  <MoreHorizontal className="w-4 h-4 mr-2" />
                  Actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center">
                <DropdownMenuItem onClick={() => navigate(`/etablissements/${etablissement.id}`)}>
                  <Eye className="w-4 h-4 mr-2" />
                  Détails
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate(`/etablissements/${etablissement.id}?tab=taches`)}>
                  <ListTodo className="w-4 h-4 mr-2" />
                  Tâches
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate(`/etablissements/${etablissement.id}?tab=kanban`)}>
                  <Columns className="w-4 h-4 mr-2" />
                  Kanban
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          {/* Desktop: boutons individuels */}
          <div className="hidden sm:flex gap-2 flex-1">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/etablissements/${etablissement.id}`)
              }}
            >
              <Eye className="w-3 h-3 mr-1" />
              Détails
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/etablissements/${etablissement.id}?tab=taches`)
              }}
            >
              <ListTodo className="w-3 h-3 mr-1" />
              Tâches
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/etablissements/${etablissement.id}?tab=kanban`)
              }}
            >
              <Columns className="w-3 h-3 mr-1" />
              Kanban
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
