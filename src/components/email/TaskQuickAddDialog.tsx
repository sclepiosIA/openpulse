import { useState, useEffect } from "react";
import { debug } from "@/lib/debug";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { CheckSquare, Loader2 } from "lucide-react";
import { useCreateTache } from "@/hooks/tasks/useCreateTache";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface TaskQuickAddDialogProps {
  etablissementId: string;
  etablissementNom: string;
  defaultTitle?: string;
  emailContent?: string;
}

export function TaskQuickAddDialog({ 
  etablissementId, 
  etablissementNom, 
  defaultTitle,
  emailContent 
}: TaskQuickAddDialogProps) {
  const [open, setOpen] = useState(false);
  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [categorieId, setCategorieId] = useState("");
  const [priorite, setPriorite] = useState<"low" | "medium" | "high">("medium");
  const [dateDebut, setDateDebut] = useState("");
  const [echeance, setEcheance] = useState("");
  const [responsableId, setResponsableId] = useState("");
  
  const navigate = useNavigate();
  const createTache = useCreateTache();

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ['categories-taches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories_taches')
        .select('id, nom, description, couleur, ordre')
        .order('nom');
      if (error) throw error;
      return data;
    },
  });

  // Fetch users
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, prenom, nom')
        .order('prenom');
      if (error) throw error;
      return data;
    },
  });

  // Fetch establishment data for CSM
  const { data: etablissement } = useQuery({
    queryKey: ['etablissement-csm', etablissementId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('etablissements')
        .select('csm_id')
        .eq('id', etablissementId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Smart suggestions based on email content
  useEffect(() => {
    if (open && emailContent) {
      const contentLower = emailContent.toLowerCase();
      
      // Category suggestions
      if (contentLower.includes('devis') || contentLower.includes('contrat') || contentLower.includes('commercial')) {
        const contractuelCat = categories?.find(c => c.nom.toLowerCase().includes('contractuel'));
        if (contractuelCat) setCategorieId(contractuelCat.id);
      } else if (contentLower.includes('formation') || contentLower.includes('demo')) {
        const formationCat = categories?.find(c => c.nom.toLowerCase().includes('formation'));
        if (formationCat) setCategorieId(formationCat.id);
      } else if (contentLower.includes('technique') || contentLower.includes('problème') || contentLower.includes('bug')) {
        const techniqueCat = categories?.find(c => c.nom.toLowerCase().includes('technique'));
        if (techniqueCat) setCategorieId(techniqueCat.id);
      }

      // Priority suggestions
      if (contentLower.includes('urgent') || contentLower.includes('asap') || contentLower.includes('rapidement')) {
        setPriorite('high');
        // Set deadline to tomorrow for urgent tasks
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setEcheance(tomorrow.toISOString().split('T')[0]);
      } else if (contentLower.includes('semaine prochaine') || contentLower.includes('la semaine prochaine')) {
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        setEcheance(nextWeek.toISOString().split('T')[0]);
      } else {
        // Default: 3 days from now
        const threeDays = new Date();
        threeDays.setDate(threeDays.getDate() + 3);
        setEcheance(threeDays.toISOString().split('T')[0]);
      }
    }
  }, [open, emailContent, categories]);

  // Auto-assign to CSM if available
  useEffect(() => {
    if (open && etablissement?.csm_id) {
      setResponsableId(etablissement.csm_id);
    }
  }, [open, etablissement]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setTitre(defaultTitle || "");
      setDescription("");
      setPriorite("medium");
      if (!emailContent) {
        // Only set default date if no email content (no smart suggestions)
        const threeDays = new Date();
        threeDays.setDate(threeDays.getDate() + 3);
        setEcheance(threeDays.toISOString().split('T')[0]);
      }
    }
  }, [open, defaultTitle]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!titre.trim() || !categorieId) {
      toast.error("Veuillez remplir les champs obligatoires");
      return;
    }

    try {
      const result = await createTache.mutateAsync({
        titre,
        description: description || undefined,
        etablissement_id: etablissementId,
        categorie_id: categorieId,
        priorite,
        date_debut: dateDebut || undefined,
        echeance: echeance || undefined,
        responsable_id: responsableId || undefined,
      });

      toast.success(`Tâche créée pour ${etablissementNom}`, {
        action: {
          label: "Voir la tâche",
          onClick: () => navigate(`/taches?tache=${result.id}`),
        },
      });
      
      setOpen(false);
    } catch (error) {
      debug.error('Error creating task:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full">
          <CheckSquare className="mr-2 h-4 w-4" />
          Créer une tâche
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Créer une tâche rapide</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Establishment Badge */}
          <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-md">
            <Badge variant="secondary" className="text-sm">
              {etablissementNom}
            </Badge>
            <span className="text-xs text-muted-foreground">
              La tâche sera liée à cet établissement
            </span>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="titre">
              Titre de la tâche <span className="text-destructive">*</span>
            </Label>
            <Input
              id="titre"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Ex: Envoyer le devis personnalisé"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Détails supplémentaires..."
              rows={3}
            />
          </div>

          {/* Category and Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="categorie">
                Catégorie <span className="text-destructive">*</span>
              </Label>
              <Select value={categorieId} onValueChange={setCategorieId} required>
                <SelectTrigger id="categorie">
                  <SelectValue placeholder="Sélectionner une catégorie" />
                </SelectTrigger>
                <SelectContent>
                  {categories?.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: cat.couleur || '#999' }}
                        />
                        {cat.nom}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priorite">Priorité</Label>
              <Select value={priorite} onValueChange={(v: any) => setPriorite(v)}>
                <SelectTrigger id="priorite">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Basse</SelectItem>
                  <SelectItem value="medium">Moyenne</SelectItem>
                  <SelectItem value="high">Haute</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date de début et Échéance */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date_debut">Date de début</Label>
              <Input
                id="date_debut"
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="echeance">Échéance</Label>
              <Input
                id="echeance"
                type="date"
                value={echeance}
                onChange={(e) => setEcheance(e.target.value)}
              />
            </div>
          </div>

          {/* Responsable */}
          <div className="space-y-2">
            <Label htmlFor="responsable">Responsable</Label>
            <Select value={responsableId} onValueChange={setResponsableId}>
              <SelectTrigger id="responsable">
                <SelectValue placeholder="Sélectionner un responsable" />
              </SelectTrigger>
              <SelectContent>
                {users?.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.prenom} {user.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={createTache.isPending}>
              {createTache.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Création...
                </>
              ) : (
                <>
                  <CheckSquare className="mr-2 h-4 w-4" />
                  Créer la tâche
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
