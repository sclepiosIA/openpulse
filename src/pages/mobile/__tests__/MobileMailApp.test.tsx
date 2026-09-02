import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'test@test.com' } }),
}))
vi.mock('@/contexts/EmailFiltersContext', () => ({
  EmailFiltersProvider: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}))
vi.mock('@/components/email/EmailInbox', () => ({
  EmailInbox: () => <div data-testid="inbox" />,
}))
vi.mock('@/components/email/EmailThread', () => ({
  EmailThread: () => <div />,
}))
vi.mock('@/components/email/EmailComposer', () => ({
  EmailComposer: () => <div />,
}))
vi.mock('@/hooks/email/useEmailSync', () => ({
  useEmailSync: () => ({
    syncNow: vi.fn(),
    isSyncing: false,
    getLastSyncDate: vi.fn(),
    fullSync: vi.fn(),
    reconcileEmails: vi.fn(),
  }),
}))

vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: () => ({ data: { id: 'p1' }, isLoading: false }),
}))
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        or: () => builder,
        order: () => Promise.resolve({ data: [], error: null }),
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
      }
      return builder
    },
  },
}))
vi.mock('@/components/pwa/AppInstallPrompt', () => ({ AppInstallPrompt: () => null }))
vi.mock('@/components/mobile/PWAMailHeader', () => ({ PWAMailHeader: () => <div /> }))
vi.mock('@/lib/supabase-helpers', () => ({
  queryViewWithFilter: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/lib/debug', () => ({ debug: { log: vi.fn(), error: vi.fn() } }))

import MobileMailApp from '../MobileMailApp'

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })

describe('MobileMailApp', () => {
  it('renders without crashing', async () => {
    const { container } = render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <MobileMailApp />
        </MemoryRouter>
      </QueryClientProvider>
    )
    expect(container.firstElementChild).toBeTruthy()
    expect(await screen.findByText('Aucun compte email')).toBeInTheDocument()
  })
})
