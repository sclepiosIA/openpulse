import { describe, it, expect } from 'vitest';
import {
  ROLE_COLORS,
  ROLE_LABELS,
  getRoleColor,
  getRoleLabel,
  getActiveRoles,
} from '../roleColors';

describe('roleColors extended2', () => {
  describe('ROLE_COLORS', () => {
    it('has 8 roles', () => expect(Object.keys(ROLE_COLORS)).toHaveLength(8));
    it('all have bg, border, hex, text', () => {
      Object.values(ROLE_COLORS).forEach(c => {
        expect(c.bg).toContain('bg-');
        expect(c.border).toContain('border-');
        expect(c.hex).toMatch(/^#[0-9a-f]{6}$/);
        expect(c.text).toContain('text-');
      });
    });
  });

  describe('ROLE_LABELS', () => {
    it('has 8 labels', () => expect(Object.keys(ROLE_LABELS)).toHaveLength(8));
    it('admin → Admin', () => expect(ROLE_LABELS['admin']).toBe('Admin'));
    it('commercial → Commercial', () => expect(ROLE_LABELS['commercial']).toBe('Commercial'));
    it('chef_projet → Chef de projet', () => expect(ROLE_LABELS['chef_projet']).toBe('Chef de projet'));
    it('csm → CSM', () => expect(ROLE_LABELS['csm']).toBe('CSM'));
    it('rh → RH', () => expect(ROLE_LABELS['rh']).toBe('RH'));
    it('manager → Manager', () => expect(ROLE_LABELS['manager']).toBe('Manager'));
  });

  describe('getRoleColor', () => {
    it('returns admin colors', () => {
      const c = getRoleColor('admin');
      expect(c.hex).toBe('#ef4444');
    });
    it('returns commercial colors', () => {
      expect(getRoleColor('commercial').hex).toBe('#3b82f6');
    });
    it('returns default for null', () => {
      expect(getRoleColor(null).hex).toBe('#9ca3af');
    });
    it('returns default for undefined', () => {
      expect(getRoleColor(undefined).hex).toBe('#9ca3af');
    });
    it('returns default for unknown role', () => {
      expect(getRoleColor('unknown').hex).toBe('#9ca3af');
    });
  });

  describe('getRoleLabel', () => {
    it('admin → Admin', () => expect(getRoleLabel('admin')).toBe('Admin'));
    it('null → Non assigné', () => expect(getRoleLabel(null)).toBe('Non assigné'));
    it('undefined → Non assigné', () => expect(getRoleLabel(undefined)).toBe('Non assigné'));
    it('unknown → passthrough', () => expect(getRoleLabel('custom_role')).toBe('custom_role'));
  });

  describe('getActiveRoles', () => {
    it('returns 8 roles', () => expect(getActiveRoles()).toHaveLength(8));
    it('all have key, label, bg, hex', () => {
      getActiveRoles().forEach(r => {
        expect(r.key).toBeTruthy();
        expect(r.label).toBeTruthy();
        expect(r.bg).toContain('bg-');
        expect(r.hex).toMatch(/^#[0-9a-f]{6}$/);
      });
    });
  });
});
