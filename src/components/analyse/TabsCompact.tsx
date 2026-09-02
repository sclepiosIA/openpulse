import { MapPin, BarChart3, Table2, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface TabsCompactProps {
  value: string
  onValueChange: (value: string) => void
}

const TABS = [
  { value: 'map', icon: MapPin, label: 'Carte' },
  { value: 'charts', icon: BarChart3, label: 'Graphiques' },
  { value: 'table', icon: Table2, label: 'Tableau' },
  { value: 'timeline', icon: Calendar, label: 'Timeline' },
]

export function TabsCompact({ value, onValueChange }: TabsCompactProps) {
  return (
    <div className="flex items-center gap-1 flex-nowrap">
      {TABS.map(({ value: tabValue, icon: Icon }) => {
        const isActive = value === tabValue

        return (
          <Button
            key={tabValue}
            variant="ghost"
            size="sm"
            onClick={() => onValueChange(tabValue)}
            className={cn(
              'h-6 w-6 p-0 rounded-lg shrink-0',
              'bg-card/10 backdrop-blur-sm border border-white/20 text-white/70',
              'hover:bg-card/20 hover:text-white',
              isActive && 'bg-card text-primary shadow-md border-white'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </Button>
        )
      })}
    </div>
  )
}
