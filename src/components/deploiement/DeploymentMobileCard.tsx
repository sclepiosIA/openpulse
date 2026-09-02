import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { MoreVertical, Calendar } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EntityAvatar } from '@/components/ui/EntityAvatar'
import type { Etablissement } from '@/hooks/crm/useEtablissements'
import type { HealthScore } from '@/hooks/production/useDeploymentHealth'
import {
  getHealthIcon,
  getHealthBadgeColor,
  getHealthLabel,
} from '@/hooks/production/useDeploymentHealth'
import { cn } from '@/lib/utils'

interface DeploymentMobileCardProps {
  etablissement: Etablissement
  health: HealthScore | undefined
}

export function DeploymentMobileCard({ etablissement, health }: DeploymentMobileCardProps) {
  const navigate = useNavigate()

  const getStatutColor = (statut: string) => {
    switch (statut) {
      case 'Contractuel':
        return 'border-primary/50 bg-primary/10 text-primary'
      case 'Conformité':
        return 'border-amber-500/50 bg-amber-500/10 text-amber-700'
      case 'Déploiement':
        return 'border-blue-500/50 bg-blue-500/10 text-blue-700'
      case 'Formation':
        return 'border-violet-500/50 bg-violet-500/10 text-violet-700'
      case 'Go-Live':
        return 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700'
      default:
        return 'border-muted-foreground/30 bg-muted/50 text-muted-foreground'
    }
  }

  return (
    <div
      className="bg-card/80 backdrop-blur-sm rounded-xl border border-border/50 shadow-sm transition-all duration-200 hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => navigate(`/etablissements/${etablissement.id}`)}
      role="link"
      tabIndex={0}
      aria-label={`Ouvrir la fiche établissement ${etablissement.nom}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          navigate(`/etablissements/${etablissement.id}`)
        }
      }}
    >
      {/* Header row */}
      <div className="flex items-center gap-3 p-3 pb-2">
        <EntityAvatar
          name={etablissement.nom}
          logoUrl={etablissement.logo_url || (etablissement as any).groupe_logo_url}
          size="sm"
        />

        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm truncate leading-tight">{etablissement.nom}</h3>
          <p className="text-xs text-muted-foreground truncate">
            {etablissement.type} • {etablissement.ville}
          </p>
        </div>

        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Plus d'options"
                title="Plus d'options"
                className="h-7 w-7 p-0"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-card">
              <DropdownMenuItem onClick={() => navigate(`/etablissements/${etablissement.id}`)}>
                Voir la fiche
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate(`/etablissements/${etablissement.id}?tab=taches`)}
              >
                Voir les tâches
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate(`/etablissements/${etablissement.id}?tab=kanban`)}
              >
                Voir kanban
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Footer row */}
      <div className="flex items-center gap-2 px-3 pb-3 pt-1 flex-wrap">
        <Badge
          variant="outline"
          className={cn('text-[10px] h-5 px-1.5', getStatutColor(etablissement.statut))}
        >
          {etablissement.statut}
        </Badge>

        {/* Health indicator */}
        {health && (
          <Badge
            variant="outline"
            className={cn('text-[10px] h-5 px-1.5 gap-0.5', getHealthBadgeColor(health.status))}
          >
            <span>{getHealthIcon(health.status)}</span>
            <span className="hidden xs:inline">{getHealthLabel(health.status)}</span>
          </Badge>
        )}

        <div className="flex-1" />

        {/* Progress */}
        <div className="flex items-center gap-1.5 min-w-[70px]">
          <Progress value={etablissement.progression || 0} className="h-1.5 flex-1" />
          <span className="text-[10px] text-muted-foreground tabular-nums w-7 text-right">
            {Math.round(etablissement.progression || 0)}%
          </span>
        </div>

        {/* Date signature */}
        {etablissement.date_signature && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>
              {new Date(etablissement.date_signature).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
              })}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
