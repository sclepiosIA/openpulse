import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const createWrapper = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc },
      React.createElement(MemoryRouter, null, children)
    );
};

vi.mock('@/lib/debug', () => ({
  debug: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
}));

const mockPermissions = {
  isLoading: false,
  isAdmin: true,
  role: 'admin',
  team: 'direction' as const,
  canManageUsers: true,
  canViewTresorerie: true,
  canViewRH: true,
  canManageRHData: true,
  canViewEmails: true,
};

vi.mock('@/hooks/auth/useRolePermissions', () => ({
  useRolePermissions: () => mockPermissions,
}));

vi.mock('@/components/dashboard/DirectionDashboard', () => ({
  DirectionDashboard: () => React.createElement('div', null, 'DirectionDashboard'),
}));
vi.mock('@/components/dashboard/TechniqueDashboard', () => ({
  TechniqueDashboard: () => React.createElement('div', null, 'TechniqueDashboard'),
}));
vi.mock('@/components/dashboard/CSMDashboard', () => ({
  CSMDashboard: () => React.createElement('div', null, 'CSMDashboard'),
}));
vi.mock('@/components/dashboard/CommercialDashboard', () => ({
  CommercialDashboard: () => React.createElement('div', null, 'CommercialDashboard'),
}));

describe('Dashboard Page Router', () => {
  const renderDashboard = async () => {
    const Dashboard = (await import('@/pages/Dashboard')).default;
    return render(React.createElement(Dashboard), { wrapper: createWrapper() });
  };

  it('should render DirectionDashboard for direction team', async () => {
    mockPermissions.team = 'direction' as any;
    mockPermissions.role = 'direction' as any;
    await renderDashboard();
    expect(await screen.findByText('DirectionDashboard')).toBeInTheDocument();
  });

  it('should render TechniqueDashboard for technique team', async () => {
    mockPermissions.team = 'technique' as any;
    mockPermissions.role = 'chef_projet' as any;
    vi.resetModules();
    const Dashboard = (await import('@/pages/Dashboard')).default;
    render(React.createElement(Dashboard), { wrapper: createWrapper() });
    expect(await screen.findByText('TechniqueDashboard')).toBeInTheDocument();
  });

  it('should render CSMDashboard for csm team', async () => {
    mockPermissions.team = 'csm' as any;
    mockPermissions.role = 'csm' as any;
    vi.resetModules();
    const Dashboard = (await import('@/pages/Dashboard')).default;
    render(React.createElement(Dashboard), { wrapper: createWrapper() });
    expect(await screen.findByText('CSMDashboard')).toBeInTheDocument();
  });

  it('should render CommercialDashboard for commercial team', async () => {
    mockPermissions.team = 'commercial' as any;
    mockPermissions.role = 'commercial' as any;
    vi.resetModules();
    const Dashboard = (await import('@/pages/Dashboard')).default;
    render(React.createElement(Dashboard), { wrapper: createWrapper() });
    expect(await screen.findByText('CommercialDashboard')).toBeInTheDocument();
  });

  it('should default to DirectionDashboard for unknown team', async () => {
    mockPermissions.team = 'unknown' as any;
    mockPermissions.role = 'unknown' as any;
    vi.resetModules();
    const Dashboard = (await import('@/pages/Dashboard')).default;
    render(React.createElement(Dashboard), { wrapper: createWrapper() });
    expect(await screen.findByText('DirectionDashboard')).toBeInTheDocument();
  });
});
