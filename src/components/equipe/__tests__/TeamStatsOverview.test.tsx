import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/hooks/hr/useTeamStats', () => ({
  useTeamOverviewStats: () => ({
    data: {
      totalMembers: 12,
      activeMembers: 10,
      avgCompletionRate: 78,
      totalTasks: 45,
      tasksOverdueTotal: 3,
      totalProjects: 8,
    },
    isLoading: false,
  }),
}));

vi.mock('@/hooks/auth/useRolePermissions', () => ({
  useRolePermissions: () => ({
    permissions: { canViewAllTeamMembers: true, canViewTeamStats: true },
    hasPermission: (p: string) => true,
  }),
}));

import { TeamStatsOverview } from '../TeamStatsOverview';

describe('TeamStatsOverview', () => {
  it('renders stat card titles', () => {
    render(<TeamStatsOverview />);
    expect(screen.getByText('Total équipe')).toBeInTheDocument();
    expect(screen.getByText('Taux de complétion')).toBeInTheDocument();
    expect(screen.getByText('Tâches en retard')).toBeInTheDocument();
    expect(screen.getByText('Projets actifs')).toBeInTheDocument();
  });

  it('renders overdue tasks value (no permission required)', () => {
    render(<TeamStatsOverview />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders projects value (no permission required)', () => {
    render(<TeamStatsOverview />);
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('renders 4 stat cards', () => {
    const { container } = render(<TeamStatsOverview />);
    const cards = container.querySelectorAll('.rounded-xl.bg-card');
    expect(cards).toHaveLength(4);
  });
});
