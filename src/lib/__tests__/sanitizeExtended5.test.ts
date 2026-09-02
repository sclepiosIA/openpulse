import { describe, it, expect } from 'vitest';
import {
  sanitizePostgrestValue,
  sanitizeSearchQuery,
  isValidUUID,
  filterValidUUIDs,
  buildIlikeOrFilter,
  buildSafeInClause,
  sanitizeEmail,
} from '../sanitize';

describe('sanitize extended5', () => {
  describe('sanitizePostgrestValue', () => {
    it('returns empty for falsy', () => expect(sanitizePostgrestValue('')).toBe(''));
    it('strips parens', () => expect(sanitizePostgrestValue('a(b)c')).toBe('abc'));
    it('strips commas', () => expect(sanitizePostgrestValue('a,b')).toBe('ab'));
    it('strips quotes', () => expect(sanitizePostgrestValue('a"b')).toBe('ab'));
    it('strips dots', () => expect(sanitizePostgrestValue('a.b')).toBe('ab'));
    it('strips backslashes', () => expect(sanitizePostgrestValue('a\\b')).toBe('ab'));
    it('normalizes whitespace', () => expect(sanitizePostgrestValue('a  b   c')).toBe('a b c'));
    it('trims', () => expect(sanitizePostgrestValue('  hello  ')).toBe('hello'));
    it('respects maxLength', () => expect(sanitizePostgrestValue('abcdef', 3)).toBe('abc'));
    it('preserves safe chars', () => expect(sanitizePostgrestValue('Hello World 123')).toBe('Hello World 123'));
  });

  describe('sanitizeSearchQuery', () => {
    it('empty → empty', () => expect(sanitizeSearchQuery('')).toBe(''));
    it('escapes %', () => expect(sanitizeSearchQuery('50%')).toContain('\\%'));
    it('escapes _', () => expect(sanitizeSearchQuery('a_b')).toContain('\\_'));
    it('also strips postgrest chars', () => expect(sanitizeSearchQuery('(test)')).toBe('test'));
    it('combined escaping', () => {
      const result = sanitizeSearchQuery('50% off_sale');
      expect(result).toContain('\\%');
      expect(result).toContain('\\_');
    });
  });

  describe('isValidUUID', () => {
    it('valid v4', () => expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true));
    it('valid lowercase', () => expect(isValidUUID('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(true));
    it('valid uppercase', () => expect(isValidUUID('A1B2C3D4-E5F6-7890-ABCD-EF1234567890')).toBe(true));
    it('empty → false', () => expect(isValidUUID('')).toBe(false));
    it('short → false', () => expect(isValidUUID('550e8400')).toBe(false));
    it('no dashes → false', () => expect(isValidUUID('550e8400e29b41d4a716446655440000')).toBe(false));
    it('null → false', () => expect(isValidUUID(null as any)).toBe(false));
    it('undefined → false', () => expect(isValidUUID(undefined as any)).toBe(false));
  });

  describe('filterValidUUIDs', () => {
    it('filters valid only', () => {
      const result = filterValidUUIDs([
        '550e8400-e29b-41d4-a716-446655440000',
        'not-a-uuid',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      ]);
      expect(result).toHaveLength(2);
    });
    it('empty → empty', () => expect(filterValidUUIDs([])).toEqual([]));
    it('null → empty', () => expect(filterValidUUIDs(null as any)).toEqual([]));
    it('all invalid → empty', () => expect(filterValidUUIDs(['abc', '123'])).toEqual([]));
  });

  describe('buildIlikeOrFilter', () => {
    it('single column', () => {
      const result = buildIlikeOrFilter(['nom'], 'test');
      expect(result).toBe('nom.ilike.%test%');
    });
    it('multiple columns', () => {
      const result = buildIlikeOrFilter(['nom', 'prenom'], 'jean');
      expect(result).toBe('nom.ilike.%jean%,prenom.ilike.%jean%');
    });
    it('empty search → empty', () => expect(buildIlikeOrFilter(['nom'], '')).toBe(''));
    it('empty columns → empty', () => expect(buildIlikeOrFilter([], 'test')).toBe(''));
  });

  describe('buildSafeInClause', () => {
    it('valid IDs', () => {
      const result = buildSafeInClause('id', ['550e8400-e29b-41d4-a716-446655440000']);
      expect(result).toContain('id.in.(');
      expect(result).toContain('550e8400');
    });
    it('filters invalid IDs', () => {
      const result = buildSafeInClause('id', ['550e8400-e29b-41d4-a716-446655440000', 'bad']);
      expect(result).toContain('550e8400');
      expect(result).not.toContain('bad');
    });
    it('all invalid → null', () => expect(buildSafeInClause('id', ['abc'])).toBeNull());
    it('empty → null', () => expect(buildSafeInClause('id', [])).toBeNull());
  });

  describe('sanitizeEmail', () => {
    it('valid email', () => expect(sanitizeEmail('Test@Example.COM')).toBe('test@example.com'));
    it('trims', () => expect(sanitizeEmail('  user@test.com  ')).toBe('user@test.com'));
    it('invalid → null', () => expect(sanitizeEmail('not-email')).toBeNull());
    it('empty → null', () => expect(sanitizeEmail('')).toBeNull());
    it('null → null', () => expect(sanitizeEmail(null as any)).toBeNull());
    it('strips postgrest chars from email', () => {
      const result = sanitizeEmail('user(test)@example.com');
      expect(result).toBe('usertest@example.com');
    });
  });
});
