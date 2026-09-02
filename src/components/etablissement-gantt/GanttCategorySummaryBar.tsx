import { memo, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { CheckCircle, Clock, AlertCircle, Circle } from 'lucide-react'
import { differenceInDays, addDays, isBefore } from 'date-fns'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { TimelineConfig } from './hooks/useGanttZoom'

interface GanttCategorySummaryBarProps {
  category: {
    id: string
    nom: string
    couleur?: string
    tasks: any[]
  }
  timeline: TimelineConfig
  onClick: () => void
}

const StatusIcon = ({ statut }: { statut: string }) => {
  const icons = {
    "A faire": Circle,
    "En cours": Clock,
    "Bloqué": AlertCircle,
    "Terminé": CheckCircle
  }
  const Icon = icons[statut as keyof typeof icons] || Circle
  return <Icon className="h-3 w-3" />
}

export const GanttCategorySummaryBar = memo(({ 
  category, 
  timeline, 
  onClick 
}: GanttCategorySummaryBarProps) => {
  // Calcul de la période globale
  const { startDate, endDate } = useMemo(() => {
    const allDates: Date[] = []
    
    category.tasks.forEach(task => {
      // Utiliser date_debut si disponible, sinon created_at
      const taskStart = task.date_debut 
        ? new Date(task.date_debut) 
        : new Date(task.created_at)
      allDates.push(taskStart)
      
      // Calculer la fin en fonction du début réel
      const taskEnd = task.echeance 
        ? new Date(task.echeance) 
        : addDays(taskStart, 7)
      allDates.push(taskEnd)
    })

    return {
      startDate: new Date(Math.min(...allDates.map(d => d.getTime()))),
      endDate: new Date(Math.max(...allDates.map(d => d.getTime())))
    }
  }, [category.tasks])

  // Statistiques
  const stats = useMemo(() => ({
    total: category.tasks.length,
    aFaire: category.tasks.filter(t => t.statut === 'A faire').length,
    enCours: category.tasks.filter(t => t.statut === 'En cours').length,
    bloque: category.tasks.filter(t => t.statut === 'Bloqué').length,
    termine: category.tasks.filter(t => t.statut === 'Terminé').length,
    enRetard: category.tasks.filter(t => 
      t.statut !== 'Terminé' && 
      t.echeance && 
      isBefore(new Date(t.echeance), new Date())
    ).length,
    prioriteHaute: category.tasks.filter(t => t.priorite === 'high').length
  }), [category.tasks])

  // Position sur la timeline (en pixels)
  const position = useMemo(() => {
    const startOffset = differenceInDays(startDate, timeline.start)
    const duration = differenceInDays(endDate, startDate) || 1
    
    return {
      left: Math.max(0, startOffset * timeline.pixelsPerDay),
      width: Math.max(timeline.pixelsPerDay * 2, duration * timeline.pixelsPerDay)
    }
  }, [startDate, endDate, timeline])

  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <div
            style={{
              left: `${position.left}px`,
              width: `${position.width}px`,
              borderLeftColor: category.couleur || '#888'
            }}
            className={cn(
              "absolute h-10 rounded-lg border-2 border-l-4 cursor-pointer transition-all",
              "flex items-center px-3 gap-3 overflow-hidden",
              "bg-gradient-to-r from-muted/60 to-muted/40",
              "hover:shadow-lg hover:scale-[1.02] hover:z-10",
              stats.enRetard > 0 && "ring-2 ring-destructive/50"
            )}
            onClick={onClick}
          >
            {/* Icône de la catégorie */}
            <div 
              className="w-4 h-4 rounded-full flex-shrink-0"
              style={{ backgroundColor: category.couleur }}
            />

            {/* Nom et nombre de tâches */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-sm font-semibold truncate">
                {category.nom}
              </span>
              <Badge variant="secondary" className="text-xs">
                {stats.total}
              </Badge>
            </div>

            {/* Statistiques visuelles */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {stats.enRetard > 0 && (
                <Badge variant="destructive" className="text-xs">
                  ⚠️ {stats.enRetard}
                </Badge>
              )}
              
              {stats.prioriteHaute > 0 && (
                <Badge variant="outline" className="text-xs border-destructive text-destructive">
                  🔴 {stats.prioriteHaute}
                </Badge>
              )}

              {/* Mini stats */}
              <div className="flex items-center gap-1 text-xs">
                {stats.termine > 0 && (
                  <span className="text-success">✓{stats.termine}</span>
                )}
                {stats.enCours > 0 && (
                  <span className="text-primary">⏱{stats.enCours}</span>
                )}
                {stats.bloque > 0 && (
                  <span className="text-destructive">⚠{stats.bloque}</span>
                )}
              </div>
            </div>
          </div>
        </TooltipTrigger>

        <TooltipContent side="bottom" className="max-w-md p-4">
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: category.couleur }}
              />
              <h4 className="font-semibold">{category.nom}</h4>
            </div>

            {/* Période */}
            <div className="text-xs text-muted-foreground space-y-1">
              <div>📅 Début : {format(startDate, 'dd MMM yyyy', { locale: fr })}</div>
              <div>📅 Fin : {format(endDate, 'dd MMM yyyy', { locale: fr })}</div>
              <div>⏱️ Durée : {differenceInDays(endDate, startDate)} jours</div>
            </div>

            {/* Statistiques */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1">
                <Circle className="h-3 w-3" />
                <span>À faire : {stats.aFaire}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-primary" />
                <span>En cours : {stats.enCours}</span>
              </div>
              <div className="flex items-center gap-1">
                <AlertCircle className="h-3 w-3 text-destructive" />
                <span>Bloqué : {stats.bloque}</span>
              </div>
              <div className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-success" />
                <span>Terminé : {stats.termine}</span>
              </div>
            </div>

            {/* Liste des tâches */}
            <div className="border-t pt-2 space-y-1 max-h-60 overflow-y-auto">
              <p className="text-xs font-semibold mb-2">Tâches ({stats.total}) :</p>
              {category.tasks.map((task, idx) => (
                <div 
                  key={task.id}
                  className="flex items-center gap-2 text-xs p-1 rounded hover:bg-muted"
                >
                  <span className="text-muted-foreground">{idx + 1}.</span>
                  <StatusIcon statut={task.statut} />
                  <span className="flex-1 truncate">{task.titre}</span>
                  {task.priorite === 'high' && <span>🔴</span>}
                </div>
              ))}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
})

GanttCategorySummaryBar.displayName = 'GanttCategorySummaryBar'
