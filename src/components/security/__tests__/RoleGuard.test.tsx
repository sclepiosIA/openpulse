import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RoleGuard } from '../RoleGuard';

vi.mock('@/hooks/auth/useRolePermissions', () => ({
  useRolePermissions: vi.fn(() => ({
    isLoading: false,
    isAdmin: false,
    canViewSalaries: false,
    canViewAllEmails: true,
    canEditEtablissements: false,
    role: 'user',
    viewScope: 'all',
  })),
}));

import { useRolePermissions } from '@/hooks/auth/useRolePermissions';
const mockUseRolePermissions = useRolePermissions as any;

describe('RoleGuard', () => {
  it('renders children when no permission required', () => {
    render(<RoleGuard><div>Content</div></RoleGuard>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('renders children when permission is granted', () => {
    render(<RoleGuard requiredPermission="canViewAllEmails"><div>Email Content</div></RoleGuard>);
    expect(screen.getByText('Email Content')).toBeInTheDocument();
  });

  it('shows access denied when permission not granted', () => {
    render(<RoleGuard requiredPermission="canViewSalaries"><div>RH Content</div></RoleGuard>);
    expect(screen.getByText('Accès restreint')).toBeInTheDocument();
    expect(screen.queryByText('RH Content')).toBeNull();
  });

  it('renders custom fallback', () => {
    render(
      <RoleGuard requiredPermission="canViewSalaries" fallback={<div>Custom Fallback</div>}>
        <div>RH Content</div>
      </RoleGuard>
    );
    expect(screen.getByText('Custom Fallback')).toBeInTheDocument();
  });

  it('renders nothing when showFallback is false', () => {
    const { container } = render(
      <RoleGuard requiredPermission="canViewSalaries" showFallback={false}>
        <div>RH Content</div>
      </RoleGuard>
    );
    expect(container.innerHTML).toBe('');
  });

  it('shows loading state when loading', () => {
    mockUseRolePermissions.mockReturnValue({ isLoading: true });
    const { container } = render(<RoleGuard><div>Content</div></RoleGuard>);
    // Loading state renders a Card with Skeletons, not the children
    expect(screen.queryByText('Content')).toBeNull();
    expect(container.firstElementChild).toBeTruthy();
    mockUseRolePermissions.mockReturnValue({
      isLoading: false, isAdmin: false, canViewSalaries: false, canViewAllEmails: true,
      canEditEtablissements: false, role: 'user', viewScope: 'all',
    });
  });
});
