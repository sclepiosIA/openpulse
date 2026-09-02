import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import {
  useBIDatasets,
  useSaveBIQuestion,
  type BIQuestion,
  type BIDefinition,
  type BIVizType,
  type BIFilter,
  type BIGroupBy,
  type BIAggregation,
} from '@/hooks/bi/useBIStudio'

const VIZ_TYPES: { value: BIVizType; label: string }[] = [
  { value: 'table', label: 'Table' },
  { value: 'kpi', label: 'KPI' },
  { value: 'line', label: 'Ligne' },
  { value: 'bar', label: 'Barres' },
  { value: 'stacked_bar', label: 'Barres empilées' },
  { value: 'pie', label: 'Camembert' },
  { value: 'funnel', label: 'Entonnoir' },
]

const OPS: BIFilter['op'][] = [
  '=',
  '!=',
  '<',
  '<=',
  '>',
  '>=',
  'in',
  'between',
  'ilike',
  'is_null',
  'is_not_null',
]

export function BIQuestionEditor({
  open,
  onOpenChange,
  initial,
  defaultDatasetId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  initial?: BIQuestion | null
  defaultDatasetId?: string
}) {
  const { data: datasets } = useBIDatasets()
  const save = useSaveBIQuestion()

  const [datasetId, setDatasetId] = useState(initial?.dataset_id ?? defaultDatasetId ?? '')
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [vizType, setVizType] = useState<BIVizType>(initial?.viz_type ?? 'table')
  const [definition, setDefinition] = useState<BIDefinition>(initial?.definition ?? {})

  useEffect(() => {
    if (open) {
      setDatasetId(initial?.dataset_id ?? defaultDatasetId ?? '')
      setName(initial?.name ?? '')
      setDescription(initial?.description ?? '')
      setVizType(initial?.viz_type ?? 'table')
      setDefinition(initial?.definition ?? {})
    }
  }, [open, initial, defaultDatasetId])

  const ds = datasets?.find((d) => d.id === datasetId)
  const columns = ds?.columns ?? []

  const filters = definition.filters ?? []
  const group_by = definition.group_by ?? []
  const aggregations = definition.aggregations ?? []

  const patch = (p: Partial<BIDefinition>) => setDefinition((d) => ({ ...d, ...p }))

  const canSave = !!datasetId && !!name && !!ds

  const handleSave = async () => {
    if (!canSave) return
    await save.mutateAsync({
      id: initial?.id,
      dataset_id: datasetId,
      name,
      description,
      definition,
      viz_type: vizType,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{initial ? 'Modifier la question' : 'Nouvelle question BI'}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Dataset</Label>
              <Select value={datasetId} onValueChange={setDatasetId} disabled={!!initial}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner…" />
                </SelectTrigger>
                <SelectContent>
                  {(datasets ?? []).map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Visualisation</Label>
              <Select value={vizType} onValueChange={(v) => setVizType(v as BIVizType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VIZ_TYPES.map((v) => (
                    <SelectItem key={v.value} value={v.value}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Nom</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Revenus par mois"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={description ?? ''}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          {ds && (
            <>
              {/* FILTRES */}
              <div className="space-y-2 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <Label>Filtres</Label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      patch({ filters: [...filters, { col: columns[0]?.name ?? '', op: '=' }] })
                    }
                  >
                    <Plus className="h-3 w-3 mr-1" /> Ajouter
                  </Button>
                </div>
                {filters.length === 0 && (
                  <p className="text-xs text-muted-foreground">Aucun filtre.</p>
                )}
                {filters.map((f, i) => (
                  <div key={i} className="grid grid-cols-[1fr_100px_1fr_auto] gap-2 items-center">
                    <Select
                      value={f.col}
                      onValueChange={(v) => {
                        const next = [...filters]
                        next[i] = { ...f, col: v }
                        patch({ filters: next })
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.map((c) => (
                          <SelectItem key={c.name} value={c.name}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={f.op}
                      onValueChange={(v) => {
                        const next = [...filters]
                        next[i] = { ...f, op: v as BIFilter['op'] }
                        patch({ filters: next })
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPS.map((op) => (
                          <SelectItem key={op} value={op}>
                            {op}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {f.op === 'is_null' || f.op === 'is_not_null' ? (
                      <div />
                    ) : (
                      <Input
                        placeholder={f.op === 'in' || f.op === 'between' ? 'a,b,c' : 'valeur'}
                        value={
                          Array.isArray(f.value)
                            ? f.value.join(',')
                            : ((f.value as string | number | undefined) ?? '')
                        }
                        onChange={(e) => {
                          const next = [...filters]
                          const raw = e.target.value
                          const parsed =
                            f.op === 'in' || f.op === 'between'
                              ? raw.split(',').map((s) => s.trim())
                              : raw
                          next[i] = { ...f, value: parsed }
                          patch({ filters: next })
                        }}
                      />
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => {
                        const next = filters.filter((_, j) => j !== i)
                        patch({ filters: next })
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* GROUP BY */}
              <div className="space-y-2 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <Label>Group by</Label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      patch({ group_by: [...group_by, { col: columns[0]?.name ?? '' }] })
                    }
                  >
                    <Plus className="h-3 w-3 mr-1" /> Ajouter
                  </Button>
                </div>
                {group_by.length === 0 && (
                  <p className="text-xs text-muted-foreground">Aucun groupement.</p>
                )}
                {group_by.map((g, i) => (
                  <div key={i} className="grid grid-cols-[1fr_140px_auto] gap-2 items-center">
                    <Select
                      value={g.col}
                      onValueChange={(v) => {
                        const next = [...group_by]
                        next[i] = { ...g, col: v }
                        patch({ group_by: next })
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.map((c) => (
                          <SelectItem key={c.name} value={c.name}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={g.date_trunc ?? 'none'}
                      onValueChange={(v) => {
                        const next = [...group_by]
                        next[i] = {
                          ...g,
                          date_trunc: v === 'none' ? undefined : (v as BIGroupBy['date_trunc']),
                        }
                        patch({ group_by: next })
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sans trunc</SelectItem>
                        <SelectItem value="day">Jour</SelectItem>
                        <SelectItem value="week">Semaine</SelectItem>
                        <SelectItem value="month">Mois</SelectItem>
                        <SelectItem value="quarter">Trimestre</SelectItem>
                        <SelectItem value="year">Année</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => {
                        patch({ group_by: group_by.filter((_, j) => j !== i) })
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* AGGREGATIONS */}
              <div className="space-y-2 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <Label>Agrégations</Label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      patch({
                        aggregations: [
                          ...aggregations,
                          { fn: 'count', alias: `total_${aggregations.length + 1}` },
                        ],
                      })
                    }
                  >
                    <Plus className="h-3 w-3 mr-1" /> Ajouter
                  </Button>
                </div>
                {aggregations.length === 0 && (
                  <p className="text-xs text-muted-foreground">Aucune agrégation.</p>
                )}
                {aggregations.map((a, i) => (
                  <div key={i} className="grid grid-cols-[120px_1fr_1fr_auto] gap-2 items-center">
                    <Select
                      value={a.fn}
                      onValueChange={(v) => {
                        const next = [...aggregations]
                        next[i] = { ...a, fn: v as BIAggregation['fn'] }
                        patch({ aggregations: next })
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="count">count</SelectItem>
                        <SelectItem value="count_distinct">count distinct</SelectItem>
                        <SelectItem value="sum">sum</SelectItem>
                        <SelectItem value="avg">avg</SelectItem>
                        <SelectItem value="min">min</SelectItem>
                        <SelectItem value="max">max</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={a.col ?? '__none__'}
                      onValueChange={(v) => {
                        const next = [...aggregations]
                        next[i] = { ...a, col: v === '__none__' ? undefined : v }
                        patch({ aggregations: next })
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Colonne" />
                      </SelectTrigger>
                      <SelectContent>
                        {a.fn === 'count' && <SelectItem value="__none__">— (toutes)</SelectItem>}
                        {columns.map((c) => (
                          <SelectItem key={c.name} value={c.name}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={a.alias}
                      onChange={(e) => {
                        const next = [...aggregations]
                        next[i] = { ...a, alias: e.target.value }
                        patch({ aggregations: next })
                      }}
                      placeholder="Alias"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => {
                        patch({ aggregations: aggregations.filter((_, j) => j !== i) })
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-1">
                <span className="text-xs text-muted-foreground mr-1">Colonnes dispo :</span>
                {columns.map((c) => (
                  <Badge key={c.name} variant="outline" className="text-[10px]">
                    {c.label}
                  </Badge>
                ))}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={!canSave || save.isPending}>
            {save.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Sauvegarder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
