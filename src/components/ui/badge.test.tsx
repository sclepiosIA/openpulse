/* @vitest-environment jsdom */

import * as React from 'react'
import { render, screen } from '@testing-library/react'
import { Badge, badgeVariants } from './badge'

vi.mock('@/lib/utils', () => ({
  cn: (...inputs: Array<string | undefined | null | false>) => inputs.filter(Boolean).join(' '),
}))

describe('badge.tsx', () => {
  it('returns default variant classes from badgeVariants', () => {
    const classes = badgeVariants({})

    expect(classes).toContain('inline-flex')
    expect(classes).toContain('rounded-full')
    expect(classes).toContain('bg-marque-alerte')
    expect(classes).toContain('text-marque-encre')
    expect(classes).toContain('hover:bg-marque-alerte/80')
    expect(classes).toContain('h-pastille')
    expect(classes).not.toContain('bg-marque-cyan')
    expect(classes).not.toContain('text-foreground border-marque-cyan')
  })

  it('returns outline variant classes from badgeVariants', () => {
    const classes = badgeVariants({ variant: 'outline' })

    expect(classes).toContain('text-foreground')
    expect(classes).toContain('border-marque-cyan')
    expect(classes).not.toContain('bg-marque-blue')
    expect(classes).not.toContain('bg-marque-cyan')
  })

  it('renders with default classes and content', () => {
    render(<Badge>Active</Badge>)

    const badge = screen.getByText('Active')

    expect(badge.tagName).toBe('DIV')
    expect(badge).toHaveClass('inline-flex')
    expect(badge).toHaveClass('rounded-full')
    expect(badge).toHaveClass('border-transparent')
    expect(badge).toHaveClass('bg-marque-alerte')
    expect(badge).toHaveClass('text-marque-encre')
    expect(badge).toHaveClass('hover:bg-marque-alerte/80')
    expect(badge).toHaveClass('h-pastille')
  })

  it('renders secondary variant classes', () => {
    render(<Badge variant="secondary">Info</Badge>)

    const badge = screen.getByText('Info')

    expect(badge).toHaveClass('bg-marque-douce')
    expect(badge).toHaveClass('text-marque-encre')
    expect(badge).toHaveClass('hover:bg-marque-douce/80')
    expect(badge).not.toHaveClass('bg-marque-alerte')
  })

  it('renders destructive variant classes', () => {
    render(<Badge variant="destructive">Error</Badge>)

    const badge = screen.getByText('Error')

    expect(badge).toHaveClass('bg-statut-risque-bg')
    expect(badge).toHaveClass('text-statut-risque-fg')
    expect(badge).toHaveClass('hover:bg-statut-risque-bg/80')
    expect(badge).not.toHaveClass('bg-marque-cyan')
  })

  it('merges custom className with variant classes', () => {
    render(
      <Badge variant="outline" className="custom-class extra-padding">
        Custom
      </Badge>
    )

    const badge = screen.getByText('Custom')

    expect(badge).toHaveClass('text-foreground')
    expect(badge).toHaveClass('border-marque-cyan')
    expect(badge).toHaveClass('custom-class')
    expect(badge).toHaveClass('extra-padding')
  })

  it('forwards HTML attributes to the div', () => {
    render(
      <Badge data-testid="badge" aria-label="status badge" id="status-id">
        Status
      </Badge>
    )

    const badge = screen.getByTestId('badge')

    expect(badge).toHaveAttribute('aria-label', 'status badge')
    expect(badge).toHaveAttribute('id', 'status-id')
    expect(badge).toHaveTextContent('Status')
  })

  it('forwards ref to the underlying div element', () => {
    const ref = React.createRef<HTMLDivElement>()

    render(<Badge ref={ref}>Ref badge</Badge>)

    expect(ref.current).not.toBeNull()
    expect(ref.current?.tagName).toBe('DIV')
    expect(ref.current?.textContent).toBe('Ref badge')
  })

  it('sets the expected displayName', () => {
    expect(Badge.displayName).toBe('Badge')
  })
})
