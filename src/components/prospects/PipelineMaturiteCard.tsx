import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp } from 'lucide-react'
import { useTresoreriePrevisionnel } from '@/hooks/tresorerie/useTresoreriePrevisionnel'
import { useMemo } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value || 0)

const PIPELINE_LEVELS = [
  { label: 'Production', min: 1.0, max: 1.0 },
  { label: 'Contractuel', min: 0.8, max: 0.99 },
  { label: 'Négociation', min: 0.55, max: 0.79 },
  { label: 'Étude émise', min: 0.3, max: 0.54 },
  { label: 'Prospection', min: 0.01, max: 0.29 },
]

export function PipelineMaturiteCard() {
  const { etablissementsPrevisions, isLoading } = useTresoreriePrevisionnel()

  const niveaux = useMemo(
    () =>
      PIPELINE_LEVELS.map((level) => {
        const etabs = etablissementsPrevisions.filter(
          (e) => e.probabilite >= level.min && e.probabilite <= level.max
        )
        const montantMensuel = etabs.reduce((sum, e) => sum + e.revenuMensuelEstime, 0)
        return {
          label: level.label,
          count: etabs.length,
          montantMensuel,
          montantAnnuel: montantMensuel * 12,
        }
      }).filter((n) => n.count > 0),
    [etablissementsPrevisions]
  )

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          Pipeline par niveau de maturité
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-md" />
            ))}
          </div>
        ) : niveaux.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun établissement dans le pipeline.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {niveaux.map((niveau) => (
              <div key={niveau.label} className="rounded-md border p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate">{niveau.label}</span>
                  <Badge variant="secondary" className="shrink-0">
                    {niveau.count}
                  </Badge>
                </div>
                <p className="text-lg font-bold break-words">
                  {formatCurrency(niveau.montantAnnuel)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(niveau.montantMensuel)}/mois
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
