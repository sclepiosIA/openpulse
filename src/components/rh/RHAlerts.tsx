import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { safeNum } from '@/lib/formatters'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertTriangle, CheckCircle, Info } from 'lucide-react'
import { useRHAnalytics } from '@/hooks/hr/useRHAnalytics'
import { useRHKPIs } from '@/hooks/hr/useRHKPIs'
import { Skeleton } from '@/components/ui/skeleton'

export function RHAlerts() {
  const { data: analytics, isLoading: analyticsLoading } = useRHAnalytics()
  const { data: kpis, isLoading: kpisLoading } = useRHKPIs()

  const isLoading = analyticsLoading || kpisLoading

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Alertes et recommandations</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[150px] w-full" />
        </CardContent>
      </Card>
    )
  }

  if (!analytics || !kpis) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Alertes et recommandations</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">Aucune donnée disponible</p>
        </CardContent>
      </Card>
    )
  }

  const alerts: Array<{ type: 'error' | 'warning' | 'info'; title: string; description: string }> =
    []

  // Alerte si absentéisme élevé
  if (kpis.taux_absenteisme > 5) {
    alerts.push({
      type: 'error',
      title: "Taux d'absentéisme élevé",
      description: `Le taux d'absentéisme est de ${kpis.taux_absenteisme.toFixed(1)}%, ce qui est au-dessus de la moyenne recommandée (5%). Analysez les causes et mettez en place des actions préventives.`,
    })
  }

  // Alerte si turnover élevé
  if (analytics.turnover12Mois.tauxTurnover > 15) {
    alerts.push({
      type: 'warning',
      title: 'Turnover élevé',
      description: `Le taux de turnover sur 12 mois est de ${safeNum(analytics.turnover12Mois.tauxTurnover).toFixed(1)}% (${analytics.turnover12Mois.entrees} entrées, ${analytics.turnover12Mois.sorties} sorties). Considérez une analyse des causes de départ.`,
    })
  }

  // Alerte si données incomplètes
  if (kpis.effectif_total > kpis.effectif_actif) {
    const manquants = kpis.effectif_total - kpis.effectif_actif
    alerts.push({
      type: 'warning',
      title: 'Données salariales incomplètes',
      description: `${manquants} employé(s) n'ont pas de données salariales pour le mois en cours. Complétez ces informations pour des analyses précises.`,
    })
  }

  // Information positive
  if (kpis.taux_absenteisme <= 3) {
    alerts.push({
      type: 'info',
      title: "Excellent taux d'absentéisme",
      description: `Votre taux d'absentéisme de ${kpis.taux_absenteisme.toFixed(1)}% est excellent et en dessous de la moyenne du secteur.`,
    })
  }

  // Recommandation si ancienneté faible
  if (analytics.ancienneteMoyenne < 12) {
    alerts.push({
      type: 'info',
      title: 'Équipe junior',
      description: `L'ancienneté moyenne est de ${Math.round(analytics.ancienneteMoyenne)} mois. Assurez-vous que les processus d'onboarding et de formation sont optimaux.`,
    })
  }

  if (alerts.length === 0) {
    alerts.push({
      type: 'info',
      title: 'Aucune alerte',
      description: 'Tous les indicateurs RH sont dans les normes. Continuez ainsi !',
    })
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <AlertTriangle className="h-4 w-4" />
      case 'warning':
        return <Info className="h-4 w-4" />
      case 'info':
        return <CheckCircle className="h-4 w-4" />
      default:
        return <Info className="h-4 w-4" />
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alertes et recommandations</CardTitle>
        <CardDescription>Points d'attention et suggestions d'amélioration</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {alerts.map((alert, index) => (
            <Alert
              key={alert.title || `alert-${index}`}
              variant={alert.type === 'error' ? 'destructive' : 'default'}
            >
              {getIcon(alert.type)}
              <AlertTitle>{alert.title}</AlertTitle>
              <AlertDescription>{alert.description}</AlertDescription>
            </Alert>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
