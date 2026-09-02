import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
// Helmet non dispo — SEO géré ailleurs
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
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { toast } from 'sonner'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Sparkles,
  Send,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  CalendarDays,
  TrendingUp,
  Wallet,
  Target,
} from 'lucide-react'
import { PageDataState } from '@/components/common/PageDataState'
import {
  useActivityTypes,
  useWeekImputations,
  useWeeklySubmission,
  useUpsertImputation,
  useDeleteImputation,
  useSubmitWeek,
  useSuggestImputations,
  useSuggestWeekImputations,
  usePendingWeeklySubmissions,
  useApproveWeek,
  useRentabiliteEtablissement,
  useRentabiliteProjetRd,
  isoWeek,
  weekDates,
  toDateStr,
  type TimeImputation,
} from '@/hooks/time/useTimeTracking'
import { supabase } from '@/integrations/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { useUserRole } from '@/hooks/shared/useUserRole'

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

function useEtablissementsLite() {
  return useQuery({
    queryKey: ['etablissements_lite_time'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('etablissements')
        .select('id, nom')
        .order('nom')
        .limit(500)
      if (error) throw error
      return data ?? []
    },
    staleTime: 5 * 60 * 1000,
  })
}
function useProjetsRdLite() {
  return useQuery({
    queryKey: ['rd_projets_lite_time'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rd_projets')
        .select('id, nom')
        .order('nom')
        .limit(100)
      if (error) throw error
      return data ?? []
    },
    staleTime: 5 * 60 * 1000,
  })
}

export default function TempsTracking() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') ?? 'saisie'
  const { role } = useUserRole()
  const isAdmin = ['admin', 'direction', 'manager'].includes(role ?? '')

  return (
    <div className="temps-scope min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto py-8 space-y-6 max-w-[1400px]">
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-3">
              <CalendarDays className="h-3.5 w-3.5" />
              Suivi du temps
            </div>
            <h1 className="text-4xl font-semibold tracking-tight text-foreground">
              Ma semaine de travail
            </h1>
            <p className="text-muted-foreground mt-1.5 max-w-2xl">
              Saisis, laisse Jarvis compléter, soumets pour validation — le tout en quelques
              secondes.
            </p>
          </div>
        </header>

        <Tabs value={tab} onValueChange={(v) => setParams({ tab: v })}>
          <TabsList className="segment h-auto">
            <TabsTrigger
              value="saisie"
              className="rounded-lg px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              Ma semaine
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger
                value="validation"
                className="rounded-lg px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                Validation
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger
                value="rentabilite"
                className="rounded-lg px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                Rentabilité
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="saisie" className="mt-6">
            <SaisieSemaine />
          </TabsContent>
          {isAdmin && (
            <TabsContent value="validation" className="mt-6">
              <ValidationSemaines />
            </TabsContent>
          )}
          {isAdmin && (
            <TabsContent value="rentabilite" className="mt-6">
              <Rentabilite />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  )
}

// ============================================================
// Saisie semaine
// ============================================================
function SaisieSemaine() {
  const [weekIso, setWeekIso] = useState(() => isoWeek(new Date()))
  const days = useMemo(() => weekDates(weekIso), [weekIso])
  const impsQ = useWeekImputations(weekIso)
  const subQ = useWeeklySubmission(weekIso)
  const typesQ = useActivityTypes()
  const etabsQ = useEtablissementsLite()
  const projetsQ = useProjetsRdLite()
  const submit = useSubmitWeek()
  const suggest = useSuggestImputations()
  const suggestWeek = useSuggestWeekImputations()
  const upsert = useUpsertImputation()
  const del = useDeleteImputation()

  const [editing, setEditing] = useState<Partial<TimeImputation> | null>(null)

  const submissionStatus = subQ.data?.status ?? 'draft'
  const readOnly = ['submitted', 'approved'].includes(submissionStatus)

  const totalMin = (impsQ.data ?? []).reduce((s, i) => s + i.duration_minutes, 0)
  const billableMin = (impsQ.data ?? [])
    .filter((i) => i.is_billable)
    .reduce((s, i) => s + i.duration_minutes, 0)

  const goPrev = () => {
    const d = weekDates(weekIso)[0]
    d.setUTCDate(d.getUTCDate() - 7)
    setWeekIso(isoWeek(d))
  }
  const goNext = () => {
    const d = weekDates(weekIso)[0]
    d.setUTCDate(d.getUTCDate() + 7)
    setWeekIso(isoWeek(d))
  }

  const handleSuggest = async (dateStr: string) => {
    try {
      const res = await suggest.mutateAsync(dateStr)
      if (res.error) throw new Error(res.error)
      if (res.reason) {
        toast.info(res.reason)
        return
      }
      if (!res.suggestions?.length) {
        toast.info('Aucune suggestion pour ce jour.')
        return
      }
      for (const s of res.suggestions) {
        const type = typesQ.data?.find((t) => t.code === s.activity_type_code)
        await upsert.mutateAsync({
          date_imputation: s.date || dateStr,
          duration_minutes: s.duration_minutes,
          activity_type_id: type?.id ?? null,
          etablissement_id: s.etablissement_id,
          projet_rd_id: s.projet_rd_id,
          is_billable: type?.is_billable_default ?? false,
          note: s.note ?? null,
        })
      }
      toast.success(`${res.suggestions.length} imputation(s) suggérée(s)`)
    } catch (e) {
      toast.error('Erreur IA : ' + (e as Error).message)
    }
  }

  const handleSuggestWeek = async () => {
    try {
      const weekStart = toDateStr(days[0])
      const res = await suggestWeek.mutateAsync(weekStart)
      if (res.error) throw new Error(res.error)
      if (res.reason) {
        toast.info(res.reason)
        return
      }
      if (!res.suggestions?.length) {
        toast.info('Aucune suggestion pour cette semaine.')
        return
      }
      for (const s of res.suggestions) {
        const type = typesQ.data?.find((t) => t.code === s.activity_type_code)
        await upsert.mutateAsync({
          date_imputation: s.date,
          duration_minutes: s.duration_minutes,
          activity_type_id: type?.id ?? null,
          etablissement_id: s.etablissement_id,
          projet_rd_id: s.projet_rd_id,
          is_billable: type?.is_billable_default ?? false,
          note: s.note ?? null,
        })
      }
      toast.success(`${res.suggestions.length} imputation(s) suggérée(s) sur la semaine`)
    } catch (e) {
      toast.error('Erreur IA : ' + (e as Error).message)
    }
  }

  const handleSubmit = async () => {
    try {
      await submit.mutateAsync({ week_iso: weekIso })
      toast.success('Semaine soumise pour validation')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const WEEKLY_TARGET_MIN = 35 * 60 // 35h contractuelles indicatives
  const targetPct = Math.min(100, Math.round((totalMin / WEEKLY_TARGET_MIN) * 100))
  const billableRate = totalMin > 0 ? Math.round((billableMin / totalMin) * 100) : 0

  // Range de la semaine pour l'affichage
  const firstDay = days[0]
  const lastDay = days[6]
  const rangeLabel = `${String(firstDay.getUTCDate()).padStart(2, '0')}/${String(firstDay.getUTCMonth() + 1).padStart(2, '0')} → ${String(lastDay.getUTCDate()).padStart(2, '0')}/${String(lastDay.getUTCMonth() + 1).padStart(2, '0')}`

  const todayStr = toDateStr(new Date())

  return (
    <PageDataState
      isLoading={impsQ.isLoading || typesQ.isLoading}
      isError={!!impsQ.error}
      error={impsQ.error as Error | null}
    >
      <div className="space-y-6">
        {/* Barre semaine + statut */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <div className="segment inline-flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={goPrev}
                aria-label="Semaine précédente"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="px-3 min-w-[180px] text-center">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">
                  Semaine {weekIso.slice(-2)}
                </div>
                <div className="text-sm font-semibold text-foreground font-display">
                  {rangeLabel}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={goNext}
                aria-label="Semaine suivante"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <StatusBadge status={submissionStatus} />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleSuggestWeek}
              disabled={readOnly || suggestWeek.isPending}
              title="Suggérer l'ensemble de la semaine avec Jarvis"
              className="rounded-lg"
            >
              <Sparkles className="h-4 w-4 mr-2 text-primary" />
              {suggestWeek.isPending ? 'Analyse…' : 'Suggérer la semaine'}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={readOnly || totalMin === 0 || submit.isPending}
              className="rounded-lg shadow-sm"
            >
              <Send className="h-4 w-4 mr-2" />
              Soumettre pour validation
            </Button>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="kpi-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Total saisi
              </span>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="day-total-lg text-3xl text-foreground">
              {(totalMin / 60).toFixed(1)}
              <span className="text-lg text-muted-foreground ml-1">h</span>
            </div>
            <div className="progress-track mt-3">
              <div className="progress-bar" style={{ width: `${targetPct}%` }} />
            </div>
            <div className="text-[11px] text-muted-foreground mt-1.5">
              {targetPct}% de l'objectif hebdo (35h)
            </div>
          </div>
          <div className="kpi-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Facturable
              </span>
              <Wallet className="h-4 w-4 text-primary" />
            </div>
            <div className="day-total-lg text-3xl text-foreground">
              {(billableMin / 60).toFixed(1)}
              <span className="text-lg text-muted-foreground ml-1">h</span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-3">
              Taux facturable · <span className="text-primary font-semibold">{billableRate}%</span>
            </div>
          </div>
          <div className="kpi-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Imputations
              </span>
              <Target className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="day-total-lg text-3xl text-foreground">{(impsQ.data ?? []).length}</div>
            <div className="text-[11px] text-muted-foreground mt-3">saisies sur la semaine</div>
          </div>
          <div className="kpi-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Moyenne / jour
              </span>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="day-total-lg text-3xl text-foreground">
              {(totalMin / 60 / 7).toFixed(1)}
              <span className="text-lg text-muted-foreground ml-1">h</span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-3">réparties sur 7 jours</div>
          </div>
        </div>

        {subQ.data?.status === 'rejected' && subQ.data.rejection_reason && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
            <span className="font-semibold text-destructive">Semaine rejetée · </span>
            <span className="text-foreground">{subQ.data.rejection_reason}</span>
          </div>
        )}

        {/* Grille jours */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
          {days.map((d, i) => {
            const dateStr = toDateStr(d)
            const dayImps = (impsQ.data ?? []).filter((im) => im.date_imputation === dateStr)
            const dayTotal = dayImps.reduce((s, x) => s + x.duration_minutes, 0)
            const isToday = dateStr === todayStr
            const isWeekend = i >= 5
            const dayPct = Math.min(100, Math.round((dayTotal / (7 * 60)) * 100))
            return (
              <div
                key={dateStr}
                className={`day-card p-3 flex flex-col min-h-[240px] ${isToday ? 'is-today' : ''}`}
              >
                <div className="flex items-baseline justify-between mb-2">
                  <div>
                    <div
                      className={`text-[11px] uppercase tracking-wider font-semibold ${isWeekend ? 'text-muted-foreground/60' : 'text-muted-foreground'}`}
                    >
                      {DAY_LABELS[i]}
                    </div>
                    <div
                      className={`font-display text-xl leading-tight ${isToday ? 'text-primary' : 'text-foreground'}`}
                    >
                      {String(d.getUTCDate()).padStart(2, '0')}
                      <span className="text-xs text-muted-foreground font-sans ml-1">
                        /{String(d.getUTCMonth() + 1).padStart(2, '0')}
                      </span>
                    </div>
                  </div>
                  <div
                    className={`day-total-lg text-sm ${dayTotal > 0 ? 'text-foreground' : 'text-muted-foreground/60'}`}
                  >
                    {(dayTotal / 60).toFixed(1)}h
                  </div>
                </div>

                {dayTotal > 0 && (
                  <div className="progress-track mb-2.5">
                    <div className="progress-bar" style={{ width: `${dayPct}%` }} />
                  </div>
                )}

                <div className="space-y-1.5 flex-1">
                  {dayImps.length === 0 && !readOnly && (
                    <div className="text-[11px] text-muted-foreground/70 italic py-2 text-center">
                      Aucune saisie
                    </div>
                  )}
                  {dayImps.map((im) => {
                    const type = typesQ.data?.find((t) => t.id === im.activity_type_id)
                    return (
                      <button
                        key={im.id}
                        disabled={readOnly}
                        onClick={() => setEditing(im)}
                        className="imp-chip w-full text-left p-2 text-xs disabled:opacity-70 disabled:cursor-not-allowed"
                        style={
                          type?.color
                            ? { borderLeftWidth: 3, borderLeftColor: type.color }
                            : undefined
                        }
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-semibold truncate text-foreground">
                            {type?.label ?? '—'}
                          </span>
                          <span className="text-muted-foreground shrink-0 font-medium">
                            {(im.duration_minutes / 60).toFixed(1)}h
                          </span>
                        </div>
                        {im.note && (
                          <div className="text-muted-foreground truncate mt-0.5">{im.note}</div>
                        )}
                        {im.is_billable && (
                          <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-medium">
                            <Wallet className="h-2.5 w-2.5" />
                            Facturable
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>

                {!readOnly && (
                  <div className="flex gap-1 mt-2 pt-2 border-t border-border/60">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-1 h-8 rounded-lg hover:bg-primary/10 hover:text-primary text-xs"
                      onClick={() => setEditing({ date_imputation: dateStr, duration_minutes: 60 })}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Ajouter
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 rounded-lg hover:bg-primary/10 hover:text-primary"
                      onClick={() => handleSuggest(dateStr)}
                      disabled={suggest.isPending}
                      title="Suggérer avec Jarvis"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {editing && (
          <ImputationDialog
            imputation={editing}
            types={typesQ.data ?? []}
            etablissements={etabsQ.data ?? []}
            projets={projetsQ.data ?? []}
            onClose={() => setEditing(null)}
            onSave={async (payload) => {
              await upsert.mutateAsync(payload)
              setEditing(null)
              toast.success('Enregistré')
            }}
            onDelete={
              editing.id
                ? async () => {
                    await del.mutateAsync(editing.id!)
                    setEditing(null)
                    toast.success('Supprimé')
                  }
                : undefined
            }
          />
        )}
      </div>
    </PageDataState>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<
    string,
    { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
  > = {
    draft: { label: 'Brouillon', variant: 'outline' },
    submitted: { label: 'Soumis', variant: 'secondary' },
    approved: { label: 'Validé', variant: 'default' },
    rejected: { label: 'Rejeté', variant: 'destructive' },
  }
  const s = map[status] ?? map.draft
  return <Badge variant={s.variant}>{s.label}</Badge>
}

function ImputationDialog({
  imputation,
  types,
  etablissements,
  projets,
  onClose,
  onSave,
  onDelete,
}: {
  imputation: Partial<TimeImputation>
  types: Array<{ id: string; code: string; label: string; is_billable_default: boolean }>
  etablissements: Array<{ id: string; nom: string }>
  projets: Array<{ id: string; nom: string }>
  onClose: () => void
  onSave: (
    p: Partial<TimeImputation> & { date_imputation: string; duration_minutes: number }
  ) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const [form, setForm] = useState(() => ({
    id: imputation.id,
    date_imputation: imputation.date_imputation ?? toDateStr(new Date()),
    duration_minutes: imputation.duration_minutes ?? 60,
    activity_type_id: imputation.activity_type_id ?? null,
    etablissement_id: imputation.etablissement_id ?? null,
    projet_rd_id: imputation.projet_rd_id ?? null,
    is_billable: imputation.is_billable ?? false,
    note: imputation.note ?? '',
  }))

  const type = types.find((t) => t.id === form.activity_type_id)

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{form.id ? 'Modifier' : 'Ajouter'} une imputation</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium">Date</label>
              <Input
                type="date"
                value={form.date_imputation}
                onChange={(e) => setForm({ ...form, date_imputation: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-medium">Durée (min)</label>
              <Input
                type="number"
                min={15}
                step={15}
                value={form.duration_minutes}
                onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium">Type d'activité</label>
            <Select
              value={form.activity_type_id ?? undefined}
              onValueChange={(v) => {
                const t = types.find((x) => x.id === v)
                setForm({
                  ...form,
                  activity_type_id: v,
                  is_billable: t?.is_billable_default ?? form.is_billable,
                })
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choisir…" />
              </SelectTrigger>
              <SelectContent>
                {types.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium">Établissement (optionnel)</label>
            <Select
              value={form.etablissement_id ?? '__none__'}
              onValueChange={(v) =>
                setForm({ ...form, etablissement_id: v === '__none__' ? null : v })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Aucun —</SelectItem>
                {etablissements.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium">Projet R&D (optionnel)</label>
            <Select
              value={form.projet_rd_id ?? '__none__'}
              onValueChange={(v) => setForm({ ...form, projet_rd_id: v === '__none__' ? null : v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Aucun —</SelectItem>
                {projets.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium">Note</label>
            <Textarea
              rows={2}
              value={form.note ?? ''}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_billable}
              onChange={(e) => setForm({ ...form, is_billable: e.target.checked })}
            />
            Facturable {type?.is_billable_default && <Badge variant="outline">par défaut</Badge>}
          </label>
        </div>
        <DialogFooter className="flex-row justify-between">
          {onDelete ? (
            <Button variant="destructive" size="sm" onClick={() => onDelete()}>
              <Trash2 className="h-4 w-4 mr-1" />
              Supprimer
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button
              onClick={() => onSave(form)}
              disabled={!form.duration_minutes || !form.activity_type_id}
            >
              Enregistrer
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// Validation (admin/manager/direction)
// ============================================================
function ValidationSemaines() {
  const q = usePendingWeeklySubmissions()
  const approve = useApproveWeek()
  const [rejectFor, setRejectFor] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  // Fetch user names lookup
  const userIds = (q.data ?? []).map((s) => s.user_id)
  const namesQ = useQuery({
    queryKey: ['profiles_names', userIds.sort().join(',')],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, prenom, nom')
        .in('id', userIds)
      if (error) throw error
      const map = new Map<string, string>()
      ;(data ?? []).forEach((p: { id: string; prenom: string | null; nom: string | null }) => {
        map.set(p.id, `${p.prenom ?? ''} ${p.nom ?? ''}`.trim() || p.id.slice(0, 8))
      })
      return map
    },
  })

  return (
    <PageDataState
      isLoading={q.isLoading}
      isError={!!q.error}
      error={q.error as Error | null}
      isEmpty={(q.data?.length ?? 0) === 0}
      emptyTitle="Aucune semaine à valider"
      emptyDescription="Toutes les soumissions ont été traitées."
    >
      <div className="space-y-3">
        {(q.data ?? []).map((s) => (
          <Card key={s.id}>
            <CardContent className="pt-4 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="font-semibold">
                  {namesQ.data?.get(s.user_id) ?? s.user_id.slice(0, 8)}
                </div>
                <div className="text-sm text-muted-foreground">
                  Semaine {s.week_iso} — {(s.total_minutes / 60).toFixed(1)}h (
                  {(s.billable_minutes / 60).toFixed(1)}h facturable)
                </div>
                {s.note && <div className="text-xs mt-1 italic">"{s.note}"</div>}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={async () => {
                    await approve.mutateAsync({ submission_id: s.id, action: 'approve' })
                    toast.success('Approuvé')
                  }}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Approuver
                </Button>
                <Dialog
                  open={rejectFor === s.id}
                  onOpenChange={(o) => {
                    setRejectFor(o ? s.id : null)
                    if (!o) setReason('')
                  }}
                >
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <XCircle className="h-4 w-4 mr-1" />
                      Rejeter
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Rejeter la semaine {s.week_iso}</DialogTitle>
                    </DialogHeader>
                    <Textarea
                      placeholder="Motif du rejet…"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setRejectFor(null)}>
                        Annuler
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={async () => {
                          await approve.mutateAsync({
                            submission_id: s.id,
                            action: 'reject',
                            reason,
                          })
                          toast.success('Rejeté')
                          setRejectFor(null)
                          setReason('')
                        }}
                      >
                        Confirmer le rejet
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </PageDataState>
  )
}

// ============================================================
// Rentabilité (admin)
// ============================================================
function Rentabilite() {
  const now = new Date()
  const firstDayThisYear = `${now.getFullYear()}-01-01`
  const etabQ = useRentabiliteEtablissement(firstDayThisYear)
  const projQ = useRentabiliteProjetRd(firstDayThisYear)

  return (
    <PageDataState
      isLoading={etabQ.isLoading || projQ.isLoading}
      isError={!!(etabQ.error || projQ.error)}
      error={(etabQ.error || projQ.error) as Error | null}
    >
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Rentabilité par établissement</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground border-b">
                  <tr>
                    <th className="py-2">Établissement</th>
                    <th>Mois</th>
                    <th className="text-right">Heures</th>
                    <th className="text-right">Coût</th>
                  </tr>
                </thead>
                <tbody>
                  {(etabQ.data ?? []).map((r: Record<string, unknown>, i: number) => (
                    <tr key={i} className="border-b">
                      <td className="py-1.5">{String(r.etablissement_nom ?? '—')}</td>
                      <td>{String(r.mois ?? '').slice(0, 7)}</td>
                      <td className="text-right">
                        {(Number(r.total_minutes ?? 0) / 60).toFixed(1)}h
                      </td>
                      <td className="text-right">
                        {Number(r.cout_total ?? 0).toLocaleString('fr-FR', {
                          style: 'currency',
                          currency: 'EUR',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(etabQ.data?.length ?? 0) === 0 && (
                <div className="text-center text-muted-foreground py-6">Aucune donnée</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rentabilité par projet R&D (CIR)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground border-b">
                  <tr>
                    <th className="py-2">Projet</th>
                    <th>Mois</th>
                    <th className="text-right">Heures</th>
                    <th className="text-right">Coût</th>
                    <th>CIR</th>
                  </tr>
                </thead>
                <tbody>
                  {(projQ.data ?? []).map((r: Record<string, unknown>, i: number) => (
                    <tr key={i} className="border-b">
                      <td className="py-1.5">{String(r.projet_nom ?? '—')}</td>
                      <td>{String(r.mois ?? '').slice(0, 7)}</td>
                      <td className="text-right">
                        {(Number(r.total_minutes ?? 0) / 60).toFixed(1)}h
                      </td>
                      <td className="text-right">
                        {Number(r.cout_total ?? 0).toLocaleString('fr-FR', {
                          style: 'currency',
                          currency: 'EUR',
                        })}
                      </td>
                      <td>
                        {r.cir_eligible ? (
                          <Badge variant="default">✓</Badge>
                        ) : (
                          <Badge variant="outline">—</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(projQ.data?.length ?? 0) === 0 && (
                <div className="text-center text-muted-foreground py-6">Aucune donnée</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </PageDataState>
  )
}
