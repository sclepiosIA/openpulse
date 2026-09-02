import { useState } from "react";
import { debug } from "@/lib/debug";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Users, Briefcase, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/shared/use-toast";
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import { useCreateEntityMutations } from "@/hooks/search/useCreateEntityMutations";
import { LogoUploadField } from "@/components/ui/LogoUploadField";

interface CreateEntityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "etablissement" | "partenaire" | "groupe";
  onCreated: (id: string, name: string) => void;
}

export function CreateEntityDialog({
  open,
  onOpenChange,
  type,
  onCreated,
}: CreateEntityDialogProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    nom: "",
    ville: "",
    type: "",
    logo_url: null as string | null,
  });
  const { createEntity, isCreating } = useCreateEntityMutations();

  const handleCreate = async () => {
    if (!formData.nom.trim()) {
      toast({
        title: "Erreur",
        description: "Le nom est obligatoire",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await createEntity(type, {
        nom: formData.nom,
        ville: formData.ville,
        type: formData.type,
        logo_url: formData.logo_url,
      });

      onCreated(result.id, result.nom);
      toast({
        title: "Succès",
        description: `${type === "etablissement" ? "Établissement" : type === "partenaire" ? "Partenaire" : "Groupe"} créé avec succès`,
      });
      onOpenChange(false);
      setFormData({ nom: "", ville: "", type: "", logo_url: null });
    } catch (error: unknown) {
      debug.error("Error creating entity:", error);
      toast({
        title: "Erreur",
        description: sanitizeSupabaseError(error),
        variant: "destructive",
      });
    }
  };

  const getIcon = () => {
    switch (type) {
      case "etablissement":
        return <Building2 className="h-5 w-5" />;
      case "partenaire":
        return <Briefcase className="h-5 w-5" />;
      case "groupe":
        return <Users className="h-5 w-5" />;
    }
  };

  const getTitle = () => {
    switch (type) {
      case "etablissement":
        return "Créer un établissement";
      case "partenaire":
        return "Créer un partenaire";
      case "groupe":
        return "Créer un groupe";
    }
  };

  const getTypeOptions = () => {
    if (type === "etablissement") {
      return ["CH", "CHU", "GHT", "ESPIC", "Privé"];
    } else if (type === "partenaire") {
      return ["Éditeur de logiciels", "Fournisseur", "Consultant", "Autre"];
    } else {
      return ["Groupe hospitalier", "Réseau de santé", "Groupement territorial"];
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getIcon()}
            {getTitle()}
          </DialogTitle>
          <DialogDescription>
            Créer rapidement une nouvelle entité pour classifier cet email
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Logo (optionnel)</Label>
            <LogoUploadField
              currentLogoUrl={formData.logo_url}
              entityType={type}
              onLogoUploaded={(url) => setFormData({ ...formData, logo_url: url })}
              size="sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nom">Nom *</Label>
            <Input
              id="nom"
              placeholder="Nom"
              value={formData.nom}
              onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
            />
          </div>

          {type !== "groupe" && (
            <div className="space-y-2">
              <Label htmlFor="ville">Ville</Label>
              <Input
                id="ville"
                placeholder="Ville"
                value={formData.ville}
                onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="type">
              {type === "etablissement" ? "Type d'établissement" : type === "partenaire" ? "Type de partenaire" : "Type de groupe"}
            </Label>
            <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner..." />
              </SelectTrigger>
              <SelectContent>
                {getTypeOptions().map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>
            Annuler
          </Button>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
