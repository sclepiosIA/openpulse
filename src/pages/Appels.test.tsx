/* @vitest-environment jsdom */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent } from '@testing-library/react';
import { renderHook, waitFor } from '@testing-library/react';
import Appels from './Appels';

const {
  CALLS,
  AUTH_STATE,
  mockUseCalls,
  mockUsePageTitle,
  mockRefetch,
  mockFrom,
} = vi.hoisted(() => {
  const CALLS = [
    {
      id: 'c1',
      display_name: 'Alice Martin',
      from_number: '0102030405',
      to_number: '0600000001',
      notes: 'Client prioritaire',
      direction: 'outbound',
      status: 'completed',
      duration_sec: 125,
      started_at: '2024-01-15T09:30:00.000Z',
      failure_reason: '',
      recording_path: 'rec-1',
    },
    {
      id: 'c2',
      display_name: '',
      from_number: '0700000002',
      to_number: '0102030406',
      notes: 'Rappeler demain',
      direction: 'inbound',
      status: 'missed',
      duration_sec: 0,
      started_at: '2024-01-16T11:00:00.000Z',
      failure_reason: 'Pas de réponse',
      recording_path: 'rec-2',
    },
    {
      id: 'c3',
      display_name: 'Bob Durant',
      from_number: '0102030407',
      to_number: '0600000003',
      notes: '',
      direction: 'outbound',
      status: 'completed',
      duration_sec: 35,
      started_at: '2024-01-17T14:45:00.000Z',
      failure_reason: '',
      recording_path: 'rec-3',
    },
  ];

  const AUTH_STATE = {
    user: { id: 'u1', email: 'test@example.com' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  return {
    CALLS,
    AUTH_STATE,
    mockUseCalls: vi.fn(),
    mockUsePageTitle: vi.fn(),
    mockRefetch: vi.fn(),
    mockFrom: vi.fn(),
  };
});

vi.mock('@/hooks/voice/useCalls', () => ({
  useCalls: mockUseCalls,
}));

vi.mock('@/hooks/shared/usePageTitle', () => ({
  usePageTitle: mockUsePageTitle,
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
    then: (onFulfilled: (value: { data: null; error: null }) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).catch(onRejected),
  };

  mockFrom.mockImplementation(() => builder);

  return {
    supabase: {
      from: mockFrom,
      auth: {
        getSession: vi.fn(async () => ({ data: { session: AUTH_STATE.session }, error: null })),
        getUser: vi.fn(async () => ({ data: { user: AUTH_STATE.user }, error: null })),
      },
    },
  };
});

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({
    value,
    onChange,
    placeholder,
    className,
  }: {
    value?: string;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    placeholder?: string;
    className?: string;
  }) => (
    <input
      aria-label={placeholder}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className={className}
    />
  ),
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    children: React.ReactNode;
  }) => (
    <div>
      <label htmlFor="direction-select">Direction</label>
      <select
        id="direction-select"
        aria-label="Direction"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
      >
        <option value="all">Tous</option>
        <option value="outbound">Sortants</option>
        <option value="inbound">Entrants</option>
      </select>
      {children}
    </div>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => <span>value</span>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('@/components/cti/CallRecordingPlayer', () => ({
  CallRecordingPlayer: ({ recordingPath }: { recordingPath?: string }) => (
    <div data-testid="recording-player">{recordingPath ?? 'no-recording'}</div>
  ),
}));

vi.mock('@/components/common/PageDataState', () => ({
  PageDataState: ({
    isLoading,
    isError,
    isEmpty,
    emptyTitle,
    emptyDescription,
    onRetry,
    children,
  }: {
    isLoading: boolean;
    isError: boolean;
    isEmpty: boolean;
    emptyTitle: string;
    emptyDescription: string;
    onRetry: () => void;
    children: React.ReactNode;
  }) => {
    if (isLoading) return <div>Chargement...</div>;
    if (isError) {
      return <button onClick={onRetry}>Erreur de chargement</button>;
    }
    if (isEmpty) {
      return (
        <div>
          <div>{emptyTitle}</div>
          <div>{emptyDescription}</div>
        </div>
      );
    }
    return <>{children}</>;
  },
}));

vi.mock('@/types/calls', () => ({
  CALL_STATUS_LABELS: {
    completed: 'Abouti',
    missed: 'Manqué',
    failed: 'Échoué',
  },
}));

vi.mock('lucide-react', () => ({
  Phone: () => <svg data-testid="icon-phone" />,
  PhoneIncoming: () => <svg data-testid="icon-phone-in" />,
  PhoneOutgoing: () => <svg data-testid="icon-phone-out" />,
  Clock: () => <svg data-testid="icon-clock" />,
  CheckCircle2: () => <svg data-testid="icon-check" />,
  XCircle: () => <svg data-testid="icon-x" />,
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

describe('Appels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRefetch.mockResolvedValue(undefined);
  });

  it('affiche le chargement puis le succès avec les KPIs et les données métier', async () => {
    mockUseCalls
      .mockReturnValueOnce({
        data: undefined,
        isLoading: true,
        isError: false,
        refetch: mockRefetch,
      })
      .mockReturnValue({
        data: CALLS,
        isLoading: false,
        isError: false,
        refetch: mockRefetch,
      });

    const { rerender } = render(<Appels />);

    expect(screen.getByText('Chargement...')).toBeInTheDocument();

    rerender(<Appels />);

    await waitFor(() => {
      expect(screen.getByText('Appels')).toBeInTheDocument();
    });

    expect(mockUsePageTitle).toHaveBeenCalledWith('Appels');
    expect(mockUseCalls).toHaveBeenCalledWith({ limit: 500 });

    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1m 20s')).toBeInTheDocument();
    expect(screen.getByText('67%')).toBeInTheDocument();

    expect(screen.getByText('Alice Martin')).toBeInTheDocument();
    expect(screen.getByText('Bob Durant')).toBeInTheDocument();
    expect(screen.getByText('0700000002')).toBeInTheDocument();

    expect(screen.getAllByText('Abouti')).toHaveLength(2);
    expect(screen.getByText('Manqué')).toBeInTheDocument();
    expect(screen.getByText('Client prioritaire')).toBeInTheDocument();
    expect(screen.getByText('Rappeler demain')).toBeInTheDocument();
    expect(screen.getByText('Pas de réponse')).toBeInTheDocument();

    const players = screen.getAllByTestId('recording-player');
    expect(players).toHaveLength(3);
    expect(players[0]).toHaveTextContent('rec-1');
    expect(players[1]).toHaveTextContent('rec-2');
    expect(players[2]).toHaveTextContent('rec-3');
  });

  it('filtre par recherche et direction', async () => {
    mockUseCalls.mockReturnValue({
      data: CALLS,
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    });

    render(<Appels />);

    const searchInput = screen.getByPlaceholderText('Rechercher (nom, numéro, note)…');
    fireEvent.change(searchInput, { target: { value: 'prioritaire' } });

    expect(screen.getByText('Alice Martin')).toBeInTheDocument();
    expect(screen.queryByText('Bob Durant')).not.toBeInTheDocument();
    expect(screen.queryByText('0700000002')).not.toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: '' } });

    const select = screen.getByLabelText('Direction');
    fireEvent.change(select, { target: { value: 'inbound' } });

    expect(screen.getByText('0700000002')).toBeInTheDocument();
    expect(screen.queryByText('Alice Martin')).not.toBeInTheDocument();
    expect(screen.queryByText('Bob Durant')).not.toBeInTheDocument();
  });

  it('affiche l’état vide quand aucun appel ne correspond aux filtres', async () => {
    mockUseCalls.mockReturnValue({
      data: CALLS,
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    });

    render(<Appels />);

    fireEvent.change(screen.getByPlaceholderText('Rechercher (nom, numéro, note)…'), {
      target: { value: 'introuvable' },
    });

    expect(screen.getByText('Aucun appel')).toBeInTheDocument();
    expect(screen.getByText('Aucun appel ne correspond aux filtres.')).toBeInTheDocument();
  });

  it('affiche l’erreur et permet de relancer le chargement', async () => {
    mockUseCalls.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      refetch: mockRefetch,
    });

    render(<Appels />);

    const retryButton = screen.getByRole('button', { name: 'Erreur de chargement' });
    expect(retryButton).toBeInTheDocument();

    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });
  });

  it('utilise renderHook avec QueryClientProvider sans erreur', async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(() => ({ ok: true }), { wrapper });

    await waitFor(() => {
      expect(result.current.ok).toBe(true);
    });
  });
});