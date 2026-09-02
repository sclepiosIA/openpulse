/* @vitest-environment jsdom */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useEmailAttachments } from './useEmailAttachments';

const {
  ATTACHMENTS,
  DOWNLOAD_RESPONSE,
  SIGNED_URL,
  AUTH_STATE,
  toastSpy,
  sanitizeSpy,
  mockFrom,
  mockInvoke,
  mockStorageFrom,
  mockCreateSignedUrl,
  invalidateQueriesSpy,
  queryState,
  builderState,
} = vi.hoisted(() => ({
  ATTACHMENTS: [
    {
      id: 'att-1',
      message_id: 'msg-1',
      filename: 'a.pdf',
      mime_type: 'application/pdf',
      size_bytes: 123,
      storage_bucket: 'email-attachments',
      storage_path: 'msg-1/a.pdf',
      downloaded: false,
      imap_part_id: '1',
      created_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'att-2',
      message_id: 'msg-1',
      filename: 'b.png',
      mime_type: 'image/png',
      size_bytes: 456,
      storage_bucket: 'email-attachments',
      storage_path: 'msg-1/b.png',
      downloaded: true,
      imap_part_id: '2',
      created_at: '2024-01-02T00:00:00Z',
    },
  ],
  DOWNLOAD_RESPONSE: {
    filename: 'a.pdf',
    status: 'downloaded',
  },
  SIGNED_URL: 'https://local.test/signed/a.pdf',
  AUTH_STATE: {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  toastSpy: vi.fn(),
  sanitizeSpy: vi.fn(),
  mockFrom: vi.fn(),
  mockInvoke: vi.fn(),
  mockStorageFrom: vi.fn(),
  mockCreateSignedUrl: vi.fn(),
  invalidateQueriesSpy: vi.fn(),
  queryState: {
    selectResult: {
      data: [] as Array<{
        id: string;
        message_id: string;
        filename: string;
        mime_type: string;
        size_bytes: number;
        storage_bucket: string;
        storage_path: string;
        downloaded: boolean;
        imap_part_id: string;
        created_at: string;
      }> | null,
      error: null as null | { message: string },
    },
    invokeResult: {
      data: { filename: 'a.pdf', status: 'downloaded' } as { filename: string; status: string } | null,
      error: null as null | { message: string },
    },
    signedUrlResult: {
      data: { signedUrl: 'https://local.test/signed/a.pdf' } as { signedUrl?: string },
    },
  },
  builderState: {
    lastBuilder: null as null | ReturnType<typeof vi.fn>,
  },
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({
    toast: toastSpy,
  }),
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: sanitizeSpy,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    functions: {
      invoke: mockInvoke,
    },
    storage: {
      from: mockStorageFrom,
    },
  },
}));

function createThenableBuilder() {
  const builder = {
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
    single: vi.fn(),
    maybeSingle: vi.fn(),
    then<TResult1 = unknown, TResult2 = never>(
      onfulfilled?: ((value: typeof queryState.selectResult) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ) {
      return Promise.resolve(queryState.selectResult).then(onfulfilled, onrejected);
    },
    catch<TResult = never>(
      onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null
    ) {
      return Promise.resolve(queryState.selectResult).catch(onrejected);
    },
  };

  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.gte.mockReturnValue(builder);
  builder.lte.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  builder.insert.mockReturnValue(builder);
  builder.update.mockReturnValue(builder);
  builder.delete.mockReturnValue(builder);
  builder.single.mockResolvedValue(queryState.selectResult);
  builder.maybeSingle.mockResolvedValue(queryState.selectResult);

  return builder;
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  const originalInvalidate = queryClient.invalidateQueries.bind(queryClient);
  vi.spyOn(queryClient, 'invalidateQueries').mockImplementation((filters) => {
    invalidateQueriesSpy(filters);
    return originalInvalidate(filters);
  });

  return function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children);
  };
}

describe('useEmailAttachments', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    queryState.selectResult = { data: ATTACHMENTS, error: null };
    queryState.invokeResult = { data: DOWNLOAD_RESPONSE, error: null };
    queryState.signedUrlResult = { data: { signedUrl: SIGNED_URL } };

    mockFrom.mockImplementation(() => {
      const builder = createThenableBuilder();
      builderState.lastBuilder = builder.select;
      return builder;
    });
    mockInvoke.mockImplementation(() => Promise.resolve(queryState.invokeResult));
    mockCreateSignedUrl.mockImplementation(() => Promise.resolve(queryState.signedUrlResult));
    mockStorageFrom.mockImplementation(() => ({
      createSignedUrl: mockCreateSignedUrl,
    }));
    sanitizeSpy.mockImplementation((error: { message?: string }) => error.message ?? 'unknown error');
  });

  it('charge les pièces jointes puis expose les valeurs métier attendues', async () => {
    const { result } = renderHook(() => useEmailAttachments('msg-1'), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.attachments).toEqual([]);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFrom).toHaveBeenCalledWith('email_attachments');

    const builder = mockFrom.mock.results[0]?.value as ReturnType<typeof createThenableBuilder>;
    expect(builder.select).toHaveBeenCalledWith(
      'id, message_id, filename, mime_type, size_bytes, storage_bucket, storage_path, downloaded, imap_part_id, created_at'
    );
    expect(builder.eq).toHaveBeenCalledWith('message_id', 'msg-1');
    expect(builder.order).toHaveBeenCalledWith('filename');

    expect(result.current.attachments).toHaveLength(2);
    expect(result.current.attachments[0]).toMatchObject({
      id: 'att-1',
      filename: 'a.pdf',
      mime_type: 'application/pdf',
      size_bytes: 123,
      downloaded: false,
      storage_path: 'msg-1/a.pdf',
    });
    expect(result.current.attachments[1]).toMatchObject({
      id: 'att-2',
      filename: 'b.png',
      mime_type: 'image/png',
      size_bytes: 456,
      downloaded: true,
      storage_bucket: 'email-attachments',
    });
    expect(result.current.isDownloading).toBe(false);
  });

  it('gère une erreur de chargement en exposant une liste vide', async () => {
    queryState.selectResult = { data: null, error: { message: 'load failed' } };

    const { result } = renderHook(() => useEmailAttachments('msg-1'), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.attachments).toEqual([]);
    expect(mockFrom).toHaveBeenCalledWith('email_attachments');
  });

  it('déclenche le téléchargement avec le bon payload, invalide la query et affiche un toast de succès', async () => {
    const { result } = renderHook(() => useEmailAttachments('msg-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      result.current.downloadAttachment('att-1');
    });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('download-attachment', {
        body: { attachment_id: 'att-1' },
      });
    });

    expect(toastSpy).toHaveBeenCalledWith({
      title: 'Pièce jointe téléchargée',
      description: 'a.pdf est maintenant disponible',
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ['email-attachments', 'msg-1'],
    });
  });

  it('gère une erreur de téléchargement avec sanitation et toast destructif', async () => {
    queryState.invokeResult = { data: null, error: { message: 'download failed' } };
    sanitizeSpy.mockReturnValue('Erreur lisible');

    const { result } = renderHook(() => useEmailAttachments('msg-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      result.current.downloadAttachment('att-1');
    });

    await waitFor(() => {
      expect(sanitizeSpy).toHaveBeenCalledWith({ message: 'download failed' });
    });

    expect(toastSpy).toHaveBeenCalledWith({
      title: 'Erreur de téléchargement',
      description: 'Erreur lisible',
      variant: 'destructive',
    });
  });

  it('retourne une signed url depuis le storage', async () => {
    const { result } = renderHook(() => useEmailAttachments('msg-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let url: string | undefined;
    await act(async () => {
      url = await result.current.getAttachmentUrl('msg-1/a.pdf');
    });

    expect(mockStorageFrom).toHaveBeenCalledWith('email-attachments');
    expect(mockCreateSignedUrl).toHaveBeenCalledWith('msg-1/a.pdf', 3600);
    expect(url).toBe(SIGNED_URL);
  });

  it('ne lance pas la query sans messageId et garde les valeurs par défaut', async () => {
    const { result } = renderHook(() => useEmailAttachments(''), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFrom).not.toHaveBeenCalled();
    expect(result.current.attachments).toEqual([]);
    expect(result.current.isDownloading).toBe(false);
  });
});