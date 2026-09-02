import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { useRHAnalytics } from "@/hooks/hr/useRHAnalytics";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight } from "lucide-react";

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

export function RHChargesBreakdown() {
  const { data: analytics, isLoading } = useRHAnalytics();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Répartition des charges</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!analytics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Répartition des charges</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            Aucune donnée disponible
          </p>
        </CardContent>
      </Card>
    );
  }

  const { chargesDetail } = analytics;
  
  const salaire_net = chargesDetail.totalSalaireBrut - chargesDetail.totalCotisationsSalariales;
  const salaire_brut = chargesDetail.totalSalaireBrut;
  const cout_total = chargesDetail.totalSalaireBrut + chargesDetail.totalCotisationsPatronales;

  const chartData = [
    { name: 'Salaires nets', value: salaire_net },
    { name: 'Cotisations salariales', value: chargesDetail.totalCotisationsSalariales },
    { name: 'Cotisations patronales', value: chargesDetail.totalCotisationsPatronales },
    { name: 'Primes', value: chargesDetail.totalPrimes },
  ].filter(item => item.value > 0);

  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Décomposition des charges</CardTitle>
        <CardDescription>Pyramide complète : net → brut → coût employeur</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Pyramide explicative */}
        <div className="mb-6 space-y-3 text-sm">
          <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
            <span className="font-medium">Salaire net (perçu)</span>
            <span className="font-bold text-green-600">
              {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(salaire_net)}
            </span>
          </div>
          
          <div className="flex items-center justify-center">
            <ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" />
          </div>
          
          <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
            <span className="font-medium">Salaire brut (+ cotisations salariales)</span>
            <span className="font-bold text-blue-600">
              {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(salaire_brut)}
            </span>
          </div>
          
          <div className="flex items-center justify-center">
            <ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" />
          </div>
          
          <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
            <span className="font-medium">Coût total employeur (+ cotisations patronales)</span>
            <span className="font-bold text-purple-600">
              {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(cout_total)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
                formatter={(value: number) => 
                  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)
                }
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>

          <div className="space-y-3">
            {chartData.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-sm font-medium">{item.name}</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold">
                    {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(item.value)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {((item.value / total) * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            ))}
            <div className="pt-3 border-t border-border">
              <div className="flex items-center justify-between font-bold">
                <span>Total</span>
                <span>
                  {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(total)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}