import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, StickyNote, CheckSquare, Activity, Send } from 'lucide-react'
import { useCreateProductionNote } from '@/hooks/hr/useRHMutations'
import { useAuth } from '@/hooks/shared/useAuth'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Etablissement } from '@/hooks/crm/useEtablissements'
import {
  fetchEtablissementPendingTasks,
  fetchEtablissementRecentActivities,
} from '@/services/etablissement/etablissementMutations';

interface ProductionQuickActionsProps {
  etablissement: Etablissement
}

export function ProductionQuickActions({ etablissement }: ProductionQuickActionsProps) {
  const { user } = useAuth()
  const [noteContent, setNoteContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [tasksOpen, setTasksOpen] = useState(false)
  const [activitiesOpen, setActivitiesOpen] = useState(false)

  // Fetch pending tasks
  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['production-quick-tasks', etablissement.id],
    queryFn: () => fetchEtablissementPendingTasks(etablissement.id, 5),
    enabled: tasksOpen
  })

  // Fetch recent activities
  const { data: activities, isLoading: activitiesLoading } = useQuery({
    queryKey: ['production-quick-activities', etablissement.id],
    queryFn: () => fetchEtablissementRecentActivities(etablissement.id, 5),
    enabled: activitiesOpen
  })

  const createNoteMutation = useCreateProductionNote()

  const handleSubmitNote = async () => {
    if (!noteContent.trim() || !user) return

    setIsSubmitting(true)
    try {
      await createNoteMutation.mutateAsync({
        etablissement_id: etablissement.id,
        content: noteContent,
      })
      setNoteContent('')
      setNoteOpen(false)
    } catch {
      toast.error("Erreur lors de l'ajout de la note")
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatDate = (date: string | null) => {
    if (!date) return 'Sans date'
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit'
    })
  }

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case 'haute': return 'text-destructive'
      case 'moyenne': return 'text-warning'
      default: return 'text-muted-foreground'
    }
  }

  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {/* Note rapide */}
      <Popover open={noteOpen} onOpenChange={setNoteOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Ajouter une note" aria-label="Note">
            <StickyNote className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <div className="space-y-3">
            <p className="font-medium text-sm">Note rapide</p>
            <Textarea
              placeholder="Votre note..."
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              rows={3}
            />
            <Button
              size="sm"
              className="w-full gap-2"
              onClick={handleSubmitNote}
              disabled={!noteContent.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Enregistrer
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Aperçu tâches */}
      <Popover open={tasksOpen} onOpenChange={setTasksOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Voir les tâches" aria-label="Tout sélectionner">
            <CheckSquare className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <div className="space-y-3">
            <p className="font-medium text-sm">Tâches en cours</p>
            {tasksLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : tasks && tasks.length > 0 ? (
              <div className="space-y-2">
                {tasks.map(task => (
                  <div 
                    key={task.id} 
                    className="text-sm p-2 rounded bg-muted flex justify-between items-center"
                  >
                    <span className="truncate flex-1">{task.titre}</span>
                    <span className={`text-xs ${getPriorityColor(task.priorite)}`}>
                      {formatDate(task.echeance)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucune tâche en cours
              </p>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Aperçu activités */}
      <Popover open={activitiesOpen} onOpenChange={setActivitiesOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Voir les activités" aria-label="Activité">
            <Activity className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <div className="space-y-3">
            <p className="font-medium text-sm">Activités récentes</p>
            {activitiesLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : activities && activities.length > 0 ? (
              <div className="space-y-2">
                {activities.map((activity: any) => (
                  <div 
                    key={activity.id} 
                    className="text-sm p-2 rounded bg-muted flex justify-between items-center"
                  >
                    <span className="truncate flex-1">{activity.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(activity.activity_date)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucune activité récente
              </p>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
