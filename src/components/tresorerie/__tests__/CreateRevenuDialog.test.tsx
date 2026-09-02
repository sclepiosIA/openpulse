import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CreateRevenuDialog } from '../CreateRevenuDialog'
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        in: () => ({
          order: () => Promise.resolve({ data: [{ id: 'e1', nom: 'CHU Test' }], error: null }),
        }),
      }),
    }),
  },
}))

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })

describe('CreateRevenuDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    onSubmit: vi.fn(),
    isCreating: false,
  }

  it('renders dialog title', () => {
    render(
      <QueryClientProvider client={qc}>
        <CreateRevenuDialog {...defaultProps} />
      </QueryClientProvider>
    )
    expect(screen.getByText('Nouveau revenu')).toBeInTheDocument()
  })

  it('renders month label', () => {
    render(
      <QueryClientProvider client={qc}>
        <CreateRevenuDialog {...defaultProps} />
      </QueryClientProvider>
    )
    // Le composant affiche un label "Mois *" pour la sélection du mois
    expect(screen.getByText(/^Mois/)).toBeInTheDocument()
  })

  it('renders montant input', () => {
    render(
      <QueryClientProvider client={qc}>
        <CreateRevenuDialog {...defaultProps} />
      </QueryClientProvider>
    )
    expect(screen.getByLabelText(/Montant prévu/)).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(
      <QueryClientProvider client={qc}>
        <CreateRevenuDialog {...defaultProps} open={false} />
      </QueryClientProvider>
    )
    expect(screen.queryByText('Nouveau revenu')).not.toBeInTheDocument()
  })
})
