import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAddEmailSpecificMapping } from "@/hooks/email/useEmailSpecificMappings";
import { useEtablissements } from "@/hooks/crm/useEtablissements";
import { useGroupes } from "@/hooks/crm/useGroupes";
import { usePartenaires } from "@/hooks/crm/usePartenaires";
import { useProfilesWithRoles } from "@/hooks/profile/useProfilesWithRoles";
import { Mail, Building2, Users, Handshake, UserCircle } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface EmailSpecificMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultEmail?: string;
}

export function EmailSpecificMappingDialog({ 
  open, 
  onOpenChange,
  defaultEmail = ""
}: EmailSpecificMappingDialogProps) {
  const [email, setEmail] = useState("");
  const [niveauMapping, setNiveauMapping] = useState<'etablissement' | 'groupe' | 'partenaire' | 'equipe'>('etablissement');
  const [etablissementId, setEtablissementId] = useState<string>("");
  const [groupeId, setGroupeId] = useState<string>("");
  const [partenaireId, setPartenaireId] = useState<string>("");
  const [profileId, setProfileId] = useState<string>("");
  const [confidenceLevel, setConfidenceLevel] = useState<'high' | 'medium' | 'low'>('high');
  const [notes, setNotes] = useState("");

  // Pré-remplir l'email quand le dialog s'ouvre avec un email par défaut
  useEffect(() => {
    if (open && defaultEmail) {
      setEmail(defaultEmail);
    } else if (!open) {
      // Réinitialiser quand le dialog se ferme
      setEmail("");
      setNiveauMapping('etablissement');
      setEtablissementId("");
      setGroupeId("");
      setPartenaireId("");
      setProfileId("");
      setConfidenceLevel('high');
      setNotes("");
    }
  }, [open, defaultEmail]);

  const { data: etablissements, isLoading: loadingEtabs } = useEtablissements();
  const { data: groupes, isLoading: loadingGroupes } = useGroupes();
  const { data: partenaires, isLoading: loadingPartenaires } = usePartenaires();
  const { data: profiles, isLoading: loadingProfiles } = useProfilesWithRoles();
  const addMapping = useAddEmailSpecificMapping();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) return;
    
    if (niveauMapping === 'etablissement' && !etablissementId) {
      return;
    }
    
    if (niveauMapping === 'groupe' && !groupeId) {
      return;
    }

    if (niveauMapping === 'partenaire' && !partenaireId) {
      return;
    }

    if (niveauMapping === 'equipe' && !profileId) {
      return;
    }

    await addMapping.mutateAsync({
      email_address: email,
      etablissement_id: niveauMapping === 'etablissement' ? etablissementId : undefined,
      groupe_id: niveauMapping === 'groupe' ? groupeId : undefined,
      partenaire_id: niveauMapping === 'partenaire' ? partenaireId : undefined,
      profile_id: niveauMapping === 'equipe' ? profileId : undefined,
      niveau_mapping: niveauMapping,
      confidence_level: confidenceLevel,
      notes,
    });

    // Reset form
    setEmail("");
    setEtablissementId("");
    setGroupeId("");
    setPartenaireId("");
    setProfileId("");
    setNotes("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Affilier un email spécifique
          </DialogTitle>
          <DialogDescription>
            Associez un email unique à un établissement ou un groupe. Cette affiliation a la priorité sur les mappings de domaine.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Adresse email *</Label>
            <Input
              id="email"
              type="email"
              placeholder="contact@exemple.fr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!!defaultEmail}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Type d'affiliation *</Label>
            <RadioGroup value={niveauMapping} onValueChange={(value) => setNiveauMapping(value as 'etablissement' | 'groupe' | 'partenaire' | 'equipe')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="etablissement" id="type-etablissement" />
                <Label htmlFor="type-etablissement" className="flex items-center gap-2 cursor-pointer font-normal">
                  <Building2 className="h-4 w-4" />
                  Établissement
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="groupe" id="type-groupe" />
                <Label htmlFor="type-groupe" className="flex items-center gap-2 cursor-pointer font-normal">
                  <Users className="h-4 w-4" />
                  Groupe
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="partenaire" id="type-partenaire" />
                <Label htmlFor="type-partenaire" className="flex items-center gap-2 cursor-pointer font-normal">
                  <Handshake className="h-4 w-4" />
                  Partenaire
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="equipe" id="type-equipe" />
                <Label htmlFor="type-equipe" className="flex items-center gap-2 cursor-pointer font-normal">
                  <UserCircle className="h-4 w-4" />
                  Équipe
                </Label>
              </div>
            </RadioGroup>
          </div>

          {niveauMapping === 'etablissement' && (
            <div className="space-y-2">
              <Label htmlFor="etablissement">Établissement *</Label>
              <Select value={etablissementId} onValueChange={setEtablissementId} required>
                <SelectTrigger id="etablissement">
                  <SelectValue placeholder="Sélectionner un établissement" />
                </SelectTrigger>
                <SelectContent>
                  {loadingEtabs ? (
                    <SelectItem value="loading" disabled>Chargement...</SelectItem>
                  ) : (
                    etablissements?.map((etab) => (
                      <SelectItem key={etab.id} value={etab.id}>
                        {etab.nom} - {etab.ville}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {niveauMapping === 'groupe' && (
            <div className="space-y-2">
              <Label htmlFor="groupe">Groupe *</Label>
              <Select value={groupeId} onValueChange={setGroupeId} required>
                <SelectTrigger id="groupe">
                  <SelectValue placeholder="Sélectionner un groupe" />
                </SelectTrigger>
                <SelectContent>
                  {loadingGroupes ? (
                    <SelectItem value="loading" disabled>Chargement...</SelectItem>
                  ) : (
                    groupes?.map((groupe) => (
                      <SelectItem key={groupe.id} value={groupe.id}>
                        {groupe.nom}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {niveauMapping === 'partenaire' && (
            <div className="space-y-2">
              <Label htmlFor="partenaire">Partenaire *</Label>
              <Select value={partenaireId} onValueChange={setPartenaireId} required>
                <SelectTrigger id="partenaire">
                  <SelectValue placeholder="Sélectionner un partenaire" />
                </SelectTrigger>
                <SelectContent>
                  {loadingPartenaires ? (
                    <SelectItem value="loading" disabled>Chargement...</SelectItem>
                  ) : (
                    partenaires?.map((partenaire) => (
                      <SelectItem key={partenaire.id} value={partenaire.id}>
                        {partenaire.nom}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {niveauMapping === 'equipe' && (
            <div className="space-y-2">
              <Label htmlFor="profile">Membre de l'équipe *</Label>
              <Select value={profileId} onValueChange={setProfileId} required>
                <SelectTrigger id="profile">
                  <SelectValue placeholder="Sélectionner un membre" />
                </SelectTrigger>
                <SelectContent>
                  {loadingProfiles ? (
                    <SelectItem value="loading" disabled>Chargement...</SelectItem>
                  ) : (
                    profiles?.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.prenom} {profile.nom}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="confidence">Niveau de confiance</Label>
            <Select value={confidenceLevel} onValueChange={(value) => setConfidenceLevel(value as 'high' | 'medium' | 'low')}>
              <SelectTrigger id="confidence">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">Élevé</SelectItem>
                <SelectItem value="medium">Moyen</SelectItem>
                <SelectItem value="low">Faible</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optionnel)</Label>
            <Textarea
              id="notes"
              placeholder="Raison de cette affiliation..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={addMapping.isPending}>
              {addMapping.isPending ? "Création..." : "Créer l'affiliation"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
