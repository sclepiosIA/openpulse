import { describe, it, expect } from 'vitest';
import { safeFormat, safeFormatDistanceToNow } from '../safeDate';

describe('safeDate', () => {
  it('safeFormat valid date', () => {
    expect(safeFormat('2024-03-15T00:00:00Z', 'yyyy-MM-dd')).toMatch(/2024-03-1[45]/);
  });

  it('safeFormat invalid → fallback', () => {
    expect(safeFormat(null, 'yyyy-MM-dd')).toBe('—');
    expect(safeFormat('not-a-date', 'yyyy-MM-dd')).toBe('—');
    expect(safeFormat(undefined, 'yyyy-MM-dd', undefined, 'N/A')).toBe('N/A');
    expect(safeFormat('', 'yyyy-MM-dd')).toBe('—');
  });

  it('safeFormat accepts Date object', () => {
    expect(safeFormat(new Date('2024-01-01'), 'yyyy')).toBe('2024');
  });

  it('safeFormatDistanceToNow invalid → fallback', () => {
    expect(safeFormatDistanceToNow(null)).toBe('—');
    expect(safeFormatDistanceToNow('bad')).toBe('—');
  });

  it('safeFormatDistanceToNow valid returns non-fallback', () => {
    const out = safeFormatDistanceToNow(new Date(Date.now() - 5 * 60 * 1000));
    expect(out).not.toBe('—');
    expect(typeof out).toBe('string');
  });
});
