import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders as render } from '@/test-utils/renderWithProviders'
import { EmailFilterChips } from '../EmailFilterChips'

// Mock supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => ({
          limit: () => Promise.resolve({ data: [{ id: 'e1', nom: 'CHU Lyon' }] }),
        }),
      }),
    }),
  },
}))

const defaultFilters = {
  search: '',
  category: null,
  priority: null,
  unreadOnly: false,
  etablissementId: null,
}

describe('EmailFilterChips', () => {
  it('renders search input', () => {
    render(
      <EmailFilterChips
        filters={defaultFilters as any}
        onFilterChange={vi.fn()}
        onReset={vi.fn()}
      />
    )
    expect(screen.getByPlaceholderText('Rechercher dans les emails...')).toBeInTheDocument()
  })

  it('renders Tous and Non lus buttons', () => {
    render(
      <EmailFilterChips
        filters={defaultFilters as any}
        onFilterChange={vi.fn()}
        onReset={vi.fn()}
      />
    )
    expect(screen.getByText('Tous')).toBeInTheDocument()
    expect(screen.getByText('Non lus')).toBeInTheDocument()
  })

  it('renders category and priority filter buttons', () => {
    render(
      <EmailFilterChips
        filters={defaultFilters as any}
        onFilterChange={vi.fn()}
        onReset={vi.fn()}
      />
    )
    expect(screen.getByText('Catégorie')).toBeInTheDocument()
    expect(screen.getByText('Priorité')).toBeInTheDocument()
    expect(screen.getByText('Établissement')).toBeInTheDocument()
  })

  it('shows unread count in stats', () => {
    render(
      <EmailFilterChips
        filters={defaultFilters as any}
        onFilterChange={vi.fn()}
        onReset={vi.fn()}
        stats={{ unread: 5, total: 42 }}
      />
    )
    expect(screen.getByText('(42)')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('shows Effacer when filters active', () => {
    const filters = { ...defaultFilters, category: 'Commercial' }
    render(<EmailFilterChips filters={filters as any} onFilterChange={vi.fn()} onReset={vi.fn()} />)
    expect(screen.getByText('Effacer')).toBeInTheDocument()
  })

  it('calls onReset when Effacer clicked', () => {
    const onReset = vi.fn()
    const filters = { ...defaultFilters, category: 'Commercial' }
    render(<EmailFilterChips filters={filters as any} onFilterChange={vi.fn()} onReset={onReset} />)
    fireEvent.click(screen.getByText('Effacer'))
    expect(onReset).toHaveBeenCalled()
  })

  it('shows active filter chip for category', () => {
    const filters = { ...defaultFilters, category: 'Support' }
    render(<EmailFilterChips filters={filters as any} onFilterChange={vi.fn()} onReset={vi.fn()} />)
    expect(screen.getByText('Support')).toBeInTheDocument()
    expect(screen.getByText('Catégorie:')).toBeInTheDocument()
  })
})
