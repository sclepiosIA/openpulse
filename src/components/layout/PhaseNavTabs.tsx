import { useNavigate } from 'react-router-dom'
import { Target, Rocket, Factory } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type PhaseKey } from '@/config/phases'

interface PhaseTab {
  key: PhaseKey
  label: string
  shortLabel: string
  icon: typeof Target
  route: string
}

const PHASE_TABS: PhaseTab[] = [
  {
    key: 'commercial',
    label: 'Prospects',
    shortLabel: 'Prosp.',
    icon: Target,
    route: '/prospects',
  },
  {
    key: 'deploiement',
    label: 'Déploiement',
    shortLabel: 'Dépl.',
    icon: Rocket,
    route: '/deploiement',
  },
  {
    key: 'production',
    label: 'Production',
    shortLabel: 'Prod.',
    icon: Factory,
    route: '/production',
  },
]

interface PhaseNavTabsProps {
  activePhase: PhaseKey
  counts?: { commercial: number; deploiement: number; production: number }
  compact?: boolean
}

export function PhaseNavTabs({ activePhase, counts, compact = false }: PhaseNavTabsProps) {
  const navigate = useNavigate()

  return (
    <div className={cn('flex items-center rounded-xl p-0.5', compact ? 'gap-0.5' : 'gap-1')}>
      {PHASE_TABS.map((tab) => {
        const isActive = tab.key === activePhase
        const Icon = tab.icon
        const count = counts?.[tab.key]

        return (
          <button
            key={tab.key}
            onClick={() => {
              if (!isActive) navigate(tab.route)
            }}
            className={cn(
              'flex items-center gap-1.5 rounded-lg font-medium transition-all duration-200',
              compact ? 'px-2 py-1.5 text-[11px]' : 'px-3 py-2 text-xs',
              isActive
                ? 'bg-card text-primary shadow-md'
                : 'bg-card/10 backdrop-blur-sm border border-white/20 text-white/70 hover:bg-card/20 hover:text-white'
            )}
          >
            <Icon className={cn(compact ? 'h-3 w-3' : 'h-3.5 w-3.5', 'shrink-0')} />
            <span className={cn(compact ? 'hidden xs:inline' : 'hidden sm:inline')}>
              {compact ? tab.shortLabel : tab.label}
            </span>
            {count !== undefined && (
              <span
                className={cn(
                  'rounded-full font-semibold tabular-nums',
                  compact ? 'text-[9px] px-1' : 'text-[10px] px-1.5 py-0.5',
                  isActive ? 'bg-primary/10 text-primary' : 'bg-card/15 text-white/80'
                )}
              >
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
