import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

const { mockCn } = vi.hoisted(() => {
  const mockCnFn = (...args: unknown[]): string => {
    return args.filter(Boolean).join(' ')
  }
  return { mockCn: mockCnFn }
})

vi.mock('@/lib/utils', () => ({
  cn: mockCn,
}))

import { Skeleton } from './skeleton'

describe('Skeleton', () => {
  it('renders a div with the base shimmer classes', () => {
    render(<Skeleton data-testid="sk" />)
    const el = screen.getByTestId('sk')
    expect(el.tagName.toLowerCase()).toBe('div')

    const className = el.getAttribute('class') ?? ''
    expect(className).toContain('relative')
    expect(className).toContain('overflow-hidden')
    expect(className).toContain('rounded-md')
    expect(className).toContain('bg-muted')
    expect(className).toContain('after:absolute')
    expect(className).toContain('after:inset-0')
    expect(className).toContain('after:translate-x-[-100%]')
    expect(className).toContain('after:bg-gradient-to-r')
    expect(className).toContain('after:from-transparent')
    expect(className).toContain('after:via-background/10')
    expect(className).toContain('after:to-transparent')
    expect(className).toContain('after:animate-shimmer')
  })

  it('merges additional className values using cn', () => {
    render(<Skeleton data-testid="sk" className="custom-class another-one" />)
    const el = screen.getByTestId('sk')
    const className = el.getAttribute('class') ?? ''
    expect(className).toContain('custom-class')
    expect(className).toContain('another-one')
  })

  it('forwards HTML attributes and renders children', () => {
    const handleClick = vi.fn()
    render(
      <Skeleton
        data-testid="sk"
        id="skeleton-id"
        role="status"
        aria-label="loading"
        data-foo="bar"
        onClick={handleClick}
      >
        Child text
      </Skeleton>
    )
    const el = screen.getByTestId('sk')

    expect(el.getAttribute('id')).toBe('skeleton-id')
    expect(el.getAttribute('role')).toBe('status')
    expect(el.getAttribute('aria-label')).toBe('loading')
    expect(el.getAttribute('data-foo')).toBe('bar')
    expect(el).toHaveTextContent('Child text')

    fireEvent.click(el)
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})