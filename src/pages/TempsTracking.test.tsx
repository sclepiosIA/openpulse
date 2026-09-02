/* @vitest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import TempsTracking from './TempsTracking'

const {
  SEARCH_PARAMS,
  setSearchParamsMock,
  navigateMock,
  ROLE_USER,
  ROLE_ADMIN,
  ACTIVITY_TYPES,
  WEEK_IMPUTATIONS,
  WEEKLY_SUBMISSION_DRAFT,
  WEEKLY_SUBMISSION_REJECTED,
  ETABS,
  PROJETS,
  mockUseUserRole,
  mockUseActivityTypes,
  mockUseWeekImputations,
  mockUseWeeklySubmission,
  mockUseSubmitWeek,
  mockUseSuggestImputations,
  mockUseSuggestWeekImputations,
  mockUseUpsertImputation,
  mockUseDeleteImputation,
  mockUsePendingWeeklySubmissions,
  mockUseApproveWeek,
  mockUseRentabiliteEtablissement,
  mockUseRentabiliteProjetRd,
  mockFrom,
  toastSuccess,
  toastError,
  toastInfo,
} = vi.hoisted(() => ({
  SEARCH_PARAMS: new URLSearchParams('tab=saisie'),
  setSearchParamsMock: vi.fn(),
  navigateMock: vi.fn(),
  ROLE_USER: { role: 'user' },
  ROLE_ADMIN: { role: 'admin' },
  ACTIVITY_TYPES: [
    { id: 't1', code: 'DEV', label: 'Développement', is_billable_default: true },
    { id: 't2', code: 'ADMIN', label: 'Administration', is_billable_default: false },
  ],
  WEEK_IMPUTATIONS: [
    {
      id: 'i1',
      date_imputation: '2024-01-01',
      duration_minutes: 120,
      is_billable: true,
      activity_type_id: 't1',
      note: 'Feature',
    },
    {
      id: 'i2',
      date_imputation: '2024-01-02',
      duration_minutes: 180,
      is_billable: false,
      activity_type_id: 't2',
      note: 'Réunion',
    },
  ],
  WEEKLY_SUBMISSION_DRAFT: { status: 'draft' },
  WEEKLY_SUBMISSION_REJECTED: { status: 'rejected', rejection_reason: 'Temps incomplet' },
  ETABS: [{ id: 'e1', nom: 'Alpha' }],
  PROJETS: [{ id: 'p1', nom: 'Projet R&D' }],
  mockUseUserRole: vi.fn(),
  mockUseActivityTypes: vi.fn(),
  mockUseWeekImputations: vi.fn(),
  mockUseWeeklySubmission: vi.fn(),
  mockUseSubmitWeek: vi.fn(),
  mockUseSuggestImputations: vi.fn(),
  mockUseSuggestWeekImputations: vi.fn(),
  mockUseUpsertImputation: vi.fn(),
  mockUseDeleteImputation: vi.fn(),
  mockUsePendingWeeklySubmissions: vi.fn(),
  mockUseApproveWeek: vi.fn(),
  mockUseRentabiliteEtablissement: vi.fn(),
  mockUseRentabiliteProjetRd: vi.fn(),
  mockFrom: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useSearchParams: () => [SEARCH_PARAMS, setSearchParamsMock] as const,
  }
})

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
    info: toastInfo,
  },
}))

vi.mock('@/hooks/shared/useUserRole', () => ({
  useUserRole: mockUseUserRole,
}))

vi.mock('@/integrations/supabase/client', () => {
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
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: (resolve: (value: { data: unknown; error: unknown }) => unknown) =>
      Promise.resolve(resolve({ data: ETABS, error: null })),
    catch: vi.fn(),
  }
  mockFrom.mockImplementation((table: string) => {
    if (table === 'etablissements') {
      return {
        ...builder,
        then: (resolve: (value: { data: unknown; error: unknown }) => unknown) =>
          Promise.resolve(resolve({ data: ETABS, error: null })),
      }
    }
    if (table === 'rd_projets') {
      return {
        ...builder,
        then: (resolve: (value: { data: unknown; error: unknown }) => unknown) =>
          Promise.resolve(resolve({ data: PROJETS, error: null })),
      }
    }
    return builder
  })
  return {
    supabase: {
      from: mockFrom,
    },
  }
})

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) => (
    <button {...props}>{children}</button>
  ),
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children?: React.ReactNode; value: string }) => (
    <div data-value={value}>{children}</div>
  ),
  SelectTrigger: ({ children }: { children?: React.ReactNode }) => <button>{children}</button>,
  SelectValue: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock('@/components/ui/textarea', () => ({
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogTrigger: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children, value }: { children?: React.ReactNode; value: string }) => (
    <button data-value={value}>{children}</button>
  ),
  TabsContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('lucide-react', () => {
  const Icon = () => <svg />
  return {
    ChevronLeft: Icon,
    ChevronRight: Icon,
    Plus: Icon,
    Sparkles: Icon,
    Send: Icon,
    Trash2: Icon,
    Clock: Icon,
    CheckCircle2: Icon,
    XCircle: Icon,
    CalendarDays: Icon,
    TrendingUp: Icon,
    Wallet: Icon,
    Target: Icon,
  }
})

vi.mock('@/components/common/PageDataState', () => ({
  PageDataState: ({
    isLoading,
    isError,
    error,
    children,
  }: {
    isLoading: boolean
    isError: boolean
    error: Error | null
    children?: React.ReactNode
  }) => {
    if (isLoading) return <div>loading-state</div>
    if (isError) return <div>error-state:{error?.message}</div>
    return <>{children}</>
  },
}))

vi.mock('@/hooks/time/useTimeTracking', () => ({
  useActivityTypes: mockUseActivityTypes,
  useWeekImputations: mockUseWeekImputations,
  useWeeklySubmission: mockUseWeeklySubmission,
  useUpsertImputation: mockUseUpsertImputation,
  useDeleteImputation: mockUseDeleteImputation,
  useSubmitWeek: mockUseSubmitWeek,
  useSuggestImputations: mockUseSuggestImputations,
  useSuggestWeekImputations: mockUseSuggestWeekImputations,
  usePendingWeeklySubmissions: mockUsePendingWeeklySubmissions,
  useApproveWeek: mockUseApproveWeek,
  useRentabiliteEtablissement: mockUseRentabiliteEtablissement,
  useRentabiliteProjetRd: mockUseRentabiliteProjetRd,
  isoWeek: () => '2024-W01',
  weekDates: () => [
    new Date('2024-01-01T00:00:00.000Z'),
    new Date('2024-01-02T00:00:00.000Z'),
    new Date('2024-01-03T00:00:00.000Z'),
    new Date('2024-01-04T00:00:00.000Z'),
    new Date('2024-01-05T00:00:00.000Z'),
    new Date('2024-01-06T00:00:00.000Z'),
    new Date('2024-01-07T00:00:00.000Z'),
  ],
  toDateStr: (d: Date) => d.toISOString().slice(0, 10),
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper({ children }: { children?: React.ReactNode }) {
    return (
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </MemoryRouter>
    )
  }
}

function setupDefaultMocks() {
  mockUseUserRole.mockReturnValue(ROLE_USER)
  mockUseActivityTypes.mockReturnValue({
    data: ACTIVITY_TYPES,
    isLoading: false,
    error: null,
  })
  mockUseWeekImputations.mockReturnValue({
    data: WEEK_IMPUTATIONS,
    isLoading: false,
    error: null,
  })
  mockUseWeeklySubmission.mockReturnValue({
    data: WEEKLY_SUBMISSION_DRAFT,
    isLoading: false,
    error: null,
  })
  mockUseSubmitWeek.mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  })
  mockUseSuggestImputations.mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  })
  mockUseSuggestWeekImputations.mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  })
  mockUseUpsertImputation.mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  })
  mockUseDeleteImputation.mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  })
  mockUsePendingWeeklySubmissions.mockReturnValue({
    data: [],
    isLoading: false,
    error: null,
  })
  mockUseApproveWeek.mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  })
  mockUseRentabiliteEtablissement.mockReturnValue({
    data: [],
    isLoading: false,
    error: null,
  })
  mockUseRentabiliteProjetRd.mockReturnValue({
    data: [],
    isLoading: false,
    error: null,
  })
}

describe('TempsTracking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaultMocks()
  })

  it('affiche le chargement quand les imputations sont en cours de chargement', () => {
    mockUseWeekImputations.mockReturnValue({
      data: WEEK_IMPUTATIONS,
      isLoading: true,
      error: null,
    })

    render(<TempsTracking />, { wrapper: createWrapper() })

    expect(screen.getByText('loading-state')).toBeInTheDocument()
  })

  it('affiche les métriques réelles de la semaine pour un utilisateur standard sans onglets admin', async () => {
    render(<TempsTracking />, { wrapper: createWrapper() })

    expect(screen.getByText('Ma semaine de travail')).toBeInTheDocument()
    expect(screen.getByText('Suivi du temps')).toBeInTheDocument()

    expect(screen.getByText('5.0')).toBeInTheDocument()
    expect(screen.getByText('2.0')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('0.7')).toBeInTheDocument()

    expect(screen.getByText("14% de l'objectif hebdo (35h)")).toBeInTheDocument()
    expect(screen.getByText(/Taux facturable/)).toHaveTextContent('40%')

    expect(screen.getByText('Ma semaine')).toBeInTheDocument()
    expect(screen.queryByText('Validation')).not.toBeInTheDocument()
    expect(screen.queryByText('Rentabilité')).not.toBeInTheDocument()

    expect(mockFrom).toHaveBeenCalledWith('etablissements')
    expect(mockFrom).toHaveBeenCalledWith('rd_projets')
  })

  it('affiche les onglets admin et le message de rejet pour un profil admin', () => {
    mockUseUserRole.mockReturnValue(ROLE_ADMIN)
    mockUseWeeklySubmission.mockReturnValue({
      data: WEEKLY_SUBMISSION_REJECTED,
      isLoading: false,
      error: null,
    })

    render(<TempsTracking />, { wrapper: createWrapper() })

    expect(screen.getByText('Validation')).toBeInTheDocument()
    expect(screen.getByText('Rentabilité')).toBeInTheDocument()
    expect(screen.getByText(/Semaine rejetée/)).toBeInTheDocument()
    expect(screen.getByText('Temps incomplet')).toBeInTheDocument()
  })

  it('affiche l’état d’erreur quand la récupération des imputations échoue', () => {
    mockUseWeekImputations.mockReturnValue({
      data: null,
      isLoading: false,
      error: { message: 'x' },
    })

    render(<TempsTracking />, { wrapper: createWrapper() })

    expect(screen.getByText('error-state:x')).toBeInTheDocument()
  })
})
