import { Building2, Calendar, MoreVertical, FileText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface DevisMobileCardProps {
  devis: {
    id: string
    numero: string
    client_nom: string
    montant_ttc: number
    date_emission: string
    date_validite?: string | null
    statut: string
    etablissement?: { nom: string } | null
  }
  onEdit?: (id: string) => void
  onView?: (id: string) => void
  onConvert?: (id: string) => void
  onDelete?: (id: string) => void
}

const statutColors: Record<string, string> = {
  brouillon: 'bg-gray-100 text-foreground',
  envoye: 'bg-blue-100 text-blue-700',
  accepte: 'bg-emerald-100 text-emerald-700',
  refuse: 'bg-red-100 text-red-700',
  expire: 'bg-amber-100 text-amber-700',
}

const statutLabels: Record<string, string> = {
  brouillon: 'Brouillon',
  envoye: 'Envoyé',
  accepte: 'Accepté',
  refuse: 'Refusé',
  expire: 'Expiré',
}

export function DevisMobileCard({
  devis,
  onEdit,
  onView,
  onConvert,
  onDelete,
}: DevisMobileCardProps) {
  const formatMontant = (montant: number) =>
    new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(montant)

  const isExpired =
    devis.date_validite && new Date(devis.date_validite) < new Date() && devis.statut === 'envoye'

  const handleCardClick = (e: React.MouseEvent) => {
    if (!onView) return
    if (
      (e.target as HTMLElement).closest('button, [role="menuitem"], [data-radix-collection-item]')
    )
      return
    onView(devis.id)
  }

  const handleCardKeyDown = (e: React.KeyboardEvent) => {
    if (!onView) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onView(devis.id)
    }
  }

  return (
    <Card
      className={cn(
        'bg-card/80 backdrop-blur-sm shadow-sm',
        isExpired && 'border-l-4 border-l-amber-500',
        onView &&
          'cursor-pointer hover:shadow-md transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
      )}
      onClick={handleCardClick}
      role={onView ? 'button' : undefined}
      tabIndex={onView ? 0 : undefined}
      aria-label={onView ? `Ouvrir le devis ${devis.numero}` : undefined}
      onKeyDown={handleCardKeyDown}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          {/* Left: Info */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Numéro + Client */}
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-500 shrink-0" />
              <span className="font-mono text-xs text-muted-foreground">{devis.numero}</span>
              <span className="font-medium text-sm truncate">{devis.client_nom}</span>
            </div>

            {/* Établissement */}
            {devis.etablissement && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Building2 className="h-3 w-3" />
                <span className="truncate">{devis.etablissement.nom}</span>
              </div>
            )}

            {/* Dates */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>
                  Émis:{' '}
                  {new Date(devis.date_emission).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: 'short',
                  })}
                </span>
              </div>
              {devis.date_validite && (
                <div
                  className={cn(
                    'flex items-center gap-1',
                    isExpired && 'text-amber-600 font-medium'
                  )}
                >
                  <span>
                    Val:{' '}
                    {new Date(devis.date_validite).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Montant + Status + Actions */}
          <div className="flex flex-col items-end gap-2">
            <p className="text-base font-bold text-blue-600">{formatMontant(devis.montant_ttc)}</p>

            <Badge
              className={cn(
                'text-[10px] px-1.5 py-0.5',
                statutColors[devis.statut] || 'bg-gray-100 text-foreground'
              )}
            >
              {statutLabels[devis.statut] || devis.statut}
            </Badge>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Plus d'options"
                  title="Plus d'options"
                  className="h-6 w-6 p-0"
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card">
                {onView && (
                  <DropdownMenuItem onClick={() => onView(devis.id)}>Voir</DropdownMenuItem>
                )}
                {onEdit && (
                  <DropdownMenuItem onClick={() => onEdit(devis.id)}>Modifier</DropdownMenuItem>
                )}
                {onConvert && devis.statut === 'accepte' && (
                  <DropdownMenuItem onClick={() => onConvert(devis.id)}>
                    Convertir en facture
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem onClick={() => onDelete(devis.id)} className="text-destructive">
                    Supprimer
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
