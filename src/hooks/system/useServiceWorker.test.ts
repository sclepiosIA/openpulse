import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { mockUnregister, mockOtherUnregister, mockGetRegistrations, mockCachesKeys, mockCachesDelete } = vi.hoisted(() => {
  const mockUnregister = vi.fn(() => Promise.resolve(true));
  const mockOtherUnregister = vi.fn(() => Promise.resolve(true));
  const mockGetRegistrations = vi.fn(() => Promise.resolve([
    { active: { scriptURL: 'https://example.test/sw.js' }, unregister: mockUnregister },
    { active: { scriptURL: 'https://example.test/firebase-messaging-sw.js' }, unregister: mockOtherUnregister },
  ]));
  const mockCachesKeys = vi.fn(() => Promise.resolve(['html-cache', 'firebase-messaging-cache', 'scripts-cache']));
  const mockCachesDelete = vi.fn(() => Promise.resolve(true));
  return { mockUnregister, mockOtherUnregister, mockGetRegistrations, mockCachesKeys, mockCachesDelete };
});

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 0 }, mutations: { retry: 0 } } });
  return React.createElement(QueryClientProvider, { client: queryClient }, children);
}

function setUrl(url: string) {
  Object.defineProperty(window, 'location', { value: new URL(url), configurable: true, writable: true });
}

describe('useServiceWorker kill-switch wrapper', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    setUrl('https://example.test/');
    Object.defineProperty(window, 'self', { value: window, configurable: true });
    Object.defineProperty(window, 'top', { value: window, configurable: true });
    Object.defineProperty(navigator, 'serviceWorker', { value: { getRegistrations: mockGetRegistrations }, configurable: true });
    Object.defineProperty(window, 'caches', { value: { keys: mockCachesKeys, delete: mockCachesDelete }, configurable: true });
    vi.stubGlobal('__NO_SW__', undefined);
  });

  it('ne signale jamais de mise à jour app-shell et nettoie en dev/preview', async () => {
    const { useServiceWorker } = await import('./useServiceWorker');
    const { result } = renderHook(() => useServiceWorker(), { wrapper });

    expect(result.current.needRefresh).toBe(false);
    expect(result.current.offlineReady).toBe(false);
    expect(result.current.updateServiceWorker()).toBeUndefined();
    await waitFor(() => expect(mockGetRegistrations).toHaveBeenCalledTimes(1));
  });

  it('nettoie seulement les anciens app-shell SW/caches en preview ou kill-switch', async () => {
    setUrl('https://id-preview--abc.apercu.example.org/?sw=off');
    const { useServiceWorker } = await import('./useServiceWorker');
    renderHook(() => useServiceWorker(), { wrapper });

    await waitFor(() => {
      expect(mockGetRegistrations).toHaveBeenCalledTimes(1);
      expect(mockUnregister).toHaveBeenCalledTimes(1);
      expect(mockOtherUnregister).not.toHaveBeenCalled();
      expect(mockCachesDelete).toHaveBeenCalledWith('html-cache');
      expect(mockCachesDelete).toHaveBeenCalledWith('scripts-cache');
    });
    expect(mockCachesDelete).not.toHaveBeenCalledWith('firebase-messaging-cache');
  });
});