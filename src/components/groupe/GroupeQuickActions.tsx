import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { StickyNote, ListTodo, Activity, Loader2 } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useGroupeActivityStats } from '@/hooks/crm/useGroupeActivities'
import { useGroupeTaskStats } from '@/hooks/crm/useGroupeTasksWithEstablishments'
import { useUpdateGroupe } from '@/hooks/crm/useGroupes'
import { toast } from 'sonner'

interface GroupeQuickActionsProps {
  groupeId: string
  groupeNom: string
  currentNotes?: string
}

export function GroupeQuickActions({ groupeId, groupeNom, currentNotes }: GroupeQuickActionsProps) {
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState('')
  
  const updateGroupe = useUpdateGroupe()
  const { stats: activityStats, isLoading: loadingActivities } = useGroupeActivityStats(groupeId)
  const { stats: taskStats, isLoading: loadingTasks } = useGroupeTaskStats(groupeId)

  const handleSaveNote = async () => {
    try {
      const timestamp = new Date().toLocaleDateString('fr-FR')
      const newNote = currentNotes 
        ? `${currentNotes}\n\n[${timestamp}] ${note}`
        : `[${timestamp}] ${note}`
      
      await updateGroupe.mutateAsync({
        id: groupeId,
        data: { notes: newNote }
      })
      toast.success('Note ajoutée')
      setNoteOpen(false)
      setNote('')
    } catch (error) {
      toast.error('Erreur lors de l\'ajout de la note')
    }
  }

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        {/* Add Note */}
        <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Ajouter une note"
                >
                  <StickyNote className="h-4 w-4" />
                </Button>
              </DialogTrigger>
            </TooltipTrigger>
            <TooltipContent>
              <p>Ajouter une note rapide</p>
            </TooltipContent>
          </Tooltip>
          <DialogContent onClick={(e) => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle>Note rapide - {groupeNom}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nouvelle note</Label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Saisissez votre note..."
                  rows={4}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setNoteOpen(false)}>
                  Annuler
                </Button>
                <Button 
                  onClick={handleSaveNote}
                  disabled={!note.trim() || updateGroupe.isPending}
                >
                  {updateGroupe.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Enregistrer
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Tasks Summary */}
        <Popover>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => e.stopPropagation()}
                  className="relative"
                  aria-label="Aperçu des tâches"
                >
                  <ListTodo className="h-4 w-4" />
                  {taskStats.inProgress > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] text-primary-foreground flex items-center justify-center">
                      {taskStats.inProgress}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent>
              <p>Aperçu des tâches</p>
            </TooltipContent>
          </Tooltip>
          <PopoverContent 
            className="w-64" 
            align="end" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-3">
              <h4 className="font-semibold text-sm">Tâches du groupe</h4>
              {loadingTasks ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="p-2 rounded bg-muted/50">
                      <p className="text-lg font-bold">{taskStats.groupeTotal}</p>
                      <p className="text-xs text-muted-foreground">Tâches groupe</p>
                    </div>
                    <div className="p-2 rounded bg-muted/50">
                      <p className="text-lg font-bold">{taskStats.etablissementTotal}</p>
                      <p className="text-xs text-muted-foreground">Tâches établ.</p>
                    </div>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                      {taskStats.completed} terminées
                    </span>
                    <span className="px-2 py-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                      {taskStats.inProgress} en cours
                    </span>
                  </div>
                </>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Activities Summary */}
        <Popover>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => e.stopPropagation()}
                  className="relative"
                  aria-label="Aperçu des activités"
                >
                  <Activity className="h-4 w-4" />
                  {activityStats.recentCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-emerald-500 text-[10px] text-white flex items-center justify-center">
                      {activityStats.recentCount > 9 ? '9+' : activityStats.recentCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent>
              <p>Aperçu des activités</p>
            </TooltipContent>
          </Tooltip>
          <PopoverContent 
            className="w-64" 
            align="end"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-3">
              <h4 className="font-semibold text-sm">Activités récentes</h4>
              {loadingActivities ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="p-2 rounded bg-muted/50">
                      <p className="text-lg font-bold">{activityStats.total}</p>
                      <p className="text-xs text-muted-foreground">Total</p>
                    </div>
                    <div className="p-2 rounded bg-muted/50">
                      <p className="text-lg font-bold">{activityStats.recentCount}</p>
                      <p className="text-xs text-muted-foreground">Ce mois</p>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {activityStats.byStatus.completed} terminées • 
                    {activityStats.byStatus.in_progress} en cours
                  </div>
                </>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </TooltipProvider>
  )
}
