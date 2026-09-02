import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => ({
          limit: () => Promise.resolve({ data: [], error: null }),
        }),
        eq: () => ({
          order: () => ({
            limit: () => Promise.resolve({ data: [], error: null, count: 0 }),
          }),
        }),
      }),
    }),
    functions: { invoke: vi.fn() },
  },
}))

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => ({
          limit: () => Promise.resolve({ data: [], error: null }),
        }),
        eq: () => ({
          order: () => ({
            limit: () => Promise.resolve({ data: [], error: null, count: 0 }),
          }),
        }),
      }),
    }),
    functions: { invoke: vi.fn() },
  },
}))

vi.mock('@/hooks/ui/use-mobile', () => ({
  useIsMobile: () => false,
}))

import { CronEmailMonitoringCard } from '../CronEmailMonitoringCard'
import { supabase } from '@/integrations/supabase/client'

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })

describe('CronEmailMonitoringCard', () => {
  it('renders card title', () => {
    render(
      <QueryClientProvider client={qc}>
        <CronEmailMonitoringCard />
      </QueryClientProvider>
    )
    expect(screen.getByText('CRON Email')).toBeInTheDocument()
  })

  it('renders description', () => {
    render(
      <QueryClientProvider client={qc}>
        <CronEmailMonitoringCard />
      </QueryClientProvider>
    )
    expect(screen.getByText(/Synchronisation et analyse IA/)).toBeInTheDocument()
  })
})
