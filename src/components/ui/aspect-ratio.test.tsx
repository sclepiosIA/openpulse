/* @vitest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AspectRatio } from './aspect-ratio'

vi.mock('@radix-ui/react-aspect-ratio', () => {
  return {
    Root: React.forwardRef<
      HTMLDivElement,
      React.HTMLAttributes<HTMLDivElement> & { ratio?: number }
    >(function MockAspectRatioRoot({ ratio, children, ...props }, ref) {
      return (
        <div ref={ref} data-testid="aspect-ratio-root" data-ratio={String(ratio)} {...props}>
          {children}
        </div>
      )
    }),
  }
})

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('AspectRatio', () => {
  it('rend le composant Radix Root avec les props métier attendues', () => {
    const Wrapper = createWrapper()

    render(
      <AspectRatio ratio={16 / 9} data-testid="custom-aspect" className="media-box">
        <img alt="preview" src="/img.png" />
      </AspectRatio>,
      { wrapper: Wrapper }
    )

    const root = screen.getByTestId('custom-aspect')
    expect(root).toBeInTheDocument()
    expect(root).toHaveAttribute('data-ratio', String(16 / 9))
    expect(root).toHaveClass('media-box')
    expect(screen.getByAltText('preview')).toBeInTheDocument()
  })

  it('exporte directement la primitive Root et transmet les enfants', () => {
    const Wrapper = createWrapper()

    render(
      <AspectRatio ratio={1}>
        <span>content</span>
      </AspectRatio>,
      { wrapper: Wrapper }
    )

    const root = screen.getByTestId('aspect-ratio-root')
    expect(root).toHaveAttribute('data-ratio', '1')
    expect(screen.getByText('content')).toBeInTheDocument()
  })
})