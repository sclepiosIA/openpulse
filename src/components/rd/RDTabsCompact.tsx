import { LayoutDashboard, List, Columns3, GanttChartSquare, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface RDTabsCompactProps {
  currentTab: string
  onTabChange: (tab: string) => void
}

const TAB_OPTIONS = [
  { value: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { value: 'backlog', icon: List, label: 'Backlog' },
  { value: 'kanban', icon: Columns3, label: 'Kanban' },
  { value: 'gantt', icon: GanttChartSquare, label: 'Gantt' },
  { value: 'analytics', icon: BarChart3, label: 'Analytics' },
]

export function RDTabsCompact({ currentTab, onTabChange }: RDTabsCompactProps) {
  return (
    <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-card/10 backdrop-blur-sm border border-white/20">
      {TAB_OPTIONS.map(({ value, icon: Icon, label }) => {
        const isActive = currentTab === value
        return (
          <Button
            key={value}
            variant="ghost"
            size="sm"
            onClick={() => onTabChange(value)}
            title={label}
            className={cn(
              'h-6 w-6 p-0 rounded-md transition-all',
              isActive
                ? 'bg-card text-primary shadow-md'
                : 'text-white/70 hover:bg-card/20 hover:text-white'
            )}
          >
            <Icon className="h-3 w-3" />
          </Button>
        )
      })}
    </div>
  )
}
