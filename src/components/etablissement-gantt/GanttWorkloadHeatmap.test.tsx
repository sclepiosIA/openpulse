import React, { PropsWithChildren } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { TOOLTIP_STATE } = vi.hoisted(() => ({
  TOOLTIP_STATE: {
    lastContent: '' as string,
  },
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: Array<string | false | null | undefined>) => args.filter(Boolean).join(' '),
}))

vi.mock('@/components/ui/tooltip', async () => {
  const ReactMod = await import('react')
  const React = ReactMod.default

  const Ctx = React.createContext<{ setLastHoverText: (s: string) => void } | null>(null)

  function getText(node: React.ReactNode): string {
    if (node == null || typeof node === 'boolean') return ''
    if (typeof node === 'string' || typeof node === 'number') return String(node)
    if (Array.isArray(node)) return node.map(getText).join('')
    if (React.isValidElement(node)) {
      return getText((node as React.ReactElement<{ children?: React.ReactNode }>).props.children)
    }
    return ''
  }

  const TooltipProvider = ({ children }: { children: React.ReactNode }) => {
    const setLastHoverText = (s: string) => {
      TOOLTIP_STATE.lastContent = s
    }
    return React.createElement(Ctx.Provider, { value: { setLastHoverText } }, children)
  }

  const Tooltip = ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children)

  const TooltipTrigger = ({ asChild, children }: { asChild?: boolean; children: React.ReactNode }) => {
    const ctx = React.useContext(Ctx)
    if (!React.isValidElement(children)) return React.createElement('span', null, children)

    const child = children as React.ReactElement<{ onMouseEnter?: () => void; onMouseLeave?: () => void }>
    const onMouseEnter = () => {
      // no-op: content is already rendered in DOM; tests assert DOM content directly
      if (!ctx) return
    }
    if (asChild) return React.cloneElement(child, { onMouseEnter })
    return React.createElement('span', { onMouseEnter }, children)
  }

  const TooltipContent = ({ children }: { children: React.ReactNode }) => {
    const text = getText(children)
    TOOLTIP_STATE.lastContent = text
    return React.createElement('div', { 'data-testid': 'tooltip-content' }, children)
  }

  return { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent }
})

vi.mock('@/integrations/supabase/client', () => {
  const builder = {
    _result: Promise.resolve({ data: null, error: null } as { data: unknown; error: unknown }),
    select() {
      return this
    },
    eq() {
      return this
    },
    gte() {
      return this
    },
    lte() {
      return this
    },
    in() {
      return this
    },
    order() {
      return this
    },
    limit() {
      return this
    },
    insert() {
      return this
    },
    update() {
      return this
    },
    delete() {
      return this
    },
    single() {
      return this._result
    },
    maybeSingle() {
      return this._result
    },
    then(onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
      return this._result.then(onFulfilled, onRejected)
    },
    catch(onRejected?: (e: unknown) => unknown) {
      return this._result.catch(onRejected)
    },
    finally(onFinally?: () => void) {
      return this._result.finally(onFinally)
    },
  }

  const mockFrom = vi.fn(() => builder)

  return {
    supabase: {
      from: mockFrom,
      auth: {
        getSession: vi.fn(async () => ({ data: { session: { user: { id: 'u1' } } }, error: null })),
      },
    },
  }
})

import { GanttWorkloadHeatmap } from './GanttWorkloadHeatmap'

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function Wrapper({ children }: PropsWithChildren) {
  const client = createQueryClient()
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('GanttWorkloadHeatmap', () => {
  it('rend null quand disabled', () => {
    const timeline = { start: new Date('2024-01-01T00:00:00.000Z'), end: new Date('2024-01-03T00:00:00.000Z') }
    const { container } = render(<GanttWorkloadHeatmap tasks={[]} timeline={timeline} height={40} enabled={false} />, {
      wrapper: Wrapper,
    })
    expect(container.firstChild).toBeNull()
  })

  it('calcule et applique les intensités / styles sur les jours du timeline', () => {
    const timeline = { start: new Date('2024-01-01T00:00:00.000Z'), end: new Date('2024-01-04T00:00:00.000Z') }

    const day1Tasks = Array.from({ length: 1 }).map((_, i) => ({
      id: `d1-${i}`,
      created_at: '2024-01-01T00:00:00.000Z',
      echeance: '2024-01-01T00:00:00.000Z',
      responsable_id: i === 0 ? 'r1' : null,
    }))

    const day2Tasks = Array.from({ length: 3 }).map((_, i) => ({
      id: `d2-${i}`,
      created_at: '2024-01-02T00:00:00.000Z',
      echeance: '2024-01-02T00:00:00.000Z',
      responsable_id: i % 2 === 0 ? 'r1' : 'r2',
    }))

    const day3Tasks = Array.from({ length: 6 }).map((_, i) => ({
      id: `d3-${i}`,
      created_at: '2024-01-03T00:00:00.000Z',
      echeance: '2024-01-03T00:00:00.000Z',
      responsable_id: `r${i % 3}`,
    }))

    const tasks = [...day1Tasks, ...day2Tasks, ...day3Tasks] as unknown as import('@/types/gantt').Task[]

    const { container } = render(<GanttWorkloadHeatmap tasks={tasks} timeline={timeline} height={50} enabled />, {
      wrapper: Wrapper,
    })

    const triggers = container.querySelectorAll('div.absolute.top-0.transition-opacity.duration-200.pointer-events-auto')
    expect(triggers.length).toBe(4)

    const day1 = triggers[0] as HTMLDivElement
    const day2 = triggers[1] as HTMLDivElement
    const day3 = triggers[2] as HTMLDivElement
    const day4 = triggers[3] as HTMLDivElement

    expect(day1.className).toContain('bg-muted/30')
    expect(day2.className).toContain('bg-primary/20')
    expect(day3.className).toContain('bg-warning/30')
    expect(day4.className).toContain('bg-transparent')

    expect(day1.style.height).toBe('50px')
    expect(day2.style.height).toBe('50px')

    expect(day1.style.left).toBe('0%')
    expect(day1.style.width).toBe('25%')
    expect(day2.style.left).toBe('25%')
    expect(day2.style.width).toBe('25%')
    expect(day4.style.left).toBe('75%')
    expect(day4.style.width).toBe('25%')
  })

  it('affiche le contenu de tooltip (métier) avec nombre de tâches et personnes (jour correct)', async () => {
    const user = userEvent.setup()

    const timeline = { start: new Date('2024-01-01T00:00:00.000Z'), end: new Date('2024-01-02T00:00:00.000Z') }
    const tasks = [
      {
        id: 't1',
        created_at: '2024-01-01T00:00:00.000Z',
        echeance: '2024-01-01T00:00:00.000Z',
        responsable_id: 'r1',
      },
      {
        id: 't2',
        created_at: '2024-01-01T00:00:00.000Z',
        echeance: '2024-01-01T00:00:00.000Z',
        responsable_id: 'r2',
      },
      {
        id: 't3',
        created_at: '2024-01-01T00:00:00.000Z',
        echeance: '2024-01-01T00:00:00.000Z',
        responsable_id: 'r2',
      },
    ] as unknown as import('@/types/gantt').Task[]

    const { container } = render(<GanttWorkloadHeatmap tasks={tasks} timeline={timeline} height={20} enabled />, {
      wrapper: Wrapper,
    })

    const triggers = container.querySelectorAll('div.absolute.top-0.transition-opacity.duration-200.pointer-events-auto')
    expect(triggers.length).toBe(2)

    const allContents = screen.getAllByTestId('tooltip-content')
    expect(allContents.length).toBe(2)

    const contentDay1 = allContents[0]
    expect(within(contentDay1).getByText(/3 tâche/i)).toBeTruthy()
    expect(within(contentDay1).getByText(/2 personne/i)).toBeTruthy()

    const contentDay2 = allContents[1]
    expect(within(contentDay2).getByText(/0 tâche/i)).toBeTruthy()
    expect(within(contentDay2).queryByText(/personne/i)).toBeNull()

    await user.hover(triggers[0] as Element)
    expect(screen.getAllByTestId('tooltip-content')[0].textContent ?? '').toContain('3 tâche')
    expect(screen.getAllByTestId('tooltip-content')[0].textContent ?? '').toContain('2 personne')
  })
})