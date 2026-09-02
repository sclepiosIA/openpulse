// @vitest-environment jsdom
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { useRolePermissions, roleToTeam } from './useRolePermissions';

const { userRoleState } = vi.hoisted(() => ({
  userRoleState: {
    role: null as 'direction' | 'copil' | 'admin' | 'chef_projet' | 'csm' | 'commercial' | 'rh' | null,
    isAdmin: false,
    isLoading: false,
  },
}));

vi.mock('../shared/useUserRole', () => ({
  useUserRole: vi.fn(() => userRoleState),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children);
  };
}

describe('roleToTeam', () => {
  it('mappe correctement chaque rôle vers son équipe', () => {
    expect(roleToTeam.direction).toBe('direction');
    expect(roleToTeam.copil).toBe('direction');
    expect(roleToTeam.admin).toBe('direction');
    expect(roleToTeam.rh).toBe('direction');
    expect(roleToTeam.chef_projet).toBe('technique');
    expect(roleToTeam.csm).toBe('csm');
    expect(roleToTeam.commercial).toBe('commercial');
  });
});

describe('useRolePermissions', () => {
  beforeEach(() => {
    userRoleState.role = null;
    userRoleState.isAdmin = false;
    userRoleState.isLoading = false;
  });

  it('reflète l’état de chargement renvoyé par useUserRole', () => {
    userRoleState.isLoading = true;

    const { result } = renderHook(() => useRolePermissions(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.role).toBe(null);
    expect(result.current.team).toBe(null);
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.canViewSalaries).toBe(false);
    expect(result.current.canAccessAdmin).toBe(false);
    expect(result.current.viewScope).toBe('own');
  });

  it('donne tous les droits à un admin', () => {
    userRoleState.role = 'admin';
    userRoleState.isAdmin = true;

    const { result } = renderHook(() => useRolePermissions(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isAdmin).toBe(true);
    expect(result.current.role).toBe('admin');
    expect(result.current.team).toBe('direction');
    expect(result.current.viewScope).toBe('all');
    expect(result.current.etablissementScope).toBe('all');
    expect(result.current.isLoading).toBe(false);

    expect(result.current.canViewSalaries).toBe(true);
    expect(result.current.canEditSalaries).toBe(true);
    expect(result.current.canManageAbsences).toBe(true);
    expect(result.current.canViewAllTeamMembers).toBe(true);
    expect(result.current.canViewSensitiveTeamData).toBe(true);
    expect(result.current.canDeleteEtablissements).toBe(true);
    expect(result.current.canManageEmailDomains).toBe(true);
    expect(result.current.canEditTresorerie).toBe(true);
    expect(result.current.canManageRDProjects).toBe(true);
    expect(result.current.canManageTickets).toBe(true);
    expect(result.current.canAccessAdmin).toBe(true);
    expect(result.current.canManageUsers).toBe(true);
    expect(result.current.canViewSystemLogs).toBe(true);
    expect(result.current.canManageSecuritySettings).toBe(true);
  });

  it('applique les permissions métier du rôle copil', () => {
    userRoleState.role = 'copil';

    const { result } = renderHook(() => useRolePermissions(), {
      wrapper: createWrapper(),
    });

    expect(result.current.role).toBe('copil');
    expect(result.current.team).toBe('direction');
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.viewScope).toBe('all');
    expect(result.current.etablissementScope).toBe('all');

    expect(result.current.canViewSalaries).toBe(false);
    expect(result.current.canViewRHDocuments).toBe(false);
    expect(result.current.canViewAllTeamMembers).toBe(true);
    expect(result.current.canEditTeamMembers).toBe(false);
    expect(result.current.canViewAllEtablissements).toBe(true);
    expect(result.current.canEditEtablissements).toBe(true);
    expect(result.current.canDeleteEtablissements).toBe(false);
    expect(result.current.canViewAllEmails).toBe(true);
    expect(result.current.canManageEmailDomains).toBe(false);
    expect(result.current.canViewTresorerie).toBe(true);
    expect(result.current.canEditTresorerie).toBe(false);
    expect(result.current.canViewRD).toBe(true);
    expect(result.current.canManageRDProjects).toBe(false);
    expect(result.current.canViewAllTickets).toBe(true);
    expect(result.current.canManageTickets).toBe(true);
    expect(result.current.canAccessAdmin).toBe(false);
  });

  it('applique les permissions métier du rôle chef_projet', () => {
    userRoleState.role = 'chef_projet';

    const { result } = renderHook(() => useRolePermissions(), {
      wrapper: createWrapper(),
    });

    expect(result.current.role).toBe('chef_projet');
    expect(result.current.team).toBe('technique');
    expect(result.current.viewScope).toBe('all');
    expect(result.current.etablissementScope).toBe('deploiement');

    expect(result.current.canViewRHObjectifs).toBe(true);
    expect(result.current.canManageAbsences).toBe(false);
    expect(result.current.canViewAllTeamMembers).toBe(true);
    expect(result.current.canViewTeamStats).toBe(true);
    expect(result.current.canViewProspects).toBe(false);
    expect(result.current.canViewDeploiement).toBe(true);
    expect(result.current.canViewProduction).toBe(true);
    expect(result.current.canEditEtablissements).toBe(true);
    expect(result.current.canViewTresorerie).toBe(false);
    expect(result.current.canViewRD).toBe(true);
    expect(result.current.canManageRDProjects).toBe(true);
    expect(result.current.canManageSprints).toBe(true);
    expect(result.current.canManageTickets).toBe(true);
    expect(result.current.canAccessAdmin).toBe(false);
  });

  it('applique les permissions métier du rôle rh', () => {
    userRoleState.role = 'rh';

    const { result } = renderHook(() => useRolePermissions(), {
      wrapper: createWrapper(),
    });

    expect(result.current.role).toBe('rh');
    expect(result.current.team).toBe('direction');
    expect(result.current.viewScope).toBe('all');
    expect(result.current.etablissementScope).toBe('production');

    expect(result.current.canViewSalaries).toBe(true);
    expect(result.current.canEditSalaries).toBe(true);
    expect(result.current.canUploadRHDocuments).toBe(true);
    expect(result.current.canExportPayroll).toBe(true);
    expect(result.current.canViewSensitiveTeamData).toBe(true);
    expect(result.current.canViewProspects).toBe(false);
    expect(result.current.canViewProduction).toBe(true);
    expect(result.current.canViewAllEmails).toBe(false);
    expect(result.current.canViewSharedEmails).toBe(true);
    expect(result.current.canViewTresorerie).toBe(false);
    expect(result.current.canViewRD).toBe(false);
    expect(result.current.canViewAllTickets).toBe(false);
    expect(result.current.canViewCalendar).toBe(true);
    expect(result.current.canViewGantt).toBe(false);
    expect(result.current.canViewReports).toBe(true);
  });

  it('applique les permissions métier du rôle csm', () => {
    userRoleState.role = 'csm';

    const { result } = renderHook(() => useRolePermissions(), {
      wrapper: createWrapper(),
    });

    expect(result.current.role).toBe('csm');
    expect(result.current.team).toBe('csm');
    expect(result.current.viewScope).toBe('managed');
    expect(result.current.etablissementScope).toBe('deploiement_production');

    expect(result.current.canViewRHObjectifs).toBe(true);
    expect(result.current.canViewAllTeamMembers).toBe(false);
    expect(result.current.canViewDeploiement).toBe(true);
    expect(result.current.canViewProduction).toBe(true);
    expect(result.current.canEditEtablissements).toBe(true);
    expect(result.current.canViewPipeline).toBe(false);
    expect(result.current.canViewSharedEmails).toBe(true);
    expect(result.current.canViewOwnTickets).toBe(true);
    expect(result.current.canViewAllTickets).toBe(false);
    expect(result.current.canManageTickets).toBe(false);
    expect(result.current.canViewReports).toBe(false);
    expect(result.current.canViewGantt).toBe(true);
  });

  it('applique les permissions métier du rôle commercial', () => {
    userRoleState.role = 'commercial';

    const { result } = renderHook(() => useRolePermissions(), {
      wrapper: createWrapper(),
    });

    expect(result.current.role).toBe('commercial');
    expect(result.current.team).toBe('commercial');
    expect(result.current.viewScope).toBe('managed');
    expect(result.current.etablissementScope).toBe('prospects');

    expect(result.current.canViewRHObjectifs).toBe(true);
    expect(result.current.canViewProspects).toBe(true);
    expect(result.current.canViewDeploiement).toBe(false);
    expect(result.current.canViewProduction).toBe(false);
    expect(result.current.canEditEtablissements).toBe(true);
    expect(result.current.canViewPipeline).toBe(true);
    expect(result.current.canViewSharedEmails).toBe(true);
    expect(result.current.canViewOwnTickets).toBe(false);
    expect(result.current.canAccessAdmin).toBe(false);
    expect(result.current.canViewReports).toBe(false);
    expect(result.current.canViewFormations).toBe(false);
    expect(result.current.canViewGantt).toBe(false);
  });

  it('retourne aucune permission pour un rôle absent', () => {
    const { result } = renderHook(() => useRolePermissions(), {
      wrapper: createWrapper(),
    });

    expect(result.current.role).toBe(null);
    expect(result.current.team).toBe(null);
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.isLoading).toBe(false);

    expect(result.current.canViewSalaries).toBe(false);
    expect(result.current.canEditSalaries).toBe(false);
    expect(result.current.canViewAllTeamMembers).toBe(false);
    expect(result.current.canViewAllEtablissements).toBe(false);
    expect(result.current.canViewAllEmails).toBe(false);
    expect(result.current.canViewTresorerie).toBe(false);
    expect(result.current.canViewRD).toBe(false);
    expect(result.current.canViewOwnTickets).toBe(false);
    expect(result.current.canAccessAdmin).toBe(false);
    expect(result.current.viewScope).toBe('own');
  });
});