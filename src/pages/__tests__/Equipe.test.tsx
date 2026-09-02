import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));
vi.mock('@/hooks/auth/useRolePermissions', () => ({
  useRolePermissions: () => ({
    isLoading: false, isAdmin: true, canManageRH: true,
    canViewSalary: true, canManageUsers: true,
  }),
}));
vi.mock('@/hooks/profile/useProfilesWithRoles', () => ({
  useProfilesWithRoles: () => ({ data: [], isLoading: false }),
}));
vi.mock('@/hooks/crm/useEtablissements', () => ({
  useEtablissements: () => ({ data: [], isLoading: false }),
}));
vi.mock('@/hooks/hr/useTeamStats', () => ({
  useTeamStats: () => ({
    data: { totalMembers: 0, activeMembers: 0, admins: 0, roles: {} },
    isLoading: false,
  }),
}));
vi.mock('@/hooks/hr/useTeamFilters', () => ({
  useTeamFilters: () => ({
    filters: { search: '', role: 'all', status: 'all' },
    setFilters: vi.fn(),
    resetFilters: vi.fn(),
  }),
}));
vi.mock('@/lib/teamUtils', () => ({
  filterAndSortProfiles: (profiles: any[]) => profiles,
}));
vi.mock('@/components/equipe/TeamStatsOverview', () => ({
  TeamStatsOverview: () => <div data-testid="stats" />,
}));
vi.mock('@/components/equipe/TeamFiltersBar', () => ({
  TeamFiltersBar: () => <div />,
}));
vi.mock('@/components/equipe/TeamMemberCard', () => ({
  TeamMemberCard: () => <div />,
}));
vi.mock('@/components/equipe/TeamTableView', () => ({
  TeamTableView: () => <div />,
}));
vi.mock('@/components/equipe/TeamMemberDetailDialog', () => ({
  TeamMemberDetailDialog: () => null,
}));
vi.mock('@/components/admin/SetupTeamButton', () => ({
  SetupTeamButton: () => null,
}));
vi.mock('@/components/security/PermissionBanner', () => ({
  PermissionBanner: () => null,
}));
vi.mock('@/components/shared/UnifiedCalendar', () => ({
  UnifiedCalendar: () => <div />,
}));
vi.mock('@/components/shared/UniversalSearchBar', () => ({
  UniversalSearchBar: () => null,
}));
vi.mock('@/components/shared/KeyboardShortcutsHelp', () => ({
  KeyboardShortcutsHelp: () => null,
}));

import Equipe from '../Equipe';

describe('Equipe page', () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  it('renders without crashing', () => {
    const { container } = render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <Equipe />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(container.firstElementChild).toBeTruthy();
  });
});
