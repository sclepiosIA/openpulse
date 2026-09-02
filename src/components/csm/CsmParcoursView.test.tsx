/* @vitest-environment jsdom */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CsmParcoursView } from './CsmParcoursView'

const {
  ETABLISSEMENTS_LOADING,
  ETABLISSEMENTS_SUCCESS,
  JALONS_EMPTY,
  JALONS_SUCCESS,
  JALON_TYPES_MOCK,
  UPSERT_MOCK,
  useProductionMock,
  useCsmParcoursMock,
  mockFrom,
  AUTH_STATE,
  navigateMock,
  toastSuccess,
  toastError,
} = vi.hoisted(() => ({
  ETABLISSEMENTS_LOADING: undefined,
  ETABLISSEMENTS_SUCCESS: [
    { id: 'etab-1', nom: 'Clinique A' },
    { id: 'etab-2', nom: 'Hopital B' },
  ],
  JALONS_EMPTY: [],
  JALONS_SUCCESS: [
    {
      id: 'jal-1',
      etablissement_id: 'etab-1',
      jalon_type: 'kickoff',
      statut: 'done',
      date_jalon: '2024-02-15',
    },
    {
      id: 'jal-2',
      etablissement_id: 'etab-2',
      jalon_type: 'formation',
      statut: 'planned',
      date_jalon: null,
    },
  ],
  JALON_TYPES_MOCK: [
    { value: 'kickoff', label: 'Kickoff' },
    { value: 'formation', label: 'Formation' },
  ],
  UPSERT_MOCK: vi.fn(),
  useProductionMock: vi.fn(),
  useCsmParcoursMock: vi.fn(),
  mockFrom: vi.fn(),
  AUTH_STATE: {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  navigateMock: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

function createBuilder(result?: unknown) {
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
    single: vi.fn(async () => result ?? { data: null, error: null }),
    maybeSingle: vi.fn(async () => result ?? { data: null, error: null }),
    then: (onFulfilled: (value: unknown) => unknown) =>
      Promise.resolve(result ?? { data: null, error: null }).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve(result ?? { data: null, error: null }).catch(onRejected),
  }
  return builder
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom.mockImplementation(() => createBuilder()),
  },
}))

vi.mock('@/components/ui/table', () => ({
  Table: ({ children }: { children: React.ReactNode }) => <table data-testid="table">{children}</table>,
  TableHeader: ({ children }: { children: React.ReactNode }) => <thead>{children}</thead>,
  TableHead: ({ children, className }: { children: React.ReactNode; className?: string }) => <th className={className}>{children}</th>,
  TableBody: ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>,
  TableRow: ({ children, className }: { children: React.ReactNode; className?: string }) => <tr className={className}>{children}</tr>,
  TableCell: ({ children, className }: { children: React.ReactNode; className?: string }) => <td className={className}>{children}</td>,
}))

vi.mock('@/components/csm/StatusBadge', () => ({
  StatusBadge: ({ status }: { status: string }) => <span data-testid={`status-${status}`}>{status}</span>,
}))

vi.mock('@/components/csm/EditableSelectCell', () => ({
  EditableSelectCell: ({
    value,
    options,
    onSave,
  }: {
    value: string
    options: Array<{ value: string; label: string }>
    onSave: (v: string) => void
  }) => (
    <select
      data-testid={`editable-select-${value || 'empty'}`}
      value={value}
      onChange={(e) => onSave(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}))

vi.mock('@/hooks/csm/useCsmParcours', () => ({
  useCsmParcours: useCsmParcoursMock,
}))

vi.mock('@/hooks/production/useProduction', () => ({
  useProduction: useProductionMock,
}))

vi.mock('@/types/csm', () => ({
  JALON_TYPES: JALON_TYPES_MOCK,
}))

vi.mock('lucide-react', () => ({
  CalendarIcon: () => <svg data-testid="calendar-icon" />,
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: Array<string | false | null | undefined>) => args.filter(Boolean).join(' '),
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    className,
  }: {
    children: React.ReactNode
    onClick?: () => void
    className?: string
  }) => (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/calendar', () => ({
  Calendar: ({
    onSelect,
  }: {
    onSelect: (date: Date | undefined) => void
  }) => (
    <button type="button" data-testid="calendar-select" onClick={() => onSelect(new Date('2024-03-20'))}>
      pick-date
    </button>
  ),
}))

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}))

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function renderWithClient(ui: React.ReactElement) {
  const client = createTestQueryClient()
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('CsmParcoursView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('affiche un état initial sans lignes quand les données de production ne sont pas encore disponibles', () => {
    useProductionMock.mockReturnValue({ data: ETABLISSEMENTS_LOADING })
    useCsmParcoursMock.mockReturnValue({ data: JALONS_EMPTY, upsert: UPSERT_MOCK })

    renderWithClient(<CsmParcoursView />)

    expect(screen.getByTestId('table')).toBeInTheDocument()
    expect(screen.getByText('Compte')).toBeInTheDocument()
    expect(screen.getByText('Kickoff')).toBeInTheDocument()
    expect(screen.getByText('Formation')).toBeInTheDocument()
    expect(screen.queryByText('Clinique A')).not.toBeInTheDocument()
    expect(screen.queryByText('Hopital B')).not.toBeInTheDocument()
  })

  it('affiche les etablissements, les statuts existants et la date formatée', () => {
    useProductionMock.mockReturnValue({ data: ETABLISSEMENTS_SUCCESS })
    useCsmParcoursMock.mockReturnValue({ data: JALONS_SUCCESS, upsert: UPSERT_MOCK })

    renderWithClient(<CsmParcoursView />)

    expect(screen.getByText('Clinique A')).toBeInTheDocument()
    expect(screen.getByText('Hopital B')).toBeInTheDocument()

    expect(screen.getByTestId('status-done')).toHaveTextContent('done')
    expect(screen.getByTestId('status-planned')).toHaveTextContent('planned')

    expect(screen.getByText('15/02/2024')).toBeInTheDocument()
    expect(screen.getByText('Date...')).toBeInTheDocument()
  })

  it('déclenche un upsert métier lors de la mise à jour du statut d’un jalon existant', async () => {
    useProductionMock.mockReturnValue({ data: ETABLISSEMENTS_SUCCESS })
    useCsmParcoursMock.mockReturnValue({ data: JALONS_SUCCESS, upsert: UPSERT_MOCK })

    renderWithClient(<CsmParcoursView />)

    const selects = screen.getAllByRole('combobox')
    fireEvent.change(selects[0], { target: { value: 'pending' } })

    await waitFor(() => {
      expect(UPSERT_MOCK).toHaveBeenCalledWith({
        id: 'jal-1',
        etablissement_id: 'etab-1',
        jalon_type: 'kickoff',
        statut: 'pending',
        date_jalon: '2024-02-15',
      })
    })
  })

  it('déclenche un upsert avec création implicite lors de la mise à jour d’un jalon absent', async () => {
    useProductionMock.mockReturnValue({ data: ETABLISSEMENTS_SUCCESS })
    useCsmParcoursMock.mockReturnValue({ data: JALONS_EMPTY, upsert: UPSERT_MOCK })

    renderWithClient(<CsmParcoursView />)

    const selects = screen.getAllByRole('combobox')
    fireEvent.change(selects[1], { target: { value: 'planning' } })

    await waitFor(() => {
      expect(UPSERT_MOCK).toHaveBeenCalledWith({
        etablissement_id: 'etab-1',
        jalon_type: 'formation',
        statut: 'planning',
      })
    })
  })

  it('déclenche un upsert de date avec format yyyy-MM-dd quand une date est choisie', async () => {
    useProductionMock.mockReturnValue({ data: ETABLISSEMENTS_SUCCESS })
    useCsmParcoursMock.mockReturnValue({ data: JALONS_SUCCESS, upsert: UPSERT_MOCK })

    renderWithClient(<CsmParcoursView />)

    const dateButtons = screen.getAllByTestId('calendar-select')
    fireEvent.click(dateButtons[0])

    await waitFor(() => {
      expect(UPSERT_MOCK).toHaveBeenCalledWith({
        id: 'jal-1',
        etablissement_id: 'etab-1',
        jalon_type: 'kickoff',
        statut: 'done',
        date_jalon: '2024-03-20',
      })
    })
  })

  it('propage une erreur du hook de parcours', async () => {
    const error = new Error('x')
    useProductionMock.mockReturnValue({ data: ETABLISSEMENTS_SUCCESS })
    useCsmParcoursMock.mockImplementation(() => {
      throw error
    })

    expect(() => renderWithClient(<CsmParcoursView />)).toThrow('x')
  })
})