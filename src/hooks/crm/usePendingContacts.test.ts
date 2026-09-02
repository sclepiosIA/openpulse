/* @vitest-environment jsdom */
import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  usePendingContacts,
  useApprovePendingContact,
  useRejectPendingContact,
} from './usePendingContacts';

const {
  AUTH_STATE,
  QUERY_ROWS,
  SINGLE_PENDING_CONTACT,
  PROFILE_ROW,
  EXISTING_CONTACT,
  mockFrom,
  mockToastSuccess,
  mockToastError,
  mockSanitizeSupabaseError,
  mockInvalidateQueries,
  state,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: 'user-1', email: 'user@test.local' } as { id: string; email: string } | null,
    session: { user: { id: 'user-1' } },
    isLoading: false,
  };

  const QUERY_ROWS = [
    {
      id: 'pc-1',
      email_thread_id: 'th-1',
      etablissement_id: 'etab-1',
      partenaire_id: null,
      groupe_id: null,
      extracted_data: {
        nom: 'Durand',
        prenom: 'Alice',
        fonction: 'Direction des opérations',
        email: 'Alice@Example.com',
        telephone: '0101',
      },
      confidence: 0.6,
      status: 'pending',
      reviewed_by: null,
      reviewed_at: null,
      rejection_reason: null,
      created_at: '2024-01-01T10:00:00.000Z',
      updated_at: '2024-01-01T10:00:00.000Z',
      email_threads: { subject: 'Sujet A' },
      etablissements: { nom: 'Etab A' },
      partenaires: undefined,
      groupes_etablissements: undefined,
    },
    {
      id: 'pc-2',
      email_thread_id: 'th-1',
      etablissement_id: 'etab-1',
      partenaire_id: null,
      groupe_id: null,
      extracted_data: {
        nom: 'Durand',
        prenom: 'Alice',
        fonction: 'Direction des opérations',
        email: 'alice@example.com',
        telephone: '0202',
      },
      confidence: 0.9,
      status: 'pending',
      reviewed_by: null,
      reviewed_at: null,
      rejection_reason: null,
      created_at: '2024-01-01T09:00:00.000Z',
      updated_at: '2024-01-01T09:00:00.000Z',
      email_threads: { subject: 'Sujet A' },
      etablissements: { nom: 'Etab A' },
      partenaires: undefined,
      groupes_etablissements: undefined,
    },
    {
      id: 'pc-3',
      email_thread_id: 'th-2',
      etablissement_id: null,
      partenaire_id: 'part-1',
      groupe_id: null,
      extracted_data: {
        nom: 'Martin',
        prenom: 'Bob',
        fonction: 'Commercial',
        email: 'bob@example.com',
        telephone: '0303',
      },
      confidence: 0.7,
      status: 'pending',
      reviewed_by: null,
      reviewed_at: null,
      rejection_reason: null,
      created_at: '2024-01-02T08:00:00.000Z',
      updated_at: '2024-01-02T08:00:00.000Z',
      email_threads: { subject: 'Sujet B' },
      etablissements: undefined,
      partenaires: { nom: 'Partenaire B' },
      groupes_etablissements: undefined,
    },
  ];

  const SINGLE_PENDING_CONTACT = {
    id: 'pc-approve-1',
    email_thread_id: 'thread-approve',
    etablissement_id: 'etab-9',
    partenaire_id: null,
    groupe_id: null,
    extracted_data: {
      nom: 'Dupont',
      prenom: 'Claire',
      fonction: 'Direction Générale',
      email: 'claire@example.com',
      telephone: '0404',
    },
    confidence: 0.88,
    status: 'pending',
  };

  const PROFILE_ROW = { id: 'profile-1' };
  const EXISTING_CONTACT = { id: 'contact-1' };

  const mockFrom = vi.fn();
  const mockToastSuccess = vi.fn();
  const mockToastError = vi.fn();
  const mockSanitizeSupabaseError = vi.fn((error: Error | { message?: string }) => error.message ?? 'sanitized');
  const mockInvalidateQueries = vi.fn();

  const state = {
    pendingContactsSelectResult: { data: QUERY_ROWS as unknown, error: null as null | { message: string } },
    pendingSingleResult: { data: SINGLE_PENDING_CONTACT as unknown, error: null as null | { message: string } },
    profileSingleResult: { data: PROFILE_ROW as unknown, error: null as null | { message: string } },
    contactsMaybeSingleResult: { data: null as null | { id: string }, error: null as null | { message: string } },
    partenairesMaybeSingleResult: { data: null as null | { id: string }, error: null as null | { message: string } },
    insertResult: { data: null as unknown, error: null as null | { message: string } },
    updateResult: { data: null as unknown, error: null as null | { message: string } },
  };

  return {
    AUTH_STATE,
    QUERY_ROWS,
    SINGLE_PENDING_CONTACT,
    PROFILE_ROW,
    EXISTING_CONTACT,
    mockFrom,
    mockToastSuccess,
    mockToastError,
    mockSanitizeSupabaseError,
    mockInvalidateQueries,
    state,
  };
});

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: mockSanitizeSupabaseError,
}));

type Builder = {
  __table: string;
  __select: string;
  __filters: Array<{ method: string; args: unknown[] }>;
  __insertPayload: unknown;
  __updatePayload: unknown;
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  ilike: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  then: Promise<unknown>['then'];
  catch: Promise<unknown>['catch'];
};

function resolveBuilderResult(builder: Builder) {
  if (builder.__insertPayload !== undefined) {
    return state.insertResult;
  }
  if (builder.__updatePayload !== undefined) {
    return state.updateResult;
  }
  if (builder.__table === 'pending_contacts' && builder.__select.includes('email_threads(')) {
    return state.pendingContactsSelectResult;
  }
  return { data: null, error: null };
}

function createBuilder(table: string): Builder {
  const builder = {} as Builder;

  builder.__table = table;
  builder.__select = '';
  builder.__filters = [];
  builder.__insertPayload = undefined;
  builder.__updatePayload = undefined;

  builder.select = vi.fn((value: string) => {
    builder.__select = value;
    return builder;
  });
  builder.eq = vi.fn((...args: unknown[]) => {
    builder.__filters.push({ method: 'eq', args });
    return builder;
  });
  builder.gte = vi.fn((...args: unknown[]) => {
    builder.__filters.push({ method: 'gte', args });
    return builder;
  });
  builder.lte = vi.fn((...args: unknown[]) => {
    builder.__filters.push({ method: 'lte', args });
    return builder;
  });
  builder.in = vi.fn((...args: unknown[]) => {
    builder.__filters.push({ method: 'in', args });
    return builder;
  });
  builder.ilike = vi.fn((...args: unknown[]) => {
    builder.__filters.push({ method: 'ilike', args });
    return builder;
  });
  builder.order = vi.fn(() => builder);
  builder.limit = vi.fn(() => builder);
  builder.insert = vi.fn((payload: unknown) => {
    builder.__insertPayload = payload;
    return builder;
  });
  builder.update = vi.fn((payload: unknown) => {
    builder.__updatePayload = payload;
    return builder;
  });
  builder.delete = vi.fn(() => builder);
  builder.single = vi.fn(async () => {
    if (table === 'pending_contacts' && builder.__select.includes('email_thread_id')) {
      return state.pendingSingleResult;
    }
    if (table === 'profiles') {
      return state.profileSingleResult;
    }
    return { data: null, error: null };
  });
  builder.maybeSingle = vi.fn(async () => {
    if (table === 'contacts') {
      return state.contactsMaybeSingleResult;
    }
    if (table === 'partenaires_contacts') {
      return state.partenairesMaybeSingleResult;
    }
    return { data: null, error: null };
  });
  builder.then = (onFulfilled, onRejected) =>
    Promise.resolve(resolveBuilderResult(builder)).then(onFulfilled, onRejected);
  builder.catch = (onRejected) =>
    Promise.resolve(resolveBuilderResult(builder)).catch(onRejected);

  return builder;
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(async (...args) => {
    mockInvalidateQueries(...args);
    return undefined;
  });

  const Wrapper = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  return { Wrapper, queryClient };
}

function resetState() {
  vi.clearAllMocks();
  state.pendingContactsSelectResult = { data: QUERY_ROWS, error: null };
  state.pendingSingleResult = { data: SINGLE_PENDING_CONTACT, error: null };
  state.profileSingleResult = { data: PROFILE_ROW, error: null };
  state.contactsMaybeSingleResult = { data: null, error: null };
  state.partenairesMaybeSingleResult = { data: null, error: null };
  state.insertResult = { data: null, error: null };
  state.updateResult = { data: null, error: null };
  AUTH_STATE.user = { id: 'user-1', email: 'user@test.local' };
  mockFrom.mockImplementation((table: string) => createBuilder(table));
}

describe('usePendingContacts', () => {
  beforeEach(() => {
    resetState();
  });

  it('charge puis déduplique les contacts en gardant la meilleure confidence', async () => {
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => usePendingContacts(), { wrapper: Wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith('pending_contacts');
    expect(result.current.data).toHaveLength(2);

    const first = result.current.data?.find((c) => c.email_thread_id === 'th-1');
    const second = result.current.data?.find((c) => c.email_thread_id === 'th-2');

    expect(first?.id).toBe('pc-2');
    expect(first?.confidence).toBe(0.9);
    expect(first?.extracted_data.email).toBe('alice@example.com');
    expect(first?.etablissements?.nom).toBe('Etab A');

    expect(second?.id).toBe('pc-3');
    expect(second?.partenaires?.nom).toBe('Partenaire B');
  });

  it('passe en erreur si la requête supabase renvoie une erreur', async () => {
    const { Wrapper } = createWrapper();
    state.pendingContactsSelectResult = { data: null, error: { message: 'fetch failed' } };

    const { result } = renderHook(() => usePendingContacts(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('fetch failed');
  });
});

describe('useApprovePendingContact', () => {
  beforeEach(() => {
    resetState();
  });

  it('crée un contact établissement puis invalide les queries et affiche un toast de succès', async () => {
    const { Wrapper } = createWrapper();
    const fromCalls: Builder[] = [];

    mockFrom.mockImplementation((table: string) => {
      const builder = createBuilder(table);
      fromCalls.push(builder);
      return builder;
    });

    const { result } = renderHook(() => useApprovePendingContact(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'pc-approve-1',
        contactData: {
          nom: 'Dupont',
          prenom: 'Claire',
          fonction: 'Direction Générale',
          email: 'claire@example.com',
          telephone: '0404',
        },
      });
    });

    expect(mockFrom).toHaveBeenCalledWith('pending_contacts');
    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(mockFrom).toHaveBeenCalledWith('contacts');

    const contactsInsertBuilder = fromCalls.find(
      (b) => b.__table === 'contacts' && b.insert.mock.calls.length > 0,
    );
    const pendingUpdateBuilder = fromCalls.find(
      (b) => b.__table === 'pending_contacts' && b.update.mock.calls.length > 0,
    );

    expect(contactsInsertBuilder).toBeDefined();
    expect(contactsInsertBuilder?.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        nom: 'Dupont',
        prenom: 'Claire',
        fonction: 'Direction Générale',
        email: 'claire@example.com',
        telephone: '0404',
        etablissement_id: 'etab-9',
        type_contact: 'direction',
        niveau_contact: 'etablissement',
        created_source: 'email_ai',
        created_metadata: expect.objectContaining({
          email_thread_id: 'thread-approve',
          confidence: 0.88,
          reviewed_by: 'profile-1',
        }),
      }),
    );

    expect(pendingUpdateBuilder?.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'approved',
        reviewed_by: 'profile-1',
        reviewed_at: expect.any(String),
      }),
    );

    expect(mockToastSuccess).toHaveBeenCalledWith('Contact créé avec succès');
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['pending-contacts'] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['contacts'] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['partenaires-contacts'] });
  });

  it('met à jour un contact existant au lieu de l’insérer', async () => {
    const { Wrapper } = createWrapper();
    state.contactsMaybeSingleResult = { data: EXISTING_CONTACT, error: null };
    const fromCalls: Builder[] = [];

    mockFrom.mockImplementation((table: string) => {
      const builder = createBuilder(table);
      fromCalls.push(builder);
      return builder;
    });

    const { result } = renderHook(() => useApprovePendingContact(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'pc-approve-1',
        contactData: {
          nom: 'Dupont',
          prenom: 'Claire',
          fonction: 'Direction Générale',
          email: 'claire@example.com',
          telephone: '0404',
        },
      });
    });

    const contactsSelectBuilder = fromCalls.find(
      (b) => b.__table === 'contacts' && b.maybeSingle.mock.calls.length > 0,
    );
    const contactsUpdateBuilder = fromCalls.find(
      (b) => b.__table === 'contacts' && b.update.mock.calls.length > 0,
    );

    expect(contactsSelectBuilder?.ilike).toHaveBeenCalledWith('email', 'claire@example.com');
    expect(contactsUpdateBuilder?.update).toHaveBeenCalledWith(
      expect.objectContaining({
        nom: 'Dupont',
        prenom: 'Claire',
        fonction: 'Direction Générale',
        telephone: '0404',
        updated_by: 'profile-1',
        updated_at: expect.any(String),
      }),
    );
    expect(contactsUpdateBuilder?.eq).toHaveBeenCalledWith('id', 'contact-1');
  });

  it('passe en erreur et affiche le message sanitizé quand une étape échoue', async () => {
    const { Wrapper } = createWrapper();
    state.pendingSingleResult = { data: null, error: { message: 'approval failed' } };

    const { result } = renderHook(() => useApprovePendingContact(), { wrapper: Wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          id: 'pc-approve-1',
          contactData: {
            nom: 'Dupont',
            prenom: 'Claire',
            fonction: 'Direction Générale',
            email: 'claire@example.com',
            telephone: '0404',
          },
        }),
      ).rejects.toMatchObject({ message: 'approval failed' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockSanitizeSupabaseError).toHaveBeenCalledWith(expect.objectContaining({ message: 'approval failed' }));
    expect(mockToastError).toHaveBeenCalledWith('approval failed');
  });
});

describe('useRejectPendingContact', () => {
  beforeEach(() => {
    resetState();
  });

  it('rejette un contact, met à jour son statut et invalide la liste', async () => {
    const { Wrapper } = createWrapper();
    const fromCalls: Builder[] = [];

    mockFrom.mockImplementation((table: string) => {
      const builder = createBuilder(table);
      fromCalls.push(builder);
      return builder;
    });

    const { result } = renderHook(() => useRejectPendingContact(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'pc-9', reason: 'Doublon' });
    });

    const pendingUpdateBuilder = fromCalls.find(
      (b) => b.__table === 'pending_contacts' && b.update.mock.calls.length > 0,
    );

    expect(pendingUpdateBuilder?.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'rejected',
        rejection_reason: 'Doublon',
        reviewed_by: 'profile-1',
        reviewed_at: expect.any(String),
      }),
    );
    expect(pendingUpdateBuilder?.eq).toHaveBeenCalledWith('id', 'pc-9');
    expect(mockToastSuccess).toHaveBeenCalledWith('Contact rejeté');
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['pending-contacts'] });
  });

  it('passe en erreur si le rejet échoue', async () => {
    const { Wrapper } = createWrapper();
    state.updateResult = { data: null, error: { message: 'reject failed' } };

    const { result } = renderHook(() => useRejectPendingContact(), { wrapper: Wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync({ id: 'pc-9', reason: 'Invalide' })).rejects.toMatchObject({
        message: 'reject failed',
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockSanitizeSupabaseError).toHaveBeenCalledWith(expect.objectContaining({ message: 'reject failed' }));
    expect(mockToastError).toHaveBeenCalledWith('reject failed');
  });
});