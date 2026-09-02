import { describe, it, expect } from 'vitest';
import { nullToUndefined, undefinedToNull, normalizeDbRow, strictCast } from '../typeUtils';

describe('typeUtils', () => {
  it('nullToUndefined', () => {
    expect(nullToUndefined(null)).toBeUndefined();
    expect(nullToUndefined('x')).toBe('x');
    expect(nullToUndefined(0)).toBe(0);
  });

  it('undefinedToNull', () => {
    expect(undefinedToNull(undefined)).toBeNull();
    expect(undefinedToNull('x')).toBe('x');
  });

  it('normalizeDbRow replaces nulls with undefined', () => {
    const out = normalizeDbRow({ a: null, b: 'x', c: 1 });
    expect(out.a).toBeUndefined();
    expect(out.b).toBe('x');
    expect(out.c).toBe(1);
  });

  it('strictCast returns same reference', () => {
    const o = { foo: 'bar' };
    expect(strictCast<{ foo: string }>(o)).toBe(o);
  });
});
