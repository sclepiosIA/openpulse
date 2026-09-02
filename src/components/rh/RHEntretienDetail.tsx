import { useState } from "react";
import { debug } from "@/lib/debug";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRHEntretienMutation } from "@/hooks/hr/useRHEntretienMutation";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/shared/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Loader2, Users, FileText, Sparkles, Plus, ClipboardList } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

interface Entretien {
  id: string;
  profile_id: string;
  manager_id: string;
  type: string;
  date_entretien: string;
  statut: string;
  synthese_manager: string | null;
  synthese_employe: string | null;
  points_forts: string[] | null;
  axes_amelioration: string[] | null;
  augmentation_proposee: number | null;
  created_at: string;
  profiles?: { full_name: string } | null;
}

interface Profile {
  id: string;
  full_name: string;
}

export function RHEntretienDetail() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("planification");
  /** Structure de réponse IA pour la préparation d'entretien */
  interface PreparationIA {
    resume?: string;
    points_forts?: string[];
    axes_amelioration?: string[];
    questions_suggerees?: string[];
  }
  
  const [preparationIA, setPreparationIA] = useState<PreparationIA | null>(null);
  const [loadingIA, setLoadingIA] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    profile_id: "",
    type: "annuel",
    date_entretien: "",
  });

  // Récupérer les profils (pour les managers)
  const { data: profiles } = useQuery({
    queryKey: ["profiles-for-entretiens"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, prenom, nom");

      if (error) throw error;
      return (data || []).map(p => ({
        id: p.id,
        full_name: [p.prenom, p.nom].filter(Boolean).join(" ") || "Sans nom"
      })) as Profile[];
    },
  });

  // Récupérer les entretiens
  const { data: entretiens, isLoading } = useQuery({
    queryKey: ["rh-entretiens", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from("rh_entretiens" as any)
        .select("id, profile_id, manager_id, type, date_entretien, statut, synthese_manager, synthese_employe, points_forts, axes_amelioration, augmentation_proposee, created_at")
        .or(`manager_id.eq.${user.id},profile_id.eq.${user.id}`)
        .order("date_entretien", { ascending: false });

      if (error) throw error;
      
      // Fetch profile names separately
      const profileIds = [...new Set((data || []).map((e: any) => e.profile_id))];
      const { data: profilesData } = await supabase.from("profiles").select("id, prenom, nom").in("id", profileIds);
      const profileMap = new Map(profilesData?.map(p => [p.id, [p.prenom, p.nom].filter(Boolean).join(" ") || "Sans nom"]) || []);
      
      return (data || []).map((e: any) => ({ ...e, profiles: { full_name: profileMap.get(e.profile_id) || "Inconnu" } })) as Entretien[];
    },
    enabled: !!user?.id,
  });

  const createEntretienMutation = useRHEntretienMutation();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.profile_id || !formData.date_entretien) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }
    if (!user?.id) {
      toast.error("Non authentifié");
      return;
    }
    createEntretienMutation.mutate(
      { ...formData, manager_id: user.id },
      { onSuccess: () => setFormData({ profile_id: "", type: "annuel", date_entretien: "" }) }
    );
  };

  const fetchPreparationIA = async (profileId: string) => {
    setLoadingIA(true);
    setSelectedEmployeeId(profileId);
    try {
      const { data, error } = await supabase.functions.invoke("prepare-annual-review", {
        body: { profileId },
      });

      if (error) throw error;

      setPreparationIA(data);
      toast.success("Préparation IA générée");
    } catch (error) {
      debug.error("Erreur préparation IA:", error);
      toast.error("Impossible de générer la préparation");
    } finally {
      setLoadingIA(false);
    }
  };

  const getTypeBadge = (type: string) => {
    const types: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      annuel: { label: "Annuel", variant: "default" },
      professionnel: { label: "Professionnel", variant: "secondary" },
      recadrage: { label: "Recadrage", variant: "destructive" },
      fin_pe: { label: "Fin PE", variant: "outline" },
    };
    const config = types[type] || { label: type, variant: "secondary" as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getStatutBadge = (statut: string) => {
    const statuts: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      planifie: { label: "Planifié", variant: "secondary" },
      en_cours: { label: "En cours", variant: "default" },
      termine: { label: "Terminé", variant: "outline" },
      annule: { label: "Annulé", variant: "destructive" },
    };
    const config = statuts[statut] || { label: statut, variant: "secondary" as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const entretiensAVenir = entretiens?.filter(
    (e) => new Date(e.date_entretien) >= new Date() && e.statut === "planifie"
  ) || [];

  const entretiensPasses = entretiens?.filter(
    (e) => new Date(e.date_entretien) < new Date() || e.statut === "termine"
  ) || [];

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="planification" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Planifier
          </TabsTrigger>
          <TabsTrigger value="avenir" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            À venir ({entretiensAVenir.length})
          </TabsTrigger>
          <TabsTrigger value="historique" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Historique
          </TabsTrigger>
        </TabsList>

        {/* Onglet Planification */}
        <TabsContent value="planification">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Planifier un entretien
              </CardTitle>
              <CardDescription>
                Planifiez un entretien annuel, professionnel ou de recadrage
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="profile_id">Collaborateur *</Label>
                    <Select
                      value={formData.profile_id}
                      onValueChange={(value) => setFormData({ ...formData, profile_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner..." />
                      </SelectTrigger>
                      <SelectContent>
                        {profiles?.map((profile) => (
                          <SelectItem key={profile.id} value={profile.id}>
                            {profile.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="type">Type d'entretien</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value) => setFormData({ ...formData, type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="annuel">Entretien annuel</SelectItem>
                        <SelectItem value="professionnel">Entretien professionnel</SelectItem>
                        <SelectItem value="recadrage">Entretien de recadrage</SelectItem>
                        <SelectItem value="fin_pe">Fin de période d'essai</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="date_entretien">Date *</Label>
                    <Input
                      id="date_entretien"
                      type="date"
                      value={formData.date_entretien}
                      onChange={(e) => setFormData({ ...formData, date_entretien: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <Button type="submit" disabled={createEntretienMutation.isPending}>
                  {createEntretienMutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  )}
                  Planifier l'entretien
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Entretiens à venir */}
        <TabsContent value="avenir">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Entretiens à venir
              </CardTitle>
            </CardHeader>
            <CardContent>
              {entretiensAVenir.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucun entretien planifié
                </p>
              ) : (
                <div className="space-y-4">
                  {entretiensAVenir.map((entretien) => (
                    <div
                      key={entretien.id}
                      className="p-4 rounded-lg border bg-card hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">
                              {entretien.profiles?.full_name || "Collaborateur"}
                            </h4>
                            {getTypeBadge(entretien.type)}
                          </div>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(entretien.date_entretien), "EEEE d MMMM yyyy", { locale: fr })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fetchPreparationIA(entretien.profile_id)}
                            disabled={loadingIA && selectedEmployeeId === entretien.profile_id}
                          >
                            {loadingIA && selectedEmployeeId === entretien.profile_id ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-1" />
                            ) : (
                              <Sparkles className="h-4 w-4 mr-1 text-amber-500" />
                            )}
                            Préparer (IA)
                          </Button>
                        </div>
                      </div>

                      {/* Affichage préparation IA */}
                      {preparationIA && selectedEmployeeId === entretien.profile_id && (
                        <div className="mt-4 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                          <h5 className="font-medium flex items-center gap-2 mb-3">
                            <Sparkles className="h-4 w-4 text-amber-500" />
                            Préparation IA
                          </h5>
                          
                          {preparationIA.resume && (
                            <div className="mb-3">
                              <p className="text-sm font-medium">Résumé</p>
                              <p className="text-sm text-muted-foreground">{preparationIA.resume}</p>
                            </div>
                          )}

                          {(preparationIA.points_forts?.length ?? 0) > 0 && (
                            <div className="mb-3">
                              <p className="text-sm font-medium text-green-600">Points forts</p>
                              <ul className="text-sm text-muted-foreground list-disc list-inside">
                                {preparationIA.points_forts?.map((point) => (
                                  <li key={`point-fort-${point.slice(0, 32)}`}>{point}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {(preparationIA.axes_amelioration?.length ?? 0) > 0 && (
                            <div className="mb-3">
                              <p className="text-sm font-medium text-amber-600">Axes d'amélioration</p>
                              <ul className="text-sm text-muted-foreground list-disc list-inside">
                                {preparationIA.axes_amelioration?.map((axe) => (
                                  <li key={`axe-${axe.slice(0, 32)}`}>{axe}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {(preparationIA.questions_suggerees?.length ?? 0) > 0 && (
                            <div>
                              <p className="text-sm font-medium">Questions suggérées</p>
                              <ul className="text-sm text-muted-foreground list-disc list-inside">
                                {preparationIA.questions_suggerees?.map((q) => (
                                  <li key={`question-${q.slice(0, 32)}`}>{q}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Historique */}
        <TabsContent value="historique">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Historique des entretiens
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : entretiensPasses.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucun entretien passé
                </p>
              ) : (
                <div className="space-y-3">
                  {entretiensPasses.map((entretien) => (
                    <div
                      key={entretien.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">
                            {entretien.profiles?.full_name || "Collaborateur"}
                          </h4>
                          {getTypeBadge(entretien.type)}
                          {getStatutBadge(entretien.statut)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(entretien.date_entretien), "d MMMM yyyy", { locale: fr })}
                        </p>
                      </div>
                      {entretien.synthese_manager && (
                        <Badge variant="outline">
                          <FileText className="h-3 w-3 mr-1" />
                          Synthèse disponible
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
