import { describe, it, expect } from 'vitest';
import { getRoleColor, getRoleLabel, getActiveRoles, ROLE_COLORS, ROLE_LABELS } from '../roleColors';

describe('roleColors', () => {
  it('getRoleColor known roles', () => {
    expect(getRoleColor('admin').hex).toBe('#ef4444');
    expect(getRoleColor('csm').hex).toBe('#a855f7');
  });

  it('getRoleColor unknown / null returns default', () => {
    expect(getRoleColor(null).bg).toBe('bg-muted');
    expect(getRoleColor('xxx').bg).toBe('bg-muted');
  });

  it('getRoleLabel', () => {
    expect(getRoleLabel('admin')).toBe('Admin');
    expect(getRoleLabel(null)).toBe('Non assigné');
    expect(getRoleLabel('inconnu')).toBe('inconnu');
  });

  it('getActiveRoles exposes all roles', () => {
    const roles = getActiveRoles();
    expect(roles).toHaveLength(Object.keys(ROLE_COLORS).length);
    expect(roles[0]).toHaveProperty('key');
    expect(roles[0]).toHaveProperty('label');
    expect(roles[0]).toHaveProperty('hex');
  });

  it('ROLE_LABELS covers each color key', () => {
    for (const k of Object.keys(ROLE_COLORS)) {
      expect(ROLE_LABELS[k]).toBeDefined();
    }
  });
});
