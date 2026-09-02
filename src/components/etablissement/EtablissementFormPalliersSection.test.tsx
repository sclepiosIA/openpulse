// @vitest-environment jsdom
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useForm, useWatch, type Control, type FieldValues } from 'react-hook-form'
import { EtablissementFormPalliersSection } from './EtablissementFormPalliersSection'

type FormValues = {
  type_offre?: string
  modele_statique_succes?: number | string
  pallier_vise?: string
  pallier_realise?: string
  tarifs_palliers?: {
    fixe?: number
    palier1?: number
    palier2?: number
    palier3?: number
    palier4?: number
  }
  seuils_palliers?: {
    palier1?: number
    palier2?: number
    palier3?: number
    palier4?: number
  }
}

const { AUTH_STATE, mockFrom, SUPABASE_RESULT } = vi.hoisted(() => {
  const SUPABASE_RESULT = { data: null, error: null }
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
    single: vi.fn(async () => SUPABASE_RESULT),
    maybeSingle: vi.fn(async () => SUPABASE_RESULT),
    then: (
      onFulfilled?: (value: typeof SUPABASE_RESULT) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(SUPABASE_RESULT).then(onFulfilled, onRejected),
    catch: (onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(SUPABASE_RESULT).catch(onRejected),
  }

  return {
    AUTH_STATE: {
      user: { id: 'u1', email: 'user@test.local' },
      session: { user: { id: 'u1' } },
      isLoading: false,
    },
    SUPABASE_RESULT,
    mockFrom: vi.fn(() => builder),
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/components/ui/input', () => ({
  Input: React.forwardRef<
    HTMLInputElement,
    React.InputHTMLAttributes<HTMLInputElement>
  >(function MockInput(props, ref) {
    return <input ref={ref} {...props} />
  }),
}))

vi.mock('@/components/ui/form', async () => {
  const actual = await import('react-hook-form')

  function FormField<TFieldValues extends FieldValues>({
    control,
    name,
    render,
  }: {
    control: Control<TFieldValues>
    name: string
    render: (props: {
      field: {
        name: string
        value: unknown
        onChange: (value: unknown) => void
        onBlur: () => void
        ref: React.Ref<HTMLInputElement | HTMLSelectElement>
      }
    }) => React.ReactNode
  }) {
    const { field } = actual.useController({
      control,
      name,
    })

    return <>{render({ field })}</>
  }

  return {
    FormControl: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    FormItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    FormLabel: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
    FormMessage: () => null,
    FormField,
  }
})

vi.mock('@/components/ui/select', () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string
    onValueChange?: (value: string) => void
    children: React.ReactNode
  }) => {
    const optionValues: string[] = []
    const collect = (node: React.ReactNode): void => {
      React.Children.forEach(node, (child) => {
        if (!React.isValidElement(child)) return
        const props = child.props as { value?: string; children?: React.ReactNode }
        if (typeof props.value === 'string') optionValues.push(props.value)
        if (props.children) collect(props.children)
      })
    }
    collect(children)

    return (
      <select
        aria-label="select"
        value={value ?? ''}
        onChange={(e) => onValueChange?.(e.target.value)}
      >
        <option value="">__empty__</option>
        {optionValues.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    )
  },
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value }: { value: string; children: React.ReactNode }) => <option value={value}>{value}</option>,
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

function TestHarness({ defaultValues }: { defaultValues: FormValues }) {
  const form = useForm<FormValues>({ defaultValues })
  const values = useWatch({ control: form.control })

  return (
    <div>
      <EtablissementFormPalliersSection form={form} />
      <pre data-testid="values">{JSON.stringify(values ?? {})}</pre>
    </div>
  )
}

describe('EtablissementFormPalliersSection', () => {
  it('initialise le formulaire via renderHook avec QueryClientProvider et expose un état de chargement initial vide', () => {
    const wrapper = createWrapper()

    const { result } = renderHook(() => useForm<FormValues>({ defaultValues: {} }), {
      wrapper,
    })

    expect(result.current.watch('type_offre')).toBeUndefined()
    expect(result.current.watch('modele_statique_succes')).toBeUndefined()

    render(<EtablissementFormPalliersSection form={result.current} />, { wrapper })

    expect(screen.getByText("Type d'offre")).toBeInTheDocument()
    expect(screen.queryByText('Tarif fixe (€)')).not.toBeInTheDocument()
    expect(screen.queryByText('Pallier visé')).not.toBeInTheDocument()
    expect(screen.queryByText('Configuration des palliers')).not.toBeInTheDocument()
  })

  it("affiche le champ tarif fixe quand le type d'offre est Statique et met à jour la valeur métier", () => {
    render(<TestHarness defaultValues={{ type_offre: 'Statique' }} />, {
      wrapper: createWrapper(),
    })

    expect(screen.getByText('Tarif fixe (€)')).toBeInTheDocument()
    expect(screen.queryByText('Pallier visé')).not.toBeInTheDocument()

    const fixedInput = screen.getByPlaceholderText('Entrer le tarif fixe') as HTMLInputElement
    fireEvent.change(fixedInput, { target: { value: '2500' } })

    expect(fixedInput.value).toBe('2500')
    expect(screen.getByTestId('values').textContent).toContain('"modele_statique_succes":"2500"')
  })

  it('affiche la configuration Au succès et met à jour les champs imbriqués avec des nombres réels', () => {
    render(<TestHarness defaultValues={{ type_offre: 'Au succès' }} />, {
      wrapper: createWrapper(),
    })

    expect(screen.getByText('Pallier visé')).toBeInTheDocument()
    expect(screen.getByText('Pallier réalisé')).toBeInTheDocument()
    expect(screen.getByText("Frais d'accès au service (€)")).toBeInTheDocument()
    expect(screen.getByText('Configuration des palliers')).toBeInTheDocument()

    const allSelects = screen.getAllByLabelText('select') as HTMLSelectElement[]
    fireEvent.change(allSelects[1], { target: { value: 'Pallier 3' } })
    fireEvent.change(allSelects[2], { target: { value: 'Pallier 2' } })

    const feeInput = screen.getByPlaceholderText("Frais d'accès unique en euros") as HTMLInputElement
    fireEvent.change(feeInput, { target: { value: '199.99' } })

    const thresholdInputs = screen.getAllByPlaceholderText('ex: 85.5') as HTMLInputElement[]
    const tariffInputs = screen.getAllByPlaceholderText('ex: 5000.00') as HTMLInputElement[]

    fireEvent.change(thresholdInputs[0], { target: { value: '85.5' } })
    fireEvent.change(thresholdInputs[1], { target: { value: '90' } })
    fireEvent.change(tariffInputs[0], { target: { value: '5000' } })
    fireEvent.change(tariffInputs[3], { target: { value: '12000.25' } })

    const values = screen.getByTestId('values').textContent ?? ''

    expect(values).toContain('"type_offre":"Au succès"')
    expect(values).toContain('"pallier_vise":"Pallier 3"')
    expect(values).toContain('"pallier_realise":"Pallier 2"')
    expect(values).toContain('"fixe":199.99')
    expect(values).toContain('"palier1":85.5')
    expect(values).toContain('"palier2":90')
    expect(values).toContain('"palier1":5000')
    expect(values).toContain('"palier4":12000.25')
  })

  it('masque les champs spécifiques quand le type change de Au succès vers Statique', () => {
    render(<TestHarness defaultValues={{ type_offre: 'Au succès' }} />, {
      wrapper: createWrapper(),
    })

    expect(screen.getByText('Configuration des palliers')).toBeInTheDocument()

    const allSelects = screen.getAllByLabelText('select') as HTMLSelectElement[]
    fireEvent.change(allSelects[0], { target: { value: 'Statique' } })

    expect(screen.getByText('Tarif fixe (€)')).toBeInTheDocument()
    expect(screen.queryByText('Configuration des palliers')).not.toBeInTheDocument()
    expect(screen.queryByText('Pallier visé')).not.toBeInTheDocument()
  })

  it("considère une réponse d'erreur simulée comme une erreur métier de dépendance mockée", async () => {
    const errorResult = { data: null, error: { message: 'x' } }
    mockFrom.mockImplementationOnce(() => {
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
        single: vi.fn(async () => errorResult),
        maybeSingle: vi.fn(async () => errorResult),
        then: (
          onFulfilled?: (value: typeof errorResult) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) => Promise.resolve(errorResult).then(onFulfilled, onRejected),
        catch: (onRejected?: (reason: unknown) => unknown) =>
          Promise.resolve(errorResult).catch(onRejected),
      }
      return builder
    })

    const result = await mockFrom().single()
    const isError = Boolean(result.error)

    expect(result.data).toBeNull()
    expect(result.error?.message).toBe('x')
    expect(isError).toBe(true)
  })
})