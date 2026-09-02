import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { roleToTeam, type AppRole } from '../auth/useRolePermissions';

// Mock useUserRole
const mockUseUserRole = vi.fn();
vi.mock('../shared/useUserRole', () => ({
  useUserRole: () => mockUseUserRole(),
}));

// We test the roleToTeam mapping and the hook logic
describe('useRolePermissions', () => {
  describe('roleToTeam mapping', () => {
    it('maps admin to direction', () => {
      expect(roleToTeam.admin).toBe('direction');
    });
    it('maps chef_projet to technique', () => {
      expect(roleToTeam.chef_projet).toBe('technique');
    });
    it('maps csm to csm', () => {
      expect(roleToTeam.csm).toBe('csm');
    });
    it('maps commercial to commercial', () => {
      expect(roleToTeam.commercial).toBe('commercial');
    });
    it('maps rh to direction', () => {
      expect(roleToTeam.rh).toBe('direction');
    });
    it('maps copil to direction', () => {
      expect(roleToTeam.copil).toBe('direction');
    });
  });

  describe('useRolePermissions hook', () => {
    it('admin has all permissions', async () => {
      mockUseUserRole.mockReturnValue({ role: 'admin', isAdmin: true, isLoading: false });
      const { useRolePermissions } = await import('../auth/useRolePermissions');
      const { result } = renderHook(() => useRolePermissions());
      expect(result.current.isAdmin).toBe(true);
      expect(result.current.canAccessAdmin).toBe(true);
      expect(result.current.canViewSalaries).toBe(true);
      expect(result.current.canViewTresorerie).toBe(true);
      expect(result.current.viewScope).toBe('all');
    });

    it('commercial has prospect-focused permissions', async () => {
      mockUseUserRole.mockReturnValue({ role: 'commercial', isAdmin: false, isLoading: false });
      const { useRolePermissions } = await import('../auth/useRolePermissions');
      const { result } = renderHook(() => useRolePermissions());
      expect(result.current.isAdmin).toBe(false);
      expect(result.current.canViewProspects).toBe(true);
      expect(result.current.canViewPipeline).toBe(true);
      expect(result.current.canViewSalaries).toBe(false);
      expect(result.current.canViewTresorerie).toBe(false);
      expect(result.current.etablissementScope).toBe('prospects');
    });

    it('csm has deploiement+production scope', async () => {
      mockUseUserRole.mockReturnValue({ role: 'csm', isAdmin: false, isLoading: false });
      const { useRolePermissions } = await import('../auth/useRolePermissions');
      const { result } = renderHook(() => useRolePermissions());
      expect(result.current.canViewDeploiement).toBe(true);
      expect(result.current.canViewProduction).toBe(true);
      expect(result.current.canViewProspects).toBe(false);
      expect(result.current.etablissementScope).toBe('deploiement_production');
    });

    it('rh has salary access but no R&D', async () => {
      mockUseUserRole.mockReturnValue({ role: 'rh', isAdmin: false, isLoading: false });
      const { useRolePermissions } = await import('../auth/useRolePermissions');
      const { result } = renderHook(() => useRolePermissions());
      expect(result.current.canViewSalaries).toBe(true);
      expect(result.current.canEditSalaries).toBe(true);
      expect(result.current.canExportPayroll).toBe(true);
      expect(result.current.canViewRD).toBe(false);
    });
  });
});
