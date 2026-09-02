import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from 'react'

type MessageError = { message: string }

const {
  COMPTES,
  JOURNAUX,
  EXERCICES,
  ECRITURES,
  LIGNES,
  EMPTY_BALANCE,
  EMPTY_GRAND_LIVRE,
  HOOK_ERROR,
  comptaState,
  mockFrom,
  mockRpc,
  mockStorageFrom,
  mockValidateMutate,
  mockDeleteMutate,
  mockCreateMutateAsync,
  mockToastSuccess,
  mockToastError,
  mockConfirm,
  AUTH_SESSION_RESULT,
  AUTH_USER_RESULT,
} = vi.hoisted(() => {
  const COMPTES = [
    {
      id: 'c-achats',
      numero: '606000',
      libelle: 'Achats non stockés',
      classe: 6,
      type: 'charge',
      lettrable: false,
    },
    {
      id: 'c-banque',
      numero: '512000',
      libelle: 'Banque',
      classe: 5,
      type: 'actif',
      lettrable: true,
    },
  ]

  const JOURNAUX = [
    { id: 'j-ach', code: 'ACH', libelle: 'Journal des achats' },
    { id: 'j-bq', code: 'BQ', libelle: 'Banque' },
  ]

  const EXERCICES = [{ id: 'ex-2024', libelle: 'Exercice 2024', statut: 'ouvert' }]

  const ECRITURES = [
    {
      id: 'ecr-1',
      journal_id: 'j-ach',
      date_ecriture: '2024-01-15',
      numero_piece: 'FAC-1',
      libelle: 'Achat fournitures',
      statut: 'brouillon',
    },
  ]

  const LIGNES = [
    {
      id: 'l-debit',
      compte_id: 'c-achats',
      libelle: 'Fournitures',
      debit: 120,
      credit: 0,
      lettrage: 'A1',
    },
    {
      id: 'l-credit',
      compte_id: 'c-banque',
      libelle: 'Règlement',
      debit: 0,
      credit: 120,
      lettrage: null,
    },
  ]

  const EMPTY_BALANCE: unknown[] = []
  const EMPTY_GRAND_LIVRE: unknown[] = []
  const HOOK_ERROR = { message: 'x' }

  const comptaState = {
    comptesData: COMPTES,
    journauxData: JOURNAUX,
    exercicesData: EXERCICES,
    ecrituresData: ECRITURES,
    lignesData: LIGNES,
    comptesLoading: false,
    journauxLoading: false,
    ecrituresLoading: false,
    comptesError: null as MessageError | null,
    ecrituresError: null as MessageError | null,
  }

  const SUPABASE_QUERY_RESULT = { data: EMPTY_BALANCE, error: null }
  const SUPABASE_SINGLE_RESULT = { data: null, error: null }
  const AUTH_SESSION_RESULT = {
    data: { session: { user: { id: 'u1', email: 't@t.co' } } },
    error: null,
  }
  const AUTH_USER_RESULT = { data: { user: { id: 'u1', email: 't@t.co' } }, error: null }

  const builder: Record<string, unknown> = {}
  const chain = vi.fn(() => builder)

  builder.select = chain
  builder.eq = chain
  builder.neq = chain
  builder.gte = chain
  builder.lte = chain
  builder.gt = chain
  builder.lt = chain
  builder.in = chain
  builder.is = chain
  builder.not = chain
  builder.or = chain
  builder.match = chain
  builder.contains = chain
  builder.order = chain
  builder.limit = chain
  builder.range = chain
  builder.insert = chain
  builder.update = chain
  builder.upsert = chain
  builder.delete = chain
  builder.returns = chain
  builder.csv = vi.fn(() => Promise.resolve(''))
  builder.single = vi.fn(() => Promise.resolve(SUPABASE_SINGLE_RESULT))
  builder.maybeSingle = vi.fn(() => Promise.resolve(SUPABASE_SINGLE_RESULT))
  builder.throwOnError = chain
  builder.then = vi.fn(
    (
      resolve?: (value: typeof SUPABASE_QUERY_RESULT) => unknown,
      reject?: (reason: unknown) => unknown
    ) => Promise.resolve(SUPABASE_QUERY_RESULT).then(resolve, reject)
  )
  builder.catch = vi.fn((reject?: (reason: unknown) => unknown) =>
    Promise.resolve(SUPABASE_QUERY_RESULT).catch(reject)
  )
  builder.finally = vi.fn((callback?: () => void) =>
    Promise.resolve(SUPABASE_QUERY_RESULT).finally(callback)
  )

  const storageBuilder = {
    upload: vi.fn(() => Promise.resolve(SUPABASE_SINGLE_RESULT)),
    download: vi.fn(() => Promise.resolve(SUPABASE_SINGLE_RESULT)),
    remove: vi.fn(() => Promise.resolve(SUPABASE_QUERY_RESULT)),
    getPublicUrl: vi.fn(() => ({ data: { publicUrl: '/mock-file.pdf' } })),
    list: vi.fn(() => Promise.resolve(SUPABASE_QUERY_RESULT)),
  }

  const mockFrom = vi.fn(() => builder)
  const mockRpc = vi.fn(() => Promise.resolve(SUPABASE_QUERY_RESULT))
  const mockStorageFrom = vi.fn(() => storageBuilder)
  const mockValidateMutate = vi.fn()
  const mockDeleteMutate = vi.fn()
  const mockCreateMutateAsync = vi.fn(() => Promise.resolve({ id: 'ecr-new' }))
  const mockToastSuccess = vi.fn()
  const mockToastError = vi.fn()
  const mockConfirm = vi.fn(() => true)

  return {
    COMPTES,
    JOURNAUX,
    EXERCICES,
    ECRITURES,
    LIGNES,
    EMPTY_BALANCE,
    EMPTY_GRAND_LIVRE,
    HOOK_ERROR,
    comptaState,
    mockFrom,
    mockRpc,
    mockStorageFrom,
    mockValidateMutate,
    mockDeleteMutate,
    mockCreateMutateAsync,
    mockToastSuccess,
    mockToastError,
    mockConfirm,
    AUTH_SESSION_RESULT,
    AUTH_USER_RESULT,
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
    auth: {
      getSession: vi.fn(() => Promise.resolve(AUTH_SESSION_RESULT)),
      getUser: vi.fn(() => Promise.resolve(AUTH_USER_RESULT)),
      onAuthStateChange: vi.fn(() => ({
        data: {
          subscription: {
            unsubscribe: vi.fn(),
          },
        },
      })),
    },
    storage: {
      from: mockStorageFrom,
    },
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}))

vi.mock('@/hooks/compta/useCompta', () => ({
  useComptaComptes: vi.fn(() => ({
    data: comptaState.comptesData,
    isLoading: comptaState.comptesLoading,
    error: comptaState.comptesError,
  })),
  useComptaJournaux: vi.fn(() => ({
    data: comptaState.journauxData,
    isLoading: comptaState.journauxLoading,
    error: null,
  })),
  useComptaExercices: vi.fn(() => ({
    data: comptaState.exercicesData,
    isLoading: false,
    error: null,
  })),
  useComptaEcritures: vi.fn(() => ({
    data: comptaState.ecrituresData,
    isLoading: comptaState.ecrituresLoading,
    error: comptaState.ecrituresError,
  })),
  useComptaLignes: vi.fn(() => ({
    data: comptaState.lignesData,
    isLoading: false,
    error: null,
  })),
  useBalance: vi.fn(() => ({
    data: EMPTY_BALANCE,
    isLoading: false,
    error: null,
  })),
  useGrandLivre: vi.fn(() => ({
    data: EMPTY_GRAND_LIVRE,
    isLoading: false,
    error: null,
  })),
  useCreateEcriture: vi.fn(() => ({
    mutateAsync: mockCreateMutateAsync,
    isPending: false,
  })),
  useValidateEcriture: vi.fn(() => ({
    mutate: mockValidateMutate,
    isPending: false,
  })),
  useDeleteEcriture: vi.fn(() => ({
    mutate: mockDeleteMutate,
    isPending: false,
  })),
}))

vi.mock('@/components/common/PageDataState', async () => {
  const React = await import('react')

  return {
    PageDataState: ({
      isLoading,
      isError,
      error,
      children,
    }: {
      isLoading?: boolean
      isError?: boolean
      error?: unknown
      children?: ReactNode
    }) => {
      if (isLoading) {
        return React.createElement('div', { role: 'status' }, 'Chargement comptabilité')
      }

      if (isError) {
        let message = 'Erreur inconnue'
        if (typeof error === 'object' && error !== null && 'message' in error) {
          message = String((error as { message?: unknown }).message)
        }
        return React.createElement('div', { role: 'alert' }, `Erreur comptable: ${message}`)
      }

      return React.createElement(React.Fragment, null, children)
    },
  }
})

vi.mock('@/components/ui/card', async () => {
  const React = await import('react')
  const Div = ({ children, ...props }: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) =>
    React.createElement('div', props, children)

  return {
    Card: Div,
    CardContent: Div,
    CardHeader: Div,
    CardTitle: ({
      children,
      ...props
    }: HTMLAttributes<HTMLHeadingElement> & { children?: ReactNode }) =>
      React.createElement('h2', props, children),
    CardDescription: Div,
    CardFooter: Div,
  }
})

vi.mock('@/components/ui/tabs', async () => {
  const React = await import('react')

  return {
    Tabs: ({
      children,
      ...props
    }: HTMLAttributes<HTMLDivElement> & {
      value?: string
      onValueChange?: (value: string) => void
      children?: ReactNode
    }) => React.createElement('div', props, children),
    TabsList: ({ children, ...props }: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) =>
      React.createElement('div', props, children),
    TabsTrigger: ({ children, value }: { children?: ReactNode; value?: string }) =>
      React.createElement('button', { type: 'button', 'data-tab-value': value }, children),
    TabsContent: ({ children, value }: { children?: ReactNode; value?: string }) =>
      value === 'ecritures'
        ? React.createElement('div', { 'data-testid': `tab-${value}` }, children)
        : null,
  }
})

vi.mock('@/components/ui/button', async () => {
  const React = await import('react')

  return {
    Button: ({
      children,
      asChild: _asChild,
      variant: _variant,
      size: _size,
      ...props
    }: ButtonHTMLAttributes<HTMLButtonElement> & {
      asChild?: boolean
      variant?: string
      size?: string
      children?: ReactNode
    }) => React.createElement('button', { type: 'button', ...props }, children),
    buttonVariants: vi.fn(() => ''),
  }
})

vi.mock('@/components/ui/input', async () => {
  const React = await import('react')

  return {
    Input: (props: InputHTMLAttributes<HTMLInputElement>) => React.createElement('input', props),
  }
})

vi.mock('@/components/ui/label', async () => {
  const React = await import('react')

  return {
    Label: ({
      children,
      ...props
    }: LabelHTMLAttributes<HTMLLabelElement> & { children?: ReactNode }) =>
      React.createElement('label', props, children),
  }
})

vi.mock('@/components/ui/badge', async () => {
  const React = await import('react')

  return {
    Badge: ({
      children,
      variant: _variant,
      ...props
    }: HTMLAttributes<HTMLSpanElement> & { variant?: string; children?: ReactNode }) =>
      React.createElement('span', props, children),
  }
})

vi.mock('@/components/ui/select', async () => {
  const React = await import('react')

  return {
    Select: ({
      children,
      value,
    }: {
      children?: ReactNode
      value?: string
      onValueChange?: (value: string) => void
    }) => React.createElement('div', { 'data-select-value': value ?? '' }, children),
    SelectTrigger: ({
      children,
      ...props
    }: ButtonHTMLAttributes<HTMLButtonElement> & { children?: ReactNode }) =>
      React.createElement('button', { type: 'button', ...props }, children),
    SelectValue: ({ placeholder }: { placeholder?: string }) =>
      React.createElement('span', null, placeholder),
    SelectContent: ({
      children,
      ...props
    }: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) =>
      React.createElement('div', props, children),
    SelectItem: ({ children, value }: { children?: ReactNode; value?: string }) =>
      React.createElement('div', { role: 'option', 'data-value': value }, children),
  }
})

vi.mock('@/components/ui/table', async () => {
  const React = await import('react')

  return {
    Table: ({
      children,
      ...props
    }: TableHTMLAttributes<HTMLTableElement> & { children?: ReactNode }) =>
      React.createElement('table', props, children),
    TableHeader: ({
      children,
      ...props
    }: HTMLAttributes<HTMLTableSectionElement> & { children?: ReactNode }) =>
      React.createElement('thead', props, children),
    TableBody: ({
      children,
      ...props
    }: HTMLAttributes<HTMLTableSectionElement> & { children?: ReactNode }) =>
      React.createElement('tbody', props, children),
    TableRow: ({
      children,
      ...props
    }: HTMLAttributes<HTMLTableRowElement> & { children?: ReactNode }) =>
      React.createElement('tr', props, children),
    TableHead: ({
      children,
      ...props
    }: ThHTMLAttributes<HTMLTableCellElement> & { children?: ReactNode }) =>
      React.createElement('th', props, children),
    TableCell: ({
      children,
      ...props
    }: TdHTMLAttributes<HTMLTableCellElement> & { children?: ReactNode }) =>
      React.createElement('td', props, children),
  }
})

vi.mock('@/components/ui/dialog', async () => {
  const React = await import('react')

  return {
    Dialog: ({
      children,
    }: {
      children?: ReactNode
      open?: boolean
      onOpenChange?: (open: boolean) => void
    }) => React.createElement('div', null, children),
    DialogTrigger: ({ children }: { children?: ReactNode; asChild?: boolean }) =>
      React.createElement(React.Fragment, null, children),
    DialogContent: () => null,
    DialogHeader: ({ children }: { children?: ReactNode }) =>
      React.createElement('div', null, children),
    DialogTitle: ({ children }: { children?: ReactNode }) =>
      React.createElement('h2', null, children),
    DialogFooter: ({ children }: { children?: ReactNode }) =>
      React.createElement('div', null, children),
  }
})

vi.mock('@/components/compta/BudgetTab', async () => {
  const React = await import('react')

  return {
    BudgetTab: () => React.createElement('div', { 'data-testid': 'budget-tab' }),
  }
})

vi.mock('lucide-react', async () => {
  const React = await import('react')
  const Icon = ({ testId }: { testId: string }) =>
    React.createElement('span', { 'data-testid': testId })

  return {
    Trash2: () => React.createElement(Icon, { testId: 'trash-icon' }),
    Plus: () => React.createElement(Icon, { testId: 'plus-icon' }),
    CheckCircle2: () => React.createElement(Icon, { testId: 'check-circle-icon' }),
    FileDown: () => React.createElement(Icon, { testId: 'file-down-icon' }),
    Sparkles: () => React.createElement(Icon, { testId: 'sparkles-icon' }),
    FileText: () => React.createElement(Icon, { testId: 'file-text-icon' }),
  }
})

import Comptabilite from './Comptabilite'

function renderComptabilite() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <Comptabilite />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('confirm', mockConfirm)
  mockConfirm.mockReturnValue(true)
  mockCreateMutateAsync.mockResolvedValue({ id: 'ecr-new' })

  comptaState.comptesData = COMPTES
  comptaState.journauxData = JOURNAUX
  comptaState.exercicesData = EXERCICES
  comptaState.ecrituresData = ECRITURES
  comptaState.lignesData = LIGNES
  comptaState.comptesLoading = false
  comptaState.journauxLoading = false
  comptaState.ecrituresLoading = false
  comptaState.comptesError = null
  comptaState.ecrituresError = null
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Comptabilite', () => {
  it('affiche un état de chargement quand les données comptables chargent', () => {
    comptaState.comptesLoading = true

    renderComptabilite()

    const status = screen.getByRole('status')
    expect(status.textContent).toContain('Chargement comptabilité')
    expect(screen.queryByRole('heading', { name: 'Comptabilité' })).toBeNull()
  })

  it('affiche les informations métier principales des écritures comptables', () => {
    renderComptabilite()

    expect(screen.getByRole('heading', { name: 'Comptabilité' })).toBeTruthy()
    expect(
      screen.getByText('Plan comptable, écritures, e-invoicing, FEC & lettrage IA')
    ).toBeTruthy()
    expect(screen.getByText('Exercice 2024 (ouvert)')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Nouvelle écriture/i })).toBeTruthy()

    expect(screen.getByText('2024-01-15')).toBeTruthy()
    expect(screen.getByText('ACH')).toBeTruthy()
    expect(screen.getByText('FAC-1')).toBeTruthy()
    expect(screen.getByText('Achat fournitures')).toBeTruthy()
    expect(screen.getByText('brouillon')).toBeTruthy()
  })

  it('déplie une écriture et affiche les lignes débit crédit associées', async () => {
    renderComptabilite()

    const ecritureCell = screen.getByText('Achat fournitures')

    await act(async () => {
      fireEvent.click(ecritureCell)
    })

    expect(
      screen.getByText(
        (content) => content.includes('606000') && content.includes('Achats non stockés')
      )
    ).toBeTruthy()
    expect(screen.getByText('Fournitures')).toBeTruthy()
    expect(
      screen.getAllByText((content) => content.includes('120,00') && content.includes('€')).length
    ).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('A1')).toBeTruthy()
  })

  it('déclenche les mutations de validation et suppression avec l’identifiant de l’écriture', async () => {
    renderComptabilite()

    await act(async () => {
      fireEvent.click(screen.getByTestId('check-circle-icon'))
    })

    expect(mockValidateMutate).toHaveBeenCalledTimes(1)
    expect(mockValidateMutate).toHaveBeenCalledWith('ecr-1')

    await act(async () => {
      fireEvent.click(screen.getByTestId('trash-icon'))
    })

    expect(mockConfirm).toHaveBeenCalledWith('Supprimer ?')
    expect(mockDeleteMutate).toHaveBeenCalledTimes(1)
    expect(mockDeleteMutate).toHaveBeenCalledWith('ecr-1')
  })

  it('affiche un état erreur quand un hook comptable remonte une erreur', () => {
    comptaState.ecrituresData = []
    comptaState.ecrituresError = HOOK_ERROR

    renderComptabilite()

    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('Erreur comptable: x')
    expect(screen.queryByText('Achat fournitures')).toBeNull()
  })
})
