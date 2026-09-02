import { describe, it, expect } from 'vitest';
import {
  INTERNAL_DOMAINS,
  GENERIC_DOMAINS,
  normalizeEmail,
  isMarqueEmail,
  isInternalDomain,
  extractEmailDomain,
  isGenericEmailDomain,
  getExternalDomain,
} from '../internalEmailConfig';

describe('internalEmailConfig extended2', () => {
  describe('constants', () => {
    it('INTERNAL_DOMAINS has 2 domains', () => expect(INTERNAL_DOMAINS).toHaveLength(2));
    it('includes exploitant.example.org', () => expect(INTERNAL_DOMAINS).toContain('exploitant.example.org'));
    it('GENERIC_DOMAINS has 8+ domains', () => expect(GENERIC_DOMAINS.length).toBeGreaterThanOrEqual(8));
    it('includes gmail.com', () => expect(GENERIC_DOMAINS).toContain('gmail.com'));
  });

  describe('normalizeEmail', () => {
    it('returns null for undefined', () => expect(normalizeEmail(undefined)).toBeNull());
    it('returns null for empty', () => expect(normalizeEmail('')).toBeNull());
    it('extracts email from angle brackets', () => {
      expect(normalizeEmail('Jean Dupont <jean@test.com>')).toBe('jean@test.com');
    });
    it('trims plain email', () => expect(normalizeEmail('  jean@test.com  ')).toBe('jean@test.com'));
    it('handles email without angle brackets', () => expect(normalizeEmail('test@test.com')).toBe('test@test.com'));
  });

  describe('isMarqueEmail', () => {
    it('true for exploitant.example.org', () => expect(isMarqueEmail('user@exploitant.example.org')).toBe(true));
    it('true for marque.ai', () => expect(isMarqueEmail('user@marque.ai')).toBe(true));
    it('case insensitive', () => expect(isMarqueEmail('User@EXPLOITANT.EXAMPLE.ORG')).toBe(true));
    it('false for external', () => expect(isMarqueEmail('user@gmail.com')).toBe(false));
    it('false for undefined', () => expect(isMarqueEmail(undefined)).toBe(false));
  });

  describe('isInternalDomain', () => {
    it('true for exploitant.example.org', () => expect(isInternalDomain('exploitant.example.org')).toBe(true));
    it('false for gmail.com', () => expect(isInternalDomain('gmail.com')).toBe(false));
    it('false for null', () => expect(isInternalDomain(null)).toBe(false));
  });

  describe('extractEmailDomain', () => {
    it('extracts domain', () => expect(extractEmailDomain('user@test.com')).toBe('test.com'));
    it('lowercase', () => expect(extractEmailDomain('user@TEST.COM')).toBe('test.com'));
    it('null for undefined', () => expect(extractEmailDomain(undefined)).toBeNull());
    it('null for invalid', () => expect(extractEmailDomain('noemail')).toBeNull());
  });

  describe('isGenericEmailDomain', () => {
    it('true for gmail.com', () => expect(isGenericEmailDomain('gmail.com')).toBe(true));
    it('true for outlook.com', () => expect(isGenericEmailDomain('outlook.com')).toBe(true));
    it('true for null', () => expect(isGenericEmailDomain(null)).toBe(true));
    it('true for undefined', () => expect(isGenericEmailDomain(undefined)).toBe(true));
    it('false for company domain', () => expect(isGenericEmailDomain('exploitant.example.org')).toBe(false));
  });

  describe('getExternalDomain', () => {
    it('returns domain for external', () => expect(getExternalDomain('user@hospital.fr')).toBe('hospital.fr'));
    it('null for internal', () => expect(getExternalDomain('user@exploitant.example.org')).toBeNull());
    it('null for generic', () => expect(getExternalDomain('user@gmail.com')).toBeNull());
    it('null for undefined', () => expect(getExternalDomain(undefined)).toBeNull());
  });
});
