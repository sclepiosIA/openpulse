import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// AuthProvider mock — hook uses useAuth() internally.
vi.mock('@/components/AuthProvider', () => ({
  AuthProvider: ({ children }: { children: any }) => children,
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'test@test.com' },
    session: { access_token: 'mock-token' },
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
  useAuthSafe: () => ({
    user: { id: 'test-user-id', email: 'test@test.com' },
    session: { access_token: 'mock-token' },
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
}))

vi.mock('@/hooks/monitoring/useMonitorLogs', () => ({
  useMonitorLogs: () =>
    new Proxy(
      {},
      {
        get: (_t: any, prop: string) => {
          if (
            [
              'filteredLogs',
              'chartData',
              'uniqueUsers',
              'errorInfos',
              'recurringPatterns',
              'frontendErrors',
              'aiErrors',
              'apiErrors',
              'emailSyncErrors',
              'securityLogs',
              'feedbacks',
            ].includes(prop)
          )
            return []
          if (prop === 'displayCount') return 50
          if (prop === 'stats') return { total: 0, bySource: {}, bySeverity: {} }
          if (prop === 'isLoading' || prop === 'hasError') return false
          if (prop === 'kpis')
            return {
              errors24h: 0,
              aiSuccessRate: 100,
              syncErrors: 0,
              feedbackBugs: 0,
              securityAlerts: 0,
              frontendErrors: 0,
              apiErrors: 0,
            }
          if (prop === 'period' || prop === 'severityFilter') return 'all'
          if (prop === 'activeTab') return 'global'
          if (prop === 'searchTerm' || prop === 'userFilter') return ''
          if (prop === 'sourceFilter') return 'all'
          if (prop === 'lastUpdatedAt') return Date.now()
          if (prop === 'allLogs') return []
          if (typeof prop === 'string' && prop.startsWith('set')) return () => {}
          if (prop === 'retryAll' || prop === 'loadMore') return () => {}
          return vi.fn()
        },
      }
    ),
}))
vi.mock('@/hooks/ai/useAIUsageStats', () => ({
  getProcessingTypeLabel: (t: string) => t,
}))
vi.mock('@/hooks/ui/use-mobile', () => ({ useIsMobile: () => false }))

import MarqueMonitor from '../MarqueMonitor'

describe('MarqueMonitor page', () => {
  const renderWith = (ui: React.ReactNode) => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>{ui}</MemoryRouter>
      </QueryClientProvider>
    )
  }

  it('renders without crashing', () => {
    const { container } = renderWith(<MarqueMonitor />)
    expect(container.firstElementChild).toBeTruthy()
  })

  it('shows operational state when no logs', () => {
    renderWith(<MarqueMonitor />)
    expect(screen.getByText('Système opérationnel')).toBeTruthy()
  })
})
