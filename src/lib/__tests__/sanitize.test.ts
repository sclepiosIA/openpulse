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

const UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('sanitize', () => {
  it('sanitizePostgrestValue strips control chars + normalizes', () => {
    expect(sanitizePostgrestValue('a,b(c)"d')).toBe('abcd');
    expect(sanitizePostgrestValue('  multi   space ')).toBe('multi space');
    expect(sanitizePostgrestValue('')).toBe('');
    expect(sanitizePostgrestValue(null as any)).toBe('');
    expect(sanitizePostgrestValue('x'.repeat(300), 10)).toHaveLength(10);
  });

  it('sanitizeSearchQuery escapes LIKE wildcards', () => {
    expect(sanitizeSearchQuery('50%_done')).toBe('50\\%\\_done');
    expect(sanitizeSearchQuery('')).toBe('');
  });

  it('isValidUUID', () => {
    expect(isValidUUID(UUID)).toBe(true);
    expect(isValidUUID('not-uuid')).toBe(false);
    expect(isValidUUID('')).toBe(false);
  });

  it('filterValidUUIDs', () => {
    expect(filterValidUUIDs([UUID, 'bad', UUID])).toEqual([UUID, UUID]);
    expect(filterValidUUIDs(null as any)).toEqual([]);
  });

  it('buildIlikeOrFilter', () => {
    expect(buildIlikeOrFilter(['nom', 'prenom'], 'foo')).toBe('nom.ilike.%foo%,prenom.ilike.%foo%');
    expect(buildIlikeOrFilter([], 'foo')).toBe('');
    expect(buildIlikeOrFilter(['nom'], '')).toBe('');
  });

  it('buildSafeInClause', () => {
    expect(buildSafeInClause('id', [UUID])).toBe(`id.in.(${UUID})`);
    expect(buildSafeInClause('id', ['bad'])).toBeNull();
  });

  it('sanitizeEmail', () => {
    expect(sanitizeEmail('  Foo@Bar.fr ')).toBe('foo@bar.fr');
    expect(sanitizeEmail('bad')).toBeNull();
    expect(sanitizeEmail('')).toBeNull();
  });
});
