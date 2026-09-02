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
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { useCreateTache } from "@/hooks/tasks/useTaches"
import { useProfiles } from "@/hooks/profile/useProfiles"
import { useCategories } from "@/hooks/catalogue/useCategories"
import { useEtablissement } from "@/hooks/crm/useEtablissements"
import { useToast } from "@/hooks/shared/use-toast"
import { getPhaseByStatus, getCumulativeCategoriesUpToPhase } from "@/config/phases"
import { useMemo } from "react"

interface CreateTaskDialogProps {
  etablissementId: string
  triggerButton?: React.ReactNode
}

export function CreateTaskDialog({ etablissementId, triggerButton }: CreateTaskDialogProps) {
  const [open, setOpen] = useState(false)
  const [titre, setTitre] = useState("")
  const [description, setDescription] = useState("")
  const [priorite, setPriorite] = useState<'low' | 'medium' | 'high'>('medium')
  const [echeance, setEcheance] = useState<Date | undefined>()
  const [categorieId, setCategorieId] = useState<string>("")
  const [responsableId, setResponsableId] = useState<string>("none")
  
  const createTache = useCreateTache()
  const { data: profiles } = useProfiles()
  const { data: categories } = useCategories()
  const { data: etablissement } = useEtablissement(etablissementId)
  const { toast } = useToast()
  
  // Filter categories based on establishment phase
  const filteredCategories = useMemo(() => {
    if (!categories) return [];
    if (!etablissement) return categories;
    
    const phase = getPhaseByStatus(etablissement.statut);
    if (!phase) return categories;
    
    const allowedCategories = getCumulativeCategoriesUpToPhase(phase);
    
    return categories.filter(cat => {
      const normalizedCatName = cat.nom.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return allowedCategories.some(
        allowed => allowed.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === normalizedCatName
      );
    });
  }, [categories, etablissement]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!titre.trim()) {
      toast({
        title: "Erreur",
        description: "Le titre est obligatoire",
        variant: "destructive"
      })
      return
    }

    if (!categorieId) {
      toast({
        title: "Erreur",
        description: "La catégorie est obligatoire",
        variant: "destructive"
      })
      return
    }
    
    try {
      await createTache.mutateAsync({
        etablissement_id: etablissementId,
        titre: titre.trim(),
        description: description.trim() || undefined,
        priorite,
        statut: 'A faire',
        categorie_id: categorieId,
        echeance: echeance ? format(echeance, 'yyyy-MM-dd') : undefined,
        responsable_id: responsableId === "none" ? undefined : responsableId,
        ordre: 999 // Par défaut en fin de liste
      })
      
      toast({
        title: "Tâche créée",
        description: "La nouvelle tâche a été ajoutée avec succès"
      })
      
      // Reset form
      setTitre("")
      setDescription("")
      setPriorite('medium')
      setEcheance(undefined)
      setCategorieId("")
      setResponsableId("none")
      setOpen(false)
    } catch (error) {
      debug.error('Erreur lors de la création:', error)
      toast({
        title: "Erreur",
        description: "Impossible de créer la tâche",
        variant: "destructive"
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Créer une nouvelle tâche</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="titre">Titre *</Label>
            <Input
              id="titre"
              value={titre}
              onChange={(e) => setTitre(e.target.value.slice(0, 200))}
              placeholder="Titre de la tâche"
              required
              maxLength={200}
            />
            <p className="text-xs text-muted-foreground text-right">{titre.length}/200</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description détaillée de la tâche"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="categorie">Catégorie *</Label>
            <Select value={categorieId} onValueChange={setCategorieId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une catégorie" />
              </SelectTrigger>
              <SelectContent>
                {filteredCategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {etablissement && filteredCategories.length < (categories?.length || 0) && (
              <p className="text-xs text-muted-foreground">
                Catégories limitées selon la phase "{etablissement.statut}" de l'établissement
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="priorite">Priorité</Label>
            <Select value={priorite} onValueChange={(value) => setPriorite(value as 'low' | 'medium' | 'high')}>
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

          <div className="space-y-2">
            <Label>Date d'échéance</Label>
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
                  {echeance ? format(echeance, 'PPP', { locale: fr }) : 'Sélectionner une date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={echeance}
                  onSelect={setEcheance}
                  locale={fr}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="responsable">Responsable</Label>
            <Select value={responsableId} onValueChange={setResponsableId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Non assigné</SelectItem>
                {profiles?.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.prenom} {profile.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={createTache.isPending}>
              {createTache.isPending ? 'Création...' : 'Créer la tâche'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
