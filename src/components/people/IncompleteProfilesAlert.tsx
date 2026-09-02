import { useState, useMemo } from "react";
import { debug } from "@/lib/debug";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, UserX, Loader2 } from "lucide-react";
import { usePeopleData } from "@/hooks/hr/usePeopleData";
import { useToast } from "@/hooks/shared/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { updateProfileContactInfo } from '@/services/profile/profileMutations';

interface IncompleteProfile {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  missingFields: string[];
  fonction: string | null | undefined;
  telephone: string | null | undefined;
}

export function IncompleteProfilesAlert() {
  const { profiles } = usePeopleData();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<IncompleteProfile | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [formData, setFormData] = useState({
    fonction: "",
    telephone: ""
  });

  // Identifier les profils incomplets
  const incompleteProfiles = useMemo(() => {
    if (!profiles) return [];

    return profiles
      .filter(p => p.actif)
      .map(profile => {
        const missingFields: string[] = [];
        
        if (!profile.fonction || profile.fonction.trim() === '') missingFields.push('Fonction');
        if (!profile.telephone || profile.telephone.trim() === '') missingFields.push('Téléphone');
        
        if (missingFields.length === 0) return null;

        return {
          id: profile.id,
          prenom: profile.prenom,
          nom: profile.nom,
          email: profile.email,
          fonction: profile.fonction,
          telephone: profile.telephone,
          missingFields
        } as IncompleteProfile;
      })
      .filter((p): p is IncompleteProfile => p !== null);
  }, [profiles]);

  const handleEditProfile = (profile: IncompleteProfile) => {
    setEditingProfile(profile);
    setFormData({
      fonction: profile.fonction || "",
      telephone: profile.telephone || ""
    });
  };

  const handleUpdateProfile = async () => {
    if (!editingProfile) return;

    setIsUpdating(true);
    try {
      await updateProfileContactInfo(editingProfile.id, {
        fonction: formData.fonction.trim() || null,
        telephone: formData.telephone.trim() || null,
      });

      toast({
        title: "Profil mis à jour",
        description: `Les informations de ${editingProfile.prenom} ${editingProfile.nom} ont été mises à jour.`,
      });

      // Rafraîchir les données
      await queryClient.invalidateQueries({ queryKey: ['people-data'] });
      await queryClient.invalidateQueries({ queryKey: ['profiles'] });
      
      setEditingProfile(null);
      setFormData({ fonction: "", telephone: "" });
    } catch (error) {
      debug.error('Error updating profile:', error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le profil.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  if (incompleteProfiles.length === 0) return null;

  return (
    <>
      <Alert className="border-orange-200 bg-orange-50">
        <UserX className="h-4 w-4 text-orange-600" />
        <AlertTitle className="text-orange-900">Profils incomplets détectés</AlertTitle>
        <AlertDescription className="text-orange-800">
          <div className="flex items-center justify-between">
            <span>
              {incompleteProfiles.length} employé{incompleteProfiles.length > 1 ? 's' : ''} avec des informations manquantes
            </span>
            <Button 
              size="sm" 
              variant="outline"
              className="ml-4 border-orange-300 hover:bg-orange-100"
              onClick={() => setIsOpen(true)}
            >
              Compléter les profils
            </Button>
          </div>
        </AlertDescription>
      </Alert>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Profils incomplets</DialogTitle>
            <DialogDescription>
              Complétez les informations manquantes pour ces employés
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {incompleteProfiles.map(profile => (
              <div 
                key={profile.id}
                className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium">
                      {profile.prenom} {profile.nom}
                    </h4>
                    <p className="text-sm text-muted-foreground">{profile.email}</p>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {profile.missingFields.map(field => (
                        <span 
                          key={field}
                          className="inline-flex items-center px-2 py-1 rounded-md bg-orange-100 text-orange-800 text-xs"
                        >
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          {field} manquant
                        </span>
                      ))}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEditProfile(profile)}
                  >
                    Compléter
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog d'édition d'un profil */}
      <Dialog open={!!editingProfile} onOpenChange={() => setEditingProfile(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Compléter le profil de {editingProfile?.prenom} {editingProfile?.nom}
            </DialogTitle>
            <DialogDescription>
              Renseignez les informations manquantes
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {editingProfile?.missingFields.includes('Fonction') && (
              <div className="space-y-2">
                <Label htmlFor="fonction">Fonction *</Label>
                <Select
                  value={formData.fonction}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, fonction: value }))}
                >
                  <SelectTrigger id="fonction">
                    <SelectValue placeholder="Sélectionner une fonction" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CEO">CEO</SelectItem>
                    <SelectItem value="Directeur Commercial">Directeur Commercial</SelectItem>
                    <SelectItem value="Directeur Technique">Directeur Technique</SelectItem>
                    <SelectItem value="Chef de Projet">Chef de Projet</SelectItem>
                    <SelectItem value="CSM">CSM</SelectItem>
                    <SelectItem value="Commercial">Commercial</SelectItem>
                    <SelectItem value="Développeur">Développeur</SelectItem>
                    <SelectItem value="Designer">Designer</SelectItem>
                    <SelectItem value="Autre">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {editingProfile?.missingFields.includes('Téléphone') && (
              <div className="space-y-2">
                <Label htmlFor="telephone">Téléphone *</Label>
                <Input
                  id="telephone"
                  type="tel"
                  placeholder="+33 6 12 34 56 78"
                  value={formData.telephone}
                  onChange={(e) => setFormData(prev => ({ ...prev, telephone: e.target.value }))}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingProfile(null)}
              disabled={isUpdating}
            >
              Annuler
            </Button>
            <Button
              onClick={handleUpdateProfile}
              disabled={isUpdating || 
                (editingProfile?.missingFields.includes('Fonction') && !formData.fonction) ||
                (editingProfile?.missingFields.includes('Téléphone') && !formData.telephone)
              }
            >
              {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
