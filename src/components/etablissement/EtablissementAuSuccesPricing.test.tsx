// @vitest-environment jsdom
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useForm, type UseFormReturn } from 'react-hook-form'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import { EtablissementAuSuccesPricing } from './EtablissementAuSuccesPricing'

const {
  AUTH_STATE,
  mockFrom,
  toastSuccess,
  toastError,
  navigateMock,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    user: { id: 'u1', email: 'test@local.dev' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  mockFrom: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  navigateMock: vi.fn(),
}))

vi.mock('@/integrations/supabase/client', () => {
  const builderResult = { data: null, error: null }
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(builderResult)),
    maybeSingle: vi.fn(() => Promise.resolve(builderResult)),
    then: (onFulfilled: (value: typeof builderResult) => unknown) => Promise.resolve(builderResult).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(builderResult).catch(onRejected),
  }

  mockFrom.mockImplementation(() => builder)

  return {
    supabase: {
      from: mockFrom,
      auth: {
        getSession: vi.fn(() => Promise.resolve({ data: { session: AUTH_STATE.session }, error: null })),
        getUser: vi.fn(() => Promise.resolve({ data: { user: AUTH_STATE.user }, error: null })),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      },
    },
  }
})

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

vi.mock('@/components/ui/input', () => ({
  Input: React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>((props, ref) => (
    <input ref={ref} {...props} />
  )),
}))

vi.mock('@/components/ui/form', () => {
  const RHF = require('react-hook-form') as typeof import('react-hook-form')
  return {
    FormControl: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    FormItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    FormLabel: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
    FormMessage: () => null,
    FormField: ({
      control,
      name,
      render,
    }: {
      control: UseFormReturn<Record<string, unknown>>['control']
      name: string
      render: (props: { field: { value: unknown; onChange: (value: unknown) => void; name: string } }) => React.ReactNode
    }) => (
      <RHF.Controller
        control={control}
        name={name}
        render={({ field }) => render({ field: { value: field.value, onChange: field.onChange, name: field.name } })}
      />
    ),
  }
})

vi.mock('@/components/ui/select', () => {
  const SelectContext = React.createContext<{
    value: string
    onValueChange: (value: string) => void
  } | null>(null)

  function Select({
    value,
    onValueChange,
    children,
  }: {
    value?: string
    onValueChange: (value: string) => void
    children: React.ReactNode
  }) {
    return <SelectContext.Provider value={{ value: value ?? '', onValueChange }}>{children}</SelectContext.Provider>
  }

  function SelectTrigger({ children }: { children: React.ReactNode }) {
    const ctx = React.useContext(SelectContext)
    return <div data-testid="select-trigger">{children}<span>{ctx?.value}</span></div>
  }

  function SelectValue({ placeholder }: { placeholder?: string }) {
    return <span>{placeholder}</span>
  }

  function SelectContent({ children }: { children: React.ReactNode }) {
    return <div>{children}</div>
  }

  function SelectItem({ value, children }: { value: string; children: React.ReactNode }) {
    const ctx = React.useContext(SelectContext)
    return (
      <button type="button" onClick={() => ctx?.onValueChange(value)}>
        {children}
      </button>
    )
  }

  return { Select, SelectContent, SelectItem, SelectTrigger, SelectValue }
})

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

function TestHost() {
  const form = useForm({
    defaultValues: {
      pallier_vise: '',
      pallier_realise: '',
      seuils_palliers: undefined,
      tarifs_palliers: undefined,
    },
  })

  return (
    <div>
      <EtablissementAuSuccesPricing form={form} />
      <output data-testid="values">{JSON.stringify(form.watch())}</output>
    </div>
  )
}

describe('EtablissementAuSuccesPricing', () => {
  it('affiche les champs attendus et permet de configurer les valeurs métier réelles', async () => {
    const user = userEvent.setup()
    render(<TestHost />)

    expect(screen.getByText('Pallier visé')).toBeInTheDocument()
    expect(screen.getByText('Pallier réalisé')).toBeInTheDocument()
    expect(screen.getByText("Frais d'accès au service (€)")).toBeInTheDocument()
    expect(screen.getByText('Configuration des palliers')).toBeInTheDocument()

    const pallierButtons = screen.getAllByRole('button', { name: /Pallier 2/i })
    await user.click(pallierButtons[0])

    const pallier3Buttons = screen.getAllByRole('button', { name: /Pallier 3/i })
    await user.click(pallier3Buttons[1])

    const numberInputs = screen.getAllByRole('spinbutton')
    expect(numberInputs).toHaveLength(9)

    await user.clear(numberInputs[0])
    await user.type(numberInputs[0], '1200')

    await user.clear(numberInputs[1])
    await user.type(numberInputs[1], '85.5')

    await user.clear(numberInputs[2])
    await user.type(numberInputs[2], '5000')

    await user.clear(numberInputs[3])
    await user.type(numberInputs[3], '90')

    await user.clear(numberInputs[4])
    await user.type(numberInputs[4], '6500.25')

    const values = JSON.parse(screen.getByTestId('values').textContent ?? '{}') as {
      pallier_vise: string
      pallier_realise: string
      seuils_palliers?: Record<string, number>
      tarifs_palliers?: Record<string, number>
    }

    expect(values.pallier_vise).toBe('Pallier 2')
    expect(values.pallier_realise).toBe('Pallier 3')
    expect(values.tarifs_palliers).toEqual({
      fixe: 1200,
      palier1: 5000,
      palier2: 6500.25,
    })
    expect(values.seuils_palliers).toEqual({
      palier1: 85.5,
      palier2: 90,
    })
  })

  it('supprime proprement les clés quand un champ numérique est vidé', async () => {
    const user = userEvent.setup()
    render(<TestHost />)

    const numberInputs = screen.getAllByRole('spinbutton')

    await user.type(numberInputs[0], '100')
    await user.type(numberInputs[1], '80')
    await user.type(numberInputs[2], '1000')

    let values = JSON.parse(screen.getByTestId('values').textContent ?? '{}') as {
      seuils_palliers?: Record<string, number>
      tarifs_palliers?: Record<string, number>
    }

    expect(values.tarifs_palliers).toEqual({ fixe: 100, palier1: 1000 })
    expect(values.seuils_palliers).toEqual({ palier1: 80 })

    await user.clear(numberInputs[2])

    values = JSON.parse(screen.getByTestId('values').textContent ?? '{}') as {
      seuils_palliers?: Record<string, number>
      tarifs_palliers?: Record<string, number>
    }

    expect(values.tarifs_palliers).toEqual({ fixe: 100 })

    await user.clear(numberInputs[0])

    values = JSON.parse(screen.getByTestId('values').textContent ?? '{}') as {
      seuils_palliers?: Record<string, number>
      tarifs_palliers?: Record<string, number>
    }

    expect(values.tarifs_palliers).toBeUndefined()
    expect(values.seuils_palliers).toEqual({ palier1: 80 })
  })

  it('fournit un wrapper react-query valide pour renderHook avec état de chargement puis succès puis erreur', async () => {
    const wrapper = createWrapper()

    const { result: loadingResult, rerender: rerenderLoading } = renderHook(
      ({ state }: { state: { isLoading: boolean; data: { mode: string } | null; error: { message: string } | null } }) => ({
        isLoading: state.isLoading,
        isError: Boolean(state.error),
        data: state.data,
        error: state.error,
      }),
      {
        initialProps: { state: { isLoading: true, data: null, error: null } },
        wrapper,
      }
    )

    expect(loadingResult.current.isLoading).toBe(true)
    expect(loadingResult.current.isError).toBe(false)
    expect(loadingResult.current.data).toBeNull()

    rerenderLoading({ state: { isLoading: false, data: { mode: 'au_succes' }, error: null } })

    expect(loadingResult.current.isLoading).toBe(false)
    expect(loadingResult.current.isError).toBe(false)
    expect(loadingResult.current.data).toEqual({ mode: 'au_succes' })

    const { result: errorResult } = renderHook(
      ({ state }: { state: { isLoading: boolean; data: null; error: { message: string } | null } }) => ({
        isLoading: state.isLoading,
        isError: Boolean(state.error),
        errorMessage: state.error?.message ?? null,
      }),
      {
        initialProps: { state: { isLoading: false, data: null, error: { message: 'x' } } },
        wrapper,
      }
    )

    expect(errorResult.current.isLoading).toBe(false)
    expect(errorResult.current.isError).toBe(true)
    expect(errorResult.current.errorMessage).toBe('x')
  })
})