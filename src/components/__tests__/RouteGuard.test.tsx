import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RouteGuard } from '../security/RouteGuard';
import React from 'react';

// Mock useRolePermissions
const mockPermissions = vi.fn();
vi.mock('@/hooks/auth/useRolePermissions', () => ({
  useRolePermissions: () => mockPermissions(),
}));

const basePermissions = {
  isLoading: false,
  isAdmin: false,
  role: 'commercial',
  team: 'commercial',
  canAccessAdmin: false,
  canViewSalaries: false,
  canViewTresorerie: false,
  canViewAllEtablissements: true,
};

function renderGuard(props: any, route = '/test') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/test" element={
          <RouteGuard {...props}>
            <div data-testid="guarded-content">Content</div>
          </RouteGuard>
        } />
        <Route path="/login" element={<div data-testid="login">Login</div>} />
        <Route path="/" element={<div data-testid="dashboard">Dashboard</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('RouteGuard', () => {
  it('shows loader when loading', () => {
    mockPermissions.mockReturnValue({ ...basePermissions, isLoading: true });
    renderGuard({});
    expect(screen.queryByTestId('guarded-content')).not.toBeInTheDocument();
  });

  it('renders children when authorized', () => {
    mockPermissions.mockReturnValue(basePermissions);
    renderGuard({});
    expect(screen.getByTestId('guarded-content')).toBeInTheDocument();
  });

  it('blocks admin-only for non-admin', () => {
    mockPermissions.mockReturnValue(basePermissions);
    renderGuard({ adminOnly: true });
    expect(screen.queryByTestId('guarded-content')).not.toBeInTheDocument();
    expect(screen.getByText(/réservée aux administrateurs/)).toBeInTheDocument();
  });

  it('allows admin-only for admin', () => {
    mockPermissions.mockReturnValue({ ...basePermissions, isAdmin: true });
    renderGuard({ adminOnly: true });
    expect(screen.getByTestId('guarded-content')).toBeInTheDocument();
  });

  it('blocks strict admin-only for inherited direction admins', () => {
    mockPermissions.mockReturnValue({ ...basePermissions, isAdmin: true, role: 'direction', team: 'direction' });
    renderGuard({ strictAdminOnly: true });
    expect(screen.queryByTestId('guarded-content')).not.toBeInTheDocument();
    expect(screen.getByText(/administrateurs système/)).toBeInTheDocument();
  });

  it('allows strict admin-only only for the admin role', () => {
    mockPermissions.mockReturnValue({ ...basePermissions, isAdmin: true, role: 'admin', team: 'direction' });
    renderGuard({ strictAdminOnly: true });
    expect(screen.getByTestId('guarded-content')).toBeInTheDocument();
  });

  it('blocks by required permission', () => {
    mockPermissions.mockReturnValue(basePermissions);
    renderGuard({ requiredPermission: 'canViewSalaries' });
    expect(screen.queryByTestId('guarded-content')).not.toBeInTheDocument();
    expect(screen.getByText(/permissions nécessaires/)).toBeInTheDocument();
  });

  it('allows by required permission when granted', () => {
    mockPermissions.mockReturnValue({ ...basePermissions, canViewSalaries: true });
    renderGuard({ requiredPermission: 'canViewSalaries' });
    expect(screen.getByTestId('guarded-content')).toBeInTheDocument();
  });

  it('redirects when redirectTo is set', () => {
    mockPermissions.mockReturnValue(basePermissions);
    renderGuard({ adminOnly: true, redirectTo: '/login' });
    expect(screen.getByTestId('login')).toBeInTheDocument();
  });

  it('admin bypasses team restrictions', () => {
    mockPermissions.mockReturnValue({ ...basePermissions, isAdmin: true, team: 'direction' });
    renderGuard({ allowedTeams: ['csm'] });
    expect(screen.getByTestId('guarded-content')).toBeInTheDocument();
  });

  it('blocks wrong team', () => {
    mockPermissions.mockReturnValue({ ...basePermissions, team: 'commercial' });
    renderGuard({ allowedTeams: ['csm'] });
    expect(screen.queryByTestId('guarded-content')).not.toBeInTheDocument();
  });

  it('gives disallowed roles priority over admin bypass', () => {
    mockPermissions.mockReturnValue({ ...basePermissions, isAdmin: true, role: 'direction', team: 'direction' });
    renderGuard({ allowedTeams: ['direction'], disallowedRoles: ['direction'] });
    expect(screen.queryByTestId('guarded-content')).not.toBeInTheDocument();
    expect(screen.getByText(/rôle n'a pas accès/)).toBeInTheDocument();
  });
});
