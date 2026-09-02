/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MeetingNotes from './MeetingNotes';

const {
  AUTH_STATE,
  SESSIONS,
  STEP,
  UPLOAD_PROGRESS,
  mockUseAuth,
  mockUseMeetingNotes,
  mockUseDebounce,
  mockRefetch,
  mockUploadAndProcess,
  mockCreateTaskFromStep,
  mockCreateEventFromStep,
  mockToast,
  mockFrom,
  builder,
  listPropsSpy,
  detailPropsSpy,
  uploadDialogPropsSpy,
  pageDataStatePropsSpy,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
    loading: false,
  };

  const SESSIONS = [
    {
      id: 's1',
      title: 'Comité hebdomadaire',
      etablissement_id: 'e1',
      status: 'done',
    },
    {
      id: 's2',
      title: 'Point client',
      etablissement_id: 'e2',
      status: 'processing',
    },
  ];

  const STEP = {
    id: 'step1',
    title: 'Relancer le client',
    description: 'Envoyer un compte-rendu',
  };

  const UPLOAD_PROGRESS = {
    status: 'idle',
    progress: 0,
  };

  const mockUseAuth = vi.fn();
  const mockUseMeetingNotes = vi.fn();
  const mockUseDebounce = vi.fn();
  const mockRefetch = vi.fn();
  const mockUploadAndProcess = vi.fn();
  const mockCreateTaskFromStep = vi.fn();
  const mockCreateEventFromStep = vi.fn();
  const mockToast = vi.fn();

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
    single: vi.fn(),
    maybeSingle: vi.fn(),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve({ data: null, error: null })),
    catch: vi.fn(),
  };

  const mockFrom = vi.fn(() => builder);

  const listPropsSpy = vi.fn();
  const detailPropsSpy = vi.fn();
  const uploadDialogPropsSpy = vi.fn();
  const pageDataStatePropsSpy = vi.fn();

  return {
    AUTH_STATE,
    SESSIONS,
    STEP,
    UPLOAD_PROGRESS,
    mockUseAuth,
    mockUseMeetingNotes,
    mockUseDebounce,
    mockRefetch,
    mockUploadAndProcess,
    mockCreateTaskFromStep,
    mockCreateEventFromStep,
    mockToast,
    mockFrom,
    builder,
    listPropsSpy,
    detailPropsSpy,
    uploadDialogPropsSpy,
    pageDataStatePropsSpy,
  };
});

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: mockUseAuth,
}));

vi.mock('@/hooks/shared/useDebounce', () => ({
  useDebounce: mockUseDebounce,
}));

vi.mock('@/hooks/meeting/useMeetingNotes', () => ({
  useMeetingNotes: mockUseMeetingNotes,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  toast: mockToast,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

vi.mock('lucide-react', () => ({
  FileAudio: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="file-audio-icon" {...props} />,
  Plus: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="plus-icon" {...props} />,
}));

vi.mock('@/components/common/PageDataState', () => ({
  PageDataState: ({
    isLoading,
    isError,
    onRetry,
    children,
  }: {
    isLoading: boolean;
    isError: boolean;
    onRetry: () => void;
    children: React.ReactNode;
  }) => {
    pageDataStatePropsSpy({ isLoading, isError, onRetry });
    if (isLoading) {
      return <div data-testid="page-loading">Chargement auth</div>;
    }
    if (isError) {
      return (
        <div>
          <div data-testid="page-error">Erreur de page</div>
          <button onClick={onRetry}>Réessayer</button>
        </div>
      );
    }
    return <div data-testid="page-content">{children}</div>;
  },
}));

vi.mock('@/components/meeting-notes/MeetingNotesList', () => ({
  MeetingNotesList: (props: {
    sessions: typeof SESSIONS;
    isLoading: boolean;
    selectedId?: string;
    onSelect: (session: (typeof SESSIONS)[number]) => void;
    searchQuery: string;
    onSearchChange: (value: string) => void;
    statusFilter: string;
    onStatusFilterChange: (value: string) => void;
  }) => {
    listPropsSpy(props);
    return (
      <div>
        <div data-testid="list-count">{props.sessions.length}</div>
        <div data-testid="list-loading">{String(props.isLoading)}</div>
        <div data-testid="selected-id">{props.selectedId ?? 'none'}</div>
        <input
          aria-label="search"
          value={props.searchQuery}
          onChange={(e) => props.onSearchChange(e.target.value)}
        />
        <select
          aria-label="status"
          value={props.statusFilter}
          onChange={(e) => props.onStatusFilterChange(e.target.value)}
        >
          <option value="all">all</option>
          <option value="done">done</option>
          <option value="processing">processing</option>
        </select>
        <button onClick={() => props.onSelect(props.sessions[0])}>Choisir première session</button>
      </div>
    );
  },
}));

vi.mock('@/components/meeting-notes/MeetingNoteDetail', () => ({
  MeetingNoteDetail: (props: {
    session: (typeof SESSIONS)[number];
    onBack: () => void;
    onCreateTask: (step: typeof STEP) => Promise<void>;
    onCreateEvent: (step: typeof STEP) => Promise<void>;
  }) => {
    detailPropsSpy(props);
    return (
      <div data-testid="meeting-detail">
        <div>{props.session.title}</div>
        <button onClick={() => props.onCreateTask(STEP)}>Créer tâche</button>
        <button onClick={() => props.onCreateEvent(STEP)}>Créer événement</button>
        <button onClick={props.onBack}>Retour</button>
      </div>
    );
  },
}));

vi.mock('@/components/meeting-notes/MeetingNotesUploadDialog', () => ({
  MeetingNotesUploadDialog: (props: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onUpload: (file: File, options: { language: string }) => Promise<string | null | undefined>;
    uploadStatus: typeof UPLOAD_PROGRESS;
  }) => {
    uploadDialogPropsSpy(props);
    return (
      <div data-testid="upload-dialog">
        <div data-testid="upload-open">{String(props.open)}</div>
        <div data-testid="upload-status">{props.uploadStatus.status}</div>
        <button onClick={() => props.onOpenChange(false)}>Fermer dialogue</button>
        <button
          onClick={async () => {
            await props.onUpload(new File(['audio'], 'meeting.wav', { type: 'audio/wav' }), { language: 'fr' });
          }}
        >
          Lancer upload
        </button>
      </div>
    );
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

describe('MeetingNotes', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseAuth.mockReturnValue(AUTH_STATE);
    mockUseDebounce.mockImplementation((value: string) => value);
    mockUseMeetingNotes.mockReturnValue({
      sessions: SESSIONS,
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
      uploadProgress: UPLOAD_PROGRESS,
      uploadAndProcess: mockUploadAndProcess,
      createTaskFromStep: mockCreateTaskFromStep,
      createEventFromStep: mockCreateEventFromStep,
    });

    builder.maybeSingle.mockResolvedValue({ data: { id: 'cal1' }, error: null });
    builder.single.mockResolvedValue({ data: { id: 'cal1' }, error: null });
  });

  it('affiche l’état de chargement auth puis le contenu avec les données métier', async () => {
    mockUseAuth.mockReturnValueOnce({ ...AUTH_STATE, loading: true });

    const Wrapper = createWrapper();
    const { rerender } = render(<MeetingNotes />, { wrapper: Wrapper });

    expect(screen.getByTestId('page-loading')).toHaveTextContent('Chargement auth');
    expect(pageDataStatePropsSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ isLoading: true, isError: false })
    );

    mockUseAuth.mockReturnValue({ ...AUTH_STATE, loading: false });
    rerender(<MeetingNotes />);

    expect(screen.getByText('Notes de réunion')).toBeInTheDocument();
    expect(screen.getByText('Importez vos enregistrements audio pour les transcrire et analyser automatiquement')).toBeInTheDocument();
    expect(screen.getByTestId('list-count')).toHaveTextContent('2');
    expect(screen.getByTestId('list-loading')).toHaveTextContent('false');
    expect(screen.getByText('Sélectionnez une note')).toBeInTheDocument();

    expect(mockUseMeetingNotes).toHaveBeenLastCalledWith({
      search: undefined,
      status: undefined,
    });
  });

  it('met à jour les filtres, sélectionne une session et crée une tâche avec etablissement_id', async () => {
    const Wrapper = createWrapper();
    render(<MeetingNotes />, { wrapper: Wrapper });

    fireEvent.change(screen.getByLabelText('search'), { target: { value: 'client' } });
    await waitFor(() => {
      expect(mockUseMeetingNotes).toHaveBeenLastCalledWith({
        search: 'client',
        status: undefined,
      });
    });

    fireEvent.change(screen.getByLabelText('status'), { target: { value: 'done' } });
    await waitFor(() => {
      expect(mockUseMeetingNotes).toHaveBeenLastCalledWith({
        search: 'client',
        status: 'done',
      });
    });

    fireEvent.click(screen.getByText('Choisir première session'));

    expect(await screen.findByTestId('meeting-detail')).toBeInTheDocument();
    expect(screen.getByText('Comité hebdomadaire')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Créer tâche'));

    await waitFor(() => {
      expect(mockCreateTaskFromStep).toHaveBeenCalledWith(STEP, 'e1');
    });
  });

  it('crée un événement avec le calendrier par défaut trouvé via supabase', async () => {
    const Wrapper = createWrapper();
    render(<MeetingNotes />, { wrapper: Wrapper });

    fireEvent.click(screen.getByText('Choisir première session'));
    fireEvent.click(screen.getByText('Créer événement'));

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('calendars');
    });
    expect(builder.select).toHaveBeenCalledWith('id');
    expect(builder.eq).toHaveBeenCalledWith('is_default', true);
    expect(builder.limit).toHaveBeenCalledWith(1);

    await waitFor(() => {
      expect(mockCreateEventFromStep).toHaveBeenCalledWith(STEP, 'cal1', 'e1');
    });
  });

  it('affiche une erreur toast si aucun calendrier par défaut n’est trouvé', async () => {
    builder.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'x' } });

    const Wrapper = createWrapper();
    render(<MeetingNotes />, { wrapper: Wrapper });

    fireEvent.click(screen.getByText('Choisir première session'));
    fireEvent.click(screen.getByText('Créer événement'));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Erreur',
        description: 'Aucun calendrier par défaut trouvé',
        variant: 'destructive',
      });
    });

    expect(mockCreateEventFromStep).not.toHaveBeenCalled();
  });

  it('ouvre le dialogue d’upload, lance l’upload et referme si un sessionId est renvoyé', async () => {
    mockUploadAndProcess.mockResolvedValue('s3');

    const Wrapper = createWrapper();
    render(<MeetingNotes />, { wrapper: Wrapper });

    expect(screen.getByTestId('upload-open')).toHaveTextContent('false');

    fireEvent.click(screen.getByText('Nouvelle note'));
    await waitFor(() => {
      expect(screen.getByTestId('upload-open')).toHaveTextContent('true');
    });

    fireEvent.click(screen.getByText('Lancer upload'));

    await waitFor(() => {
      expect(mockUploadAndProcess).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'meeting.wav', type: 'audio/wav' }),
        { language: 'fr' }
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('upload-open')).toHaveTextContent('false');
    });
  });

  it('affiche l’état d’erreur et relance refetch via le retry', async () => {
    mockUseMeetingNotes.mockReturnValue({
      sessions: SESSIONS,
      isLoading: false,
      isError: true,
      refetch: mockRefetch,
      uploadProgress: UPLOAD_PROGRESS,
      uploadAndProcess: mockUploadAndProcess,
      createTaskFromStep: mockCreateTaskFromStep,
      createEventFromStep: mockCreateEventFromStep,
    });

    const Wrapper = createWrapper();
    render(<MeetingNotes />, { wrapper: Wrapper });

    expect(screen.getByTestId('page-error')).toHaveTextContent('Erreur de page');

    fireEvent.click(screen.getByText('Réessayer'));

    expect(mockRefetch).toHaveBeenCalledTimes(1);
    expect(pageDataStatePropsSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ isLoading: false, isError: true, onRetry: expect.any(Function) })
    );
  });
});