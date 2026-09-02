import React from 'react'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const {
  JALON_TYPES,
  AUTH_STATE,
  upsertSpy,
  mockUseCsmParcours,
  StatusBadgeSpy,
  EditableSelectCellSpy,
  EditableCellSpy,
  mockFrom,
} = vi.hoisted(() => {
  const JALON_TYPES = [
    { value: 'step1', label: 'Étape 1' },
    { value: 'step2', label: 'Étape 2' },
    { value: 'step3', label: 'Étape 3' },
  ] as const

  const AUTH_STATE = {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  }

  const upsertSpy = vi.fn()

  const mockUseCsmParcours = vi.fn<
    [etablissementId: string],
    { data: Array<Record<string, unknown>>; upsert: typeof upsertSpy }
  >((_) => ({
    data: [],
    upsert: upsertSpy,
  }))

  const StatusBadgeSpy = vi.fn<[props: { status: string }], React.ReactElement>((props) => {
    return <div data-testid="status-badge">{props.status}</div>
  })

  const EditableSelectCellSpy = vi.fn<
    [props: { value: string; options: Array<{ value: string; label: string }>; onSave: (v: string) => void }],
    React.ReactElement
  >((props) => {
    return (
      <button
        type="button"
        data-testid="editable-select"
        data-value={props.value}
        onClick={() => props.onSave('done')}
      >
        Select
      </button>
    )
  })

  const EditableCellSpy = vi.fn<
    [props: { value?: string | null; placeholder?: string; className?: string; multiline?: boolean; onSave: (v: string) => void }],
    React.ReactElement
  >((props) => {
    return (
      <button type="button" data-testid="editable-cell" data-value={props.value ?? ''} onClick={() => props.onSave('Nouvelle note')}>
        Cell
      </button>
    )
  })

  const mockFrom = vi.fn()

  return {
    JALON_TYPES,
    AUTH_STATE,
    upsertSpy,
    mockUseCsmParcours,
    StatusBadgeSpy,
    EditableSelectCellSpy,
    EditableCellSpy,
    mockFrom,
  }
})

vi.mock('@/types/csm', () => {
  return {
    JALON_TYPES,
  }
})

vi.mock('@/hooks/csm/useCsmParcours', () => {
  return {
    useCsmParcours: (etablissementId: string) => mockUseCsmParcours(etablissementId),
  }
})

vi.mock('@/components/ui/card', () => {
  const Card = ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>
  const CardHeader = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-header" data-class={className ?? ''}>
      {children}
    </div>
  )
  const CardTitle = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-title" data-class={className ?? ''}>
      {children}
    </div>
  )
  const CardContent = ({ children }: { children: React.ReactNode }) => <div data-testid="card-content">{children}</div>
  return { Card, CardHeader, CardTitle, CardContent }
})

vi.mock('@/components/csm/StatusBadge', () => {
  return {
    StatusBadge: (props: { status: string }) => StatusBadgeSpy(props),
  }
})

vi.mock('@/components/csm/EditableSelectCell', () => {
  return {
    EditableSelectCell: (props: { value: string; options: Array<{ value: string; label: string }>; onSave: (v: string) => void }) =>
      EditableSelectCellSpy(props),
  }
})

vi.mock('@/components/csm/EditableCell', () => {
  return {
    EditableCell: (props: { value?: string | null; placeholder?: string; className?: string; multiline?: boolean; onSave: (v: string) => void }) =>
      EditableCellSpy(props),
  }
})

vi.mock('@/lib/utils', () => {
  return {
    cn: (...args: Array<unknown>) => args.filter(Boolean).join(' '),
  }
})

vi.mock('@/components/ui/button', () => {
  return {
    Button: ({
      children,
      onClick,
      className,
    }: {
      children: React.ReactNode
      onClick?: React.MouseEventHandler<HTMLButtonElement>
      className?: string
      variant?: string
      size?: string
    }) => (
      <button type="button" data-testid="ui-button" data-class={className ?? ''} onClick={onClick}>
        {children}
      </button>
    ),
  }
})

vi.mock('@/components/ui/calendar', () => {
  return {
    Calendar: ({
      selected,
      onSelect,
    }: {
      mode?: string
      selected?: Date
      onSelect?: (d?: Date) => void
      initialFocus?: boolean
      className?: string
    }) => (
      <button
        type="button"
        data-testid="calendar"
        data-selected={selected ? selected.toISOString().slice(0, 10) : ''}
        onClick={() => onSelect?.(new Date('2025-03-15T00:00:00.000Z'))}
      >
        Calendar
      </button>
    ),
  }
})

vi.mock('@/components/ui/popover', () => {
  return {
    Popover: ({ children }: { children: React.ReactNode; open?: boolean; onOpenChange?: (v: boolean) => void }) => (
      <div data-testid="popover">{children}</div>
    ),
    PopoverTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <div data-testid="popover-trigger">{children}</div>,
    PopoverContent: ({ children }: { children: React.ReactNode; className?: string; align?: string }) => (
      <div data-testid="popover-content">{children}</div>
    ),
  }
})

vi.mock('lucide-react', () => {
  return {
    Route: (props: { className?: string }) => <svg data-testid="icon-route" data-class={props.className ?? ''} />,
    CalendarIcon: (props: { className?: string }) => <svg data-testid="icon-calendar" data-class={props.className ?? ''} />,
  }
})

vi.mock('@/integrations/supabase/client', () => {
  const builderFactory = () => {
    const b: Record<string, unknown> = {}
    const chain = () => b
    const resolve = async () => ({ data: null, error: null })
    b.select = chain
    b.eq = chain
    b.gte = chain
    b.lte = chain
    b.in = chain
    b.order = chain
    b.limit = chain
    b.insert = chain
    b.update = chain
    b.delete = chain
    b.upsert = chain
    b.single = resolve
    b.maybeSingle = resolve
    b.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled as never, onRejected as never)
    b.catch = (onRejected?: (e: unknown) => unknown) => Promise.resolve({ data: null, error: null }).catch(onRejected as never)
    b.finally = (onFinally?: () => void) => Promise.resolve({ data: null, error: null }).finally(onFinally)
    return b
  }

  mockFrom.mockImplementation(() => builderFactory())

  return {
    supabase: {
      from: mockFrom,
      auth: {
        getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      },
    },
  }
})

vi.mock('sonner', () => {
  return {
    toast: {
      success: vi.fn(),
      error: vi.fn(),
      message: vi.fn(),
    },
  }
})

vi.mock('react-router-dom', async () => {
  const actual = (await vi.importActual('react-router-dom')) as Record<string, unknown>
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  }
})

vi.mock('@/hooks/useAuth', () => {
  return {
    useAuth: () => AUTH_STATE,
  }
})
vi.mock('@/contexts/AuthContext', () => {
  return {
    useAuth: () => AUTH_STATE,
  }
})
vi.mock('@/components/AuthProvider', () => {
  return {
    useAuth: () => AUTH_STATE,
  }
})

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

import { CsmEtabParcours } from './CsmEtabParcours'

describe('CsmEtabParcours', () => {
  it('affiche les jalons et le compteur, puis appelle upsert lors de la mise à jour du statut', async () => {
    upsertSpy.mockClear()
    StatusBadgeSpy.mockClear()
    EditableSelectCellSpy.mockClear()
    EditableCellSpy.mockClear()

    mockUseCsmParcours.mockImplementationOnce((etablissementId: string) => {
      expect(etablissementId).toBe('etab-1')
      return {
        data: [
          {
            id: 'j1',
            etablissement_id: 'etab-1',
            jalon_type: 'step1',
            statut: 'done',
            date_jalon: '2025-01-02',
            notes: 'Note A',
          },
          {
            id: 'j2',
            etablissement_id: 'etab-1',
            jalon_type: 'step2',
            statut: 'planning',
            date_jalon: null,
            notes: null,
          },
        ],
        upsert: upsertSpy,
      }
    })

    const queryClient = createQueryClient()
    render(<CsmEtabParcours etablissementId="etab-1" />, { wrapper: createWrapper(queryClient) })

    expect(await screen.findByTestId('card-title')).toHaveTextContent('Parcours client')

    const header = screen.getByTestId('card-header')
    expect(within(header).getByText(`1/${JALON_TYPES.length} jalons complétés`)).toBeTruthy()

    const badges = screen.getAllByTestId('status-badge')
    expect(badges.map((n) => n.textContent)).toEqual(['done', 'planning'])

    const selectButtons = screen.getAllByTestId('editable-select')
    const selectWithPlanning = selectButtons.find((b) => b.getAttribute('data-value') === 'planning')
    expect(selectWithPlanning).toBeTruthy()

    fireEvent.click(selectWithPlanning as Element)

    await waitFor(() => {
      expect(upsertSpy).toHaveBeenCalledTimes(1)
    })

    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        etablissement_id: 'etab-1',
        jalon_type: 'step2',
        statut: 'done',
      })
    )
  })

  it("upsert crée un jalon si inexistant (clic sur un jalon sans données) avec etablissement_id, jalon_type et statut", async () => {
    upsertSpy.mockClear()

    mockUseCsmParcours.mockImplementationOnce((etablissementId: string) => {
      expect(etablissementId).toBe('etab-2')
      return {
        data: [
          {
            id: 'j1',
            etablissement_id: 'etab-2',
            jalon_type: 'step1',
            statut: 'pending',
            date_jalon: null,
            notes: null,
          },
        ],
        upsert: upsertSpy,
      }
    })

    const queryClient = createQueryClient()
    render(<CsmEtabParcours etablissementId="etab-2" />, { wrapper: createWrapper(queryClient) })

    const selectButtons = await screen.findAllByTestId('editable-select')
    const selectEmpty = selectButtons.find((b) => b.getAttribute('data-value') === '')
    expect(selectEmpty).toBeTruthy()

    fireEvent.click(selectEmpty as Element)

    await waitFor(() => {
      expect(upsertSpy).toHaveBeenCalledTimes(1)
    })

    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        etablissement_id: 'etab-2',
        jalon_type: 'step2',
        statut: 'done',
      })
    )

    const calledArg = upsertSpy.mock.calls[0]?.[0]
    expect(calledArg && typeof calledArg === 'object').toBe(true)
    if (calledArg && typeof calledArg === 'object') {
      expect('id' in calledArg).toBe(false)
    }
  })

  it("ne jette pas d'erreur si useCsmParcours renvoie data=null mais échoue au rendu (régression : pas d'exception synchrone)", async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    mockUseCsmParcours.mockImplementationOnce(() => {
      return {
        data: null as unknown as Array<Record<string, unknown>>,
        upsert: upsertSpy,
      }
    })

    const queryClient = createQueryClient()
    render(<CsmEtabParcours etablissementId="etab-3" />, { wrapper: createWrapper(queryClient) })

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalled()
    })

    consoleError.mockRestore()
  })
})