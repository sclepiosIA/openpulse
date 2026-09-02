import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import React from 'react';
import { useNextcloudFiles, useNextcloudStatus } from './useNextcloudFiles';

const { FILES, mockInvoke } = vi.hoisted(() => {
  const FILES = [
    { name: 'zeta.pdf', path: '/zeta.pdf', isDirectory: false },
    { name: 'Archives', path: '/Archives', isDirectory: true },
    { name: 'alpha.txt', path: '/alpha.txt', isDirectory: false },
    { name: 'Brouillons', path: '/Brouillons', isDirectory: true },
  ];
  return { FILES, mockInvoke: vi.fn() };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: mockInvoke },
  },
}));

vi.mock('@/lib/debug', () => ({
  debug: { error: vi.fn(), log: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useNextcloudFiles', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('démarre en isLoading puis retourne les fichiers triés (dossiers en premier, puis ordre alphabétique fr)', async () => {
    mockInvoke.mockResolvedValue({ data: FILES, error: null });

    const { result } = renderHook(() => useNextcloudFiles('/docs'), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const names = (result.current.data ?? []).map((f) => f.name);
    expect(names).toEqual(['Archives', 'Brouillons', 'alpha.txt', 'zeta.pdf']);

    expect(mockInvoke).toHaveBeenCalledWith('nextcloud-files', {
      body: { action: 'list', path: '/docs' },
    });
  });

  it('utilise "/" comme chemin par défaut', async () => {
    mockInvoke.mockResolvedValue({ data: [], error: null });

    const { result } = renderHook(() => useNextcloudFiles(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([]);
    expect(mockInvoke).toHaveBeenCalledWith('nextcloud-files', {
      body: { action: 'list', path: '/' },
    });
  });

  it('retourne un tableau vide si data est null', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useNextcloudFiles('/empty'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it("passe en isError lorsque l'invocation retourne une erreur (après le retry interne retry:1)", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'x' } });

    const { result } = renderHook(() => useNextcloudFiles('/fail'), {
      wrapper: createWrapper(),
    });

    // Le hook définit retry: 1 (qui prime sur retry: 0 du QueryClient),
    // avec un backoff par défaut d'environ 1s → on étend le timeout du waitFor.
    await waitFor(() => expect(result.current.isError).toBe(true), {
      timeout: 8000,
    });
    expect(result.current.data).toBeUndefined();
    // 1 tentative initiale + 1 retry
    expect(mockInvoke).toHaveBeenCalledTimes(2);
  }, 10000);

  it('passe en isError lorsque data contient un champ error (après le retry interne retry:1)', async () => {
    mockInvoke.mockResolvedValue({ data: { error: 'Accès refusé' }, error: null });

    const { result } = renderHook(() => useNextcloudFiles('/forbidden'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true), {
      timeout: 8000,
    });
    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toBe('Accès refusé');
    expect(mockInvoke).toHaveBeenCalledTimes(2);
  }, 10000);
});

describe('useNextcloudStatus', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('retourne configured=true et connected=true quand tout fonctionne', async () => {
    mockInvoke.mockResolvedValue({ data: FILES, error: null });

    const { result } = renderHook(() => useNextcloudStatus(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({ configured: true, connected: true });
    expect(mockInvoke).toHaveBeenCalledWith('nextcloud-files', {
      body: { action: 'list', path: '/' },
    });
  });

  it("retourne configured=false quand l'invocation échoue", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'x' } });

    const { result } = renderHook(() => useNextcloudStatus(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({
      configured: false,
      connected: false,
      error: 'x',
    });
  });

  it('retourne configured=false quand la configuration Nextcloud est manquante', async () => {
    mockInvoke.mockResolvedValue({
      data: { error: 'Configuration Nextcloud manquante' },
      error: null,
    });

    const { result } = renderHook(() => useNextcloudStatus(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({
      configured: false,
      connected: false,
      error: 'Configuration Nextcloud manquante',
    });
  });

  it('retourne configured=true mais connected=false pour une autre erreur applicative', async () => {
    mockInvoke.mockResolvedValue({ data: { error: 'Timeout serveur' }, error: null });

    const { result } = renderHook(() => useNextcloudStatus(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({
      configured: true,
      connected: false,
      error: 'Timeout serveur',
    });
  });

  it("retourne configured=false avec l'erreur sérialisée quand invoke lève une exception", async () => {
    mockInvoke.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useNextcloudStatus(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({
      configured: false,
      connected: false,
      error: 'Error: boom',
    });
  });
});