import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SupportTicketList } from '../SupportTicketList'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'test@test.com' } }),
}))

vi.mock('@/hooks/support/useSupportTickets', () => ({
  useSupportTickets: () => ({
    data: [
      {
        id: 't1',
        titre: 'Bug connexion',
        statut: 'nouveau',
        priorite: 'haute',
        type_probleme: 'bug',
        date_ouverture: new Date('2026-03-01T10:00:00Z').toISOString(),
        created_at: new Date('2026-03-01T10:00:00Z').toISOString(),
        etablissement: { nom: 'CHU Lyon' },
      },
    ],
    isLoading: false,
  }),
}))

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })

const wrap = (ui: React.ReactElement) =>
  render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)

describe('SupportTicketList', () => {
  it('renders ticket list title', () => {
    wrap(
      <SupportTicketList
        selectedTicketId={null}
        onSelectTicket={vi.fn()}
        onCreateTicket={vi.fn()}
      />
    )
    expect(screen.getByText('Tickets Support')).toBeInTheDocument()
  })

  it('renders search input', () => {
    wrap(
      <SupportTicketList
        selectedTicketId={null}
        onSelectTicket={vi.fn()}
        onCreateTicket={vi.fn()}
      />
    )
    expect(screen.getByPlaceholderText('Rechercher...')).toBeInTheDocument()
  })

  it('renders ticket item', () => {
    wrap(
      <SupportTicketList
        selectedTicketId={null}
        onSelectTicket={vi.fn()}
        onCreateTicket={vi.fn()}
      />
    )
    expect(screen.getByText('Bug connexion')).toBeInTheDocument()
  })

  it('renders etablissement name on ticket', () => {
    wrap(
      <SupportTicketList
        selectedTicketId={null}
        onSelectTicket={vi.fn()}
        onCreateTicket={vi.fn()}
      />
    )
    expect(screen.getByText('CHU Lyon')).toBeInTheDocument()
  })
})
