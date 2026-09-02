import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Clock, AlertTriangle, TrendingUp, Calendar } from "lucide-react";
import { useContratsKPIs, useContratAlertes, useContrats } from "@/hooks/contracts/useContrats";
import { format, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";
import { CONTRAT_STATUT_LABELS, CONTRAT_TYPE_LABELS } from "@/types/contrats";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";

const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function ContratsDashboard() {
  const { data: kpis, isLoading: kpisLoading } = useContratsKPIs();
  const { data: alertes } = useContratAlertes({ nonTraiteesOnly: true });
  const { data: contrats } = useContrats();

  // Calcul répartition par statut
  const statutDistribution = contrats?.reduce((acc, c) => {
    acc[c.statut] = (acc[c.statut] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  const statutData = Object.entries(statutDistribution).map(([statut, count]) => ({
    name: CONTRAT_STATUT_LABELS[statut as keyof typeof CONTRAT_STATUT_LABELS] || statut,
    value: count,
  }));

  // Calcul répartition par type
  const typeDistribution = contrats?.reduce((acc, c) => {
    acc[c.type] = (acc[c.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  const typeData = Object.entries(typeDistribution).map(([type, count]) => ({
    name: CONTRAT_TYPE_LABELS[type as keyof typeof CONTRAT_TYPE_LABELS] || type,
    value: count,
  }));

  // Alertes à venir
  const prochainesAlertes = alertes?.slice(0, 5) || [];

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contrats actifs</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis?.totalActifs || 0}</div>
            <p className="text-xs text-muted-foreground">En cours de validité</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CA annuel contracté</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(kpis?.caAnnuelActif || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Montant HT des contrats actifs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En attente signature</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis?.enAttenteSignature || 0}</div>
            <p className="text-xs text-muted-foreground">À faire signer</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expirent sous 30j</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{kpis?.expirantDans30Jours || 0}</div>
            <p className="text-xs text-muted-foreground">Renouvellement à prévoir</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts et alertes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Répartition par statut */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Répartition par statut</CardTitle>
          </CardHeader>
          <CardContent>
            {statutData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={statutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {statutData.map((entry, index) => (
                      // Recharts pose `role="img"` en dur sur chaque secteur
                      // (Sector.js) : sans nom accessible, axe remonte
                      // `svg-img-alt`. Le libellé passe par les props du Cell.
                      <Cell
                        key={`cell-${index}`}
                        aria-label={`${entry.name} : ${entry.value}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                Aucun contrat
              </div>
            )}
          </CardContent>
        </Card>

        {/* Répartition par type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Répartition par type</CardTitle>
          </CardHeader>
          <CardContent>
            {typeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={typeData} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                Aucun contrat
              </div>
            )}
          </CardContent>
        </Card>

        {/* Prochaines alertes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Prochaines échéances
            </CardTitle>
          </CardHeader>
          <CardContent>
            {prochainesAlertes.length > 0 ? (
              <div className="space-y-3">
                {prochainesAlertes.map((alerte) => {
                  const daysUntil = differenceInDays(new Date(alerte.date_alerte), new Date());
                  const isUrgent = daysUntil <= 7;
                  
                  return (
                    <div key={alerte.id} className="flex items-start gap-3 p-2 rounded-lg bg-muted/50">
                      <Calendar className={`h-4 w-4 mt-0.5 ${isUrgent ? 'text-red-500' : 'text-orange-500'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{alerte.titre}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(alerte.date_alerte), 'dd MMM yyyy', { locale: fr })}
                          {daysUntil >= 0 && (
                            <Badge variant={isUrgent ? "destructive" : "secondary"} className="ml-2 text-xs">
                              J-{daysUntil}
                            </Badge>
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center h-[150px] text-muted-foreground text-sm">
                Aucune alerte à venir
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
