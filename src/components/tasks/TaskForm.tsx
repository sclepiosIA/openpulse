import { useState } from "react"
import { debug } from "@/lib/debug"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Edit, UserPlus } from "lucide-react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { Tache, useUpdateTache } from "@/hooks/tasks/useTaches"
import { useProfiles } from "@/hooks/profile/useProfiles"

interface TaskFormProps {
  tache: Tache
  mode: 'edit' | 'assign'
  trigger?: React.ReactNode
}

export function TaskForm({ tache, mode, trigger }: TaskFormProps) {
  const [open, setOpen] = useState(false)
  const [titre, setTitre] = useState(tache.titre)
  const [description, setDescription] = useState(tache.description || "")
  const [priorite, setPriorite] = useState(tache.priorite)
  const [echeance, setEcheance] = useState<Date | undefined>(
    tache.echeance ? new Date(tache.echeance) : undefined
  )
  const [responsableId, setResponsableId] = useState(tache.responsable_id || "none")
  
  const updateTache = useUpdateTache()
  const { data: profiles } = useProfiles()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      await updateTache.mutateAsync({
        id: tache.id,
        data: {
          ...(mode === 'edit' && { titre, description, priorite }),
          ...(echeance && { echeance: format(echeance, 'yyyy-MM-dd') }),
          responsable_id: responsableId === "none" ? undefined : responsableId,
        }
      })
      setOpen(false)
    } catch (error) {
      debug.error('Erreur lors de la mise à jour:', error)
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {mode === 'edit' ? 'Modifier la tâche' : 'Assigner la tâche'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'edit' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="titre">Titre</Label>
                <Input
                  id="titre"
                  value={titre}
                  onChange={(e) => setTitre(e.target.value.slice(0, 200))}
                  required
                  maxLength={200}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Priorité</Label>
                <Select value={priorite} onValueChange={(value: 'low' | 'medium' | 'high') => setPriorite(value)}>
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
            </>
          )}

          <div className="space-y-2">
            <Label>Échéance</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !echeance && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {echeance ? format(echeance, "PPP", { locale: fr }) : "Sélectionner une date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={echeance}
                  onSelect={setEcheance}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Responsable</Label>
            <Select value={responsableId} onValueChange={setResponsableId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un responsable" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucun responsable</SelectItem>
                {profiles?.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.prenom} {profile.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={updateTache.isPending}>
              {updateTache.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}