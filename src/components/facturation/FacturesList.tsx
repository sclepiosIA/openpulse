import { useState } from 'react'
import { CRMTableWrapper } from '@/components/layout/CRMTableWrapper'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Search,
  Plus,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  Receipt,
  Send,
  Download,
  Building2,
  CreditCard,
  AlertTriangle,
} from 'lucide-react'
import { formatCurrency } from '@/lib/formatters'
import { useFactures } from '@/hooks/billing/useFactures'
import { format, parseISO, differenceInDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import { FACTURE_STATUT_LABELS, FACTURE_STATUT_COLORS, FactureStatut } from '@/types/facturation'
import { FactureDetailDialog } from './FactureDetailDialog'
import { FactureFormDialog } from './FactureFormDialog'
import { PaiementDialog } from './PaiementDialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface FacturesListProps {
  onCreateNew: () => void
}

export function FacturesList({ onCreateNew }: FacturesListProps) {
  const [search, setSearch] = useState('')
  const [statutFilter, setStatutFilter] = useState<string>('all')
  const [selectedFactureId, setSelectedFactureId] = useState<string | null>(null)
  const [editingFactureId, setEditingFactureId] = useState<string | null>(null)
  const [deletingFactureId, setDeletingFactureId] = useState<string | null>(null)
  const [payingFactureId, setPayingFactureId] = useState<string | null>(null)

  const { factures, deleteFacture, isDeleting } = useFactures({
    statut: statutFilter !== 'all' ? (statutFilter as FactureStatut) : undefined,
  })

  const filteredFactures = factures.filter((f) => {
    if (search) {
      const searchLower = search.toLowerCase()
      return (
        f.numero?.toLowerCase().includes(searchLower) ||
        f.client_nom.toLowerCase().includes(searchLower) ||
        f.etablissement?.nom?.toLowerCase().includes(searchLower)
      )
    }
    return true
  })

  const getEcheanceStatus = (dateEcheance: string, statut: string) => {
    if (['payee', 'annulee'].includes(statut)) return null
    const jours = differenceInDays(parseISO(dateEcheance), new Date())
    if (jours < 0)
      return {
        label: `${Math.abs(jours)}j de retard`,
        variant: 'destructive' as const,
        isLate: true,
      }
    if (jours <= 7)
      return { label: `${jours}j restants`, variant: 'secondary' as const, isLate: false }
    return null
  }

  const handleDelete = async () => {
    if (!deletingFactureId) return
    try {
      await deleteFacture(deletingFactureId)
      setDeletingFactureId(null)
    } catch (error) {
      // Error handled in hook
    }
  }

  return (
    <>
      <Card className="bg-card/80 backdrop-blur-sm border-l-4 border-l-success border-success/10 shadow-lg">
        <CardHeader className="border-b border-border/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="text-lg flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-success/20 rounded-full blur-md opacity-60" />
                <div className="relative p-2 rounded-full bg-gradient-to-br from-success/20 to-success/5 ring-2 ring-success/20">
                  <Receipt className="h-4 w-4 text-success" />
                </div>
              </div>
              Liste des factures
            </CardTitle>
            <Button
              size="sm"
              onClick={onCreateNew}
              className="h-9 rounded-xl bg-success hover:bg-success/90 transition-colors"
            >
              <Plus className="h-4 w-4 mr-1" />
              Nouvelle facture
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {/* Filtres */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par numéro, client..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 rounded-xl border-primary/10 focus:border-success/40"
              />
            </div>
            <Select value={statutFilter} onValueChange={setStatutFilter}>
              <SelectTrigger className="w-full sm:w-[180px] rounded-xl border-primary/10">
                <SelectValue placeholder="Tous les statuts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                {Object.entries(FACTURE_STATUT_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <CRMTableWrapper withCard={false} minWidth="900px">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numéro</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="hidden md:table-cell">Date</TableHead>
                  <TableHead className="hidden lg:table-cell">Échéance</TableHead>
                  <TableHead>Montant TTC</TableHead>
                  <TableHead className="hidden sm:table-cell">Payé</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFactures.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Aucune facture trouvée
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredFactures.map((f) => {
                    const echeanceStatus = getEcheanceStatus(f.date_echeance, f.statut)
                    const resteAPayer = (f.montant_ttc || 0) - (f.montant_paye || 0)

                    return (
                      <TableRow
                        key={f.id}
                        className="cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => setSelectedFactureId(f.id)}
                        role="link"
                        tabIndex={0}
                        aria-label={`Ouvrir la facture ${f.numero || 'brouillon'}`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setSelectedFactureId(f.id)
                          }
                        }}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {echeanceStatus?.isLate && (
                              <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                            )}
                            {f.numero || (
                              <span className="text-muted-foreground italic">Brouillon</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {f.etablissement && (
                              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="truncate font-medium">{f.client_nom}</p>
                              {f.etablissement && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {f.etablissement.nom}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {format(parseISO(f.date_emission), 'dd MMM yyyy', { locale: fr })}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="flex items-center gap-2">
                            {format(parseISO(f.date_echeance), 'dd MMM', { locale: fr })}
                            {echeanceStatus && (
                              <Badge variant={echeanceStatus.variant} className="text-xs">
                                {echeanceStatus.label}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(f.montant_ttc)}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <span
                            className={
                              resteAPayer > 0
                                ? 'text-muted-foreground'
                                : 'text-green-600 font-medium'
                            }
                          >
                            {formatCurrency(f.montant_paye || 0)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge className={FACTURE_STATUT_COLORS[f.statut]}>
                            {FACTURE_STATUT_LABELS[f.statut]}
                          </Badge>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                aria-label="Plus d'options"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setSelectedFactureId(f.id)}>
                                <Eye className="h-4 w-4 mr-2" />
                                Voir le détail
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setEditingFactureId(f.id)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Modifier
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Download className="h-4 w-4 mr-2" />
                                Télécharger PDF
                              </DropdownMenuItem>
                              {f.statut === 'brouillon' && (
                                <DropdownMenuItem>
                                  <Send className="h-4 w-4 mr-2" />
                                  Envoyer
                                </DropdownMenuItem>
                              )}
                              {!['payee', 'annulee'].includes(f.statut) && resteAPayer > 0 && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => setPayingFactureId(f.id)}>
                                    <CreditCard className="h-4 w-4 mr-2" />
                                    Enregistrer un paiement
                                  </DropdownMenuItem>
                                </>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setDeletingFactureId(f.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </CRMTableWrapper>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <FactureDetailDialog
        factureId={selectedFactureId}
        open={!!selectedFactureId}
        onOpenChange={(open) => !open && setSelectedFactureId(null)}
      />

      <FactureFormDialog
        factureId={editingFactureId}
        open={!!editingFactureId}
        onOpenChange={(open) => !open && setEditingFactureId(null)}
      />

      <PaiementDialog
        factureId={payingFactureId}
        open={!!payingFactureId}
        onOpenChange={(open) => !open && setPayingFactureId(null)}
      />

      <ConfirmDialog
        open={!!deletingFactureId}
        onOpenChange={(open) => !open && setDeletingFactureId(null)}
        title="Supprimer la facture"
        description="Êtes-vous sûr de vouloir supprimer cette facture ? Cette action est irréversible."
        confirmText="Supprimer"
        variant="destructive"
        onConfirm={handleDelete}
        loading={isDeleting}
      />
    </>
  )
}
