import { useState, useMemo, useEffect } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ExternalLink, Building2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSmartNavigation } from '@/hooks/shared/useSmartNavigation'
import { useSearchParams } from 'react-router-dom'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { EntityAvatar } from '@/components/ui/EntityAvatar'
import { CRMTableWrapper } from '@/components/layout/CRMTableWrapper'
import { CRMSortableHeader } from '@/components/layout/CRMSortableHeader'
import { CRMEmptyState } from '@/components/layout/CRMEmptyState'
import { cn } from '@/lib/utils'
import type { EtablissementWithGroupLogo as Etablissement } from '@/hooks/crm/useEtablissements'
import { useUpdateEtablissement } from '@/hooks/crm/useEtablissements'
import type { ProfileForTable } from '@/types/taches-analytics'
import { ProspectScoreBadge } from '@/components/prospects/ProspectScoreBadge'
import { InlineEditCell } from '@/components/inline-edit/InlineEditCell'
import { useColumnVisibility, type ColumnConfig } from '@/hooks/views/useColumnVisibility'
import { ColumnVisibilityMenu } from '@/components/views/ColumnVisibilityMenu'
import { Checkbox } from '@/components/ui/checkbox'
import { useRowSelection } from '@/hooks/views/useRowSelection'
import { BulkActionBar } from '@/components/views/BulkActionBar'
import { EntityRowContextMenu } from '@/components/views/EntityRowContextMenu'
import { useTableKeyboardNav } from '@/hooks/views/useTableKeyboardNav'
import { useTableGrouping, type GroupableField } from '@/hooks/views/useTableGrouping'
import { GroupByMenu } from '@/components/views/GroupByMenu'
import { useSavedViews } from '@/hooks/views/useSavedViews'
import { SavedViewsMenu } from '@/components/views/SavedViewsMenu'
import { ViewFilterChipsBar, type ActiveFilterChip } from '@/components/views/ViewFilterChipsBar'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useTablePagination } from '@/hooks/views/useTablePagination'
import { TablePaginationFooter } from '@/components/views/TablePaginationFooter'
import { useSidePeek } from '@/hooks/views/useSidePeek'
import { RecordSidePeek } from '@/components/views/RecordSidePeek'
import { EtablissementSidePeekContent } from './EtablissementSidePeekContent'
import { toast } from 'sonner'

const STATUT_OPTIONS = [
  { value: 'Prospect', label: 'Prospect' },
  { value: 'Contractualisé', label: 'Contractualisé' },
  { value: 'Déploiement', label: 'Déploiement' },
  { value: 'Formation', label: 'Formation' },
  { value: 'Go-Live', label: 'Go-Live' },
  { value: 'Production', label: 'Production' },
  { value: 'Bloqué', label: 'Bloqué' },
  { value: 'Perdu', label: 'Perdu' },
]

const TABLE_COLUMNS: ColumnConfig[] = [
  { key: 'type', label: 'Type', required: true },
  { key: 'nom', label: 'Nom', required: true },
  { key: 'ville', label: 'Ville' },
  { key: 'region', label: 'Région' },
  { key: 'statut', label: 'Statut' },
  { key: 'progression', label: 'Progression' },
  { key: 'score_conversion', label: 'Score' },
  { key: 'dpi', label: 'DPI' },
  { key: 'equipe', label: 'Équipe' },
  { key: 'actions', label: 'Actions', required: true },
]

interface EtablissementsTableViewProps {
  etablissements: Etablissement[]
  profiles?: ProfileForTable[]
}

export function EtablissementsTableView({
  etablissements,
  profiles,
}: EtablissementsTableViewProps) {
  const { smartNavigate, navigate } = useSmartNavigation()
  const updateEtab = useUpdateEtablissement()
  const { isVisible, toggle, move, reset, setRaw, orderedColumns, visibleKeys, order } =
    useColumnVisibility('etablissements-table-columns', TABLE_COLUMNS)
  const [searchParams, setSearchParams] = useSearchParams()
  const [sortConfig, setSortConfig] = useState<{
    key: string
    direction: 'asc' | 'desc'
  } | null>(() => {
    const key = searchParams.get('tsort')
    const dir = searchParams.get('tdir')
    if (!key) return null
    return { key, direction: dir === 'desc' ? 'desc' : 'asc' }
  })
  const [quickFilter, setQuickFilter] = useState(() => searchParams.get('tq') ?? '')
  const selection = useRowSelection(etablissements)
  const kbdNav = useTableKeyboardNav<HTMLDivElement>()
  const sidePeek = useSidePeek('peek')
  const peekEtab = useMemo(
    () => (sidePeek.openId ? (etablissements.find((e) => e.id === sidePeek.openId) ?? null) : null),
    [sidePeek.openId, etablissements]
  )

  // Sync table state → URL (shareable views, à la Twenty CRM)
  useEffect(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (quickFilter.trim()) next.set('tq', quickFilter.trim())
        else next.delete('tq')
        if (sortConfig) {
          next.set('tsort', sortConfig.key)
          next.set('tdir', sortConfig.direction)
        } else {
          next.delete('tsort')
          next.delete('tdir')
        }
        return next
      },
      { replace: true }
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickFilter, sortConfig?.key, sortConfig?.direction])

  const filteredEtablissements = useMemo(() => {
    const q = quickFilter.trim().toLowerCase()
    if (!q) return etablissements
    return etablissements.filter((e) => {
      const haystack = [e.nom, e.ville, e.region, e.statut, e.dpi]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [etablissements, quickFilter])

  const GROUPABLE_FIELDS: GroupableField<Etablissement>[] = [
    { key: 'statut', label: 'Statut', getValue: (r) => r.statut },
    { key: 'region', label: 'Région', getValue: (r) => r.region },
    { key: 'ville', label: 'Ville', getValue: (r) => r.ville },
    { key: 'dpi', label: 'DPI', getValue: (r) => r.dpi },
  ]
  const grouping = useTableGrouping<Etablissement>(
    'etablissements-table-groupby',
    [],
    GROUPABLE_FIELDS
  )

  type ViewState = {
    visible: string[]
    order: string[]
    sort: { key: string; direction: 'asc' | 'desc' } | null
    groupBy: string | null
  }
  const savedViews = useSavedViews<ViewState>('etablissements-saved-views')

  const currentViewState = (): ViewState => ({
    visible: visibleKeys,
    order,
    sort: sortConfig,
    groupBy: grouping.groupBy,
  })

  const applyViewState = (s: ViewState) => {
    setRaw({ visible: s.visible, order: s.order })
    setSortConfig(s.sort)
    grouping.setGroupBy(s.groupBy)
  }

  const handleBulkStatus = async (status: string) => {
    const ids = Array.from(selection.selectedIds)
    try {
      await Promise.all(
        ids.map((id) =>
          updateEtab.mutateAsync({ id, data: { statut: status as Etablissement['statut'] } })
        )
      )
      toast.success(`${ids.length} établissement(s) mis à jour`)
      selection.clear()
    } catch (e) {
      toast.error('Erreur lors de la mise à jour groupée')
    }
  }

  const handleBulkAssignOwner = async (fieldKey: string, profileId: string | null) => {
    const ids = Array.from(selection.selectedIds)
    if (ids.length === 0) return
    try {
      await Promise.all(
        ids.map((id) =>
          updateEtab.mutateAsync({
            id,
            data: { [fieldKey]: profileId } as Partial<Etablissement>,
          })
        )
      )
      toast.success(`${ids.length} établissement(s) réassigné(s)`)
      selection.clear()
    } catch {
      toast.error("Erreur lors de l'assignation groupée")
    }
  }

  const handleBulkExport = () => {
    const rows = selection.selectedItems
    if (rows.length === 0) return
    const headers = ['Nom', 'Ville', 'Région', 'Statut', 'Progression', 'DPI']
    const escape = (v: unknown) => {
      const s = v === null || v === undefined ? '' : String(v)
      return `"${s.replace(/"/g, '""')}"`
    }
    const csv = [
      headers.join(','),
      ...rows.map((r) =>
        [r.nom, r.ville, r.region, r.statut, r.progression ?? 0, r.dpi ?? ''].map(escape).join(',')
      ),
    ].join('\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `etablissements-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleSort = (key: string) => {
    setSortConfig({
      key,
      direction: sortConfig?.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc',
    })
  }

  const sortedEtablissements = [...filteredEtablissements].sort((a, b) => {
    if (!sortConfig) return 0

    const aValue = a[sortConfig.key as keyof Etablissement]
    const bValue = b[sortConfig.key as keyof Etablissement]

    if (aValue === null || aValue === undefined) return 1
    if (bValue === null || bValue === undefined) return -1

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortConfig.direction === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue)
    }

    return sortConfig.direction === 'asc' ? (aValue > bValue ? 1 : -1) : bValue > aValue ? 1 : -1
  })

  // Pagination (Twenty-CRM style) — désactivée quand un regroupement est actif
  // pour ne pas casser les groupes au milieu d'une page.
  // Appelé avant tout early return (liste vide) pour respecter les Rules of Hooks.
  const pagination = useTablePagination('etablissements-table-page-size', sortedEtablissements, 50)

  const getStatutBadgeVariant = (statut: string) => {
    switch (statut) {
      case 'Production':
        return 'default'
      case 'Déploiement':
      case 'Formation':
        return 'secondary'
      case 'Go-Live':
        return 'default'
      default:
        return 'outline'
    }
  }

  const getProfileInitials = (profileId: string | null) => {
    if (!profileId || !profiles) return '?'
    const profile = profiles.find((p) => p.id === profileId)
    if (!profile) return '?'
    return `${profile.prenom?.[0] || ''}${profile.nom?.[0] || ''}`.toUpperCase()
  }

  if (etablissements.length === 0) {
    return (
      <CRMEmptyState
        icon={Building2}
        title="Aucun établissement trouvé"
        description="Modifiez vos critères de recherche ou créez un nouvel établissement."
        variant="compact"
      />
    )
  }

  const visibleColCount = 1 /* checkbox */ + orderedColumns.filter((c) => isVisible(c.key)).length

  const groupedRows = (() => {
    if (!grouping.activeField) return null
    const map = new Map<string, Etablissement[]>()
    for (const row of sortedEtablissements) {
      const raw = grouping.activeField.getValue(row)
      const key = raw == null || raw === '' ? '—' : String(raw)
      const list = map.get(key)
      if (list) list.push(row)
      else map.set(key, [row])
    }
    return Array.from(map.entries())
      .map(([key, rows]) => ({ key, rows }))
      .sort((a, b) => a.key.localeCompare(b.key, 'fr'))
  })()

  const paginationActive = !grouping.activeField
  const rowsToRender = paginationActive ? pagination.pageRows : sortedEtablissements

  const renderRow = (etab: Etablissement, index: number) => (
    <EntityRowContextMenu
      key={etab.id}
      favoriteItem={{
        id: etab.id,
        type: 'etablissement',
        title: etab.nom,
        subtitle: [etab.ville, etab.region].filter(Boolean).join(' · '),
        url: `/etablissements/${etab.id}`,
      }}
    >
      <TableRow
        data-row-nav="true"
        className={cn(
          'cursor-pointer transition-colors duration-150',
          'hover:bg-muted/50 group',
          'animate-in fade-in-0 slide-in-from-bottom-1',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset'
        )}
        style={{ animationDelay: `${Math.min(index * 20, 200)}ms` }}
        onClick={(e) => {
          // Cmd/Ctrl/middle/shift → conserver le comportement smartNavigate (nouvel onglet, etc.)
          if (e.metaKey || e.ctrlKey || e.shiftKey || (e as any).button === 1) {
            smartNavigate(e, `/etablissements/${etab.id}`)
            return
          }
          sidePeek.open(etab.id)
        }}
        role="button"
        tabIndex={0}
        aria-label={`Aperçu de l'établissement ${etab.nom}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            if (e.metaKey || e.ctrlKey) navigate(`/etablissements/${etab.id}`)
            else sidePeek.open(etab.id)
          } else if (e.key === ' ') {
            e.preventDefault()
            sidePeek.open(etab.id)
          }
        }}
      >
        <TableCell className="w-[40px]" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={selection.isSelected(etab.id)}
            onCheckedChange={() => selection.toggle(etab.id)}
            aria-label={`Sélectionner ${etab.nom}`}
          />
        </TableCell>
        {isVisible('type') && (
          <TableCell className="w-[50px] overflow-hidden">
            <div className="w-8 h-8 flex items-center justify-center overflow-hidden rounded-md shrink-0">
              <EntityAvatar
                name={etab.nom}
                logoUrl={etab.logo_url || etab.groupe_logo_url}
                size="sm"
                className="shrink-0"
              />
            </div>
          </TableCell>
        )}
        {isVisible('nom') && <TableCell className="font-medium">{etab.nom}</TableCell>}
        {isVisible('ville') && (
          <TableCell onClick={(e) => e.stopPropagation()}>
            <InlineEditCell
              value={etab.ville}
              onSave={async (v) => {
                await updateEtab.mutateAsync({ id: etab.id, data: { ville: (v as string) ?? '' } })
              }}
              ariaLabel="Modifier la ville"
            />
          </TableCell>
        )}
        {isVisible('region') && (
          <TableCell>
            <span className="text-sm text-muted-foreground">{etab.region}</span>
          </TableCell>
        )}
        {isVisible('statut') && (
          <TableCell onClick={(e) => e.stopPropagation()}>
            <InlineEditCell
              value={etab.statut}
              type="select"
              options={STATUT_OPTIONS}
              onSave={async (v) => {
                await updateEtab.mutateAsync({
                  id: etab.id,
                  data: { statut: v as Etablissement['statut'] },
                })
              }}
              ariaLabel="Modifier le statut"
              renderDisplay={(v) => (
                <Badge variant={getStatutBadgeVariant(String(v ?? ''))}>{String(v ?? '—')}</Badge>
              )}
            />
          </TableCell>
        )}
        {isVisible('progression') && (
          <TableCell>
            <div className="flex items-center gap-2 min-w-[120px]">
              <Progress value={etab.progression || 0} className="h-2 flex-1" />
              <span className="text-xs text-muted-foreground w-10 text-right tabular-nums">
                {etab.progression || 0}%
              </span>
            </div>
          </TableCell>
        )}
        {isVisible('score_conversion') && (
          <TableCell>
            <ProspectScoreBadge
              score={etab.score_conversion ?? undefined}
              factors={etab.score_conversion_factors ?? undefined}
              velocity={etab.engagement_velocity ?? undefined}
              behavioralScore={etab.behavioral_score ?? undefined}
              compact
            />
          </TableCell>
        )}
        {isVisible('dpi') && (
          <TableCell>
            {etab.dpi ? (
              <Badge variant="outline" className="text-xs">
                {etab.dpi}
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground">N/A</span>
            )}
          </TableCell>
        )}
        {isVisible('equipe') && (
          <TableCell>
            <div className="flex -space-x-2">
              {etab.commercial_id && (
                <Avatar className="h-6 w-6 border-2 border-background ring-1 ring-background">
                  <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                    {getProfileInitials(etab.commercial_id)}
                  </AvatarFallback>
                </Avatar>
              )}
              {etab.chef_projet_id && (
                <Avatar className="h-6 w-6 border-2 border-background ring-1 ring-background">
                  <AvatarFallback className="text-xs bg-secondary text-secondary-foreground">
                    {getProfileInitials(etab.chef_projet_id)}
                  </AvatarFallback>
                </Avatar>
              )}
              {etab.csm_id && (
                <Avatar className="h-6 w-6 border-2 border-background ring-1 ring-background">
                  <AvatarFallback className="text-xs bg-accent text-accent-foreground">
                    {getProfileInitials(etab.csm_id)}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          </TableCell>
        )}
        {isVisible('actions') && (
          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/etablissements/${etab.id}`)}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </TableCell>
        )}
      </TableRow>
    </EntityRowContextMenu>
  )

  return (
    <div ref={kbdNav.containerRef} onKeyDown={kbdNav.onKeyDown}>
      <CRMTableWrapper minWidth="1000px">
        <div className="flex items-center gap-1 px-2 py-1 border-b bg-muted/30">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={quickFilter}
              onChange={(e) => setQuickFilter(e.target.value)}
              placeholder="Filtrer dans la liste…"
              className="h-8 pl-7 text-xs"
              aria-label="Filtrer rapidement les établissements"
            />
          </div>
          <div className="flex-1" />
          <SavedViewsMenu
            views={savedViews.views}
            activeId={savedViews.activeId}
            onApply={(s, id) => {
              applyViewState(s)
              savedViews.setActive(id)
            }}
            onSave={(name) => savedViews.save(name, currentViewState())}
            onUpdate={(id) => savedViews.update(id, currentViewState())}
            onRename={savedViews.rename}
            onRemove={savedViews.remove}
          />
          <GroupByMenu
            fields={GROUPABLE_FIELDS.map((f) => ({ key: f.key, label: f.label }))}
            groupBy={grouping.groupBy}
            onChange={grouping.setGroupBy}
          />
          <ColumnVisibilityMenu
            columns={orderedColumns}
            isVisible={isVisible}
            toggle={toggle}
            move={move}
            reset={reset}
          />
        </div>
        {(() => {
          const chips: ActiveFilterChip[] = []
          if (quickFilter.trim()) {
            chips.push({
              key: 'quick',
              icon: 'filter',
              label: 'Recherche',
              value: `"${quickFilter}" → ${filteredEtablissements.length}/${etablissements.length}`,
              onClear: () => setQuickFilter(''),
            })
          }
          if (sortConfig) {
            const col = TABLE_COLUMNS.find((c) => c.key === sortConfig.key)
            chips.push({
              key: 'sort',
              icon: 'sort',
              label: 'Tri',
              value: `${col?.label ?? sortConfig.key} (${sortConfig.direction === 'asc' ? '↑' : '↓'})`,
              onClear: () => setSortConfig(null),
            })
          }
          if (grouping.activeField) {
            chips.push({
              key: 'group',
              icon: 'group',
              label: 'Groupé par',
              value: grouping.activeField.label,
              onClear: () => grouping.setGroupBy(null),
            })
          }
          if (selection.count > 0) {
            chips.push({
              key: 'selection',
              icon: 'selection',
              label: 'Sélection',
              value: `${selection.count} ligne(s)`,
              onClear: () => selection.clear(),
            })
          }
          return (
            <ViewFilterChipsBar
              chips={chips}
              onClearAll={() => {
                setQuickFilter('')
                setSortConfig(null)
                grouping.setGroupBy(null)
                selection.clear()
              }}
            />
          )
        })()}
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={
                    selection.allSelected ? true : selection.someSelected ? 'indeterminate' : false
                  }
                  onCheckedChange={() => selection.toggleAll()}
                  aria-label="Tout sélectionner"
                />
              </TableHead>
              {isVisible('type') && <TableHead className="w-[50px]">Type</TableHead>}
              {isVisible('nom') && (
                <CRMSortableHeader
                  field="nom"
                  currentSortField={sortConfig?.key}
                  currentSortDirection={sortConfig?.direction}
                  onSort={handleSort}
                  className="min-w-[200px]"
                >
                  Nom
                </CRMSortableHeader>
              )}
              {isVisible('ville') && (
                <CRMSortableHeader
                  field="ville"
                  currentSortField={sortConfig?.key}
                  currentSortDirection={sortConfig?.direction}
                  onSort={handleSort}
                  className="w-[120px]"
                >
                  Ville
                </CRMSortableHeader>
              )}
              {isVisible('region') && (
                <CRMSortableHeader
                  field="region"
                  currentSortField={sortConfig?.key}
                  currentSortDirection={sortConfig?.direction}
                  onSort={handleSort}
                  className="w-[120px]"
                >
                  Région
                </CRMSortableHeader>
              )}
              {isVisible('statut') && (
                <CRMSortableHeader
                  field="statut"
                  currentSortField={sortConfig?.key}
                  currentSortDirection={sortConfig?.direction}
                  onSort={handleSort}
                  className="w-[110px]"
                >
                  Statut
                </CRMSortableHeader>
              )}
              {isVisible('progression') && (
                <CRMSortableHeader
                  field="progression"
                  currentSortField={sortConfig?.key}
                  currentSortDirection={sortConfig?.direction}
                  onSort={handleSort}
                  className="w-[150px]"
                >
                  Progression
                </CRMSortableHeader>
              )}
              {isVisible('score_conversion') && (
                <CRMSortableHeader
                  field="score_conversion"
                  currentSortField={sortConfig?.key}
                  currentSortDirection={sortConfig?.direction}
                  onSort={handleSort}
                  className="w-[80px]"
                >
                  Score
                </CRMSortableHeader>
              )}
              {isVisible('dpi') && <TableHead className="w-[100px]">DPI</TableHead>}
              {isVisible('equipe') && <TableHead className="w-[100px]">Équipe</TableHead>}
              {isVisible('actions') && (
                <TableHead className="text-center w-[70px]">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {groupedRows
              ? groupedRows.flatMap((g) => {
                  const isCollapsed = grouping.collapsed.has(g.key)
                  const header = (
                    <TableRow
                      key={`__grp_${g.key}`}
                      className="bg-muted/40 hover:bg-muted/60 cursor-pointer"
                      onClick={() => grouping.toggleCollapsed(g.key)}
                    >
                      <TableCell colSpan={visibleColCount} className="py-2">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          {isCollapsed ? (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span>{g.key}</span>
                          <Badge variant="secondary" className="ml-1 text-xs">
                            {g.rows.length}
                          </Badge>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                  return isCollapsed
                    ? [header]
                    : [header, ...g.rows.map((etab, idx) => renderRow(etab, idx))]
                })
              : rowsToRender.map((etab, index) => renderRow(etab, index))}
          </TableBody>
        </Table>
        <TablePaginationFooter
          page={pagination.page}
          pageCount={pagination.pageCount}
          pageSize={pagination.pageSize}
          pageSizeOptions={pagination.pageSizeOptions}
          from={pagination.from}
          to={pagination.to}
          total={pagination.total}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
          disabled={!paginationActive}
        />
        <BulkActionBar
          count={selection.count}
          onClear={selection.clear}
          onExportCsv={handleBulkExport}
          statusOptions={STATUT_OPTIONS}
          onApplyStatus={handleBulkStatus}
          ownerFields={[
            { key: 'commercial_id', label: 'Commercial' },
            { key: 'chef_projet_id', label: 'Chef de projet' },
            { key: 'csm_id', label: 'CSM' },
          ]}
          ownerProfiles={(profiles ?? []).map((p) => ({
            id: p.id,
            label: `${p.prenom ?? ''} ${p.nom ?? ''}`.trim() || p.id,
          }))}
          onAssignOwner={handleBulkAssignOwner}
        />
      </CRMTableWrapper>
      <RecordSidePeek
        open={sidePeek.isOpen && !!peekEtab}
        onClose={sidePeek.close}
        title={peekEtab?.nom ?? ''}
        subtitle={
          peekEtab ? [peekEtab.ville, peekEtab.region].filter(Boolean).join(' · ') : undefined
        }
        onOpenFull={peekEtab ? () => navigate(`/etablissements/${peekEtab.id}`) : undefined}
        openFullLabel="Fiche complète"
      >
        {peekEtab && <EtablissementSidePeekContent etab={peekEtab} profiles={profiles} />}
      </RecordSidePeek>
    </div>
  )
}
