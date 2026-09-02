import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { X, Download, ListPlus, Loader2 } from 'lucide-react'
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer'
import { useProfiles } from '@/hooks/profile/useProfiles'
import { useCategories } from '@/hooks/catalogue/useCategories'
import { useToast } from '@/hooks/shared/use-toast'
import { useQueryClient } from '@tanstack/react-query'
import { exportEtablissementsToCSV } from '@/lib/analyseGeoUtils'
import type { EtablissementForGeo } from '@/types/etablissement-geo'
import { bulkInsertTaches } from '@/services/etablissement/etablissementMutations';

interface BulkActionsBarGeoProps {
  selectedIds: string[]
  etablissements: EtablissementForGeo[]
  onClearSelection: () => void
}

export function BulkActionsBarGeo({
  selectedIds,
  etablissements,
  onClearSelection,
}: BulkActionsBarGeoProps) {
  const { data: profiles } = useProfiles()
  const { data: categories } = useCategories()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [showTaskDialog, setShowTaskDialog] = useState(false)
  const [taskData, setTaskData] = useState({
    titre: '',
    description: '',
    categorie_id: '',
    responsable_id: '',
    priorite: 'medium',
    echeance: ''
  })

  const selectedEtablissements = etablissements.filter((e) => selectedIds.includes(e.id))

  const handleExportSelection = () => {
    exportEtablissementsToCSV(selectedEtablissements, 'etablissements_selection')
    toast({ title: `${selectedEtablissements.length} établissement(s) exporté(s)` })
  }

  const handleCreateGroupedTask = async () => {
    if (!taskData.titre || !taskData.categorie_id) {
      toast({ title: 'Veuillez remplir les champs obligatoires', variant: 'destructive' })
      return
    }

    setLoading(true)
    try {
      const tasksToCreate = selectedIds.map(etablissementId => ({
        titre: taskData.titre,
        description: taskData.description || null,
        etablissement_id: etablissementId,
        categorie_id: taskData.categorie_id,
        responsable_id: taskData.responsable_id || null,
        priorite: taskData.priorite as 'high' | 'medium' | 'low',
        echeance: taskData.echeance || null,
        statut: 'A faire' as const
      }))

      await bulkInsertTaches(tasksToCreate)

      toast({ title: `${selectedIds.length} tâche(s) créée(s)` })
      queryClient.invalidateQueries({ queryKey: ['taches'] })
      setShowTaskDialog(false)
      setTaskData({
        titre: '',
        description: '',
        categorie_id: '',
        responsable_id: '',
        priorite: 'medium',
        echeance: ''
      })
      onClearSelection()
    } catch (error: unknown) {
      toast({ title: 'Erreur', description: sanitizeSupabaseError(error), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  if (selectedIds.length === 0) return null

  return (
    <>
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-background border rounded-lg shadow-lg p-3 flex items-center gap-3 animate-slide-in-bottom">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {selectedIds.length} sélectionné{selectedIds.length > 1 ? 's' : ''}
          </span>
          <Button variant="ghost" size="sm" onClick={onClearSelection} aria-label="Annuler la sélection" title="Annuler la sélection">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="h-6 w-px bg-border" />

        {/* Créer tâche groupée */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowTaskDialog(true)}
          disabled={loading}
        >
          <ListPlus className="h-4 w-4 mr-2" />
          Créer tâche groupée
        </Button>

        {/* Export */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportSelection}
          disabled={loading}
        >
          <Download className="h-4 w-4 mr-2" />
          Exporter
        </Button>

        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      </div>

      {/* Dialog création tâche groupée */}
      <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Créer une tâche pour {selectedIds.length} établissement(s)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Titre *</Label>
              <Input
                value={taskData.titre}
                onChange={(e) => setTaskData(prev => ({ ...prev, titre: e.target.value }))}
                placeholder="Titre de la tâche"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={taskData.description}
                onChange={(e) => setTaskData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Description optionnelle"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Catégorie *</Label>
                <Select
                  value={taskData.categorie_id}
                  onValueChange={(v) => setTaskData(prev => ({ ...prev, categorie_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.nom}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Responsable</Label>
                <Select
                  value={taskData.responsable_id}
                  onValueChange={(v) => setTaskData(prev => ({ ...prev, responsable_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner..." />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles?.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.prenom} {p.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priorité</Label>
                <Select
                  value={taskData.priorite}
                  onValueChange={(v) => setTaskData(prev => ({ ...prev, priorite: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">🟢 Basse</SelectItem>
                    <SelectItem value="medium">🟠 Moyenne</SelectItem>
                    <SelectItem value="high">🔴 Haute</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Échéance</Label>
                <Input
                  type="date"
                  value={taskData.echeance}
                  onChange={(e) => setTaskData(prev => ({ ...prev, echeance: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTaskDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreateGroupedTask} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Créer {selectedIds.length} tâche(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
