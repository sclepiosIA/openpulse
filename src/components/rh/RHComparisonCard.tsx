import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRHComparisons } from "@/hooks/hr/useRHComparisons";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface RHComparisonCardProps {
  type?: 'month' | 'quarter' | 'year';
}

export function RHComparisonCard({ type = 'month' }: RHComparisonCardProps) {
  const { data: comparison, isLoading } = useRHComparisons(type);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Comparaison</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!comparison) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Comparaison</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            Aucune donnée disponible
          </p>
        </CardContent>
      </Card>
    );
  }

  const getTrendIcon = (percentage: number) => {
    if (percentage > 0) return <TrendingUp className="w-4 h-4" />;
    if (percentage < 0) return <TrendingDown className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
  };

  const getTrendColor = (percentage: number) => {
    if (percentage > 0) return "text-green-600";
    if (percentage < 0) return "text-red-600";
    return "text-muted-foreground";
  };

  const typeLabel = type === 'month' ? 'Mois vs Mois précédent' : type === 'quarter' ? 'Trimestre vs Trimestre précédent' : 'Année vs Année précédente';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comparaison</CardTitle>
        <CardDescription>{typeLabel}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Masse salariale */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Masse salariale</span>
              <Badge variant="outline" className={getTrendColor(comparison.delta.masseSalariale.percentage)}>
                {getTrendIcon(comparison.delta.masseSalariale.percentage)}
                <span className="ml-1">{Math.abs(comparison.delta.masseSalariale.percentage).toFixed(1)}%</span>
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <div className="text-muted-foreground">{comparison.current.periode}</div>
                <div className="font-semibold">
                  {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(comparison.current.masseSalariale)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">{comparison.previous.periode}</div>
                <div className="font-semibold">
                  {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(comparison.previous.masseSalariale)}
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Effectif */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Effectif</span>
              <Badge variant="outline" className={getTrendColor(comparison.delta.effectif.percentage)}>
                {getTrendIcon(comparison.delta.effectif.percentage)}
                <span className="ml-1">{Math.abs(comparison.delta.effectif.percentage).toFixed(1)}%</span>
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <div className="text-muted-foreground">{comparison.current.periode}</div>
                <div className="font-semibold">{comparison.current.effectif} employés</div>
              </div>
              <div>
                <div className="text-muted-foreground">{comparison.previous.periode}</div>
                <div className="font-semibold">{comparison.previous.effectif} employés</div>
              </div>
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Coût moyen */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Coût moyen / employé</span>
              <Badge variant="outline" className={getTrendColor(comparison.delta.coutMoyen.percentage)}>
                {getTrendIcon(comparison.delta.coutMoyen.percentage)}
                <span className="ml-1">{Math.abs(comparison.delta.coutMoyen.percentage).toFixed(1)}%</span>
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <div className="text-muted-foreground">{comparison.current.periode}</div>
                <div className="font-semibold">
                  {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(comparison.current.coutMoyen)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">{comparison.previous.periode}</div>
                <div className="font-semibold">
                  {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(comparison.previous.coutMoyen)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}