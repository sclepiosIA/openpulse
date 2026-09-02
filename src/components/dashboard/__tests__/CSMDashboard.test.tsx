import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/hooks/crm/useProspects', () => ({
  useAllEtablissements: () => ({ data: [] }),
  useCsmDashboardEtablissements: () => ({ data: [], isLoading: false }),
}))

vi.mock('@/hooks/tasks/useTaches', () => ({
  useTaches: () => ({ data: [] }),
  useDashboardTaskSummaries: () => ({ data: [] }),
}))

vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: () => ({ data: { id: 'u1', prenom: 'Jean', nom: 'Dupont' } }),
}))

vi.mock('@/hooks/analytics/useNPSStats', () => ({
  useNPSStats: () => ({ data: null, isLoading: false }),
}))

vi.mock('@/hooks/dashboard/useDashboardLayout', () => ({
  useDashboardLayout: () => ({
    isEditMode: false,
    isSaving: false,
    startEdit: vi.fn(),
    cancelEdit: vi.fn(),
    saveLayout: vi.fn(),
    resetToDefault: vi.fn(),
    openWidgetSelector: vi.fn(),
    applyTemplate: vi.fn(),
  }),
  DASHBOARD_TEMPLATES: {},
}))

vi.mock('@/components/dashboard/TasksActionPanel', () => ({
  TasksActionPanel: () => <div data-testid="tasks-panel" />,
}))

vi.mock('@/components/dashboard/PortfolioHealthCard', () => ({
  PortfolioHealthCard: () => <div data-testid="portfolio-health" />,
}))

vi.mock('@/components/dashboard/AgendaWidget', () => ({
  AgendaWidget: () => <div data-testid="agenda-widget" />,
}))

vi.mock('@/components/dashboard/PulseWidget', () => ({
  PulseWidget: () => <div data-testid="pulse-widget" />,
}))

vi.mock('@/components/dashboard/EmailInboxWidget', () => ({
  default: () => <div data-testid="email-widget" />,
  EmailInboxWidget: () => <div data-testid="email-widget" />,
}))

vi.mock('@/components/dashboard/NotesWidget', () => ({
  NotesWidget: () => <div data-testid="notes-widget" />,
}))

vi.mock('@/components/dashboard/DashboardWidgetGrid', () => ({
  DashboardWidgetGrid: () => <div data-testid="widget-grid" />,
}))

vi.mock('@/components/dashboard/DashboardCustomizeButton', () => ({
  DashboardCustomizeButton: () => null,
}))

vi.mock('@/components/layout/UnifiedPageHeader', () => ({
  UnifiedPageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}))

vi.mock('@/components/email/EmailUnreadBadge', () => ({
  EmailUnreadBadge: () => null,
}))

vi.mock('@/components/NotificationBadge', () => ({
  NotificationBadge: () => null,
}))

vi.mock('@/components/dashboard/EmailIntelligenceHub', () => ({
  default: () => null,
}))

import { CSMDashboard } from '../CSMDashboard'

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })

describe('CSMDashboard', () => {
  it('renders dashboard title', () => {
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <CSMDashboard />
        </MemoryRouter>
      </QueryClientProvider>
    )
    expect(screen.getByText('CSM - Tableau de bord')).toBeInTheDocument()
  })
})
