import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ user: { id: '1', email: 'test@test.com' }, loading: false }),
}))
vi.mock('@/contexts/EmailContext', () => ({
  EmailProvider: ({ children }: any) => <div>{children}</div>,
}))
vi.mock('@/hooks/email/useEmailNavigation', () => ({
  useEmailNavigation: () => ({
    selectedThreadId: null,
    setSelectedThreadId: vi.fn(),
    isComposing: false,
    setIsComposing: vi.fn(),
    currentView: 'inbox',
    setCurrentView: vi.fn(),
    currentFolder: 'inbox',
    setCurrentFolder: vi.fn(),
  }),
}))
vi.mock('@/hooks/email/useEmailThreadActions', () => ({
  useEmailThreadActions: () => ({
    handleArchive: vi.fn(),
    handleDelete: vi.fn(),
    handleMarkAsRead: vi.fn(),
  }),
}))
vi.mock('@/hooks/shared/useNavigationHistory', () => ({
  useNavigationHistory: () => ({ history: [], push: vi.fn(), back: vi.fn() }),
}))
vi.mock('@/hooks/shared/useVirtualBreadcrumb', () => ({
  useVirtualBreadcrumb: () => {},
}))
vi.mock('@/hooks/ui/useTabBreadcrumb', () => ({
  useTabBreadcrumb: () => {},
}))
vi.mock('@/components/email/EmailInbox', () => ({
  EmailInbox: () => <div data-testid="email-inbox">Inbox</div>,
}))
vi.mock('@/components/email/EmailThread', () => ({ EmailThread: () => null }))
vi.mock('@/components/email/EmailComposer', () => ({ EmailComposer: () => null }))
vi.mock('@/components/email/EmailDrafts', () => ({ EmailDrafts: () => null }))
vi.mock('@/components/email/EmailsByEtablissementView', () => ({
  EmailsByEtablissementView: () => null,
}))
vi.mock('@/components/email/EmailClassificationDashboard', () => ({
  EmailClassificationDashboard: () => null,
}))
vi.mock('@/components/email/EmailSettingsSections', () => ({ EmailSettingsSections: () => null }))
vi.mock('@/components/email/CalendarInvitationSuggestions', () => ({
  CalendarInvitationSuggestions: () => null,
}))
vi.mock('@/components/email/MobileEmailNavigation', () => ({ MobileEmailNavigation: () => null }))
vi.mock('@/components/email/MobileEmailHeader', () => ({ MobileEmailHeader: () => null }))
vi.mock('@/components/email/EmailMasterDetail', () => ({
  EmailMasterDetail: () => <div data-testid="email-master-detail">MasterDetail</div>,
}))
vi.mock('@/components/layout/ImmersivePageHeader', () => ({
  ImmersivePageHeader: ({ title }: any) => <h1>{title}</h1>,
}))
vi.mock('@/components/search/GlobalSearchDialog', () => ({ GlobalSearchDialog: () => null }))
vi.mock('@/hooks/ui/use-mobile', () => ({ useIsMobile: () => false }))
vi.mock('@/lib/debug', () => ({ debug: { log: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import Emails from '../Emails'

const createWrapper = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('Emails Page', () => {
  it('renders without crashing', async () => {
    render(<Emails />, { wrapper: createWrapper() })
    await waitFor(() => {
      expect(screen.getByText('Messagerie')).toBeInTheDocument()
    })
  })
})
