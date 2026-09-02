import React, { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Heart, Loader2 } from "lucide-react";
import { usePortfolioHealth } from "@/hooks/dashboard/usePortfolioHealth";

interface EtablissementMinimal {
  id: string;
  statut: string;
}

interface PortfolioHealthCardProps {
  etablissements: EtablissementMinimal[];
}

function PortfolioHealthCardComponent({ etablissements }: PortfolioHealthCardProps) {
  const productionEtabs = etablissements.filter(e => e.statut === 'Production');
  const etabIds = productionEtabs.map(e => e.id);

  const { data: metrics, isLoading } = usePortfolioHealth(etabIds, productionEtabs.length);

  const total = productionEtabs.length;
  const satisfaitsPct = total > 0 ? Math.round((metrics?.satisfaits || 0) / total * 100) : 0;
  const aSurveillerPct = total > 0 ? Math.round((metrics?.aSurveiller || 0) / total * 100) : 0;
  const aRisquePct = total > 0 ? Math.round((metrics?.aRisque || 0) / total * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="h-5 w-5" />
          Santé du portefeuille
          {metrics?.totalAvecMetriques !== undefined && metrics.totalAvecMetriques > 0 && (
            <span className="text-xs font-normal text-muted-foreground ml-2">
              ({metrics.totalAvecMetriques}/{total} avec métriques)
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : total === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Aucun client en production
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{satisfaitsPct}%</div>
              <p className="text-sm text-muted-foreground">Clients satisfaits</p>
              <p className="text-xs text-muted-foreground mt-1">{metrics?.satisfaits || 0} établissements</p>
              <Progress value={satisfaitsPct} className="mt-2 h-2" />
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600">{aSurveillerPct}%</div>
              <p className="text-sm text-muted-foreground">À surveiller</p>
              <p className="text-xs text-muted-foreground mt-1">{metrics?.aSurveiller || 0} établissements</p>
              <Progress value={aSurveillerPct} className="mt-2 h-2 [&>div]:bg-orange-500" />
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600">{aRisquePct}%</div>
              <p className="text-sm text-muted-foreground">À risque</p>
              <p className="text-xs text-muted-foreground mt-1">{metrics?.aRisque || 0} établissements</p>
              <Progress value={aRisquePct} className="mt-2 h-2 [&>div]:bg-red-500" />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export const PortfolioHealthCard = memo(PortfolioHealthCardComponent);
