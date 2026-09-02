/* @vitest-environment jsdom */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { useCurrentPWAApp } from './useCurrentPWAApp';

const { locationState } = vi.hoisted(() => ({
  locationState: {
    pathname: '/',
  },
}));

vi.mock('react-router-dom', () => ({
  useLocation: () => locationState,
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

describe('useCurrentPWAApp', () => {
  beforeEach(() => {
    locationState.pathname = '/';
  });

  it('retourne mail pour une route mobile /m/mail', () => {
    locationState.pathname = '/m/mail/inbox';

    const { result } = renderHook(() => useCurrentPWAApp(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBe('mail');
  });

  it('retourne pulse pour une route desktop /pulse', () => {
    locationState.pathname = '/pulse/dashboard';

    const { result } = renderHook(() => useCurrentPWAApp(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBe('pulse');
  });

  it('retourne todos pour une route /todos', () => {
    locationState.pathname = '/todos/list';

    const { result } = renderHook(() => useCurrentPWAApp(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBe('todos');
  });

  it('retourne calendar pour une route /calendrier', () => {
    locationState.pathname = '/calendrier/month';

    const { result } = renderHook(() => useCurrentPWAApp(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBe('calendar');
  });

  it('retourne jarvis pour une route mobile /m/jarvis', () => {
    locationState.pathname = '/m/jarvis/chat';

    const { result } = renderHook(() => useCurrentPWAApp(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBe('jarvis');
  });

  it('retourne main pour une route authentifiée non mappée', () => {
    locationState.pathname = '/settings/profile';

    const { result } = renderHook(() => useCurrentPWAApp(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBe('main');
  });

  it('retourne main pour la racine /', () => {
    locationState.pathname = '/';

    const { result } = renderHook(() => useCurrentPWAApp(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBe('main');
  });

  it('retourne main pour /auth', () => {
    locationState.pathname = '/auth';

    const { result } = renderHook(() => useCurrentPWAApp(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBe('main');
  });

  it('met à jour la valeur quand pathname change', () => {
    locationState.pathname = '/m/mail';

    const { result, rerender } = renderHook(() => useCurrentPWAApp(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBe('mail');

    locationState.pathname = '/m/pulse';
    rerender();

    expect(result.current).toBe('pulse');

    locationState.pathname = '/unknown';
    rerender();

    expect(result.current).toBe('main');
  });

  it('privilégie le préfixe exact de route PWA avant le fallback main', () => {
    locationState.pathname = '/emails/thread/1';

    const { result } = renderHook(() => useCurrentPWAApp(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBe('mail');
  });
});