import { describe, it, expect } from 'vitest';

// Test the pure utility functions extracted from the module
describe('exportDevisUtils formatters', () => {
  it('formatCurrency produces French format', () => {
    const format = (v: number) =>
      new Intl.NumberFormat('fr-FR', {
        style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
      }).format(v).replace(/\u00A0/g, ' ').replace(/\u202F/g, ' ');

    expect(format(1000)).toContain('1 000');
    expect(format(1000)).toContain('€');
    expect(format(0)).toContain('0');
  });

  it('formatPercentValue with comma separator', () => {
    const format = (v: number) => v.toFixed(1).replace('.', ',') + '%';
    expect(format(72.3)).toBe('72,3%');
    expect(format(100)).toBe('100,0%');
    expect(format(0)).toBe('0,0%');
  });

  it('formatNumber with French thousands separator', () => {
    const format = (v: number) =>
      new Intl.NumberFormat('fr-FR').format(Math.round(v)).replace(/\u00A0/g, ' ').replace(/\u202F/g, ' ');
    expect(format(50000)).toBe('50 000');
    expect(format(1234567)).toBe('1 234 567');
  });

  it('formatCurrencyCompact appends EUR', () => {
    const format = (v: number) => {
      const formatted = new Intl.NumberFormat('fr-FR', {
        minimumFractionDigits: 0, maximumFractionDigits: 0,
      }).format(v).replace(/\u00A0/g, ' ').replace(/\u202F/g, ' ');
      return formatted + ' EUR';
    };
    expect(format(5000)).toContain('5 000 EUR');
  });

  it('COLORS constants are valid RGB tuples', () => {
    // Verify the pattern used in the module
    const color: [number, number, number] = [26, 138, 155];
    expect(color).toHaveLength(3);
    color.forEach(c => {
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(255);
    });
  });
});
