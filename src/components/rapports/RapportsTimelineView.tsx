import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAllEtablissements } from '@/hooks/crm/useProspects'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from 'recharts'
import { formatNumber } from '@/lib/utils'
import { useMemo } from 'react'
import { format, startOfMonth, subMonths, isWithinInterval } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Calendar, TrendingUp, FileSignature, Rocket, AlertCircle } from 'lucide-react'
import { calculateEtablissementValue } from '@/lib/valueCalculations'

export function RapportsTimelineView() {
  const { data: etablissements } = useAllEtablissements()

  // Générer les données mensuelles sur 12 mois
  const timelineData = useMemo(() => {
    if (!etablissements) return []

    const now = new Date()
    const data = []

    for (let i = 11; i >= 0; i--) {
      const monthStart = startOfMonth(subMonths(now, i))
      const monthEnd = startOfMonth(subMonths(now, i - 1))
      
      // Établissements créés/signés jusqu'à ce mois
      const etablissementsUpToMonth = etablissements.filter(e => {
        if (!e.created_at) return false
        const createdDate = new Date(e.created_at)
        return createdDate <= monthEnd
      })

      // Établissements en production jusqu'à ce mois
      const enProduction = etablissementsUpToMonth.filter(e => 
        e.statut === 'Production' || e.statut === 'Go-Live'
      ).length

      // Nouveaux prospects ce mois
      const nouveauxProspects = etablissements.filter(e => {
        if (!e.created_at || e.statut !== 'Prospect') return false
        const createdDate = new Date(e.created_at)
        return isWithinInterval(createdDate, { start: monthStart, end: monthEnd })
      }).length

      // Signatures ce mois
      const signatures = etablissements.filter(e => {
        if (!e.date_signature) return false
        const signatureDate = new Date(e.date_signature)
        return isWithinInterval(signatureDate, { start: monthStart, end: monthEnd })
      }).length

      const caRealise = etablissementsUpToMonth
        .filter(e => e.statut === 'Production' || e.statut === 'Go-Live')
        .reduce((sum, e) => sum + calculateEtablissementValue(e), 0)

      // Taux de conversion
      const totalEtablissements = etablissementsUpToMonth.length
      const tauxConversion = totalEtablissements > 0 
        ? Math.round((enProduction / totalEtablissements) * 100)
        : 0

      data.push({
        mois: format(monthStart, 'MMM yy', { locale: fr }),
        date: monthStart,
        total: etablissementsUpToMonth.length,
        enProduction,
        nouveauxProspects,
        signatures,
        caRealise: Math.round(caRealise),
        tauxConversion,
      })
    }

    return data
  }, [etablissements])

  // Événements clés
  const keyEvents = useMemo(() => {
    if (!etablissements) return []

    const events: Array<{
      date: Date
      type: 'signature' | 'golive' | 'churn'
      etablissement: string
      icon: any
      color: string
    }> = []

    etablissements.forEach(e => {
      // Signatures
      if (e.date_signature) {
        const signatureDate = new Date(e.date_signature)
        const threeMonthsAgo = subMonths(new Date(), 3)
        if (signatureDate >= threeMonthsAgo) {
          events.push({
            date: signatureDate,
            type: 'signature',
            etablissement: e.nom,
            icon: FileSignature,
            color: 'text-blue-600',
          })
        }
      }

      // Go-Lives (on peut utiliser une date de passage en production)
      if ((e.statut === 'Production' || e.statut === 'Go-Live') && e.created_at) {
        const createdDate = new Date(e.created_at)
        const threeMonthsAgo = subMonths(new Date(), 3)
        // Simule un go-live 30 jours après la création pour les établissements en production
        const goLiveDate = new Date(createdDate)
        goLiveDate.setDate(goLiveDate.getDate() + 30)
        
        if (goLiveDate >= threeMonthsAgo && goLiveDate <= new Date()) {
          events.push({
            date: goLiveDate,
            type: 'golive',
            etablissement: e.nom,
            icon: Rocket,
            color: 'text-emerald-600',
          })
        }
      }
    })

    return events.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 10)
  }, [etablissements])

  return (
    <div className="space-y-6">
      {/* Timeline principale */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Évolution sur 12 mois
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mois" />
              <YAxis yAxisId="left" orientation="left" stroke="hsl(var(--chart-1))" />
              <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--chart-3))" tickFormatter={(value) => `${value}%`} />
              <Tooltip 
                formatter={(value: number, name: string) => {
                  if (name === 'CA Réalisé') return `${formatNumber(value)} €`
                  if (name === 'Taux de Conversion') return `${value}%`
                  return value
                }}
              />
              <Legend />
              <Bar yAxisId="left" dataKey="total" fill="hsl(var(--chart-1))" name="Total Établissements" />
              <Line yAxisId="left" type="monotone" dataKey="enProduction" stroke="hsl(var(--chart-2))" strokeWidth={2} name="En Production" />
              <Line yAxisId="right" type="monotone" dataKey="tauxConversion" stroke="hsl(var(--chart-3))" strokeWidth={2} strokeDasharray="5 5" name="Taux de Conversion" />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CA Mensuel */}
        <Card>
          <CardHeader>
            <CardTitle>Évolution du Chiffre d'Affaires</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mois" />
                <YAxis tickFormatter={(value) => `${formatNumber(value)}€`} />
                <Tooltip formatter={(value: number) => `${formatNumber(value)} €`} />
                <Bar dataKey="caRealise" fill="hsl(var(--chart-2))" name="CA Réalisé" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Activité mensuelle */}
        <Card>
          <CardHeader>
            <CardTitle>Activité Mensuelle</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mois" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="nouveauxProspects" stroke="hsl(var(--chart-4))" strokeWidth={2} name="Nouveaux Prospects" />
                <Line type="monotone" dataKey="signatures" stroke="hsl(var(--chart-5))" strokeWidth={2} name="Signatures" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Événements clés */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Événements Clés (3 derniers mois)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {keyEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Aucun événement clé récent</p>
            </div>
          ) : (
            <div className="space-y-4">
              {keyEvents.map((event, index) => {
                const Icon = event.icon
                return (
                  <div key={`${event.etablissement}-${event.type}-${event.date.getTime()}`} className="flex items-start gap-4 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className={`p-2 rounded-full bg-muted ${event.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h4 className="font-medium truncate">{event.etablissement}</h4>
                        <Badge variant="outline">
                          {format(event.date, 'dd MMM yyyy', { locale: fr })}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {event.type === 'signature' && '📝 Signature de contrat'}
                        {event.type === 'golive' && '🚀 Mise en production'}
                        {event.type === 'churn' && '⚠️ Résiliation'}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
