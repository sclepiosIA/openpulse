// @vitest-environment jsdom

import React from 'react';
import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query';
import { renderHook, act, waitFor } from '@testing-library/react';
import { uploadPublicFile, removeStorageFile } from './publicUploads';

const {
  UPLOAD_DATA,
  PUBLIC_URL_DATA,
  REMOVE_DATA,
  uploadMock,
  getPublicUrlMock,
  removeMock,
  storageFromMock,
  stableSupabase,
} = vi.hoisted(() => {
  const UPLOAD_DATA = { path: 'avatars/u1/photo.png' };
  const PUBLIC_URL_DATA = {
    publicUrl: 'https://cdn.test.local/storage/v1/object/public/avatars/u1/photo.png',
  };
  const REMOVE_DATA: [] = [];

  const uploadMock = vi.fn();
  const getPublicUrlMock = vi.fn();
  const removeMock = vi.fn();
  const storageFromMock = vi.fn();

  const stableSupabase = {
    storage: {
      from: storageFromMock,
    },
  };

  return {
    UPLOAD_DATA,
    PUBLIC_URL_DATA,
    REMOVE_DATA,
    uploadMock,
    getPublicUrlMock,
    removeMock,
    storageFromMock,
    stableSupabase,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: stableSupabase,
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

function setupStorageBuilder() {
  const builder = {
    upload: uploadMock,
    getPublicUrl: getPublicUrlMock,
    remove: removeMock,
  };

  storageFromMock.mockReturnValue(builder);
  return builder;
}

describe('publicUploads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStorageBuilder();
  });

  describe('uploadPublicFile', () => {
    it('uploads a file with default options and returns the uploaded path with its public URL', async () => {
      uploadMock.mockResolvedValue({ data: UPLOAD_DATA, error: null });
      getPublicUrlMock.mockReturnValue({ data: PUBLIC_URL_DATA });

      const file = new File(['hello'], 'photo.png', { type: 'image/png' });

      const result = await uploadPublicFile('avatars', 'u1/photo.png', file);

      expect(storageFromMock).toHaveBeenCalledTimes(2);
      expect(storageFromMock).toHaveBeenNthCalledWith(1, 'avatars');
      expect(storageFromMock).toHaveBeenNthCalledWith(2, 'avatars');
      expect(uploadMock).toHaveBeenCalledWith('u1/photo.png', file, {
        upsert: false,
      });
      expect(getPublicUrlMock).toHaveBeenCalledWith('avatars/u1/photo.png');
      expect(result).toEqual({
        path: 'avatars/u1/photo.png',
        publicUrl: 'https://cdn.test.local/storage/v1/object/public/avatars/u1/photo.png',
      });
    });

    it('forwards explicit upsert and contentType options to storage upload', async () => {
      uploadMock.mockResolvedValue({ data: UPLOAD_DATA, error: null });
      getPublicUrlMock.mockReturnValue({ data: PUBLIC_URL_DATA });

      const blob = new Blob(['pdf'], { type: 'application/pdf' });

      const result = await uploadPublicFile('docs', 'reports/r1.pdf', blob, {
        upsert: true,
        contentType: 'application/pdf',
      });

      expect(uploadMock).toHaveBeenCalledWith('reports/r1.pdf', blob, {
        upsert: true,
        contentType: 'application/pdf',
      });
      expect(result.path).toBe('avatars/u1/photo.png');
      expect(result.publicUrl).toBe('https://cdn.test.local/storage/v1/object/public/avatars/u1/photo.png');
    });

    it('throws when storage upload returns an error and does not request a public URL', async () => {
      uploadMock.mockResolvedValue({
        data: null,
        error: { message: 'upload failed' },
      });

      await expect(
        uploadPublicFile('avatars', 'u1/bad.png', new Blob(['x'])),
      ).rejects.toEqual({ message: 'upload failed' });

      expect(storageFromMock).toHaveBeenCalledWith('avatars');
      expect(uploadMock).toHaveBeenCalledOnce();
      expect(getPublicUrlMock).not.toHaveBeenCalled();
    });

    it('can be triggered from a mutation hook and transitions from idle to success', async () => {
      uploadMock.mockResolvedValue({ data: UPLOAD_DATA, error: null });
      getPublicUrlMock.mockReturnValue({ data: PUBLIC_URL_DATA });

      const file = new File(['img'], 'avatar.png', { type: 'image/png' });
      const wrapper = createWrapper();

      const { result } = renderHook(
        () =>
          useMutation({
            mutationFn: (vars: {
              bucket: string;
              path: string;
              file: File | Blob;
              options?: { upsert?: boolean; contentType?: string };
            }) => uploadPublicFile(vars.bucket, vars.path, vars.file, vars.options),
          }),
        { wrapper },
      );

      expect(result.current.isIdle).toBe(true);
      expect(result.current.isPending).toBe(false);

      await act(async () => {
        await result.current.mutateAsync({
          bucket: 'avatars',
          path: 'u1/avatar.png',
          file,
          options: { upsert: true, contentType: 'image/png' },
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(uploadMock).toHaveBeenCalledWith('u1/avatar.png', file, {
        upsert: true,
        contentType: 'image/png',
      });
      expect(result.current.data).toEqual({
        path: 'avatars/u1/photo.png',
        publicUrl: 'https://cdn.test.local/storage/v1/object/public/avatars/u1/photo.png',
      });
    });

    it('can be triggered from a mutation hook and exposes an error state when upload fails', async () => {
      uploadMock.mockResolvedValue({
        data: null,
        error: { message: 'x' },
      });

      const wrapper = createWrapper();

      const { result } = renderHook(
        () =>
          useMutation({
            mutationFn: () => uploadPublicFile('avatars', 'u1/avatar.png', new Blob(['x'])),
          }),
        { wrapper },
      );

      expect(result.current.isIdle).toBe(true);

      await act(async () => {
        await expect(result.current.mutateAsync()).rejects.toEqual({ message: 'x' });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual({ message: 'x' });
      expect(getPublicUrlMock).not.toHaveBeenCalled();
    });
  });

  describe('removeStorageFile', () => {
    it('removes the provided path from the specified bucket', async () => {
      removeMock.mockResolvedValue({ data: REMOVE_DATA, error: null });

      await removeStorageFile('avatars', 'u1/photo.png');

      expect(storageFromMock).toHaveBeenCalledWith('avatars');
      expect(removeMock).toHaveBeenCalledWith(['u1/photo.png']);
    });

    it('can be executed from a mutation hook and calls remove with the expected payload', async () => {
      removeMock.mockResolvedValue({ data: REMOVE_DATA, error: null });

      const wrapper = createWrapper();

      const { result } = renderHook(
        () =>
          useMutation({
            mutationFn: (vars: { bucket: string; path: string }) =>
              removeStorageFile(vars.bucket, vars.path),
          }),
        { wrapper },
      );

      expect(result.current.isIdle).toBe(true);

      await act(async () => {
        await result.current.mutateAsync({
          bucket: 'docs',
          path: 'reports/r1.pdf',
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(storageFromMock).toHaveBeenCalledWith('docs');
      expect(removeMock).toHaveBeenCalledWith(['reports/r1.pdf']);
      expect(result.current.data).toBeUndefined();
    });
  });
});