import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Check, Flag, UserCheck, Trash2, Copy } from 'lucide-react'
import { CALENDAR_COLORS } from '@/types/calendar'
import { cn } from '@/lib/utils'
import { CategorySelector } from './CategorySelector'
import type { RefObject } from 'react'

type CalendarRow = { id: string; name: string; color: string }

export function EventFormHero({
  titleInputRef,
  title,
  setTitle,
  calendars,
  calendarId,
  setCalendarId,
  color,
  setColor,
  categoryId,
  setCategoryId,
}: {
  titleInputRef: RefObject<HTMLInputElement>
  title: string
  setTitle: (v: string) => void
  calendars: CalendarRow[] | undefined
  calendarId: string
  setCalendarId: (v: string) => void
  color: string | null
  setColor: (v: string | null) => void
  categoryId: string | null
  setCategoryId: (v: string | null) => void
}) {
  return (
    <div className="space-y-3">
      <Input
        ref={titleInputRef}
        placeholder="Titre de l'événement *"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="text-lg font-medium h-12 border-0 bg-transparent shadow-none px-0 focus-visible:ring-0 placeholder:text-muted-foreground/50"
      />
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={calendarId} onValueChange={setCalendarId}>
          <SelectTrigger className="w-auto min-w-[200px] h-9 gap-2">
            <SelectValue placeholder="Calendrier" />
          </SelectTrigger>
          <SelectContent>
            {calendars?.map((cal) => (
              <SelectItem key={cal.id} value={cal.id}>
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: cal.color }}
                  />
                  {cal.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-2 min-h-0">
              <span
                className={cn(
                  'w-4 h-4 rounded-full border',
                  !color && 'bg-transparent border-dashed border-muted-foreground/40'
                )}
                style={color ? { backgroundColor: color } : undefined}
              />
              <span className="text-xs">{color ? 'Couleur' : 'Couleur auto'}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3" align="start">
            <div className="flex flex-wrap gap-2 max-w-[220px]">
              <button
                type="button"
                className={cn(
                  'w-7 h-7 rounded-full border-2 border-dashed border-muted-foreground/40 flex items-center justify-center text-muted-foreground text-xs transition-all hover:scale-110',
                  color === null && 'ring-2 ring-offset-2 ring-primary'
                )}
                onClick={() => setColor(null)}
                aria-label="Couleur automatique"
              >
                ×
              </button>
              {CALENDAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={cn(
                    'w-7 h-7 rounded-full transition-all hover:scale-110 flex items-center justify-center',
                    color === c && 'ring-2 ring-offset-2 ring-primary scale-110'
                  )}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                  aria-label={`Couleur ${c}`}
                >
                  {color === c && <Check className="h-3.5 w-3.5 text-white drop-shadow" />}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <CategorySelector
          value={categoryId}
          onChange={(catId, catColor) => {
            setCategoryId(catId)
            if (catColor) setColor(catColor)
          }}
        />
      </div>
    </div>
  )
}

export function EventFormDisplayAvailability({
  displayAsBanner,
  setDisplayAsBanner,
  availability,
  setAvailability,
}: {
  displayAsBanner: boolean
  setDisplayAsBanner: (v: boolean) => void
  availability: 'busy' | 'free'
  setAvailability: (v: 'busy' | 'free') => void
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div
        className={cn(
          'rounded-lg border p-3 transition-colors',
          displayAsBanner ? 'border-primary/40 bg-primary/5' : 'border-border hover:bg-muted/40'
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0">
            <Flag
              className={cn(
                'h-4 w-4 mt-0.5 shrink-0',
                displayAsBanner ? 'text-primary' : 'text-muted-foreground'
              )}
            />
            <div className="min-w-0">
              <Label htmlFor="display-banner" className="text-sm font-medium cursor-pointer">
                Afficher en bannière
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                Bandeau continu (gardes, congés…)
              </p>
            </div>
          </div>
          <Switch
            id="display-banner"
            checked={displayAsBanner}
            onCheckedChange={setDisplayAsBanner}
          />
        </div>
      </div>

      <div
        className={cn(
          'rounded-lg border p-3 transition-colors',
          availability === 'free'
            ? 'border-primary/40 bg-primary/5'
            : 'border-border hover:bg-muted/40'
        )}
      >
        <div className="flex items-start gap-2">
          <UserCheck
            className={cn(
              'h-4 w-4 mt-0.5 shrink-0',
              availability === 'free' ? 'text-primary' : 'text-muted-foreground'
            )}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Disponibilité</p>
            <div className="mt-1.5 inline-flex rounded-md border bg-background p-0.5">
              <button
                type="button"
                onClick={() => setAvailability('busy')}
                className={cn(
                  'px-2.5 py-1 text-xs rounded transition-colors',
                  availability === 'busy'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Occupé
              </button>
              <button
                type="button"
                onClick={() => setAvailability('free')}
                className={cn(
                  'px-2.5 py-1 text-xs rounded transition-colors',
                  availability === 'free'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Disponible
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function EventFormFooter({
  isEditing,
  isSaving,
  onDelete,
  onDuplicate,
  onCancel,
  onSubmit,
}: {
  isEditing: boolean
  isSaving: boolean
  onDelete: () => void
  onDuplicate: () => void
  onCancel: () => void
  onSubmit: () => void
}) {
  return (
    <div className="px-3 sm:px-6 py-3 border-t bg-muted/30 flex flex-wrap items-center gap-2 flex-shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {isEditing ? (
        <div className="flex items-center gap-1 mr-auto">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onDelete()
                }}
                aria-label="Supprimer l'événement"
                className="sm:hidden text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Supprimer</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onDuplicate()
                }}
                aria-label="Dupliquer l'événement"
                className="sm:hidden"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Dupliquer</TooltipContent>
          </Tooltip>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onDelete()
            }}
            aria-label="Supprimer l'événement"
            className="hidden sm:inline-flex gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
            Supprimer
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onDuplicate()
            }}
            aria-label="Dupliquer l'événement"
            className="hidden sm:inline-flex gap-1.5"
          >
            <Copy className="h-4 w-4" />
            Dupliquer
          </Button>
        </div>
      ) : (
        <div className="mr-auto" />
      )}
      <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
        Annuler
      </Button>
      <Button
        type="button"
        size="sm"
        onClick={onSubmit}
        disabled={isSaving}
        title="Raccourci : Cmd/Ctrl + Entrée"
        className="min-w-[120px]"
      >
        {isEditing ? 'Enregistrer' : 'Créer'}
      </Button>
    </div>
  )
}
