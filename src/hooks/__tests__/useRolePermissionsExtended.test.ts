import { describe, it, expect } from 'vitest';
import { roleToTeam } from '../auth/useRolePermissions';
import type { AppRole, TeamType } from '../auth/useRolePermissions';

describe('useRolePermissions static exports', () => {
  describe('roleToTeam mapping', () => {
    it('direction → direction', () => expect(roleToTeam.direction).toBe('direction'));
    it('copil → direction', () => expect(roleToTeam.copil).toBe('direction'));
    it('admin → direction', () => expect(roleToTeam.admin).toBe('direction'));
    it('rh → direction', () => expect(roleToTeam.rh).toBe('direction'));
    it('chef_projet → technique', () => expect(roleToTeam.chef_projet).toBe('technique'));
    it('csm → csm', () => expect(roleToTeam.csm).toBe('csm'));
    it('commercial → commercial', () => expect(roleToTeam.commercial).toBe('commercial'));
    it('marketing → marketing', () => expect(roleToTeam.marketing).toBe('marketing'));
    it('has all 8 roles', () => expect(Object.keys(roleToTeam)).toHaveLength(8));
  });

  describe('types', () => {
    it('AppRole accepts direction', () => {
      const role: AppRole = 'direction';
      expect(role).toBe('direction');
    });
    it('AppRole accepts commercial', () => {
      const role: AppRole = 'commercial';
      expect(role).toBe('commercial');
    });
    it('TeamType accepts technique', () => {
      const team: TeamType = 'technique';
      expect(team).toBe('technique');
    });
    it('TeamType accepts csm', () => {
      const team: TeamType = 'csm';
      expect(team).toBe('csm');
    });
  });
});
