import { memo, useEffect } from 'react'
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
import { useUpdateTache, useDeleteTache } from '@/hooks/tasks/useTaches'
import { useTachesDocuments } from '@/hooks/tasks/useTachesDocuments'
import { useProfiles } from '@/hooks/profile/useProfiles'
import { Loader2, Trash2, Archive, CheckCircle } from 'lucide-react'
import { useToast } from '@/hooks/shared/use-toast'
import { TacheDocuments } from '@/components/tasks/TacheDocuments'

const taskEditSchema = z.object({
  titre: z.string().min(1, 'Le titre est requis'),
  description: z.string().optional(),
  statut: z.enum(['A faire', 'En cours', 'Bloqué', 'Terminé']),
  priorite: z.enum(['low', 'medium', 'high']),
  date_debut: z.string().optional(),
  echeance: z.string().optional(),
  responsable_id: z.string().nullable().optional(),
})

type TaskEditFormData = z.infer<typeof taskEditSchema>

interface TaskQuickEditDialogProps {
  task: any | null
  isOpen: boolean
  onClose: () => void
}

export const TaskQuickEditDialog = memo(({ task, isOpen, onClose }: TaskQuickEditDialogProps) => {
  const { toast } = useToast()
  const updateTache = useUpdateTache()
  const deleteTache = useDeleteTache()
  const { data: documents } = useTachesDocuments(task?.id || '')
  const { data: profiles } = useProfiles()
  const documentCount = documents?.length || 0

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

  // Pré-remplir le formulaire quand la tâche change
  useEffect(() => {
    if (task) {
      reset({
        titre: task.titre || '',
        description: task.description || '',
        statut: task.statut || 'A faire',
        priorite: task.priorite || 'medium',
        date_debut: task.date_debut || undefined,
        echeance: task.echeance || undefined,
        responsable_id: task.responsable_id || null,
      })
    }
  }, [task, reset])

  const onSubmit = async (data: TaskEditFormData) => {
    if (!task) return

    try {
      await updateTache.mutateAsync({
        id: task.id,
        data: {
          titre: data.titre,
          description: data.description || undefined,
          statut: data.statut,
          priorite: data.priorite,
          date_debut: data.date_debut || undefined,
          echeance: data.echeance || undefined,
          responsable_id: data.responsable_id || undefined,
        }
      })

      onClose()
    } catch (error) {
      debug.error('Error updating task:', error)
    }
  }

  const handleDelete = async () => {
    if (!task || !confirm('Êtes-vous sûr de vouloir supprimer cette tâche ?')) return

    try {
      await deleteTache.mutateAsync(task.id)
      onClose()
    } catch (error) {
      debug.error('Error deleting task:', error)
    }
  }

  const handleArchive = async () => {
    if (!task) return

    try {
      // Archive via deleteTache qui gère l'archivage
      await deleteTache.mutateAsync(task.id)
      toast({
        title: "Tâche archivée",
        description: "La tâche a été archivée avec succès"
      })
      onClose()
    } catch (error) {
      debug.error('Error archiving task:', error)
    }
  }

  const handleMarkAsComplete = async () => {
    if (!task) return

    try {
      await updateTache.mutateAsync({
        id: task.id,
        data: {
          statut: 'Terminé',
          date_realisation: new Date().toISOString().split('T')[0]
        }
      })
      toast({
        title: "Tâche terminée",
        description: "La tâche a été marquée comme terminée"
      })
      onClose()
    } catch (error) {
      debug.error('Error marking task as complete:', error)
    }
  }

  if (!task) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Modifier la tâche</DialogTitle>
          <DialogDescription>
            Modifiez les détails de la tâche ci-dessous
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="details" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">
              Détails
            </TabsTrigger>
            <TabsTrigger value="documents">
              <span>Documents</span>
              {documentCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {documentCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="details" className="flex-1 overflow-y-auto">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Titre */}
              <div className="space-y-2">
                <Label htmlFor="titre">Titre *</Label>
                <Input
              id="titre"
              {...register('titre')}
              placeholder="Titre de la tâche"
            />
            {errors.titre && (
              <p className="text-sm text-destructive">{errors.titre.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Description détaillée..."
              rows={3}
            />
          </div>

          {/* Statut et Priorité */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="statut">Statut *</Label>
              <Select
                value={watch('statut')}
                onValueChange={(value) => setValue('statut', value as any, { shouldDirty: true })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A faire">A faire</SelectItem>
                  <SelectItem value="En cours">En cours</SelectItem>
                  <SelectItem value="Bloqué">Bloqué</SelectItem>
                  <SelectItem value="Terminé">Terminé</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priorite">Priorité *</Label>
              <Select
                value={watch('priorite')}
                onValueChange={(value) => setValue('priorite', value as any, { shouldDirty: true })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Basse</SelectItem>
                  <SelectItem value="medium">Moyenne</SelectItem>
                  <SelectItem value="high">Haute</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date de début et Échéance */}
          <div className="grid grid-cols-2 gap-4">
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
                <SelectItem value="__none__">Aucun responsable</SelectItem>
                {profiles?.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.prenom} {profile.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="flex-row items-center gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleArchive}
              disabled={updateTache.isPending}
              className="mr-auto"
            >
              <Archive className="h-4 w-4 mr-2" />
              Archiver
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleteTache.isPending}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Supprimer
            </Button>
            {watch('statut') !== 'Terminé' && (
              <Button
                type="button"
                size="sm"
                onClick={handleMarkAsComplete}
                disabled={updateTache.isPending}
                className="bg-green-600 text-white hover:bg-green-700 border-green-600"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Terminé
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={!isDirty || updateTache.isPending}
            >
              {updateTache.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </TabsContent>
      
      <TabsContent value="documents" className="flex-1 overflow-y-auto">
        {task && (
          <TacheDocuments 
            tacheId={task.id}
            tacheTitre={task.titre}
            etablissementId={task.etablissement_id}
          />
        )}
      </TabsContent>
    </Tabs>
      </DialogContent>
    </Dialog>
  )
})

TaskQuickEditDialog.displayName = 'TaskQuickEditDialog'
