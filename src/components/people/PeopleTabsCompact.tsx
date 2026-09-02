import {
  BarChart3,
  Users,
  DollarSign,
  Calendar,
  CalendarCheck,
  Target,
  GraduationCap,
  ClipboardCheck,
  FileText,
  LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface PeopleTabsCompactProps {
  activeTab: string
  onTabChange: (tab: string) => void
  canViewSalaries?: boolean
}

interface TabItem {
  id: string
  label: string
  icon: LucideIcon
  requiresSalary?: boolean
}

const baseTabs: TabItem[] = [
  { id: 'analyses', label: 'Analyses', icon: BarChart3 },
  { id: 'equipe', label: 'Équipe', icon: Users },
  { id: 'salaires', label: 'Salaires', icon: DollarSign, requiresSalary: true },
  { id: 'planning', label: 'Planning', icon: Calendar },
  { id: 'conges', label: 'Congés', icon: CalendarCheck },
  { id: 'objectifs', label: 'Objectifs', icon: Target },
  { id: 'formations', label: 'Formations', icon: GraduationCap },
  { id: 'entretiens', label: 'Entretiens', icon: ClipboardCheck },
  { id: 'fiches', label: 'Dossiers RH', icon: FileText },
]

export function PeopleTabsCompact({
  activeTab,
  onTabChange,
  canViewSalaries = false,
}: PeopleTabsCompactProps) {
  // Filter tabs based on permissions
  const tabs = baseTabs.filter((tab) => !tab.requiresSalary || canViewSalaries)

  return (
    <div className="flex items-center gap-1">
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = activeTab === tab.id

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
          </button>
        )
      })}
    </div>
  )
}
