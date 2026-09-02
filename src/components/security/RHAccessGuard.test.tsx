// @vitest-environment jsdom

import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RHAccessGuard } from './RHAccessGuard';

const { roleGuardSpy, stableAuth, navigateSpy } = vi.hoisted(() => ({
  roleGuardSpy: vi.fn(
    ({
      children,
      requiredPermission,
      showFallback,
    }: {
      children: React.ReactNode;
      requiredPermission: string;
      showFallback?: boolean;
    }) => (
      <div
        data-testid="role-guard"
        data-required-permission={requiredPermission}
        data-show-fallback={String(showFallback)}
      >
        {children}
      </div>
    )
  ),
  stableAuth: {
    user: { id: 'u1', email: 'user@test.local' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  navigateSpy: vi.fn(),
}));

vi.mock('./RoleGuard', () => ({
  RoleGuard: roleGuardSpy,
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => stableAuth,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => stableAuth,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => stableAuth,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateSpy,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('RHAccessGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('transmet la permission requise et showFallback=true par défaut à RoleGuard', () => {
    const Wrapper = createWrapper();

    render(
      <RHAccessGuard requiredPermission="canViewSalaries">
        <span>Contenu RH</span>
      </RHAccessGuard>,
      { wrapper: Wrapper }
    );

    expect(roleGuardSpy).toHaveBeenCalledTimes(1);

    const firstCall = roleGuardSpy.mock.calls[0];
    expect(firstCall).toBeTruthy();

    const props = firstCall[0] as {
      requiredPermission: string;
      showFallback?: boolean;
      children: React.ReactNode;
    };

    expect(props.requiredPermission).toBe('canViewSalaries');
    expect(props.showFallback).toBe(true);
    expect(props.children).toBeTruthy();

    expect(screen.getByTestId('role-guard')).toHaveAttribute(
      'data-required-permission',
      'canViewSalaries'
    );
    expect(screen.getByTestId('role-guard')).toHaveAttribute('data-show-fallback', 'true');
    expect(screen.getByText('Contenu RH')).toBeInTheDocument();
  });

  it('transmet showFallback=false quand fourni explicitement', () => {
    const Wrapper = createWrapper();

    render(
      <RHAccessGuard requiredPermission="canExportPayroll" showFallback={false}>
        <button>Exporter</button>
      </RHAccessGuard>,
      { wrapper: Wrapper }
    );

    expect(roleGuardSpy).toHaveBeenCalledTimes(1);

    const firstCall = roleGuardSpy.mock.calls[0];
    expect(firstCall).toBeTruthy();

    const props = firstCall[0] as {
      requiredPermission: string;
      showFallback?: boolean;
      children: React.ReactNode;
    };

    expect(props.requiredPermission).toBe('canExportPayroll');
    expect(props.showFallback).toBe(false);

    expect(screen.getByTestId('role-guard')).toHaveAttribute(
      'data-required-permission',
      'canExportPayroll'
    );
    expect(screen.getByTestId('role-guard')).toHaveAttribute('data-show-fallback', 'false');
    expect(screen.getByRole('button', { name: 'Exporter' })).toBeInTheDocument();
  });

  it('rend correctement avec une autre permission RH métier', () => {
    const Wrapper = createWrapper();

    render(
      <RHAccessGuard requiredPermission="canManageAbsences">
        <div>Gestion des absences</div>
      </RHAccessGuard>,
      { wrapper: Wrapper }
    );

    expect(roleGuardSpy).toHaveBeenCalledTimes(1);

    const firstCall = roleGuardSpy.mock.calls[0];
    expect(firstCall).toBeTruthy();

    const props = firstCall[0] as {
      requiredPermission: string;
      showFallback?: boolean;
      children: React.ReactNode;
    };

    expect(props.requiredPermission).toBe('canManageAbsences');
    expect(props.showFallback).toBe(true);

    expect(screen.getByTestId('role-guard')).toHaveAttribute(
      'data-required-permission',
      'canManageAbsences'
    );
    expect(screen.getByTestId('role-guard')).toHaveAttribute('data-show-fallback', 'true');
    expect(screen.getByText('Gestion des absences')).toBeInTheDocument();
  });
});