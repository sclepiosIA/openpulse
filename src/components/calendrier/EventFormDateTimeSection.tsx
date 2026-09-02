import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { CalendarIcon, Clock, Repeat } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface TimeOption {
  value: string
  label: string
}

interface Props {
  startDate: Date
  setStartDate: (d: Date) => void
  startTime: string
  setStartTime: (t: string) => void
  endDate: Date
  setEndDate: (d: Date) => void
  endTime: string
  setEndTime: (t: string) => void
  allDay: boolean
  setAllDay: (v: boolean) => void
  isRecurring: boolean
  setIsRecurring: (v: boolean) => void
  recurrenceRule: string
  setRecurrenceRule: (v: string) => void
  durationLabel: string
  timeOptions: TimeOption[]
}

export function EventFormDateTimeSection({
  startDate,
  setStartDate,
  startTime,
  setStartTime,
  endDate,
  setEndDate,
  endTime,
  setEndTime,
  allDay,
  setAllDay,
  isRecurring,
  setIsRecurring,
  recurrenceRule,
  setRecurrenceRule,
  durationLabel,
  timeOptions,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <CalendarIcon className="h-4 w-4 text-primary" />
          Date et heure
          <span className="text-xs text-muted-foreground font-normal">· {durationLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={allDay} onCheckedChange={setAllDay} id="all-day" />
          <Label htmlFor="all-day" className="text-xs text-muted-foreground cursor-pointer">
            Journée entière
          </Label>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-2 items-center">
        {/* Start */}
        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="flex-1 justify-start font-normal min-h-0 h-10">
                <CalendarIcon className="h-4 w-4 mr-2 shrink-0 text-muted-foreground" />
                {format(startDate, 'd MMM', { locale: fr })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={(date) => date && setStartDate(date)}
                locale={fr}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          {!allDay && (
            <div className="relative w-[110px] shrink-0">
              <Clock className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                type="time"
                list="time-options-start"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="pl-7 h-10"
              />
              <datalist id="time-options-start">
                {timeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </datalist>
            </div>
          )}
        </div>

        <span className="hidden sm:inline text-muted-foreground text-sm px-1">→</span>

        {/* End */}
        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="flex-1 justify-start font-normal min-h-0 h-10">
                <CalendarIcon className="h-4 w-4 mr-2 shrink-0 text-muted-foreground" />
                {format(endDate, 'd MMM', { locale: fr })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={(date) => date && setEndDate(date)}
                locale={fr}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          {!allDay && (
            <div className="relative w-[110px] shrink-0">
              <Clock className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                type="time"
                list="time-options-end"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="pl-7 h-10"
              />
              <datalist id="time-options-end">
                {timeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </datalist>
            </div>
          )}
        </div>
      </div>

      {/* Recurrence */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Switch checked={isRecurring} onCheckedChange={setIsRecurring} id="recurring" />
          <Label htmlFor="recurring" className="flex items-center gap-1.5 text-sm cursor-pointer">
            <Repeat className="h-4 w-4 text-muted-foreground" />
            Récurrent
          </Label>
        </div>
        {isRecurring && (
          <Select value={recurrenceRule} onValueChange={setRecurrenceRule}>
            <SelectTrigger className="flex-1 min-w-[200px]">
              <SelectValue placeholder="Fréquence" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="FREQ=DAILY">Tous les jours</SelectItem>
              <SelectItem value="FREQ=WEEKLY">Toutes les semaines</SelectItem>
              <SelectItem value="FREQ=WEEKLY;INTERVAL=2">Toutes les 2 semaines</SelectItem>
              <SelectItem value="FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR">Jours ouvrés</SelectItem>
              <SelectItem value="FREQ=WEEKLY;BYDAY=SA,SU">Tous les week-ends</SelectItem>
              <SelectItem value="FREQ=WEEKLY;BYDAY=SA,SU;INTERVAL=2">Week-ends 1 sem./2</SelectItem>
              <SelectItem value="FREQ=MONTHLY">Tous les mois</SelectItem>
              <SelectItem value="FREQ=MONTHLY;INTERVAL=3">Tous les trimestres</SelectItem>
              <SelectItem value="FREQ=YEARLY">Tous les ans</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  )
}
