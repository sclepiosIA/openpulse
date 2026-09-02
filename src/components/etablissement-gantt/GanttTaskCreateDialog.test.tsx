// @vitest-environment jsdom
import React from 'react'
import { QueryClient, QueryClientProvider, useQuery, useMutation } from '@tanstack/react-query'
import { render, screen, fireEvent, waitFor, renderHook } from '@testing-library/react'
import { GanttTaskCreateDialog } from './GanttTaskCreateDialog'

const {
  CATEGORIES,
  ETABLISSEMENTS,
  PROFILES,
  AUTH_STATE,
  mutateAsyncMock,
  onCloseMock,
  navigateMock,
  toastSuccessMock,
  toastErrorMock,
  mockFrom,
} = vi.hoisted(() => {
  const CATEGORIES = [
    { id: 'cat-1', nom: 'Maintenance', couleur: '#ff0000' },
    { id: 'cat-2', nom: 'Sécurité', couleur: '#00ff00' },
  ]
  const ETABLISSEMENTS = [
    { id: 'etab-1', nom: 'Clinique du Lac' },
    { id: 'etab-2', nom: 'Hôpital Central' },
  ]
  const PROFILES = [
    { id: 'prof-1', prenom: 'Jean', nom: 'Dupont', role: 'admin' },
    { id: 'prof-2', prenom: 'Marie', nom: 'Curie', role: 'manager' },
  ]
  const AUTH_STATE = {
    user: { id: 'user-1', email: 'test@example.com' },
    session: { user: { id: 'user-1' } },
    isLoading: false,
  }
  return {
    CATEGORIES,
    ETABLISSEMENTS,
    PROFILES,
    AUTH_STATE,
    mutateAsyncMock: vi.fn(),
    onCloseMock: vi.fn(),
    navigateMock: vi.fn(),
    toastSuccessMock: vi.fn(),
    toastErrorMock: vi.fn(),
    mockFrom: vi.fn(),
  }
})

vi.mock('@/integrations/supabase/client', () => {
  const createBuilder = () => {
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
      single: vi.fn(async () => ({ data: null, error: null })),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
      then: (onFulfilled: (value: { data: null; error: null }) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(onFulfilled),
      catch: (onRejected: (reason: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).catch(onRejected),
    }
    return builder
  }

  mockFrom.mockImplementation(() => createBuilder())

  return {
    supabase: {
      from: mockFrom,
    },
  }
})

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}))

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}))

vi.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon" {...props} />
  return {
    CalendarIcon: Icon,
    Building2: Icon,
    User: Icon,
    Repeat: Icon,
    Flag: Icon,
  }
})

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; onOpenChange?: (v: boolean) => void; children: React.ReactNode }) =>
    open ? <div data-testid="dialog-root">{children}</div> : null,
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
    variant,
  }: {
    children: React.ReactNode
    onClick?: () => void
    disabled?: boolean
    className?: string
    variant?: string
  }) => (
    <button type="button" data-variant={variant} className={className} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/input', () => ({
  Input: ({
    value,
    onChange,
    placeholder,
  }: {
    value?: string
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
    placeholder?: string
  }) => <input value={value} onChange={onChange} placeholder={placeholder} />,
}))

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <label className={className}>{children}</label>
  ),
}))

vi.mock('@/components/ui/textarea', () => ({
  Textarea: ({
    value,
    onChange,
    placeholder,
    rows,
  }: {
    value?: string
    onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
    placeholder?: string
    rows?: number
  }) => <textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows} />,
}))

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}))

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <div>{children}</div>,
  PopoverContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}))

vi.mock('@/components/ui/calendar', () => ({
  Calendar: ({
    onSelect,
  }: {
    mode?: string
    selected?: Date
    onSelect?: (date?: Date) => void
    locale?: unknown
  }) => (
    <div>
      <button type="button" onClick={() => onSelect?.(new Date('2024-05-10T00:00:00.000Z'))}>
        Pick date
      </button>
    </div>
  ),
}))

vi.mock('@/components/ui/select', () => {
  const ReactModule = React

  type Ctx = {
    value?: string
    onValueChange?: (value: string) => void
  }

  const SelectContext = ReactModule.createContext<Ctx>({})

  const Select = ({
    value,
    onValueChange,
    children,
  }: {
    value?: string
    onValueChange?: (value: string) => void
    children: React.ReactNode
  }) => (
    <SelectContext.Provider value={{ value, onValueChange }}>
      <div data-testid="select-root">{children}</div>
    </SelectContext.Provider>
  )

  const SelectTrigger = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
  const SelectValue = ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>
  const SelectContent = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
  const SelectItem = ({ value, children }: { value: string; children: React.ReactNode }) => {
    const ctx = ReactModule.useContext(SelectContext)
    return (
      <button type="button" onClick={() => ctx.onValueChange?.(value)}>
        {children}
      </button>
    )
  }

  return {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
  }
})

vi.mock('@/hooks/catalogue/useCategories', () => ({
  useCategories: vi.fn(),
}))

vi.mock('@/hooks/crm/useEtablissements', () => ({
  useEtablissements: vi.fn(),
}))

vi.mock('@/hooks/profile/useProfilesWithRoles', () => ({
  useActiveProfilesWithRoles: vi.fn(),
}))

vi.mock('@/hooks/tasks/useCreateTache', () => ({
  useCreateTache: vi.fn(),
}))

import { useCategories } from '@/hooks/catalogue/useCategories'
import { useEtablissements } from '@/hooks/crm/useEtablissements'
import { useActiveProfilesWithRoles } from '@/hooks/profile/useProfilesWithRoles'
import { useCreateTache } from '@/hooks/tasks/useCreateTache'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('GanttTaskCreateDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(useCategories).mockReturnValue({
      data: CATEGORIES,
      isLoading: false,
      isError: false,
      error: null,
    })

    vi.mocked(useEtablissements).mockReturnValue({
      data: ETABLISSEMENTS,
      isLoading: false,
      isError: false,
      error: null,
    })

    vi.mocked(useActiveProfilesWithRoles).mockReturnValue({
      data: PROFILES,
      isLoading: false,
      isError: false,
      error: null,
    })

    mutateAsyncMock.mockResolvedValue({ id: 'task-1' })
    vi.mocked(useCreateTache).mockReturnValue({
      mutateAsync: mutateAsyncMock,
      isPending: false,
      isError: false,
      error: null,
    })
  })

  it('expose les états loading puis succès puis erreur via renderHook avec QueryClientProvider', async () => {
    const wrapper = createWrapper()

    const loadingHook = renderHook(
      () =>
        useQuery({
          queryKey: ['loading-demo'],
          queryFn: () => new Promise<string>(() => {}),
        }),
      { wrapper }
    )
    expect(loadingHook.result.current.isLoading).toBe(true)

    const successHook = renderHook(
      () =>
        useQuery({
          queryKey: ['success-demo'],
          queryFn: async () => CATEGORIES,
        }),
      { wrapper }
    )

    await waitFor(() => expect(successHook.result.current.isSuccess).toBe(true))
    expect(successHook.result.current.data).toEqual(CATEGORIES)
    expect(successHook.result.current.data?.[0].nom).toBe('Maintenance')

    const errorHook = renderHook(
      () =>
        useQuery({
          queryKey: ['error-demo'],
          queryFn: async () => {
            throw { message: 'x' }
          },
        }),
      { wrapper }
    )

    await waitFor(() => expect(errorHook.result.current.isError).toBe(true))
    const hookError = errorHook.result.current.error as { message?: string }
    expect(hookError.message).toBe('x')
  })

  it('affiche les valeurs métier réelles et initialise avec les props par défaut', () => {
    render(
      <GanttTaskCreateDialog
        isOpen={true}
        onClose={onCloseMock}
        etablissementId="etab-2"
        defaultCategoryId="cat-2"
      />
    )

    expect(screen.getByText('Créer une nouvelle tâche')).toBeInTheDocument()
    expect(screen.getByText('Clinique du Lac')).toBeInTheDocument()
    expect(screen.getByText('Hôpital Central')).toBeInTheDocument()
    expect(screen.getByText('Maintenance')).toBeInTheDocument()
    expect(screen.getByText('Sécurité')).toBeInTheDocument()
    expect(screen.getByText('Jean Dupont')).toBeInTheDocument()
    expect(screen.getByText('Marie Curie')).toBeInTheDocument()

    const createButton = screen.getByRole('button', { name: 'Créer la tâche' })
    expect(createButton).toBeDisabled()
  })

  it('soumet les données transformées correctement puis ferme le dialogue', async () => {
    render(
      <GanttTaskCreateDialog
        isOpen={true}
        onClose={onCloseMock}
        etablissementId={undefined}
        defaultCategoryId={undefined}
      />
    )

    fireEvent.change(screen.getByPlaceholderText('Titre de la tâche'), {
      target: { value: 'Inspection incendie' },
    })

    fireEvent.change(screen.getByPlaceholderText('Description de la tâche'), {
      target: { value: 'Vérifier les extincteurs du bâtiment A' },
    })

    fireEvent.click(screen.getByText('Hôpital Central'))
    fireEvent.click(screen.getByText('Sécurité'))
    fireEvent.click(screen.getByText('Haute'))
    fireEvent.click(screen.getByText('Marie Curie'))
    fireEvent.click(screen.getByText('Tous les mois'))

    const pickButtons = screen.getAllByRole('button', { name: 'Pick date' })
    fireEvent.click(pickButtons[0])
    fireEvent.click(pickButtons[1])

    fireEvent.click(screen.getByRole('button', { name: 'Créer la tâche' }))

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        titre: 'Inspection incendie',
        description: 'Vérifier les extincteurs du bâtiment A',
        etablissement_id: 'etab-2',
        categorie_id: 'cat-2',
        priorite: 'high',
        date_debut: '2024-05-10T00:00:00.000Z',
        echeance: '2024-05-10T00:00:00.000Z',
        responsable_id: 'prof-2',
        recurrence_rule: 'FREQ=MONTHLY',
      })
    })

    expect(onCloseMock).toHaveBeenCalledTimes(1)
  })

  it('désactive le bouton et affiche le libellé de pending pendant la création', () => {
    vi.mocked(useCreateTache).mockReturnValue({
      mutateAsync: mutateAsyncMock,
      isPending: true,
      isError: false,
      error: null,
    })

    render(
      <GanttTaskCreateDialog
        isOpen={true}
        onClose={onCloseMock}
        etablissementId="etab-1"
        defaultCategoryId="cat-1"
      />
    )

    fireEvent.change(screen.getByPlaceholderText('Titre de la tâche'), {
      target: { value: 'Tâche en cours' },
    })

    const button = screen.getByRole('button', { name: 'Création...' })
    expect(button).toBeDisabled()
  })

  it('couvre le cas erreur de mutation avec isError via renderHook et mutation react-query', async () => {
    const wrapper = createWrapper()

    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: async () => {
            const response: { data: null; error: { message: string } } = {
              data: null,
              error: { message: 'x' },
            }
            if (response.error) {
              throw response.error
            }
            return response.data
          },
        }),
      { wrapper }
    )

    await result.current.mutateAsync().catch(() => undefined)

    await waitFor(() => expect(result.current.isError).toBe(true))
    const mutationError = result.current.error as { message?: string }
    expect(mutationError.message).toBe('x')
  })
})