import { Search, User } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { MonitorPeriod, MonitorSeverity, MonitorSource } from '@/hooks/monitoring/useMonitorLogs'

interface MonitorFiltersProps {
  searchTerm: string
  onSearchChange: (value: string) => void
  period: MonitorPeriod
  onPeriodChange: (value: MonitorPeriod) => void
  severityFilter: MonitorSeverity
  onSeverityChange: (value: MonitorSeverity) => void
  userFilter: string
  onUserFilterChange: (value: string) => void
  sourceFilter: MonitorSource | 'all'
  onSourceFilterChange: (value: MonitorSource | 'all') => void
  activeTab: string
  uniqueUsers: { id: string; label: string }[]
  isMobile: boolean
}

/**
 * Barre de filtres pour OpenPulse Monitor.
 * Extrait de MarqueMonitor.tsx — DEBT-02 (2026-06-03).
 */
export function MonitorFilters({
  searchTerm,
  onSearchChange,
  period,
  onPeriodChange,
  severityFilter,
  onSeverityChange,
  userFilter,
  onUserFilterChange,
  sourceFilter,
  onSourceFilterChange,
  activeTab,
  uniqueUsers,
  isMobile,
}: MonitorFiltersProps) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className={cn('flex gap-2 flex-wrap', isMobile && 'flex-col')}>
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher message, type, email..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={period}
            onValueChange={(v) => onPeriodChange(v as MonitorPeriod)}
          >
            <SelectTrigger className="w-full sm:w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">24 heures</SelectItem>
              <SelectItem value="7d">7 jours</SelectItem>
              <SelectItem value="30d">30 jours</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={severityFilter}
            onValueChange={(v) => onSeverityChange(v as MonitorSeverity)}
          >
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes sévérités</SelectItem>
              <SelectItem value="critical">Critique</SelectItem>
              <SelectItem value="error">Erreur</SelectItem>
              <SelectItem value="warning">Avertissement</SelectItem>
              <SelectItem value="info">Info</SelectItem>
            </SelectContent>
          </Select>
          <Select value={userFilter} onValueChange={onUserFilterChange}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <div className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue placeholder="Utilisateur" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les utilisateurs</SelectItem>
              {uniqueUsers.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.label.length > 25 ? u.label.slice(0, 22) + '...' : u.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {activeTab === 'global' && (
            <Select
              value={sourceFilter}
              onValueChange={(v) => onSourceFilterChange(v as MonitorSource | 'all')}
            >
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes sources</SelectItem>
                <SelectItem value="frontend">Frontend</SelectItem>
                <SelectItem value="ai">IA</SelectItem>
                <SelectItem value="email_sync">Email</SelectItem>
                <SelectItem value="api">API</SelectItem>
                <SelectItem value="security">Sécurité</SelectItem>
                <SelectItem value="feedback">Feedback</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
