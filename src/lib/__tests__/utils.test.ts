import { describe, it, expect } from 'vitest';
import { cn, formatNumber } from '../utils';

describe('utils', () => {
  describe('cn', () => {
    it('merges class names', () => {
      expect(cn('bg-red-500', 'text-white')).toBe('bg-red-500 text-white');
    });
    it('handles conflicts with tailwind-merge', () => {
      expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500');
    });
    it('handles conditionals', () => {
      expect(cn('base', false && 'hidden', 'visible')).toBe('base visible');
    });
    it('handles undefined and null', () => {
      expect(cn('base', undefined, null)).toBe('base');
    });
  });

  describe('formatNumber', () => {
    it('formats millions', () => {
      expect(formatNumber(2000000)).toBe('2M');
    });
    it('formats millions with decimal', () => {
      expect(formatNumber(1500000)).toBe('1.5M');
    });
    it('formats thousands', () => {
      expect(formatNumber(5000)).toBe('5K');
    });
    it('returns raw for small numbers', () => {
      expect(formatNumber(42)).toBe('42');
    });
  });
});
