import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  StickyNote,
  ListTodo,
  Activity,
  Send,
  Loader2,
} from 'lucide-react'
import { useToast } from '@/hooks/shared/use-toast'
import { supabase } from '@/lib/supabaseBrowser'
import { useQuery } from '@tanstack/react-query'
import type { Etablissement } from '@/hooks/crm/useEtablissements'

interface DeploymentQuickActionsProps {
  etablissement: Etablissement
}

export function DeploymentQuickActions({ etablissement }: DeploymentQuickActionsProps) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [noteContent, setNoteContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)

  // Fetch recent tasks count
  const { data: tasksData } = useQuery({
    queryKey: ['deployment-tasks-preview', etablissement.id],
    queryFn: async () => {
      const { data, count } = await supabase
        .from('taches')
        .select('id, titre, statut', { count: 'exact' })
        .eq('etablissement_id', etablissement.id)
        .in('statut', ['A faire', 'En cours'])
        .limit(3)
      return { tasks: data || [], total: count || 0 }
    },
    staleTime: 30000
  })

  // Fetch recent activities
  const { data: activitiesData } = useQuery({
    queryKey: ['deployment-activities-preview', etablissement.id],
    queryFn: async () => {
      const { data, count } = await supabase
        .from('customer_activities')
        .select('id, title, activity_type, activity_date', { count: 'exact' })
        .eq('etablissement_id', etablissement.id)
        .order('activity_date', { ascending: false })
        .limit(3)
      return { activities: data || [], total: count || 0 }
    },
    staleTime: 30000
  })

  const handleAddNote = async () => {
    if (!noteContent.trim()) return

    setIsSubmitting(true)
    try {
      const { error } = await supabase
        .from('customer_activities')
        .insert({
          etablissement_id: etablissement.id,
          activity_type: 'note',
          title: 'Note rapide',
          description: noteContent,
          activity_date: new Date().toISOString()
        })

      if (error) throw error

      toast({
        title: "Note ajoutée",
        description: "La note a été enregistrée avec succès"
      })
      setNoteContent('')
      setNoteOpen(false)
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter la note",
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
      {/* Note rapide */}
      <Popover open={noteOpen} onOpenChange={setNoteOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Note">
            <StickyNote className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end" onClick={e => e.stopPropagation()}>
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Ajouter une note</h4>
            <Textarea
              placeholder="Contenu de la note..."
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              rows={3}
            />
            <Button 
              size="sm" 
              className="w-full" 
              onClick={handleAddNote}
              disabled={isSubmitting || !noteContent.trim()}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Enregistrer
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Aperçu tâches */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 relative" aria-label="Tâches">
            <ListTodo className="h-4 w-4" />
            {tasksData && tasksData.total > 0 && (
              <Badge 
                variant="secondary" 
                className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
              >
                {tasksData.total}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72" align="end" onClick={e => e.stopPropagation()}>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">Tâches en cours</h4>
              <Badge variant="outline">{tasksData?.total || 0}</Badge>
            </div>
            {tasksData?.tasks.length ? (
              <div className="space-y-2">
                {tasksData.tasks.map(task => (
                  <div key={task.id} className="flex items-center gap-2 text-sm">
                    <span className={`w-2 h-2 rounded-full ${
                      task.statut === 'En cours' ? 'bg-primary' : 'bg-muted-foreground'
                    }`} />
                    <span className="truncate flex-1">{task.titre}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune tâche en cours</p>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={() => navigate(`/etablissements/${etablissement.id}?tab=taches`)}
            >
              Voir toutes les tâches
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Aperçu activités */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 relative" aria-label="Activités">
            <Activity className="h-4 w-4" />
            {activitiesData && activitiesData.total > 0 && (
              <Badge 
                variant="secondary" 
                className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
              >
                {activitiesData.total > 9 ? '9+' : activitiesData.total}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72" align="end" onClick={e => e.stopPropagation()}>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">Activités récentes</h4>
              <Badge variant="outline">{activitiesData?.total || 0}</Badge>
            </div>
            {activitiesData?.activities.length ? (
              <div className="space-y-2">
                {activitiesData.activities.map(activity => (
                  <div key={activity.id} className="text-sm">
                    <p className="truncate font-medium">{activity.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {activity.activity_date 
                        ? new Date(activity.activity_date).toLocaleDateString('fr-FR')
                        : '-'
                      }
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune activité récente</p>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={() => navigate(`/etablissements/${etablissement.id}?tab=activites`)}
            >
              Voir toutes les activités
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
