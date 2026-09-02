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
  it('isValidEmail', () => {
    expect(isValidEmail('a@b.fr')).toBe(true);
    expect(isValidEmail('bad')).toBe(false);
    expect(isValidEmail('a@b')).toBe(false);
  });

  it('isValidFrenchPhone', () => {
    expect(isValidFrenchPhone('0612345678')).toBe(true);
    expect(isValidFrenchPhone('+33612345678')).toBe(true);
    expect(isValidFrenchPhone('0033612345678')).toBe(true);
    expect(isValidFrenchPhone('012')).toBe(false);
  });

  it('isValidSiret with valid Luhn-like check', () => {
    // SIRET 73282932000074 is a well-known valid one (La Poste)
    expect(isValidSiret('73282932000074')).toBe(true);
    expect(isValidSiret('12345678901234')).toBe(false);
    expect(isValidSiret('abc')).toBe(false);
  });

  it('isValidUrl', () => {
    expect(isValidUrl('https://x.fr')).toBe(true);
    expect(isValidUrl('not a url')).toBe(false);
  });

  it('getPasswordStrength', () => {
    expect(getPasswordStrength('abc')).toBe('weak');
    expect(getPasswordStrength('Abcdefg1')).toBe('medium');
    expect(getPasswordStrength('Abcdefghi1!')).toBe('strong');
  });

  it('isValidDateRange', () => {
    expect(isValidDateRange(new Date('2024-01-01'), new Date('2024-02-01'))).toBe(true);
    expect(isValidDateRange(new Date('2024-02-01'), new Date('2024-01-01'))).toBe(false);
  });

  it('isInRange', () => {
    expect(isInRange(5, 0, 10)).toBe(true);
    expect(isInRange(-1, 0, 10)).toBe(false);
    expect(isInRange(10, 0, 10)).toBe(true);
  });

  it('isRequired', () => {
    expect(isRequired(null)).toBe(false);
    expect(isRequired(undefined)).toBe(false);
    expect(isRequired('')).toBe(false);
    expect(isRequired('   ')).toBe(false);
    expect(isRequired([])).toBe(false);
    expect(isRequired(['x'])).toBe(true);
    expect(isRequired(0)).toBe(true);
  });

  it('isValidFrenchPostalCode', () => {
    expect(isValidFrenchPostalCode('75001')).toBe(true);
    expect(isValidFrenchPostalCode('7500')).toBe(false);
  });

  it('isValidAmount', () => {
    expect(isValidAmount(100)).toBe(true);
    expect(isValidAmount(-1)).toBe(false);
    expect(isValidAmount(NaN)).toBe(false);
    expect(isValidAmount(Infinity)).toBe(false);
  });

  it('isValidFibonacciPoints', () => {
    expect(isValidFibonacciPoints(1)).toBe(true);
    expect(isValidFibonacciPoints(8)).toBe(true);
    expect(isValidFibonacciPoints(4)).toBe(false);
  });

  it('isValidSlug', () => {
    expect(isValidSlug('hello-world')).toBe(true);
    expect(isValidSlug('hello')).toBe(true);
    expect(isValidSlug('Hello')).toBe(false);
    expect(isValidSlug('hello--world')).toBe(false);
    expect(isValidSlug('-hello')).toBe(false);
  });
});
