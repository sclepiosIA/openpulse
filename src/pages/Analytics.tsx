/**
 * Page Analytics - Module 9: Prédiction & Analytics Avancés
 */

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  TrendingDown,
  AlertTriangle,
  BarChart3,
  FileText,
  Bell,
  ArrowUpRight,
  Building2
} from 'lucide-react';
import {
  useChurnPredictions,
  useClientSegments,
  useUpsellRecommendations,
  useCAForecasts,
  useProactiveAlerts,
  useRegulatoryReports,
  useAnalyticsKPIs,
  useUpdateAlertStatus,
  useUpdateUpsellStatus
} from '@/hooks/analytics/useAnalytics';
import type { RiskLevel, AlertSeverity } from '@/types/analytics';
import { PageDataState } from '@/components/common/PageDataState';

const riskColors: Record<RiskLevel, string> = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800'
};

const severityColors: Record<AlertSeverity, string> = {
  low: 'bg-blue-100 text-blue-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800'
};

export default function Analytics() {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const { data: kpis, isLoading: kpisLoading, isError: kpisError, refetch: refetchKpis } = useAnalyticsKPIs();
  const { data: churnPredictions } = useChurnPredictions();
  const { data: segments } = useClientSegments();
  const { data: upsells } = useUpsellRecommendations('pending');
  const { data: alerts } = useProactiveAlerts('active');
  const { data: forecasts } = useCAForecasts('monthly');
  const { data: reports } = useRegulatoryReports();
  
  const updateAlertStatus = useUpdateAlertStatus();
  const updateUpsellStatus = useUpdateUpsellStatus();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics & Prédictions</h1>
          <p className="text-muted-foreground">Intelligence artificielle et analyses prédictives</p>
        </div>
      </div>

      <PageDataState isLoading={kpisLoading && !kpis} isError={kpisError} onRetry={() => refetchKpis()}>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="dashboard">Tableau de bord</TabsTrigger>
          <TabsTrigger value="churn">Churn</TabsTrigger>
          <TabsTrigger value="segments">Segments</TabsTrigger>
          <TabsTrigger value="upsell">Upsell</TabsTrigger>
          <TabsTrigger value="alerts">Alertes</TabsTrigger>
          <TabsTrigger value="reports">Rapports</TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Score Churn Moyen</CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpis?.average_churn_score || 0}%</div>
                <Progress value={kpis?.average_churn_score || 0} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Alertes Actives</CardTitle>
                <Bell className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpis?.active_alerts || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {kpis?.high_risk_count || 0} clients à risque élevé
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Potentiel Upsell</CardTitle>
                <ArrowUpRight className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(kpis?.upsell_potential || 0)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {kpis?.pending_upsells || 0} opportunités en attente
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">CA Prévisionnel</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(kpis?.forecasted_ca || 0)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Réalisé: {formatCurrency(kpis?.realized_ca || 0)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Risk Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Distribution des Risques</CardTitle>
                <CardDescription>Répartition des clients par niveau de risque churn</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      <span>Risque faible</span>
                    </div>
                    <span className="font-medium">{kpis?.low_risk_count || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-yellow-500" />
                      <span>Risque moyen</span>
                    </div>
                    <span className="font-medium">{kpis?.medium_risk_count || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <span>Risque élevé</span>
                    </div>
                    <span className="font-medium">{kpis?.high_risk_count || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Alertes Récentes</CardTitle>
                <CardDescription>Dernières alertes proactives détectées</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-3">
                    {alerts?.slice(0, 5).map((alert) => (
                      <div key={alert.id} className="flex items-center justify-between p-2 border rounded-lg">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className={`h-4 w-4 ${
                            alert.severite === 'critical' ? 'text-red-500' :
                            alert.severite === 'high' ? 'text-orange-500' :
                            'text-yellow-500'
                          }`} />
                          <div>
                            <p className="text-sm font-medium">{alert.titre}</p>
                            <p className="text-xs text-muted-foreground">{alert.etablissement?.nom}</p>
                          </div>
                        </div>
                        <Badge className={severityColors[alert.severite]}>{alert.severite}</Badge>
                      </div>
                    ))}
                    {(!alerts || alerts.length === 0) && (
                      <p className="text-sm text-muted-foreground text-center py-4">Aucune alerte active</p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Churn Tab */}
        <TabsContent value="churn" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Prédictions de Churn</CardTitle>
              <CardDescription>Analyse prédictive du risque de désabonnement</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-4">
                  {churnPredictions?.map((prediction) => (
                    <div key={prediction.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Building2 className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{prediction.etablissement?.nom}</p>
                            <p className="text-sm text-muted-foreground">
                              Prédit le {new Date(prediction.predicted_at).toLocaleDateString('fr-FR')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={riskColors[prediction.risk_level]}>
                            {prediction.risk_level}
                          </Badge>
                          <div className="text-2xl font-bold">{prediction.score}%</div>
                        </div>
                      </div>
                      <Progress value={prediction.score} className="mb-3" />
                      {prediction.factors && prediction.factors.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Facteurs de risque:</p>
                          <div className="flex flex-wrap gap-2">
                            {prediction.factors.map((factor, idx) => (
                              <Badge key={idx} variant="outline">{factor.factor}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {(!churnPredictions || churnPredictions.length === 0) && (
                    <p className="text-center text-muted-foreground py-8">Aucune prédiction disponible</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Segments Tab */}
        <TabsContent value="segments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Segments Clients</CardTitle>
              <CardDescription>Segmentation automatique basée sur le comportement</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {segments?.map((segment) => (
                  <Card key={segment.id} className="border-2" style={{ borderColor: segment.couleur }}>
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: segment.couleur }} />
                        <CardTitle className="text-lg">{segment.nom}</CardTitle>
                      </div>
                      <CardDescription>{segment.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Établissements</span>
                        <Badge variant="secondary">{segment.etablissements_count || 0}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {(!segments || segments.length === 0) && (
                  <p className="col-span-full text-center text-muted-foreground py-8">Aucun segment créé</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Upsell Tab */}
        <TabsContent value="upsell" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Opportunités Upsell</CardTitle>
              <CardDescription>Recommandations de ventes additionnelles basées sur l'usage</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-4">
                  {upsells?.map((upsell) => (
                    <div key={upsell.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-medium">{upsell.etablissement?.nom}</p>
                          <p className="text-lg font-semibold text-primary">{upsell.produit_recommande}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-green-600">
                            {upsell.montant_estime ? formatCurrency(upsell.montant_estime) : '-'}
                          </p>
                          <p className="text-sm text-muted-foreground">Confiance: {upsell.score_confiance}%</p>
                        </div>
                      </div>
                      {upsell.raison && (
                        <p className="text-sm text-muted-foreground mb-3">{upsell.raison}</p>
                      )}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => updateUpsellStatus.mutate({ id: upsell.id, statut: 'contacted' })}
                        >
                          Contacter
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateUpsellStatus.mutate({ id: upsell.id, statut: 'rejected' })}
                        >
                          Ignorer
                        </Button>
                      </div>
                    </div>
                  ))}
                  {(!upsells || upsells.length === 0) && (
                    <p className="text-center text-muted-foreground py-8">Aucune opportunité en attente</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Alertes Proactives</CardTitle>
              <CardDescription>Détection automatique des anomalies et risques</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-4">
                  {alerts?.map((alert) => (
                    <div key={alert.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className={`h-5 w-5 ${
                            alert.severite === 'critical' ? 'text-red-500' :
                            alert.severite === 'high' ? 'text-orange-500' :
                            alert.severite === 'medium' ? 'text-yellow-500' :
                            'text-blue-500'
                          }`} />
                          <p className="font-medium">{alert.titre}</p>
                        </div>
                        <Badge className={severityColors[alert.severite]}>{alert.severite}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{alert.description}</p>
                      {alert.etablissement && (
                        <p className="text-sm mb-3">
                          <span className="text-muted-foreground">Établissement: </span>
                          <span className="font-medium">{alert.etablissement.nom}</span>
                        </p>
                      )}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateAlertStatus.mutate({ id: alert.id, statut: 'acknowledged' })}
                        >
                          Prendre en charge
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => updateAlertStatus.mutate({ id: alert.id, statut: 'resolved' })}
                        >
                          Résoudre
                        </Button>
                      </div>
                    </div>
                  ))}
                  {(!alerts || alerts.length === 0) && (
                    <p className="text-center text-muted-foreground py-8">Aucune alerte active</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Rapports Réglementaires</CardTitle>
              <CardDescription>Génération de rapports pour les tutelles santé</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-4">
                  {reports?.map((report) => (
                    <div key={report.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{report.titre}</p>
                            <p className="text-sm text-muted-foreground">
                              {report.type_rapport.toUpperCase()} - Du {new Date(report.periode_debut).toLocaleDateString('fr-FR')} au {new Date(report.periode_fin).toLocaleDateString('fr-FR')}
                            </p>
                          </div>
                        </div>
                        <Badge variant={
                          report.statut === 'submitted' ? 'default' :
                          report.statut === 'approved' ? 'secondary' :
                          'outline'
                        }>
                          {report.statut}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {(!reports || reports.length === 0) && (
                    <p className="text-center text-muted-foreground py-8">Aucun rapport créé</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </PageDataState>
    </div>
  );
}
