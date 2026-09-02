import type { ReactNode } from 'react'
import type { MonitorLogEntry } from '@/hooks/monitoring/useMonitorLogs'

interface LogTablePanelProps {
  summary: ReactNode
  logs: MonitorLogEntry[]
  isLoading: boolean
  totalCount: number
  hasMore: boolean
  onLoadMore: () => void
  onSelect: (log: MonitorLogEntry) => void
  isMobile: boolean
  LogTable: React.ComponentType<{
    logs: MonitorLogEntry[]
    isLoading: boolean
    totalCount: number
    hasMore: boolean
    onLoadMore: () => void
    onSelect: (log: MonitorLogEntry) => void
    isMobile: boolean
  }>
}

/**
 * Wrapper qui factorise la combinaison "Summary + LogTable" répétée
 * 6 fois dans MarqueMonitor (frontend/ai/api/email/feedback/security).
 * DEBT-02 micro-pas (2026-06-03).
 */
export function LogTablePanel({
  summary,
  logs,
  isLoading,
  totalCount,
  hasMore,
  onLoadMore,
  onSelect,
  isMobile,
  LogTable,
}: LogTablePanelProps) {
  return (
    <>
      {summary}
      <LogTable
        logs={logs}
        isLoading={isLoading}
        totalCount={totalCount}
        hasMore={hasMore}
        onLoadMore={onLoadMore}
        onSelect={onSelect}
        isMobile={isMobile}
      />
    </>
  )
}
