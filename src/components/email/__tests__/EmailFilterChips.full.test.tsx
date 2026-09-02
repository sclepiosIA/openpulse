import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders as render } from '@/test-utils/renderWithProviders'
import { EmailFilterChips } from '../EmailFilterChips'

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }),
      }),
    }),
  },
}))

const baseFilters = {
  search: '',
  category: '',
  priority: '',
  unreadOnly: false,
  unprocessedOnly: false,
  hasAttachments: false,
  isStarred: false,
  tags: [] as string[],
  etablissementId: '',
  dateRange: undefined,
  groupeId: '',
  dateFrom: undefined as any,
  dateTo: undefined as any,
  partenaireId: '',
  mailbox: '',
} as any

describe('EmailFilterChips', () => {
  it('renders category chip when set', () => {
    render(
      <EmailFilterChips
        filters={{ ...baseFilters, category: 'Commercial' }}
        onFilterChange={vi.fn()}
        onReset={vi.fn()}
      />
    )
    expect(screen.getByText('Commercial')).toBeInTheDocument()
  })

  it('renders unread chip', () => {
    render(
      <EmailFilterChips
        filters={{ ...baseFilters, unreadOnly: true }}
        onFilterChange={vi.fn()}
        onReset={vi.fn()}
      />
    )
    expect(screen.getByText('Non lus')).toBeInTheDocument()
  })

  it('renders priority chip', () => {
    render(
      <EmailFilterChips
        filters={{ ...baseFilters, priority: 'high' }}
        onFilterChange={vi.fn()}
        onReset={vi.fn()}
      />
    )
    expect(screen.getByText('Haute')).toBeInTheDocument()
  })

  it('renders category filter button', () => {
    render(
      <EmailFilterChips
        filters={{ ...baseFilters, category: 'Support' }}
        onFilterChange={vi.fn()}
        onReset={vi.fn()}
      />
    )
    expect(screen.getByText('Catégorie')).toBeInTheDocument()
  })
})
