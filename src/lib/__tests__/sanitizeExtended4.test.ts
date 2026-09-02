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

describe('sanitize extended coverage', () => {
  describe('sanitizePostgrestValue', () => {
    it('returns a string for special chars', () => {
      const result = sanitizePostgrestValue('test%value');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
    it('returns empty for null-ish', () => {
      expect(sanitizePostgrestValue('')).toBe('');
      expect(sanitizePostgrestValue(null as any)).toBe('');
      expect(sanitizePostgrestValue(undefined as any)).toBe('');
    });
    it('truncates long values', () => {
      const long = 'a'.repeat(300);
      expect(sanitizePostgrestValue(long).length).toBeLessThanOrEqual(200);
    });
    it('respects custom maxLength', () => {
      expect(sanitizePostgrestValue('a'.repeat(50), 10).length).toBeLessThanOrEqual(10);
    });
  });

  describe('sanitizeSearchQuery', () => {
    it('returns empty for empty', () => {
      expect(sanitizeSearchQuery('')).toBe('');
    });
    it('sanitizes search input', () => {
      const result = sanitizeSearchQuery('test value');
      expect(typeof result).toBe('string');
    });
  });

  describe('isValidUUID', () => {
    it('valid UUID v4', () => {
      expect(isValidUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
    });
    it('invalid UUID', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false);
      expect(isValidUUID('')).toBe(false);
      expect(isValidUUID(null as any)).toBe(false);
    });
  });

  describe('filterValidUUIDs', () => {
    it('filters valid UUIDs', () => {
      const result = filterValidUUIDs([
        '123e4567-e89b-12d3-a456-426614174000',
        'invalid',
        '223e4567-e89b-12d3-a456-426614174000',
      ]);
      expect(result).toHaveLength(2);
    });
    it('returns empty for non-array', () => {
      expect(filterValidUUIDs(null as any)).toEqual([]);
    });
    it('returns empty for empty array', () => {
      expect(filterValidUUIDs([])).toEqual([]);
    });
  });

  describe('buildIlikeOrFilter', () => {
    it('builds OR filter', () => {
      const result = buildIlikeOrFilter(['nom', 'ville'], 'Paris');
      expect(result).toContain('nom');
      expect(result).toContain('ville');
      expect(result).toContain('Paris');
    });
    it('returns empty for empty search', () => {
      expect(buildIlikeOrFilter(['nom'], '')).toBe('');
    });
    it('returns empty for empty columns', () => {
      expect(buildIlikeOrFilter([], 'test')).toBe('');
    });
  });

  describe('buildSafeInClause', () => {
    it('builds IN clause for valid UUIDs', () => {
      const result = buildSafeInClause('id', ['123e4567-e89b-12d3-a456-426614174000']);
      expect(result).not.toBeNull();
      expect(result).toContain('id');
    });
    it('returns null for no valid UUIDs', () => {
      expect(buildSafeInClause('id', ['invalid'])).toBeNull();
    });
    it('returns null for empty array', () => {
      expect(buildSafeInClause('id', [])).toBeNull();
    });
  });

  describe('sanitizeEmail', () => {
    it('sanitizes valid email', () => {
      expect(sanitizeEmail('Test@Example.COM')).toBe('test@example.com');
    });
    it('returns null for invalid email', () => {
      expect(sanitizeEmail('')).toBeNull();
      expect(sanitizeEmail(null as any)).toBeNull();
      expect(sanitizeEmail('not-an-email')).toBeNull();
    });
    it('trims whitespace', () => {
      expect(sanitizeEmail('  user@test.com  ')).toBe('user@test.com');
    });
  });
});
