import { useState } from 'react'
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
  FileText,
  Send,
  ArrowRight,
  Download,
  Building2,
} from 'lucide-react'
import { formatCurrency } from '@/lib/formatters'
import { useDevis } from '@/hooks/contracts/useDevis'
import { format, parseISO, differenceInDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import { DEVIS_STATUT_LABELS, DEVIS_STATUT_COLORS, DevisStatut } from '@/types/facturation'
import { DevisDetailDialog } from './DevisDetailDialog'
import { DevisFormDialog } from './DevisFormDialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/hooks/shared/use-toast'

interface DevisListProps {
  onCreateNew: () => void
}

export function DevisList({ onCreateNew }: DevisListProps) {
  const [search, setSearch] = useState('')
  const [statutFilter, setStatutFilter] = useState<string>('all')
  const [selectedDevisId, setSelectedDevisId] = useState<string | null>(null)
  const [editingDevisId, setEditingDevisId] = useState<string | null>(null)
  const [deletingDevisId, setDeletingDevisId] = useState<string | null>(null)

  const { devis, deleteDevis, convertToFacture, isDeleting, isConverting } = useDevis({
    statut: statutFilter !== 'all' ? (statutFilter as DevisStatut) : undefined,
  })
  const { toast } = useToast()

  const filteredDevis = devis.filter((d) => {
    if (search) {
      const searchLower = search.toLowerCase()
      return (
        d.numero?.toLowerCase().includes(searchLower) ||
        d.client_nom.toLowerCase().includes(searchLower) ||
        d.etablissement?.nom?.toLowerCase().includes(searchLower)
      )
    }
    return true
  })

  const getValiditeStatus = (dateValidite: string) => {
    const jours = differenceInDays(parseISO(dateValidite), new Date())
    if (jours < 0) return { label: 'Expiré', variant: 'destructive' as const }
    if (jours <= 7) return { label: `${jours}j restants`, variant: 'secondary' as const }
    return null
  }

  const handleDelete = async () => {
    if (!deletingDevisId) return
    try {
      await deleteDevis(deletingDevisId)
      setDeletingDevisId(null)
    } catch (error) {
      // Error handled in hook
    }
  }

  const handleConvert = async (devisId: string) => {
    try {
      await convertToFacture(devisId)
      toast({ title: 'Devis converti en facture avec succès' })
    } catch (error) {
      // Error handled in hook
    }
  }

  return (
    <>
      <Card className="bg-card/80 backdrop-blur-sm border-l-4 border-l-blue-500 border-blue-500/10 shadow-lg">
        <CardHeader className="border-b border-border/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="text-lg flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-md opacity-60" />
                <div className="relative p-2 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-500/5 ring-2 ring-blue-500/20">
                  <FileText className="h-4 w-4 text-blue-500" />
                </div>
              </div>
              Liste des devis
            </CardTitle>
            <Button
              size="sm"
              onClick={onCreateNew}
              className="h-9 rounded-xl bg-blue-500 hover:bg-blue-600 transition-colors"
            >
              <Plus className="h-4 w-4 mr-1" />
              Nouveau devis
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
                className="pl-9 rounded-xl border-primary/10 focus:border-blue-500/40"
              />
            </div>
            <Select value={statutFilter} onValueChange={setStatutFilter}>
              <SelectTrigger className="w-full sm:w-[180px] rounded-xl border-primary/10">
                <SelectValue placeholder="Tous les statuts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                {Object.entries(DEVIS_STATUT_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numéro</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="hidden md:table-cell">Date</TableHead>
                  <TableHead className="hidden lg:table-cell">Validité</TableHead>
                  <TableHead>Montant TTC</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDevis.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Aucun devis trouvé
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDevis.map((d) => {
                    const validiteStatus =
                      d.statut !== 'expire' && d.statut !== 'converti'
                        ? getValiditeStatus(d.date_validite)
                        : null

                    return (
                      <TableRow
                        key={d.id}
                        className="cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => setSelectedDevisId(d.id)}
                        role="link"
                        tabIndex={0}
                        aria-label={`Ouvrir le devis ${d.numero || 'brouillon'}`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setSelectedDevisId(d.id)
                          }
                        }}
                      >
                        <TableCell className="font-medium">
                          {d.numero || (
                            <span className="text-muted-foreground italic">Brouillon</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {d.etablissement && (
                              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="truncate font-medium">{d.client_nom}</p>
                              {d.etablissement && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {d.etablissement.nom}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {format(parseISO(d.date_emission), 'dd MMM yyyy', { locale: fr })}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="flex items-center gap-2">
                            {format(parseISO(d.date_validite), 'dd MMM', { locale: fr })}
                            {validiteStatus && (
                              <Badge variant={validiteStatus.variant} className="text-xs">
                                {validiteStatus.label}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(d.montant_ttc)}
                        </TableCell>
                        <TableCell>
                          <Badge className={DEVIS_STATUT_COLORS[d.statut]}>
                            {DEVIS_STATUT_LABELS[d.statut]}
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
                              <DropdownMenuItem onClick={() => setSelectedDevisId(d.id)}>
                                <Eye className="h-4 w-4 mr-2" />
                                Voir le détail
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setEditingDevisId(d.id)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Modifier
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Download className="h-4 w-4 mr-2" />
                                Télécharger PDF
                              </DropdownMenuItem>
                              {d.statut === 'brouillon' && (
                                <DropdownMenuItem>
                                  <Send className="h-4 w-4 mr-2" />
                                  Envoyer
                                </DropdownMenuItem>
                              )}
                              {d.statut === 'accepte' && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleConvert(d.id)}
                                    disabled={isConverting}
                                  >
                                    <ArrowRight className="h-4 w-4 mr-2" />
                                    Convertir en facture
                                  </DropdownMenuItem>
                                </>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setDeletingDevisId(d.id)}
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
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <DevisDetailDialog
        devisId={selectedDevisId}
        open={!!selectedDevisId}
        onOpenChange={(open) => !open && setSelectedDevisId(null)}
      />

      <DevisFormDialog
        devisId={editingDevisId}
        open={!!editingDevisId}
        onOpenChange={(open) => !open && setEditingDevisId(null)}
      />

      <ConfirmDialog
        open={!!deletingDevisId}
        onOpenChange={(open) => !open && setDeletingDevisId(null)}
        title="Supprimer le devis"
        description="Êtes-vous sûr de vouloir supprimer ce devis ? Cette action est irréversible."
        confirmText="Supprimer"
        variant="destructive"
        onConfirm={handleDelete}
        loading={isDeleting}
      />
    </>
  )
}
