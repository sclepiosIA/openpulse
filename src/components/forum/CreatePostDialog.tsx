import { useState, useEffect } from "react";
import { debug } from "@/lib/debug";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Loader2 } from "lucide-react";
import { useCreateForumPost } from "@/hooks/forum/useForumPosts";
import { RichTextEditor } from "@/components/email/LazyRichTextEditor";
import { toast } from "sonner";
import { useIsTeamMember, useTeamMemberProfile } from "@/hooks/hr/useTeamMember";
import { fetchForumEtablissementsForPost } from "@/services/forum/forumPublic";
const themes = ['pmsi', 'smr', 'urgences', 'completion_dossier', 'dictee_vocale', 'astuces', 'bugs', 'support', 'autre'] as const;

const themeLabels: Record<typeof themes[number], string> = {
  pmsi: "PMSI & Codage",
  smr: "SSR & SMR",
  urgences: "Urgences",
  completion_dossier: "Complétion dossier",
  dictee_vocale: "Dictée vocale",
  astuces: "Astuces & Tips",
  bugs: "Bugs & Problèmes",
  support: "Support & Aide",
  autre: "Autre"
};

const fonctions = [
  "Médecin",
  "Infirmier(ère)",
  "Aide-soignant(e)",
  "Cadre de santé",
  "Directeur/Directrice",
  "Attaché(e) d'administration",
  "DIM/Département d'information médicale",
  "Contrôleur de gestion",
  "Informaticien(ne)",
  "Secrétaire médicale",
  "Pharmacien(ne)",
  "Manipulateur radio",
  "Technicien(ne) de laboratoire",
  "Autre"
];

const services = [
  "Direction",
  "Urgences",
  "Médecine",
  "Chirurgie",
  "Réanimation",
  "Pédiatrie",
  "Maternité",
  "Gériatrie",
  "Psychiatrie",
  "SSR/SMR",
  "USLD",
  "DIM",
  "Finances",
  "Informatique",
  "Qualité",
  "Ressources humaines",
  "Autre"
];

export function CreatePostDialog() {
  const [open, setOpen] = useState(false);
  const [titre, setTitre] = useState("");
  const [contenu, setContenu] = useState("");
  const [theme, setTheme] = useState<string>("");
  const [visibility, setVisibility] = useState<'global' | 'etablissement'>('global');
  
  // Informations auteur simplifiées
  const [authorPrenom, setAuthorPrenom] = useState("");
  const [authorNom, setAuthorNom] = useState("");
  const [authorRole, setAuthorRole] = useState("");
  const [authorService, setAuthorService] = useState("");
  const [etablissementId, setEtablissementId] = useState("");
  const [etablissementNom, setEtablissementNom] = useState("");

  const createPost = useCreateForumPost();
  const [etablissements, setEtablissements] = useState<any[]>([]);
  const [loadingEtabs, setLoadingEtabs] = useState(false);
  
  // Vérifier si l'utilisateur est membre de l'équipe OpenPulse
  const { data: isTeamMember } = useIsTeamMember();
  const { data: teamProfile } = useTeamMemberProfile();

  // Auto-remplir nom/prénom pour les membres de l'équipe
  useEffect(() => {
    if (open && isTeamMember && teamProfile) {
      setAuthorPrenom(teamProfile.prenom || "");
      setAuthorNom(teamProfile.nom || "");
      setAuthorRole(teamProfile.fonction || "Équipe OpenPulse");
      setEtablissementNom("OpenPulse");
    }
  }, [open, isTeamMember, teamProfile]);

  // Charger la liste des établissements pour le dropdown
  useEffect(() => {
    const fetchEtablissements = async () => {
      setLoadingEtabs(true);
      try {
        const data = await fetchForumEtablissementsForPost();
        setEtablissements(data);
      } catch (err) {
        debug.error('[CreatePostDialog] Error fetching etablissements:', err);
      } finally {
        setLoadingEtabs(false);
      }
    };

    if (open) {
      fetchEtablissements();
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation champs obligatoires
    if (!titre.trim() || !contenu.trim() || !theme) {
      toast.error("Titre, thème et contenu sont obligatoires");
      return;
    }

    if (!authorPrenom.trim() || !authorNom.trim() || !authorRole) {
      toast.error("Prénom, nom et fonction sont obligatoires");
      return;
    }

    // Vérifier l'établissement uniquement pour les non-membres de l'équipe
    if (!isTeamMember && !etablissementId) {
      toast.error("L'établissement est obligatoire");
      return;
    }

    try {
      await createPost.mutateAsync({
        titre,
        contenu,
        theme: theme as any,
        user_id: null as any, // Post anonyme
        etablissement_id: etablissementId || undefined,
        author_nom: authorNom,
        author_prenom: authorPrenom,
        author_role: authorRole,
        author_service: authorService || undefined,
        author_etablissement_nom: etablissementNom || "OpenPulse",
        visibilite: visibility,
      });
      
      // Réinitialiser tous les champs
      setTitre("");
      setContenu("");
      setTheme("");
      setAuthorNom("");
      setAuthorPrenom("");
      setAuthorRole("");
      setAuthorService("");
      setEtablissementId("");
      setEtablissementNom("");
      setVisibility('global');
      setOpen(false);
      
      toast.success("✅ Sujet publié avec succès !");
    } catch (error) {
      debug.error('Erreur création post:', error);
      toast.error("Impossible de publier le sujet");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2" variant="default">
          <Plus className="h-4 w-4" />
          Nouveau sujet
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] lg:max-w-7xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Créer un nouveau sujet</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Layout en 2 colonnes pour optimiser l'espace */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Colonne gauche - Informations principales */}
            <div className="space-y-4">
              {/* Titre */}
              <div className="space-y-1.5">
                <Label htmlFor="titre">Titre du sujet *</Label>
                <Input
                  id="titre"
                  value={titre}
                  onChange={(e) => setTitre(e.target.value)}
                  placeholder="Ex: Comment optimiser le codage des actes CCAM ?"
                  required
                />
              </div>

              {/* Thème et Visibilité sur la même ligne */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="theme">Thème *</Label>
                  <Select value={theme} onValueChange={setTheme}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionnez" />
                    </SelectTrigger>
                    <SelectContent className="z-50 bg-background">
                      {themes.map((t) => (
                        <SelectItem key={t} value={t}>
                          {themeLabels[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Visibilité *</Label>
                  <RadioGroup value={visibility} onValueChange={(v: any) => setVisibility(v)} className="flex gap-4">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="global" id="global" />
                      <Label htmlFor="global" className="cursor-pointer text-sm">
                        Public
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="etablissement" id="etablissement" />
                      <Label htmlFor="etablissement" className="cursor-pointer text-sm">
                        Privé
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>

              {/* Informations auteur */}
              <div className="space-y-3 pt-2 border-t">
                <h3 className="text-sm font-semibold">Vos informations</h3>
                
                {/* Prénom et Nom */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="prenom">Prénom *</Label>
                    <Input
                      id="prenom"
                      value={authorPrenom}
                      onChange={(e) => setAuthorPrenom(e.target.value)}
                      placeholder="Jean"
                      required
                      disabled={isTeamMember}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="nom">Nom *</Label>
                    <Input
                      id="nom"
                      value={authorNom}
                      onChange={(e) => setAuthorNom(e.target.value)}
                      placeholder="Dupont"
                      required
                      disabled={isTeamMember}
                    />
                  </div>
                </div>

                {/* Établissement */}
                <div className="space-y-1.5">
                  <Label htmlFor="etablissement">Établissement {!isTeamMember && '*'}</Label>
                  {isTeamMember ? (
                    <Input id="etablissement" value="OpenPulse" disabled className="bg-muted" />
                  ) : (
                    <Select 
                      value={etablissementId} 
                      onValueChange={(value) => {
                        setEtablissementId(value);
                        const etab = etablissements.find(e => e.id === value);
                        setEtablissementNom(etab ? `${etab.nom} - ${etab.ville}` : '');
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={loadingEtabs ? "Chargement..." : "Sélectionnez"} />
                      </SelectTrigger>
                      <SelectContent className="z-50 bg-background">
                        {etablissements.map((etab) => (
                          <SelectItem key={etab.id} value={etab.id}>
                            {etab.nom} - {etab.ville}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Fonction et Service */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="fonction">Fonction *</Label>
                    {isTeamMember ? (
                      <Input
                        id="fonction"
                        value={authorRole}
                        disabled
                        className="bg-muted"
                      />
                    ) : (
                      <Select 
                        value={authorRole} 
                        onValueChange={setAuthorRole}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionnez" />
                        </SelectTrigger>
                        <SelectContent className="z-50 bg-background">
                          {fonctions.map((f) => (
                            <SelectItem key={f} value={f}>
                              {f}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="service">Service</Label>
                    {isTeamMember ? (
                      <Input
                        id="service"
                        value=""
                        disabled
                        placeholder="Non applicable"
                        className="bg-muted"
                      />
                    ) : (
                      <Select 
                        value={authorService} 
                        onValueChange={setAuthorService}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Optionnel" />
                        </SelectTrigger>
                        <SelectContent className="z-50 bg-background">
                          {services.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Colonne droite - Contenu */}
            <div className="space-y-1.5 lg:row-span-2">
              <Label htmlFor="contenu">Contenu *</Label>
              <div className="h-[450px]">
                <RichTextEditor
                  content={contenu}
                  onChange={setContenu}
                  placeholder="Décrivez votre question ou sujet en détail..."
                />
              </div>
            </div>
          </div>

          {/* Boutons d'action */}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={createPost.isPending}>
              {createPost.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Publication...
                </>
              ) : (
                "Publier"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
