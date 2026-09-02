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

describe('sanitize - PostgREST utilities', () => {
  describe('sanitizePostgrestValue', () => {
    it('removes parentheses', () => expect(sanitizePostgrestValue('test()')).toBe('test'));
    it('removes commas', () => expect(sanitizePostgrestValue('a,b')).toBe('ab'));
    it('removes dots', () => expect(sanitizePostgrestValue('a.b')).toBe('ab'));
    it('removes backslashes', () => expect(sanitizePostgrestValue('a\\b')).toBe('ab'));
    it('normalizes whitespace', () => expect(sanitizePostgrestValue('a  b  c')).toBe('a b c'));
    it('trims', () => expect(sanitizePostgrestValue('  test  ')).toBe('test'));
    it('respects maxLength', () => expect(sanitizePostgrestValue('abcdef', 3)).toBe('abc'));
    it('returns empty for null-ish', () => {
      expect(sanitizePostgrestValue('')).toBe('');
      expect(sanitizePostgrestValue(null as any)).toBe('');
    });
  });

  describe('sanitizeSearchQuery', () => {
    it('escapes % wildcards', () => expect(sanitizeSearchQuery('50%')).toBe('50\\%'));
    it('escapes _ wildcards', () => expect(sanitizeSearchQuery('test_name')).toBe('test\\_name'));
    it('also removes PostgREST chars', () => expect(sanitizeSearchQuery('a(b)')).toBe('ab'));
    it('returns empty for empty', () => expect(sanitizeSearchQuery('')).toBe(''));
  });

  describe('isValidUUID', () => {
    it('accepts valid v4', () => expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true));
    it('rejects short', () => expect(isValidUUID('550e8400')).toBe(false));
    it('rejects non-hex', () => expect(isValidUUID('ZZZZZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZZZZZZZZZ')).toBe(false));
    it('rejects empty', () => expect(isValidUUID('')).toBe(false));
    it('rejects null', () => expect(isValidUUID(null as any)).toBe(false));
  });

  describe('filterValidUUIDs', () => {
    it('filters valid UUIDs', () => {
      const input = ['550e8400-e29b-41d4-a716-446655440000', 'invalid', '660e8400-e29b-41d4-a716-446655440001'];
      expect(filterValidUUIDs(input)).toEqual(['550e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440001']);
    });
    it('returns empty for empty', () => expect(filterValidUUIDs([])).toEqual([]));
    it('returns empty for non-array', () => expect(filterValidUUIDs(null as any)).toEqual([]));
  });

  describe('buildIlikeOrFilter', () => {
    it('builds filter for multiple columns', () => {
      expect(buildIlikeOrFilter(['nom', 'prenom'], 'jean')).toBe('nom.ilike.%jean%,prenom.ilike.%jean%');
    });
    it('returns empty for empty search', () => expect(buildIlikeOrFilter(['nom'], '')).toBe(''));
    it('returns empty for empty columns', () => expect(buildIlikeOrFilter([], 'test')).toBe(''));
  });

  describe('buildSafeInClause', () => {
    it('builds clause with valid UUIDs', () => {
      const ids = ['550e8400-e29b-41d4-a716-446655440000'];
      expect(buildSafeInClause('id', ids)).toBe('id.in.(550e8400-e29b-41d4-a716-446655440000)');
    });
    it('returns null for no valid UUIDs', () => {
      expect(buildSafeInClause('id', ['invalid'])).toBeNull();
    });
    it('returns null for empty', () => expect(buildSafeInClause('id', [])).toBeNull());
  });

  describe('sanitizeEmail', () => {
    it('sanitizes valid email', () => expect(sanitizeEmail('Test@Example.COM')).toBe('test@example.com'));
    it('rejects invalid email', () => expect(sanitizeEmail('not-email')).toBeNull());
    it('rejects empty', () => expect(sanitizeEmail('')).toBeNull());
    it('trims whitespace', () => expect(sanitizeEmail('  test@example.com  ')).toBe('test@example.com'));
    it('rejects null', () => expect(sanitizeEmail(null as any)).toBeNull());
  });
});
