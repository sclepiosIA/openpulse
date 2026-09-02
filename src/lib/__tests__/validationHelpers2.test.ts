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

describe('validationHelpers', () => {
  describe('isValidEmail', () => {
    it('valid', () => expect(isValidEmail('a@b.com')).toBe(true));
    it('invalid', () => expect(isValidEmail('notanemail')).toBe(false));
    it('no @', () => expect(isValidEmail('abc.com')).toBe(false));
  });

  describe('isValidFrenchPhone', () => {
    it('valid 0X', () => expect(isValidFrenchPhone('06 12 34 56 78')).toBe(true));
    it('valid +33', () => expect(isValidFrenchPhone('+33612345678')).toBe(true));
    it('invalid', () => expect(isValidFrenchPhone('123')).toBe(false));
  });

  describe('isValidSiret', () => {
    it('valid (La Poste HQ)', () => expect(isValidSiret('35600000000048')).toBe(true));
    it('invalid length', () => expect(isValidSiret('123')).toBe(false));
    it('invalid checksum', () => expect(isValidSiret('12345678901234')).toBe(false));
  });

  describe('isValidUrl', () => {
    it('valid', () => expect(isValidUrl('https://example.com')).toBe(true));
    it('invalid', () => expect(isValidUrl('not a url')).toBe(false));
  });

  describe('getPasswordStrength', () => {
    it('weak', () => expect(getPasswordStrength('ab')).toBe('weak'));
    it('medium', () => expect(getPasswordStrength('Abc12345')).toBe('medium'));
    it('strong', () => expect(getPasswordStrength('Abc12345!@#longpassword')).toBe('strong'));
  });

  describe('isValidDateRange', () => {
    it('valid', () => expect(isValidDateRange(new Date(2020, 0), new Date(2021, 0))).toBe(true));
    it('same date', () => expect(isValidDateRange(new Date(2020, 0), new Date(2020, 0))).toBe(true));
    it('invalid', () => expect(isValidDateRange(new Date(2021, 0), new Date(2020, 0))).toBe(false));
  });

  describe('isInRange', () => {
    it('in range', () => expect(isInRange(5, 1, 10)).toBe(true));
    it('at min', () => expect(isInRange(1, 1, 10)).toBe(true));
    it('below', () => expect(isInRange(0, 1, 10)).toBe(false));
  });

  describe('isRequired', () => {
    it('string → true', () => expect(isRequired('hello')).toBe(true));
    it('empty string → false', () => expect(isRequired('')).toBe(false));
    it('null → false', () => expect(isRequired(null)).toBe(false));
    it('undefined → false', () => expect(isRequired(undefined)).toBe(false));
    it('array → true', () => expect(isRequired([1])).toBe(true));
    it('empty array → false', () => expect(isRequired([])).toBe(false));
    it('number → true', () => expect(isRequired(0)).toBe(true));
  });

  describe('isValidFrenchPostalCode', () => {
    it('valid', () => expect(isValidFrenchPostalCode('75001')).toBe(true));
    it('invalid', () => expect(isValidFrenchPostalCode('7500')).toBe(false));
  });

  describe('isValidAmount', () => {
    it('valid', () => expect(isValidAmount(100)).toBe(true));
    it('zero', () => expect(isValidAmount(0)).toBe(true));
    it('negative', () => expect(isValidAmount(-1)).toBe(false));
    it('NaN', () => expect(isValidAmount(NaN)).toBe(false));
    it('Infinity', () => expect(isValidAmount(Infinity)).toBe(false));
  });

  describe('isValidFibonacciPoints', () => {
    it('valid', () => expect(isValidFibonacciPoints(5)).toBe(true));
    it('invalid', () => expect(isValidFibonacciPoints(4)).toBe(false));
    it('valid 21', () => expect(isValidFibonacciPoints(21)).toBe(true));
  });

  describe('isValidSlug', () => {
    it('valid', () => expect(isValidSlug('my-slug')).toBe(true));
    it('valid simple', () => expect(isValidSlug('test')).toBe(true));
    it('invalid spaces', () => expect(isValidSlug('my slug')).toBe(false));
    it('invalid uppercase', () => expect(isValidSlug('MySlug')).toBe(false));
    it('invalid leading dash', () => expect(isValidSlug('-slug')).toBe(false));
  });
});
