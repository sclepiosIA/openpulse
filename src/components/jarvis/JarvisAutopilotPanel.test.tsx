/* @vitest-environment jsdom */

import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JarvisAutopilotPanel } from './JarvisAutopilotPanel';

const {
  RULES,
  EXECUTIONS,
  EMPTY_RULES,
  ACTIVE_COUNTS,
  AUTH_STATE,
  SUPABASE_RESULT,
  createRuleMock,
  createRuleErrorMock,
  toggleRuleMock,
  deleteRuleMock,
  getExecutionsForRuleMock,
  hookState,
  templatePropsState,
  debugErrorMock,
  mockFrom,
  navigateMock,
  toastSuccessMock,
  toastErrorMock,
} = vi.hoisted(() => {
  const RULES = [
    {
      id: 'r1',
      name: 'Briefing matinal',
      description: 'Résumé quotidien',
      trigger_type: 'schedule',
      trigger_config: { time: '09:00', days: ['lundi', 'mardi'] },
      action_type: 'jarvis_command',
      action_config: { command: 'Génère mon briefing commercial du matin', notify: true },
      is_active: true,
      execution_count: 2,
    },
    {
      id: 'r2',
      name: 'Rapport équipe',
      description: 'Rapport hebdo',
      trigger_type: 'schedule',
      trigger_config: { cron: '0 8 * * 1' },
      action_type: 'jarvis_command',
      action_config: { command: "Génère le rapport hebdomadaire de l'équipe", notify: true },
      is_active: false,
      execution_count: 1,
    },
  ];

  const EXECUTIONS = [
    {
      id: 'e1',
      rule_id: 'r1',
      status: 'success',
      executed_at: '2024-01-01T10:00:00.000Z',
    },
    {
      id: 'e2',
      rule_id: 'r1',
      status: 'failed',
      executed_at: '2024-01-01T09:00:00.000Z',
    },
    {
      id: 'e3',
      rule_id: 'r2',
      status: 'success',
      executed_at: '2024-01-01T08:00:00.000Z',
    },
  ];

  const EMPTY_RULES: Array<{
    id: string;
    name: string;
    description: string;
    trigger_type: string;
    trigger_config: { time?: string; cron?: string; event_type?: string; days?: string[] };
    action_type: string;
    action_config: { command?: string; notify?: boolean };
    is_active: boolean;
    execution_count: number;
  }> = [];

  const ACTIVE_COUNTS = {
    loaded: 1,
    empty: 0,
  };

  const AUTH_STATE = {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  const SUPABASE_RESULT = { data: null, error: null };

  return {
    RULES,
    EXECUTIONS,
    EMPTY_RULES,
    ACTIVE_COUNTS,
    AUTH_STATE,
    SUPABASE_RESULT,
    createRuleMock: vi.fn(async () => undefined),
    createRuleErrorMock: vi.fn(async () => {
      throw new Error('x');
    }),
    toggleRuleMock: vi.fn(),
    deleteRuleMock: vi.fn(),
    getExecutionsForRuleMock: vi.fn((ruleId: string) =>
      EXECUTIONS.filter((e) => e.rule_id === ruleId).sort((a, b) => (a.executed_at < b.executed_at ? 1 : -1)),
    ),
    hookState: {
      mode: 'loaded' as 'loading' | 'loaded' | 'empty' | 'error',
      isCreating: false,
    },
    templatePropsState: {
      lastProps: null as null | {
        onSelectTemplate: (template: {
          name: string;
          description: string;
          trigger_type: string;
          trigger_config: { cron?: string; time?: string; event_type?: string; days?: string[] };
          action_type: string;
          action_config: { command?: string; notify?: boolean };
        }) => Promise<void>;
        existingRuleNames: string[];
      },
    },
    debugErrorMock: vi.fn(),
    mockFrom: vi.fn(),
    navigateMock: vi.fn(),
    toastSuccessMock: vi.fn(),
    toastErrorMock: vi.fn(),
  };
});

vi.mock('@/lib/debug', () => ({
  debug: {
    error: debugErrorMock,
  },
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

vi.mock('date-fns', () => ({
  formatDistanceToNow: vi.fn(() => 'il y a 2 heures'),
}));

vi.mock('date-fns/locale', () => ({
  fr: {},
}));

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => React.createElement('svg', { 'data-testid': 'icon', className });
  return {
    Clock: Icon,
    Trash2: Icon,
    Plus: Icon,
    Zap: Icon,
    RefreshCw: Icon,
    CheckCircle: Icon,
    XCircle: Icon,
    Sparkles: Icon,
    List: Icon,
  };
});

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
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
      single: vi.fn(async () => SUPABASE_RESULT),
      maybeSingle: vi.fn(async () => SUPABASE_RESULT),
      then: (resolve: (value: typeof SUPABASE_RESULT) => unknown) => Promise.resolve(resolve(SUPABASE_RESULT)),
      catch: vi.fn(),
    };
    return builder;
  };

  mockFrom.mockImplementation(() => createBuilder());

  return {
    supabase: {
      from: mockFrom,
      auth: {
        getSession: vi.fn(async () => ({ data: { session: AUTH_STATE.session }, error: null })),
        getUser: vi.fn(async () => ({ data: { user: AUTH_STATE.user }, error: null })),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      },
    },
  };
});

vi.mock('@/hooks/jarvis/useJarvisAutopilot', () => ({
  useJarvisAutopilot: vi.fn(() => {
    if (hookState.mode === 'loading') {
      return {
        rules: RULES,
        executions: EXECUTIONS,
        isLoadingRules: true,
        isCreating: hookState.isCreating,
        createRule: createRuleMock,
        toggleRule: toggleRuleMock,
        deleteRule: deleteRuleMock,
        getExecutionsForRule: getExecutionsForRuleMock,
        activeRulesCount: ACTIVE_COUNTS.loaded,
      };
    }

    if (hookState.mode === 'empty') {
      return {
        rules: EMPTY_RULES,
        executions: EMPTY_RULES,
        isLoadingRules: false,
        isCreating: hookState.isCreating,
        createRule: createRuleMock,
        toggleRule: toggleRuleMock,
        deleteRule: deleteRuleMock,
        getExecutionsForRule: getExecutionsForRuleMock,
        activeRulesCount: ACTIVE_COUNTS.empty,
      };
    }

    if (hookState.mode === 'error') {
      return {
        rules: RULES,
        executions: EXECUTIONS,
        isLoadingRules: false,
        isCreating: hookState.isCreating,
        createRule: createRuleErrorMock,
        toggleRule: toggleRuleMock,
        deleteRule: deleteRuleMock,
        getExecutionsForRule: getExecutionsForRuleMock,
        activeRulesCount: ACTIVE_COUNTS.loaded,
      };
    }

    return {
      rules: RULES,
      executions: EXECUTIONS,
      isLoadingRules: false,
      isCreating: hookState.isCreating,
      createRule: createRuleMock,
      toggleRule: toggleRuleMock,
      deleteRule: deleteRuleMock,
      getExecutionsForRule: getExecutionsForRuleMock,
      activeRulesCount: ACTIVE_COUNTS.loaded,
    };
  }),
}));

vi.mock('./JarvisAutopilotTemplates', () => ({
  JarvisAutopilotTemplates: (props: {
    onSelectTemplate: (template: {
      name: string;
      description: string;
      trigger_type: string;
      trigger_config: { cron?: string; time?: string; event_type?: string; days?: string[] };
      action_type: string;
      action_config: { command?: string; notify?: boolean };
    }) => Promise<void>;
    existingRuleNames: string[];
  }) => {
    templatePropsState.lastProps = props;
    return React.createElement(
      'div',
      {},
      React.createElement('div', {}, `Templates mock (${props.existingRuleNames.join(', ')})`),
      React.createElement(
        'button',
        {
          type: 'button',
          onClick: () =>
            props.onSelectTemplate({
              name: 'Template relance',
              description: 'Desc template',
              trigger_type: 'schedule',
              trigger_config: { time: '07:30' },
              action_type: 'jarvis_command',
              action_config: { command: 'Lance la séquence de relance prospects', notify: true },
            }),
        },
        'Use template',
      ),
    );
  },
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) =>
    React.createElement('div', { className }, children),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) =>
    React.createElement('div', { className }, children),
}));

vi.mock('@/components/ui/button', () => ({
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) =>
    React.createElement(
      'button',
      {
        ...props,
        'aria-label': props['aria-label'] ?? props['ariaLabel'],
      },
      props.children,
    ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => React.createElement('span', {}, children),
}));

vi.mock('@/components/ui/switch', () => ({
  Switch: ({
    checked,
    onCheckedChange,
  }: {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }) =>
    React.createElement('input', {
      type: 'checkbox',
      role: 'checkbox',
      checked,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => onCheckedChange?.(e.target.checked),
    }),
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => React.createElement('div', {}, children),
}));

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: { value: string; onValueChange: (v: string) => void; children: React.ReactNode }) =>
    React.createElement('div', {}, children),
  TabsList: ({ children }: { children: React.ReactNode }) => React.createElement('div', {}, children),
  TabsTrigger: ({
    children,
    value,
  }: {
    value: string;
    children: React.ReactNode;
  }) => React.createElement('button', { type: 'button', 'data-value': value }, children),
  TabsContent: ({
    children,
    value,
  }: {
    value: string;
    children: React.ReactNode;
  }) => React.createElement('div', { 'data-testid': `tab-${value}` }, children),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { open?: boolean; onOpenChange?: (open: boolean) => void; children: React.ReactNode }) =>
    React.createElement('div', {}, children),
  DialogTrigger: ({ children }: { asChild?: boolean; children: React.ReactNode }) => React.createElement(React.Fragment, {}, children),
  DialogContent: ({ children }: { children: React.ReactNode }) => React.createElement('div', {}, children),
  DialogDescription: ({ children }: { children: React.ReactNode }) => React.createElement('p', {}, children),
  DialogFooter: ({ children }: { children: React.ReactNode }) => React.createElement('div', {}, children),
  DialogHeader: ({ children }: { children: React.ReactNode }) => React.createElement('div', {}, children),
  DialogTitle: ({ children }: { children: React.ReactNode }) => React.createElement('h2', {}, children),
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({
    value,
    onChange,
    placeholder,
    id,
    type,
  }: {
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    id?: string;
    type?: string;
  }) =>
    React.createElement('input', {
      id,
      type: type ?? 'text',
      value: value ?? '',
      placeholder,
      onChange,
    }),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) =>
    React.createElement('label', { htmlFor }, children),
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: ({
    value,
    onChange,
    placeholder,
    id,
  }: {
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    placeholder?: string;
    id?: string;
    rows?: number;
    className?: string;
  }) =>
    React.createElement('textarea', {
      id,
      value: value ?? '',
      placeholder,
      onChange,
    }),
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({
    children,
    onValueChange,
  }: {
    value?: string;
    onValueChange?: (v: string) => void;
    children: React.ReactNode;
  }) =>
    React.createElement(
      'div',
      {},
      React.createElement(
        'button',
        {
          type: 'button',
          onClick: () => onValueChange?.('Génère mon briefing commercial du matin'),
        },
        'select-command',
      ),
      children,
    ),
  SelectContent: ({ children }: { children: React.ReactNode }) => React.createElement('div', {}, children),
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) =>
    React.createElement('div', { 'data-value': value }, children),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => React.createElement('div', {}, children),
  SelectValue: ({ placeholder }: { placeholder?: string }) => React.createElement('span', {}, placeholder),
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function Providers({ children }: { children: React.ReactNode }) {
  const client = createTestQueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function renderWithProviders() {
  return render(
    <Providers>
      <JarvisAutopilotPanel />
    </Providers>,
  );
}

describe('JarvisAutopilotPanel', () => {
  beforeEach(() => {
    hookState.mode = 'loaded';
    hookState.isCreating = false;
    templatePropsState.lastProps = null;
    createRuleMock.mockClear();
    createRuleErrorMock.mockClear();
    toggleRuleMock.mockClear();
    deleteRuleMock.mockClear();
    getExecutionsForRuleMock.mockClear();
    debugErrorMock.mockClear();
    mockFrom.mockClear();
    navigateMock.mockClear();
    toastSuccessMock.mockClear();
    toastErrorMock.mockClear();
  });

  it('configure renderHook avec QueryClientProvider', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={createTestQueryClient()}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => React.useContext(React.createContext('ok')), { wrapper });

    expect(result.current).toBe('ok');
  });

  it('affiche le chargement puis les statistiques et valeurs métier des règles', () => {
    hookState.mode = 'loading';
    const view = renderWithProviders();

    expect(screen.queryByText("Aucune règle d'automatisation")).not.toBeInTheDocument();
    expect(screen.getAllByTestId('icon').length).toBeGreaterThan(0);

    view.unmount();

    hookState.mode = 'loaded';
    renderWithProviders();

    expect(screen.getByText('Règles actives')).toBeInTheDocument();
    expect(screen.getByText('1/2')).toBeInTheDocument();
    expect(screen.getByText('Exécutions')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Réussites')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Taux succès')).toBeInTheDocument();
    expect(screen.getByText('67%')).toBeInTheDocument();

    expect(screen.getByText('Briefing matinal')).toBeInTheDocument();
    expect(screen.getByText('Rapport équipe')).toBeInTheDocument();
    expect(screen.getByText('lun, mar à 09:00')).toBeInTheDocument();
    expect(screen.getByText('CRON: 0 8 * * 1')).toBeInTheDocument();
    expect(screen.getByText('2 exécutions')).toBeInTheDocument();
    expect(screen.getByText('1 exécutions')).toBeInTheDocument();
    expect(screen.getAllByText(/Dernière: il y a 2 heures/)).toHaveLength(2);
    expect(getExecutionsForRuleMock).toHaveBeenCalledWith('r1');
    expect(getExecutionsForRuleMock).toHaveBeenCalledWith('r2');
  });

  it('affiche l’état vide quand aucune règle n’existe', () => {
    hookState.mode = 'empty';

    renderWithProviders();

    expect(screen.getByText("Aucune règle d'automatisation")).toBeInTheDocument();
    expect(screen.getByText('Utilisez les templates pour commencer')).toBeInTheDocument();
    expect(screen.getByText('Voir les templates')).toBeInTheDocument();
    expect(screen.getByText('0/0')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('crée une règle personnalisée avec les valeurs saisies', async () => {
    renderWithProviders();

    fireEvent.change(screen.getByLabelText('Nom de la règle'), {
      target: { value: 'Relance du matin' },
    });
    fireEvent.change(screen.getByDisplayValue('09:00'), {
      target: { value: '08:15' },
    });
    fireEvent.change(screen.getByPlaceholderText('Ou entrez une commande personnalisée...'), {
      target: { value: 'Commande personnalisée Jarvis' },
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Créer la règle'));
    });

    expect(createRuleMock).toHaveBeenCalledWith({
      name: 'Relance du matin',
      description: '',
      trigger_type: 'schedule',
      trigger_config: { time: '08:15' },
      action_type: 'jarvis_command',
      action_config: { command: 'Commande personnalisée Jarvis', notify: true },
    });
  });

  it('permet de sélectionner une commande prédéfinie puis de créer la règle', async () => {
    renderWithProviders();

    fireEvent.change(screen.getByLabelText('Nom de la règle'), {
      target: { value: 'Briefing auto' },
    });
    fireEvent.click(screen.getByText('select-command'));

    await act(async () => {
      fireEvent.click(screen.getByText('Créer la règle'));
    });

    expect(createRuleMock).toHaveBeenCalledWith({
      name: 'Briefing auto',
      description: '',
      trigger_type: 'schedule',
      trigger_config: { time: '09:00' },
      action_type: 'jarvis_command',
      action_config: { command: 'Génère mon briefing commercial du matin', notify: true },
    });
  });

  it('crée une règle depuis un template et transmet les noms existants', async () => {
    renderWithProviders();

    expect(templatePropsState.lastProps).not.toBeNull();
    expect(templatePropsState.lastProps?.existingRuleNames).toEqual(['Briefing matinal', 'Rapport équipe']);

    await act(async () => {
      fireEvent.click(screen.getByText('Use template'));
    });

    expect(createRuleMock).toHaveBeenCalledWith({
      name: 'Template relance',
      description: 'Desc template',
      trigger_type: 'schedule',
      trigger_config: { time: '07:30' },
      action_type: 'jarvis_command',
      action_config: { command: 'Lance la séquence de relance prospects', notify: true },
    });
  });

  it('bascule une règle et supprime une règle', async () => {
    renderWithProviders();

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);

    expect(toggleRuleMock).toHaveBeenCalledWith({ ruleId: 'r1', isActive: false });

    const deleteButtons = screen.getAllByRole('button', { name: 'Supprimer' });

    await act(async () => {
      fireEvent.click(deleteButtons[1]);
    });

    expect(deleteRuleMock).toHaveBeenCalledWith('r2');
  });

  it('désactive le bouton de création si une création est en cours', () => {
    hookState.isCreating = true;

    renderWithProviders();

    expect(screen.getByText('Création...')).toBeDisabled();
  });

  it('n appelle pas createRule si les champs requis sont absents', async () => {
    renderWithProviders();

    expect(screen.getByText('Créer la règle')).toBeDisabled();

    await act(async () => {
      fireEvent.click(screen.getByText('Créer la règle'));
    });

    expect(createRuleMock).not.toHaveBeenCalled();
  });

  it('journalise une erreur si la création échoue', async () => {
    hookState.mode = 'error';

    renderWithProviders();

    fireEvent.change(screen.getByLabelText('Nom de la règle'), {
      target: { value: 'Règle en erreur' },
    });
    fireEvent.change(screen.getByPlaceholderText('Ou entrez une commande personnalisée...'), {
      target: { value: 'Commande qui échoue' },
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Créer la règle'));
    });

    await waitFor(() => {
      expect(debugErrorMock).toHaveBeenCalled();
    });

    expect(debugErrorMock.mock.calls[0][0]).toBe('Error creating rule:');
    expect(debugErrorMock.mock.calls[0][1]).toBeInstanceOf(Error);
    expect((debugErrorMock.mock.calls[0][1] as Error).message).toBe('x');
  });

  it('valide le chemin erreur de données mockées type react-query', async () => {
    const useFakeQueryState = () => {
      const [state] = React.useState({
        data: null as null | { ok: boolean },
        isLoading: false,
        isError: true,
        error: { message: 'x' },
      });
      return state;
    };

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={createTestQueryClient()}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useFakeQueryState(), { wrapper });

    expect(result.current.data).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(true);
    expect(result.current.error).toEqual({ message: 'x' });
  });
});