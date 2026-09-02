import { Settings, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ParametresTabsCompactProps {
  activeTab: string
  onTabChange: (tab: string) => void
  isAdmin: boolean
}

export function ParametresTabsCompact({
  activeTab,
  onTabChange,
  isAdmin,
}: ParametresTabsCompactProps) {
  const tabs = [
    { value: 'general', label: 'Général', icon: Settings },
    ...(isAdmin ? [{ value: 'admin', label: 'Admin', icon: Shield }] : []),
  ]

  return (
    <>
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = activeTab === tab.value
        return (
          <button
            key={tab.value}
            onClick={() => onTabChange(tab.value)}
            className={cn(
              'flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-medium whitespace-nowrap transition-all shrink-0',
              isActive
                ? 'bg-card text-primary shadow-md'
                : 'bg-card/10 text-white/70 hover:bg-card/20 border border-white/20'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        )
      })}
    </>
  )
}
