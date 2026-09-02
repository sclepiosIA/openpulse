import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Plus, Trash2, TrendingUp, TrendingDown } from 'lucide-react'
import {
  useBudgets,
  useBudgetLignes,
  useBudgetVsReel,
  useCreateBudget,
  useUpsertBudgetLigne,
  useDeleteBudget,
} from '@/hooks/compta/useBudget'
import { useComptaComptes, useComptaExercices } from '@/hooks/compta/useCompta'
import { toast } from 'sonner'

const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
const eur = (n: number) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n || 0)

export function BudgetTab() {
  const { data: budgets } = useBudgets()
  const { data: exercices } = useComptaExercices()
  const { data: comptes } = useComptaComptes()
  const [selBudget, setSelBudget] = useState<string | null>(null)
  const [openNew, setOpenNew] = useState(false)
  const create = useCreateBudget()
  const del = useDeleteBudget()
  const [newLib, setNewLib] = useState('')
  const [newEx, setNewEx] = useState<string | undefined>()

  const budgetSel = budgets?.find((b) => b.id === selBudget) || null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Select value={selBudget || undefined} onValueChange={setSelBudget}>
          <SelectTrigger className="w-80">
            <SelectValue placeholder="Sélectionner un budget" />
          </SelectTrigger>
          <SelectContent>
            {budgets?.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.libelle} ({b.statut})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          {selBudget && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (confirm('Supprimer ce budget ?')) {
                  del.mutate(selBudget)
                  setSelBudget(null)
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nouveau budget
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nouveau budget</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Libellé</Label>
                  <Input value={newLib} onChange={(e) => setNewLib(e.target.value)} />
                </div>
                <div>
                  <Label>Exercice</Label>
                  <Select value={newEx} onValueChange={setNewEx}>
                    <SelectTrigger>
                      <SelectValue placeholder="Exercice" />
                    </SelectTrigger>
                    <SelectContent>
                      {exercices?.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.libelle}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={async () => {
                    if (!newLib) return toast.error('Libellé requis')
                    const b = await create.mutateAsync({ libelle: newLib, exercice_id: newEx })
                    setSelBudget((b as any).id)
                    setOpenNew(false)
                    setNewLib('')
                    setNewEx(undefined)
                  }}
                >
                  Créer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {!selBudget && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Sélectionnez ou créez un budget pour commencer.
          </CardContent>
        </Card>
      )}
      {selBudget && budgetSel && <BudgetGrid budgetId={selBudget} comptes={comptes || []} />}
    </div>
  )
}

function BudgetGrid({ budgetId, comptes }: { budgetId: string; comptes: any[] }) {
  const { data: lignes } = useBudgetLignes(budgetId)
  const { data: vsReel } = useBudgetVsReel(budgetId)
  const upsert = useUpsertBudgetLigne()
  const [selCompte, setSelCompte] = useState<string>('')

  // Comptes 6 et 7 uniquement (charges et produits) pour budget
  const comptesBudgetables = useMemo(
    () => comptes.filter((c) => c.classe === 6 || c.classe === 7),
    [comptes]
  )

  // Comptes présents dans le budget
  const comptesUtilises = useMemo(() => {
    const ids = new Set((lignes || []).map((l) => l.compte_id))
    return comptesBudgetables.filter((c) => ids.has(c.id))
  }, [comptesBudgetables, lignes])

  const getMontant = (compteId: string, mois: number) =>
    (lignes || []).find((l) => l.compte_id === compteId && l.mois === mois)?.montant || 0

  const getReel = (compteId: string, mois: number) => {
    const r = (vsReel || []).find((v: any) => v.compte_id === compteId && v.mois === mois)
    return r ? Number(r.montant_reel) : 0
  }

  const handleUpdate = (compteId: string, mois: number, valeur: number) => {
    upsert.mutate({ budget_id: budgetId, compte_id: compteId, mois, montant: valeur })
  }

  // Totaux
  const totalBudgetAnnuel = (compteId: string) =>
    MOIS.reduce((s, _, i) => s + getMontant(compteId, i + 1), 0)
  const totalReelAnnuel = (compteId: string) =>
    MOIS.reduce((s, _, i) => s + getReel(compteId, i + 1), 0)

  const addCompte = () => {
    if (!selCompte) return
    // crée une ligne à 0 en janvier
    upsert.mutate({ budget_id: budgetId, compte_id: selCompte, mois: 1, montant: 0 })
    setSelCompte('')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Select value={selCompte} onValueChange={setSelCompte}>
          <SelectTrigger className="w-80">
            <SelectValue placeholder="Ajouter un compte au budget" />
          </SelectTrigger>
          <SelectContent className="max-h-64">
            {comptesBudgetables
              .filter((c) => !comptesUtilises.some((u) => u.id === c.id))
              .map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.numero} — {c.libelle}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={addCompte} disabled={!selCompte}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Grille annuelle (charges & produits)</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-background min-w-[220px]">Compte</TableHead>
                {MOIS.map((m) => (
                  <TableHead key={m} className="text-center min-w-[90px]">
                    {m}
                  </TableHead>
                ))}
                <TableHead className="text-right min-w-[110px]">Total budget</TableHead>
                <TableHead className="text-right min-w-[110px]">Total réel</TableHead>
                <TableHead className="text-right min-w-[90px]">Écart</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comptesUtilises.length === 0 && (
                <TableRow>
                  <TableCell colSpan={16} className="text-center text-muted-foreground py-8">
                    Aucun compte au budget. Ajoutez-en un ci-dessus.
                  </TableCell>
                </TableRow>
              )}
              {comptesUtilises.map((c) => {
                const tb = totalBudgetAnnuel(c.id)
                const tr = totalReelAnnuel(c.id)
                const ecart = tr - tb
                return (
                  <TableRow key={c.id}>
                    <TableCell className="sticky left-0 bg-background font-mono text-xs">
                      {c.numero} — {c.libelle}
                    </TableCell>
                    {MOIS.map((_, i) => {
                      const budget = getMontant(c.id, i + 1)
                      const reel = getReel(c.id, i + 1)
                      return (
                        <TableCell key={i} className="p-1">
                          <Input
                            type="number"
                            step="1"
                            defaultValue={budget || ''}
                            onBlur={(e) => {
                              const v = Number(e.target.value)
                              if (v !== budget) handleUpdate(c.id, i + 1, v)
                            }}
                            className="h-8 text-xs text-right"
                          />
                          {reel !== 0 && (
                            <div className="text-[10px] text-muted-foreground text-right mt-0.5">
                              R: {eur(reel)}
                            </div>
                          )}
                        </TableCell>
                      )
                    })}
                    <TableCell className="text-right font-medium">{eur(tb)}</TableCell>
                    <TableCell className="text-right">{eur(tr)}</TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={
                          ecart === 0
                            ? 'outline'
                            : c.classe === 7
                              ? ecart >= 0
                                ? 'default'
                                : 'destructive'
                              : ecart <= 0
                                ? 'default'
                                : 'destructive'
                        }
                      >
                        {ecart > 0 ? (
                          <TrendingUp className="h-3 w-3 mr-1" />
                        ) : ecart < 0 ? (
                          <TrendingDown className="h-3 w-3 mr-1" />
                        ) : null}
                        {eur(ecart)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
