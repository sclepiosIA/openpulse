import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/hooks/search/useGlobalSearch', () => ({
  useGlobalSearch: () => ({
    results: [],
    isSearching: false,
    search: vi.fn(),
    clearResults: vi.fn(),
  }),
}))
vi.mock('@/hooks/ui/use-mobile', () => ({
  useIsMobile: () => false,
}))
vi.mock('@/contexts/JarvisUnifiedContext', () => ({
  useJarvisUnified: () => ({ executeQuickAction: vi.fn() }),
  useJarvisUnifiedOptional: () => null,
}))

import { GlobalSearchDialog } from '../GlobalSearchDialog'

describe('GlobalSearchDialog', () => {
  it('renders trigger button by default', () => {
    const { container } = render(
      <MemoryRouter>
        <GlobalSearchDialog />
      </MemoryRouter>
    )
    expect(container.querySelector('button')).toBeTruthy()
  })
})
