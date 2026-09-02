import React, { type ComponentPropsWithoutRef, type MouseEventHandler, type ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import ITAssets from './ITAssets'

const {
  PROFILES,
  ASSETS,
  LICENSES,
  ASSIGNMENTS,
  RENEWALS,
  hookState,
  toastMock,
  mockFrom,
  mockDeleteAssetMutate,
  mockDeleteLicenseMutate,
  mockUpsertAssetMutateAsync,
  mockUpsertLicenseMutateAsync,
  mockAssignLicenseMutateAsync,
  mockRevokeLicenseMutate,
  ASSETS_SUCCESS_QUERY,
  ASSETS_LOADING_QUERY,
  ASSETS_ERROR_QUERY,
  LICENSES_SUCCESS_QUERY,
  LICENSES_LOADING_QUERY,
  LICENSES_ERROR_QUERY,
  RENEWALS_SUCCESS_QUERY,
  RENEWALS_LOADING_QUERY,
  RENEWALS_ERROR_QUERY,
  PROFILES_QUERY,
  ASSIGNMENTS_QUERY,
  EMPTY_ASSIGNMENTS_QUERY,
  DELETE_ASSET_MUTATION,
  DELETE_LICENSE_MUTATION,
  UPSERT_ASSET_MUTATION,
  UPSERT_LICENSE_MUTATION,
  ASSIGN_LICENSE_MUTATION,
  REVOKE_LICENSE_MUTATION,
} = vi.hoisted(() => {
  const PROFILES = [
    { id: 'profile-1', prenom: 'Marie', nom: 'Dupont', email: 'marie@test.fr' },
    { id: 'profile-2', prenom: 'Paul', nom: 'Martin', email: 'paul@test.fr' },
  ]

  const ASSETS = [
    {
      id: 'asset-1',
      category: 'laptop',
      status: 'assigned',
      brand: 'Apple',
      model: 'MacBook Pro 14 M3',
      serial_number: 'SN1',
      location: 'Bureau Paris',
      purchase_date: '2024-01-10',
      purchase_price: 2490,
      supplier: 'Apple',
      warranty_end: '2027-01-10',
      assigned_to_profile_id: 'profile-1',
      notes: 'Poste direction',
    },
    {
      id: 'asset-2',
      category: 'monitor',
      status: 'in_stock',
      brand: 'Dell',
      model: 'UltraSharp 27',
      serial_number: 'SN2',
      location: 'Stock IT',
      purchase_date: '2024-03-15',
      purchase_price: 390,
      supplier: 'Dell',
      warranty_end: '2027-03-15',
      assigned_to_profile_id: null,
      notes: null,
    },
  ]

  const LICENSES = [
    {
      id: 'license-1',
      name: 'GitHub Business',
      vendor: 'GitHub',
      seats_total: 2,
      cost_amount: 240,
      billing_cycle: 'yearly',
      renewal_date: '2025-02-01',
      contract_ref: 'GH-1',
      active: true,
      notes: 'Dev team',
    },
    {
      id: 'license-2',
      name: 'Figma',
      vendor: 'Figma',
      seats_total: 1,
      cost_amount: 144,
      billing_cycle: 'yearly',
      renewal_date: '2025-04-01',
      contract_ref: 'FG-1',
      active: true,
      notes: null,
    },
  ]

  const ASSIGNMENTS = [
    {
      id: 'assignment-1',
      license_id: 'license-1',
      profile_id: 'profile-1',
      assigned_at: '2024-02-10',
    },
  ]

  const RENEWALS = [
    {
      id: 'renewal-1',
      item_type: 'license',
      type: 'license',
      name: 'GitHub Business',
      label: 'GitHub Business',
      vendor: 'GitHub',
      renewal_date: '2025-02-01',
      date: '2025-02-01',
      cost_amount: 240,
      amount: 240,
      billing_cycle: 'yearly',
      days_until: 30,
    },
  ]

  const ERROR_OBJECT = { message: 'x' }

  const ASSETS_SUCCESS_QUERY = {
    data: ASSETS,
    isLoading: false,
    isPending: false,
    isError: false,
    error: null,
  }
  const ASSETS_LOADING_QUERY = {
    data: undefined,
    isLoading: true,
    isPending: true,
    isError: false,
    error: null,
  }
  const ASSETS_ERROR_QUERY = {
    data: null,
    isLoading: false,
    isPending: false,
    isError: true,
    error: ERROR_OBJECT,
  }

  const LICENSES_SUCCESS_QUERY = {
    data: LICENSES,
    isLoading: false,
    isPending: false,
    isError: false,
    error: null,
  }
  const LICENSES_LOADING_QUERY = {
    data: undefined,
    isLoading: true,
    isPending: true,
    isError: false,
    error: null,
  }
  const LICENSES_ERROR_QUERY = {
    data: null,
    isLoading: false,
    isPending: false,
    isError: true,
    error: ERROR_OBJECT,
  }

  const RENEWALS_SUCCESS_QUERY = {
    data: RENEWALS,
    isLoading: false,
    isPending: false,
    isError: false,
    error: null,
  }
  const RENEWALS_LOADING_QUERY = {
    data: undefined,
    isLoading: true,
    isPending: true,
    isError: false,
    error: null,
  }
  const RENEWALS_ERROR_QUERY = {
    data: null,
    isLoading: false,
    isPending: false,
    isError: true,
    error: ERROR_OBJECT,
  }

  const PROFILES_QUERY = {
    data: PROFILES,
    isLoading: false,
    isPending: false,
    isError: false,
    error: null,
  }
  const ASSIGNMENTS_QUERY = {
    data: ASSIGNMENTS,
    isLoading: false,
    isPending: false,
    isError: false,
    error: null,
  }
  const EMPTY_ASSIGNMENTS_QUERY = {
    data: [],
    isLoading: false,
    isPending: false,
    isError: false,
    error: null,
  }

  const toastMock = vi.fn()
  const mockDeleteAssetMutate = vi.fn()
  const mockDeleteLicenseMutate = vi.fn()
  const mockUpsertAssetMutateAsync = vi.fn(async (value: unknown) => value)
  const mockUpsertLicenseMutateAsync = vi.fn(async (value: unknown) => value)
  const mockAssignLicenseMutateAsync = vi.fn(async (value: unknown) => value)
  const mockRevokeLicenseMutate = vi.fn()

  const DELETE_ASSET_MUTATION = {
    mutate: mockDeleteAssetMutate,
    mutateAsync: mockDeleteAssetMutate,
    isPending: false,
  }
  const DELETE_LICENSE_MUTATION = {
    mutate: mockDeleteLicenseMutate,
    mutateAsync: mockDeleteLicenseMutate,
    isPending: false,
  }
  const UPSERT_ASSET_MUTATION = {
    mutateAsync: mockUpsertAssetMutateAsync,
    mutate: mockUpsertAssetMutateAsync,
    isPending: false,
  }
  const UPSERT_LICENSE_MUTATION = {
    mutateAsync: mockUpsertLicenseMutateAsync,
    mutate: mockUpsertLicenseMutateAsync,
    isPending: false,
  }
  const ASSIGN_LICENSE_MUTATION = {
    mutateAsync: mockAssignLicenseMutateAsync,
    mutate: mockAssignLicenseMutateAsync,
    isPending: false,
  }
  const REVOKE_LICENSE_MUTATION = {
    mutate: mockRevokeLicenseMutate,
    mutateAsync: mockRevokeLicenseMutate,
    isPending: false,
  }

  const hookState = {
    assets: 'success',
    licenses: 'success',
    renewals: 'success',
  }

  const supabaseResult = { data: [], error: null }
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    is: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    range: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(async () => supabaseResult),
    maybeSingle: vi.fn(async () => supabaseResult),
    then: vi.fn(
      (
        resolve?: (value: { data: never[]; error: null }) => unknown,
        reject?: (reason: unknown) => unknown
      ) => Promise.resolve(supabaseResult).then(resolve, reject)
    ),
    catch: vi.fn((reject?: (reason: unknown) => unknown) =>
      Promise.resolve(supabaseResult).catch(reject)
    ),
  }
  const mockFrom = vi.fn(() => builder)

  return {
    PROFILES,
    ASSETS,
    LICENSES,
    ASSIGNMENTS,
    RENEWALS,
    hookState,
    toastMock,
    mockFrom,
    mockDeleteAssetMutate,
    mockDeleteLicenseMutate,
    mockUpsertAssetMutateAsync,
    mockUpsertLicenseMutateAsync,
    mockAssignLicenseMutateAsync,
    mockRevokeLicenseMutate,
    ASSETS_SUCCESS_QUERY,
    ASSETS_LOADING_QUERY,
    ASSETS_ERROR_QUERY,
    LICENSES_SUCCESS_QUERY,
    LICENSES_LOADING_QUERY,
    LICENSES_ERROR_QUERY,
    RENEWALS_SUCCESS_QUERY,
    RENEWALS_LOADING_QUERY,
    RENEWALS_ERROR_QUERY,
    PROFILES_QUERY,
    ASSIGNMENTS_QUERY,
    EMPTY_ASSIGNMENTS_QUERY,
    DELETE_ASSET_MUTATION,
    DELETE_LICENSE_MUTATION,
    UPSERT_ASSET_MUTATION,
    UPSERT_LICENSE_MUTATION,
    ASSIGN_LICENSE_MUTATION,
    REVOKE_LICENSE_MUTATION,
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    rpc: vi.fn(async () => ({ data: [], error: null })),
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'u1', email: 't@t.co' } }, error: null })),
      getSession: vi.fn(async () => ({
        data: { session: { user: { id: 'u1', email: 't@t.co' } } },
        error: null,
      })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}))

vi.mock('@/hooks/profile/useProfilesWithRoles', () => ({
  useActiveProfilesWithRoles: vi.fn(() => PROFILES_QUERY),
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: toastMock })),
}))

vi.mock('@/hooks/it/useITAssets', () => ({
  useITAssets: vi.fn(() => {
    if (hookState.assets === 'loading') return ASSETS_LOADING_QUERY
    if (hookState.assets === 'error') return ASSETS_ERROR_QUERY
    return ASSETS_SUCCESS_QUERY
  }),
  useUpsertITAsset: vi.fn(() => UPSERT_ASSET_MUTATION),
  useDeleteITAsset: vi.fn(() => DELETE_ASSET_MUTATION),
  useITLicenses: vi.fn(() => {
    if (hookState.licenses === 'loading') return LICENSES_LOADING_QUERY
    if (hookState.licenses === 'error') return LICENSES_ERROR_QUERY
    return LICENSES_SUCCESS_QUERY
  }),
  useUpsertITLicense: vi.fn(() => UPSERT_LICENSE_MUTATION),
  useDeleteITLicense: vi.fn(() => DELETE_LICENSE_MUTATION),
  useLicenseAssignments: vi.fn((licenseId: string) =>
    licenseId === 'license-1' ? ASSIGNMENTS_QUERY : EMPTY_ASSIGNMENTS_QUERY
  ),
  useAssignLicense: vi.fn(() => ASSIGN_LICENSE_MUTATION),
  useRevokeLicense: vi.fn(() => REVOKE_LICENSE_MUTATION),
  useITRenewals: vi.fn(() => {
    if (hookState.renewals === 'loading') return RENEWALS_LOADING_QUERY
    if (hookState.renewals === 'error') return RENEWALS_ERROR_QUERY
    return RENEWALS_SUCCESS_QUERY
  }),
}))

vi.mock('@/components/common/PageDataState', async () => {
  const ReactModule = await import('react')
  const ReactLocal = ReactModule.default

  type Props = {
    children?: ReactNode
    loading?: boolean
    isLoading?: boolean
    error?: unknown
    isError?: boolean
    title?: string
    message?: string
  }

  const PageDataState = ({
    children,
    loading,
    isLoading,
    error,
    isError,
    title,
    message,
  }: Props) => {
    if (loading || isLoading) {
      return ReactLocal.createElement('div', { 'data-testid': 'page-loading' }, 'Chargement')
    }
    if (error || isError) {
      const errorMessage =
        typeof error === 'object' && error !== null && 'message' in error
          ? String(error.message)
          : 'x'
      return ReactLocal.createElement(
        'div',
        { 'data-testid': 'page-error' },
        `${title ?? 'Erreur'} ${message ?? errorMessage}`
      )
    }
    return ReactLocal.createElement(ReactLocal.Fragment, null, children)
  }

  return { PageDataState }
})

vi.mock('@/components/ui/card', async () => {
  const ReactModule = await import('react')
  const ReactLocal = ReactModule.default
  const createDiv = (testId: string) =>
    ReactLocal.forwardRef<HTMLDivElement, ComponentPropsWithoutRef<'div'>>(
      ({ children, ...props }, ref) =>
        ReactLocal.createElement('div', { ref, 'data-testid': testId, ...props }, children)
    )

  return {
    Card: createDiv('card'),
    CardHeader: createDiv('card-header'),
    CardTitle: createDiv('card-title'),
    CardContent: createDiv('card-content'),
    CardDescription: createDiv('card-description'),
    CardFooter: createDiv('card-footer'),
  }
})

vi.mock('@/components/ui/button', async () => {
  const ReactModule = await import('react')
  const ReactLocal = ReactModule.default

  type ButtonProps = Omit<ComponentPropsWithoutRef<'button'>, 'size'> & {
    asChild?: boolean
    variant?: string
    size?: string
    children?: ReactNode
  }

  const Button = ReactLocal.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ asChild, children, ...props }, ref) => {
      if (asChild && ReactLocal.isValidElement(children)) {
        return ReactLocal.cloneElement(
          children as React.ReactElement<Record<string, unknown>>,
          props
        )
      }
      return ReactLocal.createElement('button', { ref, type: 'button', ...props }, children)
    }
  )

  return { Button, buttonVariants: vi.fn(() => '') }
})

vi.mock('@/components/ui/input', async () => {
  const ReactModule = await import('react')
  const ReactLocal = ReactModule.default
  const Input = ReactLocal.forwardRef<HTMLInputElement, ComponentPropsWithoutRef<'input'>>(
    (props, ref) => ReactLocal.createElement('input', { ref, ...props })
  )

  return { Input }
})

vi.mock('@/components/ui/label', async () => {
  const ReactModule = await import('react')
  const ReactLocal = ReactModule.default
  const Label = ReactLocal.forwardRef<HTMLLabelElement, ComponentPropsWithoutRef<'label'>>(
    ({ children, ...props }, ref) => ReactLocal.createElement('label', { ref, ...props }, children)
  )

  return { Label }
})

vi.mock('@/components/ui/textarea', async () => {
  const ReactModule = await import('react')
  const ReactLocal = ReactModule.default
  const Textarea = ReactLocal.forwardRef<HTMLTextAreaElement, ComponentPropsWithoutRef<'textarea'>>(
    (props, ref) => ReactLocal.createElement('textarea', { ref, ...props })
  )

  return { Textarea }
})

vi.mock('@/components/ui/badge', async () => {
  const ReactModule = await import('react')
  const ReactLocal = ReactModule.default

  type BadgeProps = ComponentPropsWithoutRef<'div'> & { variant?: string }

  const Badge = ReactLocal.forwardRef<HTMLDivElement, BadgeProps>(({ children, ...props }, ref) =>
    ReactLocal.createElement('div', { ref, ...props }, children)
  )

  return { Badge, badgeVariants: vi.fn(() => '') }
})

vi.mock('@/components/ui/tabs', async () => {
  const ReactModule = await import('react')
  const ReactLocal = ReactModule.default

  type TabsContextValue = {
    value: string
    setValue: (value: string) => void
  }

  type TabsProps = Omit<ComponentPropsWithoutRef<'div'>, 'defaultValue' | 'onChange'> & {
    value?: string
    defaultValue?: string
    onValueChange?: (value: string) => void
  }

  type TabsContentProps = ComponentPropsWithoutRef<'div'> & {
    value: string
  }

  type TabsTriggerProps = ComponentPropsWithoutRef<'button'> & {
    value: string
  }

  const TabsContext = ReactLocal.createContext<TabsContextValue>({
    value: '',
    setValue: () => undefined,
  })

  const Tabs = ({ children, value, defaultValue, onValueChange, ...props }: TabsProps) => {
    const [internalValue, setInternalValue] = ReactLocal.useState(defaultValue ?? value ?? '')
    const actualValue = value ?? internalValue
    const setValue = (nextValue: string) => {
      setInternalValue(nextValue)
      onValueChange?.(nextValue)
    }

    return ReactLocal.createElement(
      TabsContext.Provider,
      { value: { value: actualValue, setValue } },
      ReactLocal.createElement('div', props, children)
    )
  }

  const TabsList = ({ children, ...props }: ComponentPropsWithoutRef<'div'>) =>
    ReactLocal.createElement('div', props, children)

  const TabsContent = ({ children, value, ...props }: TabsContentProps) => {
    const context = ReactLocal.useContext(TabsContext)
    if (context.value !== value) return null
    return ReactLocal.createElement(
      'div',
      { ...props, 'data-testid': `tabs-content-${value}` },
      children
    )
  }

  const TabsTrigger = ({ children, value, onClick, ...props }: TabsTriggerProps) => {
    const context = ReactLocal.useContext(TabsContext)
    const handleClick: MouseEventHandler<HTMLButtonElement> = (event) => {
      onClick?.(event)
      context.setValue(value)
    }

    return ReactLocal.createElement(
      'button',
      {
        type: 'button',
        onClick: handleClick,
        'data-value': value,
        'aria-selected': context.value === value,
        ...props,
      },
      children
    )
  }

  return { Tabs, TabsContent, TabsList, TabsTrigger }
})

vi.mock('@/components/ui/dialog', async () => {
  const ReactModule = await import('react')
  const ReactLocal = ReactModule.default

  type DialogContextValue = {
    open: boolean
    setOpen: (value: boolean) => void
  }

  const DialogContext = ReactLocal.createContext<DialogContextValue>({
    open: false,
    setOpen: () => undefined,
  })

  const Dialog = ({
    open,
    onOpenChange,
    children,
  }: {
    open?: boolean
    onOpenChange?: (value: boolean) => void
    children?: ReactNode
  }) => {
    const [internalOpen, setInternalOpen] = ReactLocal.useState(Boolean(open))
    const actualOpen = open ?? internalOpen
    const setOpen = (value: boolean) => {
      setInternalOpen(value)
      onOpenChange?.(value)
    }

    return ReactLocal.createElement(
      DialogContext.Provider,
      { value: { open: actualOpen, setOpen } },
      children
    )
  }

  const DialogTrigger = ({ asChild, children }: { asChild?: boolean; children?: ReactNode }) => {
    const context = ReactLocal.useContext(DialogContext)
    const handleClick: MouseEventHandler = (event) => {
      if (ReactLocal.isValidElement(children)) {
        const props = children.props as { onClick?: MouseEventHandler }
        props.onClick?.(event)
      }
      context.setOpen(true)
    }

    if (asChild && ReactLocal.isValidElement(children)) {
      return ReactLocal.cloneElement(
        children as React.ReactElement<{ onClick?: MouseEventHandler }>,
        { onClick: handleClick }
      )
    }

    return ReactLocal.createElement('button', { type: 'button', onClick: handleClick }, children)
  }

  const DialogContent = ({ children, ...props }: ComponentPropsWithoutRef<'div'>) => {
    const context = ReactLocal.useContext(DialogContext)
    if (!context.open) return null
    return ReactLocal.createElement('div', { role: 'dialog', ...props }, children)
  }

  const DialogHeader = ({ children, ...props }: ComponentPropsWithoutRef<'div'>) =>
    ReactLocal.createElement('div', props, children)
  const DialogFooter = ({ children, ...props }: ComponentPropsWithoutRef<'div'>) =>
    ReactLocal.createElement('div', props, children)
  const DialogTitle = ({ children, ...props }: ComponentPropsWithoutRef<'h2'>) =>
    ReactLocal.createElement('h2', props, children)

  return { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger }
})

vi.mock('@/components/ui/select', async () => {
  const ReactModule = await import('react')
  const ReactLocal = ReactModule.default

  type SelectContextValue = {
    value?: string
    onValueChange?: (value: string) => void
  }

  const SelectContext = ReactLocal.createContext<SelectContextValue>({})

  const Select = ({
    value,
    onValueChange,
    children,
  }: {
    value?: string
    onValueChange?: (value: string) => void
    children?: ReactNode
  }) =>
    ReactLocal.createElement(SelectContext.Provider, { value: { value, onValueChange } }, children)

  const SelectTrigger = ({ children, ...props }: ComponentPropsWithoutRef<'button'>) =>
    ReactLocal.createElement('button', { type: 'button', ...props }, children)

  const SelectValue = ({ placeholder }: { placeholder?: string }) =>
    ReactLocal.createElement('span', null, placeholder ?? '')

  const SelectContent = ({ children, ...props }: ComponentPropsWithoutRef<'div'>) =>
    ReactLocal.createElement('div', props, children)

  const SelectItem = ({ value, children }: { value: string; children?: ReactNode }) => {
    const context = ReactLocal.useContext(SelectContext)
    return ReactLocal.createElement(
      'button',
      {
        type: 'button',
        role: 'option',
        'aria-selected': context.value === value,
        onClick: () => context.onValueChange?.(value),
      },
      children
    )
  }

  return { Select, SelectContent, SelectItem, SelectTrigger, SelectValue }
})

vi.mock('@/components/ui/table', async () => {
  const ReactModule = await import('react')
  const ReactLocal = ReactModule.default

  const Table = ({ children, ...props }: ComponentPropsWithoutRef<'table'>) =>
    ReactLocal.createElement('table', props, children)
  const TableHeader = ({ children, ...props }: ComponentPropsWithoutRef<'thead'>) =>
    ReactLocal.createElement('thead', props, children)
  const TableBody = ({ children, ...props }: ComponentPropsWithoutRef<'tbody'>) =>
    ReactLocal.createElement('tbody', props, children)
  const TableRow = ({ children, ...props }: ComponentPropsWithoutRef<'tr'>) =>
    ReactLocal.createElement('tr', props, children)
  const TableHead = ({ children, ...props }: ComponentPropsWithoutRef<'th'>) =>
    ReactLocal.createElement('th', props, children)
  const TableCell = ({ children, ...props }: ComponentPropsWithoutRef<'td'>) =>
    ReactLocal.createElement('td', props, children)

  return { Table, TableBody, TableCell, TableHead, TableHeader, TableRow }
})

vi.mock('lucide-react', async () => {
  const ReactModule = await import('react')
  const ReactLocal = ReactModule.default

  const makeIcon = (label: string, testId: string) =>
    function Icon(props: ComponentPropsWithoutRef<'svg'>) {
      return ReactLocal.createElement('svg', {
        role: 'img',
        'aria-label': label,
        'data-testid': testId,
        ...props,
      })
    }

  return {
    Laptop: makeIcon('Matériel', 'laptop-icon'),
    Package: makeIcon('Stock', 'package-icon'),
    AlertTriangle: makeIcon('Alerte', 'alert-icon'),
    Plus: makeIcon('Ajouter', 'plus-icon'),
    Trash2: makeIcon('Supprimer', 'trash-icon'),
    Pencil: makeIcon('Modifier', 'pencil-icon'),
    KeyRound: makeIcon('Clé', 'key-icon'),
  }
})

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ITAssets />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  hookState.assets = 'success'
  hookState.licenses = 'success'
  hookState.renewals = 'success'
  vi.clearAllMocks()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('ITAssets', () => {
  it('affiche l’état de chargement de l’onglet matériel', () => {
    hookState.assets = 'loading'

    renderPage()

    expect(screen.getByTestId('page-loading').textContent).toContain('Chargement')
    expect(screen.queryByText(/MacBook Pro 14 M3/i)).toBeNull()
  })

  it('affiche les données métier des matériels puis des licences', async () => {
    renderPage()

    expect(screen.getByText(/MacBook Pro 14 M3/i)).toBeTruthy()
    expect(screen.getByText(/UltraSharp 27/i)).toBeTruthy()
    expect(screen.getByText(/Marie Dupont/i)).toBeTruthy()
    expect(document.body.textContent).toContain('Apple')

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /licences/i }))
    })

    expect(screen.getAllByText(/GitHub Business/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Figma/i).length).toBeGreaterThan(0)
    expect(document.body.textContent).toContain('GitHub')
    expect(document.body.textContent).toContain('2')
  })

  it('affiche un état erreur quand la requête matériel échoue', () => {
    hookState.assets = 'error'

    renderPage()

    expect(screen.getByTestId('page-error').textContent).toContain('x')
    expect(screen.queryByText(/MacBook Pro 14 M3/i)).toBeNull()
  })

  it('déclenche la mutation de suppression du premier matériel', async () => {
    renderPage()

    const deleteButtons = screen.getAllByRole('button', { name: /supprimer/i })
    const firstDeleteButton = deleteButtons.find((button) => button instanceof HTMLElement)
    expect(firstDeleteButton).toBeInstanceOf(HTMLElement)

    if (!(firstDeleteButton instanceof HTMLElement)) {
      return
    }

    await act(async () => {
      fireEvent.click(firstDeleteButton)
    })

    await waitFor(() => {
      expect(mockDeleteAssetMutate).toHaveBeenCalledWith(ASSETS[0].id)
    })

    expect(mockDeleteLicenseMutate).not.toHaveBeenCalled()
  })
})
