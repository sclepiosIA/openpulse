import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { EntityAvatar } from '@/components/ui/EntityAvatar'
import { CustomerHealthIndicator } from './CustomerHealthIndicator'
import { useNavigate } from 'react-router-dom'
import { useSmartNavigation } from '@/hooks/shared/useSmartNavigation'
import type { Etablissement } from '@/hooks/crm/useEtablissements'
import type { CustomerHealthScore } from '@/hooks/crm/useCustomerHealth'
import { calculateEtablissementValue } from '@/lib/valueCalculations'

interface ProductionMobileCardProps {
  etablissement: Etablissement
  health?: CustomerHealthScore
  healthMetrics?: any
}

export function ProductionMobileCard({
  etablissement,
  health,
  healthMetrics,
}: ProductionMobileCardProps) {
  const { smartNavigate } = useSmartNavigation()
  const navigate = useNavigate()

  const revenue = calculateEtablissementValue(etablissement)
  const adoptionRate = healthMetrics?.adoption_rate || 0
  const npsScore = healthMetrics?.nps_score
  const monthsInProduction = etablissement.date_go_live
    ? Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(etablissement.date_go_live).getTime()) / (1000 * 60 * 60 * 24 * 30)
        )
      )
    : 0

  const formatCurrency = (amount: number) => {
    if (amount >= 1000) {
      return `${Math.round(amount / 1000)}k€`
    }
    return `${amount}€`
  }

  return (
    <Card
      className="p-3 bg-card/80 backdrop-blur-sm border-primary/10 shadow-sm hover:shadow-md transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={(e) => smartNavigate(e, `/etablissements/${etablissement.id}`)}
      role="button"
      tabIndex={0}
      aria-label={`Ouvrir la fiche établissement ${etablissement.nom}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          navigate(`/etablissements/${etablissement.id}`)
        }
      }}
    >
      <div className="space-y-3">
        {/* Header: Logo + Name + Health */}
        <div className="flex items-start gap-3">
          <EntityAvatar
            name={etablissement.nom}
            logoUrl={etablissement.logo_url || (etablissement as any).groupe_logo_url}
            size="sm"
          />
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm truncate">{etablissement.nom}</h3>
            <p className="text-xs text-muted-foreground truncate">{etablissement.type}</p>
          </div>
          {health && (
            <CustomerHealthIndicator
              status={health.status}
              score={health.score}
              healthData={health}
              size="sm"
              showScore
            />
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <p className="text-xs text-muted-foreground">CA</p>
            <p className="text-sm font-semibold">{revenue > 0 ? formatCurrency(revenue) : '-'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Durée</p>
            <p className="text-sm font-semibold">{monthsInProduction}m</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">NPS</p>
            <p className="text-sm font-semibold">
              {npsScore !== undefined && npsScore !== null ? (
                <span className="flex items-center justify-center gap-0.5">
                  {npsScore.toFixed(0)}
                  {npsScore > 8 ? '😊' : npsScore > 6 ? '😐' : '😞'}
                </span>
              ) : (
                '-'
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">CSM</p>
            <p className="text-sm font-semibold truncate">
              {etablissement.csm ? etablissement.csm.prenom?.charAt(0) : '-'}
            </p>
          </div>
        </div>

        {/* Adoption progress */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Adoption</span>
            <span className="font-medium">
              {adoptionRate > 0 ? `${adoptionRate.toFixed(0)}%` : '-'}
              {adoptionRate > 0 &&
                (adoptionRate >= 75 ? ' ✅' : adoptionRate >= 50 ? ' ⚠️' : ' ❌')}
            </span>
          </div>
          <Progress value={adoptionRate} className="h-1.5" />
        </div>
      </div>
    </Card>
  )
}
