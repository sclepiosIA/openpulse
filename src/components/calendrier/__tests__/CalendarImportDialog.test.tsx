import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CalendarImportDialog } from '../CalendarImportDialog'
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}))

vi.mock('@/hooks/calendar/useCalendars', () => ({
  useCalendars: () => ({ data: [{ id: 'cal1', name: 'Principal', is_default: true }] }),
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ data: [], error: null }),
      }),
    }),
    functions: { invoke: vi.fn() },
  },
}))

vi.mock('@/lib/debug', () => ({
  debug: { error: vi.fn(), log: vi.fn() },
}))

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })

describe('CalendarImportDialog', () => {
  it('renders nothing when closed', () => {
    render(
      <QueryClientProvider client={qc}>
        <CalendarImportDialog open={false} onOpenChange={vi.fn()} />
      </QueryClientProvider>
    )
    expect(screen.queryByText('Importer')).not.toBeInTheDocument()
  })

  it('renders dialog title when open', () => {
    render(
      <QueryClientProvider client={qc}>
        <CalendarImportDialog open={true} onOpenChange={vi.fn()} />
      </QueryClientProvider>
    )
    expect(screen.getByText('Importer un calendrier')).toBeInTheDocument()
  })

  it('renders file and subscription tabs', () => {
    render(
      <QueryClientProvider client={qc}>
        <CalendarImportDialog open={true} onOpenChange={vi.fn()} />
      </QueryClientProvider>
    )
    expect(screen.getByText('Import fichier')).toBeInTheDocument()
    expect(screen.getByText(/Abonnement URL/i)).toBeInTheDocument()
  })
})
