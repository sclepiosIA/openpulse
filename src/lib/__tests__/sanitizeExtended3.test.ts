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

describe('sanitize (extended)', () => {
  describe('sanitizePostgrestValue', () => {
    it('removes parentheses', () => expect(sanitizePostgrestValue('test()')).toBe('test'));
    it('removes commas', () => expect(sanitizePostgrestValue('a,b')).toBe('ab'));
    it('removes quotes', () => expect(sanitizePostgrestValue('te"st')).toBe('test'));
    it('removes dots', () => expect(sanitizePostgrestValue('a.b')).toBe('ab'));
    it('removes backslashes', () => expect(sanitizePostgrestValue('a\\b')).toBe('ab'));
    it('normalizes whitespace', () => expect(sanitizePostgrestValue('a  b   c')).toBe('a b c'));
    it('trims', () => expect(sanitizePostgrestValue('  hi  ')).toBe('hi'));
    it('respects maxLength', () => expect(sanitizePostgrestValue('abcdefgh', 5)).toBe('abcde'));
    it('empty string → empty', () => expect(sanitizePostgrestValue('')).toBe(''));
    it('null-like → empty', () => expect(sanitizePostgrestValue(null as any)).toBe(''));
  });

  describe('sanitizeSearchQuery', () => {
    it('escapes %', () => expect(sanitizeSearchQuery('100%')).toBe('100\\%'));
    it('escapes _', () => expect(sanitizeSearchQuery('a_b')).toBe('a\\_b'));
    it('combined sanitization', () => expect(sanitizeSearchQuery('(te.st)%_')).toContain('test'));
    it('empty → empty', () => expect(sanitizeSearchQuery('')).toBe(''));
  });

  describe('isValidUUID', () => {
    it('valid UUID', () => expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true));
    it('uppercase UUID', () => expect(isValidUUID('550E8400-E29B-41D4-A716-446655440000')).toBe(true));
    it('invalid', () => expect(isValidUUID('not-a-uuid')).toBe(false));
    it('empty', () => expect(isValidUUID('')).toBe(false));
    it('null', () => expect(isValidUUID(null as any)).toBe(false));
  });

  describe('filterValidUUIDs', () => {
    it('filters valid only', () => {
      const result = filterValidUUIDs(['550e8400-e29b-41d4-a716-446655440000', 'bad', '550e8400-e29b-41d4-a716-446655440001']);
      expect(result.length).toBe(2);
    });
    it('non-array → empty', () => expect(filterValidUUIDs(null as any)).toEqual([]));
  });

  describe('buildIlikeOrFilter', () => {
    it('builds filter', () => {
      const result = buildIlikeOrFilter(['nom', 'prenom'], 'test');
      expect(result).toBe('nom.ilike.%test%,prenom.ilike.%test%');
    });
    it('empty search → empty', () => expect(buildIlikeOrFilter(['nom'], '')).toBe(''));
    it('empty columns → empty', () => expect(buildIlikeOrFilter([], 'test')).toBe(''));
  });

  describe('buildSafeInClause', () => {
    it('builds clause', () => {
      const id = '550e8400-e29b-41d4-a716-446655440000';
      expect(buildSafeInClause('id', [id])).toBe(`id.in.(${id})`);
    });
    it('filters invalid UUIDs', () => expect(buildSafeInClause('id', ['bad'])).toBeNull());
    it('empty → null', () => expect(buildSafeInClause('id', [])).toBeNull());
  });

  describe('sanitizeEmail', () => {
    it('valid email', () => expect(sanitizeEmail('Test@Example.COM')).toBe('test@example.com'));
    it('trims', () => expect(sanitizeEmail('  a@b.com  ')).toBe('a@b.com'));
    it('invalid → null', () => expect(sanitizeEmail('notanemail')).toBeNull());
    it('empty → null', () => expect(sanitizeEmail('')).toBeNull());
    it('null → null', () => expect(sanitizeEmail(null as any)).toBeNull());
  });
});
