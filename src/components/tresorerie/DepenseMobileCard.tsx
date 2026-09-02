import { Building2, Calendar, MoreVertical, Tag } from 'lucide-react'
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

interface DepenseMobileCardProps {
  depense: {
    id: string
    libelle: string
    montant: number
    date_operation: string
    categorie?: string | null
    sous_categorie?: string | null
    statut: string
    fournisseur?: string | null
  }
  onEdit?: (id: string) => void
  onDelete?: (id: string) => void
}

const statutColors: Record<string, string> = {
  prevu: 'bg-blue-100 text-blue-700',
  realise: 'bg-emerald-100 text-emerald-700',
  comptabilise: 'bg-violet-100 text-violet-700',
}

const statutLabels: Record<string, string> = {
  prevu: 'Prévu',
  realise: 'Réalisé',
  comptabilise: 'Comptabilisé',
}

export function DepenseMobileCard({ depense, onEdit, onDelete }: DepenseMobileCardProps) {
  const formatMontant = (montant: number) =>
    new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(montant)

  const isOverdue = new Date(depense.date_operation) < new Date() && depense.statut === 'prevu'

  return (
    <Card
      className={cn(
        'bg-card/80 backdrop-blur-sm shadow-sm',
        isOverdue && 'border-l-4 border-l-red-500'
      )}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          {/* Left: Info */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Libellé */}
            <p className="font-medium text-sm line-clamp-1">{depense.libelle}</p>

            {/* Fournisseur + Catégorie */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {depense.fournisseur && (
                <div className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  <span className="truncate max-w-[100px]">{depense.fournisseur}</span>
                </div>
              )}
              {depense.categorie && (
                <div className="flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  <span className="truncate max-w-[80px]">{depense.categorie}</span>
                </div>
              )}
            </div>

            {/* Date */}
            <div
              className={cn(
                'flex items-center gap-1 text-xs',
                isOverdue ? 'text-red-500' : 'text-muted-foreground'
              )}
            >
              <Calendar className="h-3 w-3" />
              {new Date(depense.date_operation).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </div>
          </div>

          {/* Right: Montant + Status + Actions */}
          <div className="flex flex-col items-end gap-2">
            <p className="text-base font-bold text-red-600">-{formatMontant(depense.montant)}</p>

            <Badge
              className={cn(
                'text-[10px] px-1.5 py-0.5',
                statutColors[depense.statut] || 'bg-gray-100 text-foreground'
              )}
            >
              {statutLabels[depense.statut] || depense.statut}
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
                {onEdit && (
                  <DropdownMenuItem onClick={() => onEdit(depense.id)}>Modifier</DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem
                    onClick={() => onDelete(depense.id)}
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
