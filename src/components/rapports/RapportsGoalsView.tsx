import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { useAllEtablissements } from '@/hooks/crm/useProspects'
import { useProfiles } from '@/hooks/profile/useProfiles'
import { formatNumber } from '@/lib/utils'
import { useMemo } from 'react'
import { calculateEtablissementValue } from '@/lib/valueCalculations'
import {
  Target,
  TrendingUp,
  Users,
  Euro,
  MapPin,
  AlertCircle,
  CheckCircle,
  Lightbulb,
  BarChart3,
} from 'lucide-react'
const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))']

export function RapportsGoalsView() {
  const { data: etablissements } = useAllEtablissements()
  const { data: profiles } = useProfiles()

  // Objectifs globaux (à configurer - pour démo, objectifs fixes)
  const objectifs = {
    caAnnuel: 5000000, // 5M€
    nouveauxClients: 50,
    tauxConversion: 30, // 30%
    etablissementsProduction: 100,
  }

  // Calculs des réalisations
  const realisations = useMemo(() => {
    if (!etablissements) return {
      caRealise: 0,
      nouveauxClients: 0,
      tauxConversion: 0,
      enProduction: 0,
    }

    const caRealise = etablissements
      .filter(e => e.statut === 'Production' || e.statut === 'Go-Live')
      .reduce((sum, e) => sum + calculateEtablissementValue(e), 0)

    const nouveauxClients = etablissements.filter(e => {
      if (!e.created_at) return false
      const createdDate = new Date(e.created_at)
      const yearStart = new Date(new Date().getFullYear(), 0, 1)
      return createdDate >= yearStart
    }).length

    const prospects = etablissements.filter(e => e.statut === 'Prospect').length
    const enProduction = etablissements.filter(e => e.statut === 'Production' || e.statut === 'Go-Live').length
    const tauxConversion = prospects + enProduction > 0 
      ? Math.round((enProduction / (prospects + enProduction)) * 100)
      : 0

    return {
      caRealise: Math.round(caRealise),
      nouveauxClients,
      tauxConversion,
      enProduction,
    }
  }, [etablissements])

  // Projection CA (linéaire basée sur progression actuelle)
  const projection = useMemo(() => {
    const monthsPassed = new Date().getMonth() + 1
    const monthsRemaining = 12 - monthsPassed
    
    if (monthsPassed === 0) return realisations.caRealise

    const caParMois = realisations.caRealise / monthsPassed
    return Math.round(realisations.caRealise + (caParMois * monthsRemaining))
  }, [realisations.caRealise])

  // Performance par région
  const performanceParRegion = useMemo(() => {
    if (!etablissements) return []

    const regionsData: Record<string, { count: number; valeur: number; objectif: number }> = {}
    
    etablissements.forEach(e => {
      const region = e.region || 'Non défini'
      if (!regionsData[region]) {
        regionsData[region] = { count: 0, valeur: 0, objectif: 500000 } // Objectif par région à configurer
      }
      regionsData[region].count++
      regionsData[region].valeur += calculateEtablissementValue(e)
    })

    return Object.entries(regionsData)
      .map(([region, data]) => ({
        region,
        count: data.count,
        valeur: Math.round(data.valeur),
        objectif: data.objectif,
        progression: Math.round((data.valeur / data.objectif) * 100),
      }))
      .sort((a, b) => b.valeur - a.valeur)
      .slice(0, 8)
  }, [etablissements])

  // Performance par commercial
  const performanceParCommercial = useMemo(() => {
    if (!etablissements || !profiles) return []

    const commercialData: Record<string, { count: number; valeur: number; objectif: number }> = {}
    
    etablissements.forEach(e => {
      const commercialId = e.commercial_id
      if (!commercialId) return
      
      const profile = profiles.find(p => p.id === commercialId)
      const name = profile ? `${profile.prenom} ${profile.nom}` : 'Non assigné'
      
      if (!commercialData[name]) {
        commercialData[name] = { count: 0, valeur: 0, objectif: 800000 } // Objectif par commercial
      }
      commercialData[name].count++
      commercialData[name].valeur += calculateEtablissementValue(e)
    })

    return Object.entries(commercialData)
      .map(([name, data]) => ({
        name,
        count: data.count,
        valeur: Math.round(data.valeur),
        objectif: data.objectif,
        progression: Math.round((data.valeur / data.objectif) * 100),
      }))
      .sort((a, b) => b.valeur - a.valeur)
      .slice(0, 8)
  }, [etablissements, profiles])

  // Recommandations basées sur les données
  const recommandations = useMemo(() => {
    const reco: Array<{ type: 'success' | 'warning' | 'info'; message: string }> = []

    // Analyse du CA
    const progressionCA = (realisations.caRealise / objectifs.caAnnuel) * 100
    if (progressionCA < 50) {
      reco.push({
        type: 'warning',
        message: `CA à ${Math.round(progressionCA)}% de l'objectif annuel. Intensifier les actions commerciales.`
      })
    } else if (progressionCA >= 80) {
      reco.push({
        type: 'success',
        message: `Excellent ! CA à ${Math.round(progressionCA)}% de l'objectif. Maintenir le rythme.`
      })
    }

    // Analyse du taux de conversion
    if (realisations.tauxConversion < objectifs.tauxConversion) {
      reco.push({
        type: 'warning',
        message: `Taux de conversion (${realisations.tauxConversion}%) en dessous de l'objectif (${objectifs.tauxConversion}%). Améliorer le suivi des prospects.`
      })
    }

    // Régions à fort potentiel
    const topRegion = performanceParRegion[0]
    if (topRegion && topRegion.progression < 100) {
      reco.push({
        type: 'info',
        message: `Focus sur ${topRegion.region}: forte activité mais objectif non atteint (${topRegion.progression}%).`
      })
    }

    // Projection positive
    if (projection > objectifs.caAnnuel) {
      reco.push({
        type: 'success',
        message: `Projection annuelle (${formatNumber(projection)}€) supérieure à l'objectif. Excellent parcours !`
      })
    }

    return reco
  }, [realisations, objectifs, performanceParRegion, projection])

  const goalCards = [
    {
      title: 'CA Annuel',
      value: realisations.caRealise,
      objectif: objectifs.caAnnuel,
      icon: Euro,
      color: 'text-chart-1',
      suffix: '€',
    },
    {
      title: 'Nouveaux Clients',
      value: realisations.nouveauxClients,
      objectif: objectifs.nouveauxClients,
      icon: Users,
      color: 'text-chart-2',
      suffix: '',
    },
    {
      title: 'Taux de Conversion',
      value: realisations.tauxConversion,
      objectif: objectifs.tauxConversion,
      icon: TrendingUp,
      color: 'text-chart-3',
      suffix: '%',
    },
    {
      title: 'En Production',
      value: realisations.enProduction,
      objectif: objectifs.etablissementsProduction,
      icon: CheckCircle,
      color: 'text-chart-4',
      suffix: '',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Objectifs principaux */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {goalCards.map((goal) => {
          const Icon = goal.icon
          const progression = Math.min(Math.round((goal.value / goal.objectif) * 100), 100)
          const isAtteint = progression >= 100

          return (
            <Card key={goal.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{goal.title}</CardTitle>
                <Icon className={`h-4 w-4 ${goal.color}`} />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-bold">
                      {formatNumber(goal.value)}{goal.suffix}
                    </span>
                    <Badge variant={isAtteint ? 'default' : 'secondary'}>
                      {progression}%
                    </Badge>
                  </div>
                  <Progress value={progression} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    Objectif: {formatNumber(goal.objectif)}{goal.suffix}
                  </p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Projection et recommandations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Projection CA */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Projection CA Annuel
            </CardTitle>
            <CardDescription>Basée sur la tendance actuelle</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">CA Réalisé</p>
                  <p className="text-2xl font-bold">{formatNumber(realisations.caRealise)} €</p>
                </div>
                <Badge variant="outline">Actuel</Badge>
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm text-muted-foreground">Projection Fin d'Année</p>
                  <p className="text-2xl font-bold">{formatNumber(projection)} €</p>
                </div>
                <Badge>{Math.round((projection / objectifs.caAnnuel) * 100)}%</Badge>
              </div>
              <div className="flex items-center justify-between p-4 border-2 border-primary rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Objectif Annuel</p>
                  <p className="text-2xl font-bold">{formatNumber(objectifs.caAnnuel)} €</p>
                </div>
                <Target className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recommandations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5" />
              Recommandations
            </CardTitle>
            <CardDescription>Actions suggérées basées sur les tendances</CardDescription>
          </CardHeader>
          <CardContent>
            {recommandations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Aucune recommandation pour le moment</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recommandations.map((reco, index) => (
                  <div
                    key={`reco-${reco.type}-${index}`}
                    className={`p-3 border rounded-lg flex items-start gap-3 ${
                      reco.type === 'success' ? 'bg-green-50 border-green-200 dark:bg-green-950/20' :
                      reco.type === 'warning' ? 'bg-orange-50 border-orange-200 dark:bg-orange-950/20' :
                      'bg-blue-50 border-blue-200 dark:bg-blue-950/20'
                    }`}
                  >
                    {reco.type === 'success' && <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />}
                    {reco.type === 'warning' && <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5" />}
                    {reco.type === 'info' && <Lightbulb className="w-5 h-5 text-blue-600 mt-0.5" />}
                    <p className="text-sm">{reco.message}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Performance par région */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Performance par Région
          </CardTitle>
          <CardDescription>Top 8 régions par chiffre d'affaires</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {performanceParRegion.map((region, index) => (
              <div key={`region-${region.region}`} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{region.region}</p>
                      <p className="text-xs text-muted-foreground">
                        {region.count} établissements • {formatNumber(region.valeur)} €
                      </p>
                    </div>
                  </div>
                  <Badge variant={region.progression >= 100 ? 'default' : 'secondary'}>
                    {region.progression}%
                  </Badge>
                </div>
                <Progress value={Math.min(region.progression, 100)} className="h-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Performance par commercial */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Performance par Commercial
          </CardTitle>
          <CardDescription>Top 8 commerciaux par chiffre d'affaires</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {performanceParCommercial.map((commercial, index) => (
              <div key={`commercial-${commercial.name}`} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-secondary text-secondary-foreground text-xs flex items-center justify-center font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{commercial.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {commercial.count} clients • {formatNumber(commercial.valeur)} €
                      </p>
                    </div>
                  </div>
                  <Badge variant={commercial.progression >= 100 ? 'default' : 'secondary'}>
                    {commercial.progression}%
                  </Badge>
                </div>
                <Progress value={Math.min(commercial.progression, 100)} className="h-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
