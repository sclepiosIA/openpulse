import { useState } from 'react'
import { debug } from '@/lib/debug'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { MoreHorizontal, StickyNote, Activity, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/shared/use-toast'
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer'
import { useQueryClient } from '@tanstack/react-query'
import { formatDateFr } from '@/lib/projetsUtils'
import { supabase } from "@/integrations/supabase/client";

interface TaskQuickActionsProps {
  task: any
}

export function TaskQuickActions({ task }: TaskQuickActionsProps) {
  const [showNoteDialog, setShowNoteDialog] = useState(false)
  const [showActivityDialog, setShowActivityDialog] = useState(false)
  const [note, setNote] = useState(task.description || '')
  const [saving, setSaving] = useState(false)
  const [activities, setActivities] = useState<any[]>([])
  const [loadingActivities, setLoadingActivities] = useState(false)
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const handleSaveNote = async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('taches')
        .update({ description: note })
        .eq('id', task.id)

      if (error) throw error

      toast({ title: 'Note mise à jour' })
      queryClient.invalidateQueries({ queryKey: ['taches'] })
      setShowNoteDialog(false)
    } catch (error: unknown) {
      toast({ title: 'Erreur', description: sanitizeSupabaseError(error), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const loadActivities = async () => {
    if (!task.etablissement_id) return
    
    setLoadingActivities(true)
    try {
      const { data, error } = await supabase
        .from('customer_activities')
        .select('id, etablissement_id, activity_type, activity_date, description, created_at')
        .eq('etablissement_id', task.etablissement_id)
        .order('activity_date', { ascending: false })
        .limit(5)

      if (error) throw error
      setActivities(data || [])
    } catch (error) {
      debug.error('Error loading activities:', error)
    } finally {
      setLoadingActivities(false)
    }
  }

  const handleOpenActivityDialog = () => {
    setShowActivityDialog(true)
    loadActivities()
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="sm" aria-label="Plus d'options" title="Plus d'options" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onClick={() => setShowNoteDialog(true)}>
            <StickyNote className="h-4 w-4 mr-2" />
            Modifier la note
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleOpenActivityDialog}>
            <Activity className="h-4 w-4 mr-2" />
            Voir les activités
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialog Note */}
      <Dialog open={showNoteDialog} onOpenChange={setShowNoteDialog}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Note pour "{task.titre}"</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ajouter une note ou description..."
              rows={5}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNoteDialog(false)}>
                Annuler
              </Button>
              <Button onClick={handleSaveNote} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Enregistrer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Activités */}
      <Dialog open={showActivityDialog} onOpenChange={setShowActivityDialog}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Activités récentes - {task.etablissements?.nom}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {loadingActivities ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : activities.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Aucune activité récente
              </p>
            ) : (
              activities.map((activity) => (
                <div
                  key={activity.id}
                  className="p-3 border rounded-lg space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{activity.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDateFr(activity.activity_date)}
                    </span>
                  </div>
                  {activity.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {activity.description}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
