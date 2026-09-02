import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SVGProps,
} from 'react'

type MockButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: string
  size?: string
  asChild?: boolean
}

type MockInputProps = InputHTMLAttributes<HTMLInputElement>

type MockPopoverProps = HTMLAttributes<HTMLDivElement> & {
  align?: string
  asChild?: boolean
  children?: ReactNode
}

const {
  CALENDAR_COLORS,
  CATEGORIES,
  CREATED_CATEGORY,
  UPDATED_CATEGORY,
  HOOK_STATE,
  mockCreateMutateAsync,
  mockUpdateMutateAsync,
  mockDeleteMutateAsync,
} = vi.hoisted(() => {
  type MockCategory = { id: string; name: string; color: string }
  type HookMode = 'success' | 'loading' | 'error'

  const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e']
  const categories: MockCategory[] = [
    { id: 'work', name: 'Travail', color: colors[0] },
    { id: 'personal', name: 'Perso', color: colors[1] },
  ]
  const created: MockCategory = { id: 'urgent', name: 'Urgent', color: colors[1] }
  const updated: MockCategory = { id: 'work', name: 'Travail modifié', color: colors[2] }

  return {
    CALENDAR_COLORS: colors,
    CATEGORIES: categories,
    CREATED_CATEGORY: created,
    UPDATED_CATEGORY: updated,
    HOOK_STATE: {
      categories,
      mode: 'success' as HookMode,
      createPending: false,
      error: { message: 'x' },
    },
    mockCreateMutateAsync:
      vi.fn<(input: { name: string; color: string }) => Promise<MockCategory>>(),
    mockUpdateMutateAsync:
      vi.fn<(input: { id: string; name: string; color: string }) => Promise<MockCategory>>(),
    mockDeleteMutateAsync: vi.fn<(id: string) => Promise<void>>(),
  }
})

vi.mock('@/types/calendar', () => ({
  CALENDAR_COLORS,
}))

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}))

vi.mock('@/components/ui/popover', async () => {
  const React = await import('react')

  return {
    Popover: ({ children }: MockPopoverProps) =>
      React.createElement('div', { 'data-testid': 'popover' }, children),
    PopoverTrigger: ({ children }: MockPopoverProps) =>
      React.createElement('div', { 'data-testid': 'popover-trigger' }, children),
    PopoverContent: ({ children, align: _align, asChild: _asChild, ...props }: MockPopoverProps) =>
      React.createElement('div', { ...props, 'data-testid': 'popover-content' }, children),
  }
})

vi.mock('@/components/ui/button', async () => {
  const React = await import('react')

  return {
    Button: ({
      children,
      variant: _variant,
      size: _size,
      asChild: _asChild,
      ...props
    }: MockButtonProps) => React.createElement('button', props, children),
    buttonVariants: () => '',
  }
})

vi.mock('@/components/ui/input', async () => {
  const React = await import('react')

  return {
    Input: (props: MockInputProps) => React.createElement('input', props),
  }
})

vi.mock('lucide-react', async () => {
  const React = await import('react')

  const makeIcon = (name: string) => (props: SVGProps<SVGSVGElement>) =>
    React.createElement('svg', {
      ...props,
      'data-testid': `icon-${name}`,
      'aria-hidden': true,
    })

  return {
    Tag: makeIcon('Tag'),
    Plus: makeIcon('Plus'),
    Trash2: makeIcon('Trash2'),
    Check: makeIcon('Check'),
    X: makeIcon('X'),
    Pencil: makeIcon('Pencil'),
  }
})

vi.mock('@/hooks/calendar/useCalendarCategories', () => ({
  useCalendarCategories: () => {
    if (HOOK_STATE.mode === 'loading') {
      return { data: undefined, isLoading: true, isError: false }
    }

    if (HOOK_STATE.mode === 'error') {
      return { data: undefined, isLoading: false, isError: true, error: HOOK_STATE.error }
    }

    return { data: HOOK_STATE.categories, isLoading: false, isError: false }
  },
  useCreateCalendarCategory: () => ({
    mutateAsync: mockCreateMutateAsync,
    isPending: HOOK_STATE.createPending,
  }),
  useUpdateCalendarCategory: () => ({
    mutateAsync: mockUpdateMutateAsync,
    isPending: false,
  }),
  useDeleteCalendarCategory: () => ({
    mutateAsync: mockDeleteMutateAsync,
    isPending: false,
  }),
}))

import { CategorySelector } from './CategorySelector'

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function renderWithProviders(ui: ReactNode) {
  const client = createTestQueryClient()

  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('CategorySelector', () => {
  beforeEach(() => {
    HOOK_STATE.categories = CATEGORIES
    HOOK_STATE.mode = 'success'
    HOOK_STATE.createPending = false
    HOOK_STATE.error = { message: 'x' }

    mockCreateMutateAsync.mockReset()
    mockUpdateMutateAsync.mockReset()
    mockDeleteMutateAsync.mockReset()

    mockCreateMutateAsync.mockResolvedValue(CREATED_CATEGORY)
    mockUpdateMutateAsync.mockResolvedValue(UPDATED_CATEGORY)
    mockDeleteMutateAsync.mockResolvedValue(undefined)
  })

  it('affiche le libellé par défaut et un état vide pendant le chargement des catégories', () => {
    HOOK_STATE.mode = 'loading'

    renderWithProviders(<CategorySelector value={null} onChange={vi.fn()} />)

    expect(
      within(screen.getByTestId('popover-trigger')).getByRole('button', { name: /^catégorie$/i })
    ).toBeInTheDocument()
    expect(screen.getByText('Mes catégories')).toBeInTheDocument()
    expect(screen.getByText('Aucune catégorie. Créez la première.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^aucune catégorie$/i })).toBeInTheDocument()
  })

  it('affiche un état vide contrôlé si le hook de catégories signale une erreur', () => {
    HOOK_STATE.mode = 'error'

    renderWithProviders(<CategorySelector value={null} onChange={vi.fn()} />)

    expect(screen.getByText('Mes catégories')).toBeInTheDocument()
    expect(screen.getByText('Aucune catégorie. Créez la première.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^nouvelle$/i })).toBeInTheDocument()
  })

  it('affiche la catégorie sélectionnée et les catégories métier disponibles', () => {
    renderWithProviders(<CategorySelector value="personal" onChange={vi.fn()} />)

    expect(screen.getByText('Mes catégories')).toBeInTheDocument()
    expect(screen.getByText('Travail')).toBeInTheDocument()
    expect(screen.getAllByText('Perso')).toHaveLength(2)
    expect(within(screen.getByTestId('popover-trigger')).getByText('Perso')).toBeInTheDocument()
    expect(screen.getByTestId('popover-content')).toBeInTheDocument()
  })

  it('sélectionne une catégorie existante avec son identifiant et sa couleur', () => {
    const onChange = vi.fn()

    renderWithProviders(<CategorySelector value={null} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: /^travail$/i }))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('work', CALENDAR_COLORS[0])
  })

  it('réinitialise la sélection quand "Aucune catégorie" est choisi', () => {
    const onChange = vi.fn()

    renderWithProviders(<CategorySelector value="work" onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: /^aucune catégorie$/i }))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(null, null)
  })

  it('crée une nouvelle catégorie puis propage la catégorie créée', async () => {
    const onChange = vi.fn()

    renderWithProviders(<CategorySelector value={null} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: /^nouvelle$/i }))

    const disabledCreateButton = screen.getByRole('button', { name: /^créer$/i })
    expect(disabledCreateButton).toBeDisabled()

    fireEvent.change(screen.getByPlaceholderText('Nom de la catégorie'), {
      target: { value: ' Urgent ' },
    })
    fireEvent.click(screen.getByLabelText(`Couleur ${CALENDAR_COLORS[1]}`))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^créer$/i }))
    })

    await waitFor(() => {
      expect(mockCreateMutateAsync).toHaveBeenCalledWith({
        name: 'Urgent',
        color: CALENDAR_COLORS[1],
      })
    })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(CREATED_CATEGORY.id, CREATED_CATEGORY.color)
  })

  it('met à jour la catégorie sélectionnée et renvoie sa nouvelle couleur', async () => {
    const onChange = vi.fn()

    renderWithProviders(<CategorySelector value="work" onChange={onChange} />)

    const editButtons = screen.getAllByLabelText('Modifier')
    const firstEditButton = editButtons[0]

    if (firstEditButton === undefined) {
      throw new Error('Bouton modifier introuvable')
    }

    fireEvent.click(firstEditButton)

    const input = screen.getByPlaceholderText('Nom')
    fireEvent.change(input, { target: { value: ' Travail modifié ' } })
    fireEvent.click(screen.getByLabelText(`Couleur ${CALENDAR_COLORS[2]}`))

    const editPanel = input.closest('div')

    if (editPanel === null) {
      throw new Error('Panneau édition introuvable')
    }

    const buttons = within(editPanel).getAllByRole('button')
    const saveButton = buttons.at(-1)

    if (saveButton === undefined) {
      throw new Error('Bouton sauvegarde introuvable')
    }

    await act(async () => {
      fireEvent.click(saveButton)
    })

    await waitFor(() => {
      expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
        id: 'work',
        name: 'Travail modifié',
        color: CALENDAR_COLORS[2],
      })
    })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(UPDATED_CATEGORY.id, UPDATED_CATEGORY.color)
  })

  it('supprime la catégorie sélectionnée et vide la sélection', async () => {
    const onChange = vi.fn()

    renderWithProviders(<CategorySelector value="work" onChange={onChange} />)

    const deleteButtons = screen.getAllByLabelText('Supprimer')
    const firstDeleteButton = deleteButtons[0]

    if (firstDeleteButton === undefined) {
      throw new Error('Bouton supprimer introuvable')
    }

    await act(async () => {
      fireEvent.click(firstDeleteButton)
    })

    await waitFor(() => {
      expect(mockDeleteMutateAsync).toHaveBeenCalledWith('work')
    })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(null, null)
  })
})
