/* @vitest-environment jsdom */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MeetingNoteDetail } from './MeetingNoteDetail';

const {
  SESSION,
  AUTH_STATE,
  mockFrom,
  mockNavigate,
  mockToastSuccess,
  mockToastError,
  summarySpy,
  mindMapSpy,
} = vi.hoisted(() => {
  const SESSION = {
    id: 'session-1',
    title: 'Réunion produit',
    summary: 'Décisions prises sur la roadmap',
    transcript: 'Contenu de transcription',
    next_steps: [
      { id: 'step-1', title: 'Créer la tâche', type: 'task' },
      { id: 'step-2', title: 'Planifier le point', type: 'event' },
    ],
  };

  const AUTH_STATE = {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  const summarySpy = vi.fn();
  const mindMapSpy = vi.fn();
  const mockNavigate = vi.fn();
  const mockToastSuccess = vi.fn();
  const mockToastError = vi.fn();

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
      upsert: vi.fn(() => builder),
      single: vi.fn(async () => ({ data: SESSION, error: null })),
      maybeSingle: vi.fn(async () => ({ data: SESSION, error: null })),
      then: (onFulfilled: (value: { data: typeof SESSION; error: null }) => unknown) =>
        Promise.resolve({ data: SESSION, error: null }).then(onFulfilled),
      catch: (onRejected: (reason: unknown) => unknown) =>
        Promise.resolve({ data: SESSION, error: null }).catch(onRejected),
    };
    return builder;
  };

  return {
    SESSION,
    AUTH_STATE,
    mockFrom: vi.fn(() => createBuilder()),
    mockNavigate,
    mockToastSuccess,
    mockToastError,
    summarySpy,
    mindMapSpy,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
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

vi.mock('lucide-react', () => ({
  ArrowLeft: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-arrow-left" {...props} />,
  Network: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-network" {...props} />,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/tabs', () => {
  type TabsContextValue = {
    value: string;
    onValueChange: (value: string) => void;
  };

  const TabsContext = React.createContext<TabsContextValue | null>(null);

  const Tabs = ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    children: React.ReactNode;
  }) => (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div data-testid="tabs-root">{children}</div>
    </TabsContext.Provider>
  );

  const TabsList = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tabs-list">{children}</div>
  );

  const TabsTrigger = ({
    value,
    children,
  }: {
    value: string;
    children: React.ReactNode;
  }) => {
    const ctx = React.useContext(TabsContext);
    if (!ctx) return null;
    return (
      <button
        type="button"
        data-testid={`tab-trigger-${value}`}
        aria-selected={ctx.value === value}
        onClick={() => ctx.onValueChange(value)}
      >
        {children}
      </button>
    );
  };

  const TabsContent = ({
    value,
    children,
  }: {
    value: string;
    children: React.ReactNode;
  }) => {
    const ctx = React.useContext(TabsContext);
    if (!ctx || ctx.value !== value) return null;
    return <div data-testid={`tab-content-${value}`}>{children}</div>;
  };

  return {
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent,
  };
});

vi.mock('@/components/visio/TranscriptionSummaryView', () => ({
  TranscriptionSummaryView: (props: {
    session: typeof SESSION;
    onCreateTask?: (step: { id: string; title: string; type: string }) => Promise<void>;
    onCreateEvent?: (step: { id: string; title: string; type: string }) => Promise<void>;
  }) => {
    summarySpy(props);
    return (
      <div data-testid="summary-view">
        <div>{props.session.title}</div>
        <div>{props.session.summary}</div>
        <button
          type="button"
          onClick={() => {
            const step = props.session.next_steps[0];
            if (props.onCreateTask && step) {
              void props.onCreateTask(step);
            }
          }}
        >
          create-task
        </button>
        <button
          type="button"
          onClick={() => {
            const step = props.session.next_steps[1];
            if (props.onCreateEvent && step) {
              void props.onCreateEvent(step);
            }
          }}
        >
          create-event
        </button>
      </div>
    );
  },
}));

vi.mock('@/components/meeting-notes/MeetingNoteMindMap', () => ({
  MeetingNoteMindMap: (props: { session: typeof SESSION }) => {
    mindMapSpy(props);
    return <div data-testid="mindmap-view">MindMap:{props.session.id}</div>;
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

describe('MeetingNoteDetail', () => {
  it('affiche par défaut l’onglet résumé avec les bonnes données métier', () => {
    const onBack = vi.fn();
    const onCreateTask = vi.fn(async () => {});
    const onCreateEvent = vi.fn(async () => {});

    render(
      <MeetingNoteDetail
        session={SESSION}
        onBack={onBack}
        onCreateTask={onCreateTask}
        onCreateEvent={onCreateEvent}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByRole('button', { name: /retour à la liste/i })).toBeInTheDocument();
    expect(screen.getByTestId('icon-arrow-left')).toBeInTheDocument();

    expect(screen.getByTestId('tab-trigger-summary')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('tab-trigger-mindmap')).toHaveAttribute('aria-selected', 'false');

    expect(screen.getByTestId('summary-view')).toBeInTheDocument();
    expect(screen.getByText('Réunion produit')).toBeInTheDocument();
    expect(screen.getByText('Décisions prises sur la roadmap')).toBeInTheDocument();
    expect(screen.queryByTestId('mindmap-view')).not.toBeInTheDocument();

    expect(summarySpy).toHaveBeenCalledTimes(1);
    expect(summarySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        session: SESSION,
        onCreateTask,
        onCreateEvent,
      })
    );
  });

  it('appelle onBack au clic sur le bouton de retour', () => {
    const onBack = vi.fn();

    render(<MeetingNoteDetail session={SESSION} onBack={onBack} />, {
      wrapper: createWrapper(),
    });

    fireEvent.click(screen.getByRole('button', { name: /retour à la liste/i }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('bascule vers l’onglet mind map et transmet la session au composant dédié', () => {
    render(<MeetingNoteDetail session={SESSION} onBack={vi.fn()} />, {
      wrapper: createWrapper(),
    });

    fireEvent.click(screen.getByTestId('tab-trigger-mindmap'));

    expect(screen.getByTestId('tab-trigger-summary')).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByTestId('tab-trigger-mindmap')).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByTestId('summary-view')).not.toBeInTheDocument();
    expect(screen.getByTestId('mindmap-view')).toHaveTextContent('MindMap:session-1');

    expect(mindMapSpy).toHaveBeenCalledTimes(1);
    expect(mindMapSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        session: SESSION,
      })
    );
  });

  it('relaie onCreateTask et onCreateEvent avec les étapes réelles de la session', async () => {
    const onCreateTask = vi.fn(async () => {});
    const onCreateEvent = vi.fn(async () => {});

    render(
      <MeetingNoteDetail
        session={SESSION}
        onBack={vi.fn()}
        onCreateTask={onCreateTask}
        onCreateEvent={onCreateEvent}
      />,
      { wrapper: createWrapper() }
    );

    fireEvent.click(screen.getByRole('button', { name: 'create-task' }));
    fireEvent.click(screen.getByRole('button', { name: 'create-event' }));

    expect(onCreateTask).toHaveBeenCalledTimes(1);
    expect(onCreateTask).toHaveBeenCalledWith(SESSION.next_steps[0]);

    expect(onCreateEvent).toHaveBeenCalledTimes(1);
    expect(onCreateEvent).toHaveBeenCalledWith(SESSION.next_steps[1]);
  });
});