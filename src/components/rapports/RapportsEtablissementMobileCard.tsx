import { Building2, MapPin, User, TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface RapportsEtablissementMobileCardProps {
  etablissement: {
    id: string
    nom: string
    region?: string | null
    statut?: string | null
    responsable?: { full_name?: string | null } | null
    valeur_ponderee?: number | null
    passages?: number | null
    adoption_rate?: number | null
  }
  onClick?: (id: string) => void
}

const statutColors: Record<string, string> = {
  prospect: 'bg-blue-100 text-blue-700',
  demo: 'bg-violet-100 text-violet-700',
  negociation: 'bg-amber-100 text-amber-700',
  contractuel: 'bg-emerald-100 text-emerald-700',
  production: 'bg-cyan-100 text-cyan-700',
  perdu: 'bg-red-100 text-red-700',
}

export function RapportsEtablissementMobileCard({
  etablissement,
  onClick,
}: RapportsEtablissementMobileCardProps) {
  const formatMontant = (montant: number) =>
    new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(montant)

  const adoptionRate = etablissement.adoption_rate ?? 0

  const handleClick = () => onClick?.(etablissement.id)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!onClick) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }

  return (
    <Card
      className={cn(
        'bg-card/80 backdrop-blur-sm shadow-sm transition-shadow',
        onClick &&
          'cursor-pointer hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
      )}
      onClick={handleClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? `Ouvrir la fiche établissement ${etablissement.nom}` : undefined}
      onKeyDown={handleKeyDown}
    >
      <CardContent className="p-3">
        <div className="space-y-2">
          {/* Nom + Region */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary shrink-0" />
                <p className="font-medium text-sm line-clamp-1">{etablissement.nom}</p>
              </div>
              {etablissement.region && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <MapPin className="h-3 w-3" />
                  <span className="truncate">{etablissement.region}</span>
                </div>
              )}
            </div>

            {etablissement.statut && (
              <Badge
                className={cn(
                  'text-[10px] px-1.5 py-0.5 shrink-0',
                  statutColors[etablissement.statut] || 'bg-gray-100 text-foreground'
                )}
              >
                {etablissement.statut}
              </Badge>
            )}
          </div>

          {/* Stats row */}
          <div className="flex items-center justify-between gap-2 pt-1">
            {/* Responsable */}
            {etablissement.responsable?.full_name && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <User className="h-3 w-3" />
                <span className="truncate max-w-[80px]">{etablissement.responsable.full_name}</span>
              </div>
            )}

            {/* Valeur + Passages */}
            <div className="flex items-center gap-3 text-xs">
              {etablissement.valeur_ponderee !== null &&
                etablissement.valeur_ponderee !== undefined && (
                  <div className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-emerald-500" />
                    <span className="font-semibold">
                      {formatMontant(etablissement.valeur_ponderee)}
                    </span>
                  </div>
                )}
              {etablissement.passages !== null && etablissement.passages !== undefined && (
                <span className="text-muted-foreground">{etablissement.passages} pass.</span>
              )}
            </div>
          </div>

          {/* Progression bar */}
          {adoptionRate > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    adoptionRate >= 80
                      ? 'bg-emerald-500'
                      : adoptionRate >= 50
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                  )}
                  style={{ width: `${Math.min(adoptionRate, 100)}%` }}
                />
              </div>
              <span className="text-xs font-medium text-muted-foreground w-10 text-right">
                {adoptionRate}%
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
