import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CallHistoryTab } from './CallHistoryTab';

const {
  CALLS,
  AUTH_STATE,
  mockUseCalls,
  mockFrom,
  mockNavigate,
  mockToastSuccess,
  mockToastError,
} = vi.hoisted(() => ({
  CALLS: [
    {
      id: 'call-1',
      direction: 'outbound',
      display_name: 'Clinique Demo',
      to_number: '0102030405',
      from_number: '0600000001',
      status: 'completed',
      duration_sec: 125,
      started_at: '2024-05-10T14:30:00.000Z',
      notes: 'Relance effectuée',
      recording_path: 'records/call-1.mp3',
    },
    {
      id: 'call-2',
      direction: 'inbound',
      display_name: '',
      to_number: '0102030406',
      from_number: '0600000002',
      status: 'missed',
      duration_sec: 0,
      started_at: '2024-05-09T09:15:00.000Z',
      notes: '',
      recording_path: null,
    },
  ],
  AUTH_STATE: {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  mockUseCalls: vi.fn(),
  mockFrom: vi.fn(),
  mockNavigate: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

function createQueryBuilder() {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    neq: vi.fn(() => builder),
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
    then: (onFulfilled: (value: { data: null; error: null }) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve().catch(onRejected),
  };
  return builder;
}

vi.mock('@/hooks/voice/useCalls', () => ({
  useCalls: mockUseCalls,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-title" className={className}>{children}</div>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>{children}</div>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span data-testid="badge">{children}</span>,
}));

vi.mock('./CallRecordingPlayer', () => ({
  CallRecordingPlayer: ({ recordingPath }: { recordingPath: string | null }) => (
    <div data-testid="recording-player">{recordingPath ?? 'no-recording'}</div>
  ),
}));

vi.mock('@/types/calls', () => ({
  CALL_STATUS_LABELS: {
    completed: 'Terminé',
    missed: 'Manqué',
    failed: 'Échoué',
    ongoing: 'En cours',
  },
}));

vi.mock('lucide-react', () => ({
  Phone: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-phone" {...props} />,
  PhoneIncoming: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-incoming" {...props} />,
  PhoneOutgoing: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-outgoing" {...props} />,
  Loader2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-loader" {...props} />,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom.mockImplementation(() => createQueryBuilder()),
    auth: {
      getSession: vi.fn(async () => ({ data: { session: AUTH_STATE.session }, error: null })),
      getUser: vi.fn(async () => ({ data: { user: AUTH_STATE.user }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('CallHistoryTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche le loader pendant le chargement', () => {
    mockUseCalls.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    });

    render(<CallHistoryTab etablissementId="eta-1" />, { wrapper: createWrapper() });

    expect(screen.getByTestId('icon-loader')).toBeInTheDocument();
    expect(screen.queryByText(/Historique d'appels/i)).not.toBeInTheDocument();
    expect(mockUseCalls).toHaveBeenCalledWith({
      etablissementId: 'eta-1',
      prospectId: undefined,
      contactId: undefined,
      limit: 50,
    });
  });

  it('affiche le message vide quand aucun appel n’est enregistré', () => {
    mockUseCalls.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<CallHistoryTab prospectId="pros-1" />, { wrapper: createWrapper() });

    expect(screen.getByText('Aucun appel enregistré.')).toBeInTheDocument();
    expect(screen.queryByText(/Historique d'appels/i)).not.toBeInTheDocument();
    expect(mockUseCalls).toHaveBeenCalledWith({
      etablissementId: undefined,
      prospectId: 'pros-1',
      contactId: undefined,
      limit: 50,
    });
  });

  it('affiche l’historique des appels avec les valeurs métier réelles', () => {
    mockUseCalls.mockReturnValue({
      data: CALLS,
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<CallHistoryTab contactId="contact-1" />, { wrapper: createWrapper() });

    expect(screen.getByText("Historique d'appels (2)")).toBeInTheDocument();

    expect(screen.getByText('Clinique Demo')).toBeInTheDocument();
    expect(screen.getByText('Terminé')).toBeInTheDocument();
    expect(screen.getByText('2m 5s')).toBeInTheDocument();
    expect(screen.getByText('Relance effectuée')).toBeInTheDocument();

    expect(screen.getByText('0600000002')).toBeInTheDocument();
    expect(screen.getByText('Manqué')).toBeInTheDocument();

    const recordingPlayers = screen.getAllByTestId('recording-player');
    expect(recordingPlayers).toHaveLength(2);
    expect(recordingPlayers[0]).toHaveTextContent('records/call-1.mp3');
    expect(recordingPlayers[1]).toHaveTextContent('no-recording');

    expect(screen.getByTestId('icon-phone')).toBeInTheDocument();
    expect(screen.getAllByTestId('icon-outgoing')).toHaveLength(1);
    expect(screen.getAllByTestId('icon-incoming')).toHaveLength(1);

    expect(screen.getByText(new RegExp(format(new Date(CALLS[0].started_at), 'dd MMM yyyy à HH:mm', { locale: fr })))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(format(new Date(CALLS[1].started_at), 'dd MMM yyyy à HH:mm', { locale: fr })))).toBeInTheDocument();

    expect(mockUseCalls).toHaveBeenCalledWith({
      etablissementId: undefined,
      prospectId: undefined,
      contactId: 'contact-1',
      limit: 50,
    });
  });

  it('retombe sur l’état vide si le hook renvoie une erreur avec data null', () => {
    mockUseCalls.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      error: { message: 'x' },
    });

    render(<CallHistoryTab etablissementId="eta-err" />, { wrapper: createWrapper() });

    expect(screen.getByText('Aucun appel enregistré.')).toBeInTheDocument();
    expect(screen.queryByText(/Historique d'appels/i)).not.toBeInTheDocument();
    expect(mockUseCalls).toHaveBeenCalledWith({
      etablissementId: 'eta-err',
      prospectId: undefined,
      contactId: undefined,
      limit: 50,
    });
  });
});