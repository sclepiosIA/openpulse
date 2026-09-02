import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RHSalaire } from "@/hooks/hr/useRHSalaires";

interface SalairesHistoryChartProps {
  salaires: RHSalaire[];
}

export function SalairesHistoryChart({ salaires }: SalairesHistoryChartProps) {
  // Préparer les données pour le graphique (12 derniers mois)
  const chartData = salaires
    .slice(0, 12)
    .reverse()
    .map(salaire => ({
      mois: new Date(salaire.mois).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
      brut: salaire.salaire_brut,
      net: salaire.salaire_net,
      primes: salaire.primes || 0,
    }));

  if (chartData.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          Aucune donnée disponible pour le graphique
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Graphique d'évolution des salaires */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Évolution des salaires (12 mois)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="mois" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px'
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="brut" 
                stroke="hsl(var(--primary))" 
                name="Salaire brut"
                strokeWidth={2}
              />
              <Line 
                type="monotone" 
                dataKey="net" 
                stroke="hsl(var(--chart-2))" 
                name="Salaire net"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Graphique des primes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Primes (12 mois)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="mois" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px'
                }}
              />
              <Bar 
                dataKey="primes" 
                fill="hsl(var(--chart-3))" 
                name="Primes (€)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
