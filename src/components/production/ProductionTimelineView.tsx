import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Rocket, PartyPopper } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { Etablissement } from '@/hooks/crm/useEtablissements'
import { CustomerHealthIndicator } from './CustomerHealthIndicator'
import type { CustomerHealthScore } from '@/hooks/crm/useCustomerHealth'

interface ProductionTimelineViewProps {
  etablissements: Etablissement[]
  healthScores: Map<string, CustomerHealthScore>
}

export function ProductionTimelineView({ etablissements, healthScores }: ProductionTimelineViewProps) {
  const navigate = useNavigate()

  // Grouper par année et mois
  const grouped = etablissements.reduce((acc, etab) => {
    if (!etab.date_go_live) return acc
    const date = new Date(etab.date_go_live)
    const year = date.getFullYear()
    const month = date.getMonth()
    const key = `${year}-${month}`
    
    if (!acc[key]) {
      acc[key] = {
        year,
        month,
        date: new Date(year, month, 1),
        etablissements: []
      }
    }
    acc[key].etablissements.push(etab)
    return acc
  }, {} as Record<string, { year: number; month: number; date: Date; etablissements: Etablissement[] }>)

  const timeline = Object.values(grouped).sort((a, b) => b.date.getTime() - a.date.getTime())

  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ]

  const getMonthsInProduction = (goLiveDate: string) => {
    return Math.max(0, Math.floor((Date.now() - new Date(goLiveDate).getTime()) / (1000 * 60 * 60 * 24 * 30)))
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Timeline des Go-Lives
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            {/* Ligne verticale */}
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />

            <div className="space-y-8">
              {timeline.map(({ year, month, etablissements: etabs }, groupIndex) => (
                <div key={`${year}-${month}`} className="relative pl-16">
                  {/* Point sur la timeline */}
                  <div className="absolute left-4 top-2 w-5 h-5 rounded-full bg-primary border-4 border-background" />
                  
                  {/* Date */}
                  <div className="mb-4">
                    <div className="text-lg font-semibold">{monthNames[month]} {year}</div>
                    <div className="text-sm text-muted-foreground">{etabs.length} go-live(s)</div>
                  </div>

                  {/* Établissements */}
                  <div className="space-y-3">
                  {etabs.map(etab => {
                      const health = healthScores.get(etab.id)
                      const monthsInProd = etab.date_go_live ? getMonthsInProduction(etab.date_go_live) : 0
                      const isAnniversary = monthsInProd > 0 && monthsInProd % 12 === 0
                      const isNew = monthsInProd < 3

                      return (
                        <div
                          key={etab.id}
                          role="link"
                          tabIndex={0}
                          aria-label={`Voir le détail de l'établissement ${etab.nom}`}
                          className="p-4 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                          onClick={() => navigate(`/etablissements/${etab.id}`)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/etablissements/${etab.id}`); } }}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium">{etab.nom}</span>
                                {health && (
                                  <CustomerHealthIndicator 
                                    status={health.status}
                                    score={health.score}
                                    size="sm"
                                  />
                                )}
                                {isNew && (
                                  <Badge variant="secondary" className="gap-1 bg-primary/10 text-primary">
                                    <Rocket className="w-3 h-3" />
                                    Nouveau
                                  </Badge>
                                )}
                                {isAnniversary && (
                                  <Badge variant="secondary" className="gap-1">
                                    <PartyPopper className="w-3 h-3" />
                                    {monthsInProd / 12} an(s)
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span>{etab.type}</span>
                                <span>•</span>
                                <span>{etab.ville}, {etab.region}</span>
                                <span>•</span>
                                <span>{monthsInProd} mois en production</span>
                              </div>
                              {etab.csm && (
                                <div className="text-sm text-muted-foreground">
                                  CSM: {etab.csm.prenom} {etab.csm.nom}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
