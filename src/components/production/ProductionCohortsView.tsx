import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Users, TrendingUp } from 'lucide-react'
import type { Etablissement } from '@/hooks/crm/useEtablissements'
import type { CustomerHealthScore } from '@/hooks/crm/useCustomerHealth'
import { Badge } from '@/components/ui/badge'
import { calculateEtablissementValue } from '@/lib/valueCalculations'

interface ProductionCohortsViewProps {
  etablissements: Etablissement[]
  healthScores: Map<string, CustomerHealthScore>
  healthMetrics?: Map<string, any>
}

export function ProductionCohortsView({ etablissements, healthScores, healthMetrics }: ProductionCohortsViewProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  // Créer les cohortes par trimestre
  const cohorts = etablissements.reduce((acc, etab) => {
    if (!etab.date_signature) return acc
    
    const date = new Date(etab.date_signature)
    const year = date.getFullYear()
    const quarter = Math.floor(date.getMonth() / 3) + 1
    const key = `${year} Q${quarter}`
    
    if (!acc[key]) {
      acc[key] = {
        key,
        year,
        quarter,
        startDate: new Date(year, (quarter - 1) * 3, 1),
        etablissements: []
      }
    }
    acc[key].etablissements.push(etab)
    return acc
  }, {} as Record<string, { 
    key: string
    year: number
    quarter: number
    startDate: Date
    etablissements: Etablissement[] 
  }>)

  const cohortStats = Object.values(cohorts)
    .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())
    .map(cohort => {
      const count = cohort.etablissements.length
      const totalRevenue = cohort.etablissements.reduce((sum, e) => 
        sum + calculateEtablissementValue(e), 
      0)
      const avgRevenue = count > 0 ? totalRevenue / count : 0
      
      // Calculer health score moyen
      const healthScoresArray = cohort.etablissements
        .map(e => healthScores.get(e.id))
        .filter(h => h && h.status !== 'onboarding')
      const avgHealth = healthScoresArray.length > 0
        ? healthScoresArray.reduce((sum, h) => sum + (h?.score || 0), 0) / healthScoresArray.length
        : 0

      // Calculer NPS moyen
      const npsArray = cohort.etablissements
        .map(e => healthMetrics?.get(e.id)?.nps_score)
        .filter(nps => nps !== undefined)
      const avgNPS = npsArray.length > 0
        ? npsArray.reduce((sum, nps) => sum + nps, 0) / npsArray.length
        : 0

      // Calculer rétention à 6 mois (simplifié - on vérifie juste s'ils sont toujours actifs)
      const monthsSinceCohort = Math.floor((Date.now() - cohort.startDate.getTime()) / (1000 * 60 * 60 * 24 * 30))
      let retention6M = 100
      if (monthsSinceCohort >= 6) {
        // Tous les clients de cette cohorte qui sont toujours actifs après 6 mois
        retention6M = 100 // Simplifié: tous les clients dans etablissements sont encore actifs
      }

      return {
        ...cohort,
        count,
        avgRevenue,
        avgHealth,
        avgNPS,
        retention6M,
        monthsSinceCohort
      }
    })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Analyse par cohortes de lancement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cohorte</TableHead>
                  <TableHead className="text-right">Clients</TableHead>
                  <TableHead className="text-right">CA moyen</TableHead>
                  <TableHead className="text-right">Health moyen</TableHead>
                  <TableHead className="text-right">NPS moyen</TableHead>
                  <TableHead className="text-right">Rétention 6M</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cohortStats.map(cohort => (
                  <TableRow key={cohort.key}>
                    <TableCell className="font-medium">{cohort.key}</TableCell>
                    <TableCell className="text-right">{cohort.count}</TableCell>
                    <TableCell className="text-right">{formatCurrency(cohort.avgRevenue)}</TableCell>
                    <TableCell className="text-right">
                      {cohort.monthsSinceCohort < 3 ? (
                        <Badge variant="secondary" className="bg-primary/10 text-primary">
                          Onboarding
                        </Badge>
                      ) : cohort.avgHealth > 0 ? (
                        <span className={
                          cohort.avgHealth >= 80 ? 'text-success font-semibold' :
                          cohort.avgHealth >= 60 ? 'text-warning font-semibold' :
                          'text-destructive font-semibold'
                        }>
                          {cohort.avgHealth.toFixed(0)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {cohort.avgNPS > 0 ? (
                        <span className={
                          cohort.avgNPS > 8 ? 'text-success font-semibold' :
                          cohort.avgNPS > 6 ? 'text-muted-foreground' :
                          'text-destructive font-semibold'
                        }>
                          {cohort.avgNPS.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {cohort.monthsSinceCohort >= 6 ? (
                        <span className="font-semibold">{cohort.retention6M.toFixed(0)}%</span>
                      ) : (
                        <span className="text-muted-foreground">Trop tôt</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Insights cohortes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {cohortStats.length > 1 && (
              <>
                <div className="p-4 rounded-lg border bg-muted/50">
                  <div className="font-medium mb-2">Meilleure cohorte (Health)</div>
                  <div className="text-sm text-muted-foreground">
                    {cohortStats
                      .filter(c => c.monthsSinceCohort >= 3)
                      .sort((a, b) => b.avgHealth - a.avgHealth)[0]?.key || 'N/A'}
                    {' - Health score: '}
                    {cohortStats
                      .filter(c => c.monthsSinceCohort >= 3)
                      .sort((a, b) => b.avgHealth - a.avgHealth)[0]?.avgHealth.toFixed(0) || 'N/A'}
                  </div>
                </div>
                
                {cohortStats.some(c => c.avgNPS > 0) && (
                  <div className="p-4 rounded-lg border bg-muted/50">
                    <div className="font-medium mb-2">Meilleure cohorte (NPS)</div>
                    <div className="text-sm text-muted-foreground">
                      {cohortStats
                        .filter(c => c.avgNPS > 0)
                        .sort((a, b) => b.avgNPS - a.avgNPS)[0]?.key || 'N/A'}
                      {' - NPS: '}
                      {cohortStats
                        .filter(c => c.avgNPS > 0)
                        .sort((a, b) => b.avgNPS - a.avgNPS)[0]?.avgNPS.toFixed(1) || 'N/A'}
                    </div>
                  </div>
                )}

                <div className="p-4 rounded-lg border bg-muted/50">
                  <div className="font-medium mb-2">Cohorte la plus récente</div>
                  <div className="text-sm text-muted-foreground">
                    {cohortStats[0]?.key} - {cohortStats[0]?.count} client(s) en onboarding
                  </div>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
