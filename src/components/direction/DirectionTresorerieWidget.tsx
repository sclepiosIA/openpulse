import React, { useState, useEffect } from "react";
import { debug } from "@/lib/debug";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Wallet, TrendingUp, TrendingDown, AlertTriangle, Sparkles, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { invokeEdge } from "@/services/edgeFunctions";
import { supabase } from "@/integrations/supabase/client";

interface FluxTresoreriePrevision {
  mois: string;
  libelle?: string;
  solde_prevu?: number;
  solde_fin_mois?: number;
  revenus_prevus: number;
  depenses_prevues: number;
  variation?: number;
  risque?: string;
  commentaire?: string;
}

interface FluxTresorerieData {
  previsions: FluxTresoreriePrevision[];
  alertes: Array<{ gravite?: string; niveau?: string; message: string }>;
  resume: {
    tendance: string;
    score_sante?: number;
    recommandation?: string;
    recommandation_principale?: string;
  };
  fallback?: boolean;
  fallback_reason?: string;
  solde_actuel?: number;
  date_analyse?: string;
}

export const DirectionTresorerieWidget = React.memo(function DirectionTresorerieWidget() {
  const [fluxTresorerieData, setFluxTresorerieData] = useState<FluxTresorerieData | null>(null);
  const [loadingPrediction, setLoadingPrediction] = useState(false);
  const [insightsDate, setInsightsDate] = useState<string | null>(null);

  // Charger les prévisions sauvegardées au démarrage
  const { data: savedForecast } = useQuery({
    queryKey: ["treasury-forecast-saved"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_analysis_log")
        .select("insights_data, created_at")
        .eq("analysis_type", "treasury_forecast")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as { insights_data: FluxTresorerieData; created_at: string } | null;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Appliquer les prévisions sauvegardées quand elles sont chargées
  useEffect(() => {
    if (savedForecast?.insights_data && !fluxTresorerieData) {
      setFluxTresorerieData(savedForecast.insights_data);
      setInsightsDate(savedForecast.created_at);
    }
  }, [savedForecast, fluxTresorerieData]);

  // Récupérer les données de trésorerie
  const { data: tresorerieData, isLoading } = useQuery({
    queryKey: ["direction-tresorerie-widget"],
    queryFn: async () => {
      const now = new Date();
      const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      
      // Solde réel Qonto (comme la page Trésorerie principale)
      const { data: qontoConnection } = await supabase
        .from("tresorerie_qonto_connections")
        .select("bank_accounts")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      // Calculer le solde depuis les comptes Qonto
      const bankAccounts = qontoConnection?.bank_accounts as Array<{ balance?: number }> | null;
      const soldeActuel = bankAccounts?.reduce((sum, b) => sum + (b.balance || 0), 0) || 0;

      // Revenus - utiliser mois (format DATE) au lieu de date_facture
      const startMonthStr = startMonth.toISOString().slice(0, 10);
      const threeMonthsAgoStr = threeMonthsAgo.toISOString().slice(0, 10);
      
      let { data: revenus } = await supabase
        .from("tresorerie_revenus")
        .select("montant_paye, montant_facture, montant_prevu, mois")
        .gte("mois", startMonthStr);

      // Fallback: si pas de données ce mois, prendre les 3 derniers mois
      let periodeRevenus = "ce mois";
      if (!revenus || revenus.length === 0) {
        const { data: revenusFallback } = await supabase
          .from("tresorerie_revenus")
          .select("montant_paye, montant_facture, montant_prevu, mois")
          .gte("mois", threeMonthsAgoStr)
          .order("mois", { ascending: false });
        revenus = revenusFallback;
        periodeRevenus = "3 derniers mois";
      }

      // Dépenses - utiliser date_prevue
      let { data: depenses } = await supabase
        .from("tresorerie_depenses")
        .select("montant, date_prevue")
        .gte("date_prevue", startMonthStr);

      // Fallback: si pas de données ce mois
      let periodeDepenses = "ce mois";
      if (!depenses || depenses.length === 0) {
        const { data: depensesFallback } = await supabase
          .from("tresorerie_depenses")
          .select("montant, date_prevue")
          .gte("date_prevue", threeMonthsAgoStr)
          .order("date_prevue", { ascending: false });
        depenses = depensesFallback;
        periodeDepenses = "3 derniers mois";
      }

      // Factures impayées - statuts en attente avec date passée
      const { data: impayees } = await supabase
        .from("tresorerie_revenus")
        .select("montant_prevu, montant_facture, date_prevue")
        .in("statut", ["en_attente", "a_relancer", "a_facturer"])
        .lt("date_prevue", now.toISOString());

      // Calculer les totaux avec fallback sur montant_prevu
      const totalRevenus = revenus?.reduce((acc, r) => 
        acc + (r.montant_paye || r.montant_facture || r.montant_prevu || 0), 0
      ) || 0;
      const totalDepenses = depenses?.reduce((acc, d) => acc + (d.montant || 0), 0) || 0;
      const totalImpayees = impayees?.reduce((acc, i) => acc + (i.montant_facture || i.montant_prevu || 0), 0) || 0;
      const nbFacturesImpayees = impayees?.length || 0;

      return {
        soldeActuel,
        totalRevenus,
        totalDepenses,
        totalImpayees,
        nbFacturesImpayees,
        balance: totalRevenus - totalDepenses,
        periodeRevenus,
        periodeDepenses,
      };
    },
  });

  const fetchCashflowPrediction = async () => {
    setLoadingPrediction(true);
    try {
      const data = await invokeEdge<any>("predict-cashflow");
    const error = null;

      if (error) throw error;

      setFluxTresorerieData(data);
      setInsightsDate(new Date().toISOString());
      toast.success("Prévisions générées et sauvegardées");
    } catch (error) {
      debug.error("Erreur prévisions:", error);
      toast.error("Impossible de générer les prévisions");
    } finally {
      setLoadingPrediction(false);
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

  const data = tresorerieData || {
    soldeActuel: 0,
    totalRevenus: 0,
    totalDepenses: 0,
    totalImpayees: 0,
    nbFacturesImpayees: 0,
    balance: 0,
    periodeRevenus: "ce mois",
    periodeDepenses: "ce mois",
  };

  const scoreSante = fluxTresorerieData?.resume?.score_sante || 0;
  const recommandation = fluxTresorerieData?.resume?.recommandation || fluxTresorerieData?.resume?.recommandation_principale;

  return (
    <Card className="overflow-hidden border-0 shadow-card hover:shadow-card-hover transition-shadow duration-300">
      {/* Premium accent bar */}
      <div className="h-1.5 bg-gradient-to-r from-primary via-success to-primary-light" />
      
      <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary to-primary-dark text-white shadow-glow-blue">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Trésorerie</CardTitle>
              <CardDescription>Vue synthétique et prévisions IA</CardDescription>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchCashflowPrediction}
            disabled={loadingPrediction}
            className="hover:bg-primary/10 hover:border-primary/30"
            title={insightsDate 
              ? `Dernière analyse : ${formatDistanceToNow(new Date(insightsDate), { addSuffix: true, locale: fr })}` 
              : "Lancer une analyse IA"
            }
          >
            {loadingPrediction ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : fluxTresorerieData ? (
              <RefreshCw className="h-4 w-4 text-primary" />
            ) : (
              <Sparkles className="h-4 w-4 text-accent" />
            )}
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4 pt-4">
        {/* Solde actuel - Premium display */}
        <div className="relative p-5 rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-2 border-primary/20 overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
          <p className="text-sm font-medium text-muted-foreground mb-1">Solde actuel</p>
          <p className="text-3xl sm:text-4xl font-black text-primary tracking-tight">
            {data.soldeActuel.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €
          </p>
        </div>

        {/* KPIs du mois - Enhanced cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-xl border-2 border-success/20 bg-gradient-to-br from-success/5 to-transparent hover:shadow-[0_0_20px_-5px_hsl(var(--success)/0.3)] transition-shadow duration-300">
            <div className="flex items-center gap-2 text-success mb-2">
              <div className="p-1.5 rounded-lg bg-success/10">
                <TrendingUp className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium">Revenus</span>
            </div>
            <p className="text-xl font-bold text-success">
              +{data.totalRevenus.toLocaleString("fr-FR")} €
            </p>
          </div>
          <div className="p-4 rounded-xl border-2 border-destructive/20 bg-gradient-to-br from-destructive/5 to-transparent hover:shadow-[0_0_20px_-5px_hsl(var(--destructive)/0.3)] transition-shadow duration-300">
            <div className="flex items-center gap-2 text-destructive mb-2">
              <div className="p-1.5 rounded-lg bg-destructive/10">
                <TrendingDown className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium">Dépenses</span>
            </div>
            <p className="text-xl font-bold text-destructive">
              -{data.totalDepenses.toLocaleString("fr-FR")} €
            </p>
          </div>
        </div>

        {/* Alertes factures impayées */}
        {data.nbFacturesImpayees > 0 && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-warning/10 to-warning/5 border-2 border-warning/30">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-warning/20">
                <AlertTriangle className="h-4 w-4 text-warning" />
              </div>
              <span className="text-sm font-semibold text-warning">
                {data.nbFacturesImpayees} facture(s) impayée(s)
              </span>
            </div>
            <p className="text-sm text-warning/80 mt-1 ml-8">
              Total : {data.totalImpayees.toLocaleString("fr-FR")} € en retard
            </p>
          </div>
        )}

        {/* Prévisions IA - Premium section */}
        {fluxTresorerieData && (
          <div className="space-y-3 pt-3 border-t-2 border-dashed">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent" />
                Prévisions {fluxTresorerieData.fallback ? 'Auto' : 'IA'}
                {insightsDate && (
                  <span className="text-xs font-normal text-muted-foreground">
                    ({formatDistanceToNow(new Date(insightsDate), { addSuffix: true, locale: fr })})
                  </span>
                )}
              </h4>
              <div className="flex items-center gap-2">
                {fluxTresorerieData.fallback && (
                  <Badge variant="outline" className="text-xs">
                    Automatique
                  </Badge>
                )}
                <Badge
                  className={cn(
                    "font-bold",
                    scoreSante >= 70 ? "bg-success text-success-foreground" : 
                    scoreSante >= 40 ? "bg-warning text-warning-foreground" : 
                    "bg-destructive text-destructive-foreground"
                  )}
                >
                  Climat : {scoreSante}%
                </Badge>
              </div>
            </div>

            <div className="relative h-3 rounded-full overflow-hidden bg-muted">
              <div 
                className={cn(
                  "h-full rounded-full transition-all duration-1000",
                  scoreSante >= 70 ? "bg-gradient-to-r from-success to-primary" : 
                  scoreSante >= 40 ? "bg-gradient-to-r from-warning to-accent" : 
                  "bg-gradient-to-r from-destructive to-warning"
                )}
                style={{ width: `${scoreSante}%` }}
              />
            </div>

            {recommandation && (
              <p className="text-sm text-muted-foreground italic">
                "{recommandation}"
              </p>
            )}

            {/* Mini graphique prévisions */}
            {fluxTresorerieData.previsions?.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {fluxTresorerieData.previsions.slice(0, 3).map((prev, i) => {
                  const solde = prev.solde_prevu ?? prev.solde_fin_mois ?? 0;
                  return (
                    <div
                      key={`prev-${i}-${prev.libelle || prev.mois || 'm'}`}
                      className={cn(
                        "p-3 rounded-xl border-2 text-center transition-all duration-300",
                        solde >= 0 
                          ? "border-success/20 hover:border-success/40 hover:bg-success/5" 
                          : "border-destructive/20 hover:border-destructive/40 hover:bg-destructive/5"
                      )}
                    >
                      <p className="text-xs text-muted-foreground font-medium">{prev.libelle || prev.mois}</p>
                      <p className={cn(
                        "text-lg font-bold mt-1",
                        solde >= 0 ? "text-success" : "text-destructive"
                      )}>
                        {solde.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €
                      </p>
                      {prev.risque && prev.risque !== 'faible' && (
                        <Badge 
                          variant={prev.risque === 'eleve' ? 'destructive' : 'secondary'}
                          className="text-[10px] mt-1"
                        >
                          {prev.risque}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-4 text-sm text-muted-foreground">
                Cliquez sur ✨ pour générer les prévisions
              </div>
            )}

            {/* Alertes IA */}
            {fluxTresorerieData.alertes?.length > 0 && (
              <div className="space-y-2">
                {fluxTresorerieData.alertes.slice(0, 2).map((alerte, i) => {
                  const niveau = alerte.gravite || alerte.niveau || "info";
                  return (
                    <div
                      key={`tresor-alerte-${i}-${niveau}-${(alerte.message || '').slice(0, 20)}`}
                      className={cn(
                        "p-3 rounded-xl text-sm font-medium border-l-4",
                        niveau === "danger" || niveau === "critique"
                          ? "bg-destructive/10 text-destructive border-destructive"
                          : niveau === "warning" || niveau === "attention"
                          ? "bg-warning/10 text-warning border-warning"
                          : "bg-primary/10 text-primary border-primary"
                      )}
                    >
                      {alerte.message}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
});
