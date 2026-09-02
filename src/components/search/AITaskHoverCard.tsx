import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Badge } from '@/components/ui/badge'
import { CheckSquare, Building2, AlertTriangle, Clock } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { format, isPast, isToday, isTomorrow, differenceInDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { supabase } from "@/integrations/supabase/client";

interface Props {
  taskId: string
  children: React.ReactNode
}

const priorityConfig: Record<string, { label: string; class: string }> = {
  low: {
    label: 'Basse',
    class: 'bg-slate-100 text-foreground dark:bg-slate-800 dark:text-muted-foreground',
  },
  medium: {
    label: 'Normale',
    class: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  },
  high: {
    label: 'Haute',
    class: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  },
}

const statusConfig: Record<string, { label: string; class: string }> = {
  'A faire': {
    label: 'À faire',
    class: 'bg-slate-100 text-foreground dark:bg-slate-800 dark:text-muted-foreground',
  },
  'En cours': {
    label: 'En cours',
    class: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  },
  Terminé: {
    label: 'Terminée',
    class: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  },
  Bloqué: {
    label: 'Bloquée',
    class: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  },
}

export function AITaskHoverCard({ taskId, children }: Props) {
  const { data: task } = useQuery({
    queryKey: ['task-hover', taskId],
    queryFn: async () => {
      const { data } = await supabase
        .from('taches')
        .select(
          `
          id,
          titre,
          description,
          statut,
          priorite,
          echeance,
          etablissement_id,
          responsable_id
        `
        )
        .eq('id', taskId)
        .maybeSingle()

      if (!data) return null

      // Get related data separately to avoid relationship errors
      let etablissement = null
      let assigne = null
      const categorie = null

      if (data.etablissement_id) {
        const { data: etab } = await supabase
          .from('etablissements')
          .select('id, nom')
          .eq('id', data.etablissement_id)
          .maybeSingle()
        etablissement = etab
      }

      if (data.responsable_id) {
        const { data: resp } = await supabase
          .from('profiles')
          .select('id, nom, prenom, avatar_url')
          .eq('id', data.responsable_id)
          .maybeSingle()
        assigne = resp
      }

      return {
        ...data,
        etablissement,
        assigne,
        categorie,
      }
    },
    enabled: !!taskId,
    staleTime: 60000,
  })

  if (!task) return <>{children}</>

  const priority = priorityConfig[task.priorite] || priorityConfig['normale']
  const status = statusConfig[task.statut] || statusConfig['a_faire']

  // Calculate deadline status
  const echeance = task.echeance ? new Date(task.echeance) : null
  let deadlineStatus: 'overdue' | 'today' | 'tomorrow' | 'soon' | 'normal' = 'normal'
  let deadlineText = ''

  if (echeance) {
    if (isPast(echeance) && task.statut !== 'Terminé') {
      deadlineStatus = 'overdue'
      const daysOverdue = Math.abs(differenceInDays(new Date(), echeance))
      deadlineText = daysOverdue === 0 ? 'En retard' : `En retard de ${daysOverdue}j`
    } else if (isToday(echeance)) {
      deadlineStatus = 'today'
      deadlineText = "Aujourd'hui"
    } else if (isTomorrow(echeance)) {
      deadlineStatus = 'tomorrow'
      deadlineText = 'Demain'
    } else {
      const daysUntil = differenceInDays(echeance, new Date())
      if (daysUntil <= 3) {
        deadlineStatus = 'soon'
      }
      deadlineText = format(echeance, 'dd MMM yyyy', { locale: fr })
    }
  }

  return (
    <HoverCard openDelay={200}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent className="w-80" side="right" align="start">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                task.priorite === 'high' ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-primary/10'
              }`}
            >
              <CheckSquare
                className={`h-5 w-5 ${
                  task.priorite === 'high' ? 'text-orange-600 dark:text-orange-400' : 'text-primary'
                }`}
              />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm leading-tight line-clamp-2">{task.titre}</h4>
            </div>
          </div>

          {/* Status and Priority */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className={status.class}>
              {status.label}
            </Badge>
            <Badge variant="secondary" className={priority.class}>
              {priority.label}
            </Badge>
          </div>

          {/* Deadline */}
          {echeance && (
            <div
              className={`flex items-center gap-2 text-xs rounded-md px-2 py-1.5 ${
                deadlineStatus === 'overdue'
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                  : deadlineStatus === 'today'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                    : deadlineStatus === 'tomorrow'
                      ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                      : deadlineStatus === 'soon'
                        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                        : 'bg-muted/50 text-muted-foreground'
              }`}
            >
              {deadlineStatus === 'overdue' ? (
                <AlertTriangle className="h-3 w-3 shrink-0" />
              ) : (
                <Clock className="h-3 w-3 shrink-0" />
              )}
              <span className="font-medium">{deadlineText}</span>
            </div>
          )}

          {/* Assignee */}
          {task.assigne && (
            <div className="flex items-center gap-2 text-xs">
              <UserAvatar
                avatarUrl={task.assigne.avatar_url}
                email=""
                name={`${task.assigne.prenom} ${task.assigne.nom}`}
                size="xs"
              />
              <span className="text-muted-foreground">Assigné à</span>
              <span className="font-medium">
                {task.assigne.prenom} {task.assigne.nom}
              </span>
            </div>
          )}

          {/* Établissement lié */}
          {task.etablissement && (
            <div className="flex items-center gap-2 text-xs bg-muted/50 rounded-md px-2 py-1.5">
              <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Établissement:</span>
              <span className="font-medium truncate">{task.etablissement.nom}</span>
            </div>
          )}

          {/* Description preview */}
          {task.description && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground line-clamp-3">{task.description}</p>
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
