import { useNavigate } from 'react-router-dom'
import { useState, useMemo } from 'react'
import { useDebounce } from '@/hooks/shared/useDebounce'
import {
  Plus,
  Play,
  Edit2,
  Trash2,
  Copy,
  Workflow as WorkflowIcon,
  Zap,
  Search,
  Sparkles,
  Activity,
  Download,
  Upload,
} from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/shared/use-toast'
import {
  useWorkflows,
  useDeleteWorkflow,
  useToggleWorkflowActive,
  useCreateWorkflow,
  useTriggerWorkflowManual,
} from '@/hooks/workflows/useWorkflows'
import {
  useWorkflowTemplates,
  useInstantiateTemplate,
  TEMPLATE_CATEGORIES,
} from '@/hooks/workflows/useWorkflowTemplates'
import { TRIGGER_LABELS, type WorkflowTriggerType } from '@/types/workflow'
import { usePageTitle } from '@/hooks/shared/usePageTitle'
import { ImmersivePageBackground } from '@/components/layout/ImmersivePageBackground'
import { ImmersivePageHeader } from '@/components/layout/ImmersivePageHeader'
import { PageDataState } from '@/components/common/PageDataState'

export default function Automatisations() {
  usePageTitle('Automatisations')
  const navigate = useNavigate()
  const { toast } = useToast()
  const { data: all, isLoading, isError, error, refetch } = useWorkflows()
  const { data: templates = [], isLoading: tplLoading } = useWorkflowTemplates()
  const deleteMut = useDeleteWorkflow()
  const toggleMut = useToggleWorkflowActive()
  const createMut = useCreateWorkflow()
  const triggerMut = useTriggerWorkflowManual()
  const instantiateMut = useInstantiateTemplate()

  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [newNom, setNewNom] = useState('')
  const [newTrigger, setNewTrigger] = useState<WorkflowTriggerType>('manual')
  const [tplSearch, setTplSearch] = useState('')
  const debouncedTplSearch = useDebounce(tplSearch, 300)
  const [tplCategory, setTplCategory] = useState<string>('all')
  const [wfSearch, setWfSearch] = useState('')
  const debouncedWfSearch = useDebounce(wfSearch, 300)

  const allWorkflows = (all || []).filter((w) => !w.is_template)
  const workflows = useMemo(() => {
    const q = debouncedWfSearch.toLowerCase().trim()
    if (!q) return allWorkflows
    return allWorkflows.filter(
      (w) =>
        w.nom.toLowerCase().includes(q) ||
        (TRIGGER_LABELS[w.trigger_type] ?? w.trigger_type).toLowerCase().includes(q)
    )
  }, [allWorkflows, debouncedWfSearch])

  const kpis = useMemo(() => {
    const active = allWorkflows.filter((w) => w.is_active).length
    const totalRuns = allWorkflows.reduce((s, w) => s + (w.stats?.runs ?? 0), 0)
    const totalFailed = allWorkflows.reduce((s, w) => s + (w.stats?.failed ?? 0), 0)
    return { active, total: allWorkflows.length, totalRuns, totalFailed }
  }, [allWorkflows])

  const filteredTemplates = useMemo(() => {
    const q = debouncedTplSearch.toLowerCase().trim()
    return templates.filter((t) => {
      if (tplCategory !== 'all' && t.category !== tplCategory) return false
      if (!q) return true
      return (
        t.name.toLowerCase().includes(q) ||
        (t.description ?? '').toLowerCase().includes(q) ||
        TRIGGER_LABELS[t.trigger_type]?.toLowerCase().includes(q)
      )
    })
  }, [templates, debouncedTplSearch, tplCategory])

  const groupedByCategory = useMemo(() => {
    const groups: Record<string, typeof filteredTemplates> = {}
    filteredTemplates.forEach((t) => {
      groups[t.category] = groups[t.category] || []
      groups[t.category].push(t)
    })
    return groups
  }, [filteredTemplates])

  const handleCreate = async () => {
    if (!newNom.trim()) return
    const res = await createMut.mutateAsync({
      nom: newNom.trim(),
      trigger_type: newTrigger,
      graph: {
        nodes: [
          {
            id: 'trigger',
            type: 'trigger',
            position: { x: 250, y: 50 },
            data: { label: TRIGGER_LABELS[newTrigger], trigger_type: newTrigger },
          },
        ],
        edges: [],
      },
    })
    setCreateOpen(false)
    setNewNom('')
    navigate(`/automatisations/${res.id}/edit`)
  }

  const handleUseTemplate = async (template: (typeof templates)[number]) => {
    try {
      const res = await instantiateMut.mutateAsync(template)
      toast({ title: 'Modèle installé', description: `Workflow "${template.name}" créé.` })
      navigate(`/automatisations/${res.id}/edit`)
    } catch (e: any) {
      toast({
        title: 'Erreur',
        description: e.message ?? 'Impossible de créer',
        variant: 'destructive',
      })
    }
  }

  if (isError) {
    return (
      <ImmersivePageBackground>
        <ImmersivePageHeader
          icon={WorkflowIcon}
          title="Automatisations"
          subtitle="Moteur visuel « si X alors Y » sans code"
        />
        <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
          <PageDataState isLoading={false} isError={true} error={error} onRetry={() => refetch()}>
            <></>
          </PageDataState>
        </div>
      </ImmersivePageBackground>
    )
  }

  return (
    <ImmersivePageBackground>
      <ImmersivePageHeader
        icon={WorkflowIcon}
        title="Automatisations"
        subtitle="Moteur visuel « si X alors Y » sans code"
        stats={[
          { label: 'actifs', value: `${kpis.active}/${kpis.total}`, highlight: true },
          { label: 'runs', value: kpis.totalRuns },
          { label: 'échecs', value: kpis.totalFailed },
        ]}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              className="bg-card/90 text-primary hover:bg-card"
              onClick={() => navigate('/automatisations/sante')}
            >
              <Activity className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Santé</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="bg-card/90 text-primary hover:bg-card"
              onClick={() => navigate('/automatisations/runs')}
            >
              <Play className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Runs</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="bg-card/90 text-primary hover:bg-card"
              onClick={() => navigate('/automatisations/webhooks-alertes')}
            >
              <Zap className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Webhooks</span>
            </Button>
            <input
              id="wf-import-input"
              type="file"
              accept="application/json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                try {
                  const text = await file.text()
                  const parsed = JSON.parse(text)
                  if (!parsed?.graph?.nodes || !parsed?.trigger_type || !parsed?.nom) {
                    throw new Error('Format invalide (champs requis : nom, trigger_type, graph)')
                  }
                  const res = await createMut.mutateAsync({
                    nom: `${parsed.nom} (importé)`,
                    trigger_type: parsed.trigger_type,
                    description: parsed.description ?? null,
                    graph: parsed.graph,
                  })
                  toast({ title: 'Workflow importé', description: parsed.nom })
                  navigate(`/automatisations/${res.id}/edit`)
                } catch (err: any) {
                  toast({
                    title: 'Import échoué',
                    description: err.message ?? 'JSON invalide',
                    variant: 'destructive',
                  })
                } finally {
                  e.target.value = ''
                }
              }}
            />
            <Button
              size="sm"
              variant="outline"
              className="bg-card/90 text-primary hover:bg-card"
              onClick={() => document.getElementById('wf-import-input')?.click()}
            >
              <Upload className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Importer</span>
            </Button>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-card text-primary hover:bg-card/90">
                  <Plus className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Nouveau workflow</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Créer un workflow</DialogTitle>
                  <DialogDescription>
                    Choisissez un nom et un type de déclencheur.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <div>
                    <Label>Nom</Label>
                    <Input
                      value={newNom}
                      onChange={(e) => setNewNom(e.target.value)}
                      placeholder="Ex: Relance prospect 7j"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Déclencheur</Label>
                    <Select
                      value={newTrigger}
                      onValueChange={(v) => setNewTrigger(v as WorkflowTriggerType)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(TRIGGER_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>
                            {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateOpen(false)}>
                    Annuler
                  </Button>
                  <Button onClick={handleCreate} disabled={!newNom.trim() || createMut.isPending}>
                    Créer & éditer
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground">Actifs</div>
              <div className="text-2xl font-bold">
                {kpis.active}
                <span className="text-sm text-muted-foreground font-normal"> / {kpis.total}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground">Exécutions totales</div>
              <div className="text-2xl font-bold">{kpis.totalRuns}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground">Échecs</div>
              <div className="text-2xl font-bold text-destructive">{kpis.totalFailed}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground">Modèles disponibles</div>
              <div className="text-2xl font-bold">{templates.length}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="workflows">
          <TabsList>
            <TabsTrigger value="workflows">Mes workflows ({workflows.length})</TabsTrigger>
            <TabsTrigger value="templates">
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Marketplace ({templates.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="workflows" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Workflows actifs et brouillons</CardTitle>
                <CardDescription>
                  Activez/désactivez, dupliquez ou éditez vos automatisations.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative mb-4 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher un workflow…"
                    value={wfSearch}
                    onChange={(e) => setWfSearch(e.target.value)}
                    className="pl-9"
                    aria-label="Rechercher un workflow"
                  />
                </div>
                {isLoading ? (
                  <p className="text-sm text-muted-foreground">Chargement…</p>
                ) : workflows.length === 0 ? (
                  <div className="text-center py-12">
                    <WorkflowIcon className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground mb-4">
                      {wfSearch
                        ? 'Aucun workflow trouvé pour cette recherche.'
                        : 'Aucun workflow. Créez le vôtre ou utilisez un modèle !'}
                    </p>
                    {!wfSearch && (
                      <Button onClick={() => setCreateOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" /> Nouveau workflow
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nom</TableHead>
                          <TableHead>Déclencheur</TableHead>
                          <TableHead>Exécutions</TableHead>
                          <TableHead className="hidden md:table-cell">Dernière run</TableHead>
                          <TableHead>Actif</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {workflows.map((w) => (
                          <TableRow key={w.id}>
                            <TableCell className="font-medium">{w.nom}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {TRIGGER_LABELS[w.trigger_type] ?? w.trigger_type}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {w.stats?.runs ?? 0}
                              {w.stats?.failed ? (
                                <span className="text-destructive ml-1">({w.stats.failed} ✗)</span>
                              ) : null}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground hidden md:table-cell">
                              {w.last_run_at
                                ? format(new Date(w.last_run_at), 'PPp', { locale: fr })
                                : '—'}
                            </TableCell>
                            <TableCell>
                              <Switch
                                checked={w.is_active}
                                onCheckedChange={(v) =>
                                  toggleMut.mutate({ id: w.id, is_active: v })
                                }
                                // Le nom de l'automatisation est dans une autre
                                // cellule, non reliée : sans libellé propre, axe
                                // remonte `button-name` (critical) sur chaque ligne.
                                aria-label={`Activer l'automatisation ${w.nom}`}
                              />
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Lancer maintenant"
                                aria-label="Lancer maintenant"
                                disabled={triggerMut.isPending}
                                onClick={() =>
                                  triggerMut.mutate({
                                    workflow_id: w.id,
                                    payload: { manual: true, started_at: new Date().toISOString() },
                                  })
                                }
                              >
                                <Zap className="h-4 w-4 text-amber-500" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Éditer"
                                onClick={() => navigate(`/automatisations/${w.id}/edit`)}
                                aria-label="Modifier"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Dupliquer"
                                onClick={() =>
                                  createMut.mutate({
                                    nom: `${w.nom} (copie)`,
                                    trigger_type: w.trigger_type,
                                    graph: w.graph as any,
                                  })
                                }
                                aria-label="Copier"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Exporter en JSON"
                                onClick={() => {
                                  const payload = {
                                    nom: w.nom,
                                    description: w.description,
                                    trigger_type: w.trigger_type,
                                    graph: w.graph,
                                    exported_at: new Date().toISOString(),
                                  }
                                  const blob = new Blob([JSON.stringify(payload, null, 2)], {
                                    type: 'application/json',
                                  })
                                  const url = URL.createObjectURL(blob)
                                  const a = document.createElement('a')
                                  a.href = url
                                  a.download = `workflow-${w.nom.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`
                                  a.click()
                                  URL.revokeObjectURL(url)
                                }}
                                aria-label="Télécharger"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Supprimer"
                                onClick={() => setDeleteId(w.id)}
                                aria-label="Supprimer"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates" className="mt-4 space-y-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher un modèle…"
                      value={tplSearch}
                      onChange={(e) => setTplSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={tplCategory} onValueChange={setTplCategory}>
                    <SelectTrigger className="md:w-[220px]">
                      <SelectValue placeholder="Toutes catégories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes catégories</SelectItem>
                      {Object.entries(TEMPLATE_CATEGORIES).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {tplLoading ? (
              <p className="text-sm text-muted-foreground">Chargement des modèles…</p>
            ) : filteredTemplates.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Aucun modèle trouvé.
                </CardContent>
              </Card>
            ) : (
              Object.entries(groupedByCategory).map(([cat, list]) => {
                const meta = TEMPLATE_CATEGORIES[cat] ?? { label: cat, color: '' }
                return (
                  <div key={cat} className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      {meta.label}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {list.map((tpl) => (
                        <Card
                          key={tpl.id}
                          className="hover:border-primary/40 hover:shadow-md transition-all flex flex-col"
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="text-3xl">{tpl.icon}</div>
                              <Badge variant="outline" className={`text-xs ${meta.color}`}>
                                {meta.label}
                              </Badge>
                            </div>
                            <CardTitle className="text-base mt-2">{tpl.name}</CardTitle>
                            <CardDescription className="text-xs line-clamp-3">
                              {tpl.description}
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="mt-auto pt-0 space-y-3">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Zap className="h-3 w-3" />
                              <span className="truncate">
                                {TRIGGER_LABELS[tpl.trigger_type] ?? tpl.trigger_type}
                              </span>
                            </div>
                            <Button
                              size="sm"
                              className="w-full"
                              onClick={() => handleUseTemplate(tpl)}
                              disabled={instantiateMut.isPending}
                            >
                              <Play className="h-3.5 w-3.5 mr-2" /> Utiliser ce modèle
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )
              })
            )}
          </TabsContent>
        </Tabs>

        <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer ce workflow ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action est irréversible. L'historique d'exécution sera également supprimé.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deleteId) deleteMut.mutate(deleteId)
                  setDeleteId(null)
                }}
              >
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </ImmersivePageBackground>
  )
}
