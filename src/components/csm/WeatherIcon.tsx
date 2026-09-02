import { Sun, CloudSun, Cloud, CloudRain, CloudLightning, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WeatherType } from '@/types/csm'

const WEATHER_CONFIG: Record<WeatherType, { icon: typeof Sun; label: string; colorClass: string; bgClass: string }> = {
  sunny: { icon: Sun, label: 'Bon', colorClass: 'text-emerald-500', bgClass: 'bg-emerald-50' },
  'partly-cloudy': { icon: CloudSun, label: 'Correct', colorClass: 'text-amber-500', bgClass: 'bg-amber-50' },
  cloudy: { icon: Cloud, label: 'À surveiller', colorClass: 'text-muted-foreground', bgClass: 'bg-gray-100' },
  rainy: { icon: CloudRain, label: 'Préoccupant', colorClass: 'text-red-500', bgClass: 'bg-red-50' },
  stormy: { icon: CloudLightning, label: 'Critique', colorClass: 'text-red-700', bgClass: 'bg-red-100' },
  'not-started': { icon: Clock, label: 'Pas déployé', colorClass: 'text-blue-500', bgClass: 'bg-blue-50' },
}

interface WeatherIconProps {
  weather: WeatherType
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
}

export function WeatherIcon({ weather, size = 'md', showLabel = false, className }: WeatherIconProps) {
  const config = WEATHER_CONFIG[weather] || WEATHER_CONFIG['not-started']
  const Icon = config.icon
  const sizeMap = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' }

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div className={cn("rounded-full p-1.5", config.bgClass)}>
        <Icon className={cn(sizeMap[size], config.colorClass)} />
      </div>
      {showLabel && <span className={cn("text-sm font-medium", config.colorClass)}>{config.label}</span>}
    </div>
  )
}

export function WeatherLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      {Object.entries(WEATHER_CONFIG).map(([key, config]) => {
        const Icon = config.icon
        return (
          <div key={key} className="flex items-center gap-1">
            <Icon className={cn("w-4 h-4", config.colorClass)} />
            <span className="text-muted-foreground">{config.label}</span>
          </div>
        )
      })}
    </div>
  )
}

export { WEATHER_CONFIG }
