import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProjetActionsMenu } from '../ProjetActionsMenu'

vi.mock('@/hooks/rd/useRD', () => ({
  useUpdateRDProjet: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteRDProjet: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRDEpics: () => ({ data: [] }),
  useRDUserStories: () => ({ data: [] }),
  useRDSprints: () => ({ data: [] }),
}))

vi.mock('@/hooks/profile/useProfiles', () => ({
  useProfiles: () => ({ data: [] }),
}))

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })

const projet = {
  id: 'p1',
  nom: 'Test Projet',
  description: 'Desc',
  statut: 'actif' as const,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
  created_by: 'u1',
  date_debut: '2026-01-01',
  date_fin_prevue: '2026-06-01',
  responsable_id: 'u1',
  couleur: '#6366f1',
  dpi: null,
  visible_portail: false,
}

describe('ProjetActionsMenu', () => {
  it('renders trigger button', () => {
    render(
      <QueryClientProvider client={qc}>
        <ProjetActionsMenu projet={projet} />
      </QueryClientProvider>
    )
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('opens menu on click', async () => {
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={qc}>
        <ProjetActionsMenu projet={projet} />
      </QueryClientProvider>
    )
    await user.click(screen.getByRole('button'))
    expect(await screen.findByText('Modifier le projet')).toBeInTheDocument()
    expect(screen.getByText('Exporter (JSON)')).toBeInTheDocument()
    expect(screen.getByText('Supprimer le projet')).toBeInTheDocument()
  })
})
