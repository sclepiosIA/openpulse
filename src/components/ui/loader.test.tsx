/* @vitest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { Loader } from './loader'

vi.mock('lucide-react', () => ({
  Loader2: ({ className }: { className?: string }) =>
    React.createElement('svg', {
      'data-testid': 'loader-icon',
      className,
      'aria-hidden': 'true',
    }),
}))

describe('Loader', () => {
  it('affiche le message de chargement', () => {
    render(<Loader />)

    expect(screen.getByText('Chargement...')).toBeInTheDocument()
  })

  it('rend une zone centrée avec une icône animée et le style attendu', () => {
    const { container } = render(<Loader />)

    const root = container.firstElementChild
    expect(root).not.toBeNull()
    expect(root?.className).toContain('flex')
    expect(root?.className).toContain('items-center')
    expect(root?.className).toContain('justify-center')
    expect(root?.className).toContain('min-h-[400px]')

    const icon = screen.getByTestId('loader-icon')
    expect(icon).toBeInTheDocument()
    expect(icon).toHaveClass('h-8', 'w-8', 'animate-spin', 'text-muted-foreground')
  })

  it('rend le conteneur interne en colonne avec un espacement entre icône et texte', () => {
    const { container } = render(<Loader />)

    const root = container.firstElementChild
    const inner = root?.firstElementChild

    expect(inner).not.toBeNull()
    expect(inner?.className).toContain('flex')
    expect(inner?.className).toContain('flex-col')
    expect(inner?.className).toContain('items-center')
    expect(inner?.className).toContain('gap-2')

    const text = screen.getByText('Chargement...')
    expect(text.tagName).toBe('P')
    expect(text).toHaveClass('text-sm', 'text-muted-foreground')
  })
})