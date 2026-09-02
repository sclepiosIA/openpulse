import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { X, Users, Download, Loader2, ClipboardList } from 'lucide-react'
import { toast } from 'sonner'
import { useActiveProfiles, type ProfilePublic } from '@/hooks/profile/useProfiles'
import type { Etablissement } from '@/hooks/crm/useEtablissements'
import type { CustomerHealthScore } from '@/hooks/crm/useCustomerHealth'
import { exportProductionToCSV } from '@/lib/productionUtils'
import { assignCsmToEtablissements } from '@/services/etablissement/etablissementMutations';

interface BulkActionsBarProductionProps {
  selectedIds: string[]
  etablissements: Etablissement[]
  healthScores: Map<string, CustomerHealthScore>
  healthMetrics: Map<string, any>
  onClearSelection: () => void
  onRefresh: () => void
}

export function BulkActionsBarProduction({
  selectedIds,
  etablissements,
  healthScores,
  healthMetrics,
  onClearSelection,
  onRefresh
}: BulkActionsBarProductionProps) {
  const { data: profiles } = useActiveProfiles()
  const [isUpdating, setIsUpdating] = useState(false)
  const [selectedCsm, setSelectedCsm] = useState<string>('')

  const selectedItems = etablissements.filter(e => selectedIds.includes(e.id))

  const handleAssignCsm = async () => {
    if (!selectedCsm) {
      toast.error('Veuillez sélectionner un CSM')
      return
    }

    setIsUpdating(true)
    try {
      await assignCsmToEtablissements(selectedIds, selectedCsm)

      toast.success(`CSM assigné à ${selectedIds.length} établissement(s)`)
      onClearSelection()
      onRefresh()
    } catch {
      toast.error("Erreur lors de l'assignation")
    } finally {
      setIsUpdating(false)
      setSelectedCsm('')
    }
  }

  const handleExportSelection = () => {
    const exportData = selectedItems.map(etablissement => ({
      etablissement,
      health: healthScores.get(etablissement.id),
      healthMetrics: healthMetrics.get(etablissement.id)
    }))

    exportProductionToCSV(exportData, 'production-selection')
    toast.success(`${selectedIds.length} établissement(s) exporté(s)`)
  }

  const handleCreateGroupTask = () => {
    // Navigate to task creation with pre-selected establishments
    const params = new URLSearchParams()
    params.set('etablissements', selectedIds.join(','))
    window.open(`/taches/nouvelle?${params.toString()}`, '_blank')
  }

  if (selectedIds.length === 0) return null

  return (
    <div className="sticky top-0 z-20 bg-primary text-primary-foreground p-4 rounded-lg shadow-lg flex flex-col sm:flex-row items-start sm:items-center gap-4">
      <div className="flex items-center gap-2">
        <span className="font-medium">
          {selectedIds.length} sélectionné{selectedIds.length > 1 ? 's' : ''}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 hover:bg-primary-foreground/20"
          onClick={onClearSelection} aria-label="Fermer">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 flex-1">
        {/* Assigner CSM */}
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          <Select value={selectedCsm} onValueChange={setSelectedCsm}>
            <SelectTrigger className="w-[180px] bg-primary-foreground/10 border-primary-foreground/20">
              <SelectValue placeholder="Assigner CSM..." />
            </SelectTrigger>
            <SelectContent>
              {profiles?.map((profile) => (
                <SelectItem key={profile.id} value={profile.id}>
                  {profile.prenom} {profile.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleAssignCsm}
            disabled={!selectedCsm || isUpdating}
          >
            {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Appliquer'}
          </Button>
        </div>

        {/* Créer tâche groupée */}
        <Button
          size="sm"
          variant="secondary"
          className="gap-2"
          onClick={handleCreateGroupTask}
        >
          <ClipboardList className="h-4 w-4" />
          <span className="hidden sm:inline">Créer tâche groupée</span>
        </Button>

        {/* Exporter sélection */}
        <Button
          size="sm"
          variant="secondary"
          className="gap-2"
          onClick={handleExportSelection}
        >
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">Exporter</span>
        </Button>
      </div>
    </div>
  )
}
