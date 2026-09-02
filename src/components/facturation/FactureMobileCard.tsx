import { Building2, Calendar, MoreVertical, FileText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { STATUT_FACTURE_LABELS, STATUT_FACTURE_COLORS } from '@/lib/tresorerie-labels'

interface FactureMobileCardProps {
  facture: {
    id: string
    numero: string
    client_nom: string
    montant_ttc: number
    date_emission: string
    date_echeance?: string | null
    statut: string
    etablissement?: { nom: string } | null
  }
  onEdit?: (id: string) => void
  onView?: (id: string) => void
  onDelete?: (id: string) => void
}

export function FactureMobileCard({ facture, onEdit, onView, onDelete }: FactureMobileCardProps) {
  const statutLabel = STATUT_FACTURE_LABELS[facture.statut] || facture.statut
  const statutColor = STATUT_FACTURE_COLORS[facture.statut] || 'bg-gray-100 text-foreground'

  const isOverdue =
    facture.date_echeance &&
    new Date(facture.date_echeance) < new Date() &&
    !['payee', 'encaissee', 'annulee'].includes(facture.statut)

  const handleCardClick = (e: React.MouseEvent) => {
    if (!onView) return
    if (
      (e.target as HTMLElement).closest('button, [role="menuitem"], [data-radix-collection-item]')
    )
      return
    onView(facture.id)
  }

  const handleCardKeyDown = (e: React.KeyboardEvent) => {
    if (!onView) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onView(facture.id)
    }
  }

  return (
    <Card
      className={cn(
        'bg-card/80 backdrop-blur-sm shadow-sm',
        isOverdue && 'border-l-4 border-l-red-500',
        onView &&
          'cursor-pointer hover:shadow-md transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
      )}
      onClick={handleCardClick}
      role={onView ? 'button' : undefined}
      tabIndex={onView ? 0 : undefined}
      aria-label={onView ? `Ouvrir la facture ${facture.numero}` : undefined}
      onKeyDown={handleCardKeyDown}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          {/* Left: Info */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Numéro + Client */}
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary shrink-0" />
              <span className="font-mono text-xs text-muted-foreground">{facture.numero}</span>
              <span className="font-medium text-sm truncate">{facture.client_nom}</span>
            </div>

            {/* Établissement */}
            {facture.etablissement && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Building2 className="h-3 w-3" />
                <span className="truncate">{facture.etablissement.nom}</span>
              </div>
            )}

            {/* Dates */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>
                  Émis:{' '}
                  {new Date(facture.date_emission).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: 'short',
                  })}
                </span>
              </div>
              {facture.date_echeance && (
                <div
                  className={cn('flex items-center gap-1', isOverdue && 'text-red-500 font-medium')}
                >
                  <span>
                    Éch:{' '}
                    {new Date(facture.date_echeance).toLocaleDateString('fr-FR', {
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
            <p className="text-base font-bold">{formatCurrency(facture.montant_ttc)}</p>

            <Badge className={cn('text-[10px] px-1.5 py-0.5', statutColor)}>{statutLabel}</Badge>

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
                  <DropdownMenuItem onClick={() => onView(facture.id)}>Voir</DropdownMenuItem>
                )}
                {onEdit && (
                  <DropdownMenuItem onClick={() => onEdit(facture.id)}>Modifier</DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem
                    onClick={() => onDelete(facture.id)}
                    className="text-destructive"
                  >
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
