import { Building2, Euro, TrendingUp, Target, Users, CheckCircle, Activity, PieChart } from 'lucide-react'
import { formatNumber } from '@/lib/utils'
import { DrilldownMetric } from './DrilldownMetric'
import { useDrilldown } from '@/hooks/analytics/useDrilldown'

interface RapportsHeroMetricsProps {
  stats: {
    totalEtablissements: number
    prospects: number
    enProduction: number
    enDeploiement: number
    totalTaches: number
    tachesTerminees: number
    progressionMoyenne: number
    totalPassages: number
    totalValeur: number
    caRealise: number
    caPrevisionnel: number
    tauxConversion: number
    pipelineValue: number
    passagesProduction: number
    partMarcheActuelle: number
    partMarchePotentielle: number
    passagesRestants: number
    potentielMarcheRestant: number
    passagesNationaux: number
  }
  compareWithPrevious?: boolean
  previousStats?: any
}

export function RapportsHeroMetrics({ stats, compareWithPrevious, previousStats }: RapportsHeroMetricsProps) {
  const { drillDown } = useDrilldown()
  
  const calculateEvolution = (current: number, previous: number) => {
    if (!previous || previous === 0) return null
    return Math.round(((current - previous) / previous) * 100)
  }

  const metrics = [
    {
      title: 'Total Établissements',
      value: stats.totalEtablissements,
      icon: Building2,
      description: `${stats.prospects} prospects`,
      color: 'text-chart-1',
      evolution: compareWithPrevious && previousStats ? calculateEvolution(stats.totalEtablissements, previousStats.totalEtablissements) : null,
    },
    {
      title: 'CA Réalisé',
      value: `${formatNumber(stats.caRealise)} €`,
      icon: Euro,
      description: 'Production actuelle',
      color: 'text-chart-2',
      evolution: compareWithPrevious && previousStats ? calculateEvolution(stats.caRealise, previousStats.caRealise) : null,
    },
    {
      title: 'CA Prévisionnel',
      value: `${formatNumber(stats.caPrevisionnel)} €`,
      icon: Target,
      description: 'Potentiel total',
      color: 'text-chart-3',
      evolution: compareWithPrevious && previousStats ? calculateEvolution(stats.caPrevisionnel, previousStats.caPrevisionnel) : null,
    },
    {
      title: 'Taux de Conversion',
      value: `${stats.tauxConversion}%`,
      icon: TrendingUp,
      description: 'Prospects → Production',
      color: 'text-chart-4',
      evolution: compareWithPrevious && previousStats ? calculateEvolution(stats.tauxConversion, previousStats.tauxConversion) : null,
    },
    {
      title: 'Pipeline Value',
      value: `${formatNumber(stats.pipelineValue)} €`,
      icon: PieChart,
      description: 'En cours de déploiement',
      color: 'text-chart-5',
      evolution: compareWithPrevious && previousStats ? calculateEvolution(stats.pipelineValue, previousStats.pipelineValue) : null,
    },
    {
      title: 'Taux de Réalisation',
      value: `${stats.totalTaches > 0 ? Math.round((stats.tachesTerminees / stats.totalTaches) * 100) : 0}%`,
      icon: CheckCircle,
      description: `${stats.tachesTerminees}/${stats.totalTaches} tâches`,
      color: 'text-green-600',
      evolution: null,
    },
    {
      title: 'Passages Urgences',
      value: formatNumber(stats.totalPassages),
      icon: Activity,
      description: 'Volume annuel total',
      color: 'text-orange-600',
      evolution: compareWithPrevious && previousStats ? calculateEvolution(stats.totalPassages, previousStats.totalPassages) : null,
    },
    {
      title: 'Part de Marché Actuelle',
      value: `${stats.partMarcheActuelle.toFixed(2)}%`,
      icon: PieChart,
      description: `${formatNumber(stats.passagesProduction)} passages en production`,
      color: 'text-blue-600',
      evolution: compareWithPrevious && previousStats ? calculateEvolution(stats.partMarcheActuelle, previousStats.partMarcheActuelle) : null,
    },
    {
      title: 'Part de Marché Potentielle',
      value: `${stats.partMarchePotentielle.toFixed(2)}%`,
      icon: TrendingUp,
      description: `${formatNumber(stats.totalPassages)} passages (pipeline total)`,
      color: 'text-purple-600',
      evolution: compareWithPrevious && previousStats ? calculateEvolution(stats.partMarchePotentielle, previousStats.partMarchePotentielle) : null,
    },
    {
      title: 'En Production',
      value: stats.enProduction,
      icon: Users,
      description: 'Clients actifs',
      color: 'text-emerald-600',
      evolution: compareWithPrevious && previousStats ? calculateEvolution(stats.enProduction, previousStats.enProduction) : null,
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric) => (
        <DrilldownMetric
          key={`metric-${metric.title}`}
          title={metric.title}
          value={metric.value}
          description={metric.description}
          icon={metric.icon}
          color={metric.color}
          evolution={metric.evolution}
          drilldownTarget={{
            label: metric.title,
            filters: { 
              // Add contextual filters based on metric
              ...(metric.title === 'CA Réalisé' && { selectedStatuts: ['Production', 'Go-Live'] }),
              ...(metric.title === 'Total Établissements' && {}),
              ...(metric.title === 'En Production' && { selectedStatuts: ['Production', 'Go-Live'] })
            },
            view: 'table'
          }}
        />
      ))}
    </div>
  )
}
