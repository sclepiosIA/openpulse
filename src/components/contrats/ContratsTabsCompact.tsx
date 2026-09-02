import { LayoutDashboard, FileSignature, AlertTriangle, FileStack, LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ContratsTabsCompactProps {
  activeTab: string
  onTabChange: (tab: string) => void
  badges?: Record<string, number | undefined>
}

interface TabItem {
  id: string
  label: string
  icon: LucideIcon
  color?: string
  badgeKey?: string
}

const tabs: TabItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'contrats', label: 'Contrats', icon: FileSignature },
  {
    id: 'alertes',
    label: 'Alertes',
    icon: AlertTriangle,
    color: 'text-amber-400',
    badgeKey: 'alertes',
  },
  { id: 'modeles', label: 'Modèles', icon: FileStack },
]

export function ContratsTabsCompact({
  activeTab,
  onTabChange,
  badges = {},
}: ContratsTabsCompactProps) {
  return (
    <div className="flex items-center gap-1">
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = activeTab === tab.id
        const badgeValue = tab.badgeKey ? badges[tab.badgeKey] : undefined
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'relative flex items-center gap-1 h-7 px-2 rounded-lg text-xs font-medium transition-all shrink-0',
              isActive
                ? 'bg-card text-primary shadow-md'
                : 'bg-card/10 backdrop-blur-sm border border-white/20 text-white/70 hover:bg-card/20 hover:text-white'
            )}
          >
            <Icon className={cn('h-3.5 w-3.5', !isActive && tab.color)} />
            <span className="hidden xs:inline">{tab.label}</span>
            {badgeValue && badgeValue > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center bg-amber-500 text-white">
                {badgeValue > 99 ? '99+' : badgeValue}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
