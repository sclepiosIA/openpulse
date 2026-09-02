import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/hooks/ui/use-mobile', () => ({
  useIsMobile: () => false,
}))

import { MobileDrawer } from '../MobileDrawer'

describe('MobileDrawer', () => {
  it('renders dialog on desktop when open', () => {
    render(
      <MobileDrawer open={true} onOpenChange={vi.fn()} title="Test Dialog">
        <p>Content here</p>
      </MobileDrawer>
    )
    expect(screen.getByText('Test Dialog')).toBeInTheDocument()
    expect(screen.getByText('Content here')).toBeInTheDocument()
  })

  it('renders nothing when closed', () => {
    const { container } = render(
      <MobileDrawer open={false} onOpenChange={vi.fn()} title="Hidden">
        <p>Hidden content</p>
      </MobileDrawer>
    )
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })
})
