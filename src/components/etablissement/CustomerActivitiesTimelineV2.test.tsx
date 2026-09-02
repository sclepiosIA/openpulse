/* @vitest-environment jsdom */

import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CustomerActivitiesTimelineV2 } from './CustomerActivitiesTimelineV2'

const {
  AUTH_STATE,
  ACTIVITIES_LOADING_STATE,
  ACTIVITIES_SUCCESS_STATE,
  ACTIVITIES_ERROR_STATE,
  CREATE_ACTIVITY_STATE,
  useAuthMock,
  useCustomerActivitiesMock,
  useCreateActivityMock,
  mutateAsyncMock,
  toastSuccessMock,
  toastErrorMock,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: 'user-1', email: 'test@example.com' },
    session: { user: { id: 'user-1' } },
    isLoading: false,
  }

  const ACTIVITIES_LOADING_STATE = {
    data: undefined,
    isLoading: true,
    isError: false,
    error: null,
  }

  const ACTIVITIES_SUCCESS_STATE = {
    data: [
      {
        id: 'act-1',
        title: 'Appel de suivi',
        description: '<p>Point mensuel avec le client</p>',
        activity_type: 'call',
        activity_date: '2024-03-15T10:00:00.000Z',
        created_at: '2024-03-15T10:00:00.000Z',
        metadata: {
          duration_minutes: 30,
          attendees: ['Jean Dupont', 'Marie Martin'],
          followup_notes: 'Envoyer le récapitulatif',
        },
        profiles: { first_name: 'Alice', last_name: 'Martin' },
      },
      {
        id: 'act-2',
        title: 'Réunion QBR',
        description: '<p>Revue trimestrielle</p>',
        activity_type: 'meeting',
        activity_date: '2024-02-10T14:00:00.000Z',
        created_at: '2024-02-10T14:00:00.000Z',
        metadata: {},
        profiles: { first_name: 'Bob', last_name: 'Durand' },
      },
    ],
    isLoading: false,
    isError: false,
    error: null,
  }

  const ACTIVITIES_ERROR_STATE = {
    data: null,
    isLoading: false,
    isError: true,
    error: { message: 'x' },
  }

  const mutateAsyncMock = vi.fn()
  const CREATE_ACTIVITY_STATE = {
    mutateAsync: mutateAsyncMock,
    isPending: false,
    isError: false,
    error: null,
  }

  return {
    AUTH_STATE,
    ACTIVITIES_LOADING_STATE,
    ACTIVITIES_SUCCESS_STATE,
    ACTIVITIES_ERROR_STATE,
    CREATE_ACTIVITY_STATE,
    useAuthMock: vi.fn(() => AUTH_STATE),
    useCustomerActivitiesMock: vi.fn(() => ACTIVITIES_SUCCESS_STATE),
    useCreateActivityMock: vi.fn(() => CREATE_ACTIVITY_STATE),
    mutateAsyncMock,
    toastSuccessMock: vi.fn(),
    toastErrorMock: vi.fn(),
  }
})

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: useAuthMock,
}))

vi.mock('@/hooks/crm/useCustomerActivities', () => ({
  ActivityType: {},
  useCustomerActivities: useCustomerActivitiesMock,
  useCreateActivity: useCreateActivityMock,
}))

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}))

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
  CardHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => <h2 className={className}>{children}</h2>,
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    type = 'button',
    disabled,
  }: {
    children: React.ReactNode
    onClick?: React.MouseEventHandler<HTMLButtonElement>
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
  }) => (
    <button type={type} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string
    onValueChange?: (value: string) => void
    children: React.ReactNode
  }) => (
    <div>
      <select
        data-testid="select"
        value={value}
        onChange={(e) => onValueChange?.(e.target.value)}
      >
        <option value={value}>{value}</option>
        <option value="all">all</option>
        <option value="call">call</option>
        <option value="meeting">meeting</option>
        <option value="note">note</option>
        <option value="linkedin">linkedin</option>
      </select>
      {children}
    </div>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open?: boolean }) => (
    <div>{open ? children : children}</div>
  ),
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/input', () => ({
  Input: ({
    value,
    onChange,
    placeholder,
    id,
    type,
  }: {
    value?: string
    onChange?: React.ChangeEventHandler<HTMLInputElement>
    placeholder?: string
    id?: string
    type?: string
  }) => <input id={id} type={type} value={value} onChange={onChange} placeholder={placeholder} />,
}))

vi.mock('@/components/ui/textarea', () => ({
  Textarea: ({
    value,
    onChange,
    placeholder,
    id,
  }: {
    value?: string
    onChange?: React.ChangeEventHandler<HTMLTextAreaElement>
    placeholder?: string
    id?: string
  }) => <textarea id={id} value={value} onChange={onChange} placeholder={placeholder} />,
}))

vi.mock('./ActivityRichEditor', () => ({
  ActivityRichEditor: ({
    content,
    onChange,
    placeholder,
  }: {
    content?: string
    onChange: (value: string) => void
    placeholder?: string
  }) => (
    <textarea
      aria-label="Compte-rendu / Notes"
      value={content}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  ),
}))

vi.mock('@/components/ui/label', () => ({
  Label: ({
    children,
    htmlFor,
  }: {
    children: React.ReactNode
    htmlFor?: string
  }) => <label htmlFor={htmlFor}>{children}</label>,
}))

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/calendar', () => ({
  Calendar: ({ onSelect }: { onSelect?: (date?: Date) => void }) => (
    <button onClick={() => onSelect?.(new Date('2024-04-20T00:00:00.000Z'))}>pick-date</button>
  ),
}))

vi.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleTrigger: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
}))

vi.mock('lucide-react', () => {
  const Icon = () => <span />
  return {
    Calendar: Icon,
    Plus: Icon,
    Loader2: Icon,
    Filter: Icon,
    ChevronDown: Icon,
    ChevronRight: Icon,
    BarChart3: Icon,
    GraduationCap: Icon,
    Ticket: Icon,
    AlertTriangle: Icon,
    RefreshCw: Icon,
    TrendingUp: Icon,
    ClipboardList: Icon,
    Heart: Icon,
    StickyNote: Icon,
    Users: Icon,
    Mail: Icon,
    AlertCircle: Icon,
    Phone: Icon,
    Video: Icon,
    FileText: Icon,
    CalendarIcon: Icon,
    Clock: Icon,
    UserCircle: Icon,
    Linkedin: Icon,
    Link: Icon,
  }
})

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

describe('CustomerActivitiesTimelineV2', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthMock.mockReturnValue(AUTH_STATE)
    useCreateActivityMock.mockReturnValue(CREATE_ACTIVITY_STATE)
    useCustomerActivitiesMock.mockReturnValue(ACTIVITIES_SUCCESS_STATE)
    mutateAsyncMock.mockResolvedValue({ data: { id: 'new-1' }, error: null })
  })

  it('affiche un état de chargement puis les activités avec le compteur et les titres métier', () => {
    const wrapper = createWrapper()
    const { rerender } = render(<CustomerActivitiesTimelineV2 etablissementId="eta-1" />, { wrapper })

    expect(screen.getByText('Historique client')).toBeInTheDocument()

    useCustomerActivitiesMock.mockReturnValueOnce(ACTIVITIES_LOADING_STATE)
    rerender(<CustomerActivitiesTimelineV2 etablissementId="eta-1" />)

    useCustomerActivitiesMock.mockReturnValue(ACTIVITIES_SUCCESS_STATE)
    rerender(<CustomerActivitiesTimelineV2 etablissementId="eta-1" />)

    expect(useCustomerActivitiesMock).toHaveBeenCalledWith('eta-1', { type: undefined, limit: 100 })
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('Appel de suivi')).toBeInTheDocument()
    expect(screen.getByText('Réunion QBR')).toBeInTheDocument()
  })

  it('passe le filtre sélectionné au hook de récupération', async () => {
    const user = userEvent.setup()
    const wrapper = createWrapper()
    render(<CustomerActivitiesTimelineV2 etablissementId="eta-9" />, { wrapper })

    const selects = screen.getAllByTestId('select')
    await user.selectOptions(selects[0], 'call')

    expect(useCustomerActivitiesMock).toHaveBeenLastCalledWith('eta-9', { type: 'call', limit: 100 })
  })

  it('crée une activité avec les métadonnées enrichies et le created_by utilisateur', async () => {
    const user = userEvent.setup()
    const wrapper = createWrapper()
    render(<CustomerActivitiesTimelineV2 etablissementId="eta-1" />, { wrapper })

    await user.click(screen.getByText('Ajouter'))

    const titleInput = screen.getByLabelText('Titre')
    await user.type(titleInput, 'Appel de cadrage')

    const durationInput = screen.getByLabelText('Durée (minutes)')
    await user.type(durationInput, '45')

    const attendeesInput = screen.getByLabelText('Participants')
    await user.type(attendeesInput, 'Jean Dupont, Marie Martin')

    const editor = screen.getByLabelText('Compte-rendu / Notes')
    await user.type(editor, '<p>Décisions et prochaines étapes</p>')

    const calendarButton = screen.getByText('pick-date')
    await user.click(calendarButton)

    const createButtons = screen.getAllByText('Créer')
    fireEvent.click(createButtons[createButtons.length - 1])

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({
          etablissement_id: 'eta-1',
          title: 'Appel de cadrage',
          description: '<p>Décisions et prochaines étapes</p>',
          activity_type: 'note',
          status: 'completed',
          scheduled_date: null,
          created_by: 'user-1',
          assigned_to: null,
          metadata: {
            duration_minutes: 45,
            attendees: ['Jean Dupont', 'Marie Martin'],
          },
        })
      )
    })

    const payload = mutateAsyncMock.mock.calls[0][0] as {
      activity_date: string
      completed_date: string
    }

    expect(payload.activity_date).toContain('2024-04-20')
    expect(typeof payload.completed_date).toBe('string')
  })

  it('ne crée pas d activité si le titre est vide', async () => {
    const user = userEvent.setup()
    const wrapper = createWrapper()
    render(<CustomerActivitiesTimelineV2 etablissementId="eta-1" />, { wrapper })

    await user.click(screen.getByText('Ajouter'))

    const createButtons = screen.getAllByText('Créer')
    await user.click(createButtons[createButtons.length - 1])

    expect(mutateAsyncMock).not.toHaveBeenCalled()
  })

  it('gère un état d erreur du hook sans dépendre du réseau réel', () => {
    const wrapper = createWrapper()
    useCustomerActivitiesMock.mockReturnValue(ACTIVITIES_ERROR_STATE)

    render(<CustomerActivitiesTimelineV2 etablissementId="eta-err" />, { wrapper })

    expect(useCustomerActivitiesMock).toHaveBeenCalledWith('eta-err', { type: undefined, limit: 100 })
    expect(screen.getByText('Historique client')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.queryByText('Appel de suivi')).not.toBeInTheDocument()
  })
})