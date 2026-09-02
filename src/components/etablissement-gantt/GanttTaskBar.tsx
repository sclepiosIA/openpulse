import { memo, useState, useMemo } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { CheckCircle, Clock, AlertCircle, Circle, Paperclip, MessageSquare, Flame } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ResizeHandle } from './hooks/useGanttResize'
import { Task } from '@/types/gantt'
import { GanttTaskContextMenu } from './GanttTaskContextMenu'
import { ProfilePublic } from '@/hooks/profile/useProfiles'
import { getRoleColor, getRoleLabel } from '@/lib/roleColors'

interface GanttTaskBarProps {
  task: Task
  position: { left: number; width: number; isOverdue: boolean }
  onClick: () => void
  onResizeStart?: (handle: ResizeHandle, startClientX: number) => void
  isDragging?: boolean
  isResizing?: boolean
  /** Nombre de documents - passé depuis le parent pour éviter N requêtes */
  documentCount?: number
  /** Pixels par jour pour le snapping visuel */
  pixelsPerDay?: number
  /** Callbacks pour le menu contextuel */
  onDuplicate?: () => void
  onStatusChange?: (status: string) => void
  onAssign?: (responsableId: string) => void
  onArchive?: () => void
  onDelete?: () => void
  /** Liste des profils pour l'attribution */
  profiles?: ProfilePublic[]
  /** Rôle du responsable pour le code couleur */
  responsableRole?: string | null
}

const statutIcons = {
  "A faire": Circle,
  "En cours": Clock,
  "Bloqué": AlertCircle,
  "Terminé": CheckCircle
}

export const GanttTaskBar = memo(({ 
  task, 
  position, 
  onClick, 
  onResizeStart,
  isDragging,
  isResizing,
  documentCount = 0,
  pixelsPerDay = 20,
  onDuplicate,
  onStatusChange,
  onAssign,
  onArchive,
  onDelete,
  profiles = [],
  responsableRole
}: GanttTaskBarProps) => {
  const [isHovered, setIsHovered] = useState(false)
  
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: task.id,
    data: task
  })

  // Appliquer le snapping visuel au transform pendant le drag
  const snappedTransform = useMemo(() => {
    if (!transform) return null
    
    // Snapper le déplacement X au jour le plus proche
    const snappedX = Math.round(transform.x / pixelsPerDay) * pixelsPerDay
    
    return {
      ...transform,
      x: snappedX,
      y: 0  // Forcer Y à 0 pour un mouvement strictement horizontal
    }
  }, [transform, pixelsPerDay])

  const style = {
    transform: CSS.Translate.toString(snappedTransform),
    // Transition fluide seulement quand on ne drag pas
    transition: transform ? undefined : 'transform 150ms ease'
  }

  const StatusIcon = statutIcons[task.statut as keyof typeof statutIcons] || Circle
  
  // Couleur du rôle du responsable
  const roleColor = getRoleColor(responsableRole)
  
  // Calculer les jours de retard
  const daysOverdue = position.isOverdue && task.echeance 
    ? Math.abs(Math.round((new Date().getTime() - new Date(task.echeance).getTime()) / (1000 * 60 * 60 * 24)))
    : 0

  // Vérifier si le menu contextuel est disponible
  const hasContextMenu = onDuplicate || onStatusChange || onAssign || onArchive || onDelete

  const taskBarContent = (
    <div
      ref={setNodeRef}
      style={{
        left: `${position.left}px`,
        width: `${position.width}px`,
        ...style
      }}
      className={cn(
        // Base: compact, moderne
        "absolute h-8 rounded-md border transition-all duration-150",
        "flex items-center overflow-hidden group",
        // Bordure gauche pour priorité
        "border-l-[3px]",
        task.priorite === 'high' && "border-l-destructive",
        task.priorite === 'medium' && "border-l-warning", 
        task.priorite === 'low' && "border-l-muted-foreground/30",
        !task.priorite && "border-l-muted-foreground/30",
        // Fond selon statut
        task.statut === "Terminé" && "bg-success/10 border-success/30",
        task.statut === "En cours" && "bg-primary/10 border-primary/30",
        task.statut === "Bloqué" && "bg-destructive/10 border-destructive/30",
        task.statut === "A faire" && "bg-muted/60 border-border",
        // En retard: ring subtil (PAS d'animation)
        position.isOverdue && task.statut !== "Terminé" && "ring-1 ring-destructive/40 bg-destructive/5",
        // États interactifs
        isDragging && "opacity-50 cursor-grabbing",
        isResizing && "ring-2 ring-primary/50",
        isHovered && !isDragging && !isResizing && "shadow-md z-10 scale-[1.02]"
      )}
      {...attributes}
    >
      {/* Barre supérieure colorée par rôle du responsable */}
      <div 
        className="absolute top-0 left-0 right-0 h-[3px] rounded-t-sm"
        style={{ backgroundColor: roleColor.hex }}
        title={getRoleLabel(responsableRole)}
      />
      {/* Zone de drag = contenu cliquable */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div 
              className="flex items-center px-2 gap-1.5 flex-1 min-w-0 h-full cursor-grab active:cursor-grabbing"
              onClick={onClick}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              {...listeners}
            >
              {/* Icône de statut */}
              <StatusIcon className={cn(
                "h-3 w-3 flex-shrink-0",
                task.statut === "Terminé" && "text-success",
                task.statut === "En cours" && "text-primary",
                task.statut === "Bloqué" && "text-destructive",
                task.statut === "A faire" && "text-muted-foreground"
              )} />
              
              {/* Titre */}
              <span className="text-xs font-medium truncate flex-1 min-w-0">
                {task.titre}
              </span>

              {/* Badge retard compact */}
              {position.isOverdue && task.statut !== "Terminé" && daysOverdue > 0 && (
                <Badge 
                  variant="destructive" 
                  className="h-4 px-1 text-[10px] font-bold flex-shrink-0"
                >
                  -{daysOverdue}j
                </Badge>
              )}

              {/* Indicateurs au hover uniquement (documents/commentaires) */}
              {isHovered && (
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  {documentCount > 0 && (
                    <span className="flex items-center text-[10px] text-muted-foreground">
                      <Paperclip className="h-2.5 w-2.5 mr-0.5" />
                      {documentCount}
                    </span>
                  )}
                  {(task.comments_count ?? 0) > 0 && (
                    <span className="flex items-center text-[10px] text-muted-foreground">
                      <MessageSquare className="h-2.5 w-2.5 mr-0.5" />
                      {task.comments_count}
                    </span>
                  )}
                </div>
              )}

              {/* Priorité haute - icône flame visible */}
              {task.priorite === 'high' && !position.isOverdue && (
                <Flame className="h-3 w-3 text-destructive flex-shrink-0" />
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="space-y-1.5">
              <p className="font-semibold text-sm">{task.titre}</p>
              <div className="text-xs space-y-0.5 text-muted-foreground">
                {task.echeance && (
                  <p>Échéance : {format(new Date(task.echeance), 'PP', { locale: fr })}</p>
                )}
                {(task.responsable_profile || task.profiles) && (
                  <p>Responsable : {
                    [
                      task.responsable_profile?.prenom || task.profiles?.prenom, 
                      task.responsable_profile?.nom || task.profiles?.nom
                    ].filter(Boolean).join(' ') || 
                    task.responsable_profile?.email || task.profiles?.email || 
                    'Non assigné'
                  }</p>
                )}
                <p>Statut : {task.statut}</p>
                <p>Priorité : {task.priorite === 'high' ? 'Haute' : task.priorite === 'medium' ? 'Moyenne' : 'Basse'}</p>
                {task.categories_taches && (
                  <p>Catégorie : {task.categories_taches.nom}</p>
                )}
                {documentCount > 0 && <p>{documentCount} document(s)</p>}
                {(task.comments_count ?? 0) > 0 && <p>{task.comments_count} commentaire(s)</p>}
              </div>
              {hasContextMenu && (
                <p className="text-xs text-muted-foreground/70 italic">Clic droit pour plus d'options</p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Poignées de resize - ISOLÉES du drag */}
      {onResizeStart && (
        <>
          {/* Poignée gauche */}
          <div
            className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-primary/50 opacity-0 group-hover:opacity-100 transition-opacity z-20"
            onMouseDown={(e) => {
              e.stopPropagation()
              e.preventDefault()
              onResizeStart('left', e.clientX)
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          />
          {/* Poignée droite */}
          <div
            className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-primary/50 opacity-0 group-hover:opacity-100 transition-opacity z-20"
            onMouseDown={(e) => {
              e.stopPropagation()
              e.preventDefault()
              onResizeStart('right', e.clientX)
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          />
        </>
      )}
    </div>
  )

  // Si le menu contextuel est disponible, envelopper le contenu
  if (hasContextMenu) {
    return (
      <GanttTaskContextMenu
        task={task}
        profiles={profiles}
        onEdit={onClick}
        onDuplicate={onDuplicate}
        onStatusChange={onStatusChange}
        onAssign={onAssign}
        onArchive={onArchive}
        onDelete={onDelete}
      >
        {taskBarContent}
      </GanttTaskContextMenu>
    )
  }

  return taskBarContent
})

GanttTaskBar.displayName = 'GanttTaskBar'
