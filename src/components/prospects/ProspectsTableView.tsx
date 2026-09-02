import { Fragment, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  Filter,
  Layers,
  Mail,
  MoreVertical,
  Search,
  Table2,
  Target,
  TrendingUp,
  X,
} from 'lucide-react'
import { calculateEtablissementValue } from '@/lib/valueCalculations'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { EntityAvatar } from '@/components/ui/EntityAvatar'
import type { Etablissement } from '@/hooks/crm/useEtablissements'
import { supabase } from '@/integrations/supabase/client'
import { fetchInChunks } from '@/lib/supabaseChunk'
import { getApporteurAbbreviation } from '@/lib/apporteurAbbreviation'
import { cn } from '@/lib/utils'
import { CRMTableWrapper } from '@/components/layout/CRMTableWrapper'
import { CRMEmptyState } from '@/components/layout/CRMEmptyState'
import { useIsMobile } from '@/hooks/ui/use-mobile'
import { ProspectsMobileCard } from './ProspectsMobileCard'
import { useProspectsNextTasks, type ProspectNextTask } from '@/hooks/crm/useProspectsNextTasks'
import {
  EditableStatut,
  EditableText,
  EditableNumber,
  EditableDate,
  EditableNextStep,
} from './ProspectInlineEdit'
import { ProspectEmailComposerDialog } from './ProspectEmailComposerDialog'
import { ProspectInteractionsCell } from './ProspectInteractionsCell'

interface ProspectsTableViewProps {
  prospects: Etablissement[]
  selectedIds: Set<string>
  onSelect: (id: string) => void
  onSelectAll: (selected: boolean) => void
  getProgressInfo: (id: string) => {
    progress: number
    totalTasks: number
    completedTasks: number
    potentialValue?: number
  }
  onEdit: (prospect: Etablissement) => void
  onDelete: (id: string) => void
  onCreate?: () => void
  hasFilters?: boolean
  onResetFilters?: () => void
}

const STATUT_COLORS: Record<string, string> = {
  Prospect: 'border-slate-300 bg-slate-100 text-slate-700',
  Contacté: 'border-sky-300 bg-sky-50 text-sky-700',
  'Attente RDV': 'border-amber-300 bg-amber-50 text-amber-700',
  'RDV pris': 'border-amber-300 bg-amber-50 text-amber-700',
  'Dans les RDV': 'border-amber-300 bg-amber-50 text-amber-700',
  'Attente post RDV': 'border-amber-300 bg-amber-50 text-amber-700',
  'Etude émise': 'border-purple-300 bg-purple-50 text-purple-700',
  'Dans les RDV post EME': 'border-purple-300 bg-purple-50 text-purple-700',
  Négociation: 'border-orange-300 bg-orange-50 text-orange-700',
  Contractualisation: 'border-blue-300 bg-blue-50 text-blue-700',
  Contractuel: 'border-blue-300 bg-blue-50 text-blue-700',
  Conformité: 'border-indigo-300 bg-indigo-50 text-indigo-700',
  Déploiement: 'border-indigo-300 bg-indigo-50 text-indigo-700',
  Formation: 'border-indigo-300 bg-indigo-50 text-indigo-700',
  'Go-Live': 'border-teal-300 bg-teal-50 text-teal-700',
  Production: 'border-emerald-300 bg-emerald-50 text-emerald-700',
  Vendu: 'border-emerald-300 bg-emerald-50 text-emerald-700',
  Reporté: 'border-slate-300 bg-slate-100 text-slate-700',
  Refus: 'border-rose-300 bg-rose-50 text-rose-700',
  Bloqué: 'border-rose-300 bg-rose-50 text-rose-700',
  'Autre compte / GHT': 'border-slate-300 bg-slate-100 text-slate-700',
}

function fmtDate(v: string | null | undefined): React.ReactNode {
  if (!v) return '—'
  const d = new Date(v)
  if (isNaN(d.getTime())) return '—'
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return (
    <span className="inline-flex flex-col leading-tight">
      <span>
        {day}/{month}
      </span>
      <span>{year}</span>
    </span>
  )
}

function fmtQuarter(v: string | null | undefined): string {
  if (!v) return '—'
  const d = new Date(v)
  if (isNaN(d.getTime())) return '—'
  const q = Math.floor(d.getMonth() / 3) + 1
  return `${d.getFullYear()} T${q}`
}

function nextStepDateClass(dateStr: string | null | undefined): string | undefined {
  if (!dateStr) return undefined
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return undefined
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  if (d <= today) return 'text-destructive font-medium'
  const tenDaysLater = new Date(today)
  tenDaysLater.setDate(today.getDate() + 10)
  if (d < tenDaysLater) return 'text-warning font-medium'
  return undefined
}

function lastInteraction(p: Etablissement): string | null {
  const anyP = p as unknown as {
    derniers_echanges_updated_at?: string | null
    last_email_received_at?: string | null
    last_email_sent_at?: string | null
  }
  const candidates = [
    anyP.derniers_echanges_updated_at,
    anyP.last_email_received_at,
    anyP.last_email_sent_at,
  ].filter(Boolean) as string[]
  if (!candidates.length) return null
  return candidates.sort().slice(-1)[0]
}

function pickText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function prospectNextStepFromEtablissement(
  p: Etablissement,
  taskId?: string
): ProspectNextTask | undefined {
  const anyP = p as unknown as {
    prochaine_action_orga?: unknown
    date_action_orga?: string | null
  }
  const raw = anyP.prochaine_action_orga
  const first = Array.isArray(raw) ? raw.find(Boolean) : raw
  let title: string | null = null
  let date = pickText(anyP.date_action_orga)

  if (typeof first === 'string') {
    title = pickText(first)
  } else if (first && typeof first === 'object') {
    const item = first as Record<string, unknown>
    title = pickText(item.text) ?? pickText(item.label) ?? pickText(item.titre)
    date = date ?? pickText(item.date) ?? pickText(item.echeance)
  }

  if (!title) return undefined
  return {
    id: taskId ?? `etablissement-next-step-${p.id}`,
    etablissement_id: p.id,
    titre: title,
    echeance: date,
  }
}

export function ProspectsTableView({
  prospects,
  selectedIds,
  onSelect,
  onSelectAll,
  getProgressInfo,
  onEdit,
  onDelete,
  onCreate,
  hasFilters,
  onResetFilters,
}: ProspectsTableViewProps) {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { data: nextTasks } = useProspectsNextTasks()
  const [emailTarget, setEmailTarget] = useState<Etablissement | null>(null)

  // Apporteurs d'affaires (partenaires taggés "apporteur-affaires")
  const { data: apporteursList = [] } = useQuery({
    queryKey: ['partenaires', 'apporteurs-affaires'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partenaires')
        .select('id, nom')
        .contains('tags', ['apporteur-affaires'])
        .order('nom')
      if (error) throw error
      return (data ?? []) as { id: string; nom: string }[]
    },
    staleTime: 5 * 60 * 1000,
  })

  const apporteursById = useMemo(() => {
    const map = new Map<string, string>()
    for (const a of apporteursList) map.set(a.id, a.nom)
    return map
  }, [apporteursList])

  // Sort & filter state
  type SortKey =
    | 'nom'
    | 'dpi'
    | 'passages'
    | 'statut'
    | 'signature'
    | 'next_step'
    | 'next_step_date'
    | 'updated_at'
    | 'modules'
    | 'modele'
    | 'palier_vise'
    | 'tarif'
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' } | null>({
    key: 'next_step_date',
    dir: 'asc',
  })
  const [globalSearch, setGlobalSearch] = useState('')
  const [statutFilter, setStatutFilter] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'default' | 'commercial'>('default')
  const [groupByGht, setGroupByGht] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  // Récupère la correspondance établissement → groupe (pour la vue Groupe/GHT).
  const prospectIds = useMemo(() => prospects.map((p) => p.id), [prospects])
  const groupMapQuery = useQuery({
    queryKey: ['prospects', 'group-map', prospectIds.slice().sort().join(',')],
    enabled: groupByGht && prospectIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      // Découpage obligatoire : au-delà de ~200 ids, l'URL PostgREST dépasse
      // 8 Ko et le backend répond 414 sans en-têtes CORS (cf. `fetchInChunks`).
      const assigns = await fetchInChunks(prospectIds, (chunk) =>
        supabase
          .from('etablissements_groupes')
          .select('etablissement_id, groupe_id')
          .in('etablissement_id', chunk)
      )
      const groupIds = Array.from(new Set(assigns.map((a) => a.groupe_id)))
      let groupsData: Array<{
        id: string
        nom: string
        logo_url: string | null
        type: string | null
        region: string | null
        ville_siege: string | null
        total_passages_urgences_annuel: number | null
        progression_moyenne: number | null
        type_offre: string | null
        pallier_vise: string | number | null
        modules_deployes: string[] | null
        prochaine_action_orga: string | null
        date_action_orga: string | null
      }> = []
      groupsData = (await fetchInChunks(groupIds, (chunk) =>
        supabase
          .from('groupes_etablissements')
          .select(
            'id, nom, logo_url, type, region, ville_siege, total_passages_urgences_annuel, progression_moyenne, type_offre, pallier_vise, modules_deployes, prochaine_action_orga, date_action_orga'
          )
          .in('id', chunk)
      )) as typeof groupsData
      const assignments = new Map<string, string>()
      for (const a of assigns) assignments.set(a.etablissement_id, a.groupe_id)
      const groups = new Map<string, (typeof groupsData)[number]>()
      for (const g of groupsData) groups.set(g.id, g)
      return { assignments, groups }
    },
  })

  const toggleGroup = (gid: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(gid)) next.delete(gid)
      else next.add(gid)
      return next
    })
  }

  const accessors: Record<SortKey, (p: Etablissement) => string | number | null> = {
    nom: (p) => (p.nom ?? '').toLowerCase(),
    dpi: (p) => ((p as unknown as { dpi?: string | null }).dpi ?? '').toLowerCase(),
    passages: (p) =>
      (p as unknown as { nombre_passages_urgences_annuel?: number | null })
        .nombre_passages_urgences_annuel ?? null,
    statut: (p) => (p.statut ?? '').toLowerCase(),
    signature: (p) =>
      (p as unknown as { date_previsionnelle_signature?: string | null })
        .date_previsionnelle_signature ?? null,
    next_step: (p) =>
      (
        prospectNextStepFromEtablissement(p, nextTasks?.get(p.id)?.id)?.titre ??
        nextTasks?.get(p.id)?.titre ??
        ''
      ).toLowerCase(),
    next_step_date: (p) =>
      prospectNextStepFromEtablissement(p, nextTasks?.get(p.id)?.id)?.echeance ??
      nextTasks?.get(p.id)?.echeance ??
      null,
    updated_at: (p) => (p as unknown as { updated_at?: string | null }).updated_at ?? null,
    modules: (p) => {
      const mods = (p as unknown as { modules_proposes?: string[] | null }).modules_proposes ?? []
      return mods.length ? mods.join(', ').toLowerCase() : null
    },
    modele: (p) => {
      const c = p as unknown as { type_offre?: string | null; modele_statique_succes?: unknown }
      if (c.type_offre === 'Au succès') return 'au succès'
      if (c.modele_statique_succes) return 'statique'
      return null
    },
    palier_vise: (p) => {
      const c = p as unknown as {
        type_offre?: string | null
        pallier_vise?: string | number | null
      }
      if (c.type_offre !== 'Au succès' || c.pallier_vise == null || c.pallier_vise === '')
        return null
      const n = Number(c.pallier_vise)
      return Number.isFinite(n) ? n : String(c.pallier_vise).toLowerCase()
    },
    tarif: (p) => {
      const v = calculateEtablissementValue(
        p as unknown as Parameters<typeof calculateEtablissementValue>[0]
      )
      return v > 0 ? v : null
    },
  }

  const SORT_LABELS: Record<SortKey, string> = {
    nom: 'Établissement',
    dpi: 'DPI',
    passages: 'Passages urg./an',
    statut: 'Statut',
    signature: 'Signature prévisionnelle',
    next_step: 'Next step',
    next_step_date: 'Date prévue next step',
    updated_at: 'Dernière MàJ',
    modules: 'Modules proposés',
    modele: 'Modèle',
    palier_vise: 'Palier visé',
    tarif: 'Tarif',
  }

  const displayed = useMemo(() => {
    let list = prospects.slice()

    // Global search across textual fields
    const needle = globalSearch.trim().toLowerCase()
    if (needle) {
      list = list.filter((p) => {
        const fields: Array<string | number | null> = [
          accessors.nom(p),
          accessors.dpi(p),
          accessors.statut(p),
          accessors.next_step(p),
          (p as unknown as { ville?: string | null }).ville ?? null,
          (p as unknown as { region?: string | null }).region ?? null,
        ]
        return fields.some((f) => f != null && String(f).toLowerCase().includes(needle))
      })
    }
    if (statutFilter.size > 0) {
      list = list.filter((p) => statutFilter.has(p.statut))
    }

    // Sort
    if (sort) {
      const { key, dir } = sort
      const get = accessors[key]
      const factor = dir === 'asc' ? 1 : -1
      list.sort((a, b) => {
        const va = get(a)
        const vb = get(b)
        if (va == null && vb == null) return 0
        if (va == null) return 1 // nulls last
        if (vb == null) return -1
        if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * factor
        return String(va).localeCompare(String(vb), 'fr') * factor
      })
    }

    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prospects, globalSearch, statutFilter, sort, nextTasks])

  // Regroupe les prospects par groupe/GHT pour la vue Groupe.
  const groupChildrenMap = useMemo(() => {
    const m = new Map<string, Etablissement[]>()
    if (!groupByGht || !groupMapQuery.data?.assignments) return m
    for (const p of displayed) {
      const gid = groupMapQuery.data.assignments.get(p.id)
      if (gid) {
        if (!m.has(gid)) m.set(gid, [])
        m.get(gid)!.push(p)
      }
    }
    return m
  }, [displayed, groupByGht, groupMapQuery.data])

  if (prospects.length === 0) {
    return (
      <CRMEmptyState
        icon={Target}
        title={hasFilters ? 'Aucun prospect trouvé' : 'Aucun prospect'}
        description={
          hasFilters
            ? 'Aucun prospect ne correspond à vos critères de recherche.'
            : 'Commencez par ajouter votre premier prospect pour développer votre pipeline commercial.'
        }
        hasFilters={hasFilters}
        onResetFilters={onResetFilters}
        onCreate={onCreate}
        createLabel="Nouveau prospect"
      />
    )
  }

  // Mobile: render cards instead of table
  if (isMobile) {
    return (
      <div className="flex flex-col gap-2">
        {prospects.map((prospect) => (
          <ProspectsMobileCard
            key={prospect.id}
            prospect={prospect}
            progressInfo={getProgressInfo(prospect.id)}
            isSelected={selectedIds.has(prospect.id)}
            onSelect={onSelect}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    )
  }

  return (
    <>
      {/* Toolbar globale : tri + filtre pour tout le tableau */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            placeholder="Rechercher (établissement, DPI, next step…)"
            className="h-8 pl-7 text-sm"
          />
          {globalSearch && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
              onClick={() => setGlobalSearch('')}
              aria-label="Effacer la recherche"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn('h-8 gap-1.5', statutFilter.size > 0 && 'border-primary text-primary')}
            >
              <Filter className="h-3.5 w-3.5" />
              Statut{statutFilter.size > 0 ? ` (${statutFilter.size})` : ''}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="start">
            <div className="space-y-1 max-h-64 overflow-y-auto">
              <div className="flex items-center justify-between px-1 pb-1">
                <span className="text-xs font-medium">Filtrer par statut</span>
                {statutFilter.size > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1 text-xs"
                    onClick={() => setStatutFilter(new Set())}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
              {Object.keys(STATUT_COLORS).map((opt) => {
                const checked = statutFilter.has(opt)
                return (
                  <label
                    key={opt}
                    className="flex items-center gap-2 px-1 py-1 text-sm cursor-pointer rounded hover:bg-muted"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => {
                        const next = new Set(statutFilter)
                        if (v) next.add(opt)
                        else next.delete(opt)
                        setStatutFilter(next)
                      }}
                    />
                    <span>{opt}</span>
                  </label>
                )
              })}
            </div>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5">
              <ArrowUpDown className="h-3.5 w-3.5" />
              Tri : {SORT_LABELS[sort?.key ?? 'next_step_date'] ?? '—'}{' '}
              {sort?.dir === 'desc' ? '↓' : '↑'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Trier par</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={sort?.key ?? ''}
              onValueChange={(v) =>
                setSort((prev) => ({ key: v as SortKey, dir: prev?.key === v ? prev.dir : 'asc' }))
              }
            >
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                <DropdownMenuRadioItem key={k} value={k}>
                  {SORT_LABELS[k]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() =>
                setSort((prev) =>
                  prev ? { ...prev, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : null
                )
              }
            >
              Inverser l'ordre ({sort?.dir === 'desc' ? 'décroissant' : 'croissant'})
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {(globalSearch || statutFilter.size > 0) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={() => {
              setGlobalSearch('')
              setStatutFilter(new Set())
            }}
          >
            Réinitialiser
          </Button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant={groupByGht ? 'default' : 'outline'}
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => setGroupByGht((v) => !v)}
            title="Regrouper par Groupe / GHT"
          >
            <Layers className="h-3.5 w-3.5" />
            {groupByGht ? 'Vue Groupe/GHT active' : 'Vue Groupe/GHT'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => setViewMode((v) => (v === 'default' ? 'commercial' : 'default'))}
            title="Basculer la vue"
          >
            {viewMode === 'default' ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : (
              <Table2 className="h-3.5 w-3.5" />
            )}
            {viewMode === 'default' ? 'Vue commerciale' : 'Vue standard'}
          </Button>
        </div>
      </div>

      <CRMTableWrapper minWidth="1180px" withCard={false}>
        <Table className="w-full table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={
                    selectedIds.size === prospects.length
                      ? true
                      : selectedIds.size > 0
                        ? 'indeterminate'
                        : false
                  }
                  onCheckedChange={(checked) => onSelectAll(checked === true)}
                  aria-label="Sélectionner tous les prospects"
                />
              </TableHead>
              <TableHead className="w-[18%] text-sm leading-tight align-middle">
                Établissement
              </TableHead>
              <TableHead className="w-[70px] min-w-[70px] text-sm leading-tight align-middle">
                DPI
              </TableHead>
              <TableHead className="w-[70px] min-w-[70px] text-right text-sm leading-tight align-middle">
                Passages urg./an
              </TableHead>
              <TableHead className="w-[95px] min-w-[95px] text-sm leading-tight align-middle">
                Statut
              </TableHead>
              <TableHead className="w-[55px] min-w-[55px] leading-tight text-sm px-1 text-center">
                AA
              </TableHead>
              <TableHead className="w-[100px] min-w-[100px] text-sm leading-tight align-middle">
                Signature prévisionnelle
              </TableHead>
              {viewMode === 'default' ? (
                <>
                  <TableHead className="w-[70px] min-w-[70px] leading-tight text-sm">
                    Historique
                  </TableHead>
                  <TableHead className="w-[28%] text-sm leading-tight align-middle">
                    Next step
                  </TableHead>
                  <TableHead className="w-[65px] min-w-[65px] text-sm leading-tight align-middle">
                    Date prévue next step
                  </TableHead>
                  <TableHead className="w-[65px] min-w-[65px] text-sm leading-tight align-middle">
                    Dernière MàJ
                  </TableHead>
                </>
              ) : (
                <>
                  <TableHead className="w-[160px] min-w-[160px] text-sm leading-tight align-middle">
                    Modules proposés
                  </TableHead>
                  <TableHead className="w-[100px] min-w-[100px] text-sm leading-tight align-middle">
                    Modèle
                  </TableHead>
                  <TableHead className="w-[90px] min-w-[90px] text-sm leading-tight align-middle">
                    Palier visé
                  </TableHead>
                  <TableHead className="w-[110px] min-w-[110px] text-right text-sm leading-tight align-middle">
                    Tarif
                  </TableHead>
                </>
              )}
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {(() => {
              const renderedGroups = new Set<string>()
              return displayed.map((prospect, index) => {
                const isSelected = selectedIds.has(prospect.id)
                const anyP = prospect as unknown as {
                  dpi?: string | null
                  nombre_passages_urgences_annuel?: number | null
                  date_previsionnelle_signature?: string | null
                  updated_at?: string | null
                  logo_url?: string | null
                  groupe_logo_url?: string | null
                  derniers_echanges_resume?: string | null
                  derniers_echanges_updated_at?: string | null
                }
                const nt: ProspectNextTask | undefined = prospectNextStepFromEtablissement(prospect)
                const inter = lastInteraction(prospect)

                // --- Vue Groupe/GHT : détection du parent groupe et de son état d'expansion.
                const gid = groupByGht
                  ? groupMapQuery.data?.assignments.get(prospect.id)
                  : undefined
                const groupInfo = gid ? groupMapQuery.data?.groups.get(gid) : undefined
                const groupChildren = gid ? (groupChildrenMap.get(gid) ?? []) : []
                const isFirstOfGroup = !!gid && !renderedGroups.has(gid)
                if (gid) renderedGroups.add(gid)
                const groupExpanded = gid ? expandedGroups.has(gid) : true

                // Ligne enfant masquée si groupe replié
                if (gid && !isFirstOfGroup && !groupExpanded) return null

                const groupHeader =
                  isFirstOfGroup && groupInfo ? (
                    <TableRow
                      key={`grp-${gid}`}
                      className="bg-primary/5 hover:bg-primary/10 border-l-4 border-l-primary cursor-pointer"
                      onClick={() => toggleGroup(gid!)}
                      aria-expanded={groupExpanded}
                    >
                      <TableCell className="w-10" />
                      <TableCell className="align-middle">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleGroup(gid!)
                            }}
                            className="p-0.5 rounded hover:bg-primary/10 text-primary shrink-0"
                            aria-label={groupExpanded ? 'Replier le groupe' : 'Déplier le groupe'}
                          >
                            {groupExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                          <EntityAvatar
                            name={groupInfo.nom}
                            logoUrl={groupInfo.logo_url || undefined}
                            size="sm"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-sm leading-tight text-primary flex items-center gap-1.5">
                              <span className="truncate" title={groupInfo.nom}>
                                {groupInfo.nom}
                              </span>
                              {groupInfo.type && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1 py-0 h-4 font-medium border-primary/40 text-primary"
                                >
                                  {groupInfo.type}
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {[groupInfo.ville_siege, groupInfo.region]
                                .filter(Boolean)
                                .join(' • ') || '—'}{' '}
                              · {groupChildren.length} établissement
                              {groupChildren.length > 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      {/* DPI : majoritaire ou — */}
                      <TableCell className="text-sm">
                        {(() => {
                          const counts = new Map<string, number>()
                          for (const c of groupChildren) {
                            const d = (c as unknown as { dpi?: string | null }).dpi
                            if (d) counts.set(d, (counts.get(d) ?? 0) + 1)
                          }
                          if (counts.size === 0)
                            return <span className="text-muted-foreground">—</span>
                          if (counts.size === 1) {
                            const only = counts.keys().next().value as string
                            return (
                              <span className="inline-block px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-sm font-medium">
                                {only}
                              </span>
                            )
                          }
                          return (
                            <Badge variant="outline" className="text-xs font-normal">
                              {counts.size} DPI
                            </Badge>
                          )
                        })()}
                      </TableCell>
                      {/* Passages : somme */}
                      <TableCell className="text-right tabular-nums text-sm font-semibold">
                        {(() => {
                          const sum = groupChildren.reduce(
                            (acc, c) =>
                              acc +
                              ((c as unknown as { nombre_passages_urgences_annuel?: number | null })
                                .nombre_passages_urgences_annuel ?? 0),
                            0
                          )
                          const groupTotal = groupInfo.total_passages_urgences_annuel ?? 0
                          const total = sum || groupTotal
                          return total > 0 ? (
                            total.toLocaleString('fr-FR')
                          ) : (
                            <span className="text-muted-foreground font-normal">—</span>
                          )
                        })()}
                      </TableCell>
                      {/* Statut : unique ou "Mixte" */}
                      <TableCell className="text-sm">
                        {(() => {
                          const set = new Set(groupChildren.map((c) => c.statut).filter(Boolean))
                          if (set.size === 0)
                            return <span className="text-muted-foreground">—</span>
                          if (set.size === 1) {
                            const only = Array.from(set)[0] as string
                            return (
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-xs font-normal border px-1.5 py-0.5',
                                  STATUT_COLORS[only] ??
                                    'border-slate-300 bg-slate-100 text-slate-700'
                                )}
                              >
                                {only}
                              </Badge>
                            )
                          }
                          return (
                            <Badge variant="outline" className="text-xs font-normal">
                              Mixte ({set.size})
                            </Badge>
                          )
                        })()}
                      </TableCell>
                      {/* AA : union */}
                      <TableCell className="px-1 text-center">
                        {(() => {
                          const ids = new Set<string>()
                          for (const c of groupChildren) {
                            const arr =
                              (c as unknown as { apporteurs_affaires_ids?: string[] })
                                .apporteurs_affaires_ids ?? []
                            for (const id of arr) ids.add(id)
                          }
                          if (ids.size === 0) return null
                          return (
                            <div className="flex flex-wrap gap-1 justify-center">
                              {Array.from(ids).map((id) => {
                                const nom = apporteursById.get(id)
                                if (!nom) return null
                                return (
                                  <Badge
                                    key={id}
                                    variant="outline"
                                    className="text-xs font-medium px-1 py-0 h-5"
                                    title={nom}
                                  >
                                    {getApporteurAbbreviation(nom)}
                                  </Badge>
                                )
                              })}
                            </div>
                          )
                        })()}
                      </TableCell>
                      {/* Signature : la plus proche */}
                      <TableCell className="text-sm whitespace-nowrap">
                        {(() => {
                          const dates = groupChildren
                            .map(
                              (c) =>
                                (c as unknown as { date_previsionnelle_signature?: string | null })
                                  .date_previsionnelle_signature
                            )
                            .filter(Boolean) as string[]
                          if (dates.length === 0)
                            return <span className="text-muted-foreground">—</span>
                          const min = dates.sort()[0]
                          return <span>{fmtQuarter(min)}</span>
                        })()}
                      </TableCell>
                      {viewMode === 'default' ? (
                        <>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <ProspectInteractionsCell
                              groupeId={gid!}
                              etablissementNom={groupInfo.nom}
                            />
                          </TableCell>
                          <TableCell
                            className="text-sm align-top"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <EditableNextStep
                              groupeId={gid!}
                              title={groupInfo.prochaine_action_orga ?? undefined}
                              echeance={groupInfo.date_action_orga ?? null}
                              multiline
                              display={
                                groupInfo.prochaine_action_orga ? (
                                  <span className="leading-tight break-words whitespace-normal font-medium text-primary">
                                    {groupInfo.prochaine_action_orga}
                                  </span>
                                ) : (
                                  <span className="text-primary/70 italic">+ Ajouter (groupe)</span>
                                )
                              }
                            />
                          </TableCell>
                          <TableCell className="text-xs whitespace-normal break-words text-right">
                            {groupInfo.date_action_orga ? (
                              <span className={cn(nextStepDateClass(groupInfo.date_action_orga))}>
                                {fmtDate(groupInfo.date_action_orga)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground italic">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="text-muted-foreground text-xs">—</span>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          {/* Modules : union */}
                          <TableCell className="text-sm">
                            {(() => {
                              const set = new Set<string>()
                              for (const c of groupChildren) {
                                const mods =
                                  (c as unknown as { modules_proposes?: string[] | null })
                                    .modules_proposes ?? []
                                for (const m of mods) set.add(m)
                              }
                              if (set.size === 0)
                                return <span className="text-muted-foreground">—</span>
                              return (
                                <div className="flex flex-wrap gap-1">
                                  {Array.from(set).map((m) => (
                                    <Badge
                                      key={m}
                                      variant="outline"
                                      className="text-xs font-normal px-1.5 py-0 h-5"
                                    >
                                      {m}
                                    </Badge>
                                  ))}
                                </div>
                              )
                            })()}
                          </TableCell>
                          {/* Modèle : unique ou Mixte */}
                          <TableCell className="text-sm">
                            {(() => {
                              const set = new Set<string>()
                              for (const c of groupChildren) {
                                const cp = c as unknown as {
                                  type_offre?: string | null
                                  modele_statique_succes?: unknown
                                }
                                if (cp.type_offre === 'Au succès') set.add('Au succès')
                                else if (cp.modele_statique_succes) set.add('Statique')
                              }
                              if (set.size === 0)
                                return (
                                  <span className="text-muted-foreground italic">Non défini</span>
                                )
                              if (set.size === 1)
                                return (
                                  <Badge
                                    variant="outline"
                                    className="text-xs font-normal px-1.5 py-0 h-5"
                                  >
                                    {Array.from(set)[0]}
                                  </Badge>
                                )
                              return (
                                <Badge variant="outline" className="text-xs font-normal">
                                  Mixte
                                </Badge>
                              )
                            })()}
                          </TableCell>
                          {/* Palier visé */}
                          <TableCell className="text-sm">
                            {(() => {
                              const set = new Set<string>()
                              for (const c of groupChildren) {
                                const cp = c as unknown as {
                                  type_offre?: string | null
                                  pallier_vise?: string | number | null
                                }
                                if (
                                  cp.type_offre === 'Au succès' &&
                                  cp.pallier_vise != null &&
                                  cp.pallier_vise !== ''
                                )
                                  set.add(String(cp.pallier_vise))
                              }
                              if (set.size === 0)
                                return <span className="text-muted-foreground">—</span>
                              if (set.size === 1) return <span>{Array.from(set)[0]}</span>
                              return <span className="text-xs">Mixte</span>
                            })()}
                          </TableCell>
                          {/* Tarif : somme */}
                          <TableCell className="text-sm text-right tabular-nums font-semibold">
                            {(() => {
                              const sum = groupChildren.reduce(
                                (acc, c) =>
                                  acc +
                                  calculateEtablissementValue(
                                    c as unknown as Parameters<
                                      typeof calculateEtablissementValue
                                    >[0]
                                  ),
                                0
                              )
                              return sum > 0 ? (
                                new Intl.NumberFormat('fr-FR', {
                                  style: 'currency',
                                  currency: 'EUR',
                                  maximumFractionDigits: 0,
                                }).format(sum)
                              ) : (
                                <span className="text-muted-foreground font-normal">—</span>
                              )
                            })()}
                          </TableCell>
                        </>
                      )}
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-primary hover:bg-primary/10"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/groupes/${gid}`)
                          }}
                          title="Ouvrir la fiche du groupe (suivi, activité, contacts…)"
                        >
                          Ouvrir la fiche
                        </Button>
                      </TableCell>
                    </TableRow>
                  ) : null

                const rowNode =
                  !gid || groupExpanded ? (
                    <ContextMenu key={prospect.id}>
                      <ContextMenuTrigger asChild>
                        <TableRow
                          key={prospect.id}
                          className={cn(
                            'cursor-pointer transition-colors group',
                            'hover:bg-muted/50',
                            isSelected && 'bg-muted',
                            'animate-in fade-in-50',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                          )}
                          style={{ animationDelay: `${index * 15}ms` }}
                          onClick={() => navigate(`/etablissements/${prospect.id}`)}
                          role="link"
                          tabIndex={0}
                          aria-label={`Ouvrir la fiche établissement ${prospect.nom}`}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              navigate(`/etablissements/${prospect.id}`)
                            }
                          }}
                        >
                          <TableCell
                            className="w-10"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => onSelect(prospect.id)}
                              aria-label={`Sélectionner ${prospect.nom}`}
                            />
                          </TableCell>
                          <TableCell className={cn(gid && 'relative')}>
                            <div className={cn('flex items-center gap-2', gid && 'pl-6 relative')}>
                              {gid && (
                                <span
                                  aria-hidden="true"
                                  className="absolute left-2 top-0 bottom-0 border-l-2 border-primary/25"
                                />
                              )}
                              {gid && (
                                <span
                                  aria-hidden="true"
                                  className="absolute left-2 top-1/2 w-3 border-t-2 border-primary/25"
                                />
                              )}
                              <EntityAvatar
                                name={prospect.nom}
                                logoUrl={anyP.logo_url || anyP.groupe_logo_url || undefined}
                                size="sm"
                              />
                              <div className="min-w-0 flex-1">
                                <div
                                  className="font-medium text-sm leading-tight group-hover:text-primary transition-colors line-clamp-2 break-words"
                                  title={prospect.nom}
                                >
                                  {prospect.nom}
                                </div>
                                <div className="text-xs text-muted-foreground truncate">
                                  {[prospect.ville, prospect.region].filter(Boolean).join(' • ') ||
                                    '—'}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell
                            className="text-sm text-left px-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <EditableText
                              prospectId={prospect.id}
                              column="dpi"
                              label="DPI"
                              value={anyP.dpi ?? null}
                              placeholder="Ex : Hopital Manager"
                              display={
                                anyP.dpi ? (
                                  <span
                                    className="inline-block px-1.5 py-0.5 rounded-md bg-muted text-foreground/80 text-sm font-medium whitespace-normal break-words leading-tight line-clamp-2"
                                    title={anyP.dpi}
                                  >
                                    {anyP.dpi}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )
                              }
                            />
                          </TableCell>
                          <TableCell
                            className="text-right tabular-nums text-sm"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <EditableNumber
                              prospectId={prospect.id}
                              column="nombre_passages_urgences_annuel"
                              label="Passages urgences / an"
                              value={
                                anyP.nombre_passages_urgences_annuel != null
                                  ? String(anyP.nombre_passages_urgences_annuel)
                                  : null
                              }
                              display={
                                anyP.nombre_passages_urgences_annuel != null ? (
                                  anyP.nombre_passages_urgences_annuel.toLocaleString('fr-FR')
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )
                              }
                            />
                          </TableCell>
                          <TableCell
                            className="text-left px-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <EditableStatut
                              prospectId={prospect.id}
                              value={prospect.statut}
                              display={
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'text-sm font-normal border px-1.5 py-0.5 whitespace-normal break-words leading-tight line-clamp-2 h-auto',
                                    STATUT_COLORS[prospect.statut] ??
                                      'border-slate-300 bg-slate-100 text-slate-700'
                                  )}
                                  title={prospect.statut}
                                >
                                  {prospect.statut}
                                </Badge>
                              }
                            />
                          </TableCell>
                          <TableCell
                            className="px-1 text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex flex-wrap gap-1 justify-center">
                              {(
                                (prospect as unknown as { apporteurs_affaires_ids?: string[] })
                                  .apporteurs_affaires_ids ?? []
                              ).map((id) => {
                                const nom = apporteursById.get(id)
                                if (!nom) return null
                                const abbr = getApporteurAbbreviation(nom)
                                return (
                                  <Badge
                                    key={id}
                                    variant="outline"
                                    className="text-xs font-medium px-1 py-0 h-5 min-w-0"
                                    title={nom}
                                  >
                                    {abbr}
                                  </Badge>
                                )
                              })}
                            </div>
                          </TableCell>
                          <TableCell
                            className="text-sm whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <EditableDate
                              prospectId={prospect.id}
                              column="date_previsionnelle_signature"
                              label="Signature prévisionnelle"
                              value={anyP.date_previsionnelle_signature ?? null}
                              display={fmtQuarter(anyP.date_previsionnelle_signature)}
                            />
                          </TableCell>
                          {viewMode === 'default' ? (
                            <>
                              <TableCell className="">
                                <ProspectInteractionsCell
                                  etablissementId={prospect.id}
                                  etablissementNom={prospect.nom}
                                />
                              </TableCell>
                              <TableCell
                                className="text-sm align-top"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <EditableNextStep
                                  prospectId={prospect.id}
                                  title={nt?.titre}
                                  echeance={nt?.echeance}
                                  multiline
                                  display={
                                    nt?.titre ? (
                                      <span className="leading-tight break-words whitespace-normal">
                                        {nt.titre}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground italic">
                                        + Ajouter
                                      </span>
                                    )
                                  }
                                />
                              </TableCell>
                              <TableCell className="text-xs whitespace-normal break-words text-right">
                                {nt ? (
                                  <span className={cn(nextStepDateClass(nt.echeance))}>
                                    {fmtDate(nt.echeance ?? null)}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground italic">—</span>
                                )}
                              </TableCell>

                              <TableCell className="text-xs whitespace-normal break-words text-muted-foreground">
                                {fmtDate(anyP.updated_at)}
                              </TableCell>
                            </>
                          ) : (
                            (() => {
                              const commP = prospect as unknown as {
                                modules_proposes?: string[] | null
                                type_offre?: string | null
                                pallier_vise?: string | number | null
                                tarifs_palliers?: Record<string, unknown> | null
                                modele_statique_succes?: string | number | null
                                nombre_passages_urgences_annuel?: number | null
                              }
                              const modules = commP.modules_proposes ?? []
                              const typeOffre = commP.type_offre
                              const modeleLabel =
                                typeOffre === 'Au succès'
                                  ? 'Au succès'
                                  : commP.modele_statique_succes
                                    ? 'Statique'
                                    : 'Non défini'
                              const palierVise =
                                typeOffre === 'Au succès' && commP.pallier_vise
                                  ? String(commP.pallier_vise)
                                  : '—'
                              const tarifValue = calculateEtablissementValue(commP)
                              const tarifLabel =
                                tarifValue > 0
                                  ? new Intl.NumberFormat('fr-FR', {
                                      style: 'currency',
                                      currency: 'EUR',
                                      maximumFractionDigits: 0,
                                    }).format(tarifValue)
                                  : '—'
                              return (
                                <>
                                  <TableCell className="text-sm">
                                    <div className="flex flex-wrap gap-1">
                                      {modules.length > 0 ? (
                                        modules.map((m) => (
                                          <Badge
                                            key={m}
                                            variant="outline"
                                            className="text-xs font-normal px-1.5 py-0 h-5"
                                          >
                                            {m}
                                          </Badge>
                                        ))
                                      ) : (
                                        <span className="text-muted-foreground">—</span>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-sm">
                                    {modeleLabel === 'Non défini' ? (
                                      <span className="text-muted-foreground italic">
                                        Non défini
                                      </span>
                                    ) : (
                                      <Badge
                                        variant="outline"
                                        className="text-xs font-normal px-1.5 py-0 h-5"
                                      >
                                        {modeleLabel}
                                      </Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-sm">
                                    {palierVise === '—' ? (
                                      <span className="text-muted-foreground">—</span>
                                    ) : (
                                      <span>{palierVise}</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-sm text-right tabular-nums">
                                    {tarifLabel === '—' ? (
                                      <span className="text-muted-foreground">—</span>
                                    ) : (
                                      <span className="font-medium">{tarifLabel}</span>
                                    )}
                                  </TableCell>
                                </>
                              )
                            })()
                          )}
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 opacity-60 hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                                  aria-label={`Actions pour ${prospect.nom}`}
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => navigate(`/etablissements/${prospect.id}`)}
                                >
                                  Voir la fiche
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    navigate(`/etablissements/${prospect.id}?tab=taches`)
                                  }
                                >
                                  Voir les tâches
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onEdit(prospect)}>
                                  Modifier
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => onDelete(prospect.id)}
                                  className="text-destructive"
                                >
                                  Supprimer
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-56">
                        <ContextMenuItem onSelect={() => setEmailTarget(prospect)}>
                          <Mail className="h-4 w-4 mr-2" />
                          Envoyer un email…
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          onSelect={() => navigate(`/etablissements/${prospect.id}`)}
                        >
                          Voir la fiche
                        </ContextMenuItem>
                        <ContextMenuItem
                          onSelect={() => navigate(`/etablissements/${prospect.id}?tab=taches`)}
                        >
                          Voir les tâches
                        </ContextMenuItem>
                        <ContextMenuItem onSelect={() => onEdit(prospect)}>
                          Modifier
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          onSelect={() => onDelete(prospect.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          Supprimer
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  ) : null

                return (
                  <Fragment key={prospect.id}>
                    {groupHeader}
                    {rowNode}
                  </Fragment>
                )
              })
            })()}
          </TableBody>
        </Table>
      </CRMTableWrapper>

      {emailTarget && (
        <ProspectEmailComposerDialog
          open={!!emailTarget}
          onOpenChange={(o) => {
            if (!o) setEmailTarget(null)
          }}
          etablissementId={emailTarget.id}
          etablissementName={emailTarget.nom}
          fallbackEmail={(emailTarget as unknown as { email?: string | null }).email ?? null}
        />
      )}
    </>
  )
}
