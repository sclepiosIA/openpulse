import { useState } from "react";
import { debug } from "@/lib/debug";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/shared/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, GraduationCap, Euro, Sparkles, Calendar } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { invokeEdge } from "@/services/edgeFunctions";
import { supabase } from "@/integrations/supabase/client";

interface FormationDemande {
  id: string;
  titre: string;
  type: string;
  cout_estime: number | null;
  budget_utilise: number | null;
  statut: string;
  date_souhaitee: string | null;
  created_at: string;
}

interface AISuggestion {
  titre: string;
  type: string;
  description: string;
  cout_estime: number;
  priorite: "haute" | "moyenne" | "basse";
  justification: string;
}

export function RHBudgetFormation() {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Budget annuel par défaut (pourrait venir d'une table de configuration)
  const budgetAnnuel = 3000;
  const anneeEnCours = new Date().getFullYear();

  const { data: formations, isLoading } = useQuery({
    queryKey: ["rh-formations-budget", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from("rh_demandes_formation")
        .select("id, titre, type, cout_estime, budget_utilise, statut, date_souhaitee, created_at")
        .eq("profile_id", user.id)
        .gte("created_at", `${anneeEnCours}-01-01`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as FormationDemande[];
    },
    enabled: !!user?.id,
  });

  const budgetConsomme = formations?.reduce((acc, f) => {
    if (f.statut === "validee" || f.statut === "terminee") {
      return acc + (f.budget_utilise || f.cout_estime || 0);
    }
    return acc;
  }, 0) || 0;

  const budgetEnAttente = formations?.reduce((acc, f) => {
    if (f.statut === "en_attente") {
      return acc + (f.cout_estime || 0);
    }
    return acc;
  }, 0) || 0;

  const budgetDisponible = Math.max(0, budgetAnnuel - budgetConsomme);
  const pourcentageConsomme = Math.min(100, (budgetConsomme / budgetAnnuel) * 100);

  const getStatusBadge = (statut: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      en_attente: { variant: "secondary", label: "En attente" },
      validee: { variant: "default", label: "Validée" },
      refusee: { variant: "destructive", label: "Refusée" },
      terminee: { variant: "outline", label: "Terminée" },
    };
    const config = variants[statut] || { variant: "secondary" as const, label: statut };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      formation_externe: "Formation externe",
      conference: "Conférence",
      certification: "Certification",
      credit_formation: "Crédit formation",
      mooc: "MOOC / E-learning",
    };
    return types[type] || type;
  };

  const fetchAISuggestions = async () => {
    if (!user?.id) return;
    
    setLoadingSuggestions(true);
    try {
      const data = await invokeEdge<any>("suggest-employee-training", { profileId: user.id },);
    const error = null;

      if (error) throw error;

      if (data?.suggestions) {
        setSuggestions(data.suggestions);
        toast.success("Suggestions IA générées avec succès");
      }
    } catch (error) {
      debug.error("Erreur suggestions IA:", error);
      toast.error("Impossible de générer les suggestions");
    } finally {
      setLoadingSuggestions(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Résumé Budget */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Budget annuel {anneeEnCours}</CardDescription>
            <CardTitle className="text-2xl font-bold">
              {budgetAnnuel.toLocaleString("fr-FR")} €
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Euro className="h-4 w-4" />
              <span>Alloué par employé</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Budget consommé</CardDescription>
            <CardTitle className="text-2xl font-bold text-primary">
              {budgetConsomme.toLocaleString("fr-FR")} €
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={pourcentageConsomme} className="h-2" />
            <p className="mt-2 text-sm text-muted-foreground">
              {pourcentageConsomme.toFixed(0)}% utilisé
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Budget disponible</CardDescription>
            <CardTitle className="text-2xl font-bold text-green-600">
              {budgetDisponible.toLocaleString("fr-FR")} €
            </CardTitle>
          </CardHeader>
          <CardContent>
            {budgetEnAttente > 0 && (
              <p className="text-sm text-amber-600">
                {budgetEnAttente.toLocaleString("fr-FR")} € en attente de validation
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Suggestions IA */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                Suggestions IA
              </CardTitle>
              <CardDescription>
                Formations recommandées selon votre profil et objectifs
              </CardDescription>
            </div>
            <Button onClick={fetchAISuggestions} disabled={loadingSuggestions}>
              {loadingSuggestions ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Générer suggestions
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {suggestions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Cliquez sur "Générer suggestions" pour obtenir des recommandations personnalisées
            </p>
          ) : (
            <div className="space-y-3">
              {suggestions.map((suggestion, index) => (
                <div
                  key={`suggestion-${index}-${suggestion.titre}`}
                  className="p-4 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h4 className="font-medium">{suggestion.titre}</h4>
                      <p className="text-sm text-muted-foreground">{suggestion.description}</p>
                      <p className="text-xs text-muted-foreground italic">
                        {suggestion.justification}
                      </p>
                    </div>
                    <div className="text-right space-y-1">
                      <Badge
                        variant={
                          suggestion.priorite === "haute"
                            ? "destructive"
                            : suggestion.priorite === "moyenne"
                            ? "default"
                            : "secondary"
                        }
                      >
                        Priorité {suggestion.priorite}
                      </Badge>
                      <p className="text-sm font-medium">
                        ~{suggestion.cout_estime?.toLocaleString("fr-FR")} €
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historique formations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Historique des formations
          </CardTitle>
          <CardDescription>
            Vos demandes de formation pour {anneeEnCours}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!formations || formations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucune demande de formation cette année
            </p>
          ) : (
            <div className="space-y-3">
              {formations.map((formation) => (
                <div
                  key={formation.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="space-y-1">
                    <h4 className="font-medium">{formation.titre}</h4>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{getTypeLabel(formation.type)}</span>
                      {formation.date_souhaitee && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(formation.date_souhaitee), "d MMM yyyy", { locale: fr })}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">
                      {(formation.budget_utilise || formation.cout_estime || 0).toLocaleString("fr-FR")} €
                    </span>
                    {getStatusBadge(formation.statut)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
