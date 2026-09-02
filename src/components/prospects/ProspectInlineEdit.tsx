import { useEffect, useRef, useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Pencil, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/shared/use-toast'
import { useQueryClient } from '@tanstack/react-query'
import { PROSPECTS_NEXT_TASKS_KEY } from '@/hooks/crm/useProspectsNextTasks'
import { supabase } from '@/integrations/supabase/client'

const PROSPECT_STATUTS = [
  'Prospect',
  'Contacté',
  'Attente RDV',
  'RDV pris',
  'Attente post RDV',
  'Dans les RDV',
  'Etude émise',
  'Dans les RDV post EME',
  'Négociation',
  'Contractualisation',
  'Vendu',
  'Reporté',
  'Refus',
  'Autre compte / GHT',
] as const

async function invalidateProspects(qc: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    qc.invalidateQueries({ queryKey: ['prospects'] }),
    qc.invalidateQueries({ queryKey: ['prospect-stats'] }),
    qc.invalidateQueries({ queryKey: ['etablissements'] }),
    qc.invalidateQueries({ queryKey: ['all-etablissements'] }),
    qc.invalidateQueries({ queryKey: ['prospects-progress'] }),
    qc.invalidateQueries({ queryKey: PROSPECTS_NEXT_TASKS_KEY }),
  ])
}

interface WrapperProps {
  display: React.ReactNode
  children: (close: () => void) => React.ReactNode
  align?: 'start' | 'center' | 'end'
  className?: string
  multiline?: boolean
  onClear?: () => void | Promise<void>
  clearLabel?: string
  clearConfirm?: string
}

function EditableCell({
  display,
  children,
  align = 'start',
  className,
  multiline = false,
  onClear,
  clearLabel = 'Effacer la valeur',
  clearConfirm,
}: WrapperProps) {
  const [open, setOpen] = useState(false)
  const [clearing, setClearing] = useState(false)

  const handleClear = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (!onClear || clearing) return
    if (clearConfirm && !window.confirm(clearConfirm)) return
    setClearing(true)
    try {
      await onClear()
    } finally {
      setClearing(false)
    }
  }

  return (
    <div
      className={cn(
        multiline
          ? 'group/edit flex items-start gap-1 -mx-1 px-1 py-0.5 rounded hover:bg-accent/60 cursor-pointer w-full'
          : 'group/edit inline-flex items-center gap-1 -mx-1 px-1 py-0.5 rounded hover:bg-accent/60 cursor-pointer',
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'text-left gap-1 min-w-0',
              multiline ? 'flex items-start w-full' : 'inline-flex items-center'
            )}
            aria-label="Modifier"
          >
            <span
              className={cn(
                'min-w-0',
                multiline ? 'flex-1 break-words whitespace-normal' : 'truncate'
              )}
            >
              {display}
            </span>
            <Pencil
              className={cn(
                'h-3 w-3 opacity-0 group-hover/edit:opacity-60 shrink-0',
                multiline && 'mt-0.5'
              )}
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align={align}
          className="w-72 p-3"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          onKeyUp={(e) => e.stopPropagation()}
          onKeyPress={(e) => e.stopPropagation()}
        >
          {children(() => setOpen(false))}
        </PopoverContent>
      </Popover>
      {onClear && (
        <button
          type="button"
          onClick={handleClear}
          disabled={clearing}
          aria-label={clearLabel}
          title={clearLabel}
          className={cn(
            'opacity-0 group-hover/edit:opacity-60 hover:opacity-100 focus-visible:opacity-100 shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive transition-opacity',
            multiline && 'mt-0.5'
          )}
        >
          {clearing ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
        </button>
      )}
    </div>
  )
}

interface FieldProps {
  prospectId: string
  value: string | null | undefined
  display: React.ReactNode
}

export function EditableStatut({ prospectId, value, display }: FieldProps) {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [saving, setSaving] = useState(false)

  const save = async (next: string, close: () => void) => {
    if (!next || next === value) {
      close()
      return
    }
    setSaving(true)
    const { error } = await supabase
      .from('etablissements')
      .update({ statut: next } as never)
      .eq('id', prospectId)
    setSaving(false)
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
      return
    }
    await invalidateProspects(qc)
    toast({ title: 'Statut mis à jour' })
    close()
  }

  return (
    <EditableCell display={display}>
      {(close) => (
        <div className="space-y-2">
          <div className="text-xs font-medium">Statut</div>
          <Select defaultValue={value ?? undefined} onValueChange={(v) => save(v, close)}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner…" />
            </SelectTrigger>
            <SelectContent>
              {PROSPECT_STATUTS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        </div>
      )}
    </EditableCell>
  )
}

interface TextFieldProps extends FieldProps {
  column: 'dpi'
  label: string
  placeholder?: string
}

export function EditableText({
  prospectId,
  value,
  display,
  column,
  label,
  placeholder,
}: TextFieldProps) {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [val, setVal] = useState(value ?? '')
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLInputElement | null>(null)
  useEffect(() => {
    setVal(value ?? '')
  }, [value])

  const save = async (close: () => void) => {
    const next = val.trim() || null
    if ((next ?? '') === (value ?? '')) {
      close()
      return
    }
    setSaving(true)
    const { error } = await supabase
      .from('etablissements')
      .update({ [column]: next } as never)
      .eq('id', prospectId)
    setSaving(false)
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
      return
    }
    await invalidateProspects(qc)
    toast({ title: `${label} mis à jour` })
    close()
  }

  return (
    <EditableCell display={display}>
      {(close) => (
        <div className="space-y-2">
          <div className="text-xs font-medium">{label}</div>
          <Input
            ref={ref}
            autoFocus
            value={val}
            placeholder={placeholder}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                save(close)
              }
              if (e.key === 'Escape') close()
            }}
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={close}>
              <X className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={() => save(close)} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      )}
    </EditableCell>
  )
}

interface NumberFieldProps extends FieldProps {
  column: 'nombre_passages_urgences_annuel'
  label: string
}

export function EditableNumber({ prospectId, value, display, column, label }: NumberFieldProps) {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [val, setVal] = useState(value == null ? '' : String(value))
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    setVal(value == null ? '' : String(value))
  }, [value])

  const save = async (close: () => void) => {
    const trimmed = val.trim()
    const next = trimmed === '' ? null : Number(trimmed.replace(/[\s,]/g, ''))
    if (next != null && !Number.isFinite(next)) {
      toast({ title: 'Valeur invalide', variant: 'destructive' })
      return
    }
    setSaving(true)
    const { error } = await supabase
      .from('etablissements')
      .update({ [column]: next } as never)
      .eq('id', prospectId)
    setSaving(false)
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
      return
    }
    await invalidateProspects(qc)
    toast({ title: `${label} mis à jour` })
    close()
  }

  return (
    <EditableCell display={display} className="justify-end">
      {(close) => (
        <div className="space-y-2">
          <div className="text-xs font-medium">{label}</div>
          <Input
            autoFocus
            inputMode="numeric"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                save(close)
              }
              if (e.key === 'Escape') close()
            }}
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={close}>
              <X className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={() => save(close)} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      )}
    </EditableCell>
  )
}

interface DateFieldProps extends FieldProps {
  column: 'date_previsionnelle_signature'
  label: string
}

export function EditableDate({ prospectId, value, display, column, label }: DateFieldProps) {
  const { toast } = useToast()
  const qc = useQueryClient()
  const initial = value ? value.slice(0, 10) : ''
  const [val, setVal] = useState(initial)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    setVal(value ? value.slice(0, 10) : '')
  }, [value])

  const save = async (close: () => void) => {
    const next = val || null
    if ((next ?? '') === (initial ?? '')) {
      close()
      return
    }
    setSaving(true)
    const { error } = await supabase
      .from('etablissements')
      .update({ [column]: next } as never)
      .eq('id', prospectId)
    setSaving(false)
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
      return
    }
    await invalidateProspects(qc)
    toast({ title: `${label} mis à jour` })
    close()
  }

  const clear = async () => {
    if (!value) return
    const { error } = await supabase
      .from('etablissements')
      .update({ [column]: null } as never)
      .eq('id', prospectId)
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
      return
    }
    await invalidateProspects(qc)
    toast({ title: `${label} effacé` })
  }

  return (
    <EditableCell
      display={display}
      onClear={value ? clear : undefined}
      clearLabel={`Effacer ${label.toLowerCase()}`}
    >
      {(close) => (
        <div className="space-y-2">
          <div className="text-xs font-medium">{label}</div>
          <Input
            autoFocus
            type="date"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                save(close)
              }
              if (e.key === 'Escape') close()
            }}
          />
          <div className="flex justify-between gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setVal('')
              }}
            >
              Effacer
            </Button>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={close}>
                <X className="h-4 w-4" />
              </Button>
              <Button size="sm" onClick={() => save(close)} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </EditableCell>
  )
}

/**
 * Édition de la "next step" : titre + échéance stockés directement sur l'établissement
 * (colonnes `prochaine_action_orga` et `date_action_orga`).
 * Une seule valeur par établissement, pas de fallback sur d'anciennes tâches.
 */
interface NextStepFieldProps {
  prospectId?: string
  groupeId?: string
  taskId?: string // conservé pour compat, ignoré
  title?: string
  echeance?: string | null
  display: React.ReactNode
  align?: 'start' | 'center' | 'end'
  multiline?: boolean
  /** 'task' = efface titre + date ; 'date' = efface uniquement la date. */
  clearMode?: 'task' | 'date'
}

export function EditableNextStep({
  prospectId,
  groupeId,
  title,
  echeance,
  display,
  align,
  multiline,
  clearMode = 'task',
}: NextStepFieldProps) {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [titre, setTitre] = useState(title ?? '')
  const [date, setDate] = useState(echeance ? echeance.slice(0, 10) : '')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    setTitre(title ?? '')
  }, [title])
  useEffect(() => {
    setDate(echeance ? echeance.slice(0, 10) : '')
  }, [echeance])

  const isGroupe = !!groupeId
  const targetId = groupeId ?? prospectId ?? ''
  const targetTable = (isGroupe ? 'groupes_etablissements' : 'etablissements') as
    | 'groupes_etablissements'
    | 'etablissements'

  const invalidate = async () => {
    await invalidateProspects(qc)
    if (isGroupe) {
      await qc.invalidateQueries({ queryKey: ['prospects', 'group-map'] })
    }
  }

  const save = async (close: () => void) => {
    const t = titre.trim()
    if (!t) {
      toast({ title: 'Titre requis', variant: 'destructive' })
      return
    }
    if (!targetId) {
      toast({ title: 'Cible manquante', variant: 'destructive' })
      return
    }
    setSaving(true)
    const { error } = await supabase
      .from(targetTable)
      .update({
        prochaine_action_orga: t,
        date_action_orga: date || null,
      } as never)
      .eq('id', targetId)
    setSaving(false)
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
      return
    }
    await invalidate()
    toast({ title: 'Next step mis à jour' })
    close()
  }

  const clear = async () => {
    if (!targetId) return
    const patch =
      clearMode === 'date'
        ? { date_action_orga: null }
        : { prochaine_action_orga: null, date_action_orga: null }
    const { error } = await supabase
      .from(targetTable)
      .update(patch as never)
      .eq('id', targetId)
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
      return
    }
    await invalidate()
    toast({ title: clearMode === 'date' ? 'Date effacée' : 'Next step supprimé' })
  }

  const canClear = clearMode === 'date' ? Boolean(echeance) : Boolean(title || echeance)

  return (
    <EditableCell
      display={display}
      align={align}
      multiline={multiline}
      onClear={canClear ? clear : undefined}
      clearLabel={clearMode === 'date' ? 'Effacer la date' : 'Supprimer le next step'}
      clearConfirm={clearMode === 'task' ? 'Supprimer ce next step ?' : undefined}
    >
      {(close) => (
        <div className="space-y-2">
          <div className="text-xs font-medium">Next step {isGroupe ? '(groupe)' : ''}</div>
          <Textarea
            autoFocus
            value={titre}
            placeholder="Ex : Relancer par email, envoyer une étude…"
            rows={3}
            onChange={(e) => setTitre(e.target.value)}
          />
          <div className="text-xs font-medium">Date prévue</div>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={close}>
              <X className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={() => save(close)} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      )}
    </EditableCell>
  )
}
