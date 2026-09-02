import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
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
import { Laptop, Package, AlertTriangle, Plus, Trash2, Pencil, KeyRound } from 'lucide-react'
import { PageDataState } from '@/components/common/PageDataState'
import { useActiveProfilesWithRoles } from '@/hooks/profile/useProfilesWithRoles'
import { useToast } from '@/hooks/shared/use-toast'
import {
  useITAssets,
  useUpsertITAsset,
  useDeleteITAsset,
  useITLicenses,
  useUpsertITLicense,
  useDeleteITLicense,
  useLicenseAssignments,
  useAssignLicense,
  useRevokeLicense,
  useITRenewals,
  type ITAsset,
  type ITAssetCategory,
  type ITAssetStatus,
  type ITLicense,
  type ITLicenseBillingCycle,
} from '@/hooks/it/useITAssets'

const CATEGORIES: { value: ITAssetCategory; label: string }[] = [
  { value: 'laptop', label: 'Ordinateur portable' },
  { value: 'desktop', label: 'Ordinateur fixe' },
  { value: 'phone', label: 'Téléphone' },
  { value: 'tablet', label: 'Tablette' },
  { value: 'monitor', label: 'Écran' },
  { value: 'headset', label: 'Casque' },
  { value: 'printer', label: 'Imprimante' },
  { value: 'network', label: 'Réseau' },
  { value: 'server', label: 'Serveur' },
  { value: 'peripheral', label: 'Périphérique' },
  { value: 'other', label: 'Autre' },
]

const STATUSES: {
  value: ITAssetStatus
  label: string
  variant: 'default' | 'secondary' | 'destructive' | 'outline'
}[] = [
  { value: 'in_stock', label: 'En stock', variant: 'secondary' },
  { value: 'assigned', label: 'Attribué', variant: 'default' },
  { value: 'in_repair', label: 'En réparation', variant: 'outline' },
  { value: 'lost', label: 'Perdu', variant: 'destructive' },
  { value: 'stolen', label: 'Volé', variant: 'destructive' },
  { value: 'decommissioned', label: 'Retiré', variant: 'outline' },
]

const BILLING_CYCLES: { value: ITLicenseBillingCycle; label: string }[] = [
  { value: 'monthly', label: 'Mensuel' },
  { value: 'quarterly', label: 'Trimestriel' },
  { value: 'yearly', label: 'Annuel' },
  { value: 'one_time', label: 'One-shot' },
]

function fmtEUR(v: number | null | undefined) {
  if (v === null || v === undefined) return '—'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(v)
}
function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR')
}

// ---------------------------------------------------------
// Asset form
// ---------------------------------------------------------
function AssetDialog({ trigger, initial }: { trigger: React.ReactNode; initial?: ITAsset }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<Partial<ITAsset>>(
    initial ?? { category: 'laptop', status: 'in_stock', model: '' }
  )
  const { data: profiles = [] } = useActiveProfilesWithRoles()
  const upsert = useUpsertITAsset()
  const { toast } = useToast()

  const save = async () => {
    if (!form.model?.trim()) {
      toast({ title: 'Modèle requis', variant: 'destructive' })
      return
    }
    try {
      await upsert.mutateAsync(form as ITAsset)
      toast({ title: initial ? 'Matériel mis à jour' : 'Matériel ajouté' })
      setOpen(false)
    } catch (e) {
      toast({ title: 'Erreur', description: (e as Error).message, variant: 'destructive' })
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? 'Modifier le matériel' : 'Nouveau matériel'}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Catégorie</Label>
            <Select
              value={form.category}
              onValueChange={(v) => setForm({ ...form, category: v as ITAssetCategory })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Statut</Label>
            <Select
              value={form.status}
              onValueChange={(v) => setForm({ ...form, status: v as ITAssetStatus })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Marque</Label>
            <Input
              value={form.brand ?? ''}
              onChange={(e) => setForm({ ...form, brand: e.target.value })}
              placeholder="Apple, Dell, ..."
            />
          </div>
          <div>
            <Label>Modèle *</Label>
            <Input
              value={form.model ?? ''}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              placeholder="MacBook Pro 14 M3"
            />
          </div>
          <div>
            <Label>N° de série</Label>
            <Input
              value={form.serial_number ?? ''}
              onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
            />
          </div>
          <div>
            <Label>Localisation</Label>
            <Input
              value={form.location ?? ''}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="Bureau, télétravail..."
            />
          </div>
          <div>
            <Label>Date d'achat</Label>
            <Input
              type="date"
              value={form.purchase_date ?? ''}
              onChange={(e) => setForm({ ...form, purchase_date: e.target.value || null })}
            />
          </div>
          <div>
            <Label>Prix d'achat (€ HT)</Label>
            <Input
              type="number"
              step="0.01"
              value={form.purchase_price ?? ''}
              onChange={(e) =>
                setForm({ ...form, purchase_price: e.target.value ? Number(e.target.value) : null })
              }
            />
          </div>
          <div>
            <Label>Fournisseur</Label>
            <Input
              value={form.supplier ?? ''}
              onChange={(e) => setForm({ ...form, supplier: e.target.value })}
            />
          </div>
          <div>
            <Label>Fin de garantie</Label>
            <Input
              type="date"
              value={form.warranty_end ?? ''}
              onChange={(e) => setForm({ ...form, warranty_end: e.target.value || null })}
            />
          </div>
          <div className="md:col-span-2">
            <Label>Attribué à</Label>
            <Select
              value={form.assigned_to_profile_id ?? '__none__'}
              onValueChange={(v) =>
                setForm({
                  ...form,
                  assigned_to_profile_id: v === '__none__' ? null : v,
                  status: v === '__none__' ? form.status : 'assigned',
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Personne" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Non attribué —</SelectItem>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.prenom} {p.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Notes</Label>
            <Textarea
              rows={3}
              value={form.notes ?? ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button onClick={save} disabled={upsert.isPending}>
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------
// License form
// ---------------------------------------------------------
function LicenseDialog({ trigger, initial }: { trigger: React.ReactNode; initial?: ITLicense }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<Partial<ITLicense>>(
    initial ?? { name: '', seats_total: 1, billing_cycle: 'yearly', active: true }
  )
  const upsert = useUpsertITLicense()
  const { toast } = useToast()

  const save = async () => {
    if (!form.name?.trim()) {
      toast({ title: 'Nom requis', variant: 'destructive' })
      return
    }
    try {
      await upsert.mutateAsync(form as ITLicense)
      toast({ title: initial ? 'Licence mise à jour' : 'Licence ajoutée' })
      setOpen(false)
    } catch (e) {
      toast({ title: 'Erreur', description: (e as Error).message, variant: 'destructive' })
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? 'Modifier la licence' : 'Nouvelle licence'}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label>Nom *</Label>
            <Input
              value={form.name ?? ''}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Notion, GitHub, Figma..."
            />
          </div>
          <div>
            <Label>Éditeur</Label>
            <Input
              value={form.vendor ?? ''}
              onChange={(e) => setForm({ ...form, vendor: e.target.value })}
            />
          </div>
          <div>
            <Label>Sièges</Label>
            <Input
              type="number"
              min={1}
              value={form.seats_total ?? 1}
              onChange={(e) => setForm({ ...form, seats_total: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label>Coût</Label>
            <Input
              type="number"
              step="0.01"
              value={form.cost_amount ?? ''}
              onChange={(e) =>
                setForm({ ...form, cost_amount: e.target.value ? Number(e.target.value) : null })
              }
            />
          </div>
          <div>
            <Label>Cycle</Label>
            <Select
              value={form.billing_cycle}
              onValueChange={(v) => setForm({ ...form, billing_cycle: v as ITLicenseBillingCycle })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BILLING_CYCLES.map((b) => (
                  <SelectItem key={b.value} value={b.value}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Date de renouvellement</Label>
            <Input
              type="date"
              value={form.renewal_date ?? ''}
              onChange={(e) => setForm({ ...form, renewal_date: e.target.value || null })}
            />
          </div>
          <div>
            <Label>Réf. contrat</Label>
            <Input
              value={form.contract_ref ?? ''}
              onChange={(e) => setForm({ ...form, contract_ref: e.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <Label>Notes</Label>
            <Textarea
              rows={3}
              value={form.notes ?? ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button onClick={save} disabled={upsert.isPending}>
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------
// Assign license dialog
// ---------------------------------------------------------
function AssignLicenseDialog({ license }: { license: ITLicense }) {
  const [open, setOpen] = useState(false)
  const [profileId, setProfileId] = useState<string>('')
  const { data: profiles = [] } = useActiveProfilesWithRoles()
  const { data: assignments = [] } = useLicenseAssignments(license.id)
  const assign = useAssignLicense()
  const revoke = useRevokeLicense()
  const { toast } = useToast()

  const profileMap = useMemo(
    () => new Map(profiles.map((p) => [p.id, `${p.prenom} ${p.nom}`])),
    [profiles]
  )
  const assignedIds = new Set(assignments.map((a) => a.profile_id))
  const availableProfiles = profiles.filter((p) => !assignedIds.has(p.id))

  const doAssign = async () => {
    if (!profileId) return
    try {
      await assign.mutateAsync({ license_id: license.id, profile_id: profileId })
      setProfileId('')
      toast({ title: 'Licence attribuée' })
    } catch (e) {
      toast({ title: 'Erreur', description: (e as Error).message, variant: 'destructive' })
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <KeyRound className="h-3.5 w-3.5 mr-1" />
          {assignments.length}/{license.seats_total}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Attributions — {license.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Select value={profileId} onValueChange={setProfileId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un collaborateur" />
              </SelectTrigger>
              <SelectContent>
                {availableProfiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.prenom} {p.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={doAssign}
              disabled={!profileId || assign.isPending || assignments.length >= license.seats_total}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {assignments.length >= license.seats_total && (
            <p className="text-xs text-destructive">Tous les sièges sont attribués.</p>
          )}
          <div className="border rounded-md divide-y">
            {assignments.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">Aucune attribution.</p>
            ) : (
              assignments.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-2 text-sm">
                  <div>
                    <div>{profileMap.get(a.profile_id) ?? '—'}</div>
                    <div className="text-xs text-muted-foreground">
                      depuis le {fmtDate(a.assigned_at)}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => revoke.mutate(a.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------
// Page
// ---------------------------------------------------------
export default function ITAssets() {
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('materiel')
  const assetsQ = useITAssets()
  const licensesQ = useITLicenses()
  const renewalsQ = useITRenewals()
  const { data: profiles = [] } = useActiveProfilesWithRoles()
  const deleteAsset = useDeleteITAsset()
  const deleteLicense = useDeleteITLicense()
  const { toast } = useToast()

  const profileMap = useMemo(
    () => new Map(profiles.map((p) => [p.id, `${p.prenom} ${p.nom}`])),
    [profiles]
  )

  const filteredAssets = useMemo(() => {
    const s = search.toLowerCase().trim()
    return (assetsQ.data ?? []).filter((a) => {
      if (!s) return true
      return (
        (a.model ?? '').toLowerCase().includes(s) ||
        (a.brand ?? '').toLowerCase().includes(s) ||
        (a.serial_number ?? '').toLowerCase().includes(s) ||
        (profileMap.get(a.assigned_to_profile_id ?? '') ?? '').toLowerCase().includes(s)
      )
    })
  }, [assetsQ.data, search, profileMap])

  const filteredLicenses = useMemo(() => {
    const s = search.toLowerCase().trim()
    return (licensesQ.data ?? []).filter((l) => {
      if (!s) return true
      return (l.name ?? '').toLowerCase().includes(s) || (l.vendor ?? '').toLowerCase().includes(s)
    })
  }, [licensesQ.data, search])

  const kpis = useMemo(() => {
    const list = assetsQ.data ?? []
    const licenses = licensesQ.data ?? []
    const assets_total = list.length
    const assets_assigned = list.filter((a) => a.status === 'assigned').length
    const assets_stock = list.filter((a) => a.status === 'in_stock').length
    const licenses_active = licenses.filter((l) => l.active).length
    const yearly_cost = licenses.reduce((acc, l) => {
      if (!l.active || !l.cost_amount) return acc
      switch (l.billing_cycle) {
        case 'monthly':
          return acc + l.cost_amount * 12
        case 'quarterly':
          return acc + l.cost_amount * 4
        case 'yearly':
          return acc + l.cost_amount
        case 'one_time':
          return acc
      }
    }, 0)
    const renewals_soon = (renewalsQ.data ?? []).filter((r) => r.days_until <= 30).length
    return {
      assets_total,
      assets_assigned,
      assets_stock,
      licenses_active,
      yearly_cost,
      renewals_soon,
    }
  }, [assetsQ.data, licensesQ.data, renewalsQ.data])

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Laptop className="h-7 w-7 text-primary" />
            IT Asset Management
          </h1>
          <p className="text-sm text-muted-foreground">
            Parc matériel, licences logicielles et alertes de renouvellement.
          </p>
        </div>
        <Input
          className="max-w-xs"
          placeholder="Rechercher…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </header>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <KPI label="Matériels" value={String(kpis.assets_total)} />
        <KPI label="Attribués" value={String(kpis.assets_assigned)} />
        <KPI label="En stock" value={String(kpis.assets_stock)} />
        <KPI label="Licences actives" value={String(kpis.licenses_active)} />
        <KPI label="Coût annuel" value={fmtEUR(kpis.yearly_cost)} />
        <KPI
          label="Échéances < 30 j"
          value={String(kpis.renewals_soon)}
          tone={kpis.renewals_soon > 0 ? 'warn' : undefined}
        />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="materiel">
            <Laptop className="h-4 w-4 mr-1" />
            Matériel
          </TabsTrigger>
          <TabsTrigger value="licences">
            <Package className="h-4 w-4 mr-1" />
            Licences
          </TabsTrigger>
          <TabsTrigger value="renouvellements">
            <AlertTriangle className="h-4 w-4 mr-1" />
            Renouvellements
          </TabsTrigger>
        </TabsList>

        {/* ------- Matériel ------- */}
        <TabsContent value="materiel" className="mt-4">
          <PageDataState
            isLoading={assetsQ.isLoading}
            isError={assetsQ.isError}
            error={assetsQ.error}
            isEmpty={filteredAssets.length === 0}
            emptyDescription="Aucun matériel enregistré."
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Parc matériel</CardTitle>
                <AssetDialog
                  trigger={
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      Ajouter
                    </Button>
                  }
                />
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Catégorie</TableHead>
                      <TableHead>Matériel</TableHead>
                      <TableHead>N° série</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Attribué à</TableHead>
                      <TableHead>Garantie</TableHead>
                      <TableHead className="text-right">Prix</TableHead>
                      <TableHead className="w-24 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAssets.map((a) => {
                      const status = STATUSES.find((s) => s.value === a.status)
                      const cat = CATEGORIES.find((c) => c.value === a.category)
                      return (
                        <TableRow key={a.id}>
                          <TableCell>
                            <span className="text-xs text-muted-foreground">{cat?.label}</span>
                          </TableCell>
                          <TableCell className="font-medium">
                            {a.brand ? `${a.brand} ` : ''}
                            {a.model}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {a.serial_number ?? '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={status?.variant ?? 'secondary'}>{status?.label}</Badge>
                          </TableCell>
                          <TableCell>
                            {a.assigned_to_profile_id
                              ? (profileMap.get(a.assigned_to_profile_id) ?? '—')
                              : '—'}
                          </TableCell>
                          <TableCell>{fmtDate(a.warranty_end)}</TableCell>
                          <TableCell className="text-right">{fmtEUR(a.purchase_price)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <AssetDialog
                                initial={a}
                                trigger={
                                  <Button variant="ghost" size="icon">
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                }
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={async () => {
                                  if (!confirm('Supprimer ce matériel ?')) return
                                  try {
                                    await deleteAsset.mutateAsync(a.id)
                                    toast({ title: 'Supprimé' })
                                  } catch (e) {
                                    toast({
                                      title: 'Erreur',
                                      description: (e as Error).message,
                                      variant: 'destructive',
                                    })
                                  }
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </PageDataState>
        </TabsContent>

        {/* ------- Licences ------- */}
        <TabsContent value="licences" className="mt-4">
          <PageDataState
            isLoading={licensesQ.isLoading}
            isError={licensesQ.isError}
            error={licensesQ.error}
            isEmpty={filteredLicenses.length === 0}
            emptyDescription="Aucune licence enregistrée."
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Licences logicielles</CardTitle>
                <LicenseDialog
                  trigger={
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      Ajouter
                    </Button>
                  }
                />
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Logiciel</TableHead>
                      <TableHead>Éditeur</TableHead>
                      <TableHead>Cycle</TableHead>
                      <TableHead className="text-right">Coût</TableHead>
                      <TableHead>Renouvellement</TableHead>
                      <TableHead>Sièges</TableHead>
                      <TableHead className="w-24 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLicenses.map((l) => (
                      <TableRow key={l.id} className={l.active ? '' : 'opacity-50'}>
                        <TableCell className="font-medium">{l.name}</TableCell>
                        <TableCell>{l.vendor ?? '—'}</TableCell>
                        <TableCell>
                          {BILLING_CYCLES.find((b) => b.value === l.billing_cycle)?.label}
                        </TableCell>
                        <TableCell className="text-right">{fmtEUR(l.cost_amount)}</TableCell>
                        <TableCell>{fmtDate(l.renewal_date)}</TableCell>
                        <TableCell>
                          <AssignLicenseDialog license={l} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <LicenseDialog
                              initial={l}
                              trigger={
                                <Button variant="ghost" size="icon">
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              }
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={async () => {
                                if (!confirm('Supprimer cette licence ?')) return
                                try {
                                  await deleteLicense.mutateAsync(l.id)
                                  toast({ title: 'Supprimée' })
                                } catch (e) {
                                  toast({
                                    title: 'Erreur',
                                    description: (e as Error).message,
                                    variant: 'destructive',
                                  })
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </PageDataState>
        </TabsContent>

        {/* ------- Renouvellements ------- */}
        <TabsContent value="renouvellements" className="mt-4">
          <PageDataState
            isLoading={renewalsQ.isLoading}
            isError={renewalsQ.isError}
            error={renewalsQ.error}
            isEmpty={(renewalsQ.data ?? []).length === 0}
            emptyDescription="Aucune échéance dans les 120 prochains jours."
          >
            <Card>
              <CardHeader>
                <CardTitle>Échéances à venir (120 jours)</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Objet</TableHead>
                      <TableHead>Fournisseur</TableHead>
                      <TableHead>Échéance</TableHead>
                      <TableHead>Dans</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(renewalsQ.data ?? []).map((r) => (
                      <TableRow key={`${r.kind}-${r.id}`}>
                        <TableCell>
                          <Badge variant={r.kind === 'license' ? 'default' : 'outline'}>
                            {r.kind === 'license' ? 'Licence' : 'Garantie'}
                          </Badge>
                        </TableCell>
                        <TableCell>{r.label}</TableCell>
                        <TableCell>{r.vendor ?? '—'}</TableCell>
                        <TableCell>{fmtDate(r.due_date)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              r.days_until <= 15
                                ? 'destructive'
                                : r.days_until <= 45
                                  ? 'default'
                                  : 'secondary'
                            }
                          >
                            {r.days_until < 0
                              ? `${-r.days_until} j de retard`
                              : `${r.days_until} j`}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{fmtEUR(r.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </PageDataState>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function KPI({ label, value, tone }: { label: string; value: string; tone?: 'warn' }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`mt-1 text-2xl font-bold ${tone === 'warn' ? 'text-destructive' : ''}`}>
          {value}
        </div>
      </CardContent>
    </Card>
  )
}
