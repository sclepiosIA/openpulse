import { describe, it, expect } from 'vitest';
import { calculateBannerRows } from '../calendarTimelineHelpers';

const b = (id: string, start: number, end: number) => ({
  id,
  title: id,
  color: '#000',
  startColumn: start,
  endColumn: end,
  type: 'event' as const,
  originalItem: {} as any,
});

describe('calculateBannerRows', () => {
  it('liste vide → []', () => {
    expect(calculateBannerRows([])).toEqual([]);
  });

  it('un seul banner → row 0', () => {
    const out = calculateBannerRows([b('a', 0, 3)]);
    expect(out[0].row).toBe(0);
  });

  it('deux banners disjoints réutilisent la row 0', () => {
    const out = calculateBannerRows([b('a', 0, 2), b('b', 3, 5)]);
    const byId = Object.fromEntries(out.map((x) => [x.id, x.row]));
    expect(byId.a).toBe(0);
    expect(byId.b).toBe(0);
  });

  it('deux banners chevauchants → rows distinctes', () => {
    const out = calculateBannerRows([b('a', 0, 3), b('b', 2, 4)]);
    expect(new Set(out.map((x) => x.row)).size).toBe(2);
  });

  it('trois banners chevauchants → 3 rows distinctes', () => {
    const out = calculateBannerRows([b('a', 0, 5), b('b', 1, 5), b('c', 2, 5)]);
    expect(new Set(out.map((x) => x.row))).toEqual(new Set([0, 1, 2]));
  });

  it('tri par startColumn croissant puis par endColumn (stable)', () => {
    // c démarre avant a ; les rows assignées suivent l'ordre trié
    const out = calculateBannerRows([b('a', 5, 6), b('c', 0, 1), b('b', 2, 3)]);
    expect(out.every((x) => x.row === 0)).toBe(true);
  });

  it('réutilise la row dès qu’un slot se libère', () => {
    const out = calculateBannerRows([b('a', 0, 2), b('b', 1, 3), b('c', 4, 6)]);
    const c = out.find((x) => x.id === 'c')!;
    expect(c.row).toBe(0);
  });
});
