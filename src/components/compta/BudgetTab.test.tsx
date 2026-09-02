import { cleanup, fireEvent, render, screen, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type * as ReactTypes from 'react'

const {
  hookState,
  budgetsSuccessResult,
  budgetsLoadingResult,
  budgetsErrorResult,
  exercicesSuccessResult,
  comptesSuccessResult,
  lignesSuccessResult,
  vsReelSuccessResult,
  createdBudget,
  mockUseBudgets,
  mockUseBudgetLignes,
  mockUseBudgetVsReel,
  mockUseCreateBudget,
  mockUseUpsertBudgetLigne,
  mockUseDeleteBudget,
  mockUseComptaComptes,
  mockUseComptaExercices,
  mockCreateMutateAsync,
  mockUpsertMutate,
  mockDeleteMutate,
  mockToastSuccess,
  mockToastError,
  mockConfirm,
  mockFrom,
} = vi.hoisted(() => {
  const BUDGETS = [{ id: 'budget-2024', libelle: 'Budget annuel 2024', statut: 'brouillon' }]

  const EXERCICES = [
    { id: 'exercice-2024', libelle: 'Exercice 2024' },
    { id: 'exercice-2025', libelle: 'Exercice 2025' },
  ]

  const COMPTES = [
    { id: 'compte-charge', numero: '606000', libelle: 'Fournitures', classe: 6 },
    { id: 'compte-produit', numero: '700000', libelle: 'Ventes', classe: 7 },
    { id: 'compte-stock', numero: '607000', libelle: 'Marchandises', classe: 6 },
    { id: 'compte-banque', numero: '512000', libelle: 'Banque', classe: 5 },
  ]

  const LIGNES = [
    { id: 'ligne-1', budget_id: 'budget-2024', compte_id: 'compte-charge', mois: 1, montant: 1200 },
    { id: 'ligne-2', budget_id: 'budget-2024', compte_id: 'compte-charge', mois: 2, montant: 300 },
    {
      id: 'ligne-3',
      budget_id: 'budget-2024',
      compte_id: 'compte-produit',
      mois: 1,
      montant: 2000,
    },
  ]

  const VS_REEL = [
    { compte_id: 'compte-charge', mois: 1, montant_reel: 1100 },
    { compte_id: 'compte-produit', mois: 1, montant_reel: 2500 },
  ]

  const CREATED_BUDGET = { id: 'budget-created', libelle: 'Budget test', statut: 'brouillon' }

  const BUDGETS_SUCCESS_RESULT = { data: BUDGETS, isLoading: false, isError: false, error: null }
  const BUDGETS_LOADING_RESULT = { data: undefined, isLoading: true, isError: false, error: null }
  const BUDGETS_ERROR_RESULT = {
    data: null,
    isLoading: false,
    isError: true,
    error: { message: 'x' },
  }
  const EXERCICES_SUCCESS_RESULT = {
    data: EXERCICES,
    isLoading: false,
    isError: false,
    error: null,
  }
  const COMPTES_SUCCESS_RESULT = { data: COMPTES, isLoading: false, isError: false, error: null }
  const LIGNES_SUCCESS_RESULT = { data: LIGNES, isLoading: false, isError: false, error: null }
  const VS_REEL_SUCCESS_RESULT = { data: VS_REEL, isLoading: false, isError: false, error: null }

  const HOOK_STATE = {
    budgets: BUDGETS_SUCCESS_RESULT,
    exercices: EXERCICES_SUCCESS_RESULT,
    comptes: COMPTES_SUCCESS_RESULT,
    lignes: LIGNES_SUCCESS_RESULT,
    vsReel: VS_REEL_SUCCESS_RESULT,
  }

  const CREATE_MUTATE_ASYNC = vi.fn(async () => CREATED_BUDGET)
  const UPSERT_MUTATE = vi.fn()
  const DELETE_MUTATE = vi.fn()
  const TOAST_SUCCESS = vi.fn()
  const TOAST_ERROR = vi.fn()
  const CONFIRM = vi.fn(() => true)

  const CREATE_RESULT = { mutateAsync: CREATE_MUTATE_ASYNC }
  const UPSERT_RESULT = { mutate: UPSERT_MUTATE }
  const DELETE_RESULT = { mutate: DELETE_MUTATE }

  const SUPABASE_RESULT = { data: null, error: null }
  const builder: Record<string, unknown> = {}
  const chain = vi.fn(() => builder)

  Object.assign(builder, {
    select: chain,
    eq: chain,
    neq: chain,
    gte: chain,
    gt: chain,
    lte: chain,
    lt: chain,
    in: chain,
    order: chain,
    limit: chain,
    range: chain,
    insert: chain,
    update: chain,
    delete: chain,
    upsert: chain,
    is: chain,
    not: chain,
    match: chain,
    contains: chain,
    single: vi.fn(async () => SUPABASE_RESULT),
    maybeSingle: vi.fn(async () => SUPABASE_RESULT),
    then: vi.fn(
      (
        onFulfilled?: (value: typeof SUPABASE_RESULT) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) => Promise.resolve(SUPABASE_RESULT).then(onFulfilled, onRejected)
    ),
    catch: vi.fn((onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(SUPABASE_RESULT).catch(onRejected)
    ),
  })

  return {
    hookState: HOOK_STATE,
    budgetsSuccessResult: BUDGETS_SUCCESS_RESULT,
    budgetsLoadingResult: BUDGETS_LOADING_RESULT,
    budgetsErrorResult: BUDGETS_ERROR_RESULT,
    exercicesSuccessResult: EXERCICES_SUCCESS_RESULT,
    comptesSuccessResult: COMPTES_SUCCESS_RESULT,
    lignesSuccessResult: LIGNES_SUCCESS_RESULT,
    vsReelSuccessResult: VS_REEL_SUCCESS_RESULT,
    createdBudget: CREATED_BUDGET,
    mockUseBudgets: vi.fn(() => HOOK_STATE.budgets),
    mockUseBudgetLignes: vi.fn(() => HOOK_STATE.lignes),
    mockUseBudgetVsReel: vi.fn(() => HOOK_STATE.vsReel),
    mockUseCreateBudget: vi.fn(() => CREATE_RESULT),
    mockUseUpsertBudgetLigne: vi.fn(() => UPSERT_RESULT),
    mockUseDeleteBudget: vi.fn(() => DELETE_RESULT),
    mockUseComptaComptes: vi.fn(() => HOOK_STATE.comptes),
    mockUseComptaExercices: vi.fn(() => HOOK_STATE.exercices),
    mockCreateMutateAsync: CREATE_MUTATE_ASYNC,
    mockUpsertMutate: UPSERT_MUTATE,
    mockDeleteMutate: DELETE_MUTATE,
    mockToastSuccess: TOAST_SUCCESS,
    mockToastError: TOAST_ERROR,
    mockConfirm: CONFIRM,
    mockFrom: vi.fn(() => builder),
  }
})

type DivProps = ReactTypes.HTMLAttributes<HTMLDivElement>
type HeadingProps = ReactTypes.HTMLAttributes<HTMLHeadingElement>
type ButtonProps = ReactTypes.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean
  variant?: string
  size?: string
}
type InputProps = ReactTypes.InputHTMLAttributes<HTMLInputElement>
type LabelProps = ReactTypes.LabelHTMLAttributes<HTMLLabelElement>
type TableProps = ReactTypes.TableHTMLAttributes<HTMLTableElement>
type TableSectionProps = ReactTypes.HTMLAttributes<HTMLTableSectionElement>
type TableRowProps = ReactTypes.HTMLAttributes<HTMLTableRowElement>
type TableCellProps = ReactTypes.TdHTMLAttributes<HTMLTableCellElement>
type TableHeadProps = ReactTypes.ThHTMLAttributes<HTMLTableCellElement>

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('@/hooks/compta/useBudget', () => ({
  useBudgets: mockUseBudgets,
  useBudgetLignes: mockUseBudgetLignes,
  useBudgetVsReel: mockUseBudgetVsReel,
  useCreateBudget: mockUseCreateBudget,
  useUpsertBudgetLigne: mockUseUpsertBudgetLigne,
  useDeleteBudget: mockUseDeleteBudget,
}))

vi.mock('@/hooks/compta/useCompta', () => ({
  useComptaComptes: mockUseComptaComptes,
  useComptaExercices: mockUseComptaExercices,
}))

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}))

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => (
    <span aria-hidden="true" className={className} />
  )
  return {
    Plus: Icon,
    Trash2: Icon,
    TrendingUp: Icon,
    TrendingDown: Icon,
  }
})

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: DivProps) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: DivProps) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: DivProps) => <div {...props}>{children}</div>,
  CardFooter: ({ children, ...props }: DivProps) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: HeadingProps) => <h2 {...props}>{children}</h2>,
  CardDescription: ({ children, ...props }: DivProps) => <div {...props}>{children}</div>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    asChild: _asChild,
    variant,
    size,
    type = 'button',
    ...props
  }: ButtonProps) => {
    const testId = size === 'sm' && variant === undefined ? 'add-compte-button' : undefined

    return (
      <button type={type} data-variant={variant} data-size={size} data-testid={testId} {...props}>
        {children}
      </button>
    )
  },
  buttonVariants: () => '',
}))

vi.mock('@/components/ui/input', () => ({
  Input: (props: InputProps) => <input {...props} />,
}))

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: LabelProps) => <label {...props}>{children}</label>,
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant, ...props }: DivProps & { variant?: string }) => (
    <div data-variant={variant} {...props}>
      {children}
    </div>
  ),
  badgeVariants: () => '',
}))

vi.mock('@/components/ui/table', () => ({
  Table: ({ children, ...props }: TableProps) => <table {...props}>{children}</table>,
  TableHeader: ({ children, ...props }: TableSectionProps) => <thead {...props}>{children}</thead>,
  TableBody: ({ children, ...props }: TableSectionProps) => <tbody {...props}>{children}</tbody>,
  TableRow: ({ children, ...props }: TableRowProps) => <tr {...props}>{children}</tr>,
  TableHead: ({ children, ...props }: TableHeadProps) => <th {...props}>{children}</th>,
  TableCell: ({ children, ...props }: TableCellProps) => <td {...props}>{children}</td>,
}))

vi.mock('@/components/ui/select', async () => {
  const React = await import('react')

  type SelectContextValue = {
    value?: string
    onValueChange?: (value: string) => void
  }

  type SelectProps = ReactTypes.PropsWithChildren<{
    value?: string
    onValueChange?: (value: string) => void
  }>

  type SelectValueProps = {
    placeholder?: string
  }

  type SelectItemProps = ReactTypes.PropsWithChildren<{
    value: string
  }>

  const SelectContext = React.createContext<SelectContextValue>({})

  return {
    Select: ({ children, value, onValueChange }: SelectProps) => (
      <SelectContext.Provider value={{ value, onValueChange }}>
        <div>{children}</div>
      </SelectContext.Provider>
    ),
    SelectTrigger: ({ children, ...props }: DivProps) => (
      <div role="button" tabIndex={0} {...props}>
        {children}
      </div>
    ),
    SelectValue: ({ placeholder }: SelectValueProps) => <span>{placeholder}</span>,
    SelectContent: ({ children, ...props }: DivProps) => <div {...props}>{children}</div>,
    SelectItem: ({ children, value }: SelectItemProps) => {
      const context = React.useContext(SelectContext)
      return (
        <button
          type="button"
          aria-pressed={context.value === value}
          onClick={() => context.onValueChange?.(value)}
        >
          {children}
        </button>
      )
    },
  }
})

vi.mock('@/components/ui/dialog', async () => {
  const React = await import('react')

  type DialogContextValue = {
    open: boolean
    onOpenChange: (open: boolean) => void
  }

  type DialogProps = ReactTypes.PropsWithChildren<{
    open?: boolean
    onOpenChange?: (open: boolean) => void
  }>

  type DialogTriggerProps = ReactTypes.PropsWithChildren<{
    asChild?: boolean
  }>

  const DialogContext = React.createContext<DialogContextValue>({
    open: false,
    onOpenChange: () => undefined,
  })

  return {
    Dialog: ({ children, open = false, onOpenChange = () => undefined }: DialogProps) => (
      <DialogContext.Provider value={{ open, onOpenChange }}>{children}</DialogContext.Provider>
    ),
    DialogTrigger: ({ children, asChild }: DialogTriggerProps) => {
      const context = React.useContext(DialogContext)
      const openDialog = () => context.onOpenChange(true)

      if (asChild) {
        const onlyChild = React.Children.only(children)
        if (
          React.isValidElement<{ onClick?: ReactTypes.MouseEventHandler<HTMLElement> }>(onlyChild)
        ) {
          const previousOnClick = onlyChild.props.onClick
          return React.cloneElement(onlyChild, {
            onClick: (event: ReactTypes.MouseEvent<HTMLElement>) => {
              previousOnClick?.(event)
              openDialog()
            },
          })
        }
      }

      return (
        <button type="button" onClick={openDialog}>
          {children}
        </button>
      )
    },
    DialogContent: ({ children, ...props }: DivProps) => {
      const context = React.useContext(DialogContext)
      if (!context.open) return null
      return (
        <div role="dialog" aria-modal="true" {...props}>
          {children}
        </div>
      )
    },
    DialogHeader: ({ children, ...props }: DivProps) => <div {...props}>{children}</div>,
    DialogTitle: ({ children, ...props }: HeadingProps) => <h2 {...props}>{children}</h2>,
    DialogFooter: ({ children, ...props }: DivProps) => <div {...props}>{children}</div>,
  }
})

import { BudgetTab } from './BudgetTab'

function eur(n: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n || 0)
}

function normalizeText(value: string) {
  return value
    .replace(/\u202f/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function expectElementTextToContain(element: Element, value: string) {
  expect(normalizeText(element.textContent ?? '')).toContain(normalizeText(value))
}

function getRowForText(text: string) {
  const cell = screen.getByText(text)
  const row = cell.closest('tr')
  if (!(row instanceof HTMLTableRowElement)) {
    throw new Error(`Ligne introuvable pour ${text}`)
  }
  return row
}

function renderWithProviders(ui: ReactTypes.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('confirm', mockConfirm)
  hookState.budgets = budgetsSuccessResult
  hookState.exercices = exercicesSuccessResult
  hookState.comptes = comptesSuccessResult
  hookState.lignes = lignesSuccessResult
  hookState.vsReel = vsReelSuccessResult
  mockCreateMutateAsync.mockResolvedValue(createdBudget)
  mockConfirm.mockReturnValue(true)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('BudgetTab', () => {
  it('affiche un état de chargement contrôlé sans budget sélectionnable', () => {
    hookState.budgets = budgetsLoadingResult

    renderWithProviders(<BudgetTab />)

    expect(screen.getByText('Sélectionnez ou créez un budget pour commencer.')).toBeTruthy()
    expect(screen.queryByText('Budget annuel 2024 (brouillon)')).toBeNull()
    expect(mockUseBudgets).toHaveBeenCalledTimes(1)
  })

  it('affiche un état vide stable quand le chargement des budgets échoue', () => {
    hookState.budgets = budgetsErrorResult

    renderWithProviders(<BudgetTab />)

    expect(screen.getByText('Sélectionnez ou créez un budget pour commencer.')).toBeTruthy()
    expect(screen.queryByText('Budget annuel 2024 (brouillon)')).toBeNull()
    expect(mockUseBudgets).toHaveBeenCalledTimes(1)
  })

  it('rend le sélecteur de budget et le message initial', () => {
    renderWithProviders(<BudgetTab />)

    expect(screen.getByText('Sélectionnez ou créez un budget pour commencer.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Budget annuel 2024 (brouillon)' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Nouveau budget/ })).toBeTruthy()
  })

  it('affiche la grille annuelle avec les montants budget, réel et écarts métier', () => {
    renderWithProviders(<BudgetTab />)

    fireEvent.click(screen.getByRole('button', { name: 'Budget annuel 2024 (brouillon)' }))

    expect(screen.getByText('Grille annuelle (charges & produits)')).toBeTruthy()
    expect(screen.getByText('Jan')).toBeTruthy()
    expect(screen.getByText('Déc')).toBeTruthy()
    expect(screen.getByText('606000 — Fournitures')).toBeTruthy()
    expect(screen.getByText('700000 — Ventes')).toBeTruthy()
    expect(screen.queryByText('512000 — Banque')).toBeNull()

    const chargeRow = getRowForText('606000 — Fournitures')
    const produitRow = getRowForText('700000 — Ventes')

    expectElementTextToContain(chargeRow, eur(1500))
    expectElementTextToContain(chargeRow, eur(1100))
    expectElementTextToContain(chargeRow, eur(-400))
    expectElementTextToContain(chargeRow, `R: ${eur(1100)}`)

    expectElementTextToContain(produitRow, eur(2000))
    expectElementTextToContain(produitRow, eur(2500))
    expectElementTextToContain(produitRow, eur(500))
    expectElementTextToContain(produitRow, `R: ${eur(2500)}`)
  })

  it('met à jour une ligne budgétaire au blur d’un montant modifié', () => {
    renderWithProviders(<BudgetTab />)

    fireEvent.click(screen.getByRole('button', { name: 'Budget annuel 2024 (brouillon)' }))

    const januaryInput = screen.getByDisplayValue('1200')
    fireEvent.change(januaryInput, { target: { value: '1300' } })
    fireEvent.blur(januaryInput)

    expect(mockUpsertMutate).toHaveBeenCalledWith({
      budget_id: 'budget-2024',
      compte_id: 'compte-charge',
      mois: 1,
      montant: 1300,
    })
  })

  it('ajoute un compte budgétable non encore utilisé', () => {
    renderWithProviders(<BudgetTab />)

    fireEvent.click(screen.getByRole('button', { name: 'Budget annuel 2024 (brouillon)' }))
    fireEvent.click(screen.getByRole('button', { name: '607000 — Marchandises' }))

    const addButton = screen.getByTestId('add-compte-button')
    expect(addButton).toBeTruthy()
    expect(addButton).not.toHaveProperty('disabled', true)

    fireEvent.click(addButton)

    expect(mockUpsertMutate).toHaveBeenCalledWith({
      budget_id: 'budget-2024',
      compte_id: 'compte-stock',
      mois: 1,
      montant: 0,
    })
  })

  it('supprime le budget sélectionné après confirmation', () => {
    const { container } = renderWithProviders(<BudgetTab />)

    fireEvent.click(screen.getByRole('button', { name: 'Budget annuel 2024 (brouillon)' }))

    const deleteButton = container.querySelector('button[data-variant="outline"][data-size="sm"]')
    expect(deleteButton).toBeTruthy()

    if (!(deleteButton instanceof HTMLButtonElement)) {
      throw new Error('Bouton de suppression introuvable')
    }

    fireEvent.click(deleteButton)

    expect(mockConfirm).toHaveBeenCalledWith('Supprimer ce budget ?')
    expect(mockDeleteMutate).toHaveBeenCalledWith('budget-2024')
    expect(screen.getByText('Sélectionnez ou créez un budget pour commencer.')).toBeTruthy()
  })

  it('valide le formulaire de création puis crée un budget avec libellé et exercice', async () => {
    renderWithProviders(<BudgetTab />)

    fireEvent.click(screen.getByRole('button', { name: /Nouveau budget/ }))

    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Nouveau budget' })).toBeTruthy()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Créer' }))
    })

    expect(mockToastError).toHaveBeenCalledWith('Libellé requis')
    expect(mockCreateMutateAsync).not.toHaveBeenCalled()

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Budget test' } })
    fireEvent.click(screen.getByRole('button', { name: 'Exercice 2024' }))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Créer' }))
    })

    await waitFor(() => {
      expect(mockCreateMutateAsync).toHaveBeenCalledWith({
        libelle: 'Budget test',
        exercice_id: 'exercice-2024',
      })
    })
  })
})
