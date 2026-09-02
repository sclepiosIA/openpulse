import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Calendar, Edit, Archive, CheckCircle2, Clock, XCircle, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDateFr, isOverdue, getPriorityLabelFr, getStatusLabelFr } from '@/lib/projetsUtils'

interface TaskMobileCardProps {
  task: any
  onStatusChange: (id: string, status: string) => void
  getEtablissementColor: (id: string, nom: string) => string
  onClick?: () => void
  onEdit?: () => void
  onArchive?: () => void
}

const PRIORITY_BORDER_COLORS: Record<string, string> = {
  high: 'border-l-destructive',
  urgent: 'border-l-destructive',
  medium: 'border-l-warning',
  low: 'border-l-success',
}

const PRIORITY_DOT_COLORS: Record<string, string> = {
  high: 'bg-destructive',
  urgent: 'bg-destructive',
  medium: 'bg-warning',
  low: 'bg-success',
}

const getStatusIcon = (statut: string) => {
  switch (statut) {
    case 'Terminé':
      return <CheckCircle2 className="w-3.5 h-3.5 text-success" />
    case 'En cours':
      return <Clock className="w-3.5 h-3.5 text-primary" />
    case 'Bloqué':
      return <XCircle className="w-3.5 h-3.5 text-destructive" />
    default:
      return <AlertCircle className="w-3.5 h-3.5 text-muted-foreground" />
  }
}

export function TaskMobileCard({
  task,
  onStatusChange,
  getEtablissementColor,
  onClick,
  onEdit,
  onArchive,
}: TaskMobileCardProps) {
  const overdue = isOverdue(task.echeance, task.statut)
  const etablissementColor = getEtablissementColor(
    task.etablissement_id,
    task.etablissements?.nom || ''
  )
  const priorityBorder = PRIORITY_BORDER_COLORS[task.priorite] || 'border-l-muted-foreground'
  const priorityDot = PRIORITY_DOT_COLORS[task.priorite] || 'bg-muted-foreground'

  const responsable = task.responsable_profile
  const initials = responsable
    ? `${responsable.prenom?.[0] || ''}${responsable.nom?.[0] || ''}`.toUpperCase()
    : '?'

  return (
    <div
      className={cn(
        'bg-card/80 backdrop-blur-sm rounded-lg border border-primary/10 shadow-sm',
        'border-l-4',
        priorityBorder,
        overdue && 'bg-destructive/5 border-destructive/20',
        'active:scale-[0.98] transition-transform'
      )}
      onClick={onClick}
    >
      <div className="p-3 space-y-2">
        {/* Row 1: Title + Priority dot */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium text-sm line-clamp-2 flex-1">{task.titre}</h3>
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={cn('w-2 h-2 rounded-full', priorityDot)}
              title={getPriorityLabelFr(task.priorite)}
            />
          </div>
        </div>

        {/* Row 2: Etablissement + Categorie */}
        <div className="flex items-center gap-2 flex-wrap">
          {task.etablissements?.nom && (
            <Badge
              variant="outline"
              className="text-[10px] h-5 px-1.5"
              style={{ borderColor: etablissementColor, color: etablissementColor }}
            >
              {task.etablissements.nom}
            </Badge>
          )}
          {task.categories_taches && (
            <Badge
              variant="outline"
              className="text-[10px] h-5 px-1.5"
              style={{
                borderColor: task.categories_taches.couleur,
                color: task.categories_taches.couleur,
              }}
            >
              {task.categories_taches.nom}
            </Badge>
          )}
        </div>

        {/* Row 3: Echeance + Responsable */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="w-3 h-3" />
            <span className={cn(overdue && 'text-destructive font-medium')}>
              {task.echeance ? formatDateFr(task.echeance) : 'Non planifié'}
            </span>
            {overdue && <span className="text-destructive">(retard)</span>}
          </div>

          {responsable && (
            <div className="flex items-center gap-1.5">
              <Avatar className="h-5 w-5">
                <AvatarImage src={responsable.avatar_url} />
                <AvatarFallback className="text-[10px] bg-primary/10">{initials}</AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground truncate max-w-[80px]">
                {responsable.prenom}
              </span>
            </div>
          )}
        </div>

        {/* Row 4: Status + Actions */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-primary/5">
          <Select
            value={task.statut}
            onValueChange={(value) => {
              onStatusChange(task.id, value)
            }}
          >
            <SelectTrigger
              className="h-7 w-28 text-xs border-0 bg-muted/50 hover:bg-muted"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-1.5">
                {getStatusIcon(task.statut)}
                <span>{getStatusLabelFr(task.statut)}</span>
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="A faire">À faire</SelectItem>
              <SelectItem value="En cours">En cours</SelectItem>
              <SelectItem value="Bloqué">Bloqué</SelectItem>
              <SelectItem value="Terminé">Terminé</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1">
            {onEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit()
                }}
                aria-label="Modifier"
              >
                <Edit className="h-3.5 w-3.5" />
              </Button>
            )}
            {onArchive && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => {
                  e.stopPropagation()
                  onArchive()
                }}
                aria-label="Archiver"
              >
                <Archive className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
