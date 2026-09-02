import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  History,
  Plus,
  Loader2,
  Mail,
  Phone,
  Users,
  StickyNote,
  Video,
  MessageSquare,
  Pencil,
} from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Activity {
  id: string
  etablissement_id: string | null
  groupe_id?: string | null
  activity_type: string
  title: string
  description: string | null
  activity_date: string
}

const ACTIVITY_TYPES: { value: string; label: string; icon: typeof Mail }[] = [
  { value: 'note', label: 'Note', icon: StickyNote },
  { value: 'call', label: 'Appel', icon: Phone },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'meeting', label: 'Réunion', icon: Users },
  { value: 'visio', label: 'Visio', icon: Video },
  { value: 'demo', label: 'Démo', icon: MessageSquare },
]

function iconFor(type: string) {
  const t = ACTIVITY_TYPES.find((a) => a.value === type)
  return t?.icon ?? StickyNote
}

function labelFor(type: string) {
  return ACTIVITY_TYPES.find((a) => a.value === type)?.label ?? type
}

function fmtDateTime(v: string) {
  try {
    return format(new Date(v), "d MMM yyyy 'à' HH:mm", { locale: fr })
  } catch {
    return v
  }
}

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

interface Props {
  etablissementId?: string
  groupeId?: string
  etablissementNom: string
}

export function ProspectInteractionsCell({ etablissementId, groupeId, etablissementNom }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Activity | null>(null)

  const targetKey = groupeId ? `g:${groupeId}` : `e:${etablissementId ?? ''}`
  const filterColumn: 'etablissement_id' | 'groupe_id' = groupeId ? 'groupe_id' : 'etablissement_id'
  const filterValue = groupeId ?? etablissementId ?? ''

  const { data: latest } = useQuery({
    queryKey: ['prospect-latest-interaction', targetKey],
    queryFn: async () => {
      if (!filterValue) return null
      const { data, error } = await supabase
        .from('customer_activities')
        .select('id, activity_type, title, description, activity_date')
        .eq(filterColumn, filterValue)
        .order('activity_date', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data as Pick<
        Activity,
        'id' | 'activity_type' | 'title' | 'description' | 'activity_date'
      > | null
    },
    enabled: !!filterValue,
    staleTime: 60_000,
  })

  const openAdd = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const openEdit = (a: Activity) => {
    setEditing(a)
    setDialogOpen(true)
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-0" onClick={(e) => e.stopPropagation()}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center justify-center h-5 w-5 p-0 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Voir l'historique des interactions"
              onClick={() => setSheetOpen(true)}
            >
              <History className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            {latest ? (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                  {(() => {
                    const Ico = iconFor(latest.activity_type)
                    return <Ico className="h-3 w-3" />
                  })()}
                  <span>{labelFor(latest.activity_type)}</span>
                  <span className="text-muted-foreground font-normal">
                    · {fmtDateTime(latest.activity_date)}
                  </span>
                </div>
                <div className="text-xs font-medium">{latest.title}</div>
                {latest.description && (
                  <div className="text-[11px] text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                    {latest.description}
                  </div>
                )}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">Aucune interaction enregistrée</span>
            )}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center justify-center h-5 w-5 p-0 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Ajouter une interaction"
              onClick={openAdd}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Ajouter une interaction</TooltipContent>
        </Tooltip>
      </div>

      <InteractionsHistorySheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        filterColumn={filterColumn}
        filterValue={filterValue}
        entityKey={targetKey}
        etablissementNom={etablissementNom}
        onAddClick={() => {
          setSheetOpen(false)
          openAdd()
        }}
        onEditClick={(a) => {
          setSheetOpen(false)
          openEdit(a)
        }}
      />

      <InteractionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        filterColumn={filterColumn}
        filterValue={filterValue}
        entityKey={targetKey}
        etablissementNom={etablissementNom}
        activity={editing}
      />
    </TooltipProvider>
  )
}

function InteractionsHistorySheet({
  open,
  onOpenChange,
  filterColumn,
  filterValue,
  entityKey,
  etablissementNom,
  onAddClick,
  onEditClick,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  filterColumn: 'etablissement_id' | 'groupe_id'
  filterValue: string
  entityKey: string
  etablissementNom: string
  onAddClick: () => void
  onEditClick: (a: Activity) => void
}) {
  const { data: activities, isLoading } = useQuery({
    queryKey: ['prospect-interactions-history', entityKey],
    queryFn: async () => {
      if (!filterValue) return []
      const { data, error } = await supabase
        .from('customer_activities')
        .select('id, etablissement_id, groupe_id, activity_type, title, description, activity_date')
        .eq(filterColumn, filterValue)
        .order('activity_date', { ascending: false })
        .limit(500)
      if (error) throw error
      return (data ?? []) as Activity[]
    },
    enabled: open && !!filterValue,
    staleTime: 30_000,
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg flex flex-col p-0"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        onKeyUp={(e) => e.stopPropagation()}
      >
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Historique des interactions
          </SheetTitle>
          <SheetDescription className="truncate">{etablissementNom}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading && (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
          {!isLoading && (activities?.length ?? 0) === 0 && (
            <div className="text-sm text-muted-foreground text-center py-10">
              Aucune interaction enregistrée pour cet établissement.
            </div>
          )}
          {activities?.map((a) => {
            const Ico = iconFor(a.activity_type)
            return (
              <div
                key={a.id}
                className={cn(
                  'group rounded-md border bg-card p-3 space-y-1',
                  'hover:bg-muted/40 transition-colors'
                )}
              >
                <div className="flex items-center gap-2 text-xs">
                  <Ico className="h-3.5 w-3.5 text-primary" />
                  <span className="font-semibold">{labelFor(a.activity_type)}</span>
                  <span className="text-muted-foreground ml-auto">
                    {fmtDateTime(a.activity_date)}
                  </span>
                  <button
                    type="button"
                    aria-label="Modifier l'interaction"
                    className="inline-flex items-center justify-center h-6 w-6 rounded text-muted-foreground hover:text-foreground hover:bg-muted opacity-0 group-hover:opacity-100 focus:opacity-100 transition"
                    onClick={() => onEditClick(a)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="text-sm font-medium">{a.title}</div>
                {a.description && (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                    {a.description}
                  </p>
                )}
              </div>
            )
          })}
        </div>

        <div className="border-t p-3">
          <Button className="w-full" onClick={onAddClick}>
            <Plus className="h-4 w-4 mr-2" />
            Ajouter une interaction
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function InteractionDialog({
  open,
  onOpenChange,
  filterColumn,
  filterValue,
  entityKey,
  etablissementNom,
  activity,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  filterColumn: 'etablissement_id' | 'groupe_id'
  filterValue: string
  entityKey: string
  etablissementNom: string
  activity: Activity | null
}) {
  const qc = useQueryClient()
  const isEdit = !!activity
  const [type, setType] = useState<string>('note')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [when, setWhen] = useState<string>('')

  useEffect(() => {
    if (!open) return
    if (activity) {
      setType(activity.activity_type)
      setTitle(activity.title ?? '')
      setDescription(activity.description ?? '')
      setWhen(toDatetimeLocal(activity.activity_date))
    } else {
      const d = new Date()
      d.setSeconds(0, 0)
      setType('note')
      setTitle('')
      setDescription('')
      setWhen(toDatetimeLocal(d.toISOString()))
    }
  }, [open, activity])

  const mutation = useMutation({
    mutationFn: async () => {
      const activityDate = new Date(when)
      if (isNaN(activityDate.getTime())) throw new Error('Date invalide')
      const payload = {
        activity_type: type,
        title: title.trim() || labelFor(type),
        description: description.trim() || null,
        activity_date: activityDate.toISOString(),
      }
      if (isEdit && activity) {
        const { error } = await supabase
          .from('customer_activities')
          .update(payload)
          .eq('id', activity.id)
        if (error) throw error
      } else {
        const insertPayload: Record<string, unknown> = {
          ...payload,
          status: 'completed',
        }
        insertPayload[filterColumn] = filterValue
        const { error } = await supabase.from('customer_activities').insert(insertPayload as never)
        if (error) throw error
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Interaction mise à jour' : 'Interaction ajoutée')
      qc.invalidateQueries({ queryKey: ['prospect-interactions-history', entityKey] })
      qc.invalidateQueries({ queryKey: ['prospect-latest-interaction', entityKey] })
      qc.invalidateQueries({ queryKey: ['customer-activities'] })
      onOpenChange(false)
    },
    onError: (e: Error) => {
      toast.error(e.message || "Impossible d'enregistrer l'interaction")
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        onKeyUp={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier l'interaction" : 'Ajouter une interaction'}</DialogTitle>
          <p className="text-xs text-muted-foreground truncate">{etablissementNom}</p>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="activity-type">Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="activity-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTIVITY_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="activity-date">Date & heure</Label>
            <Input
              id="activity-date"
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="activity-title">Titre</Label>
            <Input
              id="activity-title"
              placeholder="Ex : Appel de qualification"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="activity-desc">Compte rendu</Label>
            <Textarea
              id="activity-desc"
              placeholder="Notes, points abordés, next steps…"
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Annuler
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEdit ? 'Enregistrer les modifications' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
