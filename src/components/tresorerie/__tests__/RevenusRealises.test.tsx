import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RevenusRealises } from '../RevenusRealises'
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/hooks/tresorerie/useQontoCredits', () => ({
  useQontoCredits: () => ({
    credits: [
      {
        id: 'c1',
        date_operation: '2026-01-15',
        libelle: 'Facture CHU',
        montant: 5000,
        categorie_code: null,
      },
    ],
    isLoading: false,
    forecastRevenus: [],
    linkToForecast: vi.fn(),
    unlinkForecast: vi.fn(),
    updateCategorie: vi.fn(),
    isLinking: false,
  }),
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    }),
  },
}))

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })

describe('RevenusRealises', () => {
  const wrap = (ui: React.ReactElement) =>
    render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)

  it('renders title', () => {
    wrap(<RevenusRealises />)
    // Le titre affiché est "Virements reçus (N)" — peut apparaître plusieurs fois (KPI + titre)
    const elements = screen.getAllByText(/Virements reçus/i)
    expect(elements.length).toBeGreaterThanOrEqual(1)
  })

  it('renders search input', () => {
    wrap(<RevenusRealises />)
    expect(screen.getByPlaceholderText(/Rechercher/i)).toBeInTheDocument()
  })

  it('renders credit rows', () => {
    wrap(<RevenusRealises />)
    expect(screen.getByText('Facture CHU')).toBeInTheDocument()
  })
})
