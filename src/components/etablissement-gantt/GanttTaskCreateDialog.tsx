import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCreateTache } from '@/hooks/tasks/useCreateTache'
import { useCategories } from '@/hooks/catalogue/useCategories'
import { useEtablissements } from '@/hooks/crm/useEtablissements'
import { useActiveProfilesWithRoles } from '@/hooks/profile/useProfilesWithRoles'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { CalendarIcon, Building2, User, Repeat, Flag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'

interface GanttTaskCreateDialogProps {
  isOpen: boolean
  onClose: () => void
  etablissementId?: string
  defaultCategoryId?: string
}

export function GanttTaskCreateDialog({
  isOpen,
  onClose,
  etablissementId,
  defaultCategoryId
}: GanttTaskCreateDialogProps) {
  const [formData, setFormData] = useState({
    titre: '',
    description: '',
    categorie_id: defaultCategoryId || '',
    etablissement_id: etablissementId || '',
    priorite: 'medium' as 'low' | 'medium' | 'high',
    date_debut: null as Date | null,
    echeance: null as Date | null,
    responsable_id: '',
    recurrence_rule: ''
  })

  const { data: categories } = useCategories()
  const { data: etablissements } = useEtablissements()
  const { data: profiles } = useActiveProfilesWithRoles()
  const createTache = useCreateTache()

  // Reset form when dialog opens or etablissementId changes
  useEffect(() => {
    if (isOpen) {
      setFormData({
        titre: '',
        description: '',
        categorie_id: defaultCategoryId || '',
        etablissement_id: etablissementId || '',
        priorite: 'medium',
        date_debut: null,
        echeance: null,
        responsable_id: '',
        recurrence_rule: ''
      })
    }
  }, [isOpen, etablissementId, defaultCategoryId])

  const handleSubmit = async () => {
    if (!formData.titre || !formData.categorie_id || !formData.etablissement_id) return

    await createTache.mutateAsync({
      titre: formData.titre,
      description: formData.description || undefined,
      etablissement_id: formData.etablissement_id,
      categorie_id: formData.categorie_id,
      priorite: formData.priorite,
      date_debut: formData.date_debut?.toISOString(),
      echeance: formData.echeance?.toISOString(),
      responsable_id: formData.responsable_id || undefined,
      recurrence_rule: formData.recurrence_rule || undefined
    })

    onClose()
  }

  const recurrenceOptions = [
    { value: '', label: 'Aucune récurrence' },
    { value: 'FREQ=WEEKLY', label: 'Toutes les semaines' },
    { value: 'FREQ=MONTHLY', label: 'Tous les mois' },
    { value: 'FREQ=MONTHLY;INTERVAL=3', label: 'Tous les trimestres' },
    { value: 'FREQ=YEARLY', label: 'Tous les ans' }
  ]

  const priorityOptions = [
    { value: 'low', label: 'Basse', color: 'bg-green-500' },
    { value: 'medium', label: 'Moyenne', color: 'bg-yellow-500' },
    { value: 'high', label: 'Haute', color: 'bg-red-500' }
  ]

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Créer une nouvelle tâche</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-4 py-2">
            {/* Titre */}
            <div>
              <Label>Titre *</Label>
              <Input
                value={formData.titre}
                onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
                placeholder="Titre de la tâche"
              />
            </div>

            {/* Établissement */}
            <div>
              <Label className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Établissement *
              </Label>
              <Select
                value={formData.etablissement_id}
                onValueChange={(value) => setFormData({ ...formData, etablissement_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un établissement" />
                </SelectTrigger>
                <SelectContent>
                  <ScrollArea className="h-[200px]">
                    {etablissements?.map((etab) => (
                      <SelectItem key={etab.id} value={etab.id}>
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                          {etab.nom}
                        </div>
                      </SelectItem>
                    ))}
                  </ScrollArea>
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Description de la tâche"
                rows={3}
              />
            </div>

            {/* Catégorie */}
            <div>
              <Label>Catégorie *</Label>
              <Select
                value={formData.categorie_id}
                onValueChange={(value) => setFormData({ ...formData, categorie_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une catégorie" />
                </SelectTrigger>
                <SelectContent>
                  {categories?.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: cat.couleur }}
                        />
                        {cat.nom}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date de début</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.date_debut && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.date_debut 
                        ? format(formData.date_debut, 'PPP', { locale: fr })
                        : 'Sélectionner'
                      }
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.date_debut || undefined}
                      onSelect={(date) => setFormData({ ...formData, date_debut: date || null })}
                      locale={fr}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label>Échéance</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.echeance && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.echeance 
                        ? format(formData.echeance, 'PPP', { locale: fr })
                        : 'Sélectionner'
                      }
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.echeance || undefined}
                      onSelect={(date) => setFormData({ ...formData, echeance: date || null })}
                      locale={fr}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Priorité */}
            <div>
              <Label className="flex items-center gap-2">
                <Flag className="w-4 h-4" />
                Priorité
              </Label>
              <Select
                value={formData.priorite}
                onValueChange={(value: 'low' | 'medium' | 'high') => setFormData({ ...formData, priorite: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorityOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-2">
                        <div className={cn("w-3 h-3 rounded-full", opt.color)} />
                        {opt.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Responsable */}
            <div>
              <Label className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Responsable
              </Label>
              <Select
                value={formData.responsable_id || '__none__'}
                onValueChange={(value) => setFormData({ 
                  ...formData, 
                  responsable_id: value === '__none__' ? '' : value 
                })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un responsable" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    <span className="text-muted-foreground">Aucun responsable</span>
                  </SelectItem>
                  <ScrollArea className="h-[200px]">
                    {profiles?.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                            {profile.prenom?.[0]}{profile.nom?.[0]}
                          </div>
                          {profile.prenom} {profile.nom}
                          {profile.role && (
                            <span className="text-xs text-muted-foreground ml-1">
                              ({profile.role})
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </ScrollArea>
                </SelectContent>
              </Select>
            </div>

            {/* Récurrence */}
            <div>
              <Label className="flex items-center gap-2">
                <Repeat className="w-4 h-4" />
                Récurrence
              </Label>
              <Select
                value={formData.recurrence_rule || '__none__'}
                onValueChange={(value) => setFormData({ 
                  ...formData, 
                  recurrence_rule: value === '__none__' ? '' : value 
                })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Aucune récurrence" />
                </SelectTrigger>
                <SelectContent>
                  {recurrenceOptions.map((opt) => (
                    <SelectItem 
                      key={opt.value || '__none__'} 
                      value={opt.value || '__none__'}
                    >
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              !formData.titre || 
              !formData.categorie_id || 
              !formData.etablissement_id ||
              createTache.isPending
            }
          >
            {createTache.isPending ? 'Création...' : 'Créer la tâche'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
