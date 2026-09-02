import {
  LayoutDashboard,
  CalendarClock,
  FileText,
  FileCheck,
  Landmark,
  Package,
  LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface FacturationTabsCompactProps {
  activeTab: string
  onTabChange: (tab: string) => void
  badges?: Record<string, number | undefined>
}

interface TabItem {
  id: string
  label: string
  icon: LucideIcon
  badgeKey?: string
}

const tabs: TabItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'echeances', label: 'Échéances', icon: CalendarClock },
  { id: 'devis', label: 'Devis', icon: FileText, badgeKey: 'devisEnAttente' },
  { id: 'factures', label: 'Factures', icon: FileCheck, badgeKey: 'facturesEnRetard' },
  { id: 'banque', label: 'Banque', icon: Landmark },
  { id: 'catalogue', label: 'Catalogue', icon: Package },
]

export function FacturationTabsCompact({
  activeTab,
  onTabChange,
  badges = {},
}: FacturationTabsCompactProps) {
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
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden xs:inline">{tab.label}</span>
            {badgeValue != null && badgeValue > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center bg-destructive text-destructive-foreground">
                {badgeValue > 99 ? '99+' : badgeValue}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
