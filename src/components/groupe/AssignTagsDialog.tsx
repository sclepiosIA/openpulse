import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { X, Plus } from "lucide-react"
import { useToast } from "@/hooks/shared/use-toast"
import { Groupe } from "@/hooks/crm/useGroupes"

interface AssignTagsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedGroupes: Groupe[]
  onAssignTags: (tags: string[]) => void
}

const PREDEFINED_TAGS = [
  "Prioritaire",
  "En retard",
  "À surveiller",
  "Nouveau client",
  "Renouvellement",
  "Expansion",
  "Migration",
  "Formation requise"
]

export function AssignTagsDialog({ 
  open, 
  onOpenChange, 
  selectedGroupes,
  onAssignTags 
}: AssignTagsDialogProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [customTag, setCustomTag] = useState("")
  const { toast } = useToast()

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    )
  }

  const addCustomTag = () => {
    const trimmedTag = customTag.trim()
    if (trimmedTag && !selectedTags.includes(trimmedTag)) {
      setSelectedTags(prev => [...prev, trimmedTag])
      setCustomTag("")
    }
  }

  const removeTag = (tag: string) => {
    setSelectedTags(prev => prev.filter(t => t !== tag))
  }

  const handleAssign = () => {
    if (selectedTags.length === 0) {
      toast({
        title: "Aucun tag sélectionné",
        description: "Veuillez sélectionner au moins un tag",
        variant: "destructive"
      })
      return
    }

    onAssignTags(selectedTags)
    setSelectedTags([])
    setCustomTag("")
    onOpenChange(false)
    
    toast({
      title: "Tags assignés",
      description: `${selectedTags.length} tag(s) assigné(s) à ${selectedGroupes.length} groupe(s)`
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            Assigner des tags à {selectedGroupes.length} groupe{selectedGroupes.length > 1 ? 's' : ''}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Tags prédéfinis */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Tags prédéfinis</h4>
            <div className="flex flex-wrap gap-2">
              {PREDEFINED_TAGS.map(tag => (
                <Badge
                  key={tag}
                  variant={selectedTags.includes(tag) ? "default" : "outline"}
                  className="cursor-pointer transition-colors"
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>

          {/* Tag personnalisé */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Ajouter un tag personnalisé</h4>
            <div className="flex gap-2">
              <Input
                placeholder="Nom du tag..."
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addCustomTag()
                  }
                }}
              />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={addCustomTag}
                disabled={!customTag.trim()} aria-label="Ajouter">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Tags sélectionnés */}
          {selectedTags.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Tags sélectionnés ({selectedTags.length})</h4>
              <div className="flex flex-wrap gap-2">
                {selectedTags.map(tag => (
                  <Badge key={tag} variant="default" className="gap-1">
                    {tag}
                    <X
                      className="h-3 w-3 cursor-pointer hover:text-destructive"
                      onClick={() => removeTag(tag)}
                    />
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Aperçu des groupes */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Groupes concernés</h4>
            <div className="text-sm text-muted-foreground">
              {selectedGroupes.slice(0, 3).map(g => g.nom).join(', ')}
              {selectedGroupes.length > 3 && ` et ${selectedGroupes.length - 3} autre(s)`}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleAssign} disabled={selectedTags.length === 0}>
            Assigner les tags
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
