import { useMemo } from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BarChart3, MapPin, Building2, TrendingUp } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { useSearchParams } from 'react-router-dom'
import type { Etablissement } from '@/hooks/crm/useEtablissements'

interface EtablissementsStatsPanelProps {
  etablissements: Etablissement[]
}

export function EtablissementsStatsPanel({ etablissements }: EtablissementsStatsPanelProps) {
  const [searchParams, setSearchParams] = useSearchParams()

  const stats = useMemo(() => {
    const byStatut: Record<string, number> = {}
    const byRegion: Record<string, number> = {}
    const byType: Record<string, number> = {}
    
    etablissements.forEach(etab => {
      byStatut[etab.statut] = (byStatut[etab.statut] || 0) + 1
      byRegion[etab.region] = (byRegion[etab.region] || 0) + 1
      byType[etab.type] = (byType[etab.type] || 0) + 1
    })

    const progressionMoyenne = etablissements.length > 0
      ? etablissements.reduce((acc, e) => acc + (e.progression || 0), 0) / etablissements.length
      : 0

    return {
      byStatut: Object.entries(byStatut).sort((a, b) => b[1] - a[1]),
      byRegion: Object.entries(byRegion).sort((a, b) => b[1] - a[1]).slice(0, 5),
      byType: Object.entries(byType).sort((a, b) => b[1] - a[1]),
      progressionMoyenne: Math.round(progressionMoyenne)
    }
  }, [etablissements])

  const handleFilterClick = (filterType: string, value: string) => {
    const newSearchParams = new URLSearchParams(searchParams)
    newSearchParams.set(filterType, value)
    setSearchParams(newSearchParams)
  }

  const maxStatut = Math.max(...stats.byStatut.map(s => s[1]))
  const maxRegion = Math.max(...stats.byRegion.map(r => r[1]))
  const maxType = Math.max(...stats.byType.map(t => t[1]))

  return (
    <Card>
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="stats" className="border-none">
          <AccordionTrigger className="px-6 hover:no-underline">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              <span className="font-semibold">Statistiques détaillées</span>
              <Badge variant="secondary">{etablissements.length} établissements</Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Répartition par statut */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Par statut
                </h4>
                <div className="space-y-2">
                  {stats.byStatut.map(([statut, count]) => (
                    <button
                      key={statut}
                      onClick={() => handleFilterClick('statut', statut)}
                      className="w-full text-left hover:bg-muted/50 rounded-md p-2 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm">{statut}</span>
                        <Badge variant="secondary">{count}</Badge>
                      </div>
                      <Progress value={(count / maxStatut) * 100} className="h-1.5" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Top 5 régions */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Top 5 régions
                </h4>
                <div className="space-y-2">
                  {stats.byRegion.map(([region, count]) => (
                    <button
                      key={region}
                      onClick={() => handleFilterClick('region', region)}
                      className="w-full text-left hover:bg-muted/50 rounded-md p-2 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm truncate">{region}</span>
                        <Badge variant="secondary">{count}</Badge>
                      </div>
                      <Progress value={(count / maxRegion) * 100} className="h-1.5" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Répartition par type */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Par type
                </h4>
                <div className="space-y-2">
                  {stats.byType.map(([type, count]) => (
                    <button
                      key={type}
                      onClick={() => handleFilterClick('type', type)}
                      className="w-full text-left hover:bg-muted/50 rounded-md p-2 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm">{type}</span>
                        <Badge variant="secondary">{count}</Badge>
                      </div>
                      <Progress value={(count / maxType) * 100} className="h-1.5" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Progression moyenne */}
            <div className="mt-6 p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Progression moyenne
                </h4>
                <span className="text-2xl font-bold">{stats.progressionMoyenne}%</span>
              </div>
              <Progress value={stats.progressionMoyenne} className="h-2" />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  )
}
