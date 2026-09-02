import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateSupportTicket } from "@/hooks/support/useSupportTickets";
import { useEtablissements } from "@/hooks/crm/useEtablissements";
import { CsrfToken } from "@/components/security/CsrfToken";

const MAX_TITRE_LENGTH = 255;

interface CreateTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultEtablissementId?: string;
}

export function CreateTicketDialog({ 
  open, 
  onOpenChange,
  defaultEtablissementId 
}: CreateTicketDialogProps) {
  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [typeProbleme, setTypeProbleme] = useState("autre");
  const [priorite, setPriorite] = useState("moyenne");
  const [etablissementId, setEtablissementId] = useState(defaultEtablissementId || "__none__");
  const [contactNom, setContactNom] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  const createTicket = useCreateSupportTicket();
  const { data: etablissements } = useEtablissements();

  const [showTitreError, setShowTitreError] = useState(false);
  const [showEmailError, setShowEmailError] = useState(false);

  const emailIsValid = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  const hasInvalidEmail = contactEmail.trim().length > 0 && !emailIsValid(contactEmail);

  const titreTooLong = titre.trim().length > MAX_TITRE_LENGTH;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!titre.trim()) {
      setShowTitreError(true);
      toast.error("Le titre du ticket est requis.");
      return;
    }

    if (titreTooLong) {
      setShowTitreError(true);
      toast.error(`Le titre ne peut dépasser ${MAX_TITRE_LENGTH} caractères.`);
      return;
    }

    if (hasInvalidEmail) {
      setShowEmailError(true);
      toast.error("L'email du contact n'est pas valide.");
      return;
    }

    createTicket.mutate({
      titre,
      description: description || undefined,
      type_probleme: typeProbleme,
      priorite,
      etablissement_id: (etablissementId && etablissementId !== '__none__') ? etablissementId : undefined,
      contact_nom: contactNom || undefined,
      contact_email: contactEmail || undefined,
    }, {
      onSuccess: () => {
        onOpenChange(false);
        // Reset form
        setTitre("");
        setDescription("");
        setTypeProbleme("autre");
        setPriorite("moyenne");
        setEtablissementId(defaultEtablissementId || "");
        setContactNom("");
        setContactEmail("");
        setShowTitreError(false);
        setShowEmailError(false);
      }
    });
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouveau ticket support</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <CsrfToken />
          <div>
            <Label htmlFor="titre">Titre *</Label>
            <Input
              id="titre"
              value={titre}
              onChange={(e) => {
                setTitre(e.target.value.slice(0, MAX_TITRE_LENGTH));
                if (e.target.value.trim()) setShowTitreError(false);
              }}
              placeholder="Résumé du problème"
              maxLength={MAX_TITRE_LENGTH}
              aria-invalid={showTitreError || titreTooLong}
              aria-describedby={showTitreError || titreTooLong ? "titre-error" : "titre-count"}
            />
            {(showTitreError || titreTooLong) ? (
              <p id="titre-error" className="mt-1 text-sm text-destructive">
                {titreTooLong
                  ? `Le titre ne peut dépasser ${MAX_TITRE_LENGTH} caractères.`
                  : 'Le titre est requis pour créer un ticket.'}
              </p>
            ) : (
              <p id="titre-count" className="mt-1 text-xs text-muted-foreground">
                {titre.length}/{MAX_TITRE_LENGTH} caractères
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Détails du problème..."
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="type">Type de problème</Label>
              <Select value={typeProbleme} onValueChange={setTypeProbleme}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bug">Bug</SelectItem>
                  <SelectItem value="question">Question</SelectItem>
                  <SelectItem value="demande_fonctionnalite">Demande fonctionnalité</SelectItem>
                  <SelectItem value="performance">Performance</SelectItem>
                  <SelectItem value="connexion">Connexion</SelectItem>
                  <SelectItem value="formation">Formation</SelectItem>
                  <SelectItem value="facturation">Facturation</SelectItem>
                  <SelectItem value="autre">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="priorite">Priorité</Label>
              <Select value={priorite} onValueChange={setPriorite}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basse">Basse</SelectItem>
                  <SelectItem value="moyenne">Moyenne</SelectItem>
                  <SelectItem value="haute">Haute</SelectItem>
                  <SelectItem value="critique">Critique</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="etablissement">Établissement</Label>
            <Select value={etablissementId} onValueChange={setEtablissementId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un établissement" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Aucun</SelectItem>
                {etablissements?.map(etab => (
                  <SelectItem key={etab.id} value={etab.id}>
                    {etab.nom} - {etab.ville}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="contactNom">Nom du contact</Label>
              <Input
                id="contactNom"
                value={contactNom}
                onChange={(e) => setContactNom(e.target.value)}
                placeholder="Nom"
              />
            </div>
            <div>
              <Label htmlFor="contactEmail">Email du contact</Label>
              <Input
                id="contactEmail"
                type="email"
                value={contactEmail}
                onChange={(e) => {
                  setContactEmail(e.target.value);
                  if (showEmailError && emailIsValid(e.target.value)) setShowEmailError(false);
                }}
                onBlur={() => {
                  if (contactEmail.trim().length > 0 && !emailIsValid(contactEmail)) {
                    setShowEmailError(true);
                  }
                }}
                placeholder="email@exemple.com"
                aria-invalid={showEmailError || hasInvalidEmail}
                aria-describedby={showEmailError || hasInvalidEmail ? 'contactEmail-error' : undefined}
              />
              {(showEmailError || hasInvalidEmail) && (
                <p id="contactEmail-error" className="mt-1 text-sm text-destructive">
                  Format d'email invalide (exemple : nom@domaine.fr).
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={createTicket.isPending || hasInvalidEmail}>
              {createTicket.isPending ? "Création..." : "Créer le ticket"}
            </Button>
          </div>

        </form>
      </DialogContent>
    </Dialog>
  );
}
