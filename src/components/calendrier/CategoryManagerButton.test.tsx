import '@testing-library/jest-dom/vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { CategoryManagerButton } from './CategoryManagerButton'

type MockButtonProps = ComponentPropsWithoutRef<'button'> & {
  asChild?: boolean
  variant?: string
  size?: string
}

type MockDivProps = ComponentPropsWithoutRef<'div'> & {
  asChild?: boolean
  align?: string
}

const {
  COLORS,
  CATEGORY_ROWS,
  EMPTY_ROWS,
  SUCCESS_QUERY_RESULT,
  EMPTY_QUERY_RESULT,
  LOADING_QUERY_RESULT,
  ERROR_QUERY_RESULT,
  hookState,
  CREATE_MUTATION,
  UPDATE_MUTATION,
  DELETE_MUTATION,
  mockUseCalendarCategories,
  mockUseCreateCalendarCategory,
  mockUseUpdateCalendarCategory,
  mockUseDeleteCalendarCategory,
} = vi.hoisted(() => {
  type Category = {
    id: string
    name: string
    color: string
  }

  type CategoriesResult = {
    data: Category[] | undefined
    isLoading: boolean
    isError: boolean
    error: { message: string } | null
  }

  const COLORS = ['#0ea5e9', '#22c55e', '#ef4444']

  const CATEGORY_ROWS: Category[] = [
    { id: 'cat-1', name: 'Consultations', color: COLORS[0] },
    { id: 'cat-2', name: 'Urgences', color: COLORS[1] },
  ]

  const EMPTY_ROWS: Category[] = []

  const SUCCESS_QUERY_RESULT: CategoriesResult = {
    data: CATEGORY_ROWS,
    isLoading: false,
    isError: false,
    error: null,
  }

  const EMPTY_QUERY_RESULT: CategoriesResult = {
    data: EMPTY_ROWS,
    isLoading: false,
    isError: false,
    error: null,
  }

  const LOADING_QUERY_RESULT: CategoriesResult = {
    data: undefined,
    isLoading: true,
    isError: false,
    error: null,
  }

  const ERROR_QUERY_RESULT: CategoriesResult = {
    data: undefined,
    isLoading: false,
    isError: true,
    error: { message: 'x' },
  }

  const hookState: { current: CategoriesResult } = {
    current: SUCCESS_QUERY_RESULT,
  }

  const CREATE_MUTATION = {
    mutateAsync: vi.fn(async (input: unknown) => input),
    isPending: false,
  }

  const UPDATE_MUTATION = {
    mutateAsync: vi.fn(async (input: unknown) => input),
    isPending: false,
  }

  const DELETE_MUTATION = {
    mutateAsync: vi.fn(async (input: unknown) => input),
    isPending: false,
  }

  const mockUseCalendarCategories = vi.fn(() => hookState.current)
  const mockUseCreateCalendarCategory = vi.fn(() => CREATE_MUTATION)
  const mockUseUpdateCalendarCategory = vi.fn(() => UPDATE_MUTATION)
  const mockUseDeleteCalendarCategory = vi.fn(() => DELETE_MUTATION)

  return {
    COLORS,
    CATEGORY_ROWS,
    EMPTY_ROWS,
    SUCCESS_QUERY_RESULT,
    EMPTY_QUERY_RESULT,
    LOADING_QUERY_RESULT,
    ERROR_QUERY_RESULT,
    hookState,
    CREATE_MUTATION,
    UPDATE_MUTATION,
    DELETE_MUTATION,
    mockUseCalendarCategories,
    mockUseCreateCalendarCategory,
    mockUseUpdateCalendarCategory,
    mockUseDeleteCalendarCategory,
  }
})

vi.mock('@/hooks/calendar/useCalendarCategories', () => ({
  useCalendarCategories: mockUseCalendarCategories,
  useCreateCalendarCategory: mockUseCreateCalendarCategory,
  useUpdateCalendarCategory: mockUseUpdateCalendarCategory,
  useDeleteCalendarCategory: mockUseDeleteCalendarCategory,
}))

vi.mock('@/types/calendar', () => ({
  CALENDAR_COLORS: COLORS,
}))

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
  formatNumber: (value: number) => String(value),
}))

vi.mock('@/components/ui/button', async () => {
  const React = await import('react')

  const Button = React.forwardRef<HTMLButtonElement, MockButtonProps>(
    ({ children, asChild: _asChild, variant: _variant, size: _size, type, ...props }, ref) =>
      React.createElement('button', { ...props, ref, type: type ?? 'button' }, children)
  )

  Button.displayName = 'Button'

  return {
    Button,
    buttonVariants: () => '',
  }
})

vi.mock('@/components/ui/input', async () => {
  const React = await import('react')

  const Input = React.forwardRef<HTMLInputElement, ComponentPropsWithoutRef<'input'>>(
    (props, ref) => React.createElement('input', { ...props, ref })
  )

  Input.displayName = 'Input'

  return { Input }
})

vi.mock('@/components/ui/popover', async () => {
  const React = await import('react')

  const Popover = ({ children }: MockDivProps) =>
    React.createElement('div', { 'data-testid': 'popover-root' }, children)

  const PopoverTrigger = ({ children }: MockDivProps) =>
    React.createElement(React.Fragment, null, children)

  const PopoverContent = React.forwardRef<HTMLDivElement, MockDivProps>(
    ({ children, align: _align, asChild: _asChild, ...props }, ref) =>
      React.createElement('div', { ...props, ref, 'data-testid': 'popover-content' }, children)
  )

  PopoverContent.displayName = 'PopoverContent'

  return {
    Popover,
    PopoverTrigger,
    PopoverContent,
  }
})

vi.mock('@/components/ui/tooltip', async () => {
  const React = await import('react')

  const TooltipProvider = ({ children }: MockDivProps) =>
    React.createElement(React.Fragment, null, children)

  const Tooltip = ({ children }: MockDivProps) =>
    React.createElement(React.Fragment, null, children)

  const TooltipTrigger = ({ children }: MockDivProps) =>
    React.createElement(React.Fragment, null, children)

  const TooltipContent = ({ children }: MockDivProps) =>
    React.createElement('div', { role: 'tooltip' }, children)

  return {
    TooltipProvider,
    Tooltip,
    TooltipTrigger,
    TooltipContent,
  }
})

vi.mock('lucide-react', async () => {
  const React = await import('react')

  type IconProps = {
    className?: string
  }

  const makeIcon = (name: string) => {
    const Icon = ({ className }: IconProps) =>
      React.createElement('svg', {
        'aria-hidden': 'true',
        className,
        'data-testid': `icon-${name}`,
      })

    return Icon
  }

  return {
    Tag: makeIcon('tag'),
    Plus: makeIcon('plus'),
    Trash2: makeIcon('trash'),
    Check: makeIcon('check'),
    X: makeIcon('x'),
    Pencil: makeIcon('pencil'),
  }
})

function renderWithProviders(ui: ReactNode) {
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

  hookState.current = SUCCESS_QUERY_RESULT
  CREATE_MUTATION.isPending = false
  UPDATE_MUTATION.isPending = false
  DELETE_MUTATION.isPending = false

  CREATE_MUTATION.mutateAsync.mockImplementation(async (input: unknown) => input)
  UPDATE_MUTATION.mutateAsync.mockImplementation(async (input: unknown) => input)
  DELETE_MUTATION.mutateAsync.mockImplementation(async (input: unknown) => input)
})

afterEach(() => {
  cleanup()
})

describe('CategoryManagerButton', () => {
  it('affiche le bouton, le titre et les catégories existantes', () => {
    renderWithProviders(<CategoryManagerButton />)

    expect(screen.getByRole('button', { name: 'Gérer les catégories' })).toBeInTheDocument()
    expect(screen.getByText('Mes catégories')).toBeInTheDocument()
    expect(screen.getByText("Gérer les catégories d'évènements")).toBeInTheDocument()
    expect(screen.getByText(CATEGORY_ROWS[0].name)).toBeInTheDocument()
    expect(screen.getByText(CATEGORY_ROWS[1].name)).toBeInTheDocument()
    expect(screen.queryByText('Aucune catégorie. Créez la première.')).not.toBeInTheDocument()
    expect(mockUseCalendarCategories).toHaveBeenCalledTimes(1)
  })

  it('affiche le message vide quand aucune catégorie n’existe', () => {
    hookState.current = EMPTY_QUERY_RESULT

    renderWithProviders(<CategoryManagerButton />)

    expect(screen.getByText('Mes catégories')).toBeInTheDocument()
    expect(screen.getByText('Aucune catégorie. Créez la première.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Nouvelle/i })).toBeInTheDocument()
    expect(screen.queryByText('Consultations')).not.toBeInTheDocument()
    expect(EMPTY_ROWS).toHaveLength(0)
  })

  it('reste stable pendant le chargement des catégories', () => {
    hookState.current = LOADING_QUERY_RESULT

    renderWithProviders(<CategoryManagerButton />)

    expect(screen.getByRole('button', { name: 'Gérer les catégories' })).toBeInTheDocument()
    expect(screen.getByText('Mes catégories')).toBeInTheDocument()
    expect(screen.getByText('Aucune catégorie. Créez la première.')).toBeInTheDocument()
    expect(screen.queryByText('Urgences')).not.toBeInTheDocument()
  })

  it('reste stable quand le hook des catégories est en erreur', () => {
    hookState.current = ERROR_QUERY_RESULT

    renderWithProviders(<CategoryManagerButton />)

    expect(screen.getByRole('button', { name: 'Gérer les catégories' })).toBeInTheDocument()
    expect(screen.getByText('Aucune catégorie. Créez la première.')).toBeInTheDocument()
    expect(screen.queryByText('Consultations')).not.toBeInTheDocument()
    expect(ERROR_QUERY_RESULT.isError).toBe(true)
    expect(ERROR_QUERY_RESULT.error).toEqual({ message: 'x' })
  })

  it('crée une catégorie avec le nom trimé et la couleur sélectionnée', async () => {
    const user = userEvent.setup()

    renderWithProviders(<CategoryManagerButton />)

    await user.click(screen.getByRole('button', { name: /Nouvelle/i }))

    const input = screen.getByPlaceholderText('Nom de la catégorie')
    const createButton = screen.getByRole('button', { name: 'Créer' })

    expect(createButton).toBeDisabled()

    await user.type(input, '  Suivi patient  ')
    await user.click(screen.getByRole('button', { name: `Couleur ${COLORS[2]}` }))

    expect(createButton).not.toBeDisabled()

    await act(async () => {
      await user.click(createButton)
    })

    await waitFor(() => {
      expect(CREATE_MUTATION.mutateAsync).toHaveBeenCalledWith({
        name: 'Suivi patient',
        color: COLORS[2],
      })
    })

    expect(screen.queryByPlaceholderText('Nom de la catégorie')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Nouvelle/i })).toBeInTheDocument()
  })

  it('désactive le bouton Créer pendant une création en cours', async () => {
    const user = userEvent.setup()
    CREATE_MUTATION.isPending = true

    renderWithProviders(<CategoryManagerButton />)

    await user.click(screen.getByRole('button', { name: /Nouvelle/i }))
    await user.type(screen.getByPlaceholderText('Nom de la catégorie'), 'Administratif')

    expect(screen.getByRole('button', { name: 'Créer' })).toBeDisabled()
    expect(CREATE_MUTATION.mutateAsync).not.toHaveBeenCalled()
  })

  it('renomme et recolore une catégorie existante', async () => {
    const user = userEvent.setup()

    renderWithProviders(<CategoryManagerButton />)

    await user.click(screen.getAllByLabelText('Modifier')[0])

    const editInput = screen.getByPlaceholderText('Nom')
    expect(editInput).toBeInstanceOf(HTMLInputElement)

    if (!(editInput instanceof HTMLInputElement)) {
      return
    }

    expect(editInput.value).toBe('Consultations')

    await user.clear(editInput)
    await user.type(editInput, '  Consultations premium  ')
    await user.click(screen.getByRole('button', { name: `Couleur ${COLORS[1]}` }))

    const saveIcon = screen.getByTestId('icon-check')
    const saveButton = saveIcon.closest('button')

    expect(saveButton).toBeInstanceOf(HTMLButtonElement)

    if (!(saveButton instanceof HTMLButtonElement)) {
      return
    }

    await act(async () => {
      await user.click(saveButton)
    })

    await waitFor(() => {
      expect(UPDATE_MUTATION.mutateAsync).toHaveBeenCalledWith({
        id: 'cat-1',
        name: 'Consultations premium',
        color: COLORS[1],
      })
    })

    expect(screen.queryByPlaceholderText('Nom')).not.toBeInTheDocument()
  })

  it('supprime la catégorie sélectionnée', async () => {
    const user = userEvent.setup()

    renderWithProviders(<CategoryManagerButton />)

    await act(async () => {
      await user.click(screen.getAllByLabelText('Supprimer')[0])
    })

    expect(DELETE_MUTATION.mutateAsync).toHaveBeenCalledTimes(1)
    expect(DELETE_MUTATION.mutateAsync).toHaveBeenCalledWith('cat-1')
  })
})
