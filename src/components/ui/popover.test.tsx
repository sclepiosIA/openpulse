import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

const { mockCn, contentDisplayName } = vi.hoisted(() => ({
  mockCn: vi.fn((...classes: unknown[]) => String(classes.filter(Boolean).join(' '))),
  contentDisplayName: 'RadixPopoverContent',
}))

vi.mock('@/lib/utils', () => ({
  cn: mockCn,
}))

vi.mock('@radix-ui/react-popover', () => {
  const Content = React.forwardRef<HTMLDivElement, any>((props, ref) => {
    const { align, sideOffset, className, children, ...rest } = props
    return React.createElement(
      'div',
      {
        ...rest,
        ref,
        'data-align': align,
        'data-sideoffset': String(sideOffset),
        className,
      },
      children
    )
  })
  Content.displayName = contentDisplayName

  const Root = ({ children }: any) =>
    React.createElement('div', { 'data-root': 'popover' }, children)
  const Trigger = ({ children, ...rest }: any) =>
    React.createElement('button', { type: 'button', ...rest }, children)
  const Portal = ({ children }: any) => React.createElement(React.Fragment, null, children)

  return { Root, Trigger, Content, Portal }
})

import { Popover, PopoverTrigger, PopoverContent } from './popover'

describe('Popover components', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders Popover, Trigger and Content, merging base and custom classes', () => {
    render(
      <Popover>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent data-testid="content" className="custom-class">
          Hello content
        </PopoverContent>
      </Popover>
    )

    const trigger = screen.getByRole('button', { name: 'Open' })
    expect(trigger).toBeInTheDocument()

    const content = screen.getByTestId('content')
    expect(content).toBeInTheDocument()
    expect(content).toHaveTextContent('Hello content')
    expect(content.className).toContain('bg-popover')
    expect(content.className).toContain('custom-class')

    expect(mockCn).toHaveBeenCalled()
    const [baseArg, customArg] = mockCn.mock.calls[0] as [string, string]
    expect(baseArg).toContain('bg-popover')
    expect(customArg).toBe('custom-class')
  })

  it('applies default align="center" and sideOffset=4 when not provided', () => {
    render(
      <Popover>
        <PopoverContent data-testid="content-defaults">Defaults</PopoverContent>
      </Popover>
    )

    const content = screen.getByTestId('content-defaults')
    expect(content.getAttribute('data-align')).toBe('center')
    expect(content.getAttribute('data-sideoffset')).toBe('4')
  })

  it('allows overriding align and sideOffset props', () => {
    render(
      <Popover>
        <PopoverContent data-testid="content-override" align="start" sideOffset={10}>
          Overrides
        </PopoverContent>
      </Popover>
    )

    const content = screen.getByTestId('content-override')
    expect(content.getAttribute('data-align')).toBe('start')
    expect(content.getAttribute('data-sideoffset')).toBe('10')
  })

  it('forwards ref to the underlying content element', () => {
    const ref = React.createRef<HTMLDivElement>()
    render(
      <Popover>
        <PopoverContent ref={ref} data-testid="content-ref">
          With ref
        </PopoverContent>
      </Popover>
    )

    expect(ref.current).toBeInstanceOf(HTMLElement)
    expect(ref.current?.getAttribute('data-testid')).toBe('content-ref')
  })

  it('sets displayName from Radix Content', () => {
    expect(PopoverContent.displayName).toBe(contentDisplayName)
  })
})