import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PageDataState } from "@/components/common/PageDataState";
import { FinancesChartsSection } from "@/components/finances/FinancesChartsSection";
import { useTresorerieKPIs } from "@/hooks/tresorerie/useTresorerieKPIs";
import { useObjectifCASummary } from "@/hooks/billing/useObjectifsCA";
import { useMRRData } from "@/hooks/analytics/useMRRData";
import { useQontoTransactions } from "@/hooks/tresorerie/useQontoTransactions";
import { useTresorerieDepensesParCategorie } from "@/hooks/tresorerie/useTresorerieDepensesParCategorie";
import {
  Wallet, CreditCard, FileSignature, TrendingUp, Package, BarChart3,
  Flame, Sigma, CalendarClock, AlertTriangle, Receipt, Target,
  ChevronRight, CheckCircle2, Repeat, ArrowDownRight, Landmark,
} from "lucide-react";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value || 0);

const QUICK_LINKS = [
  { label: "Trésorerie", description: "Revenus, dépenses, prévisionnel et rapprochement Qonto", path: "/tresorerie", icon: Wallet },
  { label: "Facturation", description: "Factures, devis et suivi des encaissements", path: "/facturation", icon: CreditCard },
  { label: "Contrats", description: "Contrats clients et signatures électroniques", path: "/contrats", icon: FileSignature },
  { label: "Forecasting", description: "Prévisions de ventes et pipeline pondéré", path: "/forecasting", icon: TrendingUp },
  { label: "Catalogue produits", description: "Offres, tarifs et paliers de facturation", path: "/catalogue-produits", icon: Package },
  { label: "Rapports", description: "Analyses et rapports financiers", path: "/rapports", icon: BarChart3 },
];

interface FinancesDashboardProps {
  onNavigateTab?: (tab: string) => void;
}

export function FinancesDashboard({ onNavigateTab }: FinancesDashboardProps) {
  const kpis = useTresorerieKPIs();
  const objectifQ = useObjectifCASummary();
  const mrr = useMRRData();
  const { connection, transactions, isLoading: qontoLoading } = useQontoTransactions({});
  const analyse = useTresorerieDepensesParCategorie();

  const isLoading = kpis.isLoading || objectifQ.isLoading || mrr.isLoading || qontoLoading || analyse.isLoading;
  const isError = objectifQ.isError;

  const currentYear = new Date().getFullYear();
  const yearPrefix = String(currentYear);

  const soldeTresorerie = connection?.bank_accounts?.reduce((sum, b) => sum + (b.balance || 0), 0) || 0;

  // CA annuel (exercice en cours)
  const caExerciceCourant = kpis.caParExercice.find((e) => e.annee === currentYear);
  const caAnnuel = caExerciceCourant?.caComptable ?? 0;
  const caPercu = caExerciceCourant?.caPercu ?? 0;

  // Total coûts annuels (réel + prévu, année en cours)
  const coutsAnnuels = analyse.months
    .filter((m) => m.startsWith(yearPrefix))
    .reduce((sum, m) => sum + (analyse.grandTotal[m] || 0), 0);

  // Résultat net (CA − coûts, année en cours)
  const resultatNet = caAnnuel - coutsAnnuels;

  const clickableCardClass =
    "cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  const cardNavProps = (tab: string) =>
    onNavigateTab
      ? {
          role: "button" as const,
          tabIndex: 0,
          onClick: () => onNavigateTab(tab),
          onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onNavigateTab(tab);
            }
          },
          className: clickableCardClass,
        }
      : {};

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <PageDataState
        isLoading={isLoading}
        isError={isError}
        error={objectifQ.error}
        onRetry={() => {
          kpis.refetch();
          objectifQ.refetch();
        }}
      >
        {/* KPIs clés finance */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <Card {...cardNavProps("tresorerie")}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Solde trésorerie</CardTitle>
              <Landmark className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold break-words">{formatCurrency(soldeTresorerie)}</p>
              <p className="text-xs text-muted-foreground mt-1">Comptes Qonto agrégés</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">MRR</CardTitle>
              <Repeat className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold break-words">{formatCurrency(mrr.currentMRR)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                ARR : {formatCurrency(mrr.arr)} · {mrr.payingClients} client{mrr.payingClients > 1 ? "s" : ""} payant{mrr.payingClients > 1 ? "s" : ""}
              </p>
            </CardContent>
          </Card>

          <Card {...cardNavProps("revenus")}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">CA {currentYear}</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold break-words">{formatCurrency(caAnnuel)}</p>
              <p className="text-xs text-muted-foreground mt-1">Perçu : {formatCurrency(caPercu)}</p>
            </CardContent>
          </Card>

          <Card {...cardNavProps("depenses")}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Coûts {currentYear}</CardTitle>
              <ArrowDownRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold break-words">{formatCurrency(coutsAnnuels)}</p>
              <p className="text-xs text-muted-foreground mt-1">Réel + prévu sur l'année</p>
            </CardContent>
          </Card>
        </div>

        {/* KPIs secondaires */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Projection fin {currentYear}</CardTitle>
              <CalendarClock className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold break-words">{formatCurrency(kpis.projectionFinAnnee)}</p>
              {kpis.prochainTrouTresorerie ? (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  Trou prévu {kpis.prochainTrouTresorerie.mois} ({formatCurrency(kpis.prochainTrouTresorerie.solde)})
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 shrink-0" />
                  Aucun trou de trésorerie prévu
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Cashburn moyen / mois</CardTitle>
              <Flame className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold break-words">{formatCurrency(kpis.cashburnMoyen6MoisPasses)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Projeté 6 mois : {formatCurrency(kpis.cashburnMoyenProjete6Mois)}/mois
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Factures en attente</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold break-words">{formatCurrency(kpis.facturesEnAttente.montant)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {kpis.facturesEnAttente.count} facture{kpis.facturesEnAttente.count > 1 ? "s" : ""} à encaisser
              </p>
            </CardContent>
          </Card>

          <Card {...cardNavProps("pnl")}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Résultat net {currentYear}</CardTitle>
              <Sigma className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold break-words ${resultatNet < 0 ? "text-destructive" : ""}`}>
                {formatCurrency(resultatNet)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">CA − coûts (réel + prévu)</p>
            </CardContent>
          </Card>
        </div>

        {/* Graphiques 12 derniers mois */}
        <FinancesChartsSection
          transactions={transactions}
          soldeActuel={soldeTresorerie}
          hasQonto={!!connection?.is_active || (connection?.bank_accounts?.length || 0) > 0}
          months={analyse.months}
          caParMois={analyse.revenueGrandTotal}
          coutsParMois={analyse.grandTotal}
        />

        {/* Objectif CA + CA par exercice */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                Objectif CA {currentYear}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {objectifQ.data ? (
                <>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-2xl font-bold">{formatCurrency(objectifQ.data.realise)}</span>
                    <span className="text-sm text-muted-foreground">sur {formatCurrency(objectifQ.data.cible)}</span>
                  </div>
                  <Progress value={objectifQ.data.progression} className="h-2" />
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{objectifQ.data.progression}% atteint</span>
                    <span>Reste à faire : {formatCurrency(objectifQ.data.resteAFaire)}</span>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Aucun objectif défini pour {currentYear}.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                CA par exercice
              </CardTitle>
            </CardHeader>
            <CardContent>
              {kpis.caParExercice.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun exercice comptabilisé pour le moment.</p>
              ) : (
                <div className="space-y-2">
                  {kpis.caParExercice.map((ex) => (
                    <div key={ex.annee} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2.5">
                      <span className="font-medium text-sm">{ex.annee}</span>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                        <span className="text-muted-foreground">
                          Comptable : <span className="font-medium text-foreground">{formatCurrency(ex.caComptable)}</span>
                        </span>
                        <span className="text-muted-foreground">
                          Perçu : <span className="font-medium text-foreground">{formatCurrency(ex.caPercu)}</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Accès rapides */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Modules financiers
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {QUICK_LINKS.map((link) => (
              <Link key={link.path} to={link.path} className="group">
                <Card className="h-full transition-colors hover:border-primary/50 hover:bg-muted/40">
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className="rounded-md bg-primary/10 p-2 shrink-0">
                      <link.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm flex items-center gap-1">
                        {link.label}
                        <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{link.description}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </PageDataState>
    </div>
  );
}
