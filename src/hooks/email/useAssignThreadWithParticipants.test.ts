/* @vitest-environment jsdom */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAssignThreadWithParticipants } from './useAssignThreadWithParticipants';

const {
  AUTH_STATE,
  toastSuccess,
  toastError,
  debugError,
  debugLog,
  mockFrom,
  stableThenableResult,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: 'u1', email: 'user@test.local' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  const toastSuccess = vi.fn();
  const toastError = vi.fn();
  const debugError = vi.fn();
  const debugLog = vi.fn();

  const stableThenableResult = { data: null, error: null };

  const createBuilder = () => {
    const builder = {
      table: '',
      action: '',
      payload: undefined as unknown,
      options: undefined as unknown,
      filters: [] as Array<{ type: string; args: unknown[] }>,
      selectArgs: undefined as unknown,
      result: stableThenableResult as unknown,
      select: vi.fn(function (...args: unknown[]) {
        builder.selectArgs = args;
        return builder;
      }),
      eq: vi.fn(function (...args: unknown[]) {
        builder.filters.push({ type: 'eq', args });
        return builder;
      }),
      gte: vi.fn(function (...args: unknown[]) {
        builder.filters.push({ type: 'gte', args });
        return builder;
      }),
      lte: vi.fn(function (...args: unknown[]) {
        builder.filters.push({ type: 'lte', args });
        return builder;
      }),
      in: vi.fn(function (...args: unknown[]) {
        builder.filters.push({ type: 'in', args });
        return builder;
      }),
      order: vi.fn(function (...args: unknown[]) {
        builder.filters.push({ type: 'order', args });
        return builder;
      }),
      limit: vi.fn(function (...args: unknown[]) {
        builder.filters.push({ type: 'limit', args });
        return builder;
      }),
      is: vi.fn(function (...args: unknown[]) {
        builder.filters.push({ type: 'is', args });
        return builder;
      }),
      insert: vi.fn(function (payload: unknown, options?: unknown) {
        builder.action = 'insert';
        builder.payload = payload;
        builder.options = options;
        builder.result = { data: null, error: null };
        return builder;
      }),
      update: vi.fn(function (payload: unknown) {
        builder.action = 'update';
        builder.payload = payload;
        builder.result = { data: null, error: null };
        return builder;
      }),
      upsert: vi.fn(function (payload: unknown, options?: unknown) {
        builder.action = 'upsert';
        builder.payload = payload;
        builder.options = options;
        builder.result = { data: null, error: null };
        return builder;
      }),
      delete: vi.fn(function () {
        builder.action = 'delete';
        builder.result = { data: null, error: null };
        return builder;
      }),
      single: vi.fn(function () {
        return Promise.resolve(builder.result);
      }),
      maybeSingle: vi.fn(function () {
        return Promise.resolve(builder.result);
      }),
      then: function (onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
        return Promise.resolve(builder.result).then(onFulfilled, onRejected);
      },
      catch: function (onRejected?: (reason: unknown) => unknown) {
        return Promise.resolve(builder.result).catch(onRejected);
      },
    };
    return builder;
  };

  const mockFrom = vi.fn((table: string) => {
    const builder = createBuilder();
    builder.table = table;

    if (table === 'email_threads') {
      const originalUpdate = builder.update;
      builder.update = vi.fn(function (payload: unknown) {
        originalUpdate(payload);
        builder.result = { data: null, error: null };
        return builder;
      });

      const originalSelect = builder.select;
      builder.select = vi.fn(function (...args: unknown[]) {
        originalSelect(...args);
        if (builder.action === 'update') {
          builder.result = { data: [{ id: 'past-1' }, { id: 'past-2' }], error: null };
        }
        return builder;
      });
    }

    if (table === 'email_messages') {
      const originalSelect = builder.select;
      builder.select = vi.fn(function (...args: unknown[]) {
        originalSelect(...args);
        builder.result = {
          data: [
            { thread_id: 'thread-current' },
            { thread_id: 'past-1' },
            { thread_id: 'past-2' },
            { thread_id: 'past-2' },
          ],
          error: null,
        };
        return builder;
      });
    }

    if (table === 'contacts' || table === 'partenaires_contacts' || table === 'email_specific_mappings') {
      const originalUpsert = builder.upsert;
      builder.upsert = vi.fn(function (payload: unknown, options?: unknown) {
        originalUpsert(payload, options);
        builder.result = { data: null, error: null };
        return builder;
      });
    }

    return builder;
  });

  return {
    AUTH_STATE,
    toastSuccess,
    toastError,
    debugError,
    debugLog,
    mockFrom,
    stableThenableResult,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: debugError,
    log: debugLog,
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
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

describe('useAssignThreadWithParticipants', () => {
  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const Wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    return { Wrapper, invalidateSpy };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('gère isAssigning pendant l’opération puis associe le thread, crée les contacts/mappings et invalide les caches', async () => {
    const { Wrapper, invalidateSpy } = createWrapper();
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    let release = () => {};
    const threadUpdatePromise = new Promise<{ data: null; error: null }>((resolve) => {
      release = () => resolve({ data: null, error: null });
    });

    mockFrom.mockImplementationOnce((table: string) => {
      const builder = {
        table,
        action: '',
        payload: undefined as unknown,
        options: undefined as unknown,
        filters: [] as Array<{ type: string; args: unknown[] }>,
        selectArgs: undefined as unknown,
        result: stableThenableResult as unknown,
        select: vi.fn(function (...args: unknown[]) {
          builder.selectArgs = args;
          return builder;
        }),
        eq: vi.fn(function (...args: unknown[]) {
          builder.filters.push({ type: 'eq', args });
          return builder;
        }),
        gte: vi.fn(function (...args: unknown[]) {
          builder.filters.push({ type: 'gte', args });
          return builder;
        }),
        lte: vi.fn(function (...args: unknown[]) {
          builder.filters.push({ type: 'lte', args });
          return builder;
        }),
        in: vi.fn(function (...args: unknown[]) {
          builder.filters.push({ type: 'in', args });
          return builder;
        }),
        order: vi.fn(function (...args: unknown[]) {
          builder.filters.push({ type: 'order', args });
          return builder;
        }),
        limit: vi.fn(function (...args: unknown[]) {
          builder.filters.push({ type: 'limit', args });
          return builder;
        }),
        is: vi.fn(function (...args: unknown[]) {
          builder.filters.push({ type: 'is', args });
          return builder;
        }),
        insert: vi.fn(function (payload: unknown, options?: unknown) {
          builder.action = 'insert';
          builder.payload = payload;
          builder.options = options;
          builder.result = { data: null, error: null };
          return builder;
        }),
        update: vi.fn(function (payload: unknown) {
          builder.action = 'update';
          builder.payload = payload;
          return builder;
        }),
        upsert: vi.fn(function (payload: unknown, options?: unknown) {
          builder.action = 'upsert';
          builder.payload = payload;
          builder.options = options;
          builder.result = { data: null, error: null };
          return builder;
        }),
        delete: vi.fn(function () {
          builder.action = 'delete';
          builder.result = { data: null, error: null };
          return builder;
        }),
        single: vi.fn(function () {
          return Promise.resolve(builder.result);
        }),
        maybeSingle: vi.fn(function () {
          return Promise.resolve(builder.result);
        }),
        then: function (onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
          return threadUpdatePromise.then(onFulfilled, onRejected);
        },
        catch: function (onRejected?: (reason: unknown) => unknown) {
          return threadUpdatePromise.catch(onRejected);
        },
      };
      return builder;
    });

    const { result } = renderHook(() => useAssignThreadWithParticipants(), { wrapper: Wrapper });

    const params = {
      threadId: 'thread-current',
      entityType: 'etablissement' as const,
      entityId: 'eta-1',
      entityName: 'Établissement Test',
      participants: [
        { email: 'Alice@Example.com', name: 'Alice Martin' },
        { email: 'bob@example.com', name: 'Bob' },
        { email: 'ignored@example.com', name: 'Ignored Person' },
      ],
      selectedParticipantEmails: ['alice@example.com', 'bob@example.com'],
    };

    let promise: Promise<boolean>;
    await act(async () => {
      promise = result.current.assignThread(params);
    });

    expect(result.current.isAssigning).toBe(true);

    await act(async () => {
      release();
      await promise!;
    });

    await waitFor(() => {
      expect(result.current.isAssigning).toBe(false);
    });

    expect(mockFrom).toHaveBeenCalledWith('email_threads');
    expect(mockFrom).toHaveBeenCalledWith('contacts');
    expect(mockFrom).toHaveBeenCalledWith('email_specific_mappings');
    expect(mockFrom).toHaveBeenCalledWith('email_messages');

    const emailThreadsCalls = mockFrom.mock.results
      .map((entry) => entry.value)
      .filter((builder) => typeof builder === 'object' && builder && 'table' in builder && (builder as { table: string }).table === 'email_threads') as Array<{
        table: string;
        update: ReturnType<typeof vi.fn>;
        eq: ReturnType<typeof vi.fn>;
        in: ReturnType<typeof vi.fn>;
        is: ReturnType<typeof vi.fn>;
        select: ReturnType<typeof vi.fn>;
      }>;

    expect(emailThreadsCalls).toHaveLength(2);

    const initialThreadUpdate = emailThreadsCalls[0];
    expect(initialThreadUpdate.update).toHaveBeenCalledWith({
      etablissement_id: 'eta-1',
      groupe_id: null,
      partenaire_id: null,
    });
    expect(initialThreadUpdate.eq).toHaveBeenCalledWith('id', 'thread-current');

    const propagationUpdate = emailThreadsCalls[1];
    expect(propagationUpdate.update).toHaveBeenCalledWith({
      etablissement_id: 'eta-1',
      groupe_id: null,
      partenaire_id: null,
    });
    expect(propagationUpdate.in).toHaveBeenCalledWith('id', ['past-1', 'past-2']);
    expect(propagationUpdate.is).toHaveBeenCalledWith('etablissement_id', null);
    expect(propagationUpdate.is).toHaveBeenCalledWith('partenaire_id', null);
    expect(propagationUpdate.is).toHaveBeenCalledWith('groupe_id', null);
    expect(propagationUpdate.select).toHaveBeenCalledWith('id');

    const contactsCalls = mockFrom.mock.results
      .map((entry) => entry.value)
      .filter((builder) => typeof builder === 'object' && builder && 'table' in builder && (builder as { table: string }).table === 'contacts') as Array<{
        upsert: ReturnType<typeof vi.fn>;
      }>;

    expect(contactsCalls).toHaveLength(2);
    expect(contactsCalls[0].upsert).toHaveBeenCalledWith(
      {
        email: 'alice@example.com',
        nom: 'Martin',
        prenom: 'Alice',
        fonction: 'Contact',
        etablissement_id: 'eta-1',
        groupe_id: null,
        created_source: 'manual_email_association',
      },
      {
        onConflict: 'email',
        ignoreDuplicates: false,
      }
    );
    expect(contactsCalls[1].upsert).toHaveBeenCalledWith(
      {
        email: 'bob@example.com',
        nom: 'Bob',
        prenom: 'Bob',
        fonction: 'Contact',
        etablissement_id: 'eta-1',
        groupe_id: null,
        created_source: 'manual_email_association',
      },
      {
        onConflict: 'email',
        ignoreDuplicates: false,
      }
    );

    const mappingCalls = mockFrom.mock.results
      .map((entry) => entry.value)
      .filter((builder) => typeof builder === 'object' && builder && 'table' in builder && (builder as { table: string }).table === 'email_specific_mappings') as Array<{
        upsert: ReturnType<typeof vi.fn>;
      }>;

    expect(mappingCalls).toHaveLength(2);
    expect(mappingCalls[0].upsert).toHaveBeenCalledWith(
      {
        email_address: 'alice@example.com',
        niveau_mapping: 'manuel',
        confidence_level: 'high',
        verified: true,
        etablissement_id: 'eta-1',
      },
      {
        onConflict: 'email_address',
        ignoreDuplicates: false,
      }
    );

    expect(mappingCalls[1].upsert).toHaveBeenCalledWith(
      {
        email_address: 'bob@example.com',
        niveau_mapping: 'manuel',
        confidence_level: 'high',
        verified: true,
        etablissement_id: 'eta-1',
      },
      {
        onConflict: 'email_address',
        ignoreDuplicates: false,
      }
    );

    const messagesCall = mockFrom.mock.results
      .map((entry) => entry.value)
      .find((builder) => typeof builder === 'object' && builder && 'table' in builder && (builder as { table: string }).table === 'email_messages') as unknown as {
        select: ReturnType<typeof vi.fn>;
        in: ReturnType<typeof vi.fn>;
      };

    expect(messagesCall.select).toHaveBeenCalledWith('thread_id');
    expect(messagesCall.in).toHaveBeenCalledWith('from_address', ['alice@example.com', 'bob@example.com']);

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['email-threads'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['contacts'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['email-specific-mappings'] });

    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    const dispatchedEvent = dispatchSpy.mock.calls[0][0];
    expect(dispatchedEvent).toBeInstanceOf(CustomEvent);
    expect(dispatchedEvent.type).toBe('email-thread-updated');
    expect((dispatchedEvent as CustomEvent).detail).toEqual({
      threadId: 'thread-current',
      entityType: 'etablissement',
      entityId: 'eta-1',
    });

    expect(debugLog).toHaveBeenCalledWith('📧 2 threads passés associés automatiquement à Établissement Test');
    expect(toastSuccess).toHaveBeenCalledWith('Thread associé à Établissement Test et 2 contacts créés (+ 2 threads antérieurs)');
    expect(toastError).not.toHaveBeenCalled();
  });

  it('retourne false et affiche une erreur si la mise à jour du thread échoue', async () => {
    const { Wrapper } = createWrapper();

    mockFrom.mockImplementationOnce((table: string) => {
      const builder = {
        table,
        action: '',
        payload: undefined as unknown,
        options: undefined as unknown,
        filters: [] as Array<{ type: string; args: unknown[] }>,
        result: { data: null, error: { message: 'x' } } as unknown,
        select: vi.fn(function () {
          return builder;
        }),
        eq: vi.fn(function (...args: unknown[]) {
          builder.filters.push({ type: 'eq', args });
          return builder;
        }),
        gte: vi.fn(function (...args: unknown[]) {
          builder.filters.push({ type: 'gte', args });
          return builder;
        }),
        lte: vi.fn(function (...args: unknown[]) {
          builder.filters.push({ type: 'lte', args });
          return builder;
        }),
        in: vi.fn(function (...args: unknown[]) {
          builder.filters.push({ type: 'in', args });
          return builder;
        }),
        order: vi.fn(function (...args: unknown[]) {
          builder.filters.push({ type: 'order', args });
          return builder;
        }),
        limit: vi.fn(function (...args: unknown[]) {
          builder.filters.push({ type: 'limit', args });
          return builder;
        }),
        is: vi.fn(function (...args: unknown[]) {
          builder.filters.push({ type: 'is', args });
          return builder;
        }),
        insert: vi.fn(function () {
          return builder;
        }),
        update: vi.fn(function (payload: unknown) {
          builder.action = 'update';
          builder.payload = payload;
          return builder;
        }),
        upsert: vi.fn(function () {
          return builder;
        }),
        delete: vi.fn(function () {
          return builder;
        }),
        single: vi.fn(function () {
          return Promise.resolve(builder.result);
        }),
        maybeSingle: vi.fn(function () {
          return Promise.resolve(builder.result);
        }),
        then: function (onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
          return Promise.resolve(builder.result).then(onFulfilled, onRejected);
        },
        catch: function (onRejected?: (reason: unknown) => unknown) {
          return Promise.resolve(builder.result).catch(onRejected);
        },
      };
      return builder;
    });

    const { result } = renderHook(() => useAssignThreadWithParticipants(), { wrapper: Wrapper });

    let response = false;
    await act(async () => {
      response = await result.current.assignThread({
        threadId: 'thread-fail',
        entityType: 'partenaire',
        entityId: 'part-1',
        entityName: 'Partenaire Test',
        participants: [{ email: 'partner@example.com', name: 'Partner User' }],
        selectedParticipantEmails: ['partner@example.com'],
      });
    });

    expect(response).toBe(false);
    expect(result.current.isAssigning).toBe(false);
    expect(debugError).toHaveBeenCalledWith('Error assigning thread:', { message: 'x' });
    expect(toastError).toHaveBeenCalledWith("Erreur lors de l'association du thread");
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});