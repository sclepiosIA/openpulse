import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FeedbackButton } from '../FeedbackButton'
import { TooltipProvider } from '@/components/ui/tooltip'

vi.mock('@/hooks/ui/use-mobile', () => ({
  useIsMobile: vi.fn(() => false),
}))

vi.mock('@/components/feedback/FeedbackModal', () => ({
  FeedbackModal: () => <div data-testid="feedback-modal" />,
}))

vi.mock('@/components/feedback/FeedbackDrawer', () => ({
  FeedbackDrawer: () => <div data-testid="feedback-drawer" />,
}))

vi.mock('@/lib/debug', () => ({
  debug: { error: vi.fn(), log: vi.fn() },
}))

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: vi.fn(() => ({ user: { id: '1', email: 'test@test.com' } })),
}))

describe('FeedbackButton', () => {
  it('renders floating button on desktop when logged in', () => {
    render(
      <TooltipProvider>
        <FeedbackButton />
      </TooltipProvider>
    )
    expect(screen.getByLabelText('Donner un retour')).toBeInTheDocument()
  })

  it('renders nothing on mobile', async () => {
    const { useIsMobile } = await import('@/hooks/ui/use-mobile')
    ;(useIsMobile as any).mockReturnValue(true)
    const { container } = render(
      <TooltipProvider>
        <FeedbackButton />
      </TooltipProvider>
    )
    expect(container.querySelector('button')).toBeNull()
    ;(useIsMobile as any).mockReturnValue(false)
  })

  it('renders nothing when not logged in', async () => {
    const { useAuth } = await import('@/hooks/shared/useAuth')
    ;(useAuth as any).mockReturnValue({ user: null })
    const { container } = render(
      <TooltipProvider>
        <FeedbackButton />
      </TooltipProvider>
    )
    expect(container.querySelector('button')).toBeNull()
    ;(useAuth as any).mockReturnValue({ user: { id: '1', email: 'test@test.com' } })
  })

  it('renders feedback modal', () => {
    render(
      <TooltipProvider>
        <FeedbackButton />
      </TooltipProvider>
    )
    expect(screen.getByTestId('feedback-modal')).toBeInTheDocument()
  })
})
