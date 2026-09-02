import { Building2, Calendar, MoreVertical, FileSignature, User } from 'lucide-react'
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

interface ContratMobileCardProps {
  contrat: {
    id: string
    numero: string
    titre: string
    client_nom?: string | null
    montant_annuel?: number | null
    date_debut: string
    date_fin?: string | null
    statut: string
    type_contrat?: string | null
    etablissement?: { nom: string } | null
  }
  onEdit?: (id: string) => void
  onView?: (id: string) => void
  onDelete?: (id: string) => void
}

const statutColors: Record<string, string> = {
  brouillon: 'bg-gray-100 text-foreground',
  en_attente: 'bg-blue-100 text-blue-700',
  actif: 'bg-emerald-100 text-emerald-700',
  expire: 'bg-amber-100 text-amber-700',
  resilie: 'bg-red-100 text-red-700',
}

const statutLabels: Record<string, string> = {
  brouillon: 'Brouillon',
  en_attente: 'En attente',
  actif: 'Actif',
  expire: 'Expiré',
  resilie: 'Résilié',
}

const typeColors: Record<string, string> = {
  licence: 'bg-violet-100 text-violet-700',
  maintenance: 'bg-blue-100 text-blue-700',
  support: 'bg-cyan-100 text-cyan-700',
  formation: 'bg-emerald-100 text-emerald-700',
}

export function ContratMobileCard({ contrat, onEdit, onView, onDelete }: ContratMobileCardProps) {
  const formatMontant = (montant: number) =>
    new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(montant)

  const isExpiringSoon =
    contrat.date_fin &&
    new Date(contrat.date_fin) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) &&
    contrat.statut === 'actif'

  const handleCardClick = (e: React.MouseEvent) => {
    if (!onView) return
    if (
      (e.target as HTMLElement).closest('button, [role="menuitem"], [data-radix-collection-item]')
    )
      return
    onView(contrat.id)
  }

  const handleCardKeyDown = (e: React.KeyboardEvent) => {
    if (!onView) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onView(contrat.id)
    }
  }

  return (
    <Card
      className={cn(
        'bg-card/80 backdrop-blur-sm shadow-sm',
        isExpiringSoon && 'border-l-4 border-l-amber-500',
        onView &&
          'cursor-pointer hover:shadow-md transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
      )}
      onClick={handleCardClick}
      role={onView ? 'button' : undefined}
      tabIndex={onView ? 0 : undefined}
      aria-label={onView ? `Ouvrir le contrat ${contrat.numero}` : undefined}
      onKeyDown={handleCardKeyDown}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          {/* Left: Info */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Numéro + Titre */}
            <div className="flex items-center gap-2">
              <FileSignature className="h-4 w-4 text-primary shrink-0" />
              <span className="font-mono text-xs text-muted-foreground">{contrat.numero}</span>
            </div>
            <p className="font-medium text-sm line-clamp-1">{contrat.titre}</p>

            {/* Client + Établissement */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {contrat.client_nom && (
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  <span className="truncate max-w-[80px]">{contrat.client_nom}</span>
                </div>
              )}
              {contrat.etablissement && (
                <div className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  <span className="truncate max-w-[80px]">{contrat.etablissement.nom}</span>
                </div>
              )}
            </div>

            {/* Dates */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>
                {new Date(contrat.date_debut).toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: 'short',
                  year: '2-digit',
                })}
              </span>
              {contrat.date_fin && (
                <>
                  <span>→</span>
                  <span className={cn(isExpiringSoon && 'text-amber-600 font-medium')}>
                    {new Date(contrat.date_fin).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: 'short',
                      year: '2-digit',
                    })}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Right: Montant + Status + Actions */}
          <div className="flex flex-col items-end gap-2">
            {contrat.montant_annuel && (
              <p className="text-base font-bold">
                {formatMontant(contrat.montant_annuel)}
                <span className="text-xs font-normal text-muted-foreground">/an</span>
              </p>
            )}

            <div className="flex flex-col items-end gap-1">
              {contrat.type_contrat && (
                <Badge
                  className={cn(
                    'text-[10px] px-1.5 py-0.5',
                    typeColors[contrat.type_contrat] || 'bg-gray-100 text-foreground'
                  )}
                >
                  {contrat.type_contrat}
                </Badge>
              )}
              <Badge
                className={cn(
                  'text-[10px] px-1.5 py-0.5',
                  statutColors[contrat.statut] || 'bg-gray-100 text-foreground'
                )}
              >
                {statutLabels[contrat.statut] || contrat.statut}
              </Badge>
            </div>

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
                  <DropdownMenuItem onClick={() => onView(contrat.id)}>Voir</DropdownMenuItem>
                )}
                {onEdit && (
                  <DropdownMenuItem onClick={() => onEdit(contrat.id)}>Modifier</DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem
                    onClick={() => onDelete(contrat.id)}
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
