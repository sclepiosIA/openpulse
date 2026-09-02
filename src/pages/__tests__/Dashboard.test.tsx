import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '../Dashboard';

// Mock role permissions
const mockPermissions = vi.fn();
vi.mock('@/hooks/auth/useRolePermissions', () => ({
  useRolePermissions: () => mockPermissions(),
}));

// Mock dashboard components
vi.mock('@/components/dashboard/DirectionDashboard', () => ({
  DirectionDashboard: () => <div data-testid="direction-dashboard">Direction</div>,
}));
vi.mock('@/components/dashboard/TechniqueDashboard', () => ({
  TechniqueDashboard: () => <div data-testid="technique-dashboard">Technique</div>,
}));
vi.mock('@/components/dashboard/CSMDashboard', () => ({
  CSMDashboard: () => <div data-testid="csm-dashboard">CSM</div>,
}));
vi.mock('@/components/dashboard/CommercialDashboard', () => ({
  CommercialDashboard: () => <div data-testid="commercial-dashboard">Commercial</div>,
}));

vi.mock('@/lib/debug', () => ({
  debug: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
}));

const createWrapper = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
};

describe('Dashboard', () => {
  it('renders DirectionDashboard for direction team', async () => {
    mockPermissions.mockReturnValue({ team: 'direction', isLoading: false });
    render(<Dashboard />, { wrapper: createWrapper() });
    expect(await screen.findByTestId('direction-dashboard')).toBeInTheDocument();
  });

  it('renders TechniqueDashboard for technique team', async () => {
    mockPermissions.mockReturnValue({ team: 'technique', isLoading: false });
    render(<Dashboard />, { wrapper: createWrapper() });
    expect(await screen.findByTestId('technique-dashboard')).toBeInTheDocument();
  });

  it('renders CSMDashboard for csm team', async () => {
    mockPermissions.mockReturnValue({ team: 'csm', isLoading: false });
    render(<Dashboard />, { wrapper: createWrapper() });
    expect(await screen.findByTestId('csm-dashboard')).toBeInTheDocument();
  });

  it('renders CommercialDashboard for commercial team', async () => {
    mockPermissions.mockReturnValue({ team: 'commercial', isLoading: false });
    render(<Dashboard />, { wrapper: createWrapper() });
    expect(await screen.findByTestId('commercial-dashboard')).toBeInTheDocument();
  });

  it('defaults to DirectionDashboard for unknown team', () => {
    mockPermissions.mockReturnValue({ team: 'unknown', role: 'unknown' });
    render(<Dashboard />, { wrapper: createWrapper() });
    expect(screen.getAllByTestId('direction-dashboard').length).toBeGreaterThan(0);
  });

  it('renders direction dashboard when team is null', () => {
    mockPermissions.mockReturnValue({ team: null, role: null });
    render(<Dashboard />, { wrapper: createWrapper() });
    expect(screen.getAllByTestId('direction-dashboard').length).toBeGreaterThan(0);
  });
});
