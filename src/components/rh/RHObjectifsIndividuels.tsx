import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Target, Plus, TrendingUp, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/shared/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useCreateObjectif } from "@/hooks/hr/useRHMutations";
import { supabase } from "@/integrations/supabase/client";

const TYPE_OBJECTIF_OPTIONS = [
  { value: "quantitatif", label: "Quantitatif" },
  { value: "qualitatif", label: "Qualitatif" },
  { value: "competence", label: "Compétence" },
];

const PERIODE_OPTIONS = [
  { value: "mensuel", label: "Mensuel" },
  { value: "trimestriel", label: "Trimestriel" },
  { value: "annuel", label: "Annuel" },
];

export function RHObjectifsIndividuels() {
  const { user } = useAuth();
  const createObjectifMutation = useCreateObjectif();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    titre: "",
    description: "",
    type: "quantitatif",
    cible_valeur: "",
    unite: "",
    periode: "annuel",
    date_debut: "",
    date_fin: "",
  });

  const { data: objectifs, isLoading } = useQuery({
    queryKey: ["rh-objectifs", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("rh_objectifs")
        .select("id, titre, description, type, cible_valeur, realise_valeur, unite, periode, statut, created_at")
        .eq("profile_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    createObjectifMutation.mutate(formData, {
      onSuccess: () => {
        setIsDialogOpen(false);
        setFormData({
          titre: "",
          description: "",
          type: "quantitatif",
          cible_valeur: "",
          unite: "",
          periode: "annuel",
          date_debut: "",
          date_fin: "",
        });
      },
    });
  };

  const isSubmitting = createObjectifMutation.isPending;
  const calculateProgress = (objectif: any) => {
    if (!objectif.cible_valeur || objectif.cible_valeur === 0) return 0;
    return Math.min(100, ((objectif.realise_valeur || 0) / objectif.cible_valeur) * 100);
  };

  const getStatusColor = (statut: string) => {
    switch (statut) {
      case "atteint": return "bg-green-500";
      case "en_cours": return "bg-blue-500";
      case "en_retard": return "bg-orange-500";
      case "abandonne": return "bg-gray-500";
      default: return "bg-muted";
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Mes objectifs
        </CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Nouvel objectif
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Définir un objectif</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="titre">Titre *</Label>
                <Input
                  id="titre"
                  value={formData.titre}
                  onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
                  placeholder="Ex: Atteindre 100k€ de CA"
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPE_OBJECTIF_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Période</Label>
                  <Select
                    value={formData.periode}
                    onValueChange={(value) => setFormData({ ...formData, periode: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PERIODE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="cible_valeur">Cible</Label>
                  <Input
                    id="cible_valeur"
                    type="number"
                    value={formData.cible_valeur}
                    onChange={(e) => setFormData({ ...formData, cible_valeur: e.target.value })}
                    placeholder="100000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unite">Unité</Label>
                  <Input
                    id="unite"
                    value={formData.unite}
                    onChange={(e) => setFormData({ ...formData, unite: e.target.value })}
                    placeholder="€, %, unités..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting || !formData.titre}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Créer l'objectif
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : objectifs && objectifs.length > 0 ? (
          <div className="space-y-4">
            {objectifs.map((objectif: any) => (
              <div key={objectif.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium">{objectif.titre}</h4>
                    <p className="text-sm text-muted-foreground">{objectif.description}</p>
                  </div>
                  <Badge className={getStatusColor(objectif.statut)}>
                    {objectif.statut === "en_cours" ? "En cours" : objectif.statut}
                  </Badge>
                </div>
                {objectif.cible_valeur && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>{objectif.realise_valeur || 0} {objectif.unite}</span>
                      <span>{objectif.cible_valeur} {objectif.unite}</span>
                    </div>
                    <Progress value={calculateProgress(objectif)} className="h-2" />
                    <p className="text-xs text-muted-foreground text-right">
                      {calculateProgress(objectif).toFixed(0)}% atteint
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Aucun objectif défini</p>
            <p className="text-sm">Créez votre premier objectif pour suivre votre progression</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
