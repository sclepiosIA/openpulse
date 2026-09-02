import { describe, it, expect } from 'vitest';
import { ROLE_COLORS, ROLE_LABELS, getRoleColor, getRoleLabel, getActiveRoles } from '../roleColors';

describe('roleColors', () => {
  describe('ROLE_COLORS', () => {
    it('has admin', () => expect(ROLE_COLORS.admin.hex).toBe('#ef4444'));
    it('has csm', () => expect(ROLE_COLORS.csm.hex).toBe('#a855f7'));
    it('has commercial', () => expect(ROLE_COLORS.commercial.hex).toBe('#3b82f6'));
  });

  describe('ROLE_LABELS', () => {
    it('admin → Admin', () => expect(ROLE_LABELS.admin).toBe('Admin'));
    it('chef_projet → Chef de projet', () => expect(ROLE_LABELS.chef_projet).toBe('Chef de projet'));
    it('csm → CSM', () => expect(ROLE_LABELS.csm).toBe('CSM'));
  });

  describe('getRoleColor', () => {
    it('returns admin color', () => expect(getRoleColor('admin').hex).toBe('#ef4444'));
    it('returns csm color', () => expect(getRoleColor('csm').bg).toBe('bg-purple-500'));
    it('returns default for null', () => expect(getRoleColor(null).hex).toBe('#9ca3af'));
    it('returns default for undefined', () => expect(getRoleColor(undefined).hex).toBe('#9ca3af'));
    it('returns default for unknown', () => expect(getRoleColor('unknown').hex).toBe('#9ca3af'));
  });

  describe('getRoleLabel', () => {
    it('returns Admin', () => expect(getRoleLabel('admin')).toBe('Admin'));
    it('returns raw for unknown', () => expect(getRoleLabel('custom')).toBe('custom'));
    it('returns Non assigné for null', () => expect(getRoleLabel(null)).toBe('Non assigné'));
    it('returns Non assigné for undefined', () => expect(getRoleLabel(undefined)).toBe('Non assigné'));
  });

  describe('getActiveRoles', () => {
    it('returns all roles with labels and colors', () => {
      const roles = getActiveRoles();
      expect(roles.length).toBe(Object.keys(ROLE_COLORS).length);
      expect(roles[0]).toHaveProperty('key');
      expect(roles[0]).toHaveProperty('label');
      expect(roles[0]).toHaveProperty('hex');
      expect(roles[0]).toHaveProperty('bg');
    });
  });
});
