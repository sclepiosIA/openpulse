import { useState } from "react"
import { debug } from "@/lib/debug"
import { Button } from "@/components/ui/button"
import { X, Download, Trash2, UserPlus, Tags } from "lucide-react"
import { Groupe } from "@/hooks/crm/useGroupes"
import { AssignTagsDialog } from "./AssignTagsDialog"
import { AssignResponsableDialog } from "./AssignResponsableDialog"
import { useUpdateGroupe } from "@/hooks/crm/useGroupes"
import { useToast } from "@/hooks/shared/use-toast"

interface BulkActionsBarGroupesProps {
  selectedGroupes: string[]
  groupes: Groupe[]
  onClearSelection: () => void
  onExport: (groupeIds: string[]) => void
  onDelete: (groupeIds: string[]) => void
}

export function BulkActionsBarGroupes({
  selectedGroupes,
  groupes,
  onClearSelection,
  onExport,
  onDelete,
}: BulkActionsBarGroupesProps) {
  const [tagsDialogOpen, setTagsDialogOpen] = useState(false)
  const [responsableDialogOpen, setResponsableDialogOpen] = useState(false)
  const updateGroupe = useUpdateGroupe()
  const { toast } = useToast()

  if (selectedGroupes.length === 0) return null

  const selectedGroupesData = groupes.filter(g => selectedGroupes.includes(g.id))

  const handleAssignTags = async (tags: string[]) => {
    // Pour l'instant, on stocke les tags dans les notes du groupe
    // À terme, il faudrait une table dédiée pour les tags
    try {
      for (const groupeId of selectedGroupes) {
        const groupe = groupes.find(g => g.id === groupeId)
        if (groupe) {
          const currentNotes = groupe.notes || ""
          const tagsStr = tags.map(t => `#${t}`).join(' ')
          const newNotes = currentNotes ? `${currentNotes}\n\nTags: ${tagsStr}` : `Tags: ${tagsStr}`
          
          await updateGroupe.mutateAsync({
            id: groupeId,
            data: { notes: newNotes }
          })
        }
      }
    } catch (error) {
      debug.error('Error assigning tags:', error)
    }
  }

  const handleAssignResponsables = async (commercialId?: string, csmId?: string) => {
    try {
      for (const groupeId of selectedGroupes) {
        const updates: Partial<Groupe> = {}
        if (commercialId) updates.responsable_commercial_id = commercialId
        if (csmId) updates.responsable_csm_id = csmId
        
        await updateGroupe.mutateAsync({
          id: groupeId,
          data: updates
        })
      }
    } catch (error) {
      debug.error('Error assigning responsables:', error)
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de l'assignation",
        variant: "destructive"
      })
    }
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="bg-primary text-primary-foreground rounded-full shadow-lg px-6 py-3 flex items-center gap-4">
        <span className="font-semibold">
          {selectedGroupes.length} groupe{selectedGroupes.length > 1 ? 's' : ''} sélectionné{selectedGroupes.length > 1 ? 's' : ''}
        </span>
        
        <div className="h-6 w-px bg-primary-foreground/20" />
        
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onExport(selectedGroupes)}
            className="h-8"
          >
            <Download className="h-4 w-4 mr-2" />
            Exporter
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setResponsableDialogOpen(true)}
            className="h-8"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Assigner
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setTagsDialogOpen(true)}
            className="h-8"
          >
            <Tags className="h-4 w-4 mr-2" />
            Tags
          </Button>

          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              if (confirm(`Voulez-vous vraiment supprimer ${selectedGroupes.length} groupe(s) ?`)) {
                onDelete(selectedGroupes)
              }
            }}
            className="h-8"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Supprimer
          </Button>
        </div>

        <div className="h-6 w-px bg-primary-foreground/20" />

        <Button
          variant="ghost"
          size="icon"
          onClick={onClearSelection}
          className="h-8 w-8 hover:bg-primary-foreground/20" aria-label="Fermer">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <AssignTagsDialog
        open={tagsDialogOpen}
        onOpenChange={setTagsDialogOpen}
        selectedGroupes={selectedGroupesData}
        onAssignTags={handleAssignTags}
      />

      <AssignResponsableDialog
        open={responsableDialogOpen}
        onOpenChange={setResponsableDialogOpen}
        selectedGroupes={selectedGroupesData}
        onAssign={handleAssignResponsables}
      />
    </div>
  )
}
