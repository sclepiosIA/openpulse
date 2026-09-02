import { describe, it, expect } from 'vitest';
import {
  isValidEmail,
  isValidFrenchPhone,
  isValidSiret,
  isValidUrl,
  getPasswordStrength,
  isValidDateRange,
  isInRange,
  isRequired,
  isValidFrenchPostalCode,
  isValidAmount,
  isValidFibonacciPoints,
  isValidSlug,
} from '../validationHelpers';

describe('validationHelpers extended2', () => {
  describe('isValidEmail edge cases', () => {
    it('user+tag@domain.com', () => expect(isValidEmail('user+tag@domain.com')).toBe(true));
    it('multiple dots', () => expect(isValidEmail('user@sub.domain.co.uk')).toBe(true));
    it('no domain', () => expect(isValidEmail('user@')).toBe(false));
    it('no user', () => expect(isValidEmail('@domain.com')).toBe(false));
    it('spaces', () => expect(isValidEmail('us er@domain.com')).toBe(false));
    it('empty', () => expect(isValidEmail('')).toBe(false));
  });

  describe('isValidFrenchPhone edge cases', () => {
    it('with dots', () => expect(isValidFrenchPhone('06.12.34.56.78')).toBe(true));
    it('with dashes', () => expect(isValidFrenchPhone('06-12-34-56-78')).toBe(true));
    it('0033 prefix', () => expect(isValidFrenchPhone('0033612345678')).toBe(true));
    it('01 landline', () => expect(isValidFrenchPhone('0145678901')).toBe(true));
    it('09 VoIP', () => expect(isValidFrenchPhone('0912345678')).toBe(true));
    it('too long', () => expect(isValidFrenchPhone('06123456789')).toBe(false));
    it('starts with 00 (not 0033)', () => expect(isValidFrenchPhone('0012345678')).toBe(false));
  });

  describe('isValidSiret edge cases', () => {
    it('with spaces', () => expect(isValidSiret('732 829 320 00074')).toBe(typeof isValidSiret('73282932000074') === 'boolean'));
    it('all zeros → valid checksum', () => expect(isValidSiret('00000000000000')).toBe(true));
    it('letters → false', () => expect(isValidSiret('ABCDEFGHIJKLMN')).toBe(false));
    it('13 digits → false', () => expect(isValidSiret('1234567890123')).toBe(false));
    it('15 digits → false', () => expect(isValidSiret('123456789012345')).toBe(false));
  });

  describe('isValidUrl edge cases', () => {
    it('https with path', () => expect(isValidUrl('https://example.com/path?q=1')).toBe(true));
    it('ftp', () => expect(isValidUrl('ftp://files.example.com')).toBe(true));
    it('no protocol', () => expect(isValidUrl('example.com')).toBe(false));
    it('empty', () => expect(isValidUrl('')).toBe(false));
    it('just protocol', () => expect(isValidUrl('https://')).toBe(false));
  });

  describe('getPasswordStrength comprehensive', () => {
    it('empty → weak', () => expect(getPasswordStrength('')).toBe('weak'));
    it('short lowercase → weak', () => expect(getPasswordStrength('abc')).toBe('weak'));
    it('8 chars lowercase → weak', () => expect(getPasswordStrength('abcdefgh')).toBe('weak'));
    it('8 chars mixed case → medium', () => expect(getPasswordStrength('Abcdefgh')).toBe('medium'));
    it('12 chars mixed → medium', () => expect(getPasswordStrength('Abcdefghijkl')).toBe('medium'));
    it('12 mixed + numbers → strong', () => expect(getPasswordStrength('Abcdefghijk1')).toBe('strong'));
    it('complex → strong', () => expect(getPasswordStrength('P@ssw0rd!2026')).toBe('strong'));
  });

  describe('isValidDateRange', () => {
    it('start < end → true', () => expect(isValidDateRange(new Date(2026, 0, 1), new Date(2026, 5, 1))).toBe(true));
    it('same date → true', () => {
      const d = new Date(2026, 2, 9);
      expect(isValidDateRange(d, d)).toBe(true);
    });
    it('start > end → false', () => expect(isValidDateRange(new Date(2026, 5, 1), new Date(2026, 0, 1))).toBe(false));
  });

  describe('isInRange', () => {
    it('in range', () => expect(isInRange(5, 0, 10)).toBe(true));
    it('at min', () => expect(isInRange(0, 0, 10)).toBe(true));
    it('at max', () => expect(isInRange(10, 0, 10)).toBe(true));
    it('below', () => expect(isInRange(-1, 0, 10)).toBe(false));
    it('above', () => expect(isInRange(11, 0, 10)).toBe(false));
  });

  describe('isRequired comprehensive', () => {
    it('null → false', () => expect(isRequired(null)).toBe(false));
    it('undefined → false', () => expect(isRequired(undefined)).toBe(false));
    it('empty string → false', () => expect(isRequired('')).toBe(false));
    it('whitespace → false', () => expect(isRequired('   ')).toBe(false));
    it('empty array → false', () => expect(isRequired([])).toBe(false));
    it('string → true', () => expect(isRequired('hello')).toBe(true));
    it('array with items → true', () => expect(isRequired([1])).toBe(true));
    it('number 0 → true', () => expect(isRequired(0)).toBe(true));
    it('false → true', () => expect(isRequired(false)).toBe(true));
    it('object → true', () => expect(isRequired({})).toBe(true));
  });

  describe('isValidFrenchPostalCode', () => {
    it('75001 → true', () => expect(isValidFrenchPostalCode('75001')).toBe(true));
    it('97400 → true', () => expect(isValidFrenchPostalCode('97400')).toBe(true));
    it('4 digits → false', () => expect(isValidFrenchPostalCode('7500')).toBe(false));
    it('6 digits → false', () => expect(isValidFrenchPostalCode('750001')).toBe(false));
    it('letters → false', () => expect(isValidFrenchPostalCode('ABCDE')).toBe(false));
  });

  describe('isValidAmount', () => {
    it('0 → true', () => expect(isValidAmount(0)).toBe(true));
    it('100 → true', () => expect(isValidAmount(100)).toBe(true));
    it('0.5 → true', () => expect(isValidAmount(0.5)).toBe(true));
    it('-1 → false', () => expect(isValidAmount(-1)).toBe(false));
    it('NaN → false', () => expect(isValidAmount(NaN)).toBe(false));
    it('Infinity → false', () => expect(isValidAmount(Infinity)).toBe(false));
  });

  describe('isValidFibonacciPoints', () => {
    it('valid points', () => {
      [1, 2, 3, 5, 8, 13, 21, 34].forEach(p => expect(isValidFibonacciPoints(p)).toBe(true));
    });
    it('invalid points', () => {
      [0, 4, 6, 7, 9, 10, 15, 20, 35].forEach(p => expect(isValidFibonacciPoints(p)).toBe(false));
    });
  });

  describe('isValidSlug', () => {
    it('simple', () => expect(isValidSlug('hello')).toBe(true));
    it('with dashes', () => expect(isValidSlug('hello-world')).toBe(true));
    it('with numbers', () => expect(isValidSlug('page-42')).toBe(true));
    it('uppercase → false', () => expect(isValidSlug('Hello')).toBe(false));
    it('spaces → false', () => expect(isValidSlug('hello world')).toBe(false));
    it('leading dash → false', () => expect(isValidSlug('-hello')).toBe(false));
    it('trailing dash → false', () => expect(isValidSlug('hello-')).toBe(false));
    it('double dash → false', () => expect(isValidSlug('hello--world')).toBe(false));
    it('empty → false', () => expect(isValidSlug('')).toBe(false));
  });
});
