import { memo, useEffect, useState } from 'react'
import { debug } from '@/lib/debug'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { useUpdateTache, useDeleteTache, useArchiveTache } from '@/hooks/tasks/useTaches'
import { useTachesDocuments } from '@/hooks/tasks/useTachesDocuments'
import { useProfiles } from '@/hooks/profile/useProfiles'
import { Loader2, Trash2, Archive, CheckCircle, Edit, UserPlus, AlertTriangle, Clock, Circle, Repeat, MessageSquare } from 'lucide-react'
import { useToast } from '@/hooks/shared/use-toast'
import { TacheDocuments } from '@/components/tasks/TacheDocuments'
import { ClientPortalTaskConversation } from '@/components/portail-client/ClientPortalTaskConversation'
import { cn } from '@/lib/utils'

// Types stricts pour le formulaire de tâche
type TaskStatus = 'A faire' | 'En cours' | 'Bloqué' | 'Terminé';
type TaskPriority = 'low' | 'medium' | 'high';

const taskEditSchema = z.object({
  titre: z.string().min(1, 'Le titre est requis'),
  description: z.string().optional(),
  statut: z.enum(['A faire', 'En cours', 'Bloqué', 'Terminé']),
  priorite: z.enum(['low', 'medium', 'high']),
  date_debut: z.string().optional().nullable(),
  echeance: z.string().optional().nullable(),
  responsable_id: z.string().optional().nullable(),
  recurrence_rule: z.string().optional().nullable(),
})

type TaskEditFormData = z.infer<typeof taskEditSchema>

// Type strict pour les données de mise à jour de tâche
interface TaskUpdateData {
  titre?: string;
  description?: string;
  statut?: TaskStatus;
  priorite?: TaskPriority;
  date_debut?: string;
  echeance?: string;
  responsable_id?: string;
  recurrence_rule?: string | null;
}

interface TaskEditDialogProps {
  tache: {
    id: string
    titre: string
    description?: string | null
    statut?: string
    priorite?: string
    date_debut?: string | null
    echeance?: string | null
    responsable_id?: string | null
    etablissement_id?: string
    archive?: boolean
    recurrence_rule?: string | null
  }
  mode?: 'edit' | 'assign'
  trigger?: React.ReactNode
  /** Controlled open state - if provided, component is controlled externally */
  open?: boolean
  /** Callback when open state changes - required when using controlled mode */
  onOpenChange?: (open: boolean) => void
}

const PRIORITY_CONFIG = {
  low: { label: 'Basse', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: '🟢' },
  medium: { label: 'Moyenne', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: '🟡' },
  high: { label: 'Haute', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: '🔴' },
}

const STATUS_CONFIG = {
  'A faire': { label: 'A faire', icon: Circle, color: 'text-blue-500' },
  'En cours': { label: 'En cours', icon: Clock, color: 'text-orange-500' },
  'Bloqué': { label: 'Bloqué', icon: AlertTriangle, color: 'text-red-500' },
  'Terminé': { label: 'Terminé', icon: CheckCircle, color: 'text-green-500' },
}

export const TaskEditDialog = memo(({ tache, mode = 'edit', trigger, open: controlledOpen, onOpenChange }: TaskEditDialogProps) => {
  const [internalOpen, setInternalOpen] = useState(false)
  
  // Support controlled and uncontrolled modes
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = (value: boolean) => {
    if (isControlled) {
      onOpenChange?.(value)
    } else {
      setInternalOpen(value)
    }
  }
  
  const { toast } = useToast()
  const updateTache = useUpdateTache()
  const deleteTache = useDeleteTache()
  const archiveTache = useArchiveTache()
  const { data: documents } = useTachesDocuments(tache?.id)
  const { data: profiles } = useProfiles()
  const documentCount = documents?.length || 0
  const isPortalTask = typeof tache?.id === 'string' && tache.id.startsWith('portal-')
  const portalRawId = isPortalTask ? tache.id.replace(/^portal-/, '') : null

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isDirty }
  } = useForm<TaskEditFormData>({
    resolver: zodResolver(taskEditSchema),
  })

  // Pré-remplir le formulaire quand la tâche change ou le dialog s'ouvre
  useEffect(() => {
    if (open && tache) {
      // Valider et normaliser le statut
      const validStatuses: TaskStatus[] = ['A faire', 'En cours', 'Bloqué', 'Terminé'];
      const normalizedStatus: TaskStatus = validStatuses.includes(tache.statut as TaskStatus) 
        ? (tache.statut as TaskStatus) 
        : 'A faire';
      
      // Valider et normaliser la priorité
      const validPriorities: TaskPriority[] = ['low', 'medium', 'high'];
      const normalizedPriority: TaskPriority = validPriorities.includes(tache.priorite as TaskPriority)
        ? (tache.priorite as TaskPriority)
        : 'medium';

      reset({
        titre: tache.titre || '',
        description: tache.description || '',
        statut: normalizedStatus,
        priorite: normalizedPriority,
        date_debut: tache.date_debut || null,
        echeance: tache.echeance || null,
        responsable_id: tache.responsable_id || null,
        recurrence_rule: tache.recurrence_rule || null,
      })
    }
  }, [open, tache, reset])

  const onSubmit = async (data: TaskEditFormData) => {
    try {
      // Préparer les données avec gestion correcte des valeurs undefined
      const updateData: TaskUpdateData = {}

      if (mode === 'edit') {
        updateData.titre = data.titre
        updateData.description = data.description || undefined
        updateData.statut = data.statut
        updateData.priorite = data.priorite
      }

      // Gérer les dates - envoyer undefined si vide pour effacer
      updateData.date_debut = data.date_debut || undefined
      updateData.echeance = data.echeance || undefined

      // Gérer le responsable - envoyer undefined si non défini
      updateData.responsable_id = data.responsable_id || undefined
      
      // Gérer la récurrence
      updateData.recurrence_rule = data.recurrence_rule || null

      await updateTache.mutateAsync({
        id: tache.id,
        data: updateData
      })

      toast({
        title: "Succès",
        description: "Tâche mise à jour avec succès"
      })
      setOpen(false)
    } catch (error) {
      debug.error('Error updating task:', error)
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour la tâche",
        variant: "destructive"
      })
    }
  }

  const handleDelete = async () => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette tâche ?')) return

    try {
      await deleteTache.mutateAsync(tache.id)
      toast({
        title: "Succès",
        description: "Tâche supprimée"
      })
      setOpen(false)
    } catch (error) {
      debug.error('Error deleting task:', error)
    }
  }

  const handleArchive = async () => {
    try {
      await archiveTache.mutateAsync({ id: tache.id, archive: !tache.archive })
      toast({
        title: "Succès",
        description: tache.archive ? "Tâche désarchivée" : "Tâche archivée"
      })
      setOpen(false)
    } catch (error) {
      debug.error('Error archiving task:', error)
    }
  }

  const handleMarkAsComplete = async () => {
    try {
      await updateTache.mutateAsync({
        id: tache.id,
        data: {
          statut: 'Terminé',
          date_realisation: new Date().toISOString().split('T')[0]
        }
      })
      toast({
        title: "Tâche terminée",
        description: "La tâche a été marquée comme terminée"
      })
      setOpen(false)
    } catch (error) {
      debug.error('Error marking task as complete:', error)
    }
  }

  const defaultTrigger = (
    <Button variant="outline" size="sm">
      {mode === 'edit' ? (
        <>
          <Edit className="w-4 h-4 mr-2" />
          Modifier
        </>
      ) : (
        <>
          <UserPlus className="w-4 h-4 mr-2" />
          Assigner
        </>
      )}
    </Button>
  )

  const currentStatut = watch('statut')
  const currentPriorite = watch('priorite')

  // En mode contrôlé sans tâche, ne rien afficher
  if (!tache) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* N'afficher le trigger qu'en mode non contrôlé */}
      {!isControlled && (
        <DialogTrigger asChild>
          {trigger || defaultTrigger}
        </DialogTrigger>
      )}
      <DialogContent className="max-w-7xl w-[98vw] max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            {mode === 'edit' ? 'Modifier la tâche' : 'Assigner la tâche'}
            {isPortalTask && (
              <Badge variant="outline" className="border-primary/40 text-primary bg-primary/5">
                <MessageSquare className="h-3 w-3 mr-1" />
                Portail client
              </Badge>
            )}
            {currentStatut && STATUS_CONFIG[currentStatut as keyof typeof STATUS_CONFIG] && (
              <Badge variant="outline" className={cn("ml-1", STATUS_CONFIG[currentStatut as keyof typeof STATUS_CONFIG].color)}>
                {STATUS_CONFIG[currentStatut as keyof typeof STATUS_CONFIG].label}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {mode === 'edit' 
              ? (isPortalTask
                  ? 'Tâche échangée avec l\'établissement via le portail client.'
                  : 'Modifiez les détails de la tâche ci-dessous')
              : 'Assignez cette tâche à un membre de l\'équipe'}
          </DialogDescription>
        </DialogHeader>

        <div className={cn(
          "flex-1 overflow-hidden min-h-0",
          isPortalTask ? "grid grid-cols-1 lg:grid-cols-2 gap-4" : "flex flex-col"
        )}>
          <Tabs defaultValue="details" className="flex-1 overflow-hidden flex flex-col min-h-0">
            <TabsList className={cn("grid w-full", isPortalTask ? "grid-cols-1" : "grid-cols-2")}>
              <TabsTrigger value="details">Détails</TabsTrigger>
              {!isPortalTask && (
                <TabsTrigger value="documents" className="flex items-center gap-2">
                  Documents
                  {documentCount > 0 && (
                    <Badge variant="secondary" className="h-5 w-5 p-0 flex items-center justify-center text-xs">
                      {documentCount}
                    </Badge>
                  )}
                </TabsTrigger>
              )}
            </TabsList>
          
          <TabsContent value="details" className="flex-1 overflow-y-auto mt-4">
            <form id="task-edit-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Titre */}
              {mode === 'edit' && (
                <div className="space-y-2">
                  <Label htmlFor="titre">Titre <span className="text-destructive">*</span></Label>
                  <Input
                    id="titre"
                    {...register('titre')}
                    placeholder="Titre de la tâche"
                    className={cn(errors.titre && "border-destructive")}
                  />
                  {errors.titre && (
                    <p className="text-sm text-destructive">{errors.titre.message}</p>
                  )}
                </div>
              )}

              {/* Description */}
              {mode === 'edit' && (
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    {...register('description')}
                    placeholder="Description détaillée de la tâche..."
                    rows={3}
                    className="resize-none"
                  />
                </div>
              )}

              {/* Statut et Priorité - Seulement en mode edit */}
              {mode === 'edit' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="statut">Statut</Label>
                    <Select
                      value={currentStatut}
                      onValueChange={(value) => setValue('statut', value as any, { shouldDirty: true })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_CONFIG).map(([value, config]) => {
                          const Icon = config.icon
                          return (
                            <SelectItem key={value} value={value}>
                              <div className="flex items-center gap-2">
                                <Icon className={cn("w-4 h-4", config.color)} />
                                {config.label}
                              </div>
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="priorite">Priorité</Label>
                    <Select
                      value={currentPriorite}
                      onValueChange={(value) => setValue('priorite', value as any, { shouldDirty: true })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(PRIORITY_CONFIG).map(([value, config]) => (
                          <SelectItem key={value} value={value}>
                            <div className="flex items-center gap-2">
                              <span>{config.icon}</span>
                              {config.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date_debut">Date de début</Label>
                  <Input
                    id="date_debut"
                    type="date"
                    {...register('date_debut')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="echeance">Échéance</Label>
                  <Input
                    id="echeance"
                    type="date"
                    {...register('echeance')}
                  />
                </div>
              </div>

              {/* Responsable */}
              <div className="space-y-2">
                <Label htmlFor="responsable_id">Responsable</Label>
                <Select
                  value={watch('responsable_id') || '__none__'}
                  onValueChange={(value) => {
                    const actualValue = value === '__none__' ? null : value
                    setValue('responsable_id', actualValue, { shouldDirty: true })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un responsable" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      <span className="text-muted-foreground">Aucun responsable</span>
                    </SelectItem>
                    {profiles?.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                            {profile.prenom?.[0]}{profile.nom?.[0]}
                          </div>
                          {profile.prenom} {profile.nom}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Récurrence */}
              <div className="space-y-2">
                <Label htmlFor="recurrence_rule" className="flex items-center gap-2">
                  <Repeat className="w-4 h-4" />
                  Récurrence
                </Label>
                <Select
                  value={watch('recurrence_rule') || '__none__'}
                  onValueChange={(value) => {
                    const actualValue = value === '__none__' ? null : value
                    setValue('recurrence_rule', actualValue, { shouldDirty: true })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une récurrence" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Aucune récurrence</SelectItem>
                    <SelectItem value="FREQ=WEEKLY">Toutes les semaines</SelectItem>
                    <SelectItem value="FREQ=MONTHLY">Tous les mois</SelectItem>
                    <SelectItem value="FREQ=MONTHLY;INTERVAL=3">Tous les trimestres</SelectItem>
                    <SelectItem value="FREQ=YEARLY">Tous les ans</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </form>
          </TabsContent>
          
          {!isPortalTask && (
            <TabsContent value="documents" className="flex-1 overflow-y-auto mt-4">
              <TacheDocuments 
                tacheId={tache.id}
                tacheTitre={tache.titre}
                etablissementId={tache.etablissement_id}
              />
            </TabsContent>
          )}
        </Tabs>

        {isPortalTask && portalRawId && (
          <div className="flex flex-col min-h-0 overflow-hidden">
            <ClientPortalTaskConversation taskId={portalRawId} />
          </div>
        )}
        </div>

        <DialogFooter className="flex gap-2 pt-4 border-t justify-between">
          {/* Actions secondaires - à gauche */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleArchive}
              disabled={archiveTache.isPending}
              title={tache.archive ? 'Désarchiver' : 'Archiver'} aria-label="Archiver">
              <Archive className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="icon"
              onClick={handleDelete}
              disabled={deleteTache.isPending}
              title="Supprimer" aria-label="Supprimer">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Actions principales - à droite */}
          <div className="flex gap-2">
            {currentStatut !== 'Terminé' && (
              <Button
                type="button"
                size="icon"
                onClick={handleMarkAsComplete}
                disabled={updateTache.isPending}
                className="bg-green-600 hover:bg-green-700 text-white"
                title="Marquer comme terminé" aria-label="Valider">
                <CheckCircle className="h-4 w-4" />
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              size="sm"
              form="task-edit-form"
              disabled={!isDirty || updateTache.isPending}
            >
              {updateTache.isPending && (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              )}
              Enregistrer
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})

TaskEditDialog.displayName = 'TaskEditDialog'

// Export pour compatibilité avec les anciens usages de TaskForm
export { TaskEditDialog as TaskForm }
