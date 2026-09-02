import { describe, it, expect } from 'vitest';
import { nullToUndefined, undefinedToNull, normalizeDbRow, strictCast } from '../typeUtils';

describe('typeUtils', () => {
  describe('nullToUndefined', () => {
    it('converts null → undefined', () => expect(nullToUndefined(null)).toBeUndefined());
    it('preserves value', () => expect(nullToUndefined('hello')).toBe('hello'));
    it('preserves 0', () => expect(nullToUndefined(0)).toBe(0));
    it('preserves false', () => expect(nullToUndefined(false)).toBe(false));
    it('preserves empty string', () => expect(nullToUndefined('')).toBe(''));
  });

  describe('undefinedToNull', () => {
    it('converts undefined → null', () => expect(undefinedToNull(undefined)).toBeNull());
    it('preserves value', () => expect(undefinedToNull('hello')).toBe('hello'));
    it('preserves 0', () => expect(undefinedToNull(0)).toBe(0));
    it('preserves null', () => expect(undefinedToNull(null as any)).toBeNull());
  });

  describe('normalizeDbRow', () => {
    it('converts null fields to undefined', () => {
      const row = { name: 'test', email: null, age: 25 };
      const result = normalizeDbRow(row);
      expect(result.name).toBe('test');
      expect(result.email).toBeUndefined();
      expect(result.age).toBe(25);
    });
  });

  describe('strictCast', () => {
    it('casts value', () => {
      const val = strictCast<string>(42);
      expect(val).toBe(42); // runtime doesn't change, just type assertion
    });
  });
});
