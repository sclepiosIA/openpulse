// @vitest-environment jsdom

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { useEtablissementTimeline } from './useEtablissementTimeline';

const {
  EMAIL_THREADS,
  TASKS,
  NULL_ETAB_RESULT,
  AUTH_STATE,
  queryPresets,
  mockFrom,
  mockToastSuccess,
  mockToastError,
  mockNavigate,
} = vi.hoisted(() => ({
  EMAIL_THREADS: [
    {
      id: 'em-1',
      subject: 'Relance dossier',
      last_message_date: '2024-03-10T10:00:00.000Z',
      message_count: 2,
      unread_count: 1,
      is_archived: false,
      category: 'suivi',
      priority: 'high',
      messages: [
        {
          id: 'msg-1',
          subject: 'Relance dossier',
          from_address: 'contact@example.test',
          from_name: 'Alice',
          sent_date: '2024-03-10T09:30:00.000Z',
          body_text: 'Bonjour, pouvez-vous nous transmettre les éléments manquants pour finaliser le dossier ?',
          body_html: '<p>Bonjour</p>',
        },
      ],
    },
    {
      id: 'em-2',
      subject: 'Conversation archivée',
      last_message_date: '2024-03-08T08:00:00.000Z',
      message_count: 1,
      unread_count: 0,
      is_archived: true,
      category: 'info',
      priority: 'low',
      messages: [
        {
          id: 'msg-2',
          subject: 'Conversation archivée',
          from_address: 'archive@example.test',
          from_name: 'Bob',
          sent_date: '2024-03-08T07:45:00.000Z',
          body_text: 'Historique classé',
          body_html: '<p>Historique classé</p>',
        },
      ],
    },
  ],
  TASKS: [
    {
      id: 'ta-1',
      titre: 'Appeler le client',
      description: 'Faire un point sur le dossier',
      statut: 'en_cours',
      priorite: 'medium',
      echeance: '2024-03-09T12:00:00.000Z',
      date_realisation: null,
      created_at: '2024-03-07T10:00:00.000Z',
      updated_at: '2024-03-09T15:00:00.000Z',
      categorie: { nom: 'Suivi', couleur: '#00f' },
      responsable: { nom: 'Doe', prenom: 'Jane' },
    },
    {
      id: 'ta-2',
      titre: 'Clôturer le ticket',
      description: '',
      statut: 'terminee',
      priorite: 'high',
      echeance: '2024-03-06T12:00:00.000Z',
      date_realisation: '2024-03-11T08:30:00.000Z',
      created_at: '2024-03-05T10:00:00.000Z',
      updated_at: '2024-03-10T15:00:00.000Z',
      categorie: { nom: 'Clôture', couleur: '#0f0' },
      responsable: { nom: 'Smith', prenom: 'John' },
    },
  ],
  NULL_ETAB_RESULT: [],
  AUTH_STATE: {
    user: { id: 'u-1', email: 'user@test.local' },
    session: { user: { id: 'u-1' } },
    isLoading: false,
  },
  queryPresets: {
    standard: {
      staleTime: 120000,
      gcTime: 1800000,
    },
  },
  mockFrom: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockNavigate: vi.fn(),
}));

vi.mock('@/lib/queryPresets', () => ({
  queryPresets,
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

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

function createThenableResult<T>(result: T) {
  return {
    then: (resolve: (value: T) => unknown) => Promise.resolve(resolve(result)),
    catch: () => Promise.resolve(result),
  };
}

function createBuilder(table: string) {
  let result:
    | { data: typeof EMAIL_THREADS; error: null }
    | { data: typeof TASKS; error: null }
    | { data: null; error: { message: string } };

  if (table === 'email_threads') {
    result = { data: EMAIL_THREADS, error: null };
  } else if (table === 'taches') {
    result = { data: TASKS, error: null };
  } else {
    result = { data: null, error: { message: 'unknown table' } };
  }

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
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: createThenableResult(result).then,
    catch: createThenableResult(result).catch,
  };

  return {
    builder,
    setResult: (
      next:
        | { data: typeof EMAIL_THREADS; error: null }
        | { data: typeof TASKS; error: null }
        | { data: null; error: { message: string } }
    ) => {
      result = next;
      builder.then = createThenableResult(result).then;
      builder.catch = createThenableResult(result).catch;
      builder.single.mockImplementation(() => Promise.resolve(result));
      builder.maybeSingle.mockImplementation(() => Promise.resolve(result));
    },
  };
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useEtablissementTimeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retourne une timeline triée avec les emails et les tâches', async () => {
    const emailQuery = createBuilder('email_threads');
    const taskQuery = createBuilder('taches');

    mockFrom.mockImplementation((table: string) => {
      if (table === 'email_threads') return emailQuery.builder;
      if (table === 'taches') return taskQuery.builder;
      return createBuilder(table).builder;
    });

    const { result } = renderHook(() => useEtablissementTimeline('eta-1'), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFrom).toHaveBeenNthCalledWith(1, 'email_threads');
    expect(mockFrom).toHaveBeenNthCalledWith(2, 'taches');

    expect(emailQuery.builder.eq).toHaveBeenCalledWith('etablissement_id', 'eta-1');
    expect(emailQuery.builder.order).toHaveBeenCalledWith('last_message_date', { ascending: false });

    expect(taskQuery.builder.eq).toHaveBeenCalledWith('etablissement_id', 'eta-1');
    expect(taskQuery.builder.eq).toHaveBeenCalledWith('archive', false);
    expect(taskQuery.builder.order).toHaveBeenCalledWith('created_at', { ascending: false });

    expect(result.current.data).toEqual([
      {
        id: 'task-ta-2',
        type: 'task',
        date: '2024-03-11T08:30:00.000Z',
        title: 'Clôturer le ticket',
        description: '',
        status: 'terminee',
        data: TASKS[1],
      },
      {
        id: 'email-em-1',
        type: 'email',
        date: '2024-03-10T10:00:00.000Z',
        title: 'Relance dossier',
        description: 'Bonjour, pouvez-vous nous transmettre les éléments manquants pour finaliser le dossier ?',
        status: 'unread',
        data: EMAIL_THREADS[0],
      },
      {
        id: 'task-ta-1',
        type: 'task',
        date: '2024-03-09T15:00:00.000Z',
        title: 'Appeler le client',
        description: 'Faire un point sur le dossier',
        status: 'en_cours',
        data: TASKS[0],
      },
      {
        id: 'email-em-2',
        type: 'email',
        date: '2024-03-08T08:00:00.000Z',
        title: 'Conversation archivée',
        description: 'Historique classé',
        status: 'archived',
        data: EMAIL_THREADS[1],
      },
    ]);
  });

  it('ne lance pas la requête et renvoie un état inactif si etablissementId est null', async () => {
    mockFrom.mockImplementation(() => createBuilder('email_threads').builder);

    const { result } = renderHook(() => useEtablissementTimeline(null), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(mockFrom).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });

    expect(NULL_ETAB_RESULT).toEqual([]);
  });

  it('passe en erreur si la requête emails échoue', async () => {
    const emailQuery = createBuilder('email_threads');
    const taskQuery = createBuilder('taches');

    emailQuery.setResult({ data: null, error: { message: 'emails failed' } });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'email_threads') return emailQuery.builder;
      if (table === 'taches') return taskQuery.builder;
      return createBuilder(table).builder;
    });

    const { result } = renderHook(() => useEtablissementTimeline('eta-err'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual({ message: 'emails failed' });
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('email_threads');
  });
});