/* @vitest-environment jsdom */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { usePartenaireActivities } from './usePartenaireActivities';

const {
  THREADS,
  MESSAGES,
  CONTACTS,
  EMPTY_THREADS,
  NULL_ERROR,
  ERROR_OBJECT,
  authState,
  toastSuccess,
  toastError,
  navigateMock,
  mockFrom,
} = vi.hoisted(() => {
  return {
    THREADS: [{ id: 'th-1' }, { id: 'th-2' }],
    MESSAGES: [
      { id: 'm-1', subject: 'Relance', received_date: '2024-03-05T10:00:00.000Z', thread_id: 'th-1' },
      { id: 'm-2', subject: '', received_date: '2024-03-03T09:00:00.000Z', thread_id: 'th-2' },
      { id: 'm-3', subject: 'Sans date', received_date: null, thread_id: 'th-1' },
    ],
    CONTACTS: [
      { id: 'c-1', nom: 'Martin', prenom: 'Alice', created_at: '2024-03-04T08:00:00.000Z' },
      { id: 'c-2', nom: 'Durand', prenom: 'Bob', created_at: '2024-03-01T12:00:00.000Z' },
    ],
    EMPTY_THREADS: [],
    NULL_ERROR: null,
    ERROR_OBJECT: { message: 'x' },
    authState: {
      user: { id: 'u1', email: 't@t.co' },
      session: { user: { id: 'u1' } },
      isLoading: false,
    },
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    navigateMock: vi.fn(),
    mockFrom: vi.fn(),
  };
});

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => authState,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => authState,
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

type SupabaseResponse<T> = {
  data: T;
  error: { message: string } | null;
};

type ChainableBuilder<T> = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  then: PromiseLike<SupabaseResponse<T>>['then'];
  catch: Promise<SupabaseResponse<T>>['catch'];
};

function createBuilder<T>(response: SupabaseResponse<T>): ChainableBuilder<T> {
  const builder = {} as ChainableBuilder<T>;

  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.gte = vi.fn(() => builder);
  builder.lte = vi.fn(() => builder);
  builder.in = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.limit = vi.fn(() => builder);
  builder.insert = vi.fn(() => builder);
  builder.update = vi.fn(() => builder);
  builder.delete = vi.fn(() => builder);
  builder.single = vi.fn(() => Promise.resolve(response));
  builder.maybeSingle = vi.fn(() => Promise.resolve(response));
  builder.then = (onFulfilled, onRejected) => Promise.resolve(response).then(onFulfilled, onRejected);
  builder.catch = onRejected => Promise.resolve(response).catch(onRejected);

  return builder;
}

function createErrorBuilder(message: string): ChainableBuilder<null> {
  const error = new Error(message);
  const builder = {} as ChainableBuilder<null>;

  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.gte = vi.fn(() => builder);
  builder.lte = vi.fn(() => builder);
  builder.in = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.limit = vi.fn(() => builder);
  builder.insert = vi.fn(() => builder);
  builder.update = vi.fn(() => builder);
  builder.delete = vi.fn(() => builder);
  builder.single = vi.fn(() => Promise.reject(error));
  builder.maybeSingle = vi.fn(() => Promise.reject(error));
  builder.then = (onFulfilled, onRejected) => Promise.reject(error).then(onFulfilled, onRejected);
  builder.catch = onRejected => Promise.reject(error).catch(onRejected);

  return builder;
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children);
  };
}

describe('usePartenaireActivities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passe de isLoading à succès et agrège les emails et contacts triés par date décroissante', async () => {
    const threadsBuilder = createBuilder({ data: THREADS, error: NULL_ERROR });
    const messagesBuilder = createBuilder({ data: MESSAGES, error: NULL_ERROR });
    const contactsBuilder = createBuilder({ data: CONTACTS, error: NULL_ERROR });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'email_threads') return threadsBuilder;
      if (table === 'email_messages') return messagesBuilder;
      return contactsBuilder;
    });

    const { result } = renderHook(() => usePartenaireActivities('p-1'), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFrom).toHaveBeenCalledTimes(3);
    expect(mockFrom).toHaveBeenNthCalledWith(1, 'email_threads');
    expect(mockFrom).toHaveBeenNthCalledWith(2, 'email_messages');
    expect(mockFrom).toHaveBeenNthCalledWith(3, 'partenaires_contacts');

    expect(threadsBuilder.select).toHaveBeenCalledWith('id');
    expect(threadsBuilder.eq).toHaveBeenCalledWith('partenaire_id', 'p-1');

    expect(messagesBuilder.select).toHaveBeenCalledWith('id, subject, received_date, thread_id');
    expect(messagesBuilder.in).toHaveBeenCalledWith('thread_id', ['th-1', 'th-2']);
    expect(messagesBuilder.order).toHaveBeenCalledWith('received_date', { ascending: false });
    expect(messagesBuilder.limit).toHaveBeenCalledWith(15);

    expect(contactsBuilder.select).toHaveBeenCalledWith('id, nom, prenom, created_at');
    expect(contactsBuilder.eq).toHaveBeenCalledWith('partenaire_id', 'p-1');
    expect(contactsBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(contactsBuilder.limit).toHaveBeenCalledWith(15);

    expect(result.current.data).toEqual([
      {
        id: 'email-m-1',
        type: 'email',
        title: 'Relance',
        date: '2024-03-05T10:00:00.000Z',
      },
      {
        id: 'contact-c-1',
        type: 'contact_added',
        title: 'Contact ajouté : Alice Martin',
        date: '2024-03-04T08:00:00.000Z',
      },
      {
        id: 'email-m-2',
        type: 'email',
        title: 'Email sans sujet',
        date: '2024-03-03T09:00:00.000Z',
      },
      {
        id: 'contact-c-2',
        type: 'contact_added',
        title: 'Contact ajouté : Bob Durand',
        date: '2024-03-01T12:00:00.000Z',
      },
    ]);
    expect(result.current.data).toHaveLength(4);
  });

  it('ignore la requête email_messages quand aucun thread n’existe et retourne seulement les contacts', async () => {
    const threadsBuilder = createBuilder({ data: EMPTY_THREADS, error: NULL_ERROR });
    const contactsBuilder = createBuilder({ data: CONTACTS, error: NULL_ERROR });
    const messagesBuilder = createBuilder({ data: [], error: NULL_ERROR });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'email_threads') return threadsBuilder;
      if (table === 'email_messages') return messagesBuilder;
      return contactsBuilder;
    });

    const { result } = renderHook(() => usePartenaireActivities('p-2'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFrom).toHaveBeenCalledTimes(2);
    expect(mockFrom).toHaveBeenNthCalledWith(1, 'email_threads');
    expect(mockFrom).toHaveBeenNthCalledWith(2, 'partenaires_contacts');
    expect(messagesBuilder.select).not.toHaveBeenCalled();

    expect(result.current.data).toEqual([
      {
        id: 'contact-c-1',
        type: 'contact_added',
        title: 'Contact ajouté : Alice Martin',
        date: '2024-03-04T08:00:00.000Z',
      },
      {
        id: 'contact-c-2',
        type: 'contact_added',
        title: 'Contact ajouté : Bob Durand',
        date: '2024-03-01T12:00:00.000Z',
      },
    ]);
  });

  it('passe en erreur quand la requête supabase rejette', async () => {
    const failingBuilder = createErrorBuilder(ERROR_OBJECT.message);

    mockFrom.mockImplementation(() => failingBuilder);

    const { result } = renderHook(() => usePartenaireActivities('p-err'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('x');
    expect(mockFrom).toHaveBeenCalledWith('email_threads');
  });

  it('n’exécute aucune requête si partenaireId est vide', () => {
    const { result } = renderHook(() => usePartenaireActivities(''), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(mockFrom).not.toHaveBeenCalled();
  });
});