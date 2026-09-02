import { Calendar, MoreVertical, Tag } from 'lucide-react'
import { linkify } from '@/lib/linkify'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface RevenuMobileCardProps {
  revenu: {
    id: string
    mois: string
    date_prevue?: string | null
    montant_prevu: number
    notes?: string | null
    categorie_label?: string | null
  }
  onEdit?: (id: string) => void
  onDelete?: (id: string) => void
}

export function RevenuMobileCard({ revenu, onEdit, onDelete }: RevenuMobileCardProps) {
  const formatMontant = (montant: number) =>
    new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(montant)

  const formatDate = () => {
    const dateStr = revenu.date_prevue || revenu.mois
    try {
      const d = new Date(dateStr.length === 7 ? dateStr + '-01' : dateStr)
      return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    } catch {
      return dateStr
    }
  }

  return (
    <Card className="bg-card/80 backdrop-blur-sm shadow-sm">
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0 space-y-2">
            {/* Date + Montant */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground">{formatDate()}</span>
              </div>
              <p className="text-sm font-bold">{formatMontant(revenu.montant_prevu)}</p>
            </div>

            {/* Catégorie */}
            {revenu.categorie_label && (
              <div className="flex items-center gap-2">
                <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground truncate">
                  {revenu.categorie_label}
                </span>
              </div>
            )}

            {/* Intitulé Qonto */}
            {revenu.notes && (
              <p className="text-xs text-muted-foreground truncate">{linkify(revenu.notes)}</p>
            )}
          </div>

          {(onEdit || onDelete) && (
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
              <DropdownMenuContent align="end" className="bg-popover">
                {onEdit && (
                  <DropdownMenuItem onClick={() => onEdit(revenu.id)}>Modifier</DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem
                    onClick={() => onDelete(revenu.id)}
                    className="text-destructive"
                  >
                    Supprimer
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
