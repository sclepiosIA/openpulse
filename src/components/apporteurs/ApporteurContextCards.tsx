import { useMemo, useState } from 'react'
import { useApporteurContextData, type Canal as CanalDb } from './useApporteurContextData'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { CalendarClock, History, MessageSquare, Pencil, Plus, Trash2 } from 'lucide-react'
import { PartenariatSanteCard } from './PartenariatSanteCard'

type Canal = CanalDb

interface ExchangeItem {
  id: string
  date: string
  canal: Canal
  resume: string
}

interface NextStepItem {
  id: string
  action: string
  echeance: string
  owner: string
}

const CANAL_COLORS: Record<Canal, string> = {
  Email: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  Visio: 'bg-purple-500/10 text-purple-700 dark:text-purple-300',
  Téléphone: 'bg-green-500/10 text-green-700 dark:text-green-300',
  RDV: 'bg-orange-500/10 text-orange-700 dark:text-orange-300',
}

function formatDateFR(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

function todayISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export interface ApporteurContextCardsProps {
  apporteurId?: string
  dateDebut?: string
  dateFin?: string | null
  prospectsCibles?: number
  clientsSignes?: number
  prospectsCiblesTousPartenaires?: number
}

export function ApporteurContextCards({
  apporteurId,
  dateDebut,
  dateFin,
  prospectsCibles,
  clientsSignes,
  prospectsCiblesTousPartenaires,
}: ApporteurContextCardsProps = {}) {
  const {
    exchanges,
    nextSteps,
    addExchange,
    updateExchange,
    addNextStep,
    updateNextStep,
    deleteNextStep,
  } = useApporteurContextData(apporteurId)

  // Dialogs
  const [exchangeDialogOpen, setExchangeDialogOpen] = useState(false)
  const [editingExchangeId, setEditingExchangeId] = useState<string | null>(null)
  const [exchangeDraft, setExchangeDraft] = useState<{
    date: string
    canal: Canal
    resume: string
  }>({
    date: todayISO(),
    canal: 'Email',
    resume: '',
  })

  const [nextStepDialogOpen, setNextStepDialogOpen] = useState(false)
  const [editingNextStepId, setEditingNextStepId] = useState<string | null>(null)
  const [nextStepDraft, setNextStepDraft] = useState<{
    action: string
    echeance: string
    owner: string
  }>({
    action: '',
    echeance: todayISO(),
    owner: '',
  })

  const [historySheetOpen, setHistorySheetOpen] = useState(false)

  const openExchangeDialog = (item?: ExchangeItem) => {
    if (item) {
      setEditingExchangeId(item.id)
      setExchangeDraft({ date: item.date, canal: item.canal, resume: item.resume })
    } else {
      setEditingExchangeId(null)
      setExchangeDraft({ date: todayISO(), canal: 'Email', resume: '' })
    }
    setExchangeDialogOpen(true)
  }

  const openNextStepDialog = (item?: NextStepItem) => {
    if (item) {
      setEditingNextStepId(item.id)
      setNextStepDraft({ action: item.action, echeance: item.echeance, owner: item.owner })
    } else {
      setEditingNextStepId(null)
      setNextStepDraft({ action: '', echeance: todayISO(), owner: '' })
    }
    setNextStepDialogOpen(true)
  }

  const submitExchange = async () => {
    if (!exchangeDraft.resume.trim() || !exchangeDraft.date) return
    try {
      if (editingExchangeId) {
        await updateExchange.mutateAsync({
          id: editingExchangeId,
          date: exchangeDraft.date,
          canal: exchangeDraft.canal,
          resume: exchangeDraft.resume.trim(),
        })
      } else {
        await addExchange.mutateAsync({
          date: exchangeDraft.date,
          canal: exchangeDraft.canal,
          resume: exchangeDraft.resume.trim(),
        })
      }
      setExchangeDialogOpen(false)
      setEditingExchangeId(null)
    } catch (err) {
      console.error('Erreur enregistrement échange', err)
    }
  }

  const submitNextStep = async () => {
    if (!nextStepDraft.action.trim() || !nextStepDraft.echeance) return
    try {
      if (editingNextStepId) {
        await updateNextStep.mutateAsync({
          id: editingNextStepId,
          action: nextStepDraft.action.trim(),
          echeance: nextStepDraft.echeance,
          owner: nextStepDraft.owner.trim(),
        })
      } else {
        await addNextStep.mutateAsync({
          action: nextStepDraft.action.trim(),
          echeance: nextStepDraft.echeance,
          owner: nextStepDraft.owner.trim(),
        })
      }
      setNextStepDialogOpen(false)
      setEditingNextStepId(null)
    } catch (err) {
      console.error('Erreur enregistrement next step', err)
    }
  }

  const removeNextStep = async (id: string) => {
    try {
      await deleteNextStep.mutateAsync(id)
    } catch (err) {
      console.error('Erreur suppression next step', err)
    }
  }

  // 4 échanges les plus récents (date desc)
  const displayedExchanges = useMemo(
    () =>
      [...exchanges].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, 4),
    [exchanges]
  )

  // 4 next steps les plus anciennes (échéance asc)
  const displayedNextSteps = useMemo(
    () =>
      [...nextSteps]
        .sort((a, b) => (a.echeance < b.echeance ? -1 : a.echeance > b.echeance ? 1 : 0))
        .slice(0, 4),
    [nextSteps]
  )

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Carte 1 : Échanges récents + next steps */}
      <Card className="flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            Historique & prochaines étapes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 flex-1">
          <div>
            <div className="flex items-center justify-between mb-2 gap-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Échanges récents
              </h4>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => setHistorySheetOpen(true)}
                >
                  <History className="h-3 w-3 mr-1" />
                  Voir tout
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => openExchangeDialog()}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Ajouter
                </Button>
              </div>
            </div>
            {displayedExchanges.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Aucun échange enregistré.</p>
            ) : (
              <ul className="space-y-2">
                {displayedExchanges.map((ex) => (
                  <li key={ex.id} className="flex items-start gap-2 text-sm group/ex">
                    <span className="text-xs text-muted-foreground w-14 shrink-0 pt-0.5">
                      {formatDateFR(ex.date)}
                    </span>
                    <Badge
                      variant="secondary"
                      className={`${CANAL_COLORS[ex.canal]} shrink-0 text-[10px] px-1.5 py-0`}
                    >
                      {ex.canal}
                    </Badge>
                    <span className="text-foreground/90 leading-snug flex-1">{ex.resume}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover/ex:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
                      onClick={() => openExchangeDialog(ex)}
                      aria-label="Modifier cet échange"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="pt-3 border-t">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Next steps
              </h4>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => openNextStepDialog()}
              >
                <Plus className="h-3 w-3 mr-1" />
                Ajouter
              </Button>
            </div>
            {displayedNextSteps.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                Aucune prochaine étape planifiée.
              </p>
            ) : (
              <ul className="space-y-2">
                {displayedNextSteps.map((ns) => (
                  <li key={ns.id} className="flex items-start gap-2 text-sm group/step">
                    <CalendarClock className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium leading-snug">{ns.action}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDateFR(ns.echeance)}
                        {ns.owner ? ` · ${ns.owner}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover/step:opacity-100 transition-opacity">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-primary"
                        onClick={() => openNextStepDialog(ns)}
                        aria-label="Modifier cette prochaine étape"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => removeNextStep(ns.id)}
                        aria-label="Supprimer cette prochaine étape"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Carte 2 : Santé du partenariat */}
      {apporteurId && dateDebut ? (
        <PartenariatSanteCard
          apporteurId={apporteurId}
          dateDebut={dateDebut}
          dateFin={dateFin ?? null}
          prospectsCibles={prospectsCibles ?? 0}
          clientsSignes={clientsSignes ?? 0}
          prospectsCiblesTousPartenaires={prospectsCiblesTousPartenaires ?? 0}
        />
      ) : null}

      {/* Dialog : ajouter un échange */}
      <Dialog open={exchangeDialogOpen} onOpenChange={setExchangeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingExchangeId ? 'Modifier l’échange' : 'Nouvel échange'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="exchange-date">Date</Label>
              <Input
                id="exchange-date"
                type="date"
                value={exchangeDraft.date}
                onChange={(e) => setExchangeDraft((d) => ({ ...d, date: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exchange-canal">Canal</Label>
              <Select
                value={exchangeDraft.canal}
                onValueChange={(v) => setExchangeDraft((d) => ({ ...d, canal: v as Canal }))}
              >
                <SelectTrigger id="exchange-canal">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Email">Email</SelectItem>
                  <SelectItem value="Visio">Visio</SelectItem>
                  <SelectItem value="Téléphone">Téléphone</SelectItem>
                  <SelectItem value="RDV">RDV</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exchange-resume">Résumé</Label>
              <Textarea
                id="exchange-resume"
                rows={3}
                placeholder="Sujet, décisions, prochaines actions…"
                value={exchangeDraft.resume}
                onChange={(e) => setExchangeDraft((d) => ({ ...d, resume: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setExchangeDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={submitExchange}
              disabled={!exchangeDraft.resume.trim() || !exchangeDraft.date}
            >
              {editingExchangeId ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog : ajouter une next step */}
      <Dialog open={nextStepDialogOpen} onOpenChange={setNextStepDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingNextStepId ? 'Modifier la prochaine étape' : 'Nouvelle prochaine étape'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="nextstep-action">Action</Label>
              <Textarea
                id="nextstep-action"
                rows={2}
                placeholder="Ex : Relancer CHU Bordeaux — proposition finale"
                value={nextStepDraft.action}
                onChange={(e) => setNextStepDraft((d) => ({ ...d, action: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nextstep-echeance">Échéance</Label>
              <Input
                id="nextstep-echeance"
                type="date"
                value={nextStepDraft.echeance}
                onChange={(e) => setNextStepDraft((d) => ({ ...d, echeance: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nextstep-owner">Responsable</Label>
              <Input
                id="nextstep-owner"
                placeholder="Ex : Commercial OpenPulse"
                value={nextStepDraft.owner}
                onChange={(e) => setNextStepDraft((d) => ({ ...d, owner: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNextStepDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={submitNextStep}
              disabled={!nextStepDraft.action.trim() || !nextStepDraft.echeance}
            >
              {editingNextStepId ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sheet : historique complet des échanges */}
      <Sheet open={historySheetOpen} onOpenChange={setHistorySheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              Historique complet des échanges
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            {exchanges.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Aucun échange enregistré.</p>
            ) : (
              <ul className="space-y-3">
                {[...exchanges]
                  .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
                  .map((ex) => (
                    <li
                      key={ex.id}
                      className="flex items-start gap-2 text-sm border-b border-border/50 pb-3 last:border-0 group/row"
                    >
                      <span className="text-xs text-muted-foreground w-16 shrink-0 pt-0.5">
                        {formatDateFR(ex.date)}
                      </span>
                      <Badge
                        variant="secondary"
                        className={`${CANAL_COLORS[ex.canal]} shrink-0 text-[10px] px-1.5 py-0`}
                      >
                        {ex.canal}
                      </Badge>
                      <span className="text-foreground/90 leading-snug flex-1">{ex.resume}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover/row:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
                        onClick={() => {
                          setHistorySheetOpen(false)
                          openExchangeDialog(ex)
                        }}
                        aria-label="Modifier cet échange"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
