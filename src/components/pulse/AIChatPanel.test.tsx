/* @vitest-environment jsdom */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AIChatPanel } from './AIChatPanel';

const {
  navigateMock,
  sendMessageMock,
  cancelRequestMock,
  clearMessagesMock,
  executeActionMock,
  pulseState,
  markdownPropsSpy,
  actionCardPropsSpy,
  authState,
  builder,
  mockFrom,
} = vi.hoisted(() => {
  const navigateMock = vi.fn();
  const sendMessageMock = vi.fn();
  const cancelRequestMock = vi.fn();
  const clearMessagesMock = vi.fn();
  const executeActionMock = vi.fn();
  const markdownPropsSpy = vi.fn();
  const actionCardPropsSpy = vi.fn();
  const authState = {
    user: { id: 'u1', email: 'user@test.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  const pulseState: {
    messages: Array<{
      id: string;
      role: 'user' | 'assistant';
      content: string;
      isStreaming?: boolean;
      actions?: Array<{ type: string; data?: Record<string, unknown> }>;
      entityLinks?: Array<{ type: string; id: string; label?: string }>;
    }>;
    isLoading: boolean;
  } = {
    messages: [],
    isLoading: false,
  };

  const builderBase = {
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
    match: vi.fn(),
    neq: vi.fn(),
    or: vi.fn(),
    not: vi.fn(),
    is: vi.fn(),
    then: vi.fn(),
    catch: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
  };

  const builder = builderBase as typeof builderBase & PromiseLike<{ data: null; error: null }>;
  Object.values(builderBase).forEach((fn) => {
    if (fn !== builderBase.then && fn !== builderBase.catch && fn !== builderBase.single && fn !== builderBase.maybeSingle) {
      fn.mockImplementation(() => builder);
    }
  });
  builder.single.mockResolvedValue({ data: null, error: null });
  builder.maybeSingle.mockResolvedValue({ data: null, error: null });
  builder.then.mockImplementation((onFulfilled?: (value: { data: null; error: null }) => unknown) => {
    const value = { data: null, error: null };
    return Promise.resolve(onFulfilled ? onFulfilled(value) : value);
  });
  builder.catch.mockImplementation(() => Promise.resolve({ data: null, error: null }));

  const mockFrom = vi.fn(() => builder);

  return {
    navigateMock,
    sendMessageMock,
    cancelRequestMock,
    clearMessagesMock,
    executeActionMock,
    pulseState,
    markdownPropsSpy,
    actionCardPropsSpy,
    authState,
    builder,
    mockFrom,
  };
});

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => authState,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => authState,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ children, ...props }, ref) => (
    <div ref={ref} {...props}>
      {children}
    </div>
  )),
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
    ({ children, ...props }, ref) => (
      <textarea ref={ref} {...props}>
        {children}
      </textarea>
    )
  ),
}));

vi.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon" {...props} />;
  return {
    Sparkles: Icon,
    Send: Icon,
    Loader2: Icon,
    X: Icon,
    StopCircle: Icon,
    Trash2: Icon,
    FileText: Icon,
    CheckSquare: Icon,
    Mail: Icon,
    Building2: Icon,
    Zap: Icon,
  };
});

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

vi.mock('./PulseMarkdownRenderer', () => ({
  PulseMarkdownRenderer: ({
    content,
    entityLinks,
    onEntityClick,
  }: {
    content: string;
    entityLinks?: Array<{ type: string; id: string; label?: string }>;
    onEntityClick: (entity: { type: string; id: string; label?: string }) => void;
  }) => {
    markdownPropsSpy({ content, entityLinks, onEntityClick });
    return (
      <div>
        <div>{content}</div>
        {entityLinks?.map((entity) => (
          <button key={`${entity.type}-${entity.id}`} onClick={() => onEntityClick(entity)}>
            {entity.label ?? entity.id}
          </button>
        ))}
      </div>
    );
  },
}));

vi.mock('./AIActionCard', () => ({
  AIActionCard: ({
    action,
    onExecute,
  }: {
    action: { type: string; data?: Record<string, unknown> };
    onExecute: (action: { type: string; data?: Record<string, unknown> }) => void;
  }) => {
    actionCardPropsSpy({ action, onExecute });
    return <button onClick={() => onExecute(action)}>action-{action.type}</button>;
  },
}));

vi.mock('@/hooks/pulse/usePulseAIChat', () => ({
  usePulseAIChat: ({
    onAction,
  }: {
    conversationId: string;
    onAction: (action: { type: string; data?: Record<string, unknown> }) => void;
  }) => ({
    messages: pulseState.messages,
    isLoading: pulseState.isLoading,
    sendMessage: sendMessageMock,
    cancelRequest: cancelRequestMock,
    clearMessages: clearMessagesMock,
    executeAction: executeActionMock,
    onAction,
  }),
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

function renderPanel(
  props?: Partial<React.ComponentProps<typeof AIChatPanel>>
) {
  return render(
    <AIChatPanel
      conversationId="conv-1"
      onClose={props?.onClose}
      onOpenEmailComposer={props?.onOpenEmailComposer}
      onOpenEtablissement={props?.onOpenEtablissement}
      onOpenTask={props?.onOpenTask}
      onOpenEmail={props?.onOpenEmail}
    />,
    { wrapper: createWrapper() }
  );
}

describe('AIChatPanel', () => {
  beforeEach(() => {
    pulseState.messages = [];
    pulseState.isLoading = false;
    navigateMock.mockReset();
    sendMessageMock.mockReset();
    cancelRequestMock.mockReset();
    clearMessagesMock.mockReset();
    executeActionMock.mockReset();
    markdownPropsSpy.mockReset();
    actionCardPropsSpy.mockReset();
    mockFrom.mockClear();
  });

  it('affiche l’état initial et envoie une action rapide métier', async () => {
    const user = userEvent.setup();
    renderPanel();

    expect(screen.getByText('Assistant Pulse IA')).toBeInTheDocument();
    expect(screen.getByText('Assistant IA Complet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Résumer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Créer tâche' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Préparer email' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Infos client' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Résumer' }));

    expect(sendMessageMock).toHaveBeenCalledTimes(1);
    expect(sendMessageMock).toHaveBeenCalledWith(
      'Résume cette conversation Pulse de manière concise avec les points clés et décisions.'
    );
  });

  it('envoie un message au submit puis vide le champ', async () => {
    const user = userEvent.setup();
    renderPanel();

    const textarea = screen.getByPlaceholderText("Demandez à l'IA d'agir...") as HTMLTextAreaElement;
    const submit = screen.getByRole('button', { name: 'Envoyer le message' });

    expect(submit).toBeDisabled();

    await user.type(textarea, 'Prépare un résumé client');
    expect(submit).not.toBeDisabled();

    await user.click(submit);

    expect(sendMessageMock).toHaveBeenCalledWith('Prépare un résumé client');
    expect(textarea.value).toBe('');
  });

  it('gère l’état de chargement avec bouton annuler', async () => {
    pulseState.isLoading = true;

    renderPanel();

    const textarea = screen.getByPlaceholderText("Demandez à l'IA d'agir...");
    expect(textarea).toBeDisabled();

    const cancelButton = screen.getByRole('button', { name: 'Annuler la requête' });
    expect(cancelButton).toBeInTheDocument();

    await userEvent.setup().click(cancelButton);

    expect(cancelRequestMock).toHaveBeenCalledTimes(1);
  });

  it('affiche les messages, rend les actions et exécute les callbacks métier', async () => {
    const onOpenEmailComposer = vi.fn();
    const onOpenEtablissement = vi.fn();
    const onOpenTask = vi.fn();
    const onOpenEmail = vi.fn();

    pulseState.messages = [
      {
        id: 'm1',
        role: 'user',
        content: 'Peux-tu créer une tâche et préparer un email ?',
      },
      {
        id: 'm2',
        role: 'assistant',
        content: 'Voici une proposition avec liens.',
        entityLinks: [
          { type: 'etablissement', id: 'eta-1', label: 'Clinique A' },
          { type: 'tache', id: 'task-1', label: 'Tâche A' },
          { type: 'email', id: 'thread-1', label: 'Email A' },
          { type: 'contact', id: 'contact-1', label: 'Contact A' },
        ],
        actions: [
          {
            type: 'open_email_composer',
            data: {
              to: ['dest@test.co'],
              cc: ['copy@test.co'],
              subject: 'Sujet',
              body: 'Corps',
              etablissement_id: 'eta-1',
            },
          },
          {
            type: 'open_task',
            data: {
              id: 'task-1',
              etablissement_id: 'eta-1',
            },
          },
          {
            type: 'open_etablissement',
            data: {
              id: 'eta-1',
            },
          },
          {
            type: 'open_email',
            data: {
              id: 'thread-1',
            },
          },
        ],
      },
    ];

    renderPanel({
      onOpenEmailComposer,
      onOpenEtablissement,
      onOpenTask,
      onOpenEmail,
    });

    expect(screen.getByText('Peux-tu créer une tâche et préparer un email ?')).toBeInTheDocument();
    expect(screen.getByText('Voici une proposition avec liens.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Effacer la conversation' })).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Effacer la conversation' }));
    expect(clearMessagesMock).toHaveBeenCalledTimes(1);

    await userEvent.setup().click(screen.getByRole('button', { name: 'action-open_email_composer' }));
    expect(onOpenEmailComposer).toHaveBeenCalledWith({
      to: ['dest@test.co'],
      cc: ['copy@test.co'],
      subject: 'Sujet',
      body: 'Corps',
      etablissement_id: 'eta-1',
    });

    await userEvent.setup().click(screen.getByRole('button', { name: 'action-open_task' }));
    expect(onOpenTask).toHaveBeenCalledWith('task-1');

    await userEvent.setup().click(screen.getByRole('button', { name: 'action-open_etablissement' }));
    expect(onOpenEtablissement).toHaveBeenCalledWith('eta-1');

    await userEvent.setup().click(screen.getByRole('button', { name: 'action-open_email' }));
    expect(onOpenEmail).toHaveBeenCalledWith('thread-1');

    await userEvent.setup().click(screen.getByRole('button', { name: 'Clinique A' }));
    expect(onOpenEtablissement).toHaveBeenCalledWith('eta-1');

    await userEvent.setup().click(screen.getByRole('button', { name: 'Tâche A' }));
    expect(onOpenTask).toHaveBeenCalledWith('task-1');

    await userEvent.setup().click(screen.getByRole('button', { name: 'Email A' }));
    expect(onOpenEmail).toHaveBeenCalledWith('thread-1');

    await userEvent.setup().click(screen.getByRole('button', { name: 'Contact A' }));
    expect(navigateMock).toHaveBeenCalledWith('/contacts?id=contact-1');
  });

  it('utilise les fallbacks de navigation quand les callbacks ne sont pas fournis', async () => {
    pulseState.messages = [
      {
        id: 'm1',
        role: 'assistant',
        content: 'Actions disponibles',
        actions: [
          {
            type: 'open_email_composer',
            data: {
              to: ['draft@test.co'],
              subject: 'Proposition',
              body: 'Bonjour',
            },
          },
          {
            type: 'created_task',
            data: {
              etablissement_id: 'eta-9',
            },
          },
          {
            type: 'created_etablissement',
            data: {
              id: 'eta-3',
            },
          },
          {
            type: 'open_email',
            data: {
              id: 'thread-9',
            },
          },
        ],
        entityLinks: [
          { type: 'etablissement', id: 'eta-3', label: 'Etab 3' },
          { type: 'email', id: 'thread-9', label: 'Thread 9' },
          { type: 'groupe', id: 'group-1', label: 'Groupe 1' },
          { type: 'partenaire', id: 'partner-1', label: 'Partenaire 1' },
        ],
      },
    ];

    renderPanel();

    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'action-open_email_composer' }));
    expect(navigateMock).toHaveBeenCalledWith('/emails', {
      state: {
        draft: {
          to: ['draft@test.co'],
          subject: 'Proposition',
          body: 'Bonjour',
        },
      },
    });

    await user.click(screen.getByRole('button', { name: 'action-created_task' }));
    expect(navigateMock).toHaveBeenCalledWith('/etablissements/eta-9?tab=taches');

    await user.click(screen.getByRole('button', { name: 'action-created_etablissement' }));
    expect(navigateMock).toHaveBeenCalledWith('/etablissements/eta-3');

    await user.click(screen.getByRole('button', { name: 'action-open_email' }));
    expect(navigateMock).toHaveBeenCalledWith('/emails?thread=thread-9');

    await user.click(screen.getByRole('button', { name: 'Etab 3' }));
    expect(navigateMock).toHaveBeenCalledWith('/etablissements/eta-3');

    await user.click(screen.getByRole('button', { name: 'Thread 9' }));
    expect(navigateMock).toHaveBeenCalledWith('/emails?thread=thread-9');

    await user.click(screen.getByRole('button', { name: 'Groupe 1' }));
    expect(navigateMock).toHaveBeenCalledWith('/groupes/group-1');

    await user.click(screen.getByRole('button', { name: 'Partenaire 1' }));
    expect(navigateMock).toHaveBeenCalledWith('/partenaires/partner-1');
  });

  it('gère Entrée pour envoyer et Shift+Entrée pour une nouvelle ligne', async () => {
    renderPanel();

    const textarea = screen.getByPlaceholderText("Demandez à l'IA d'agir...") as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: 'Ligne 1' } });
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter', shiftKey: true });

    expect(sendMessageMock).not.toHaveBeenCalled();

    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter', shiftKey: false });
    expect(sendMessageMock).toHaveBeenCalledWith('Ligne 1');
  });

  it('appelle onClose quand le bouton de fermeture est présent', async () => {
    const onClose = vi.fn();
    renderPanel({ onClose });

    await userEvent.setup().click(screen.getByRole('button', { name: "Fermer l'assistant IA" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});