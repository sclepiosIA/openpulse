/* @vitest-environment jsdom */
import * as React from 'react'
import { render, screen } from '@testing-library/react'
import { IconCircle } from './icon-circle'

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}))

const TestIcon = React.forwardRef<SVGSVGElement, { className?: string }>((props, ref) => (
  <svg ref={ref} data-testid="test-icon" {...props} />
))
TestIcon.displayName = 'TestIcon'

describe('IconCircle', () => {
  it('renders with default filled/primary/md classes', () => {
    render(<IconCircle icon={TestIcon} data-testid="icon-circle" />)

    const circle = screen.getByTestId('icon-circle')
    const icon = screen.getByTestId('test-icon')

    expect(circle.className).toContain('flex')
    expect(circle.className).toContain('items-center')
    expect(circle.className).toContain('justify-center')
    expect(circle.className).toContain('shrink-0')
    expect(circle.className).toContain('rounded-full')
    expect(circle.className).toContain('w-10')
    expect(circle.className).toContain('h-10')
    expect(circle.className).toContain('bg-primary')
    expect(circle.className).toContain('text-primary-foreground')

    expect(icon.getAttribute('class')).toContain('w-5')
    expect(icon.getAttribute('class')).toContain('h-5')
  })

  it('applies premium variant radius and styling', () => {
    render(<IconCircle icon={TestIcon} variant="premium" color="white" data-testid="icon-circle" />)

    const circle = screen.getByTestId('icon-circle')

    expect(circle.className).toContain('rounded-2xl')
    expect(circle.className).not.toContain('rounded-full')
    expect(circle.className).toContain('bg-card/10')
    expect(circle.className).toContain('text-white')
    expect(circle.className).toContain('border-2')
    expect(circle.className).toContain('border-white/20')
    expect(circle.className).toContain('backdrop-blur-sm')
  })

  it('applies outlined destructive and xl size classes', () => {
    render(
      <IconCircle
        icon={TestIcon}
        variant="outlined"
        color="destructive"
        size="xl"
        data-testid="icon-circle"
      />
    )

    const circle = screen.getByTestId('icon-circle')
    const icon = screen.getByTestId('test-icon')

    expect(circle.className).toContain('border-2')
    expect(circle.className).toContain('border-destructive')
    expect(circle.className).toContain('text-destructive')
    expect(circle.className).toContain('bg-transparent')
    expect(circle.className).toContain('w-14')
    expect(circle.className).toContain('h-14')

    expect(icon.getAttribute('class')).toContain('w-7')
    expect(icon.getAttribute('class')).toContain('h-7')
  })

  it('adds animation classes only when animate is true', () => {
    const { rerender } = render(<IconCircle icon={TestIcon} data-testid="icon-circle" />)

    expect(screen.getByTestId('icon-circle').className).not.toContain('transition-transform')
    expect(screen.getByTestId('icon-circle').className).not.toContain('duration-300')
    expect(screen.getByTestId('icon-circle').className).not.toContain('hover:scale-110')

    rerender(<IconCircle icon={TestIcon} animate data-testid="icon-circle" />)

    const updatedCircle = screen.getByTestId('icon-circle')
    expect(updatedCircle.className).toContain('transition-transform')
    expect(updatedCircle.className).toContain('duration-300')
    expect(updatedCircle.className).toContain('hover:scale-110')
  })

  it('merges custom className and forwards html attributes', () => {
    render(
      <IconCircle
        icon={TestIcon}
        className="custom-class"
        id="circle-id"
        aria-label="status icon"
        data-testid="icon-circle"
      />
    )

    const circle = screen.getByTestId('icon-circle')

    expect(circle.className).toContain('custom-class')
    expect(circle).toHaveAttribute('id', 'circle-id')
    expect(circle).toHaveAttribute('aria-label', 'status icon')
  })

  it('forwards ref to the root div', () => {
    const ref = React.createRef<HTMLDivElement>()

    render(<IconCircle icon={TestIcon} ref={ref} data-testid="icon-circle" />)

    const circle = screen.getByTestId('icon-circle')
    expect(ref.current).toBe(circle)
    expect(ref.current?.tagName).toBe('DIV')
  })

  it('supports gradient success with 2xl size', () => {
    render(
      <IconCircle
        icon={TestIcon}
        variant="gradient"
        color="success"
        size="2xl"
        data-testid="icon-circle"
      />
    )

    const circle = screen.getByTestId('icon-circle')
    const icon = screen.getByTestId('test-icon')

    expect(circle.className).toContain('bg-gradient-to-br')
    expect(circle.className).toContain('from-success')
    expect(circle.className).toContain('to-cyan-600')
    expect(circle.className).toContain('text-white')
    expect(circle.className).toContain('shadow-lg')
    expect(circle.className).toContain('shadow-success/20')
    expect(circle.className).toContain('w-16')
    expect(circle.className).toContain('h-16')

    expect(icon.getAttribute('class')).toContain('w-8')
    expect(icon.getAttribute('class')).toContain('h-8')
  })
})
