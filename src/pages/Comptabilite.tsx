import { useState, useMemo } from 'react'
import { PageDataState } from '@/components/common/PageDataState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { Trash2, Plus, CheckCircle2, FileDown, Sparkles, FileText } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import {
  useComptaComptes,
  useComptaJournaux,
  useComptaEcritures,
  useComptaLignes,
  useComptaExercices,
  useBalance,
  useGrandLivre,
  useCreateEcriture,
  useValidateEcriture,
  useDeleteEcriture,
} from '@/hooks/compta/useCompta'
import { BudgetTab } from '@/components/compta/BudgetTab'

const eur = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n || 0)

export default function Comptabilite() {
  const [tab, setTab] = useState('ecritures')
  const [exerciceId, setExerciceId] = useState<string | undefined>(undefined)
  const [journalFilter, setJournalFilter] = useState<string | undefined>(undefined)

  const { data: comptes, isLoading: lc, error: ec } = useComptaComptes()
  const { data: journaux, isLoading: lj } = useComptaJournaux()
  const { data: exercices } = useComptaExercices()
  const {
    data: ecritures,
    isLoading: le,
    error: ee,
  } = useComptaEcritures({ journalId: journalFilter })

  const loading = lc || lj || le
  const error = ec || ee

  return (
    <PageDataState isLoading={loading} isError={!!error} error={error as any}>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold">Comptabilité</h1>
            <p className="text-sm text-muted-foreground">
              Plan comptable, écritures, e-invoicing, FEC & lettrage IA
            </p>
          </div>
          <Select value={exerciceId} onValueChange={setExerciceId}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Sélectionner un exercice" />
            </SelectTrigger>
            <SelectContent>
              {exercices?.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.libelle} ({e.statut})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex flex-wrap">
            <TabsTrigger value="ecritures">Écritures</TabsTrigger>
            <TabsTrigger value="plan">Plan comptable</TabsTrigger>
            <TabsTrigger value="balance">Balance & Grand livre</TabsTrigger>
            <TabsTrigger value="factur-x">Factur-X / Chorus Pro</TabsTrigger>
            <TabsTrigger value="fec">FEC & Lettrage IA</TabsTrigger>
            <TabsTrigger value="budget">Budget & Prévisionnel</TabsTrigger>
          </TabsList>

          <TabsContent value="ecritures" className="mt-4">
            <EcrituresTab
              comptes={comptes || []}
              journaux={journaux || []}
              ecritures={ecritures || []}
              exerciceId={exerciceId}
              journalFilter={journalFilter}
              setJournalFilter={setJournalFilter}
            />
          </TabsContent>

          <TabsContent value="plan" className="mt-4">
            <PlanComptableTab comptes={comptes || []} />
          </TabsContent>

          <TabsContent value="balance" className="mt-4">
            <BalanceTab exerciceId={exerciceId} comptes={comptes || []} />
          </TabsContent>

          <TabsContent value="factur-x" className="mt-4">
            <FacturXTab />
          </TabsContent>

          <TabsContent value="fec" className="mt-4">
            <FecTab exerciceId={exerciceId} exercices={exercices || []} />
          </TabsContent>

          <TabsContent value="budget" className="mt-4">
            <BudgetTab />
          </TabsContent>
        </Tabs>
      </div>
    </PageDataState>
  )
}

/* ============== ÉCRITURES ============== */
function EcrituresTab({
  comptes,
  journaux,
  ecritures,
  exerciceId,
  journalFilter,
  setJournalFilter,
}: any) {
  const [open, setOpen] = useState(false)
  const [selectedEcr, setSelectedEcr] = useState<string | null>(null)
  const valider = useValidateEcriture()
  const suppr = useDeleteEcriture()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Select
          value={journalFilter}
          onValueChange={(v) => setJournalFilter(v === 'all' ? undefined : v)}
        >
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Tous les journaux" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les journaux</SelectItem>
            {journaux.map((j: any) => (
              <SelectItem key={j.id} value={j.id}>
                {j.code} — {j.libelle}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle écriture
            </Button>
          </DialogTrigger>
          <NewEcritureDialog
            comptes={comptes}
            journaux={journaux}
            exerciceId={exerciceId}
            onDone={() => setOpen(false)}
          />
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Journal</TableHead>
                <TableHead>Pièce</TableHead>
                <TableHead>Libellé</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ecritures.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Aucune écriture
                  </TableCell>
                </TableRow>
              )}
              {ecritures.map((e: any) => {
                const j = journaux.find((x: any) => x.id === e.journal_id)
                return (
                  <>
                    <TableRow
                      key={e.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedEcr(selectedEcr === e.id ? null : e.id)}
                    >
                      <TableCell>{e.date_ecriture}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{j?.code}</Badge>
                      </TableCell>
                      <TableCell>{e.numero_piece || '—'}</TableCell>
                      <TableCell>{e.libelle}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            e.statut === 'validee'
                              ? 'default'
                              : e.statut === 'cloturee'
                                ? 'secondary'
                                : 'outline'
                          }
                        >
                          {e.statut}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        {e.statut === 'brouillon' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(ev) => {
                                ev.stopPropagation()
                                valider.mutate(e.id)
                              }}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(ev) => {
                                ev.stopPropagation()
                                if (confirm('Supprimer ?')) suppr.mutate(e.id)
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                    {selectedEcr === e.id && <LignesRow ecritureId={e.id} comptes={comptes} />}
                  </>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function LignesRow({ ecritureId, comptes }: any) {
  const { data: lignes } = useComptaLignes(ecritureId)
  return (
    <TableRow>
      <TableCell colSpan={6} className="bg-muted/30">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Compte</TableHead>
              <TableHead>Libellé</TableHead>
              <TableHead className="text-right">Débit</TableHead>
              <TableHead className="text-right">Crédit</TableHead>
              <TableHead>Lettrage</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lignes?.map((l) => {
              const c = comptes.find((x: any) => x.id === l.compte_id)
              return (
                <TableRow key={l.id}>
                  <TableCell className="font-mono">
                    {c?.numero} — {c?.libelle}
                  </TableCell>
                  <TableCell>{l.libelle || '—'}</TableCell>
                  <TableCell className="text-right">{l.debit ? eur(l.debit) : '—'}</TableCell>
                  <TableCell className="text-right">{l.credit ? eur(l.credit) : '—'}</TableCell>
                  <TableCell>
                    {l.lettrage ? <Badge variant="secondary">{l.lettrage}</Badge> : '—'}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableCell>
    </TableRow>
  )
}

function NewEcritureDialog({ comptes, journaux, exerciceId, onDone }: any) {
  const [journal, setJournal] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [libelle, setLibelle] = useState('')
  const [piece, setPiece] = useState('')
  const [lignes, setLignes] = useState<any[]>([
    { compte_id: '', libelle: '', debit: 0, credit: 0 },
    { compte_id: '', libelle: '', debit: 0, credit: 0 },
  ])
  const create = useCreateEcriture()

  const totalD = lignes.reduce((s, l) => s + Number(l.debit || 0), 0)
  const totalC = lignes.reduce((s, l) => s + Number(l.credit || 0), 0)
  const equilibre = Math.abs(totalD - totalC) < 0.01 && totalD > 0

  const addLigne = () => setLignes([...lignes, { compte_id: '', libelle: '', debit: 0, credit: 0 }])
  const removeLigne = (i: number) => setLignes(lignes.filter((_, idx) => idx !== i))
  const updateLigne = (i: number, patch: any) =>
    setLignes(lignes.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))

  const submit = async () => {
    if (!journal || !libelle || !equilibre) {
      toast.error('Journal, libellé et écriture équilibrée requis')
      return
    }
    const filtered = lignes.filter((l) => l.compte_id && (l.debit > 0 || l.credit > 0))
    await create.mutateAsync({
      journal_id: journal,
      date_ecriture: date,
      libelle,
      numero_piece: piece || undefined,
      exercice_id: exerciceId,
      lignes: filtered,
    })
    onDone()
  }

  return (
    <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
      <DialogHeader>
        <DialogTitle>Nouvelle écriture</DialogTitle>
      </DialogHeader>
      <div className="space-y-3 overflow-y-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label>Journal</Label>
            <Select value={journal} onValueChange={setJournal}>
              <SelectTrigger>
                <SelectValue placeholder="Journal" />
              </SelectTrigger>
              <SelectContent>
                {journaux.map((j: any) => (
                  <SelectItem key={j.id} value={j.id}>
                    {j.code} — {j.libelle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>N° pièce</Label>
            <Input value={piece} onChange={(e) => setPiece(e.target.value)} />
          </div>
          <div className="col-span-2 md:col-span-1">
            <Label>Libellé</Label>
            <Input value={libelle} onChange={(e) => setLibelle(e.target.value)} />
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Compte</TableHead>
              <TableHead>Libellé</TableHead>
              <TableHead className="w-32">Débit</TableHead>
              <TableHead className="w-32">Crédit</TableHead>
              <TableHead className="w-8"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lignes.map((l, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Select
                    value={l.compte_id}
                    onValueChange={(v) => updateLigne(i, { compte_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Compte" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {comptes.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.numero} — {c.libelle}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input
                    value={l.libelle}
                    onChange={(e) => updateLigne(i, { libelle: e.target.value })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="0.01"
                    value={l.debit || ''}
                    onChange={(e) => updateLigne(i, { debit: Number(e.target.value), credit: 0 })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="0.01"
                    value={l.credit || ''}
                    onChange={(e) => updateLigne(i, { credit: Number(e.target.value), debit: 0 })}
                  />
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="ghost" onClick={() => removeLigne(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Button variant="outline" size="sm" onClick={addLigne}>
          <Plus className="h-4 w-4 mr-1" />
          Ajouter une ligne
        </Button>
        <div className="flex justify-end gap-4 text-sm p-2 rounded bg-muted/50">
          <span>
            Débit: <strong>{eur(totalD)}</strong>
          </span>
          <span>
            Crédit: <strong>{eur(totalC)}</strong>
          </span>
          <span className={equilibre ? 'text-green-600' : 'text-destructive'}>
            {equilibre ? '✓ Équilibrée' : `Δ ${eur(Math.abs(totalD - totalC))}`}
          </span>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={!equilibre || create.isPending}>
          Créer
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

/* ============== PLAN COMPTABLE ============== */
function PlanComptableTab({ comptes }: any) {
  const [filter, setFilter] = useState('')
  const filtered = useMemo(
    () =>
      comptes.filter(
        (c: any) =>
          !filter ||
          c.numero.startsWith(filter) ||
          c.libelle.toLowerCase().includes(filter.toLowerCase())
      ),
    [comptes, filter]
  )
  const byClasse = useMemo(() => {
    const m = new Map<number, any[]>()
    for (const c of filtered) {
      if (!m.has(c.classe)) m.set(c.classe, [])
      m.get(c.classe)!.push(c)
    }
    return Array.from(m.entries()).sort((a, b) => a[0] - b[0])
  }, [filtered])

  return (
    <div className="space-y-4">
      <Input
        placeholder="Rechercher un compte..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="max-w-md"
      />
      {byClasse.map(([classe, list]) => (
        <Card key={classe}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Classe {classe} ({list.length} comptes)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numéro</TableHead>
                  <TableHead>Libellé</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Lettrable</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono">{c.numero}</TableCell>
                    <TableCell>{c.libelle}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{c.type}</Badge>
                    </TableCell>
                    <TableCell>{c.lettrable ? '✓' : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

/* ============== BALANCE & GRAND LIVRE ============== */
function BalanceTab({ exerciceId, comptes }: any) {
  const { data: balance } = useBalance(exerciceId)
  const [selCompte, setSelCompte] = useState<string | null>(null)
  const { data: gl } = useGrandLivre(selCompte)

  const nonZero = (balance || []).filter(
    (b: any) => Number(b.total_debit) > 0 || Number(b.total_credit) > 0
  )
  const totalD = nonZero.reduce((s: number, b: any) => s + Number(b.total_debit), 0)
  const totalC = nonZero.reduce((s: number, b: any) => s + Number(b.total_credit), 0)

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Balance ({nonZero.length} comptes mouvementés)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Compte</TableHead>
                <TableHead className="text-right">Débit</TableHead>
                <TableHead className="text-right">Crédit</TableHead>
                <TableHead className="text-right">Solde</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {nonZero.map((b: any) => (
                <TableRow
                  key={b.compte_id}
                  className="cursor-pointer"
                  onClick={() => setSelCompte(b.compte_id)}
                >
                  <TableCell className="font-mono text-xs">
                    {b.numero} — {b.libelle}
                  </TableCell>
                  <TableCell className="text-right">{eur(Number(b.total_debit))}</TableCell>
                  <TableCell className="text-right">{eur(Number(b.total_credit))}</TableCell>
                  <TableCell className="text-right font-medium">{eur(Number(b.solde))}</TableCell>
                </TableRow>
              ))}
              <TableRow className="font-bold border-t-2">
                <TableCell>TOTAL</TableCell>
                <TableCell className="text-right">{eur(totalD)}</TableCell>
                <TableCell className="text-right">{eur(totalC)}</TableCell>
                <TableCell className="text-right">{eur(totalD - totalC)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>
            Grand livre{' '}
            {selCompte ? `— ${comptes.find((c: any) => c.id === selCompte)?.numero}` : ''}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!selCompte ? (
            <p className="p-4 text-sm text-muted-foreground">
              Cliquez sur un compte pour voir son détail.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Pièce</TableHead>
                  <TableHead>Libellé</TableHead>
                  <TableHead className="text-right">Débit</TableHead>
                  <TableHead className="text-right">Crédit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(gl || []).map((l: any) => (
                  <TableRow key={l.ligne_id}>
                    <TableCell>{l.date_ecriture}</TableCell>
                    <TableCell>{l.numero_piece || '—'}</TableCell>
                    <TableCell>{l.ecriture_libelle}</TableCell>
                    <TableCell className="text-right">
                      {l.debit ? eur(Number(l.debit)) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {l.credit ? eur(Number(l.credit)) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/* ============== FACTUR-X ============== */
function FacturXTab() {
  const [factureId, setFactureId] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const buildAndDownloadPdf = async (): Promise<{
    blob: Blob
    base64: string
    xml: string
  } | null> => {
    const { data: fx, error: fxErr } = await supabase.functions.invoke('compta-generate-facturx', {
      body: { facture_id: factureId },
    })
    if (fxErr) throw fxErr

    const { data: facture } = await supabase
      .from('factures' as any)
      .select('*')
      .eq('id', factureId)
      .single()
    const { data: lignes } = await supabase
      .from('factures_lignes' as any)
      .select('*')
      .eq('facture_id', factureId)
    if (!facture) throw new Error('Facture introuvable')

    const f = facture as any
    const { generateFacturXPdf } = await import('@/lib/compta/facturx-pdf')
    const blob = await generateFacturXPdf({
      numero: f.numero,
      date: f.date_facture || f.date_emission || new Date().toISOString().slice(0, 10),
      emetteur: { nom: 'OpenPulse', siren: '000000000' },
      client: { nom: f.client_nom || f.nom_etablissement || 'Client', siret: f.client_siret },
      lignes: (lignes || []).map((l: any) => ({
        description: l.description || l.libelle || '',
        quantite: Number(l.quantite || 1),
        prix_unitaire: Number(l.prix_unitaire_ht || l.prix_ht || 0),
        tva_taux: Number(l.tva_taux || 20),
      })),
      total_ht: Number(f.montant_ht || 0),
      total_tva: Number(f.montant_tva || Number(f.montant_ttc || 0) - Number(f.montant_ht || 0)),
      total_ttc: Number(f.montant_ttc || 0),
      xml_cii: (fx as any).xml_cii,
      profile: 'BASIC WL',
    })

    const arrayBuf = await blob.arrayBuffer()
    const bytes = new Uint8Array(arrayBuf)
    let bin = ''
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
    const base64 = btoa(bin)
    return { blob, base64, xml: (fx as any).xml_cii }
  }

  const generer = async () => {
    if (!factureId) return toast.error('ID facture requis')
    setLoading(true)
    try {
      const built = await buildAndDownloadPdf()
      if (!built) return
      const { downloadBlob } = await import('@/lib/compta/facturx-pdf')
      downloadBlob(built.blob, `facture-${factureId}-facturx.pdf`)
      setResult({ status: 'generated', xml_preview: built.xml.slice(0, 500) + '...' })
      toast.success('PDF/A-3 Factur-X téléchargé')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const envoyerChorus = async () => {
    if (!factureId) return toast.error('ID facture requis')
    setLoading(true)
    try {
      const built = await buildAndDownloadPdf()
      if (!built) return
      const { data, error } = await supabase.functions.invoke('compta-chorus-pro-submit', {
        body: { facture_id: factureId, pdf_base64: built.base64 },
      })
      if (error) throw error
      setResult(data)
      toast.success(
        data.mode === 'submitted'
          ? `Déposée sur Chorus Pro (flux ${data.numero_flux})`
          : 'Payload prêt (secrets Chorus Pro non configurés)'
      )
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Factur-X & Chorus Pro
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Génération de factures Factur-X (PDF/A-3 + XML CII) conforme réforme e-invoicing 2026.
          Compatible PPF/PDP et dépôt Chorus Pro pour secteur public.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="UUID facture existante"
            value={factureId}
            onChange={(e) => setFactureId(e.target.value)}
          />
          <Button onClick={generer} disabled={loading}>
            <FileDown className="h-4 w-4 mr-2" />
            Générer Factur-X
          </Button>
          <Button variant="outline" onClick={envoyerChorus} disabled={loading}>
            Envoyer Chorus Pro
          </Button>
        </div>
        {result && (
          <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-96">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </CardContent>
    </Card>
  )
}

/* ============== FEC & LETTRAGE IA ============== */
function FecTab({ exerciceId, exercices }: any) {
  const [loading, setLoading] = useState(false)
  const [lettrageResult, setLettrageResult] = useState<any>(null)

  const exportFEC = async () => {
    if (!exerciceId) return toast.error('Sélectionnez un exercice')
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('compta-export-fec', {
        body: { exercice_id: exerciceId },
      })
      if (error) throw error
      // Télécharger le fichier
      const blob = new Blob([data.fec_content], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = data.filename || 'FEC.txt'
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`FEC exporté (${data.line_count} lignes)`)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const lancerLettrageIA = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('compta-lettrage-ia', {
        body: { exercice_id: exerciceId },
      })
      if (error) throw error
      setLettrageResult(data)
      toast.success(`${data.matches_count || 0} rapprochements proposés`)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5" />
            Export FEC
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Fichier des Écritures Comptables au format DGFiP (article A47 A-1 LPF).
          </p>
        </CardHeader>
        <CardContent>
          <p className="text-sm mb-3">
            Exercice :{' '}
            <strong>{exercices.find((e: any) => e.id === exerciceId)?.libelle || '—'}</strong>
          </p>
          <Button onClick={exportFEC} disabled={loading || !exerciceId} className="w-full">
            <FileDown className="h-4 w-4 mr-2" />
            Exporter le FEC
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Lettrage IA
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Rapprochement automatique factures ↔ paiements par IA (comptes clients/fournisseurs).
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={lancerLettrageIA} disabled={loading} className="w-full">
            <Sparkles className="h-4 w-4 mr-2" />
            Lancer le lettrage IA
          </Button>
          {lettrageResult && (
            <div className="text-sm space-y-1">
              <p>
                Rapprochements appliqués : <strong>{lettrageResult.applied_count || 0}</strong>
              </p>
              <p>
                Confiance moyenne :{' '}
                <strong>{((lettrageResult.avg_confidence || 0) * 100).toFixed(0)}%</strong>
              </p>
              {lettrageResult.details && (
                <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-64">
                  {JSON.stringify(lettrageResult.details, null, 2)}
                </pre>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
