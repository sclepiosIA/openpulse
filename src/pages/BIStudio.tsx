import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Sparkles, Plus, Database, LayoutDashboard, Search, BarChart3, Users } from 'lucide-react'
import { PageDataState } from '@/components/common/PageDataState'
import { usePageTitle } from '@/hooks/shared/usePageTitle'
import {
  useBIDatasets,
  useBIDashboards,
  useBIQuestions,
  type BIQuestion,
} from '@/hooks/bi/useBIStudio'
import { BIQuestionCard } from '@/components/bi/BIQuestionCard'
import { BIQuestionEditor } from '@/components/bi/BIQuestionEditor'

export default function BIStudio() {
  usePageTitle('BI Studio')
  const {
    data: datasets,
    isLoading: dsLoading,
    isError: dsError,
    refetch: refetchDs,
  } = useBIDatasets()
  const { data: dashboards } = useBIDashboards()
  const [datasetFilter, setDatasetFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [vizFilter, setVizFilter] = useState<string>('all')
  const {
    data: questions,
    isLoading: qLoading,
    isError: qError,
    refetch: refetchQ,
  } = useBIQuestions(datasetFilter === 'all' ? undefined : datasetFilter)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<BIQuestion | null>(null)

  const filteredQuestions = useMemo(() => {
    const list = questions ?? []
    const s = search.trim().toLowerCase()
    return list.filter((q) => {
      if (vizFilter !== 'all' && q.viz_type !== vizFilter) return false
      if (!s) return true
      return (
        q.name.toLowerCase().includes(s) ||
        (q.description ?? '').toLowerCase().includes(s) ||
        (q.tags ?? []).some((t) => t.toLowerCase().includes(s))
      )
    })
  }, [questions, search, vizFilter])

  const openNew = () => {
    setEditing(null)
    setEditorOpen(true)
  }
  const openEdit = (q: BIQuestion) => {
    setEditing(q)
    setEditorOpen(true)
  }

  const nbQuestions = questions?.length ?? 0
  const nbShared = (questions ?? []).filter((q) => q.is_shared).length
  const nbDashboards = dashboards?.length ?? 0
  const nbDatasets = datasets?.length ?? 0

  return (
    <div className="temps-scope min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-[1500px]">
        {/* Hero */}
        <header className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-3">
              <Sparkles className="h-3.5 w-3.5" />
              BI Studio
            </div>
            <h1 className="text-4xl font-semibold tracking-tight text-foreground">
              Exploration & analyses
            </h1>
            <p className="text-muted-foreground mt-1.5 max-w-2xl">
              Datasets, questions préconstruites et dashboards — croise, filtre, visualise, et
              laisse Jarvis expliquer.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={openNew} disabled={!datasets?.length} className="rounded-lg shadow-sm">
              <Plus className="h-4 w-4 mr-1.5" /> Nouvelle question
            </Button>
          </div>
        </header>

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile
            label="Questions"
            value={nbQuestions}
            sub={`${nbShared} partagée${nbShared > 1 ? 's' : ''}`}
            icon={<BarChart3 className="h-4 w-4 text-primary" />}
          />
          <KpiTile
            label="Datasets"
            value={nbDatasets}
            sub="sources actives"
            icon={<Database className="h-4 w-4 text-muted-foreground" />}
          />
          <KpiTile
            label="Dashboards"
            value={nbDashboards}
            sub="tableaux de bord"
            icon={<LayoutDashboard className="h-4 w-4 text-muted-foreground" />}
          />
          <KpiTile
            label="Bibliothèque"
            value={(questions ?? []).filter((q) => (q.tags ?? []).length > 0).length}
            sub="questions taguées"
            icon={<Users className="h-4 w-4 text-muted-foreground" />}
          />
        </div>

        <Tabs defaultValue="questions" className="space-y-4">
          <TabsList className="segment h-auto">
            <TabsTrigger
              value="questions"
              className="rounded-lg px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <Database className="h-3.5 w-3.5 mr-1.5" /> Questions
            </TabsTrigger>
            <TabsTrigger
              value="dashboards"
              className="rounded-lg px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <LayoutDashboard className="h-3.5 w-3.5 mr-1.5" /> Dashboards
            </TabsTrigger>
            <TabsTrigger
              value="datasets"
              className="rounded-lg px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              Datasets
            </TabsTrigger>
          </TabsList>

          <TabsContent value="questions" className="space-y-4">
            <PageDataState
              isLoading={dsLoading}
              isError={dsError}
              isEmpty={false}
              onRetry={() => refetchDs()}
            >
              {/* Toolbar */}
              <div className="kpi-card p-3 flex flex-wrap gap-2 items-center">
                <div className="relative flex-1 min-w-[220px] max-w-md">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher (nom, description, tag)…"
                    className="pl-8 h-9 rounded-lg"
                  />
                </div>
                <Select value={datasetFilter} onValueChange={setDatasetFilter}>
                  <SelectTrigger className="w-[220px] h-9 rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les datasets</SelectItem>
                    {(datasets ?? []).map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={vizFilter} onValueChange={setVizFilter}>
                  <SelectTrigger className="w-[160px] h-9 rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes viz</SelectItem>
                    <SelectItem value="kpi">KPI</SelectItem>
                    <SelectItem value="line">Ligne</SelectItem>
                    <SelectItem value="bar">Barres</SelectItem>
                    <SelectItem value="stacked_bar">Barres empilées</SelectItem>
                    <SelectItem value="pie">Camembert</SelectItem>
                    <SelectItem value="funnel">Entonnoir</SelectItem>
                    <SelectItem value="table">Tableau</SelectItem>
                  </SelectContent>
                </Select>
                <div className="ml-auto text-xs text-muted-foreground">
                  {filteredQuestions.length} / {nbQuestions} question{nbQuestions > 1 ? 's' : ''}
                </div>
              </div>

              <PageDataState
                isLoading={qLoading}
                isError={qError}
                isEmpty={!qLoading && filteredQuestions.length === 0}
                emptyTitle="Aucune question"
                emptyDescription="Créez votre première question BI ou ajustez vos filtres."
                emptyAction={
                  <Button onClick={openNew}>
                    <Plus className="h-4 w-4 mr-1.5" /> Nouvelle question
                  </Button>
                }
                onRetry={() => refetchQ()}
              >
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {filteredQuestions.map((q) => (
                    <BIQuestionCard key={q.id} question={q} onEdit={openEdit} />
                  ))}
                </div>
              </PageDataState>
            </PageDataState>
          </TabsContent>

          <TabsContent value="dashboards" className="space-y-3">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {(dashboards ?? []).map((d) => (
                <div key={d.id} className="kpi-card p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <div className="font-display text-base font-semibold text-foreground truncate">
                        {d.name}
                      </div>
                      {d.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {d.description}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <LayoutDashboard className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-3">
                    {d.allowed_roles.map((r) => (
                      <Badge key={r} variant="secondary" className="text-[10px] rounded-md">
                        {r}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-border/60 text-xs text-muted-foreground">
                    {d.layout?.length ?? 0} widget{(d.layout?.length ?? 0) > 1 ? 's' : ''}
                  </div>
                </div>
              ))}
              {(dashboards ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground col-span-full">
                  Aucun dashboard configuré.
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="datasets" className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {(datasets ?? []).map((d) => (
                <div key={d.id} className="kpi-card p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <div className="font-display text-base font-semibold text-foreground truncate">
                        {d.name}
                      </div>
                      {d.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {d.description}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 h-9 w-9 rounded-lg bg-muted text-muted-foreground flex items-center justify-center">
                      <Database className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground mb-2">
                    Source · <code className="rounded bg-muted px-1 py-0.5">{d.source_view}</code>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {d.columns.slice(0, 12).map((c) => (
                      <Badge key={c.name} variant="outline" className="text-[10px] rounded-md">
                        {c.label}
                      </Badge>
                    ))}
                    {d.columns.length > 12 && (
                      <Badge variant="outline" className="text-[10px] rounded-md">
                        +{d.columns.length - 12}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <BIQuestionEditor
          open={editorOpen}
          onOpenChange={setEditorOpen}
          initial={editing}
          defaultDatasetId={datasetFilter !== 'all' ? datasetFilter : undefined}
        />
      </div>
    </div>
  )
}

function KpiTile({
  label,
  value,
  sub,
  icon,
}: {
  label: string
  value: number | string
  sub?: string
  icon?: React.ReactNode
}) {
  return (
    <div className="kpi-card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
          {label}
        </span>
        {icon}
      </div>
      <div className="day-total-lg text-3xl text-foreground">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-2">{sub}</div>}
    </div>
  )
}
