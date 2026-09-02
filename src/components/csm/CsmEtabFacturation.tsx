import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EditableCell } from '@/components/csm/EditableCell'
import { EditableSelectCell } from '@/components/csm/EditableSelectCell'
import { useCsmFacturation } from '@/hooks/csm/useCsmFacturation'
import { Receipt, CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format, parseISO, isValid } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

function FactDatePicker({ value, onSave }: { value?: string | null; onSave: (v: string) => void }) {
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
            "w-full justify-start text-sm h-8 px-2 font-normal",
            !selected && "text-muted-foreground italic"
          )}
        >
          <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
          {selected ? format(selected, 'dd/MM/yyyy', { locale: fr }) : 'Date...'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => {
            if (date) onSave(format(date, 'yyyy-MM-dd'))
            setOpen(false)
          }}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  )
}

const MODELE_OPTIONS = [
  { value: 'Statique', label: 'Statique' },
  { value: 'Succes +3', label: 'Succès +3' },
  { value: 'Succes +6', label: 'Succès +6' },
  { value: 'Succes +12', label: 'Succès +12' },
]

const FACTURATION_OPTIONS = [
  { value: 'OUI', label: 'OUI' },
  { value: 'NON - En cours', label: 'NON - En cours' },
  { value: 'NA', label: 'NA' },
]

const BADGE_STYLE: Record<string, string> = {
  'OUI': 'bg-emerald-100 text-emerald-700',
  'NON - En cours': 'bg-amber-100 text-amber-700',
  'NA': 'bg-gray-100 text-muted-foreground',
}

interface CsmEtabFacturationProps {
  etablissementId: string
}

export function CsmEtabFacturation({ etablissementId }: CsmEtabFacturationProps) {
  const { single: fact, upsert } = useCsmFacturation(etablissementId)

  const handleUpdate = (field: string, value: string) => {
    upsert({ ...(fact || {}), etablissement_id: etablissementId, [field]: value || null })
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="w-4 h-4" />
            Suivi facturation CSM
          </CardTitle>
          {fact?.facturation_effectuee && (
            <Badge className={cn("text-xs", BADGE_STYLE[fact.facturation_effectuee] || '')}>
              {fact.facturation_effectuee}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Modèle de facturation</p>
            <EditableSelectCell
              value={fact?.modele_facturation}
              options={MODELE_OPTIONS}
              onSave={(v) => handleUpdate('modele_facturation', v)}
            />
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Date déploiement</p>
            <FactDatePicker value={fact?.date_deploiement} onSave={(v) => handleUpdate('date_deploiement', v)} />
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Début période</p>
            <FactDatePicker value={fact?.date_debut_periode} onSave={(v) => handleUpdate('date_debut_periode', v)} />
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Fin période</p>
            <FactDatePicker value={fact?.date_fin_periode} onSave={(v) => handleUpdate('date_fin_periode', v)} />
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Dernière relance</p>
            <FactDatePicker value={fact?.derniere_relance} onSave={(v) => handleUpdate('derniere_relance', v)} />
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Facturation effectuée</p>
            <EditableSelectCell
              value={fact?.facturation_effectuee || 'NA'}
              options={FACTURATION_OPTIONS}
              onSave={(v) => handleUpdate('facturation_effectuee', v)}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-3 space-y-1">
            <p className="text-xs text-muted-foreground">Notes</p>
            <EditableCell value={fact?.notes} placeholder="Notes..." multiline onSave={(v) => handleUpdate('notes', v)} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
