import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('dompurify', () => ({
  default: { sanitize: (html: string) => html },
}))

vi.mock('@/hooks/pulse/usePulseSearch', () => ({
  usePulseSearch: () => ({
    results: [],
    total: 0,
    isSearching: false,
    hasSearched: false,
    search: vi.fn(),
    clearSearch: vi.fn(),
  }),
}))

import { SearchDialog } from '../SearchDialog'

describe('SearchDialog', () => {
  it('renders search dialog when open', () => {
    render(<SearchDialog open={true} onOpenChange={vi.fn()} />)
    expect(screen.getByText('Rechercher dans les messages')).toBeInTheDocument()
  })

  it('renders search input', () => {
    render(<SearchDialog open={true} onOpenChange={vi.fn()} />)
    expect(screen.getByPlaceholderText('Rechercher des messages...')).toBeInTheDocument()
  })

  it('renders nothing when closed', () => {
    const { container } = render(<SearchDialog open={false} onOpenChange={vi.fn()} />)
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })
})
