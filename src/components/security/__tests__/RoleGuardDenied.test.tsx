import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/hooks/auth/useRolePermissions', () => ({
  useRolePermissions: () => ({
    isLoading: false,
    isAdmin: false,
  }),
}));

import { RoleGuard } from '../RoleGuard';

describe('RoleGuard denied', () => {
  it('shows access denied when permission is not met', () => {
    render(
      <RoleGuard requiredPermission="isAdmin" showFallback>
        <div>Secret</div>
      </RoleGuard>
    );
    expect(screen.queryByText('Secret')).not.toBeInTheDocument();
    expect(screen.getByText(/Accès restreint/i)).toBeInTheDocument();
  });

  it('returns null when showFallback is false', () => {
    const { container } = render(
      <RoleGuard requiredPermission="isAdmin" showFallback={false}>
        <div>Secret</div>
      </RoleGuard>
    );
    expect(container.firstChild).toBeNull();
  });
});
