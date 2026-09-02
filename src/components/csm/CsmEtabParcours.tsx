import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/csm/StatusBadge'
import { EditableSelectCell } from '@/components/csm/EditableSelectCell'
import { EditableCell } from '@/components/csm/EditableCell'
import { useCsmParcours } from '@/hooks/csm/useCsmParcours'
import { JALON_TYPES, type JalonType, type JalonStatut } from '@/types/csm'
import { Route, CalendarIcon } from 'lucide-react'
import { format, parseISO, isValid } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const STATUT_OPTIONS = [
  { value: '', label: '-' },
  { value: 'done', label: 'Fait' },
  { value: 'planned', label: 'Planifié' },
  { value: 'planning', label: 'En cours de planification' },
  { value: 'pending', label: 'En attente' },
  { value: 'skipped', label: 'Non réalisé' },
]
function ParcoursDatePicker({ value, onSave }: { value?: string | null; onSave: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const parsed = value ? parseISO(value) : undefined
  const selected = parsed && isValid(parsed) ? parsed : undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "w-full justify-start text-xs h-7 px-2 font-normal",
            !selected && "text-muted-foreground italic"
          )}
        >
          <CalendarIcon className="mr-1.5 h-3 w-3" />
          {selected ? format(selected, 'dd/MM/yyyy', { locale: fr }) : 'Date...'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => {
            if (date) {
              onSave(format(date, 'yyyy-MM-dd'))
            }
            setOpen(false)
          }}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  )
}

interface CsmEtabParcoursProps {
  etablissementId: string
}

export function CsmEtabParcours({ etablissementId }: CsmEtabParcoursProps) {
  const { data: jalons, upsert } = useCsmParcours(etablissementId)

  const jalonsMap = useMemo(() => {
    const map = new Map<string, typeof jalons[0]>()
    jalons.forEach(j => map.set(j.jalon_type, j))
    return map
  }, [jalons])

  const handleUpdate = (jalonType: JalonType, field: string, value: string) => {
    const existing = jalonsMap.get(jalonType)
    upsert({
      ...(existing || {}),
      etablissement_id: etablissementId,
      jalon_type: jalonType,
      [field]: value || null,
    })
  }

  const completedCount = jalons.filter(j => j.statut === 'done').length

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Route className="w-4 h-4" />
            Parcours client
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {completedCount}/{JALON_TYPES.length} jalons complétés
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {JALON_TYPES.map(jalonDef => {
            const jalon = jalonsMap.get(jalonDef.value)
            return (
              <div key={jalonDef.value} className={cn(
                "border rounded-lg p-3 space-y-2 transition-colors",
                jalon?.statut === 'planning' && "border-primary bg-primary/5 ring-1 ring-primary/30"
              )}>
                <p className={cn("text-sm font-medium", jalon?.statut === 'planning' && "text-primary")}>{jalonDef.label}</p>
                <EditableSelectCell
                  value={jalon?.statut || ''}
                  options={STATUT_OPTIONS}
                  onSave={(v) => handleUpdate(jalonDef.value, 'statut', v)}
                />
                {jalon?.statut && (
                  <>
                    <StatusBadge status={(jalon.statut as JalonStatut)} />
                    <ParcoursDatePicker
                      value={jalon.date_jalon}
                      onSave={(v) => handleUpdate(jalonDef.value, 'date_jalon', v)}
                    />
                    <EditableCell
                      value={jalon.notes}
                      placeholder="Notes..."
                      className="text-xs"
                      multiline
                      onSave={(v) => handleUpdate(jalonDef.value, 'notes', v)}
                    />
                  </>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
