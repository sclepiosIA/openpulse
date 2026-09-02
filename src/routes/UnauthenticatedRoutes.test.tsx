import React from 'react';
import { render, screen, renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const {
  AUTH_TEXT,
  HEALTH_TEXT,
  SAFE_TEXT,
  LOADER_TEXT,
  makeAuthSuspend,
  resolveAuth,
  makeHealthSuspend,
  resolveHealth,
  makeSafeSuspend,
  resolveSafe,
} = vi.hoisted(() => {
  const AUTH_TEXT = 'Auth Page';
  const HEALTH_TEXT = 'Health Check';
  const SAFE_TEXT = 'Safe Shell';
  const LOADER_TEXT = 'Loading...';

  let resolveAuth!: () => void;
  let resolveHealth!: () => void;
  let resolveSafe!: () => void;

  const authPromise = new Promise<void>((res) => {
    resolveAuth = res;
  });
  const healthPromise = new Promise<void>((res) => {
    resolveHealth = res;
  });
  const safePromise = new Promise<void>((res) => {
    resolveSafe = res;
  });

  let authPending = true;
  let healthPending = true;
  let safePending = true;

  const makeAuthSuspend = () => {
    if (authPending) {
      authPending = false;
      throw authPromise;
    }
  };
  const makeHealthSuspend = () => {
    if (healthPending) {
      healthPending = false;
      throw healthPromise;
    }
  };
  const makeSafeSuspend = () => {
    if (safePending) {
      safePending = false;
      throw safePromise;
    }
  };

  return {
    AUTH_TEXT,
    HEALTH_TEXT,
    SAFE_TEXT,
    LOADER_TEXT,
    makeAuthSuspend,
    resolveAuth,
    makeHealthSuspend,
    resolveHealth,
    makeSafeSuspend,
    resolveSafe,
  };
});

vi.mock('@/components/ui/full-page-loader', () => {
  return {
    FullPageLoader: () => <div data-testid="full-loader">{LOADER_TEXT}</div>,
  };
});

vi.mock('./lazyPages', () => {
  const Auth = () => {
    makeAuthSuspend();
    return <div>{AUTH_TEXT}</div>;
  };
  const HealthCheck = () => {
    makeHealthSuspend();
    return <div>{HEALTH_TEXT}</div>;
  };
  const SafeShell = () => {
    makeSafeSuspend();
    return <div>{SAFE_TEXT}</div>;
  };
  return { Auth, HealthCheck, SafeShell };
});

import { UnauthenticatedRoutes } from './UnauthenticatedRoutes';

describe('UnauthenticatedRoutes', () => {
  it('affiche le FullPageLoader pendant le suspense puis rend Auth', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <UnauthenticatedRoutes authPath="/auth" />
      </MemoryRouter>
    );
    expect(screen.getByTestId('full-loader')).toBeInTheDocument();
    act(() => {
      resolveAuth();
    });
    expect(await screen.findByText(AUTH_TEXT)).toBeInTheDocument();
    expect(screen.queryByTestId('full-loader')).toBeNull();
  });

  it('rend Auth sur la route "/"', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <UnauthenticatedRoutes authPath="/auth" />
      </MemoryRouter>
    );
    expect(await screen.findByText(AUTH_TEXT)).toBeInTheDocument();
  });

  it('rend Auth sur la route "/auth"', async () => {
    render(
      <MemoryRouter initialEntries={['/auth']}>
        <UnauthenticatedRoutes authPath="/auth" />
      </MemoryRouter>
    );
    expect(await screen.findByText(AUTH_TEXT)).toBeInTheDocument();
  });

  it('rend HealthCheck sur la route "/__health"', async () => {
    render(
      <MemoryRouter initialEntries={['/__health']}>
        <UnauthenticatedRoutes authPath="/auth" />
      </MemoryRouter>
    );
    expect(screen.getByTestId('full-loader')).toBeInTheDocument();
    act(() => {
      resolveHealth();
    });
    expect(await screen.findByText(HEALTH_TEXT)).toBeInTheDocument();
  });

  it('rend SafeShell sur la route "/__safe"', async () => {
    render(
      <MemoryRouter initialEntries={['/__safe']}>
        <UnauthenticatedRoutes authPath="/auth" />
      </MemoryRouter>
    );
    expect(screen.getByTestId('full-loader')).toBeInTheDocument();
    act(() => {
      resolveSafe();
    });
    expect(await screen.findByText(SAFE_TEXT)).toBeInTheDocument();
  });

  it('redirige une route inconnue vers authPath', async () => {
    render(
      <MemoryRouter initialEntries={['/inconnue']}>
        <UnauthenticatedRoutes authPath="/auth" />
      </MemoryRouter>
    );
    expect(await screen.findByText(AUTH_TEXT)).toBeInTheDocument();
  });
});

describe('QueryClientProvider wrapper (configuration requise)', () => {
  const createWrapper = () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    });
    const Wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    return Wrapper;
  };

  it('utilise un QueryClientProvider valide pour renderHook', () => {
    const { result } = renderHook(() => 42, { wrapper: createWrapper() });
    expect(result.current).toBe(42);
  });
});