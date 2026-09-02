import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { MoreVertical, MapPin } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EntityAvatar } from '@/components/ui/EntityAvatar'
import type { Etablissement } from '@/hooks/crm/useEtablissements'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'

interface ProspectsMobileCardProps {
  prospect: Etablissement
  progressInfo: {
    progress: number
    totalTasks: number
    completedTasks: number
    potentialValue?: number
  }
  isSelected: boolean
  onSelect: (id: string) => void
  onEdit: (prospect: Etablissement) => void
  onDelete: (id: string) => void
}

export function ProspectsMobileCard({
  prospect,
  progressInfo,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
}: ProspectsMobileCardProps) {
  const navigate = useNavigate()

  const getStatusColor = (statut: string) => {
    switch (statut) {
      case 'Prospect':
        return 'border-amber-500/50 bg-amber-500/10 text-amber-700'
      case 'Contacté':
        return 'border-blue-500/50 bg-blue-500/10 text-blue-700'
      case 'En négociation':
        return 'border-violet-500/50 bg-violet-500/10 text-violet-700'
      case 'Gagné':
        return 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700'
      default:
        return 'border-muted-foreground/30 bg-muted/50 text-muted-foreground'
    }
  }

  return (
    <div
      className={cn(
        'bg-card/80 backdrop-blur-sm rounded-xl border shadow-sm',
        'transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        isSelected
          ? 'border-primary ring-1 ring-primary/20'
          : 'border-border/50 hover:border-primary/30'
      )}
      onClick={() => navigate(`/etablissements/${prospect.id}`)}
      role="button"
      tabIndex={0}
      aria-label={`Ouvrir la fiche prospect ${prospect.nom}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          navigate(`/etablissements/${prospect.id}`)
        }
      }}
    >
      {/* Header row */}
      <div className="flex items-center gap-3 p-3 pb-2">
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onSelect(prospect.id)}
            className="h-4 w-4"
          />
        </div>

        <EntityAvatar
          name={prospect.nom}
          logoUrl={
            prospect.logo_url ||
            ('groupe_logo_url' in prospect
              ? (prospect as { groupe_logo_url?: string }).groupe_logo_url
              : undefined)
          }
          size="sm"
        />

        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm truncate leading-tight">{prospect.nom}</h3>
          {prospect.commercial && (
            <p className="text-xs text-muted-foreground truncate">
              {prospect.commercial.prenom} {prospect.commercial.nom}
            </p>
          )}
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
              <DropdownMenuItem onClick={() => navigate(`/etablissements/${prospect.id}`)}>
                Voir la fiche
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate(`/etablissements/${prospect.id}?tab=taches`)}
              >
                Voir les tâches
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(prospect)}>Modifier</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onDelete(prospect.id)} className="text-destructive">
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Footer row */}
      <div className="flex items-center gap-2 px-3 pb-3 pt-1">
        <Badge
          variant="outline"
          className={cn('text-[10px] h-5 px-1.5', getStatusColor(prospect.statut))}
        >
          {prospect.statut}
        </Badge>

        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" />
          <span className="truncate max-w-[60px]">{prospect.ville || '-'}</span>
        </div>

        <div className="flex-1" />

        {/* Progress */}
        <div className="flex items-center gap-1.5 min-w-[70px]">
          <Progress value={progressInfo.progress} className="h-1.5 flex-1" />
          <span className="text-[10px] text-muted-foreground tabular-nums w-7 text-right">
            {Math.round(progressInfo.progress)}%
          </span>
        </div>

        {/* CA potentiel */}
        {progressInfo.potentialValue ? (
          <span className="text-xs font-medium text-primary tabular-nums">
            {formatCurrency(progressInfo.potentialValue)}
          </span>
        ) : null}
      </div>
    </div>
  )
}
