// @vitest-environment jsdom

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { useThreadImages, useMessageAttachments } from './useThreadImages';

const {
  THREAD_ID,
  MESSAGE_ID,
  MESSAGE_ROWS,
  IMAGE_ATTACHMENTS_ROWS,
  MESSAGE_ATTACHMENTS_ROWS,
  SIGNED_URLS,
  EMPTY_ROWS,
  authState,
  debugLog,
  mockFrom,
  mockStorageFrom,
  mockCreateSignedUrl,
} = vi.hoisted(() => ({
  THREAD_ID: 'thread-1',
  MESSAGE_ID: 'msg-1',
  MESSAGE_ROWS: [{ id: 'msg-1' }, { id: 'msg-2' }],
  IMAGE_ATTACHMENTS_ROWS: [
    {
      id: 'att-1',
      message_id: 'msg-1',
      filename: 'photo.png',
      mime_type: 'image/png',
      size_bytes: 123,
      storage_bucket: 'email-attachments',
      storage_path: 'images/photo.png',
      created_at: '2024-01-02T10:00:00Z',
    },
    {
      id: 'att-2',
      message_id: 'msg-2',
      filename: 'diagram.jpg',
      mime_type: 'image/jpeg',
      size_bytes: 456,
      storage_bucket: 'email-attachments',
      storage_path: 'images/diagram.jpg',
      created_at: '2024-01-01T10:00:00Z',
    },
  ],
  MESSAGE_ATTACHMENTS_ROWS: [
    {
      id: 'ma-1',
      message_id: 'msg-1',
      filename: 'image001.png',
      mime_type: 'image/png',
      size_bytes: 100,
      storage_bucket: 'email-attachments',
      storage_path: 'inline/image001.png',
      created_at: '2024-01-01T08:00:00Z',
    },
    {
      id: 'ma-2',
      message_id: 'msg-1',
      filename: 'report-final.pdf',
      mime_type: 'application/pdf',
      size_bytes: 200,
      storage_bucket: 'email-attachments',
      storage_path: 'docs/report-final.pdf',
      created_at: '2024-01-01T09:00:00Z',
    },
    {
      id: 'ma-3',
      message_id: 'msg-1',
      filename: 'abc123-asset.jpeg',
      mime_type: 'image/jpeg',
      size_bytes: 300,
      storage_bucket: 'email-attachments',
      storage_path: 'cid/abc123-asset.jpeg',
      created_at: '2024-01-01T10:00:00Z',
    },
  ],
  SIGNED_URLS: {
    'images/photo.png': 'https://local/photo',
    'images/diagram.jpg': null,
    'inline/image001.png': 'https://local/image001',
    'docs/report-final.pdf': 'https://local/report',
    'cid/abc123-asset.jpeg': 'https://local/abc123',
  } as Record<string, string | null>,
  EMPTY_ROWS: [],
  authState: {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  debugLog: vi.fn(),
  mockFrom: vi.fn(),
  mockStorageFrom: vi.fn(),
  mockCreateSignedUrl: vi.fn(),
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    log: debugLog,
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => authState,
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => authState,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    storage: {
      from: mockStorageFrom,
    },
  },
}));

type QueryResult<T> = {
  data: T;
  error: { message: string } | null;
};

function createThenableBuilder<T>(result: QueryResult<T>) {
  const promise = Promise.resolve(result);

  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    like: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    single: vi.fn(() => promise),
    maybeSingle: vi.fn(() => promise),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
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

describe('useThreadImages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('charge les images du thread, génère les signed urls et filtre celles sans url', async () => {
    const messagesBuilder = createThenableBuilder({
      data: MESSAGE_ROWS,
      error: null,
    });
    const attachmentsBuilder = createThenableBuilder({
      data: IMAGE_ATTACHMENTS_ROWS,
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'email_messages') return messagesBuilder;
      if (table === 'email_attachments') return attachmentsBuilder;
      throw new Error(`unexpected table ${table}`);
    });

    mockCreateSignedUrl.mockImplementation((path: string) =>
      Promise.resolve({
        data: { signedUrl: SIGNED_URLS[path] ?? null },
      })
    );

    mockStorageFrom.mockReturnValue({
      createSignedUrl: mockCreateSignedUrl,
    });

    const { result } = renderHook(() => useThreadImages(THREAD_ID), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.images).toEqual([]);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFrom).toHaveBeenNthCalledWith(1, 'email_messages');
    expect(messagesBuilder.select).toHaveBeenCalledWith('id');
    expect(messagesBuilder.eq).toHaveBeenCalledWith('thread_id', THREAD_ID);

    expect(mockFrom).toHaveBeenNthCalledWith(2, 'email_attachments');
    expect(attachmentsBuilder.select).toHaveBeenCalledWith(
      'id, message_id, filename, mime_type, size_bytes, storage_bucket, storage_path, created_at'
    );
    expect(attachmentsBuilder.in).toHaveBeenCalledWith('message_id', ['msg-1', 'msg-2']);
    expect(attachmentsBuilder.like).toHaveBeenCalledWith('mime_type', 'image/%');
    expect(attachmentsBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(attachmentsBuilder.limit).toHaveBeenCalledWith(100);

    expect(mockStorageFrom).toHaveBeenCalledWith('email-attachments');
    expect(mockCreateSignedUrl).toHaveBeenCalledWith('images/photo.png', 3600);
    expect(mockCreateSignedUrl).toHaveBeenCalledWith('images/diagram.jpg', 3600);

    expect(result.current.images).toEqual([
      {
        id: 'att-1',
        message_id: 'msg-1',
        filename: 'photo.png',
        mime_type: 'image/png',
        size_bytes: 123,
        storage_bucket: 'email-attachments',
        storage_path: 'images/photo.png',
        created_at: '2024-01-02T10:00:00Z',
        url: 'https://local/photo',
      },
    ]);
  });

  it('retourne une liste vide quand threadId est absent sans appeler supabase', () => {
    const { result } = renderHook(() => useThreadImages(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.images).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockCreateSignedUrl).not.toHaveBeenCalled();
  });

  it('propage une erreur quand la récupération des messages échoue', async () => {
    const messagesBuilder = createThenableBuilder({
      data: null,
      error: { message: 'messages failed' },
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'email_messages') return messagesBuilder;
      throw new Error(`unexpected table ${table}`);
    });

    const { result } = renderHook(() => useThreadImages(THREAD_ID), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.images).toEqual([]);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.images).toEqual([]);
  });
});

describe('useMessageAttachments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('charge les pièces jointes, ajoute les urls et résout les CID selon plusieurs stratégies', async () => {
    const attachmentsBuilder = createThenableBuilder({
      data: MESSAGE_ATTACHMENTS_ROWS,
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'email_attachments') return attachmentsBuilder;
      throw new Error(`unexpected table ${table}`);
    });

    mockCreateSignedUrl.mockImplementation((path: string) =>
      Promise.resolve({
        data: { signedUrl: SIGNED_URLS[path] ?? null },
      })
    );

    mockStorageFrom.mockReturnValue({
      createSignedUrl: mockCreateSignedUrl,
    });

    const { result } = renderHook(() => useMessageAttachments(MESSAGE_ID), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.attachments).toEqual([]);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFrom).toHaveBeenCalledWith('email_attachments');
    expect(attachmentsBuilder.select).toHaveBeenCalledWith(
      'id, message_id, filename, mime_type, size_bytes, storage_bucket, storage_path, created_at'
    );
    expect(attachmentsBuilder.eq).toHaveBeenCalledWith('message_id', MESSAGE_ID);
    expect(attachmentsBuilder.order).toHaveBeenCalledWith('filename');
    expect(attachmentsBuilder.limit).toHaveBeenCalledWith(100);

    expect(result.current.attachments).toEqual([
      {
        ...MESSAGE_ATTACHMENTS_ROWS[0],
        url: 'https://local/image001',
      },
      {
        ...MESSAGE_ATTACHMENTS_ROWS[1],
        url: 'https://local/report',
      },
      {
        ...MESSAGE_ATTACHMENTS_ROWS[2],
        url: 'https://local/abc123',
      },
    ]);

    expect(result.current.resolveCid('image001.png')).toBe('https://local/image001');
    expect(result.current.resolveCid('<image001.png>')).toBe('https://local/image001');
    expect(result.current.resolveCid('abc123@example.com')).toBe('https://local/abc123');
    expect(result.current.resolveCid('abc123')).toBe('https://local/abc123');
    expect(result.current.resolveCid('unknown')).toBeNull();
  });

  it('retourne null et log en DEV quand resolveCid est appelé sans pièces jointes', async () => {
    const attachmentsBuilder = createThenableBuilder({
      data: EMPTY_ROWS,
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'email_attachments') return attachmentsBuilder;
      throw new Error(`unexpected table ${table}`);
    });

    mockStorageFrom.mockReturnValue({
      createSignedUrl: mockCreateSignedUrl,
    });

    const originalEnv = import.meta.env;

    vi.stubGlobal('import', {
      meta: { env: { ...originalEnv, DEV: true } },
    });

    const { result } = renderHook(() => useMessageAttachments(MESSAGE_ID), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.attachments).toEqual([]);
    expect(result.current.resolveCid('cid-value')).toBeNull();
    expect(debugLog).toHaveBeenCalledWith('CID resolution skipped - no attachments for:', 'cid-value');
  });

  it('propage une erreur quand la récupération des pièces jointes échoue', async () => {
    const attachmentsBuilder = createThenableBuilder({
      data: null,
      error: { message: 'attachments failed' },
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'email_attachments') return attachmentsBuilder;
      throw new Error(`unexpected table ${table}`);
    });

    const { result } = renderHook(() => useMessageAttachments(MESSAGE_ID), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.attachments).toEqual([]);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.attachments).toEqual([]);
  });

  it('utilise le fallback "une seule image" pour resolveCid', async () => {
    const singleImageRow = [
      {
        id: 'only-1',
        message_id: 'msg-only',
        filename: 'something.png',
        mime_type: 'image/png',
        size_bytes: 50,
        storage_bucket: 'email-attachments',
        storage_path: 'only/something.png',
        created_at: '2024-01-01T00:00:00Z',
      },
    ];

    const attachmentsBuilder = createThenableBuilder({
      data: singleImageRow,
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'email_attachments') return attachmentsBuilder;
      throw new Error(`unexpected table ${table}`);
    });

    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://local/only' },
    });

    mockStorageFrom.mockReturnValue({
      createSignedUrl: mockCreateSignedUrl,
    });

    const { result } = renderHook(() => useMessageAttachments('msg-only'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.resolveCid('does-not-match')).toBe('https://local/only');
  });
});