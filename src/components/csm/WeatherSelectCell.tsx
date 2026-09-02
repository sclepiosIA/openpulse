import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { WEATHER_CONFIG, WeatherIcon } from '@/components/csm/WeatherIcon'
import type { WeatherType } from '@/types/csm'

interface WeatherSelectCellProps {
  value: WeatherType
  onSave: (value: string) => void
}

export function WeatherSelectCell({ value, onSave }: WeatherSelectCellProps) {
  return (
    <Select value={value} onValueChange={onSave}>
      <SelectTrigger className="h-8 w-auto min-w-[140px] border-0 bg-transparent hover:bg-muted/50 focus:ring-1 focus:ring-primary text-sm px-2 gap-1.5">
        <SelectValue>
          <WeatherIcon weather={value} size="sm" showLabel />
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(WEATHER_CONFIG) as WeatherType[]).map((key) => (
          <SelectItem key={key} value={key}>
            <div className="flex items-center gap-2">
              <WeatherIcon weather={key} size="sm" showLabel />
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
