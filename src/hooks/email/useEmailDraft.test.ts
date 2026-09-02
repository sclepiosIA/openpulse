// @vitest-environment jsdom

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEmailDraft } from './useEmailDraft';

const {
  INSERT_RESULT,
  LOAD_RESULT,
  mockFrom,
  mockDebugError,
} = vi.hoisted(() => ({
    INSERT_RESULT: { id: 'draft-1' },
    LOAD_RESULT: {
      id: 'draft-42',
      user_id: 'user-1',
      account_id: 'account-1',
      to_addresses: 'alice@example.com',
      cc_addresses: 'bob@example.com',
      bcc_addresses: 'carol@example.com',
      subject: 'Hello',
      body: 'World',
      attachments: [
        {
          name: 'file.pdf',
          size: 1234,
          type: 'application/pdf',
          url: '/file.pdf',
        },
      ],
      created_at: '2024-01-01',
      updated_at: '2024-01-02',
    },
    mockFrom: vi.fn(),
    mockDebugError: vi.fn(),
  })
);

vi.mock('@/lib/debug', () => ({
  debug: {
    error: mockDebugError,
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

function createBuilder() {
  const state = {
    operation: null as null | 'insert' | 'update' | 'delete' | 'select',
    insertData: undefined as unknown,
    updateData: undefined as unknown,
    eqCalls: [] as Array<[string, unknown]>,
    selectArg: undefined as string | undefined,
    singleResult: { data: null, error: null } as { data: unknown; error: { message: string } | null },
    maybeSingleResult: { data: null, error: null } as { data: unknown; error: { message: string } | null },
    thenResult: { data: null, error: null } as { data: unknown; error: { message: string } | null },
  };

  const builder: any = {
    state,
    select: vi.fn((arg?: string) => {
      state.operation = 'select';
      state.selectArg = arg;
      return builder;
    }),
    eq: vi.fn((column: string, value: unknown) => {
      state.eqCalls.push([column, value]);
      return builder;
    }),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn((data: unknown) => {
      state.operation = 'insert';
      state.insertData = data;
      return builder;
    }),
    update: vi.fn((data: unknown) => {
      state.operation = 'update';
      state.updateData = data;
      return builder;
    }),
    delete: vi.fn(() => {
      state.operation = 'delete';
      return builder;
    }),
    single: vi.fn(() => Promise.resolve(state.singleResult)),
    maybeSingle: vi.fn(() => Promise.resolve(state.maybeSingleResult)),
    then: vi.fn((onFulfilled?: (value: { data: unknown; error: { message: string } | null }) => unknown) =>
      Promise.resolve(state.thenResult).then(onFulfilled)
    ),
    catch: vi.fn((onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(state.thenResult).catch(onRejected)
    ),
  };

  return builder;
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

describe('useEmailDraft', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sauvegarde un nouveau brouillon, expose isSaving pendant le chargement puis met à jour draftId', async () => {
    const insertBuilder = createBuilder();
    let resolveInsert: ((value: { data: unknown; error: { message: string } | null }) => void) | null = null;
    const insertPromise = new Promise<{ data: unknown; error: { message: string } | null }>((resolve) => {
      resolveInsert = resolve;
    });

    insertBuilder.maybeSingle.mockImplementation(() => insertPromise);

    mockFrom.mockImplementation((table: string) => {
      expect(table).toBe('email_drafts');
      return insertBuilder;
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useEmailDraft('account-1'), { wrapper });

    const payload = {
      to_addresses: 'dest@example.com',
      cc_addresses: '',
      bcc_addresses: '',
      subject: 'Sujet test',
      body: 'Contenu',
      attachments: [
        {
          name: 'doc.txt',
          size: 10,
          type: 'text/plain',
          url: '/doc.txt',
        },
      ],
    };

    let savePromise: Promise<void> | undefined;

    await act(async () => {
      savePromise = result.current.saveDraft(payload, 'user-1');
    });

    expect(result.current.isSaving).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('email_drafts');
    expect(insertBuilder.insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      account_id: 'account-1',
      ...payload,
    });
    expect(insertBuilder.select).toHaveBeenCalledWith();
    expect(insertBuilder.maybeSingle).toHaveBeenCalled();

    if (resolveInsert) {
      resolveInsert({ data: INSERT_RESULT, error: null });
    }

    await act(async () => {
      await savePromise;
    });

    await waitFor(() => {
      expect(result.current.isSaving).toBe(false);
      expect(result.current.draftId).toBe('draft-1');
    });
  });

  it('met à jour un brouillon existant puis peut le supprimer avec le bon id', async () => {
    const insertBuilder = createBuilder();
    insertBuilder.maybeSingle.mockResolvedValue({ data: INSERT_RESULT, error: null });

    const updateBuilder = createBuilder();
    updateBuilder.thenResult = { data: null, error: null };

    const deleteBuilder = createBuilder();
    deleteBuilder.thenResult = { data: null, error: null };

    mockFrom
      .mockImplementationOnce(() => insertBuilder)
      .mockImplementationOnce(() => updateBuilder)
      .mockImplementationOnce(() => deleteBuilder);

    const wrapper = createWrapper();
    const { result } = renderHook(() => useEmailDraft('account-1'), { wrapper });

    const initialPayload = {
      to_addresses: 'first@example.com',
      cc_addresses: '',
      bcc_addresses: '',
      subject: 'Premier',
      body: 'Brouillon initial',
      attachments: [],
    };

    await act(async () => {
      await result.current.saveDraft(initialPayload, 'user-1');
    });

    expect(result.current.draftId).toBe('draft-1');

    const updatedPayload = {
      to_addresses: 'updated@example.com',
      cc_addresses: 'copy@example.com',
      bcc_addresses: '',
      subject: 'Sujet mis à jour',
      body: 'Texte modifié',
      attachments: [
        {
          name: 'image.png',
          size: 55,
          type: 'image/png',
        },
      ],
    };

    await act(async () => {
      await result.current.saveDraft(updatedPayload, 'user-1');
    });

    expect(updateBuilder.update).toHaveBeenCalledWith({
      user_id: 'user-1',
      account_id: 'account-1',
      ...updatedPayload,
    });
    expect(updateBuilder.eq).toHaveBeenCalledWith('id', 'draft-1');

    await act(async () => {
      await result.current.deleteDraft();
    });

    expect(deleteBuilder.delete).toHaveBeenCalled();
    expect(deleteBuilder.eq).toHaveBeenCalledWith('id', 'draft-1');
    expect(result.current.draftId).toBe(null);
  });

  it('charge un brouillon existant avec les champs attendus', async () => {
    const loadBuilder = createBuilder();
    loadBuilder.maybeSingle.mockResolvedValue({ data: LOAD_RESULT, error: null });

    mockFrom.mockImplementation((table: string) => {
      expect(table).toBe('email_drafts');
      return loadBuilder;
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useEmailDraft('account-1'), { wrapper });

    let loaded: Awaited<ReturnType<typeof result.current.loadDraft>> | null = null;

    await act(async () => {
      loaded = await result.current.loadDraft('draft-42');
    });

    expect(loadBuilder.select).toHaveBeenCalledWith(
      'id, user_id, account_id, to_addresses, cc_addresses, bcc_addresses, subject, body, attachments, created_at, updated_at',
    );
    expect(loadBuilder.eq).toHaveBeenCalledWith('id', 'draft-42');
    expect(loadBuilder.maybeSingle).toHaveBeenCalled();

    expect(loaded).toEqual(LOAD_RESULT);
    expect(loaded?.subject).toBe('Hello');
    expect(loaded?.attachments).toEqual([
      {
        name: 'file.pdf',
        size: 1234,
        type: 'application/pdf',
        url: '/file.pdf',
      },
    ]);
  });

  it('ne sauvegarde pas si les champs sont vides ou sans userId', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useEmailDraft('account-1'), { wrapper });

    await act(async () => {
      await result.current.saveDraft(
        {
          to_addresses: '',
          cc_addresses: '',
          bcc_addresses: '',
          subject: '',
          body: '',
          attachments: [],
        },
        'user-1',
      );
    });

    await act(async () => {
      await result.current.saveDraft(
        {
          to_addresses: 'x@example.com',
          cc_addresses: '',
          bcc_addresses: '',
          subject: '',
          body: '',
          attachments: [],
        },
        undefined,
      );
    });

    expect(mockFrom).not.toHaveBeenCalled();
    expect(result.current.isSaving).toBe(false);
    expect(result.current.draftId).toBe(null);
  });

  it('gère une erreur pendant saveDraft en repassant isSaving à false et journalise l’erreur', async () => {
    const failingBuilder = createBuilder();
    const thrownError = new Error('insert failed');
    failingBuilder.maybeSingle.mockRejectedValue(thrownError);

    mockFrom.mockImplementation(() => failingBuilder);

    const wrapper = createWrapper();
    const { result } = renderHook(() => useEmailDraft('account-1'), { wrapper });

    await act(async () => {
      await result.current.saveDraft(
        {
          to_addresses: 'err@example.com',
          cc_addresses: '',
          bcc_addresses: '',
          subject: 'Erreur',
          body: 'Test',
          attachments: [],
        },
        'user-1',
      );
    });

    expect(failingBuilder.insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      account_id: 'account-1',
      to_addresses: 'err@example.com',
      cc_addresses: '',
      bcc_addresses: '',
      subject: 'Erreur',
      body: 'Test',
      attachments: [],
    });
    expect(mockDebugError).toHaveBeenCalledWith('Auto-save error:', thrownError);
    expect(result.current.isSaving).toBe(false);
    expect(result.current.draftId).toBe(null);
  });

  it('retourne null quand loadDraft reçoit { data: null, error }', async () => {
    const loadBuilder = createBuilder();
    loadBuilder.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'x' },
    });

    mockFrom.mockImplementation(() => loadBuilder);

    const wrapper = createWrapper();
    const { result } = renderHook(() => useEmailDraft('account-1'), { wrapper });

    let loaded: Awaited<ReturnType<typeof result.current.loadDraft>> | null = LOAD_RESULT;

    await act(async () => {
      loaded = await result.current.loadDraft('missing-id');
    });

    expect(loadBuilder.eq).toHaveBeenCalledWith('id', 'missing-id');
    expect(loaded).toBe(null);
  });
});