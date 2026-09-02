// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { GlobalTranscriptionWidget } from './GlobalTranscriptionWidget';

const {
  transcriptionState,
  toggleRecordingMock,
  toggleExtendedModeMock,
  endSessionMock,
  mockFrom,
  builder,
  QUERY_SUCCESS_DATA,
  QUERY_ERROR_DATA,
} = vi.hoisted(() => {
  const toggleRecordingMock = vi.fn();
  const toggleExtendedModeMock = vi.fn();
  const endSessionMock = vi.fn();

  const QUERY_SUCCESS_DATA = [{ id: '1', label: 'ok' }];
  const QUERY_ERROR_DATA = { data: null, error: { message: 'x' } };

  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    upsert: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    then: undefined as unknown,
    catch: undefined as unknown,
  };

  const chain = vi.fn(() => builder);
  builder.select.mockImplementation(chain);
  builder.eq.mockImplementation(chain);
  builder.gte.mockImplementation(chain);
  builder.lte.mockImplementation(chain);
  builder.in.mockImplementation(chain);
  builder.order.mockImplementation(chain);
  builder.limit.mockImplementation(chain);
  builder.insert.mockImplementation(chain);
  builder.update.mockImplementation(chain);
  builder.delete.mockImplementation(chain);
  builder.upsert.mockImplementation(chain);
  builder.single.mockResolvedValue({ data: QUERY_SUCCESS_DATA[0], error: null });
  builder.maybeSingle.mockResolvedValue({ data: QUERY_SUCCESS_DATA[0], error: null });
  builder.then = ((onFulfilled?: (value: { data: typeof QUERY_SUCCESS_DATA; error: null }) => unknown) =>
    Promise.resolve({ data: QUERY_SUCCESS_DATA, error: null }).then(onFulfilled)) as typeof builder.then;
  builder.catch = ((onRejected?: (reason: unknown) => unknown) =>
    Promise.resolve({ data: QUERY_SUCCESS_DATA, error: null }).catch(onRejected)) as typeof builder.catch;

  const mockFrom = vi.fn(() => builder);

  const transcriptionState = {
    activeSession: { title: 'Réunion produit' } as { title: string } | null,
    isSessionActive: true,
    isRecording: false,
    isConnecting: false,
    isExtendedMode: false,
    toggleRecording: toggleRecordingMock,
    toggleExtendedMode: toggleExtendedModeMock,
    endSession: endSessionMock,
    segments: [] as Array<{ id: string; speaker_name: string; created_at: string; text: string }>,
    participants: [] as Array<{ id: string; display_name: string; is_transcribing: boolean; left_at: string | null }>,
    currentText: '',
  };

  return {
    transcriptionState,
    toggleRecordingMock,
    toggleExtendedModeMock,
    endSessionMock,
    mockFrom,
    builder,
    QUERY_SUCCESS_DATA,
    QUERY_ERROR_DATA,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/contexts/TranscriptionContext', () => ({
  useTranscription: () => transcriptionState,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
    variant,
    size,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: string;
    size?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={className}
      data-variant={variant}
      data-size={size}
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({
    children,
    className,
  }: React.HTMLAttributes<HTMLDivElement>) => <div className={className}>{children}</div>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    className,
  }: React.HTMLAttributes<HTMLDivElement>) => <div className={className}>{children}</div>,
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ children, className }, ref) => (
      <div ref={ref} className={className}>
        {children}
      </div>
    )
  ),
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <>{children}</>,
}));

vi.mock('@/components/ui/switch', () => ({
  Switch: ({
    checked,
    onCheckedChange,
    disabled,
    id,
  }: {
    checked?: boolean;
    onCheckedChange?: (value: boolean) => void;
    disabled?: boolean;
    id?: string;
  }) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={id}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
    >
      switch
    </button>
  ),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({
    children,
    htmlFor,
    className,
  }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
    <label htmlFor={htmlFor} className={className}>
      {children}
    </label>
  ),
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />;
  return {
    Mic: Icon,
    MicOff: Icon,
    MonitorSpeaker: Icon,
    ChevronUp: Icon,
    ChevronDown: Icon,
    X: Icon,
    Users: Icon,
    FileText: Icon,
    Loader2: Icon,
    Radio: Icon,
  };
});

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

describe('GlobalTranscriptionWidget', () => {
  beforeEach(() => {
    transcriptionState.activeSession = { title: 'Réunion produit' };
    transcriptionState.isSessionActive = true;
    transcriptionState.isRecording = false;
    transcriptionState.isConnecting = false;
    transcriptionState.isExtendedMode = false;
    transcriptionState.segments = [];
    transcriptionState.participants = [];
    transcriptionState.currentText = '';
    toggleRecordingMock.mockClear();
    toggleExtendedModeMock.mockClear();
    endSessionMock.mockClear();
    mockFrom.mockClear();
    builder.maybeSingle.mockResolvedValue({ data: QUERY_SUCCESS_DATA[0], error: null });
  });

  it('ne rend rien sans session active', () => {
    transcriptionState.isSessionActive = false;
    transcriptionState.activeSession = null;

    const { container } = render(<GlobalTranscriptionWidget />, { wrapper: createWrapper() });

    expect(container.firstChild).toBeNull();
  });

  it('affiche les informations principales et déclenche les actions de base', () => {
    transcriptionState.participants = [
      { id: 'p1', display_name: 'Alice Martin', is_transcribing: true, left_at: null },
      { id: 'p2', display_name: 'Bob Durand', is_transcribing: false, left_at: null },
      { id: 'p3', display_name: 'Claire Test', is_transcribing: true, left_at: '2024-01-01T10:00:00.000Z' },
    ];

    render(<GlobalTranscriptionWidget />, { wrapper: createWrapper() });

    expect(screen.getByText('Réunion produit')).toBeInTheDocument();
    expect(screen.getByText('1 en transcription')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Transcrire' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Transcrire' }));
    expect(toggleRecordingMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(endSessionMock).toHaveBeenCalledTimes(1);
  });

  it('gère l’état de connexion puis le succès en mode étendu avec participants et segments', () => {
    transcriptionState.isConnecting = true;

    const { rerender } = render(<GlobalTranscriptionWidget />, { wrapper: createWrapper() });

    const connectingButton = screen.getByRole('button', { name: 'Connexion...' });
    expect(connectingButton).toBeDisabled();

    transcriptionState.isConnecting = false;
    transcriptionState.isExtendedMode = true;
    transcriptionState.isRecording = false;
    transcriptionState.participants = [
      { id: 'p1', display_name: 'Alice Martin', is_transcribing: true, left_at: null },
      { id: 'p2', display_name: 'Bob Durand', is_transcribing: false, left_at: null },
      { id: 'p3', display_name: 'Claire Partie', is_transcribing: true, left_at: '2024-04-05T10:00:00.000Z' },
    ];
    transcriptionState.segments = [
      {
        id: 's1',
        speaker_name: 'Alice',
        created_at: '2024-04-05T09:30:00.000Z',
        text: 'Bonjour à tous',
      },
      {
        id: 's2',
        speaker_name: 'Bob',
        created_at: '2024-04-05T09:31:00.000Z',
        text: 'Point sur la roadmap',
      },
    ];
    transcriptionState.currentText = 'Je complète une idée';

    rerender(<GlobalTranscriptionWidget />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Suivant' })[0]);

    expect(screen.getByText('Mode étendu (micro + haut-parleurs)')).toBeInTheDocument();
    expect(screen.getByText('Capture toutes les voix de la réunion')).toBeInTheDocument();
    expect(screen.getByText(/Participants \(2\)/)).toBeInTheDocument();
    expect(screen.getAllByText('Alice')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Bob')[0]).toBeInTheDocument();
    expect(screen.getByText('Bonjour à tous')).toBeInTheDocument();
    expect(screen.getByText('Point sur la roadmap')).toBeInTheDocument();
    expect(screen.getByText('Vous')).toBeInTheDocument();
    expect(screen.getByText('en cours...')).toBeInTheDocument();
    expect(screen.getByText('Je complète une idée')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('switch', { name: 'extended-mode' }));
    expect(toggleExtendedModeMock).toHaveBeenCalledWith(false);
  });

  it('désactive le switch pendant un enregistrement et affiche le libellé Arrêter', () => {
    transcriptionState.isRecording = true;
    transcriptionState.participants = [
      { id: 'p1', display_name: 'Alice Martin', is_transcribing: true, left_at: null },
    ];

    render(<GlobalTranscriptionWidget />, { wrapper: createWrapper() });

    fireEvent.click(screen.getAllByRole('button', { name: 'Suivant' })[0]);

    expect(screen.getByRole('button', { name: 'Arrêter' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'extended-mode' })).toBeDisabled();
    expect(screen.getByText('En attente de paroles...')).toBeInTheDocument();
    expect(screen.getByText('Parlez pendant au moins 10 secondes')).toBeInTheDocument();
  });

  it('permet de minimiser puis restaurer le widget', () => {
    render(<GlobalTranscriptionWidget />, { wrapper: createWrapper() });

    fireEvent.click(screen.getAllByRole('button', { name: 'Suivant' })[1]);

    expect(screen.queryByText('Réunion produit')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByText('Réunion produit')).toBeInTheDocument();
  });

  it('couvre chargement puis succès avec renderHook dans QueryClientProvider', async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ['stable-supabase-success'],
          queryFn: async () => {
            const response = await mockFrom('items').select('*');
            return response.data;
          },
        }),
      { wrapper }
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFrom).toHaveBeenCalledWith('items');
    expect(builder.select).toHaveBeenCalledWith('*');
    expect(result.current.data).toEqual(QUERY_SUCCESS_DATA);
  });

  it('couvre le cas d’erreur isError avec données stables sans réseau réel', async () => {
    builder.maybeSingle.mockResolvedValue(QUERY_ERROR_DATA);

    const wrapper = createWrapper();

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ['stable-supabase-error'],
          queryFn: async () => {
            const response = await mockFrom('items').maybeSingle();
            if (response.error) {
              throw new Error(response.error.message);
            }
            return response.data;
          },
        }),
      { wrapper }
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockFrom).toHaveBeenCalledWith('items');
    expect(builder.maybeSingle).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('x');
  });
});