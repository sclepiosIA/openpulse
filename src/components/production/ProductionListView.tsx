import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { MoreVertical } from 'lucide-react'
import { EntityAvatar } from '@/components/ui/EntityAvatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useSmartNavigation } from '@/hooks/shared/useSmartNavigation'
import type { Etablissement } from '@/hooks/crm/useEtablissements'
import type { CustomerHealthScore } from '@/hooks/crm/useCustomerHealth'
import { CustomerHealthIndicator } from './CustomerHealthIndicator'
import { calculateEtablissementValue } from '@/lib/valueCalculations'

// Health metrics from customer_health_metrics table
interface HealthMetric {
  adoption_rate?: number;
  nps_score?: number;
  health_status?: string;
  health_score?: number;
}

interface ProductionListViewProps {
  etablissements: Etablissement[]
  healthScores: Map<string, CustomerHealthScore>
  healthMetrics?: Map<string, HealthMetric>
}

export function ProductionListView({ etablissements, healthScores, healthMetrics }: ProductionListViewProps) {
  const { smartNavigate, navigate } = useSmartNavigation()

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  return (
    <div className="overflow-x-auto -mx-3 sm:mx-0">
      <div className="border rounded-lg inline-block min-w-full">
        <Table className="min-w-[900px]">
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Santé</TableHead>
            <TableHead>Date Go-Live</TableHead>
            <TableHead>Durée</TableHead>
            <TableHead>CA annuel</TableHead>
            <TableHead>Adoption</TableHead>
            <TableHead>NPS</TableHead>
            <TableHead>CSM</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {etablissements.map(etab => {
            const health = healthScores.get(etab.id)
            const metrics = healthMetrics?.get(etab.id)
            const monthsInProduction = etab.date_go_live
              ? Math.max(0, Math.floor((Date.now() - new Date(etab.date_go_live).getTime()) / (1000 * 60 * 60 * 24 * 30)))
              : 0
            const revenue = calculateEtablissementValue(etab)
            const adoptionRate = metrics?.adoption_rate || 0
            const npsScore = metrics?.nps_score

            return (
              <TableRow
                key={etab.id}
                className="cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={(e) => smartNavigate(e, `/etablissements/${etab.id}`)}
                role="link"
                tabIndex={0}
                aria-label={`Ouvrir la fiche établissement ${etab.nom}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    navigate(`/etablissements/${etab.id}`)
                  }
                }}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <EntityAvatar name={etab.nom} logoUrl={etab.logo_url || (etab as any).groupe_logo_url} size="sm" />
                    <div>
                      <div className="font-medium">{etab.nom}</div>
                      <div className="text-xs text-muted-foreground">{etab.type}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {health && (
                    <CustomerHealthIndicator 
                      status={health.status}
                      score={health.score}
                      healthData={health}
                      size="sm"
                      showScore
                    />
                  )}
                </TableCell>
                <TableCell>
                  {etab.date_go_live ? (
                    <span className="text-sm font-medium text-success">
                      {new Date(etab.date_go_live).toLocaleDateString('fr-FR')}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">Non renseignée</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className="text-sm">{monthsInProduction} mois</span>
                </TableCell>
                <TableCell>
                  {revenue > 0 ? (
                    <span className="text-sm font-medium">{formatCurrency(revenue)}</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">Non renseigné</span>
                  )}
                </TableCell>
                <TableCell>
                  {adoptionRate > 0 ? (
                    <div className="flex items-center gap-1">
                      <span className="text-sm">{adoptionRate.toFixed(0)}%</span>
                      {adoptionRate >= 75 ? '✅' : adoptionRate >= 50 ? '⚠️' : '❌'}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {npsScore !== undefined && npsScore !== null ? (
                    <div className="flex items-center gap-1">
                      <span className="text-sm">{npsScore.toFixed(1)}</span>
                      {npsScore > 8 ? '😊' : npsScore > 6 ? '😐' : '😞'}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {etab.csm ? (
                    <span className="text-sm">{etab.csm.prenom} {etab.csm.nom}</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" aria-label="Plus d'options" title="Plus d'options">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/etablissements/${etab.id}`)
                      }}>
                        Voir les détails
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/etablissements/${etab.id}?tab=taches`)
                      }}>
                        Voir les tâches
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/etablissements/${etab.id}?tab=emails`)
                      }}>
                        Voir les emails
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      </div>
    </div>
  )
}
