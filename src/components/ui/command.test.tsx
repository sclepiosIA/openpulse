import React from 'react'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}))

vi.mock('@/components/ui/dialog', () => {
  const Dialog = ({ open, children, ...props }: any) =>
    React.createElement('div', { 'data-dialog': 'root', ...props }, open ? children : null)
  const DialogContent = React.forwardRef<HTMLDivElement, any>(({ className, ...props }, ref) =>
    React.createElement('div', { ref, className, 'data-dialog': 'content', ...props })
  )
  const DialogTitle = ({ children, ...props }: any) =>
    React.createElement('h2', { 'data-dialog': 'title', ...props }, children)
  return { Dialog, DialogContent, DialogTitle }
})

vi.mock('@radix-ui/react-visually-hidden', () => ({
  Root: ({ asChild, children, ...props }: any) =>
    React.isValidElement(children)
      ? React.cloneElement(children, { ...props })
      : React.createElement('span', { ...props }, children),
}))

vi.mock('lucide-react', () => ({
  Search: (props: any) => React.createElement('svg', { 'data-icon': 'search', ...props }),
}))

vi.mock('cmdk', () => {
  const Command = React.forwardRef<HTMLDivElement, any>(
    ({ className, shouldFilter, ...props }, ref) =>
      React.createElement('div', {
        ref,
        className,
        'data-cmdk': 'command',
        'data-should-filter': String(!!shouldFilter),
        ...props,
      })
  )
  Command.displayName = 'Command'
  const Input = React.forwardRef<HTMLInputElement, any>(({ className, ...props }, ref) =>
    React.createElement('input', { ref, className, 'data-cmdk': 'input', ...props })
  )
  const List = React.forwardRef<HTMLDivElement, any>(({ className, ...props }, ref) =>
    React.createElement('div', { ref, className, 'data-cmdk': 'list', ...props })
  )
  const Empty = React.forwardRef<HTMLDivElement, any>(({ className, ...props }, ref) =>
    React.createElement('div', { ref, className, 'data-cmdk': 'empty', ...props })
  )
  const Group = React.forwardRef<HTMLDivElement, any>(({ className, ...props }, ref) =>
    React.createElement('div', { ref, className, 'data-cmdk': 'group', ...props })
  )
  const Item = React.forwardRef<HTMLDivElement, any>(({ className, ...props }, ref) =>
    React.createElement('div', { ref, className, 'data-cmdk': 'item', ...props })
  )
  const Separator = React.forwardRef<HTMLHRElement, any>(({ className, ...props }, ref) =>
    React.createElement('hr', { ref, className, 'data-cmdk': 'separator', ...props })
  )
  const CommandPrimitive = Object.assign(Command, { Input, List, Empty, Group, Item, Separator })
  return { Command: CommandPrimitive }
})

import {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from './command'

describe('command components', () => {
  it('renders Command with merged classes and children', () => {
    render(
      <Command data-testid="root" className="custom-class">
        <div>Child content</div>
      </Command>
    )
    const root = screen.getByTestId('root')
    expect(root).toBeInTheDocument()
    expect(root.className).toContain('bg-popover')
    expect(root.className).toContain('text-popover-foreground')
    expect(root.className).toContain('rounded-md')
    expect(root.className).toContain('custom-class')
    expect(screen.getByText('Child content')).toBeInTheDocument()
  })

  it('renders CommandDialog default size with hidden title and shouldFilter=false', () => {
    render(
      <CommandDialog open>
        <CommandList>
          <CommandItem>Item 1</CommandItem>
        </CommandList>
      </CommandDialog>
    )
    const dialogContent = document.querySelector('[data-dialog="content"]') as HTMLElement
    expect(dialogContent).toBeInTheDocument()
    expect(dialogContent.className).toContain('overflow-hidden')
    expect(dialogContent.className).toContain('p-0')
    expect(dialogContent.className).toContain('bg-marque-papier')
    expect(dialogContent.className).toContain('backdrop-blur-xl')
    expect(dialogContent.className).toContain('max-w-2xl')
    expect(dialogContent.className).toContain('sm:max-w-[680px]')
    expect(dialogContent.hasAttribute('aria-describedby')).toBe(false)

    const innerCommand = dialogContent.querySelector('[data-cmdk="command"]') as HTMLElement
    expect(innerCommand).toBeInTheDocument()
    expect(innerCommand.getAttribute('data-should-filter')).toBe('false')

    expect(screen.getByText('Recherche')).toBeInTheDocument()
    expect(screen.getByText('Item 1')).toBeInTheDocument()
  })

  it('renders CommandDialog with size=large and hides content when closed', () => {
    const { rerender } = render(
      <CommandDialog open size="large">
        <div>Inside</div>
      </CommandDialog>
    )
    const dialogContentOpen = document.querySelector('[data-dialog="content"]') as HTMLElement
    expect(dialogContentOpen).toBeInTheDocument()
    expect(dialogContentOpen.className).toContain('sm:max-w-5xl')
    expect(dialogContentOpen.className).toContain('w-full')
    expect(dialogContentOpen.className).toContain('max-w-[90vw]')

    rerender(
      <CommandDialog open={false} size="large">
        <div>Inside</div>
      </CommandDialog>
    )
    const dialogContentClosed = document.querySelector(
      '[data-dialog="content"]'
    ) as HTMLElement | null
    expect(dialogContentClosed).toBeNull()
  })

  it('renders CommandInput with icon and input wrapper', () => {
    const { container } = render(<CommandInput placeholder="Search here" />)
    const input = screen.getByRole('textbox')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('placeholder', 'Search here')
    expect(input.className).toContain('h-11')
    expect(input.className).toContain('w-full')
    const icon = container.querySelector('[data-icon="search"]') as SVGElement
    expect(icon).toBeInTheDocument()
    const wrapper = container.querySelector('[cmdk-input-wrapper]')
    expect(wrapper).not.toBeNull()
  })

  it('renders CommandList, CommandGroup, CommandItem, CommandEmpty, CommandSeparator with classes', () => {
    render(
      <Command>
        <CommandList>
          <CommandGroup>
            <CommandItem>First</CommandItem>
            <CommandSeparator />
            <CommandEmpty>Nothing found</CommandEmpty>
          </CommandGroup>
        </CommandList>
      </Command>
    )

    const list = document.querySelector('[data-cmdk="list"]') as HTMLElement
    expect(list).toBeInTheDocument()
    expect(list.className).toContain('max-h-[300px]')
    expect(list.className).toContain('overflow-y-auto')
    expect(list.className).toContain('overflow-x-hidden')

    const group = document.querySelector('[data-cmdk="group"]') as HTMLElement
    expect(group).toBeInTheDocument()
    expect(group.className).toContain('overflow-hidden')
    expect(group.className).toContain('p-1')
    expect(group.className).toContain('text-foreground')

    const item = screen.getByText('First')
    expect(item).toBeInTheDocument()
    const itemEl = item.closest('[data-cmdk="item"]') as HTMLElement
    expect(itemEl).toBeInTheDocument()
    expect(itemEl.className).toContain('relative')
    expect(itemEl.className).toContain('rounded-sm')

    const separator = document.querySelector('[data-cmdk="separator"]') as HTMLElement
    expect(separator).toBeInTheDocument()
    expect(separator.className).toContain('-mx-1')
    expect(separator.className).toContain('h-px')
    expect(separator.className).toContain('bg-border')

    const empty = screen.getByText('Nothing found').closest('[data-cmdk="empty"]') as HTMLElement
    expect(empty).toBeInTheDocument()
    expect(empty.className).toContain('py-6')
    expect(empty.className).toContain('text-center')
    expect(empty.className).toContain('text-sm')
  })

  it('renders CommandShortcut with proper classes', () => {
    render(
      <Command>
        <CommandItem>
          Label
          <CommandShortcut>shortcut</CommandShortcut>
        </CommandItem>
      </Command>
    )
    const sc = screen.getByText('shortcut')
    expect(sc).toBeInTheDocument()
    expect(sc.tagName.toLowerCase()).toBe('span')
    expect((sc as HTMLElement).className).toContain('ml-auto')
    expect((sc as HTMLElement).className).toContain('text-xs')
    expect((sc as HTMLElement).className).toContain('tracking-widest')
    expect((sc as HTMLElement).className).toContain('text-muted-foreground')
  })
})
