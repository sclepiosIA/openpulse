import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const { cnMock } = vi.hoisted(() => ({
  cnMock: vi.fn((...classes: Array<unknown>) =>
    classes
      .flatMap((c) => (typeof c === 'string' ? [c] : []))
      .filter((s) => s.trim().length > 0)
      .join(' ')
  ),
}))

vi.mock('@/lib/utils', () => ({
  cn: cnMock,
}))

import { Input } from './input'

describe('Input', () => {
  beforeEach(() => {
    cnMock.mockClear()
  })

  it('rend un input avec type, props, et compose correctement className via cn', () => {
    render(
      <Input data-testid="i" type="email" className="custom-class" placeholder="Email" disabled />
    )

    const el = screen.getByTestId('i')
    expect(el.tagName.toLowerCase()).toBe('input')
    expect(el).toHaveAttribute('type', 'email')
    expect(el).toHaveAttribute('placeholder', 'Email')
    expect(el).toBeDisabled()

    expect(cnMock).toHaveBeenCalledTimes(1)
    const args = cnMock.mock.calls[0]
    expect(args.length).toBe(2)
    expect(typeof args[0]).toBe('string')
    expect(args[1]).toBe('custom-class')

    expect(el).toHaveClass('custom-class')
    expect(el).toHaveClass('flex')
    expect(el).toHaveClass('h-champ')
    expect(el).toHaveClass('w-full')
    expect(el).toHaveClass('rounded-md')
    expect(el).toHaveClass('border')
    expect(el).toHaveClass('px-3')
    expect(el).toHaveClass('py-2')
  })

  it("forwardRef pointe vers l'élément input", () => {
    const ref = React.createRef<HTMLInputElement>()
    render(<Input data-testid="i" ref={ref} />)

    const el = screen.getByTestId('i')
    expect(ref.current).toBe(el)
    expect(ref.current?.tagName.toLowerCase()).toBe('input')
  })
})
