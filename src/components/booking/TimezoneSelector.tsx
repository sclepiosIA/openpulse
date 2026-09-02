import { useMemo } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Globe } from 'lucide-react'

const COMMON_TIMEZONES = [
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)', offset: '+01:00' },
  { value: 'Europe/London', label: 'Londres (GMT/BST)', offset: '+00:00' },
  { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)', offset: '+01:00' },
  { value: 'Europe/Brussels', label: 'Bruxelles (CET/CEST)', offset: '+01:00' },
  { value: 'Europe/Zurich', label: 'Zurich (CET/CEST)', offset: '+01:00' },
  { value: 'America/New_York', label: 'New York (EST/EDT)', offset: '-05:00' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)', offset: '-08:00' },
  { value: 'America/Chicago', label: 'Chicago (CST/CDT)', offset: '-06:00' },
  { value: 'America/Toronto', label: 'Toronto (EST/EDT)', offset: '-05:00' },
  { value: 'America/Montreal', label: 'Montréal (EST/EDT)', offset: '-05:00' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)', offset: '+09:00' },
  { value: 'Asia/Singapore', label: 'Singapour (SGT)', offset: '+08:00' },
  { value: 'Asia/Dubai', label: 'Dubaï (GST)', offset: '+04:00' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)', offset: '+10:00' },
  { value: 'Pacific/Auckland', label: 'Auckland (NZST/NZDT)', offset: '+12:00' },
]

interface TimezoneSelectorProps {
  value: string
  onChange: (timezone: string) => void
  className?: string
  compact?: boolean
}

export function TimezoneSelector({
  value,
  onChange,
  className,
  compact = false,
}: TimezoneSelectorProps) {
  const detectedTimezone = useMemo(() => {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  }, [])

  const currentTimezone = COMMON_TIMEZONES.find((tz) => tz.value === value)
  const displayLabel = currentTimezone?.label || value.replace('_', ' ').split('/').pop()

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className}>
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          {compact ? (
            <span className="text-sm">{displayLabel}</span>
          ) : (
            <SelectValue placeholder="Sélectionner un fuseau horaire" />
          )}
        </div>
      </SelectTrigger>
      <SelectContent>
        {detectedTimezone && !COMMON_TIMEZONES.find((tz) => tz.value === detectedTimezone) && (
          <SelectItem value={detectedTimezone} className="font-medium">
            <div className="flex items-center gap-2">
              <span>🌍</span>
              <span>{detectedTimezone.replace('_', ' ')} (Détecté)</span>
            </div>
          </SelectItem>
        )}
        {COMMON_TIMEZONES.map((tz) => (
          <SelectItem key={tz.value} value={tz.value}>
            <div className="flex items-center justify-between w-full">
              <span>{tz.label}</span>
              {tz.value === detectedTimezone && (
                <span className="ml-2 text-xs text-muted-foreground">(Détecté)</span>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function getDetectedTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}
