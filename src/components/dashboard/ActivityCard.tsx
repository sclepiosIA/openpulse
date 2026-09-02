import { Badge } from "@/components/ui/badge"
import { Clock, FileText, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { EntityAvatar } from "@/components/ui/EntityAvatar"
import { formatDistanceToNow } from "date-fns"
import { fr } from "date-fns/locale"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

export type ActivityPriority = 'critical' | 'high' | 'medium' | 'low'

export interface Activity {
  id: string
  etablissementId: string
  etablissementNom: string
  etablissementLogo?: string | null
  statut: string
  type: 'status_change' | 'task_added' | 'task_completed' | 'document_added' | 'modification'
  description: string
  timestamp: string
  userId?: string
  userName?: string
  priority: ActivityPriority
  tasksCompleted?: number
  tasksPending?: number
  tasksUrgent?: number
}

interface ActivityCardProps {
  activity: Activity
  index?: number
}

const priorityConfig = {
  critical: {
    border: 'border-l-4 border-l-destructive',
    dot: 'bg-destructive',
    label: 'Critique',
    icon: AlertCircle,
    textColor: 'text-destructive',
    glow: 'shadow-[0_0_12px_-2px_hsl(var(--destructive)/0.4)]'
  },
  high: {
    border: 'border-l-4 border-l-accent',
    dot: 'bg-accent',
    label: 'Urgent',
    icon: AlertCircle,
    textColor: 'text-accent',
    glow: 'shadow-[0_0_12px_-2px_hsl(var(--accent)/0.4)]'
  },
  medium: {
    border: 'border-l-4 border-l-primary',
    dot: 'bg-primary',
    label: 'Normal',
    icon: FileText,
    textColor: 'text-primary',
    glow: ''
  },
  low: {
    border: 'border-l-4 border-l-muted-foreground/30',
    dot: 'bg-muted-foreground',
    label: 'Faible',
    icon: FileText,
    textColor: 'text-muted-foreground',
    glow: ''
  }
}

const typeLabels = {
  status_change: 'Changement de statut',
  task_added: 'Nouvelle tâche',
  task_completed: 'Tâche terminée',
  document_added: 'Document ajouté',
  modification: 'Modification'
}

export function ActivityCard({ activity, index = 0 }: ActivityCardProps) {
  const navigate = useNavigate()
  const config = priorityConfig[activity.priority]
  const Icon = config.icon
  
  const timeAgo = formatDistanceToNow(new Date(activity.timestamp), { 
    addSuffix: true,
    locale: fr 
  })

  const handleClick = () => {
    navigate(`/etablissements/${activity.etablissementId}`)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }

  const isPulsing = activity.priority === 'critical' || activity.priority === 'high'

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`${activity.etablissementNom} - ${activity.description}`}
      className={cn(
        "group relative cursor-pointer rounded-xl bg-card border overflow-hidden",
        "hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-300",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "active:scale-[0.99]",
        config.border,
        config.glow
      )}
    >
      {/* Timeline dot with pulse animation */}
      <div className="absolute left-0 top-6 -translate-x-1/2 z-10">
        <div className={cn(
          "relative w-3 h-3 rounded-full border-2 border-background",
          config.dot
        )}>
          {isPulsing && (
            <span className={cn(
              "absolute inset-0 rounded-full animate-pulse-ring",
              config.dot
            )} />
          )}
        </div>
      </div>
      
      <div className="p-4 pl-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <EntityAvatar 
              name={activity.etablissementNom} 
              logoUrl={activity.etablissementLogo}
              size="sm"
              className="shrink-0 mt-0.5 ring-2 ring-background"
            />
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                {activity.etablissementNom}
              </h4>
              <Badge variant="outline" className="mt-1 text-xs">
                {activity.statut}
              </Badge>
            </div>
          </div>
          
          <div className={cn(
            "p-1.5 rounded-lg transition-colors",
            activity.priority === 'critical' && "bg-destructive/10",
            activity.priority === 'high' && "bg-accent/10",
            activity.priority === 'medium' && "bg-primary/10",
            activity.priority === 'low' && "bg-muted"
          )}>
            <Icon className={cn("w-4 h-4", config.textColor)} />
          </div>
        </div>

        {/* Context */}
        <div className="space-y-2 mb-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>{timeAgo}</span>
            {activity.userName && (
              <>
                <span>•</span>
                <span>par {activity.userName}</span>
              </>
            )}
          </div>
          
          <p className="text-xs text-muted-foreground">
            {typeLabels[activity.type]}
          </p>
        </div>

        {/* Description */}
        <p className="text-sm mb-3 line-clamp-2">
          {activity.description}
        </p>

        {/* Footer with task metrics */}
        {(activity.tasksCompleted !== undefined || activity.tasksPending !== undefined || activity.tasksUrgent !== undefined) && (
          <div className="flex items-center gap-3 pt-3 border-t text-xs">
            {activity.tasksCompleted !== undefined && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <CheckCircle2 className="w-3 h-3 text-success" />
                <span>{activity.tasksCompleted} terminées</span>
              </div>
            )}
            {activity.tasksUrgent !== undefined && activity.tasksUrgent > 0 && (
              <div className="flex items-center gap-1 text-accent">
                <AlertCircle className="w-3 h-3" />
                <span>{activity.tasksUrgent} urgentes</span>
              </div>
            )}
            {activity.tasksPending !== undefined && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <span>{activity.tasksPending} en cours</span>
              </div>
            )}
          </div>
        )}

        {/* Navigation indicator */}
        <ArrowRight className="w-4 h-4 absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
      </div>
    </motion.div>
  )
}
