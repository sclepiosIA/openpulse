import { describe, it, expect } from 'vitest';
import { nullToUndefined, undefinedToNull, normalizeDbRow, strictCast } from '../typeUtils';

describe('typeUtils extended3', () => {
  describe('nullToUndefined', () => {
    it('null → undefined', () => expect(nullToUndefined(null)).toBeUndefined());
    it('string → string', () => expect(nullToUndefined('hello')).toBe('hello'));
    it('0 → 0', () => expect(nullToUndefined(0)).toBe(0));
    it('false → false', () => expect(nullToUndefined(false)).toBe(false));
    it('empty string → empty string', () => expect(nullToUndefined('')).toBe(''));
    it('object → object', () => {
      const obj = { a: 1 };
      expect(nullToUndefined(obj)).toBe(obj);
    });
  });

  describe('undefinedToNull', () => {
    it('undefined → null', () => expect(undefinedToNull(undefined)).toBeNull());
    it('string → string', () => expect(undefinedToNull('test')).toBe('test'));
    it('0 → 0', () => expect(undefinedToNull(0)).toBe(0));
    it('false → false', () => expect(undefinedToNull(false)).toBe(false));
    it('null → null', () => expect(undefinedToNull(null)).toBeNull());
  });

  describe('normalizeDbRow', () => {
    it('converts nulls to undefined', () => {
      const row = { name: 'test', age: null, active: true };
      const normalized = normalizeDbRow(row);
      expect(normalized.name).toBe('test');
      expect(normalized.age).toBeUndefined();
      expect(normalized.active).toBe(true);
    });

    it('handles all-null row', () => {
      const row = { a: null, b: null };
      const result = normalizeDbRow(row);
      expect(result.a).toBeUndefined();
      expect(result.b).toBeUndefined();
    });

    it('handles empty row', () => {
      expect(normalizeDbRow({})).toEqual({});
    });

    it('preserves non-null values', () => {
      const row = { x: 0, y: '', z: false };
      const result = normalizeDbRow(row);
      expect(result.x).toBe(0);
      expect(result.y).toBe('');
      expect(result.z).toBe(false);
    });
  });

  describe('strictCast', () => {
    it('casts unknown to string', () => {
      const val: unknown = 'hello';
      expect(strictCast<string>(val)).toBe('hello');
    });

    it('casts unknown to number', () => {
      expect(strictCast<number>(42)).toBe(42);
    });

    it('casts to interface', () => {
      const obj = { id: '1', name: 'test' };
      const result = strictCast<{ id: string; name: string }>(obj);
      expect(result.id).toBe('1');
      expect(result.name).toBe('test');
    });
  });
});
