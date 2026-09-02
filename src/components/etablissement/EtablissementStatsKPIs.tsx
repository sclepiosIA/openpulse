import { Card, CardContent } from '@/components/ui/card'
import { TrendingUp, Building2, Rocket, Calendar } from 'lucide-react'
import type { Etablissement } from '@/hooks/crm/useEtablissements'
import { countByPhase } from '@/lib/phaseUtils'
import { cn } from '@/lib/utils'

interface EtablissementStatsKPIsProps {
  etablissements: Etablissement[]
  totalEtablissements: number
}

const KPI_CONFIG = [
  {
    key: 'etablissements',
    label: 'Établissements',
    icon: Building2,
    color: 'primary',
    borderColor: 'border-l-primary',
    iconBg: 'from-primary/20 to-primary/5',
    iconRing: 'ring-primary/20',
    glowColor: 'bg-primary/30',
  },
  {
    key: 'conversion',
    label: 'Taux conversion',
    icon: TrendingUp,
    color: 'success',
    borderColor: 'border-l-success',
    iconBg: 'from-success/20 to-success/5',
    iconRing: 'ring-success/20',
    glowColor: 'bg-success/30',
  },
  {
    key: 'deploiement',
    label: 'En déploiement',
    icon: Rocket,
    color: 'warning',
    borderColor: 'border-l-warning',
    iconBg: 'from-warning/20 to-warning/5',
    iconRing: 'ring-warning/20',
    glowColor: 'bg-warning/30',
  },
  {
    key: 'echeances',
    label: 'Échéances 30j',
    icon: Calendar,
    color: 'violet',
    borderColor: 'border-l-violet-500',
    iconBg: 'from-violet-500/20 to-violet-500/5',
    iconRing: 'ring-violet-500/20',
    glowColor: 'bg-violet-500/30',
  },
] as const

export function EtablissementStatsKPIs({
  etablissements,
  totalEtablissements,
}: EtablissementStatsKPIsProps) {
  const tauxConversion =
    totalEtablissements > 0
      ? Math.round((countByPhase(etablissements, 'production') / totalEtablissements) * 100)
      : 0

  const enDeploiement = countByPhase(etablissements, 'deploiement')

  const prochainesEcheances = etablissements.filter((e) => {
    if (!e.date_previsionnelle_signature) return false
    const diff = new Date(e.date_previsionnelle_signature).getTime() - Date.now()
    const days = diff / (1000 * 60 * 60 * 24)
    return days > 0 && days <= 30
  }).length

  const getKPIValue = (key: string) => {
    switch (key) {
      case 'etablissements':
        return { value: etablissements.length, suffix: `/ ${totalEtablissements}` }
      case 'conversion':
        return { value: `${tauxConversion}`, suffix: '%' }
      case 'deploiement':
        return { value: enDeploiement, suffix: null }
      case 'echeances':
        return { value: prochainesEcheances, suffix: null }
      default:
        return { value: 0, suffix: null }
    }
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {KPI_CONFIG.map((kpi) => {
        const Icon = kpi.icon
        const { value, suffix } = getKPIValue(kpi.key)

        return (
          <Card
            key={kpi.key}
            className={cn(
              'relative overflow-hidden transition-all duration-300',
              'bg-card/80 backdrop-blur-sm shadow-lg hover:shadow-xl',
              'border-l-4 border-primary/10',
              kpi.borderColor,
              'hover:-translate-y-0.5'
            )}
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {kpi.label}
                  </p>
                  <div className="flex items-baseline gap-1">
                    <span
                      className={cn(
                        'text-3xl font-bold',
                        kpi.key === 'etablissements' && 'text-primary',
                        kpi.key === 'conversion' && 'text-success',
                        kpi.key === 'deploiement' && 'text-warning',
                        kpi.key === 'echeances' && 'text-violet-600'
                      )}
                    >
                      {value}
                    </span>
                    {suffix && (
                      <span className="text-sm font-medium text-muted-foreground">{suffix}</span>
                    )}
                  </div>
                </div>

                {/* Icon with glow effect */}
                <div className="relative">
                  <div
                    className={cn(
                      'absolute inset-0 rounded-full blur-lg opacity-50',
                      kpi.glowColor
                    )}
                  />
                  <div
                    className={cn(
                      'relative h-12 w-12 rounded-xl flex items-center justify-center',
                      'bg-gradient-to-br ring-2',
                      kpi.iconBg,
                      kpi.iconRing
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-6 w-6',
                        kpi.key === 'etablissements' && 'text-primary',
                        kpi.key === 'conversion' && 'text-success',
                        kpi.key === 'deploiement' && 'text-warning',
                        kpi.key === 'echeances' && 'text-violet-600'
                      )}
                    />
                  </div>
                </div>
              </div>
            </CardContent>

            {/* Decorative gradient overlay */}
            <div
              className={cn(
                'absolute bottom-0 left-0 right-0 h-1',
                'bg-gradient-to-r from-transparent',
                kpi.key === 'etablissements' && 'via-primary/20 to-transparent',
                kpi.key === 'conversion' && 'via-success/20 to-transparent',
                kpi.key === 'deploiement' && 'via-warning/20 to-transparent',
                kpi.key === 'echeances' && 'via-violet-500/20 to-transparent'
              )}
            />
          </Card>
        )
      })}
    </div>
  )
}
