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
import { MoreHorizontal, StickyNote, ListTodo, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/shared/use-toast'
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer'
import { useQueryClient } from '@tanstack/react-query'
import { formatDateFr } from '@/lib/analyseGeoUtils'
import {
  updateEtablissementNotes,
  fetchEtablissementActiveTasksWithCategories,
} from '@/services/etablissement/etablissementMutations';

interface GeoQuickActionsProps {
  etablissement: any
}

export function GeoQuickActions({ etablissement }: GeoQuickActionsProps) {
  const [showNoteDialog, setShowNoteDialog] = useState(false)
  const [showTasksDialog, setShowTasksDialog] = useState(false)
  const [note, setNote] = useState(etablissement.notes || '')
  const [saving, setSaving] = useState(false)
  const [tasks, setTasks] = useState<any[]>([])
  const [loadingTasks, setLoadingTasks] = useState(false)
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const handleSaveNote = async () => {
    setSaving(true)
    try {
      await updateEtablissementNotes(etablissement.id, note)

      toast({ title: 'Note mise à jour' })
      queryClient.invalidateQueries({ queryKey: ['etablissements'] })
      setShowNoteDialog(false)
    } catch (error: unknown) {
      toast({ title: 'Erreur', description: sanitizeSupabaseError(error), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const loadTasks = async () => {
    setLoadingTasks(true)
    try {
      const data = await fetchEtablissementActiveTasksWithCategories(etablissement.id, 10)
      setTasks(data)
    } catch (error) {
      debug.error('Error loading tasks:', error)
    } finally {
      setLoadingTasks(false)
    }
  }

  const handleOpenTasksDialog = () => {
    setShowTasksDialog(true)
    loadTasks()
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
            Ajouter une note
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleOpenTasksDialog}>
            <ListTodo className="h-4 w-4 mr-2" />
            Voir les tâches
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialog Note */}
      <Dialog open={showNoteDialog} onOpenChange={setShowNoteDialog}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Note pour {etablissement.nom}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ajouter une note..."
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

      {/* Dialog Tâches */}
      <Dialog open={showTasksDialog} onOpenChange={setShowTasksDialog}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Tâches en cours - {etablissement.nom}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {loadingTasks ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : tasks.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Aucune tâche en cours
              </p>
            ) : (
              tasks.map((task) => (
                <div
                  key={task.id}
                  className="p-3 border rounded-lg space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{task.titre}</span>
                    {task.categories_taches && (
                      <span 
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{ 
                          backgroundColor: `${task.categories_taches.couleur}20`,
                          color: task.categories_taches.couleur 
                        }}
                      >
                        {task.categories_taches.nom}
                      </span>
                    )}
                  </div>
                  {task.echeance && (
                    <p className="text-xs text-muted-foreground">
                      Échéance : {formatDateFr(task.echeance)}
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
