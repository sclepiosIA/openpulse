const { toastMock, uploadMock, getPublicUrlMock, removeMock, eqMock, fromExtendedMock, debugErrorMock, sanitizeMock } = vi.hoisted(() => {
  const toastMock = vi.fn();
  const uploadMock = vi.fn(async (fileName: string, file: File, opts?: unknown) => {
    return { data: { path: fileName }, error: null };
  });
  const getPublicUrlMock = vi.fn((fileName: string) => {
    return { data: { publicUrl: `https://cdn.example.com/${fileName}` } };
  });
  const removeMock = vi.fn(async (paths: string[]) => ({ data: {}, error: null }));
  const eqMock = vi.fn(async (col: string, val: string) => ({ error: null }));
  const fromExtendedMock = vi.fn(() => ({
    insert: (data: unknown) => ({
      select: () => ({
        single: async () => ({ data: { id: 'media-1' }, error: null }),
      }),
    }),
  }));
  const debugErrorMock = { error: vi.fn() };
  const sanitizeMock = vi.fn((err: unknown) => (err && typeof err === 'object' && 'message' in (err as any) ? (err as any).message : 'sanitized'));
  return { toastMock, uploadMock, getPublicUrlMock, removeMock, eqMock, fromExtendedMock, debugErrorMock, sanitizeMock };
});

vi.mock('@/integrations/supabase/client', () => {
  return {
    supabase: {
      storage: {
        from: (bucket: string) => ({
          upload: uploadMock,
          getPublicUrl: getPublicUrlMock,
          remove: removeMock,
        }),
      },
      from: (table: string) => ({
        delete: () => ({
          eq: eqMock,
        }),
      }),
    },
  };
});

vi.mock('@/lib/supabaseTyped', () => {
  return {
    fromExtended: fromExtendedMock,
  };
});

vi.mock('@/hooks/shared/use-toast', () => {
  return {
    useToast: () => ({ toast: toastMock }),
  };
});

vi.mock('@/lib/debug', () => {
  return {
    debug: debugErrorMock,
  };
});

vi.mock('@/lib/supabaseErrorSanitizer', () => {
  return {
    sanitizeSupabaseError: sanitizeMock,
  };
});

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePulseMedia } from './usePulseMedia';

const createWrapper = () => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  return ({ children }: { children: React.ReactNode }) => React.createElement(QueryClientProvider, { client }, children);
};

describe('usePulseMedia', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // restore default successful implementations
    fromExtendedMock.mockImplementation(() => ({
      insert: (data: unknown) => ({
        select: () => ({
          single: async () => ({ data: { id: 'media-1' }, error: null }),
        }),
      }),
    }));
    eqMock.mockImplementation(async (col: string, val: string) => ({ error: null }));
    uploadMock.mockImplementation(async (fileName: string, file: File) => ({ data: { path: fileName }, error: null }));
    getPublicUrlMock.mockImplementation((fileName: string) => ({ data: { publicUrl: `https://cdn.example.com/${fileName}` } }));
    removeMock.mockImplementation(async (paths: string[]) => ({ data: {}, error: null }));
    toastMock.mockClear();
    debugErrorMock.error.mockClear();
    sanitizeMock.mockClear();
  });

  it('exposes initial state and constants', () => {
    const { result } = renderHook(() => usePulseMedia('conv1'), { wrapper: createWrapper() });
    expect(result.current.isUploading).toBe(false);
    expect(result.current.uploadProgress).toBe(0);
    expect(result.current.maxFileSize).toBe(50 * 1024 * 1024);
    expect(Array.isArray(result.current.allowedTypes)).toBe(true);
    expect(result.current.allowedTypes).toContain('image/jpeg');
    expect(result.current.allowedTypes).toContain('video/mp4');
  });

  it('uploads a file successfully and creates DB record', async () => {
    const { result } = renderHook(() => usePulseMedia('conv1'), { wrapper: createWrapper() });

    const file = new File(['abc'], 'pic.png', { type: 'image/png' });
    let returned: Awaited<ReturnType<typeof result.current.uploadFile>> | null = null;

    await act(async () => {
      returned = await result.current.uploadFile(file, 'msg1');
    });

    // Return value assertions
    expect(returned).not.toBeNull();
    expect(returned?.id).toBe('media-1');
    expect(returned?.file_name).toBe('pic.png');
    expect(returned?.file_type).toBe('image');
    expect(returned?.size_bytes).toBe(file.size);
    expect(returned?.mime_type).toBe('image/png');
    expect(typeof returned?.file_url).toBe('string');
    expect(returned?.file_url).toContain('https://cdn.example.com/');

    // Storage upload called with generated path and the same file object
    expect(uploadMock).toHaveBeenCalled();
    const uploadCallArgs = uploadMock.mock.calls[0];
    const generatedPath = uploadCallArgs[0] as string;
    const uploadedFile = uploadCallArgs[1] as File;
    expect(generatedPath).toContain('conv1');
    expect(generatedPath).toContain('msg1');
    expect(generatedPath.endsWith('.png')).toBe(true);
    expect(uploadedFile).toBe(file);

    // Public URL retrieved
    expect(getPublicUrlMock).toHaveBeenCalled();
    const publicUrlCallArg = getPublicUrlMock.mock.calls[0][0] as string;
    expect(publicUrlCallArg).toBe(generatedPath);

    // DB insert called via fromExtended
    expect(fromExtendedMock).toHaveBeenCalledWith('pulse_media');
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Fichier uploadé', description: 'pic.png' }));
  });

  it('returns null and shows destructive toast when file is too large', async () => {
    const { result } = renderHook(() => usePulseMedia('conv-large'), { wrapper: createWrapper() });

    // Create a file larger than MAX_FILE_SIZE (50MB)
    const bigSize = 50 * 1024 * 1024 + 1;
    const bigFile = new File(['a'], 'big.bin', { type: 'application/octet-stream' }) as File & { size: number };
    Object.defineProperty(bigFile, 'size', { value: bigSize });

    let res: unknown = undefined;
    await act(async () => {
      // @ts-expect-error intentionally manipulating File.size
      res = await result.current.uploadFile(bigFile as unknown as File, 'msg-big');
    });

    expect(res).toBeNull();
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Fichier trop volumineux', variant: 'destructive' }));
    // Ensure no upload attempt was made
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it('handles DB insert error during upload and returns null', async () => {
    // Make fromExtended return an error once
    fromExtendedMock.mockImplementationOnce(() => ({
      insert: (data: unknown) => ({
        select: () => ({
          single: async () => ({ data: null, error: { message: 'db insert failed' } }),
        }),
      }),
    }));

    const { result } = renderHook(() => usePulseMedia('conv2'), { wrapper: createWrapper() });

    const file = new File(['xyz'], 'doc.pdf', { type: 'application/pdf' });

    let out: unknown = undefined;
    await act(async () => {
      out = await result.current.uploadFile(file, 'msg-db-error');
    });

    expect(out).toBeNull();
    // debug.error should have been called
    expect(debugErrorMock.error).toHaveBeenCalled();
    // sanitizeSupabaseError used when showing toast
    expect(sanitizeMock).toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Erreur d'upload", variant: 'destructive' }));
  });

  it('deletes file successfully and removes DB record', async () => {
    const { result } = renderHook(() => usePulseMedia('conv3'), { wrapper: createWrapper() });

    await act(async () => {
      const ok = await result.current.deleteFile('media-1', 'conv3/msg3/file.png');
      expect(ok).toBe(true);
    });

    // Storage remove called with the path provided
    expect(removeMock).toHaveBeenCalledWith(['conv3/msg3/file.png']);

    // DB delete chain called: eqMock should have been called with id and media id
    expect(eqMock).toHaveBeenCalled();
    const eqArgs = eqMock.mock.calls[0];
    expect(eqArgs[0]).toBe('id');
    expect(eqArgs[1]).toBe('media-1');

    // Success toast
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Fichier supprimé' }));
  });

  it('returns false and shows destructive toast when delete DB returns error', async () => {
    // Make the eq call return an error for the next call
    eqMock.mockImplementationOnce(async (col: string, val: string) => ({ error: { message: 'delete failed' } }));

    const { result } = renderHook(() => usePulseMedia('conv4'), { wrapper: createWrapper() });

    let ok = true;
    await act(async () => {
      ok = await result.current.deleteFile('media-2', 'conv4/msg4/file2.png');
    });

    expect(ok).toBe(false);
    expect(debugErrorMock.error).toHaveBeenCalled();
    expect(sanitizeMock).toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erreur de suppression', variant: 'destructive' }));
  });
});