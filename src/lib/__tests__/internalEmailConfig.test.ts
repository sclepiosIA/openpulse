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

describe('internalEmailConfig', () => {
  describe('constants', () => {
    it('includes marque domains', () => {
      expect(INTERNAL_DOMAINS).toContain('exploitant.example.org');
      expect(INTERNAL_DOMAINS).toContain('marque.ai');
    });
    it('includes common generic domains', () => {
      expect(GENERIC_DOMAINS).toContain('gmail.com');
      expect(GENERIC_DOMAINS).toContain('outlook.com');
    });
  });

  describe('normalizeEmail', () => {
    it('returns null for empty', () => expect(normalizeEmail('')).toBeNull());
    it('returns null for undefined', () => expect(normalizeEmail(undefined)).toBeNull());
    it('lowercases', () => expect(normalizeEmail('Test@Example.com')).toBe('test@example.com'));
    it('extracts from angle brackets', () => {
      expect(normalizeEmail('Jean Dupont <jean@test.com>')).toBe('jean@test.com');
    });
    it('returns null for no @', () => expect(normalizeEmail('not-an-email')).toBeNull());
    it('trims whitespace', () => expect(normalizeEmail('  a@b.com  ')).toBe('a@b.com'));
  });

  describe('isMarqueEmail', () => {
    it('true for exploitant.example.org', () => expect(isMarqueEmail('user@exploitant.example.org')).toBe(true));
    it('true for marque.ai', () => expect(isMarqueEmail('user@marque.ai')).toBe(true));
    it('false for random email', () => expect(isMarqueEmail('user@hospital.fr')).toBe(false));
    it('false for external gmail', () => expect(isMarqueEmail('membre.equipe@example.invalid')).toBe(false));
    it('false for empty', () => expect(isMarqueEmail('')).toBe(false));
    it('false for undefined', () => expect(isMarqueEmail(undefined)).toBe(false));
  });

  describe('isInternalDomain', () => {
    it('true for internal', () => expect(isInternalDomain('exploitant.example.org')).toBe(true));
    it('false for external', () => expect(isInternalDomain('google.com')).toBe(false));
    it('false for null', () => expect(isInternalDomain(null)).toBe(false));
    it('case insensitive', () => expect(isInternalDomain('EXPLOITANT.EXAMPLE.ORG')).toBe(true));
  });

  describe('extractEmailDomain', () => {
    it('extracts domain', () => expect(extractEmailDomain('user@hospital.fr')).toBe('hospital.fr'));
    it('returns null for empty', () => expect(extractEmailDomain(undefined)).toBeNull());
    it('lowercases', () => expect(extractEmailDomain('user@HOSPITAL.FR')).toBe('hospital.fr'));
  });

  describe('isGenericEmailDomain', () => {
    it('true for gmail', () => expect(isGenericEmailDomain('gmail.com')).toBe(true));
    it('true for null', () => expect(isGenericEmailDomain(null)).toBe(true));
    it('false for custom domain', () => expect(isGenericEmailDomain('hospital.fr')).toBe(false));
  });

  describe('getExternalDomain', () => {
    it('returns domain for external', () => expect(getExternalDomain('user@hospital.fr')).toBe('hospital.fr'));
    it('returns null for internal', () => expect(getExternalDomain('user@exploitant.example.org')).toBeNull());
    it('returns null for generic', () => expect(getExternalDomain('user@gmail.com')).toBeNull());
    it('returns null for empty', () => expect(getExternalDomain(undefined)).toBeNull());
  });
});
