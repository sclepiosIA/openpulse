import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line, CartesianGrid } from "recharts";
import { Partenaire } from "@/hooks/crm/usePartenaires";
import { ChartContainer } from "@/components/ui/chart";
import { Users, Activity, DollarSign, Target, AlertCircle, Sparkles, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface PartenairesStatsPanelProps {
  partenaires: Partenaire[];
  previousMonthCount?: number;
}

export function PartenairesStatsPanel({ partenaires, previousMonthCount }: PartenairesStatsPanelProps) {
  const now = new Date();
  
  // KPIs calculations
  const total = partenaires.length;
  const actifs = partenaires.filter(p => p.statut_relation === 'actif').length;
  const valeurTotale = partenaires.reduce((sum, p) => sum + (p.valeur_partenariat || 0), 0);
  const scoreEngagementMoyen = total > 0 
    ? Math.round(partenaires.reduce((sum, p) => sum + (p.engagement_score || 0), 0) / total)
    : 0;
  
  const aRelancer = partenaires.filter(p => {
    const dernier = p.dernier_contact ? new Date(p.dernier_contact) : null;
    const prochaine = p.prochaine_action ? new Date(p.prochaine_action) : null;
    const contactOld = dernier ? (now.getTime() - dernier.getTime()) / (1000 * 60 * 60 * 24) > 60 : false;
    const actionPassed = prochaine ? prochaine < now : false;
    return contactOld || actionPassed;
  }).length;

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const nouveauxCeMois = partenaires.filter(p => new Date(p.created_at) >= startOfMonth).length;

  const evolution = previousMonthCount !== undefined 
    ? ((total - previousMonthCount) / (previousMonthCount || 1)) * 100
    : null;

  const getTrendIcon = () => {
    if (evolution === null) return <Minus className="h-4 w-4" />;
    if (evolution > 0) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (evolution < 0) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4" />;
  };

  // Chart data
  const typeData = [
    { name: 'Institutionnel', value: partenaires.filter(p => p.type_partenaire === 'institutionnel').length, color: 'hsl(var(--chart-1))' },
    { name: 'Industriel', value: partenaires.filter(p => p.type_partenaire === 'industriel').length, color: 'hsl(var(--chart-2))' },
    { name: 'Prestataire', value: partenaires.filter(p => p.type_partenaire === 'prestataire').length, color: 'hsl(var(--chart-3))' },
  ].filter(d => d.value > 0);

  const statutData = [
    { name: 'Actif', value: partenaires.filter(p => p.statut_relation === 'actif').length },
    { name: 'Prospect', value: partenaires.filter(p => p.statut_relation === 'prospect').length },
    { name: 'Inactif', value: partenaires.filter(p => p.statut_relation === 'inactif').length },
    { name: 'Terminé', value: partenaires.filter(p => p.statut_relation === 'termine').length },
  ].filter(d => d.value > 0);

  const regionCounts = partenaires.reduce((acc, p) => {
    if (p.region) {
      acc[p.region] = (acc[p.region] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const regionData = Object.entries(regionCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const monthlyData = [];
  for (let i = 5; i >= 0; i--) {
    const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    const count = partenaires.filter(p => {
      const created = new Date(p.created_at);
      return created >= month && created <= monthEnd;
    }).length;
    monthlyData.push({
      name: month.toLocaleDateString('fr-FR', { month: 'short' }),
      value: count,
    });
  }

  const kpis = [
    {
      title: "Total",
      value: total,
      icon: Users,
      description: evolution !== null ? `${evolution > 0 ? '+' : ''}${evolution.toFixed(1)}%` : undefined,
      trend: getTrendIcon(),
      color: "text-blue-600"
    },
    {
      title: "Actifs",
      value: actifs,
      icon: Activity,
      badge: `${total > 0 ? Math.round((actifs / total) * 100) : 0}%`,
      color: "text-green-600"
    },
    {
      title: "Valeur",
      value: valeurTotale > 0 ? `${(valeurTotale / 1000).toFixed(0)}k€` : '0€',
      icon: DollarSign,
      color: "text-purple-600"
    },
    {
      title: "Engagement",
      value: `${scoreEngagementMoyen}%`,
      icon: Target,
      color: "text-indigo-600"
    },
    {
      title: "À relancer",
      value: aRelancer,
      icon: AlertCircle,
      badge: aRelancer > 0 ? 'Action' : undefined,
      color: "text-orange-600"
    },
    {
      title: "Nouveaux",
      value: nouveauxCeMois,
      icon: Sparkles,
      color: "text-cyan-600"
    },
  ];

  return (
    <div className="space-y-4">
      {/* KPIs compacts */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.title} className="hover:shadow-md transition-shadow">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <Icon className={`h-4 w-4 ${kpi.color}`} />
                  {kpi.trend && <div>{kpi.trend}</div>}
                </div>
                <div className="text-xl font-bold">{kpi.value}</div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{kpi.title}</p>
                  {kpi.badge && (
                    <Badge variant="secondary" className="text-xs h-5 px-1.5">
                      {kpi.badge}
                    </Badge>
                  )}
                  {kpi.description && (
                    <span className="text-xs text-muted-foreground">{kpi.description}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Graphiques détaillés dans Accordion */}
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="stats">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold">📊 Statistiques détaillées</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
              {/* Répartition par type */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Répartition par type</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={{}} className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={typeData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={60}
                          fill="hsl(var(--primary))"
                          dataKey="value"
                        >
                          {typeData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>

              {/* Répartition par statut */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Répartition par statut</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={{}} className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={statutData}>
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="value" fill="hsl(var(--primary))" />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>

              {/* Top 5 régions */}
              {regionData.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Top 5 régions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer config={{}} className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={regionData} layout="vertical">
                          <XAxis type="number" tick={{ fontSize: 11 }} />
                          <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={80} />
                          <Tooltip />
                          <Bar dataKey="value" fill="hsl(var(--chart-2))" />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  </CardContent>
                </Card>
              )}

              {/* Timeline nouveaux partenaires */}
              <Card className="lg:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Nouveaux partenaires (6 mois)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={{}} className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>

              {/* Score d'engagement moyen */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Score d'engagement</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center h-[200px]">
                  <div className="text-center">
                    <div className="text-5xl font-bold text-primary mb-2">{scoreEngagementMoyen}%</div>
                    <p className="text-sm text-muted-foreground">Engagement moyen</p>
                    <div className="w-32 bg-muted rounded-full h-3 mt-3 mx-auto">
                      <div 
                        className="bg-primary h-3 rounded-full transition-all" 
                        style={{ width: `${scoreEngagementMoyen}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
