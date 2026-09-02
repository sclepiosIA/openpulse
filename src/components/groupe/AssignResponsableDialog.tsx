import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useProfilesWithRoles } from "@/hooks/profile/useProfilesWithRoles"
import { Groupe } from "@/hooks/crm/useGroupes"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useToast } from "@/hooks/shared/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface AssignResponsableDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedGroupes: Groupe[]
  onAssign: (commercialId?: string, csmId?: string) => void
}

export function AssignResponsableDialog({ 
  open, 
  onOpenChange, 
  selectedGroupes,
  onAssign 
}: AssignResponsableDialogProps) {
  const [commercialId, setCommercialId] = useState<string>("")
  const [csmId, setCsmId] = useState<string>("")
  const { data: profiles } = useProfilesWithRoles()
  const { toast } = useToast()

  const commercials = profiles?.filter(p => 
    p.role === 'commercial' || p.role === 'admin'
  ) || []
  
  const csms = profiles?.filter(p => 
    p.role === 'csm' || p.role === 'admin'
  ) || []

  const handleAssign = () => {
    if (!commercialId && !csmId) {
      toast({
        title: "Aucun responsable sélectionné",
        description: "Veuillez sélectionner au moins un responsable",
        variant: "destructive"
      })
      return
    }

    onAssign(commercialId || undefined, csmId || undefined)
    setCommercialId("")
    setCsmId("")
    onOpenChange(false)
    
    toast({
      title: "Responsables assignés",
      description: `Responsables assignés à ${selectedGroupes.length} groupe(s)`
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            Assigner des responsables à {selectedGroupes.length} groupe{selectedGroupes.length > 1 ? 's' : ''}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Commercial */}
          <div className="space-y-2">
            <Label htmlFor="commercial">Commercial</Label>
            <Select value={commercialId} onValueChange={setCommercialId}>
              <SelectTrigger id="commercial">
                <SelectValue placeholder="Sélectionner un commercial" />
              </SelectTrigger>
              <SelectContent>
                {commercials.map(profile => (
                  <SelectItem key={profile.id} value={profile.id}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs">
                          {profile.nom?.[0]?.toUpperCase()}{profile.prenom?.[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span>{profile.prenom} {profile.nom}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* CSM */}
          <div className="space-y-2">
            <Label htmlFor="csm">Customer Success Manager</Label>
            <Select value={csmId} onValueChange={setCsmId}>
              <SelectTrigger id="csm">
                <SelectValue placeholder="Sélectionner un CSM" />
              </SelectTrigger>
              <SelectContent>
                {csms.map(profile => (
                  <SelectItem key={profile.id} value={profile.id}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs">
                          {profile.nom?.[0]?.toUpperCase()}{profile.prenom?.[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span>{profile.prenom} {profile.nom}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Aperçu des groupes */}
          <div className="space-y-2 pt-4 border-t">
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
          <Button onClick={handleAssign} disabled={!commercialId && !csmId}>
            Assigner
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
