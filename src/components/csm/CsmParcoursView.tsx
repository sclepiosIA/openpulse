import { useMemo, useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { StatusBadge } from '@/components/csm/StatusBadge'
import { EditableSelectCell } from '@/components/csm/EditableSelectCell'
import { useCsmParcours } from '@/hooks/csm/useCsmParcours'
import { useProduction } from '@/hooks/production/useProduction'
import { JALON_TYPES, type JalonType, type JalonStatut } from '@/types/csm'
import { CalendarIcon } from 'lucide-react'
import { format, parseISO, isValid } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

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

const STATUT_OPTIONS = [
  { value: '', label: '-' },
  { value: 'done', label: 'Fait' },
  { value: 'planned', label: 'Planifié' },
  { value: 'planning', label: 'En cours de planification' },
  { value: 'pending', label: 'En attente' },
  { value: 'skipped', label: 'Non réalisé' },
]

export function CsmParcoursView() {
  const { data: etablissements } = useProduction()
  const { data: jalons, upsert } = useCsmParcours()

  const jalonsMap = useMemo(() => {
    const map = new Map<string, Map<string, typeof jalons[0]>>()
    jalons.forEach(j => {
      if (!map.has(j.etablissement_id)) map.set(j.etablissement_id, new Map())
      map.get(j.etablissement_id)!.set(j.jalon_type, j)
    })
    return map
  }, [jalons])

  const handleUpdate = (etablissementId: string, jalonType: JalonType, field: string, value: string) => {
    const existing = jalonsMap.get(etablissementId)?.get(jalonType)
    upsert({
      ...(existing || {}),
      etablissement_id: etablissementId,
      jalon_type: jalonType,
      [field]: value || null,
    })
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="min-w-[180px] sticky left-0 bg-muted/50 z-10">Compte</TableHead>
            {JALON_TYPES.map(j => (
              <TableHead key={j.value} className="min-w-[140px] text-center">{j.label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {(etablissements || []).map(etab => (
            <TableRow key={etab.id} className="hover:bg-muted/30">
              <TableCell className="font-medium text-sm sticky left-0 bg-background z-10">{etab.nom}</TableCell>
              {JALON_TYPES.map(jalonDef => {
                const jalon = jalonsMap.get(etab.id)?.get(jalonDef.value)
                return (
                  <TableCell key={jalonDef.value} className="text-center">
                    <div className="space-y-1">
                      <EditableSelectCell
                        value={jalon?.statut || ''}
                        options={STATUT_OPTIONS}
                        onSave={(v) => handleUpdate(etab.id, jalonDef.value, 'statut', v)}
                      />
                      {jalon?.statut && (
                        <>
                          <StatusBadge status={(jalon.statut as JalonStatut) || ''} />
                          <ParcoursDatePicker
                            value={jalon.date_jalon}
                            onSave={(v) => handleUpdate(etab.id, jalonDef.value, 'date_jalon', v)}
                          />
                        </>
                      )}
                    </div>
                  </TableCell>
                )
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
