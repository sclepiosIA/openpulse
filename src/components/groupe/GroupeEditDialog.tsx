import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUpdateGroupe } from "@/hooks/crm/useGroupes";
import { useProfilesWithRoles } from "@/hooks/profile/useProfilesWithRoles";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { Groupe } from "@/hooks/crm/useGroupes";
import { EntityLogoUpload } from "@/components/ui/EntityLogoUpload";

interface GroupeEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupe: Groupe;
}

interface GroupeFormData {
  nom: string;
  type: 'GHT' | 'Groupe Cliniques' | 'Consortium' | 'Autre';
  description?: string;
  adresse_siege?: string;
  code_postal_siege?: string;
  ville_siege?: string;
  region?: string;
  telephone?: string;
  email?: string;
  responsable_commercial_id?: string;
  responsable_csm_id?: string;
  notes?: string;
  logo_url?: string | null;
}

export function GroupeEditDialog({ open, onOpenChange, groupe }: GroupeEditDialogProps) {
  const { data: profiles } = useProfilesWithRoles();
  const updateGroupe = useUpdateGroupe();
  const [logoUrl, setLogoUrl] = useState<string | null>(groupe.logo_url || null);

  const { register, handleSubmit, setValue, watch, reset } = useForm<GroupeFormData>({
    defaultValues: {
      nom: groupe.nom,
      type: groupe.type,
      description: groupe.description || "",
      adresse_siege: groupe.adresse_siege || "",
      code_postal_siege: groupe.code_postal_siege || "",
      ville_siege: groupe.ville_siege || "",
      region: groupe.region || "",
      telephone: groupe.telephone || "",
      email: groupe.email || "",
      responsable_commercial_id: groupe.responsable_commercial_id || "none",
      responsable_csm_id: groupe.responsable_csm_id || "none",
      notes: groupe.notes || "",
      logo_url: groupe.logo_url || null,
    },
  });

  // Réinitialiser le formulaire quand le groupe change ou que le dialogue s'ouvre
  useEffect(() => {
    if (open) {
      reset({
        nom: groupe.nom,
        type: groupe.type,
        description: groupe.description || "",
        adresse_siege: groupe.adresse_siege || "",
        code_postal_siege: groupe.code_postal_siege || "",
        ville_siege: groupe.ville_siege || "",
        region: groupe.region || "",
        telephone: groupe.telephone || "",
        email: groupe.email || "",
        responsable_commercial_id: groupe.responsable_commercial_id || "none",
        responsable_csm_id: groupe.responsable_csm_id || "none",
        notes: groupe.notes || "",
      });
    }
  }, [groupe.id, open, reset]);

  const onSubmit = async (data: GroupeFormData) => {
    try {
      await updateGroupe.mutateAsync({
        id: groupe.id,
        data: {
          ...data,
          responsable_commercial_id: data.responsable_commercial_id === "none" ? undefined : data.responsable_commercial_id,
          responsable_csm_id: data.responsable_csm_id === "none" ? undefined : data.responsable_csm_id,
        },
      });
      toast.success("Groupe modifié avec succès");
      onOpenChange(false);
    } catch (error) {
      toast.error("Erreur lors de la modification du groupe");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier le groupe</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Logo upload */}
          <div className="flex items-center gap-4 pb-4 border-b">
            <EntityLogoUpload
              entityType="groupe"
              entityId={groupe.id}
              entityName={groupe.nom}
              currentLogoUrl={logoUrl}
              onLogoChange={setLogoUrl}
              size="lg"
            />
            <div>
              <p className="text-sm font-medium">Logo du groupe</p>
              <p className="text-xs text-muted-foreground">Cliquez pour modifier ou supprimer</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nom">Nom du groupe *</Label>
              <Input id="nom" {...register("nom", { required: true })} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Type *</Label>
              <Select
                value={watch("type")}
                onValueChange={(value) => setValue("type", value as 'GHT' | 'Groupe Cliniques' | 'Consortium' | 'Autre')}
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Groupe Cliniques">Groupe Cliniques</SelectItem>
                  <SelectItem value="Consortium">Consortium</SelectItem>
                  <SelectItem value="GHT">GHT</SelectItem>
                  <SelectItem value="Autre">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" {...register("description")} rows={3} />
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-medium">Siège social</h3>
            <div className="space-y-2">
              <Label htmlFor="adresse_siege">Adresse</Label>
              <Input id="adresse_siege" {...register("adresse_siege")} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code_postal_siege">Code postal</Label>
                <Input id="code_postal_siege" {...register("code_postal_siege")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ville_siege">Ville</Label>
                <Input id="ville_siege" {...register("ville_siege")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="region">Région</Label>
                <Input id="region" {...register("region")} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="telephone">Téléphone</Label>
              <Input id="telephone" {...register("telephone")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register("email")} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="responsable_commercial_id">Responsable commercial</Label>
              <Select
                value={watch("responsable_commercial_id")}
                onValueChange={(value) => setValue("responsable_commercial_id", value)}
              >
                <SelectTrigger id="responsable_commercial_id">
                  <SelectValue placeholder="Sélectionner..." />
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
              <Label htmlFor="responsable_csm_id">Responsable CSM</Label>
              <Select
                value={watch("responsable_csm_id")}
                onValueChange={(value) => setValue("responsable_csm_id", value)}
              >
                <SelectTrigger id="responsable_csm_id">
                  <SelectValue placeholder="Sélectionner..." />
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

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" {...register("notes")} rows={4} />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={updateGroupe.isPending}>
              {updateGroupe.isPending ? "Modification..." : "Modifier"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
