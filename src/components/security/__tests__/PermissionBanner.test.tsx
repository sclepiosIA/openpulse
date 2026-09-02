import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PermissionBanner } from '../PermissionBanner';

vi.mock('@/hooks/auth/useRolePermissions', () => ({
  useRolePermissions: vi.fn(() => ({
    isLoading: false,
    isAdmin: false,
    role: 'csm',
    viewScope: 'managed',
  })),
}));

import { useRolePermissions } from '@/hooks/auth/useRolePermissions';
const mockPerms = useRolePermissions as any;

describe('PermissionBanner', () => {
  it('shows managed scope message by default', () => {
    render(<PermissionBanner />);
    expect(screen.getByText(/liées à vos projets/)).toBeInTheDocument();
  });

  it('shows readonly message for readonly type', () => {
    mockPerms.mockReturnValue({ isLoading: false, role: 'user', viewScope: 'all' });
    render(<PermissionBanner type="readonly" />);
    expect(screen.getByText('Lecture seule')).toBeInTheDocument();
    expect(screen.getByText(/consulter ces données/)).toBeInTheDocument();
    mockPerms.mockReturnValue({ isLoading: false, role: 'csm', viewScope: 'managed' });
  });

  it('shows restricted message', () => {
    mockPerms.mockReturnValue({ isLoading: false, role: 'user', viewScope: 'all' });
    render(<PermissionBanner type="restricted" />);
    expect(screen.getByText('Accès limité')).toBeInTheDocument();
    mockPerms.mockReturnValue({ isLoading: false, role: 'csm', viewScope: 'managed' });
  });

  it('shows custom message', () => {
    render(<PermissionBanner message="Custom msg" />);
    expect(screen.getByText('Custom msg')).toBeInTheDocument();
  });

  it('shows role badge', () => {
    render(<PermissionBanner />);
    expect(screen.getByText('csm')).toBeInTheDocument();
  });

  it('renders nothing when no message applies', () => {
    mockPerms.mockReturnValue({ isLoading: false, role: null, viewScope: 'all' });
    const { container } = render(<PermissionBanner type="info" />);
    expect(container.innerHTML).toBe('');
    mockPerms.mockReturnValue({ isLoading: false, role: 'csm', viewScope: 'managed' });
  });
});
