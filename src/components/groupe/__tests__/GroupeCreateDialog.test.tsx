import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}))

vi.mock('@/hooks/crm/useGroupes', () => ({
  useCreateGroupe: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

vi.mock('@/hooks/profile/useProfilesWithRoles', () => ({
  useActiveProfilesWithRoles: () => ({ data: [] }),
}))

vi.mock('@/lib/debug', () => ({ debug: { log: vi.fn(), error: vi.fn() } }))

vi.mock('@/components/ui/LogoUploadField', () => ({
  LogoUploadField: () => <div data-testid="logo-upload" />,
}))

import { GroupeCreateDialog } from '../GroupeCreateDialog'

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })

describe('GroupeCreateDialog', () => {
  it('renders dialog when open', () => {
    render(
      <QueryClientProvider client={qc}>
        <GroupeCreateDialog open={true} onOpenChange={vi.fn()} />
      </QueryClientProvider>
    )
    expect(screen.getByText('Créer un nouveau groupe')).toBeInTheDocument()
  })

  it('renders form fields', () => {
    render(
      <QueryClientProvider client={qc}>
        <GroupeCreateDialog open={true} onOpenChange={vi.fn()} />
      </QueryClientProvider>
    )
    // Le label HTML contient "Nom du groupe *" (avec l'astérisque)
    expect(screen.getByText(/Nom du groupe/)).toBeInTheDocument()
  })

  it('renders nothing when closed', () => {
    const { container } = render(
      <QueryClientProvider client={qc}>
        <GroupeCreateDialog open={false} onOpenChange={vi.fn()} />
      </QueryClientProvider>
    )
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })
})
