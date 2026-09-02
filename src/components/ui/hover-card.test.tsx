import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HoverCard, HoverCardTrigger, HoverCardContent } from './hover-card'

const { cnMock } = vi.hoisted(() => ({
  cnMock: vi.fn((...classes: Array<string | undefined | null | false>) =>
    classes.filter(Boolean).join(' ')
  ),
}))

vi.mock('@/lib/utils', () => ({
  cn: cnMock,
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  const Wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  return { Wrapper }
}

describe('hover-card.tsx', () => {
  it('ouvre le contenu au survol et applique les valeurs par défaut + classes', async () => {
    const user = userEvent.setup()
    const { Wrapper } = createWrapper()

    render(
      <HoverCard>
        <HoverCardTrigger asChild>
          <button type="button">Trigger</button>
        </HoverCardTrigger>
        <HoverCardContent data-testid="content" className="extra-class">
          Hello content
        </HoverCardContent>
      </HoverCard>,
      { wrapper: Wrapper }
    )

    expect(screen.queryByTestId('content')).toBeNull()

    await user.hover(screen.getByRole('button', { name: 'Trigger' }))

    const content = await screen.findByTestId('content')
    expect(content).toHaveTextContent('Hello content')
    expect(content).toHaveClass('extra-class')
    expect(content).toHaveClass('z-50')
    expect(content).toHaveClass('w-80')
    expect(content).toHaveClass('rounded-md')

    expect(cnMock).toHaveBeenCalled()
    const lastCall = cnMock.mock.calls[cnMock.mock.calls.length - 1]
    expect(lastCall[0]).toContain('z-50')
    expect(lastCall[0]).toContain('shadow-overlay')
    expect(lastCall[1]).toBe('extra-class')

    await user.unhover(screen.getByRole('button', { name: 'Trigger' }))
  })

  it('passe les props de positionnement à Radix (align, sideOffset, collisionPadding, avoidCollisions=false)', async () => {
    const user = userEvent.setup()
    const { Wrapper } = createWrapper()

    render(
      <HoverCard>
        <HoverCardTrigger asChild>
          <button type="button">Trigger</button>
        </HoverCardTrigger>
        <HoverCardContent
          data-testid="content"
          align="start"
          sideOffset={12}
          collisionPadding={24}
          avoidCollisions={false}
        >
          Positioned
        </HoverCardContent>
      </HoverCard>,
      { wrapper: Wrapper }
    )

    await user.hover(screen.getByRole('button', { name: 'Trigger' }))

    const content = await screen.findByTestId('content')
    expect(content).toHaveTextContent('Positioned')

    expect(content.getAttribute('data-align')).toBe('start')
    expect(content.getAttribute('data-side')).not.toBeNull()
  })
})
