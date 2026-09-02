import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DeploymentHealthIndicator } from './DeploymentHealthIndicator'
import type { Etablissement } from '@/hooks/crm/useEtablissements'
import type { HealthScore } from '@/hooks/production/useDeploymentHealth'

interface DeploymentTimelineViewProps {
  etablissements: Etablissement[]
  healthScores: Map<string, HealthScore>
}

// Phases de déploiement dans l'ordre
const DEPLOYMENT_PHASES = [
  { key: 'Contractuel', label: 'Contractuel', color: 'bg-blue-500' },
  { key: 'Conformité', label: 'Conformité', color: 'bg-yellow-500' },
  { key: 'Déploiement', label: 'Déploiement', color: 'bg-purple-500' },
  { key: 'Formation', label: 'Formation', color: 'bg-green-500' },
  { key: 'Go-Live', label: 'Go-Live', color: 'bg-emerald-500' },
]

export function DeploymentTimelineView({ etablissements, healthScores }: DeploymentTimelineViewProps) {
  const navigate = useNavigate()

  // Grouper les établissements par phase
  const timelineData = useMemo(() => {
    return DEPLOYMENT_PHASES.map(phase => ({
      ...phase,
      etablissements: etablissements.filter(e => e.statut === phase.key)
    }))
  }, [etablissements])

  const getStatutBorderColor = (statut: string) => {
    switch (statut) {
      case 'Contractuel': return 'border-l-blue-500'
      case 'Conformité': return 'border-l-yellow-500'
      case 'Déploiement': return 'border-l-purple-500'
      case 'Formation': return 'border-l-green-500'
      case 'Go-Live': return 'border-l-emerald-500'
      default: return 'border-l-gray-500'
    }
  }

  return (
    <div className="relative">
      {/* Ligne de temps verticale */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

      <div className="space-y-8">
        {timelineData.map(({ key, label, color, etablissements: phaseEtabs }) => (
          <div key={key} className="relative pl-12">
            {/* Point sur la timeline avec couleur de la phase */}
            <div className={`absolute left-2.5 w-3 h-3 rounded-full ${color} border-2 border-background`} />

            {/* Contenu de la phase */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold">{label}</h3>
                <Badge variant="secondary" className="text-xs">
                  {phaseEtabs.length} établissement{phaseEtabs.length > 1 ? 's' : ''}
                </Badge>
              </div>
              
              {phaseEtabs.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Aucun établissement dans cette phase</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {phaseEtabs.map(etablissement => {
                    const health = healthScores.get(etablissement.id)
                    
                    return (
                      <Card
                        key={etablissement.id}
                        role="link"
                        tabIndex={0}
                        aria-label={`Voir le détail de l'établissement ${etablissement.nom}`}
                        className={`border-l-4 ${getStatutBorderColor(etablissement.statut)} hover:shadow-md transition-shadow cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary`}
                        onClick={() => navigate(`/etablissements/${etablissement.id}`)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/etablissements/${etablissement.id}`); } }}
                      >
                        <CardContent className="pt-4 pb-3">
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="font-semibold text-sm line-clamp-1">{etablissement.nom}</h4>
                              {health && (
                                <DeploymentHealthIndicator
                                  status={health.status}
                                  score={health.score}
                                  reasons={health.reasons}
                                  size="sm"
                                />
                              )}
                            </div>
                            
                            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                              <span>{etablissement.type}</span>
                              <span>•</span>
                              <span>{etablissement.ville}</span>
                            </div>

                            {/* Barre de progression */}
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Progression</span>
                                <span className="font-medium">
                                  {Math.round(etablissement.progression || 0)}%
                                </span>
                              </div>
                              <div className="w-full bg-muted rounded-full h-1.5">
                                <div
                                  className="bg-primary h-1.5 rounded-full transition-all"
                                  style={{ width: `${etablissement.progression || 0}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
