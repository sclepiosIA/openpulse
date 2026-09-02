import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/hooks/ui/use-mobile', () => ({
  useIsMobile: () => false,
}))

import { ViewModeSelector } from '../ViewModeSelector'

describe('ViewModeSelector', () => {
  it('renders current view label on desktop', () => {
    render(
      <ViewModeSelector
        viewStyle="tree"
        onViewStyleChange={vi.fn()}
        contentMode="grid"
        onContentModeChange={vi.fn()}
      />
    )
    expect(screen.getByText('Arborescence')).toBeInTheDocument()
  })

  it('renders grid/list toggle buttons', () => {
    render(
      <ViewModeSelector
        viewStyle="classic"
        onViewStyleChange={vi.fn()}
        contentMode="grid"
        onContentModeChange={vi.fn()}
      />
    )
    expect(screen.getByText('Classique')).toBeInTheDocument()
  })
})
