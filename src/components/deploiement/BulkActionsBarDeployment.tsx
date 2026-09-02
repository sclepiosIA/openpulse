import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import {
  X,
  UserPlus,
  RefreshCw,
  Download,
  Loader2,
} from 'lucide-react'
import { useToast } from '@/hooks/shared/use-toast'
import { supabase } from '@/lib/supabaseBrowser'
import { useActiveProfiles } from '@/hooks/profile/useProfiles'
import { useQueryClient } from '@tanstack/react-query'
import { DEPLOYMENT_PHASES, exportToCSV } from '@/lib/deploymentUtils'
import type { Etablissement } from '@/hooks/crm/useEtablissements'

interface BulkActionsBarDeploymentProps {
  selectedIds: string[]
  etablissements: Etablissement[]
  onClearSelection: () => void
}

export function BulkActionsBarDeployment({
  selectedIds,
  etablissements,
  onClearSelection
}: BulkActionsBarDeploymentProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: profiles } = useActiveProfiles()
  
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [selectedCSM, setSelectedCSM] = useState<string>('')
  const [selectedCP, setSelectedCP] = useState<string>('')
  const [selectedStatus, setSelectedStatus] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

  const selectedEtablissements = etablissements.filter(e => selectedIds.includes(e.id))

  const handleAssign = async () => {
    if (!selectedCSM && !selectedCP) {
      toast({
        title: "Erreur",
        description: "Sélectionnez au moins un CSM ou un Chef de projet",
        variant: "destructive"
      })
      return
    }

    setIsLoading(true)
    try {
      const updates: Partial<Etablissement> = {}
      if (selectedCSM) updates.csm_id = selectedCSM
      if (selectedCP) updates.chef_projet_id = selectedCP

      const { error } = await supabase
        .from('etablissements')
        .update(updates as never)
        .in('id', selectedIds)

      if (error) throw error

      toast({
        title: "Succès",
        description: `${selectedIds.length} établissement(s) mis à jour`
      })
      queryClient.invalidateQueries({ queryKey: ['etablissements'] })
      queryClient.invalidateQueries({ queryKey: ['deploiement'] })
      setAssignDialogOpen(false)
      onClearSelection()
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'assigner l'équipe",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
      setSelectedCSM('')
      setSelectedCP('')
    }
  }

  const handleStatusChange = async () => {
    if (!selectedStatus) {
      toast({
        title: "Erreur",
        description: "Sélectionnez un statut",
        variant: "destructive"
      })
      return
    }

    setIsLoading(true)
    try {
      const { error } = await supabase
        .from('etablissements')
        .update({ statut: selectedStatus as any })
        .in('id', selectedIds)

      if (error) throw error

      toast({
        title: "Succès",
        description: `Statut mis à jour pour ${selectedIds.length} établissement(s)`
      })
      queryClient.invalidateQueries({ queryKey: ['etablissements'] })
      queryClient.invalidateQueries({ queryKey: ['deploiement'] })
      setStatusDialogOpen(false)
      onClearSelection()
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de changer le statut",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
      setSelectedStatus('')
    }
  }

  const handleExport = () => {
    const columns = [
      { key: 'nom' as const, label: 'Nom' },
      { key: 'type' as const, label: 'Type' },
      { key: 'region' as const, label: 'Région' },
      { key: 'statut' as const, label: 'Statut' },
      { key: 'progression' as const, label: 'Progression (%)' },
      { key: 'date_signature' as const, label: 'Date signature' },
    ]

    const exportData = selectedEtablissements.map(e => ({
      nom: e.nom,
      type: e.type,
      region: e.region,
      statut: e.statut,
      progression: e.progression || 0,
      date_signature: e.date_signature 
        ? new Date(e.date_signature).toLocaleDateString('fr-FR') 
        : '',
    }))

    exportToCSV(exportData, columns, 'deploiement_selection')
    
    toast({
      title: "Export réussi",
      description: `${selectedIds.length} établissement(s) exporté(s)`
    })
  }

  if (selectedIds.length === 0) return null

  return (
    <>
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
        <div className="bg-background border rounded-lg shadow-lg p-3 flex items-center gap-3">
          <Badge variant="secondary" className="font-semibold">
            {selectedIds.length} sélectionné(s)
          </Badge>

          <div className="h-6 w-px bg-border" />

          <Button variant="outline" size="sm" onClick={() => setAssignDialogOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Assigner</span>
          </Button>

          <Button variant="outline" size="sm" onClick={() => setStatusDialogOpen(true)}>
            <RefreshCw className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Statut</span>
          </Button>

          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Exporter</span>
          </Button>

          <div className="h-6 w-px bg-border" />

          <Button variant="ghost" size="icon" onClick={onClearSelection} aria-label="Fermer">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Dialog Assigner */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assigner l'équipe</DialogTitle>
            <DialogDescription>
              Assigner un CSM et/ou Chef de projet à {selectedIds.length} établissement(s)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>CSM</Label>
              <Select value={selectedCSM} onValueChange={setSelectedCSM}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un CSM" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
{profiles?.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.prenom} {profile.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Chef de projet</Label>
              <Select value={selectedCP} onValueChange={setSelectedCP}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un CP" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {profiles?.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.prenom} {profile.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleAssign} disabled={isLoading}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Assigner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Statut */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Changer le statut</DialogTitle>
            <DialogDescription>
              Modifier le statut de {selectedIds.length} établissement(s)
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Label>Nouveau statut</Label>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Sélectionner un statut" />
              </SelectTrigger>
              <SelectContent>
                {DEPLOYMENT_PHASES.map(phase => (
                  <SelectItem key={phase} value={phase}>
                    {phase}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleStatusChange} disabled={isLoading}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Appliquer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
