import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

const mockPermissions = {
  isLoading: false,
  isAdmin: false,
  role: 'user',
  team: 'commercial',
  canManageUsers: false,
  canViewTresorerie: true,
  canViewRH: false,
  canManageRHData: false,
  canViewEmails: true,
};

vi.mock('@/hooks/auth/useRolePermissions', () => ({
  useRolePermissions: () => mockPermissions,
}));

describe('RoleGuard', () => {
  const renderGuard = async (props: any) => {
    const { RoleGuard } = await import('@/components/security/RoleGuard');
    return render(
      React.createElement(RoleGuard, props,
        React.createElement('div', null, 'Protected Content')
      )
    );
  };

  it('should render children when no permission required', async () => {
    await renderGuard({});
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('should render children when permission is granted', async () => {
    await renderGuard({ requiredPermission: 'canViewTresorerie' });
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('should show access denied when permission is missing', async () => {
    await renderGuard({ requiredPermission: 'canManageUsers' });
    expect(screen.getByText('Accès restreint')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('should return null when showFallback is false and permission denied', async () => {
    const { container } = await renderGuard({
      requiredPermission: 'canManageUsers',
      showFallback: false,
    });
    expect(container.innerHTML).toBe('');
  });

  it('should render custom fallback when provided', async () => {
    await renderGuard({
      requiredPermission: 'canManageUsers',
      fallback: React.createElement('div', null, 'Custom Fallback'),
    });
    expect(screen.getByText('Custom Fallback')).toBeInTheDocument();
  });

  it('should show loading skeleton when permissions loading', async () => {
    mockPermissions.isLoading = true;
    const { container } = await renderGuard({});
    // Skeleton uses shimmer animation class
    expect(container.querySelectorAll('[class*="shimmer"], [class*="muted"]').length).toBeGreaterThan(0);
    mockPermissions.isLoading = false;
  });

  it('should show permission info in access denied card', async () => {
    mockPermissions.isLoading = false;
    vi.resetModules();
    const { RoleGuard } = await import('@/components/security/RoleGuard');
    render(
      // @ts-ignore - testing without children
      React.createElement(RoleGuard, { requiredPermission: 'canManageUsers' },
        React.createElement('div', null, 'Nope')
      )
    );
    expect(screen.getByText(/Permission requise/)).toBeInTheDocument();
    expect(screen.getByText(/contactez un administrateur/)).toBeInTheDocument();
  });
});
