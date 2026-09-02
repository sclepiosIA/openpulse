/* @vitest-environment jsdom */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { pulseAuditLogKeys, restoreArchivedMessage, usePulseAuditLog, usePulseMessageArchives } from './usePulseAuditLog';

const hoisted = vi.hoisted(() => {
  const AUDIT_LOGS = [
    {
      id: 'log-1',
      conversation_id: 'conv-1',
      actor_id: 'user-1',
      action: 'message_deleted',
      status: 'success',
      created_at: '2024-01-02T10:00:00.000Z',
      actor: {
        id: 'user-1',
        nom: 'Doe',
        prenom: 'Jane',
        email: 'jane@example.test',
      },
    },
    {
      id: 'log-2',
      conversation_id: 'conv-2',
      actor_id: 'user-2',
      action: 'message_restored',
      status: 'failure',
      created_at: '2024-01-01T09:00:00.000Z',
      actor: {
        id: 'user-2',
        nom: 'Smith',
        prenom: 'John',
        email: 'john@example.test',
      },
    },
  ];

  const ARCHIVES = [
    {
      id: 'arch-1',
      conversation_id: 'conv-1',
      original_message_id: 'msg-1',
      content_snapshot: {
        content: 'hello restored',
        content_html: '<p>hello restored</p>',
        mentions: ['user-2'],
      },
      deleted_at: '2024-01-03T12:00:00.000Z',
      deleted_by: 'user-1',
      deletion_reason: 'cleanup',
      restored: false,
      restored_at: null,
      restored_by: null,
    },
  ];

  const ARCHIVE_SINGLE = {
    id: 'arch-1',
    original_message_id: 'msg-1',
    content_snapshot: {
      content: 'hello restored',
      content_html: '<p>hello restored</p>',
      mentions: ['user-2'],
    },
  };

  const SESSION = {
    user: {
      id: 'user-1',
    },
  };

  const debug = {
    error: vi.fn(),
    warn: vi.fn(),
    log: vi.fn(),
  };

  const state = {
    auditData: AUDIT_LOGS as unknown,
    auditError: null as { message: string } | null,
    archiveListData: ARCHIVES as unknown,
    archiveListError: null as { message: string } | null,
    archiveSingleData: ARCHIVE_SINGLE as unknown,
    archiveSingleError: null as { message: string } | null,
    pulseMessagesUpdateError: null as { message: string } | null,
    archiveUpdateError: null as { message: string } | null,
    getSessionResult: { data: { session: SESSION } },
  };

  const fromCalls: Array<{ table: string }> = [];
  const fromExtendedCalls: Array<{ table: string }> = [];
  const auditEq = vi.fn();
  const auditGte = vi.fn();
  const auditLte = vi.fn();
  const auditOrder = vi.fn();
  const auditLimit = vi.fn();
  const pulseMessagesUpdate = vi.fn();
  const pulseMessagesEq = vi.fn();
  const archivesSelect = vi.fn();
  const archivesEq = vi.fn();
  const archivesOrder = vi.fn();
  const archivesMaybeSingle = vi.fn();
  const archivesUpdate = vi.fn();
  const authGetSession = vi.fn();

  const makeThenable = (resolver: () => Promise<unknown> | unknown) => ({
    then(onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
      return Promise.resolve()
        .then(() => resolver())
        .then(onFulfilled, onRejected);
    },
    catch(onRejected?: (reason: unknown) => unknown) {
      return Promise.resolve()
        .then(() => resolver())
        .catch(onRejected);
    },
  });

  const createAuditBuilder = () => {
    const builder = {
      select: vi.fn(() => builder),
      order: vi.fn((...args: unknown[]) => {
        auditOrder(...args);
        return builder;
      }),
      limit: vi.fn((...args: unknown[]) => {
        auditLimit(...args);
        return builder;
      }),
      eq: vi.fn((...args: unknown[]) => {
        auditEq(...args);
        return builder;
      }),
      gte: vi.fn((...args: unknown[]) => {
        auditGte(...args);
        return builder;
      }),
      lte: vi.fn((...args: unknown[]) => {
        auditLte(...args);
        return builder;
      }),
      in: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      single: vi.fn(() => Promise.resolve({ data: state.auditData, error: state.auditError })),
      maybeSingle: vi.fn(() => Promise.resolve({ data: state.auditData, error: state.auditError })),
      ...makeThenable(() => ({ data: state.auditData, error: state.auditError })),
    };
    return builder;
  };

  const createPulseMessagesBuilder = () => {
    const builder = {
      select: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      eq: vi.fn((...args: unknown[]) => {
        pulseMessagesEq(...args);
        return Promise.resolve({ data: null, error: state.pulseMessagesUpdateError });
      }),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn((...args: unknown[]) => {
        pulseMessagesUpdate(...args);
        return builder;
      }),
      delete: vi.fn(() => builder),
      single: vi.fn(() => Promise.resolve({ data: null, error: state.pulseMessagesUpdateError })),
      maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: state.pulseMessagesUpdateError })),
      ...makeThenable(() => ({ data: null, error: state.pulseMessagesUpdateError })),
    };
    return builder;
  };

  const createArchivesBuilder = () => {
    const builder = {
      select: vi.fn((...args: unknown[]) => {
        archivesSelect(...args);
        return builder;
      }),
      eq: vi.fn((...args: unknown[]) => {
        archivesEq(...args);
        return builder;
      }),
      order: vi.fn((...args: unknown[]) => {
        archivesOrder(...args);
        return builder;
      }),
      limit: vi.fn(() => builder),
      in: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn((...args: unknown[]) => {
        archivesUpdate(...args);
        return builder;
      }),
      delete: vi.fn(() => builder),
      single: vi.fn(() => Promise.resolve({ data: state.archiveSingleData, error: state.archiveSingleError })),
      maybeSingle: vi.fn((...args: unknown[]) => {
        archivesMaybeSingle(...args);
        return Promise.resolve({ data: state.archiveSingleData, error: state.archiveSingleError });
      }),
      ...makeThenable(() => {
        if (archivesUpdate.mock.calls.length > 0) {
          return { data: null, error: state.archiveUpdateError };
        }
        return { data: state.archiveListData, error: state.archiveListError };
      }),
    };
    return builder;
  };

  const mockFrom = vi.fn((table: string) => {
    fromCalls.push({ table });
    if (table === 'pulse_audit_log') return createAuditBuilder();
    if (table === 'pulse_messages') return createPulseMessagesBuilder();
    return createAuditBuilder();
  });

  const mockFromExtended = vi.fn((table: string) => {
    fromExtendedCalls.push({ table });
    return createArchivesBuilder();
  });

  authGetSession.mockImplementation(() => Promise.resolve(state.getSessionResult));

  return {
    AUDIT_LOGS,
    ARCHIVES,
    ARCHIVE_SINGLE,
    SESSION,
    debug,
    state,
    fromCalls,
    fromExtendedCalls,
    auditEq,
    auditGte,
    auditLte,
    auditOrder,
    auditLimit,
    pulseMessagesUpdate,
    pulseMessagesEq,
    archivesSelect,
    archivesEq,
    archivesOrder,
    archivesMaybeSingle,
    archivesUpdate,
    authGetSession,
    mockFrom,
    mockFromExtended,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: hoisted.mockFrom,
    auth: {
      getSession: hoisted.authGetSession,
    },
  },
}));

vi.mock('@/lib/supabaseTyped', () => ({
  fromExtended: hoisted.mockFromExtended,
}));

vi.mock('@/lib/debug', () => ({
  debug: hoisted.debug,
}));

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

describe('usePulseAuditLog', () => {
  beforeEach(() => {
    hoisted.state.auditData = hoisted.AUDIT_LOGS as unknown;
    hoisted.state.auditError = null;
    hoisted.state.archiveListData = hoisted.ARCHIVES as unknown;
    hoisted.state.archiveListError = null;
    hoisted.state.archiveSingleData = hoisted.ARCHIVE_SINGLE as unknown;
    hoisted.state.archiveSingleError = null;
    hoisted.state.pulseMessagesUpdateError = null;
    hoisted.state.archiveUpdateError = null;
    hoisted.state.getSessionResult = { data: { session: hoisted.SESSION } };

    hoisted.fromCalls.length = 0;
    hoisted.fromExtendedCalls.length = 0;

    hoisted.auditEq.mockClear();
    hoisted.auditGte.mockClear();
    hoisted.auditLte.mockClear();
    hoisted.auditOrder.mockClear();
    hoisted.auditLimit.mockClear();
    hoisted.pulseMessagesUpdate.mockClear();
    hoisted.pulseMessagesEq.mockClear();
    hoisted.archivesSelect.mockClear();
    hoisted.archivesEq.mockClear();
    hoisted.archivesOrder.mockClear();
    hoisted.archivesMaybeSingle.mockClear();
    hoisted.archivesUpdate.mockClear();
    hoisted.authGetSession.mockClear();
    hoisted.mockFrom.mockClear();
    hoisted.mockFromExtended.mockClear();
    hoisted.debug.error.mockClear();
    hoisted.debug.warn.mockClear();
  });

  it('expose les clés de query attendues', () => {
    expect(pulseAuditLogKeys.all).toEqual(['pulse-audit-log']);
    expect(pulseAuditLogKeys.list({ conversationId: 'conv-1' })).toEqual([
      'pulse-audit-log',
      'list',
      { conversationId: 'conv-1' },
    ]);
    expect(pulseAuditLogKeys.archives('conv-1')).toEqual([
      'pulse-audit-log',
      'archives',
      'conv-1',
    ]);
  });

  it('charge puis retourne les logs d’audit avec les filtres appliqués', async () => {
    const wrapper = createWrapper();
    const filters = {
      conversationId: 'conv-1',
      actorId: 'user-1',
      action: 'message_deleted',
      status: 'success' as const,
      dateFrom: '2024-01-01T00:00:00.000Z',
      dateTo: '2024-01-31T23:59:59.000Z',
      limit: 50,
    };

    const { result } = renderHook(() => usePulseAuditLog(filters), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(hoisted.mockFrom).toHaveBeenCalledWith('pulse_audit_log');
    expect(hoisted.auditOrder).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(hoisted.auditLimit).toHaveBeenCalledWith(50);
    expect(hoisted.auditEq).toHaveBeenCalledWith('conversation_id', 'conv-1');
    expect(hoisted.auditEq).toHaveBeenCalledWith('actor_id', 'user-1');
    expect(hoisted.auditEq).toHaveBeenCalledWith('action', 'message_deleted');
    expect(hoisted.auditEq).toHaveBeenCalledWith('status', 'success');
    expect(hoisted.auditGte).toHaveBeenCalledWith('created_at', '2024-01-01T00:00:00.000Z');
    expect(hoisted.auditLte).toHaveBeenCalledWith('created_at', '2024-01-31T23:59:59.000Z');

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0]).toMatchObject({
      id: 'log-1',
      conversation_id: 'conv-1',
      action: 'message_deleted',
      status: 'success',
    });
    expect(result.current.data?.[0].actor).toMatchObject({
      id: 'user-1',
      email: 'jane@example.test',
    });
  });

  it('passe en erreur quand la requête des logs échoue', async () => {
    hoisted.state.auditData = null;
    hoisted.state.auditError = { message: 'audit failed' };

    const wrapper = createWrapper();
    const { result } = renderHook(() => usePulseAuditLog({ conversationId: 'conv-1' }), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toMatchObject({ message: 'audit failed' });
    expect(hoisted.debug.error).toHaveBeenCalledWith('Error fetching audit logs:', { message: 'audit failed' });
  });
});

describe('usePulseMessageArchives', () => {
  beforeEach(() => {
    hoisted.state.archiveListData = hoisted.ARCHIVES as unknown;
    hoisted.state.archiveListError = null;
    hoisted.fromExtendedCalls.length = 0;
    hoisted.archivesSelect.mockClear();
    hoisted.archivesEq.mockClear();
    hoisted.archivesOrder.mockClear();
    hoisted.debug.warn.mockClear();
  });

  it('charge puis retourne les archives de messages filtrées par conversation', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => usePulseMessageArchives('conv-1'), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(hoisted.mockFromExtended).toHaveBeenCalledWith('pulse_message_archive');
    expect(hoisted.archivesSelect).toHaveBeenCalledWith(
      'id, conversation_id, original_message_id, content_snapshot, deleted_at, deleted_by, deletion_reason, restored, restored_at, restored_by'
    );
    expect(hoisted.archivesEq).toHaveBeenCalledWith('restored', false);
    expect(hoisted.archivesEq).toHaveBeenCalledWith('conversation_id', 'conv-1');
    expect(hoisted.archivesOrder).toHaveBeenCalledWith('deleted_at', { ascending: false });

    expect(result.current.data).toEqual(hoisted.ARCHIVES);
    expect(result.current.data?.[0]).toMatchObject({
      id: 'arch-1',
      conversation_id: 'conv-1',
      original_message_id: 'msg-1',
      restored: false,
    });
  });

  it('retourne une liste vide si la table d’archives répond en erreur', async () => {
    hoisted.state.archiveListData = null;
    hoisted.state.archiveListError = { message: 'archive unavailable' };

    const wrapper = createWrapper();
    const { result } = renderHook(() => usePulseMessageArchives('conv-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([]);
  });
});

describe('restoreArchivedMessage', () => {
  beforeEach(() => {
    hoisted.state.archiveSingleData = hoisted.ARCHIVE_SINGLE as unknown;
    hoisted.state.archiveSingleError = null;
    hoisted.state.pulseMessagesUpdateError = null;
    hoisted.state.archiveUpdateError = null;
    hoisted.state.getSessionResult = { data: { session: hoisted.SESSION } };

    hoisted.pulseMessagesUpdate.mockClear();
    hoisted.pulseMessagesEq.mockClear();
    hoisted.archivesMaybeSingle.mockClear();
    hoisted.archivesUpdate.mockClear();
    hoisted.authGetSession.mockClear();
    hoisted.debug.error.mockClear();
    hoisted.mockFrom.mockClear();
    hoisted.mockFromExtended.mockClear();
  });

  it('restaure un message archivé et marque l’archive comme restaurée', async () => {
    const result = await act(async () => restoreArchivedMessage('arch-1'));

    expect(result).toBe(true);
    expect(hoisted.authGetSession).toHaveBeenCalledTimes(1);
    expect(hoisted.mockFromExtended).toHaveBeenCalledWith('pulse_message_archive');
    expect(hoisted.archivesMaybeSingle).toHaveBeenCalledTimes(1);
    expect(hoisted.mockFrom).toHaveBeenCalledWith('pulse_messages');
    expect(hoisted.pulseMessagesUpdate).toHaveBeenCalledWith({
      content: 'hello restored',
      content_html: '<p>hello restored</p>',
      mentions: ['user-2'],
      deleted_at: null,
      deleted_by: null,
      deletion_reason: null,
    });
    expect(hoisted.pulseMessagesEq).toHaveBeenCalledWith('id', 'msg-1');
    expect(hoisted.archivesUpdate).toHaveBeenCalledTimes(1);

    const archiveUpdateArg = hoisted.archivesUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(archiveUpdateArg.restored).toBe(true);
    expect(archiveUpdateArg.restored_by).toBe('user-1');
    expect(typeof archiveUpdateArg.restored_at).toBe('string');
  });

  it('retourne false si la lecture de l’archive échoue', async () => {
    hoisted.state.archiveSingleData = null;
    hoisted.state.archiveSingleError = { message: 'not found' };

    const result = await act(async () => restoreArchivedMessage('arch-1'));

    expect(result).toBe(false);
    expect(hoisted.debug.error).toHaveBeenCalledWith('Error fetching archive:', { message: 'not found' });
    expect(hoisted.pulseMessagesUpdate).not.toHaveBeenCalled();
  });

  it('retourne false si la mise à jour du message échoue', async () => {
    hoisted.state.pulseMessagesUpdateError = { message: 'update failed' };

    const result = await act(async () => restoreArchivedMessage('arch-1'));

    expect(result).toBe(false);
    expect(hoisted.debug.error).toHaveBeenCalledWith('Error restoring message:', { message: 'update failed' });
    expect(hoisted.pulseMessagesUpdate).toHaveBeenCalledTimes(1);
  });
});