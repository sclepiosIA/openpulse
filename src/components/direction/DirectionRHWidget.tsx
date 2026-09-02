import React, { useState, useEffect } from "react";
import { debug } from "@/lib/debug";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, Calendar, TrendingUp, AlertCircle, Sparkles, UserCheck, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { invokeEdge } from "@/services/edgeFunctions";
import { supabase } from "@/integrations/supabase/client";

interface RHInsights {
  score_climat: number;
  tendances: string[];
  alertes: Array<{ niveau: string; message: string }>;
  recommandations: string[];
}

interface SavedInsights {
  insights_data: RHInsights;
  created_at: string;
}

export const DirectionRHWidget = React.memo(function DirectionRHWidget() {
  const [rhInsights, setRhInsights] = useState<RHInsights | null>(null);
  const [insightsDate, setInsightsDate] = useState<string | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  // Charger les insights sauvegardés au démarrage
  const { data: savedInsights } = useQuery({
    queryKey: ["rh-insights-saved"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_analysis_log")
        .select("insights_data, created_at")
        .eq("analysis_type", "rh_insights")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as SavedInsights | null;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Appliquer les insights sauvegardés quand ils sont chargés
  useEffect(() => {
    if (savedInsights?.insights_data && !rhInsights) {
      setRhInsights(savedInsights.insights_data);
      setInsightsDate(savedInsights.created_at);
    }
  }, [savedInsights, rhInsights]);

  const { data: rhData, isLoading } = useQuery({
    queryKey: ["direction-rh-widget"],
    queryFn: async () => {
      const now = new Date();
      const startMonth = startOfMonth(now);
      const endMonth = endOfMonth(now);

      // Effectif actif
      const { count: effectif } = await supabase
        .from("profiles")
        .select("id", { count: "exact" });

      // Absences en cours
      const { count: nbAbsences } = await supabase
        .from("rh_absences")
        .select("id", { count: "exact", head: true })
        .lte("date_debut", now.toISOString())
        .gte("date_fin", now.toISOString())
        .eq("statut", "Validé");

      // Absences prévues ce mois
      const { data: absencesMois } = await supabase
        .from("rh_absences")
        .select("id, date_debut, date_fin, type_absence, statut")
        .gte("date_debut", startMonth.toISOString())
        .lte("date_debut", endMonth.toISOString());

      // Entretiens à venir
      const { data: entretiens } = await supabase
        .from("rh_entretiens")
        .select("id, date_entretien, type, statut")
        .gte("date_entretien", now.toISOString())
        .eq("statut", "planifie")
        .order("date_entretien")
        .limit(5);

      // Masse salariale - mois format DATE (yyyy-MM-dd), pas TEXT
      const currentMonthStr = format(startMonth, "yyyy-MM-dd");
      let { data: salaires } = await supabase
        .from("rh_salaires_mensuels")
        .select("salaire_net, salaire_brut, mois")
        .eq("mois", currentMonthStr);

      // Fallback: si pas de données ce mois, prendre le dernier mois disponible
      let moisReference = format(now, "MMM yyyy", { locale: fr });
      if (!salaires || salaires.length === 0) {
        const { data: derniersSalaires } = await supabase
          .from("rh_salaires_mensuels")
          .select("salaire_net, salaire_brut, mois")
          .order("mois", { ascending: false })
          .limit(20);
        
        if (derniersSalaires && derniersSalaires.length > 0) {
          // Grouper par le mois le plus récent
          const dernierMois = derniersSalaires[0].mois;
          salaires = derniersSalaires.filter(s => s.mois === dernierMois);
          moisReference = format(new Date(dernierMois), "MMM yyyy", { locale: fr });
        }
      }

      // Calculer les totaux
      const masseSalarialeNette = salaires?.reduce((acc, s) => acc + (Number(s.salaire_net) || 0), 0) || 0;
      const masseSalarialeBrute = salaires?.reduce((acc, s) => acc + (Number(s.salaire_brut) || 0), 0) || 0;

      // Demandes en attente
      const { count: demandesConges } = await supabase
        .from("rh_absences")
        .select("id", { count: "exact", head: true })
        .eq("statut", "En attente");

      const { count: demandesFormations } = await supabase
        .from("rh_demandes_formation")
        .select("id", { count: "exact", head: true })
        .eq("statut", "en_attente");

      return {
        effectif: effectif || 0,
        nbAbsencesEnCours: nbAbsences || 0,
        absencesMois: absencesMois?.length || 0,
        entretiens: entretiens || [],
        masseSalarialeNette,
        masseSalarialeBrute,
        moisReference,
        demandesEnAttente: (demandesConges || 0) + (demandesFormations || 0),
      };
    },
  });

  const fetchRHInsights = async () => {
    setLoadingInsights(true);
    try {
      const data = await invokeEdge<any>("analyze-rh-insights");
    const error = null;

      if (error) throw error;

      setRhInsights(data);
      setInsightsDate(new Date().toISOString());
      toast.success("Analyse RH générée et sauvegardée");
    } catch (error) {
      debug.error("Erreur analyse RH:", error);
      toast.error("Impossible de générer l'analyse");
    } finally {
      setLoadingInsights(false);
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

  const data = rhData || {
    effectif: 0,
    nbAbsencesEnCours: 0,
    absencesMois: 0,
    entretiens: [],
    masseSalarialeNette: 0,
    masseSalarialeBrute: 0,
    moisReference: "",
    demandesEnAttente: 0,
  };

  return (
    <Card className="overflow-hidden border-0 shadow-card hover:shadow-card-hover transition-shadow duration-300">
      {/* Premium accent bar */}
      <div className="h-1.5 bg-gradient-to-r from-accent via-warning to-accent" />
      
      <CardHeader className="bg-gradient-to-r from-accent/5 to-transparent pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-accent to-warning text-white shadow-glow-orange">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Ressources Humaines</CardTitle>
              <CardDescription>Effectif et climat social</CardDescription>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchRHInsights}
            disabled={loadingInsights}
            className="hover:bg-accent/10 hover:border-accent/30"
            title={insightsDate ? `Dernière analyse : ${formatDistanceToNow(new Date(insightsDate), { addSuffix: true, locale: fr })}` : "Lancer une analyse IA"}
          >
            {loadingInsights ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : rhInsights ? (
              <RefreshCw className="h-4 w-4 text-accent" />
            ) : (
              <Sparkles className="h-4 w-4 text-accent" />
            )}
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4 pt-4">
        {/* Insights IA en premier si disponibles */}
        {rhInsights && (
          <div className="space-y-3 p-4 rounded-xl bg-gradient-to-br from-accent/10 via-warning/5 to-transparent border-2 border-accent/20">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent" />
                Analyse IA
                {insightsDate && (
                  <span className="text-xs font-normal text-muted-foreground">
                    ({formatDistanceToNow(new Date(insightsDate), { addSuffix: true, locale: fr })})
                  </span>
                )}
              </h4>
              <Badge
                className={cn(
                  "font-bold",
                  rhInsights.score_climat >= 70 ? "bg-success text-success-foreground" : 
                  rhInsights.score_climat >= 40 ? "bg-warning text-warning-foreground" : 
                  "bg-destructive text-destructive-foreground"
                )}
              >
                Climat : {rhInsights.score_climat}%
              </Badge>
            </div>

            <div className="relative h-3 rounded-full overflow-hidden bg-muted">
              <div 
                className={cn(
                  "h-full rounded-full transition-all duration-1000",
                  rhInsights.score_climat >= 70 ? "bg-gradient-to-r from-success to-primary" : 
                  rhInsights.score_climat >= 40 ? "bg-gradient-to-r from-warning to-accent" : 
                  "bg-gradient-to-r from-destructive to-warning"
                )}
                style={{ width: `${rhInsights.score_climat}%` }}
              />
            </div>

            {rhInsights.tendances?.length > 0 && (
              <div className="space-y-1">
                {rhInsights.tendances.slice(0, 2).map((tendance, i) => (
                  <p key={`tendance-${i}-${tendance.slice(0, 20)}`} className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                    • {tendance}
                  </p>
                ))}
              </div>
            )}

            {rhInsights.alertes?.length > 0 && (
              <div className="space-y-2">
                {rhInsights.alertes.slice(0, 2).map((alerte, i) => (
                  <div
                    key={`alerte-${i}-${alerte.niveau}-${alerte.message.slice(0, 20)}`}
                    className={cn(
                      "p-2 sm:p-3 rounded-xl text-xs sm:text-sm font-medium border-l-4 break-words",
                      alerte.niveau === "critique"
                        ? "bg-destructive/10 text-destructive border-destructive"
                        : "bg-warning/10 text-warning border-warning"
                    )}
                  >
                    <span className="line-clamp-3">{alerte.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Effectif - Premium display */}
        <div className="relative p-3 sm:p-5 rounded-xl bg-gradient-to-br from-accent/10 via-accent/5 to-transparent border-2 border-accent/20 overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-accent/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
          <div className="flex items-center justify-between relative z-10">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1">Effectif actif</p>
              <p className="text-2xl sm:text-3xl lg:text-4xl font-black text-accent tracking-tight">{data.effectif}</p>
            </div>
            <div className="p-2 sm:p-3 rounded-xl bg-accent/10 shrink-0">
              <UserCheck className="h-6 w-6 sm:h-8 sm:w-8 text-accent" />
            </div>
          </div>
        </div>

        {/* KPIs - Enhanced cards */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <div className="p-2 sm:p-4 rounded-xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent hover:shadow-[0_0_20px_-5px_hsl(var(--primary)/0.3)] transition-shadow duration-300">
            <div className="flex items-center gap-1 sm:gap-2 text-primary mb-1 sm:mb-2">
              <div className="p-1 sm:p-1.5 rounded-lg bg-primary/10 shrink-0">
                <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
              </div>
              <span className="text-[10px] sm:text-sm font-medium truncate">Absents auj.</span>
            </div>
            <p className="text-lg sm:text-xl font-bold text-primary">{data.nbAbsencesEnCours}</p>
          </div>
          <div className="p-2 sm:p-4 rounded-xl border-2 border-accent/20 bg-gradient-to-br from-accent/5 to-transparent hover:shadow-[0_0_20px_-5px_hsl(var(--accent)/0.3)] transition-shadow duration-300">
            <div className="flex items-center gap-1 sm:gap-2 text-accent mb-1 sm:mb-2">
              <div className="p-1 sm:p-1.5 rounded-lg bg-accent/10 shrink-0">
                <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4" />
              </div>
              <span className="text-[10px] sm:text-sm font-medium truncate">Masse salariale</span>
            </div>
            <p className="text-lg sm:text-xl font-bold text-accent">
              {(data.masseSalarialeNette / 1000).toFixed(0)}k€
              {data.moisReference && (
                <span className="text-[10px] sm:text-xs font-normal text-muted-foreground ml-1 hidden sm:inline">
                  ({data.moisReference})
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Demandes en attente */}
        {data.demandesEnAttente > 0 && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-warning/10 to-warning/5 border-2 border-warning/30">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-warning/20">
                <AlertCircle className="h-4 w-4 text-warning" />
              </div>
              <span className="text-sm font-semibold text-warning">
                {data.demandesEnAttente} demande(s) en attente
              </span>
            </div>
            <p className="text-sm text-warning/80 mt-1 ml-8">
              Congés et formations à valider
            </p>
          </div>
        )}

        {/* Prochains entretiens */}
        {data.entretiens.length > 0 && (
          <div className="space-y-2 pt-2 border-t-2 border-dashed">
            <h4 className="text-sm font-semibold">Prochains entretiens</h4>
            <div className="space-y-2">
              {data.entretiens.slice(0, 3).map((entretien: any) => (
                <div
                  key={entretien.id}
                  className="flex items-center justify-between p-3 rounded-xl border-2 border-muted hover:border-primary/30 hover:bg-primary/5 transition-all duration-200"
                >
                  <span className="text-sm font-medium text-muted-foreground">
                    {format(new Date(entretien.date_entretien), "d MMM", { locale: fr })}
                  </span>
                  <Badge variant="outline" className="text-xs font-medium">
                    {entretien.type}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
