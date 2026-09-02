import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTresorerieKPIs } from "@/hooks/tresorerie/useTresorerieKPIs";
import {
  Flame,
  Receipt,
  TrendingUp,
  AlertTriangle,
  PieChart,
  Landmark,
} from "lucide-react";
import { cn } from "@/lib/utils";

const formatMontant = (value: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);

const formatCompact = (value: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

export function PrevisionnelResume() {
  const kpis = useTresorerieKPIs();

  if (kpis.isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={`previsionnel-resume-kpi-skeleton-${i}`}>
              <CardContent className="pt-6">
                <Skeleton className="h-20" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(2)].map((_, i) => (
            <Card key={`previsionnel-resume-chart-skeleton-${i}`}>
              <CardContent className="pt-6">
                <Skeleton className="h-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const currentYear = new Date().getFullYear();

  return (
    <div className="space-y-6">
      {/* Section 1: Cashburn */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
          <Flame className="h-4 w-4 text-destructive" />
          Cashburn mensuel
        </h3>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
          <KPICard
            label="Cashburn moyen (6 mois passés)"
            value={formatMontant(-kpis.cashburnMoyen6MoisPasses)}
            subtitle="Sur les 6 derniers mois réels"
            variant="destructive"
          />
          <KPICard
            label="Cashburn projeté (6 mois)"
            value={formatMontant(-kpis.cashburnMoyenProjete6Mois)}
            subtitle="Projeté sur les 6 prochains mois"
            variant="warning"
          />
          <KPICard
            label="Salaires uniquement"
            value={formatMontant(-kpis.cashburnSalairesUniquement)}
            subtitle="Masse salariale mensuelle moyenne"
            variant="muted"
          />
        </div>
      </div>

      {/* Section 2: Chiffre d'affaires par exercice */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-success" />
          Chiffre d'affaires par exercice
        </h3>
        <Card>
          <CardContent className="pt-6">
            {kpis.caParExercice.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Exercice</TableHead>
                      <TableHead className="text-right">CA Comptable</TableHead>
                      <TableHead className="text-right">CA Perçu (recettes)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {kpis.caParExercice.map((ex) => (
                      <TableRow
                        key={ex.annee}
                        className={cn(
                          ex.annee === currentYear && "bg-muted/50 font-semibold"
                        )}
                      >
                        <TableCell className="font-medium">{ex.annee}</TableCell>
                        <TableCell className="text-right">
                          {formatMontant(ex.caComptable)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMontant(ex.caPercu)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucun revenu enregistré</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Section 3: Factures en attente + Fonds propres */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <Receipt className="h-4 w-4 text-accent-foreground" />
            Factures en attente
          </h3>
          <Card className="h-full">
            <CardContent className="pt-6">
              <p className="text-3xl font-bold text-foreground">
                {kpis.facturesEnAttente.count}
                <span className="text-lg font-normal text-muted-foreground ml-2">factures</span>
              </p>
              <p className="text-lg font-semibold text-accent-foreground mt-1">
                {formatMontant(kpis.facturesEnAttente.montant)} à encaisser
              </p>
            </CardContent>
          </Card>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <Landmark className="h-4 w-4" />
            Fonds propres
          </h3>
          <Card className="h-full">
            <CardContent className="pt-6">
              <div className="flex flex-col gap-2">
                <div>
                  <p className="text-sm text-muted-foreground">Actuels (solde Qonto)</p>
                  <p className={cn(
                    "text-2xl font-bold",
                    kpis.fondsPropreActuels >= 0 ? "text-foreground" : "text-destructive"
                  )}>
                    {formatMontant(kpis.fondsPropreActuels)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Projection fin {currentYear}</p>
                  <p className={cn(
                    "text-2xl font-bold",
                    kpis.projectionFinAnnee >= 0 ? "text-success" : "text-destructive"
                  )}>
                    {formatMontant(kpis.projectionFinAnnee)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Section 4: Alerte trésorerie (conditionnelle) */}
      {kpis.prochainTrouTresorerie && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-destructive">
              Prochain trou de trésorerie prévu
            </p>
            <p className="text-sm text-muted-foreground">
              Solde négatif prévu en{" "}
              <span className="font-semibold text-destructive">
                {kpis.prochainTrouTresorerie.mois}
              </span>{" "}
              ({formatMontant(kpis.prochainTrouTresorerie.solde)})
            </p>
          </div>
        </div>
      )}

      {/* Section 5: Pipeline commercial */}
      {kpis.pipelineNiveaux.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <PieChart className="h-4 w-4" />
            Pipeline commercial
          </h3>
          <Card>
            <CardContent className="pt-6">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Niveau</TableHead>
                      <TableHead className="text-center">Établ.</TableHead>
                      <TableHead className="text-center">Probabilité</TableHead>
                      <TableHead className="text-right">MRR</TableHead>
                      <TableHead className="text-right">ARR</TableHead>
                      <TableHead className="text-right">ARR pondéré</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {kpis.pipelineNiveaux.map((niveau) => (
                      <TableRow key={niveau.label}>
                        <TableCell className="font-medium">{niveau.label}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{niveau.count}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Progress
                              value={niveau.probabilite * 100}
                              className="h-2 w-16"
                            />
                            <span className="text-xs text-muted-foreground w-10 text-right">
                              {(niveau.probabilite * 100).toFixed(0)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCompact(niveau.montantMensuel)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCompact(niveau.montantAnnuel)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCompact(niveau.montantAnnuel * niveau.probabilite)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Total row */}
                    <TableRow className="border-t-2">
                      <TableCell className="font-bold">Total</TableCell>
                      <TableCell className="text-center font-bold">
                        {kpis.pipelineNiveaux.reduce((s, n) => s + n.count, 0)}
                      </TableCell>
                      <TableCell />
                      <TableCell className="text-right font-bold">
                        {formatCompact(
                          kpis.pipelineNiveaux.reduce((s, n) => s + n.montantMensuel, 0)
                        )}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCompact(
                          kpis.pipelineNiveaux.reduce((s, n) => s + n.montantAnnuel, 0)
                        )}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCompact(
                          kpis.pipelineNiveaux.reduce(
                            (s, n) => s + n.montantAnnuel * n.probabilite,
                            0
                          )
                        )}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// --- Sub-component for Cashburn KPI cards ---

function KPICard({
  label,
  value,
  subtitle,
  variant,
}: {
  label: string;
  value: string;
  subtitle: string;
  variant: "destructive" | "warning" | "muted";
}) {
  const colorMap = {
    destructive: "text-destructive",
    warning: "text-accent-foreground",
    muted: "text-muted-foreground",
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </p>
        <p className={cn("text-2xl font-bold mt-1", colorMap[variant])}>
          {value}
        </p>
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      </CardContent>
    </Card>
  );
}
