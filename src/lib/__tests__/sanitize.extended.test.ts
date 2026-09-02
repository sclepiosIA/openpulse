import { describe, it, expect } from 'vitest';
import {
  sanitizePostgrestValue, sanitizeSearchQuery, isValidUUID,
  filterValidUUIDs, buildIlikeOrFilter, buildSafeInClause, sanitizeEmail,
} from '../sanitize';

describe('sanitize', () => {
  describe('sanitizePostgrestValue', () => {
    it('removes control chars', () => {
      expect(sanitizePostgrestValue('hello(world)')).toBe('helloworld');
    });
    it('normalizes whitespace', () => {
      expect(sanitizePostgrestValue('hello   world')).toBe('hello world');
    });
    it('truncates to maxLength', () => {
      expect(sanitizePostgrestValue('a'.repeat(300), 10)).toHaveLength(10);
    });
    it('returns empty for null-ish', () => {
      expect(sanitizePostgrestValue('')).toBe('');
    });
  });

  describe('sanitizeSearchQuery', () => {
    it('escapes % and _', () => {
      expect(sanitizeSearchQuery('50%_test')).toBe('50\\%\\_test');
    });
    it('also removes PostgREST chars', () => {
      expect(sanitizeSearchQuery('hello(world)')).toBe('helloworld');
    });
  });

  describe('isValidUUID', () => {
    it('validates correct UUID', () => {
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });
    it('rejects invalid', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false);
      expect(isValidUUID('')).toBe(false);
    });
  });

  describe('filterValidUUIDs', () => {
    it('keeps valid UUIDs', () => {
      const result = filterValidUUIDs([
        '550e8400-e29b-41d4-a716-446655440000',
        'invalid',
        '123e4567-e89b-12d3-a456-426614174000',
      ]);
      expect(result).toHaveLength(2);
    });
    it('returns empty for non-array', () => {
      expect(filterValidUUIDs(null as unknown as string[])).toEqual([]);
    });
  });

  describe('buildIlikeOrFilter', () => {
    it('builds filter for multiple columns', () => {
      const result = buildIlikeOrFilter(['nom', 'email'], 'test');
      expect(result).toBe('nom.ilike.%test%,email.ilike.%test%');
    });
    it('returns empty for empty search', () => {
      expect(buildIlikeOrFilter(['nom'], '')).toBe('');
    });
  });

  describe('buildSafeInClause', () => {
    it('builds IN clause', () => {
      const result = buildSafeInClause('id', ['550e8400-e29b-41d4-a716-446655440000']);
      expect(result).toContain('id.in.');
    });
    it('returns null for no valid IDs', () => {
      expect(buildSafeInClause('id', ['invalid'])).toBeNull();
    });
  });

  describe('sanitizeEmail', () => {
    it('validates and lowercases email', () => {
      expect(sanitizeEmail('Test@EXAMPLE.com')).toBe('test@example.com');
    });
    it('returns null for invalid', () => {
      expect(sanitizeEmail('not-email')).toBeNull();
      expect(sanitizeEmail('')).toBeNull();
    });
  });
});
