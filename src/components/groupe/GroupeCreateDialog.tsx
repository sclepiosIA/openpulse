import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { debug } from "@/lib/debug";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateGroupe } from "@/hooks/crm/useGroupes";
import { useActiveProfilesWithRoles } from "@/hooks/profile/useProfilesWithRoles";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogoUploadField } from "@/components/ui/LogoUploadField";

interface GroupeCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GroupeCreateDialog({ open, onOpenChange }: GroupeCreateDialogProps) {
  const navigate = useNavigate();
  const createGroupe = useCreateGroupe();
  const { data: profiles } = useActiveProfilesWithRoles();
  
  const [formData, setFormData] = useState({
    nom: "",
    type: "GHT" as const,
    description: "",
    ville_siege: "",
    region: "",
    adresse_siege: "",
    code_postal_siege: "",
    telephone: "",
    email: "",
    responsable_commercial_id: undefined as string | undefined,
    responsable_csm_id: undefined as string | undefined,
    notes: "",
    logo_url: null as string | null,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const result = await createGroupe.mutateAsync({
        ...formData,
        logo_url: formData.logo_url || undefined,
      });
      onOpenChange(false);
      navigate(`/groupes/${result.id}`);
    } catch (error) {
      debug.error("Erreur création groupe:", error);
    }
  };

  const commerciaux = profiles?.filter(p => p.role === 'commercial') || [];
  const csms = profiles?.filter(p => p.role === 'csm') || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Créer un nouveau groupe</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Logo upload */}
          <div>
            <Label>Logo (optionnel)</Label>
            <LogoUploadField
              currentLogoUrl={formData.logo_url}
              entityType="groupe"
              onLogoUploaded={(url) => setFormData({...formData, logo_url: url})}
              size="md"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="nom">Nom du groupe *</Label>
              <Input
                id="nom"
                required
                value={formData.nom}
                onChange={(e) => setFormData({...formData, nom: e.target.value})}
              />
            </div>
            
            <div>
              <Label htmlFor="type">Type *</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({...formData, type: value as any})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GHT">GHT</SelectItem>
                  <SelectItem value="Groupe Cliniques">Groupe Cliniques</SelectItem>
                  <SelectItem value="Consortium">Consortium</SelectItem>
                  <SelectItem value="Autre">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
            />
          </div>
          
          <div className="space-y-2">
            <h3 className="font-medium">Siège social</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="ville_siege">Ville</Label>
                <Input
                  id="ville_siege"
                  value={formData.ville_siege}
                  onChange={(e) => setFormData({...formData, ville_siege: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="region">Région</Label>
                <Input
                  id="region"
                  value={formData.region}
                  onChange={(e) => setFormData({...formData, region: e.target.value})}
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="adresse_siege">Adresse</Label>
                <Input
                  id="adresse_siege"
                  value={formData.adresse_siege}
                  onChange={(e) => setFormData({...formData, adresse_siege: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="code_postal_siege">Code postal</Label>
                <Input
                  id="code_postal_siege"
                  value={formData.code_postal_siege}
                  onChange={(e) => setFormData({...formData, code_postal_siege: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="telephone">Téléphone</Label>
                <Input
                  id="telephone"
                  value={formData.telephone}
                  onChange={(e) => setFormData({...formData, telephone: e.target.value})}
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                />
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Responsable Commercial</Label>
              <Select
                value={formData.responsable_commercial_id}
                onValueChange={(value) => setFormData({...formData, responsable_commercial_id: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  {commerciaux.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.prenom} {p.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Responsable CSM</Label>
              <Select
                value={formData.responsable_csm_id}
                onValueChange={(value) => setFormData({...formData, responsable_csm_id: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  {csms.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.prenom} {p.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
            />
          </div>
          
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={createGroupe.isPending}>
              {createGroupe.isPending ? "Création..." : "Créer le groupe"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
