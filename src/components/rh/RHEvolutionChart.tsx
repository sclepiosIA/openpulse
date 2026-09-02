import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useRHAnalytics } from "@/hooks/hr/useRHAnalytics";
import { Skeleton } from "@/components/ui/skeleton";

export function RHEvolutionChart() {
  const { data: analytics, isLoading } = useRHAnalytics(12);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Évolution sur 12 mois</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!analytics || analytics.evolutionMensuelle.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Évolution sur 12 mois</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            Aucune donnée disponible
          </p>
        </CardContent>
      </Card>
    );
  }

  const formatMois = (mois: string) => {
    const [year, month] = mois.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
  };

  const chartData = analytics.evolutionMensuelle.map(item => ({
    mois: formatMois(item.mois),
    'Masse salariale': Math.round(item.masseSalariale),
    'Effectif': item.effectif,
    'Coût moyen': Math.round(item.coutMoyen),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Évolution sur 12 mois</CardTitle>
        <CardDescription>Masse salariale, effectif et coût moyen par employé</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="mois" 
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis 
              yAxisId="left"
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis 
              yAxisId="right" 
              orientation="right"
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px'
              }}
              formatter={(value: any, name: string) => {
                if (name === 'Effectif') return [value, name];
                return [new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value), name];
              }}
            />
            <Legend />
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey="Masse salariale" 
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              dot={{ r: 4 }}
            />
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="Effectif" 
              stroke="hsl(var(--chart-2))" 
              strokeWidth={2}
              dot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}