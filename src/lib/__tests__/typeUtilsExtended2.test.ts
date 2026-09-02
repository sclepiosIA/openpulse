import { describe, it, expect } from 'vitest';
import { nullToUndefined, undefinedToNull, normalizeDbRow, strictCast } from '../typeUtils';

describe('typeUtils', () => {
  describe('nullToUndefined', () => {
    it('null → undefined', () => expect(nullToUndefined(null)).toBeUndefined());
    it('value → value', () => expect(nullToUndefined('hello')).toBe('hello'));
    it('0 → 0', () => expect(nullToUndefined(0)).toBe(0));
    it('false → false', () => expect(nullToUndefined(false)).toBe(false));
  });

  describe('undefinedToNull', () => {
    it('undefined → null', () => expect(undefinedToNull(undefined)).toBeNull());
    it('value → value', () => expect(undefinedToNull('hello')).toBe('hello'));
    it('0 → 0', () => expect(undefinedToNull(0)).toBe(0));
  });

  describe('normalizeDbRow', () => {
    it('converts nulls to undefined', () => {
      const row = { a: 'hello', b: null, c: 42 };
      const result = normalizeDbRow(row);
      expect(result.a).toBe('hello');
      expect(result.b).toBeUndefined();
      expect(result.c).toBe(42);
    });
  });

  describe('strictCast', () => {
    it('casts value', () => {
      const val: unknown = 'hello';
      const result = strictCast<string>(val);
      expect(result).toBe('hello');
    });
  });
});
