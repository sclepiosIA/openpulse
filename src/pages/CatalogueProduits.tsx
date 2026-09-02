import { useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, Plus, Package, Upload, Download, Layers, Euro, CheckCircle2 } from 'lucide-react'
import { useCatalogueProduits } from '@/hooks/catalogue/useCatalogueProduits'
import { useCatalogueStats } from '@/hooks/catalogue/useCatalogueStats'
import { useProduitImport } from '@/hooks/catalogue/useProduitImport'
import { CatalogueProduitForm } from '@/components/catalogue/CatalogueProduitForm'
import { CatalogueImportDialog } from '@/components/catalogue/CatalogueImportDialog'
import { CatalogueProduitTable } from '@/components/catalogue/CatalogueProduitTable'
import { CatalogueProduitCard } from '@/components/catalogue/CatalogueProduitCard'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useIsMobile } from '@/hooks/ui/use-mobile'
import { usePageTitle } from '@/hooks/shared/usePageTitle'
import { ImmersivePageBackground } from '@/components/layout/ImmersivePageBackground'
import { ImmersivePageHeader } from '@/components/layout/ImmersivePageHeader'
import { PageDataState } from '@/components/common/PageDataState'
import { PRODUIT_TYPE_LABELS, type CatalogueProduit } from '@/types/facturation'

export default function CatalogueProduitsPage() {
  usePageTitle('Catalogue produits')
  const isMobile = useIsMobile()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [categorieFilter, setCategorieFilter] = useState<string>('all')
  const [showInactive, setShowInactive] = useState(false)
  const [editing, setEditing] = useState<CatalogueProduit | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [deleting, setDeleting] = useState<CatalogueProduit | null>(null)

  const {
    produits,
    deleteProduit,
    duplicateProduit,
    archiveProduit,
    reorderProduits,
    isDeleting,
    isLoading,
    error,
    refetch,
  } = useCatalogueProduits(showInactive)
  const { data: statsMap } = useCatalogueStats()
  const { exportCSV } = useProduitImport()

  const categories = useMemo(() => {
    const set = new Set<string>()
    produits.forEach((p) => p.categorie && set.add(p.categorie))
    return Array.from(set).sort()
  }, [produits])

  const filtered = useMemo(() => {
    return produits.filter((p) => {
      if (typeFilter !== 'all' && p.type !== typeFilter) return false
      if (categorieFilter !== 'all' && p.categorie !== categorieFilter) return false
      if (search) {
        const q = search.toLowerCase()
        if (
          !p.code.toLowerCase().includes(q) &&
          !p.nom.toLowerCase().includes(q) &&
          !p.description?.toLowerCase().includes(q)
        )
          return false
      }
      return true
    })
  }, [produits, typeFilter, categorieFilter, search])

  const kpis = useMemo(() => {
    const actifs = produits.filter((p) => p.est_actif).length
    const services = produits.filter((p) => p.type === 'service' || p.type === 'maintenance').length
    let ca = 0
    statsMap?.forEach((s) => {
      ca += Number(s.ca_cumule_ht || 0)
    })
    return { actifs, services, ca, total: produits.length }
  }, [produits, statsMap])

  const handleEdit = (p: CatalogueProduit) => {
    setEditing(p)
    setFormOpen(true)
  }
  const handleNew = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const handleConfirmDelete = async () => {
    if (!deleting) return
    try {
      await deleteProduit(deleting.id)
      setDeleting(null)
    } catch {
      /* handled */
    }
  }

  const fmtCur = (v: number) =>
    new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(v)

  return (
    <ImmersivePageBackground>
      <ImmersivePageHeader
        icon={Package}
        title="Catalogue produits & services"
        subtitle="Référentiel central utilisé dans devis, factures et contrats"
        stats={[
          { label: 'total', value: kpis.total },
          { label: 'actifs', value: kpis.actifs, highlight: true },
          { label: 'services', value: kpis.services },
        ]}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImportOpen(true)}
              className="bg-card/10 border-white/20 text-white hover:bg-card/20 hover:text-white"
            >
              <Upload className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Importer</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportCSV(filtered)}
              className="bg-card/10 border-white/20 text-white hover:bg-card/20 hover:text-white"
            >
              <Download className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Exporter</span>
            </Button>
            <Button size="sm" onClick={handleNew} className="bg-card text-primary hover:bg-card/90">
              <Plus className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Nouveau produit</span>
            </Button>
          </>
        }
      />

      <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Layers className="h-8 w-8 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Total catalogue</p>
                <p className="text-2xl font-bold">{kpis.total}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Produits actifs</p>
                <p className="text-2xl font-bold">{kpis.actifs}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Package className="h-8 w-8 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Services & maintenance</p>
                <p className="text-2xl font-bold">{kpis.services}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Euro className="h-8 w-8 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">CA cumulé HT</p>
                <p className="text-2xl font-bold">{fmtCur(kpis.ca)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtres */}
        <Card>
          <CardContent className="p-4 flex flex-col lg:flex-row gap-3 lg:items-end flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par code, nom, description…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="min-w-[160px]">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous types</SelectItem>
                  {Object.entries(PRODUIT_TYPE_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[160px]">
              <Select value={categorieFilter} onValueChange={setCategorieFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Catégorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes catégories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="show-inactive" checked={showInactive} onCheckedChange={setShowInactive} />
              <Label htmlFor="show-inactive" className="text-sm cursor-pointer">
                Inclure archivés
              </Label>
            </div>
            <Badge variant="secondary" className="self-center">
              {filtered.length} produit{filtered.length > 1 ? 's' : ''}
            </Badge>
            {!isMobile && typeFilter === 'all' && categorieFilter === 'all' && !search && (
              <Badge variant="outline" className="self-center text-xs">
                Glisser pour réordonner
              </Badge>
            )}
          </CardContent>
        </Card>

        {/* Liste */}
        <PageDataState
          isLoading={isLoading}
          isError={!!error}
          error={error}
          onRetry={() => refetch()}
        >
          {filtered.length === 0 && produits.length === 0 ? (
            <Card>
              <CardContent className="p-10 text-center space-y-3">
                <Package className="h-12 w-12 mx-auto text-muted-foreground/40" />
                <div>
                  <p className="font-medium">Votre catalogue est vide</p>
                  <p className="text-sm text-muted-foreground">
                    Créez votre premier produit ou importez un fichier CSV pour démarrer.
                  </p>
                </div>
                <div className="flex justify-center gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                    <Upload className="h-4 w-4 mr-1" /> Importer CSV
                  </Button>
                  <Button size="sm" onClick={handleNew}>
                    <Plus className="h-4 w-4 mr-1" /> Nouveau produit
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : isMobile ? (
            <div className="grid grid-cols-1 gap-3">
              {filtered.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    Aucun produit ne correspond aux filtres
                  </CardContent>
                </Card>
              ) : (
                filtered.map((p) => (
                  <CatalogueProduitCard
                    key={p.id}
                    produit={p}
                    stat={statsMap?.get(p.id)}
                    onEdit={handleEdit}
                    onDuplicate={duplicateProduit}
                    onArchive={(id, archive) => archiveProduit({ id, archive })}
                    onDelete={setDeleting}
                  />
                ))
              )}
            </div>
          ) : (
            <CatalogueProduitTable
              produits={filtered}
              statsMap={statsMap}
              onEdit={handleEdit}
              onDuplicate={duplicateProduit}
              onArchive={(id, archive) => archiveProduit({ id, archive })}
              onDelete={setDeleting}
              onReorder={reorderProduits}
              reorderEnabled={typeFilter === 'all' && categorieFilter === 'all' && !search}
            />
          )}
        </PageDataState>

        <CatalogueProduitForm open={formOpen} onOpenChange={setFormOpen} produit={editing} />
        <CatalogueImportDialog open={importOpen} onOpenChange={setImportOpen} />
        <ConfirmDialog
          open={!!deleting}
          onOpenChange={(o) => !o && setDeleting(null)}
          title="Supprimer le produit"
          description={
            deleting
              ? `Supprimer "${deleting.nom}" ? Cette action est irréversible. Si ce produit est utilisé dans des devis ou factures, la suppression sera bloquée.`
              : ''
          }
          confirmText="Supprimer"
          variant="destructive"
          onConfirm={handleConfirmDelete}
          loading={isDeleting}
        />
      </div>
    </ImmersivePageBackground>
  )
}
