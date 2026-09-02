import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from
'@/components/ui/dialog';
import { TrendingUp, Users, MessageSquare, Ticket, Calendar, Edit, Plus, Activity } from 'lucide-react';
import { CustomerHealthIndicator } from '@/components/production/CustomerHealthIndicator';
import { CustomerHealthMetricsEditor } from './CustomerHealthMetricsEditor';
import { useCustomerHealthMetrics } from '@/hooks/crm/useCustomerHealthMetrics';
import { useCustomerHealth } from '@/hooks/crm/useCustomerHealth';
import type { Etablissement } from '@/hooks/crm/useEtablissements';

interface CustomerHealthDashboardProps {
  etablissement: Etablissement;
}

export function CustomerHealthDashboard({ etablissement }: CustomerHealthDashboardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: metrics, isLoading } = useCustomerHealthMetrics(etablissement.id);

  // Calculer health score depuis les métriques
  const healthMetricsMap = useMemo(() => {
    if (!metrics) return new Map();
    const map = new Map();
    map.set(etablissement.id, metrics);
    return map;
  }, [metrics, etablissement.id]);

  const healthScores = useCustomerHealth([etablissement], healthMetricsMap);
  const health = healthScores.get(etablissement.id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-muted-foreground">Chargement des métriques...</div>
      </div>);

  }

  if (!metrics) {
    return (
      <Card>
        <CardContent className="p-6 space-y-4">
          <p className="text-muted-foreground">
            Aucune donnée de santé disponible pour cet établissement.
          </p>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Créer les métriques
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Créer les métriques de santé client</DialogTitle>
                <DialogDescription>
                  Remplissez les informations pour suivre la santé de {etablissement.nom}
                </DialogDescription>
              </DialogHeader>
              <CustomerHealthMetricsEditor
                etablissementId={etablissement.id}
                currentMetrics={null}
                onSuccess={() => setDialogOpen(false)} />

            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>);

  }

  return (
    <div className="space-y-6">
      {/* Health Score Global */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-4">
              <span>Score de santé client</span>
              {health &&
              <CustomerHealthIndicator
                status={health.status}
                score={health.score}
                healthData={health}
                size="lg"
                showScore />

              }
            </CardTitle>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Edit className="w-4 h-4 mr-2" />
                  Éditer
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Modifier les métriques de santé client</DialogTitle>
                  <DialogDescription>
                    Mettez à jour les données pour {etablissement.nom}
                  </DialogDescription>
                </DialogHeader>
                <CustomerHealthMetricsEditor
                  etablissementId={etablissement.id}
                  currentMetrics={metrics}
                  onSuccess={() => setDialogOpen(false)} />

              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {health &&
          <>
              {/* Indicateur de complétude des données */}
              {(metrics.nps_score === null ||
            metrics.support_tickets_open === 0 ||
            metrics.adoption_rate === 0 ||
            metrics.contract_value === null ||
            metrics.contract_value === 0) &&
            <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-yellow-600 dark:text-yellow-400 font-medium">⚠️ Données incomplètes</span>
                    <span className="text-muted-foreground">
                      Veuillez compléter les métriques pour un suivi précis
                    </span>
                  </div>
                </div>
            }
              
              {/* Facteurs de santé */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">Adoption</div>
                  <div className="flex items-center gap-2">
                    <Progress value={health.factors.adoption} className="flex-1" />
                    <span className="text-sm font-medium">{health.factors.adoption}%</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">Support</div>
                  <div className="flex items-center gap-2">
                    <Progress value={health.factors.support} className="flex-1" />
                    <span className="text-sm font-medium">{health.factors.support}%</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">Paiement</div>
                  <div className="flex items-center gap-2">
                    <Progress value={health.factors.payment} className="flex-1" />
                    <span className="text-sm font-medium">{health.factors.payment}%</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">Engagement</div>
                  <div className="flex items-center gap-2">
                    <Progress value={health.factors.engagement} className="flex-1" />
                    <span className="text-sm font-medium">{health.factors.engagement}%</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">Feedback</div>
                  <div className="flex items-center gap-2">
                    <Progress value={health.factors.feedback} className="flex-1" />
                    <span className="text-sm font-medium">{health.factors.feedback}%</span>
                  </div>
                </div>
              </div>

              {/* Alertes */}
              {health.alerts.length > 0 &&
            <div className="space-y-2 p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
                  <div className="font-medium text-orange-600 dark:text-orange-400">Alertes actives</div>
                  <ul className="space-y-1">
                    {health.alerts.map((alert, idx) =>
                <li key={idx} className="text-sm text-muted-foreground">• {alert}</li>
                )}
                  </ul>
                </div>
            }
            </>
          }
        </CardContent>
      </Card>

      {/* Métriques détaillées */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Adoption & Qualité */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" />
              Adoption & Qualité
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-3xl font-bold">{metrics.adoption_rate?.toFixed(0)}%</div>
                <div className="text-sm text-muted-foreground">Taux d'utilisation</div>
              </div>
              <TrendingUp className="w-6 h-6 text-success" />
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cotation:</span>
                <span className="font-medium">{metrics.taux_utilisation_cotation?.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Complétion dossiers:</span>
                <span className="font-medium">{metrics.taux_completion_dossier?.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between border-t pt-1 mt-1">
                <span className="text-muted-foreground">UHCD mono-RUM:</span>
                <span className="font-medium">{metrics.taux_uhcd_mono_rum?.toFixed(1)}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Qualité Médicale */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Qualité Médicale
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Avis spécialisés:</span>
                <span className="font-medium text-lg">{metrics.nombre_avis_specialise || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">CCMU 2+:</span>
                <span className="font-medium text-lg">{metrics.nombre_ccmu_2_plus || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">CCMU 3+:</span>
                <span className="font-medium text-lg">{metrics.nombre_ccmu_3_plus || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* NPS */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Satisfaction
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-3xl font-bold">
                  {metrics.nps_score !== null ? metrics.nps_score.toFixed(1) :
                  <span className="text-muted-foreground text-lg">À renseigner</span>
                  }
                </div>
                <div className="text-sm text-muted-foreground">NPS Score</div>
              </div>
              <div className="text-2xl">
                {metrics.nps_score && metrics.nps_score > 8 ? '😊' :
                metrics.nps_score && metrics.nps_score > 6 ? '😐' :
                metrics.nps_score ? '😞' : '❓'}
              </div>
            </div>
            {metrics.nps_survey_date &&
            <div className="text-xs text-muted-foreground">
                Dernière enquête: {new Date(metrics.nps_survey_date).toLocaleDateString('fr-FR')}
              </div>
            }
          </CardContent>
        </Card>

        {/* Support */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Ticket className="w-4 h-4" />
              Support
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-3xl font-bold">
                  {metrics.support_tickets_open}
                  {metrics.support_tickets_open === 0 &&
                  <span className="text-xs text-muted-foreground ml-2">(à vérifier)</span>
                  }
                </div>
                <div className="text-sm text-muted-foreground">Tickets ouverts</div>
              </div>
              <Badge variant={metrics.support_tickets_open === 0 ? 'default' : metrics.support_tickets_open <= 3 ? 'secondary' : 'destructive'}
              className={metrics.support_tickets_open === 0 ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300' :
              metrics.support_tickets_open <= 3 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300' : ''}>
                {metrics.support_tickets_open === 0 ? 'Aucun' :
                metrics.support_tickets_open <= 3 ? 'Normal' : 'Élevé'}
              </Badge>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Résolus (30j):</span>
                <span className="font-medium">{metrics.support_tickets_closed_30d}</span>
              </div>
              {metrics.avg_resolution_time_hours != null &&
              <div className="flex justify-between">
                  <span className="text-muted-foreground">Temps moyen:</span>
                  <span className="font-medium">{metrics.avg_resolution_time_hours.toFixed(1)}h</span>
                </div>
              }
            </div>
          </CardContent>
        </Card>

        {/* Contrat */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Contrat
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Statut paiement</div>
              <Badge variant={
              metrics.payment_status === 'on_time' ? 'default' :
              metrics.payment_status === 'late' ? 'secondary' : 'destructive'
              }
              className={metrics.payment_status === 'on_time' ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300' :
              metrics.payment_status === 'late' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300' : ''}>
                {metrics.payment_status === 'on_time' ? 'À jour' :
                metrics.payment_status === 'late' ? 'Retard' : 'En souffrance'}
              </Badge>
            </div>
            {metrics.contract_end_date &&
            <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Fin de contrat</div>
                <div className="font-medium">
                  {new Date(metrics.contract_end_date).toLocaleDateString('fr-FR')}
                </div>
                <div className="text-xs text-muted-foreground">
                  {(() => {
                  const days = Math.floor((new Date(metrics.contract_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  return days < 0 ? 'Expiré' :
                  days <= 30 ? `Dans ${days} jours ⚠️` :
                  days <= 90 ? `Dans ${Math.round(days / 30)} mois` :
                  `Dans ${Math.round(days / 30)} mois`;
                })()}
                </div>
              </div>
            }
            {metrics.roi_annuel !== null && metrics.roi_annuel !== undefined &&
            <div className="space-y-1 border-t pt-2 mt-2">
                <div className="text-sm text-muted-foreground">ROI Annuel</div>
                <div className="font-medium text-lg">
                  {new Intl.NumberFormat('fr-FR', {
                  style: 'currency',
                  currency: 'EUR',
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0
                }).format(metrics.roi_annuel)}
                </div>
                {metrics.roi_annuel > 0 &&
              <div className="text-xs text-success">
                    ✓ ROI positif
                  </div>
              }
              </div>
            }
          </CardContent>
        </Card>
      </div>
    </div>);

}