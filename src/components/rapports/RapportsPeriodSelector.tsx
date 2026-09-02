import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar as CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { PeriodPreset } from '@/hooks/analytics/useRapportsFilters'

interface RapportsPeriodSelectorProps {
  periodPreset: PeriodPreset
  onPeriodChange: (preset: PeriodPreset) => void
  customStartDate: Date
  customEndDate: Date
  onCustomStartDateChange: (date: Date) => void
  onCustomEndDateChange: (date: Date) => void
}

const PRESETS = [
  { value: '7d', label: '7j' },
  { value: '30d', label: '30j' },
  { value: '90d', label: '90j' },
  { value: '1y', label: '1 an' },
] as const

export function RapportsPeriodSelector({
  periodPreset,
  onPeriodChange,
  customStartDate,
  customEndDate,
  onCustomStartDateChange,
  onCustomEndDateChange,
}: RapportsPeriodSelectorProps) {
  return (
    <div className="flex items-center gap-1.5">
      {/* Glassmorphism period pills */}
      <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-card/5">
        {PRESETS.map((preset) => (
          <button
            key={preset.value}
            onClick={() => onPeriodChange(preset.value)}
            className={cn(
              'px-2.5 py-1 text-xs font-medium rounded-md transition-all',
              periodPreset === preset.value
                ? 'bg-card text-primary shadow-sm'
                : 'text-white/70 hover:text-white hover:bg-card/10'
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Custom date picker */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-7 px-2 gap-1 rounded-lg transition-all',
              periodPreset === 'custom'
                ? 'bg-card text-primary shadow-sm'
                : 'bg-card/10 backdrop-blur-sm border border-white/20 text-white/70 hover:text-white hover:bg-card/20'
            )}
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            {periodPreset === 'custom' ? (
              <span className="text-xs">
                {format(customStartDate, 'dd/MM', { locale: fr })} -{' '}
                {format(customEndDate, 'dd/MM', { locale: fr })}
              </span>
            ) : (
              <span className="text-xs hidden sm:inline">Perso.</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0 rounded-xl border-primary/10 shadow-lg bg-card/95 backdrop-blur-md"
          align="start"
        >
          <div className="p-4 space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Date de début</label>
              <Calendar
                mode="single"
                selected={customStartDate}
                onSelect={(date) => {
                  if (date) {
                    onCustomStartDateChange(date)
                    onPeriodChange('custom')
                  }
                }}
                locale={fr}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Date de fin</label>
              <Calendar
                mode="single"
                selected={customEndDate}
                onSelect={(date) => {
                  if (date) {
                    onCustomEndDateChange(date)
                    onPeriodChange('custom')
                  }
                }}
                locale={fr}
                disabled={(date) => date < customStartDate}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
