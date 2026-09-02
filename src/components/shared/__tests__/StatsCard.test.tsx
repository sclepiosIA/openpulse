import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StatsCard } from '@/components/shared/StatsCard';
import { Users } from 'lucide-react';

// Mock useRolePermissions
vi.mock('@/hooks/auth/useRolePermissions', () => ({
  useRolePermissions: () => ({
    isAdmin: true,
    canViewFinancials: true,
    canEditSalaries: true,
    canExportPayroll: true,
  }),
}));

describe('StatsCard', () => {
  it('should render title and value', () => {
    render(<StatsCard title="Total Users" value={42} icon={Users} />);
    expect(screen.getByText('Total Users')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('should render subtitle', () => {
    render(<StatsCard title="Users" value={10} icon={Users} subtitle="Active users" />);
    expect(screen.getByText('Active users')).toBeInTheDocument();
  });

  it('should render positive trend', () => {
    render(<StatsCard title="Revenue" value="10k" icon={Users} trend={{ value: 12, isPositive: true }} />);
    expect(screen.getByText('12%')).toBeInTheDocument();
  });

  it('should render negative trend', () => {
    render(<StatsCard title="Churn" value="5%" icon={Users} trend={{ value: 3, isPositive: false }} />);
    expect(screen.getByText('3%')).toBeInTheDocument();
  });

  it('should call onClick when clickable', () => {
    const onClick = vi.fn();
    render(<StatsCard title="Click me" value={0} icon={Users} onClick={onClick} />);
    fireEvent.click(screen.getByText('Click me').closest('[class*="card"]')!);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('should render string value', () => {
    render(<StatsCard title="Status" value="Active" icon={Users} />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });
});
