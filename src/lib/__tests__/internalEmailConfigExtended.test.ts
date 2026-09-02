import { describe, it, expect } from 'vitest';
import {
  INTERNAL_DOMAINS,
  GENERIC_DOMAINS,
  normalizeEmail,
  isMarqueEmail,
  isMarqueEmailFull,
  isInternalDomain,
  extractEmailDomain,
  isGenericEmailDomain,
  getExternalDomain,
} from '../internalEmailConfig';

describe('internalEmailConfig', () => {
  describe('constants', () => {
    it('INTERNAL_DOMAINS includes exploitant.example.org', () => {
      expect(INTERNAL_DOMAINS).toContain('exploitant.example.org');
    });
    it('GENERIC_DOMAINS includes gmail.com', () => {
      expect(GENERIC_DOMAINS).toContain('gmail.com');
    });
  });

  describe('normalizeEmail', () => {
    it('extracts from angle brackets', () => {
      expect(normalizeEmail('Jean <jean@test.com>')).toBe('jean@test.com');
    });
    it('lowercases', () => expect(normalizeEmail('TEST@Example.COM')).toBe('test@example.com'));
    it('returns null for empty', () => expect(normalizeEmail('')).toBeNull());
    it('returns null for undefined', () => expect(normalizeEmail(undefined)).toBeNull());
    it('returns null for no @', () => expect(normalizeEmail('not-email')).toBeNull());
    it('trims whitespace', () => expect(normalizeEmail('  test@t.com  ')).toBe('test@t.com'));
  });

  describe('isMarqueEmail', () => {
    it('true for internal domain', () => expect(isMarqueEmail('user@exploitant.example.org')).toBe(true));
    it('false for external', () => expect(isMarqueEmail('user@gmail.com')).toBe(false));
    it('false for empty', () => expect(isMarqueEmail('')).toBe(false));
    it('false for undefined', () => expect(isMarqueEmail(undefined)).toBe(false));
  });

  describe('isMarqueEmailFull', () => {
    const teamEmails = ['membre.equipe@example.invalid'];
    it('true for internal domain', () => expect(isMarqueEmailFull('user@exploitant.example.org', teamEmails)).toBe(true));
    it('true for team email', () => expect(isMarqueEmailFull('membre.equipe@example.invalid', teamEmails)).toBe(true));
    it('false for external', () => expect(isMarqueEmailFull('user@gmail.com', teamEmails)).toBe(false));
  });

  describe('isInternalDomain', () => {
    it('true for exploitant.example.org', () => expect(isInternalDomain('exploitant.example.org')).toBe(true));
    it('true for marque.ai', () => expect(isInternalDomain('marque.ai')).toBe(true));
    it('false for gmail.com', () => expect(isInternalDomain('gmail.com')).toBe(false));
    it('false for null', () => expect(isInternalDomain(null)).toBe(false));
    it('case insensitive', () => expect(isInternalDomain('EXPLOITANT.EXAMPLE.ORG')).toBe(true));
  });

  describe('extractEmailDomain', () => {
    it('extracts domain', () => expect(extractEmailDomain('user@example.com')).toBe('example.com'));
    it('lowercases', () => expect(extractEmailDomain('user@EXAMPLE.COM')).toBe('example.com'));
    it('returns null for no @', () => expect(extractEmailDomain('noemail')).toBeNull());
    it('returns null for empty', () => expect(extractEmailDomain('')).toBeNull());
    it('returns null for undefined', () => expect(extractEmailDomain(undefined)).toBeNull());
  });

  describe('isGenericEmailDomain', () => {
    it('true for gmail.com', () => expect(isGenericEmailDomain('gmail.com')).toBe(true));
    it('true for orange.fr', () => expect(isGenericEmailDomain('orange.fr')).toBe(true));
    it('true for protonmail.com', () => expect(isGenericEmailDomain('protonmail.com')).toBe(true));
    it('false for company domain', () => expect(isGenericEmailDomain('marque.com')).toBe(false));
    it('true for null', () => expect(isGenericEmailDomain(null)).toBe(true));
    it('true for undefined', () => expect(isGenericEmailDomain(undefined)).toBe(true));
  });

  describe('getExternalDomain', () => {
    it('returns company domain', () => expect(getExternalDomain('user@hospital.fr')).toBe('hospital.fr'));
    it('returns null for gmail', () => expect(getExternalDomain('user@gmail.com')).toBeNull());
    it('returns null for internal', () => expect(getExternalDomain('user@exploitant.example.org')).toBeNull());
    it('returns null for empty', () => expect(getExternalDomain('')).toBeNull());
    it('returns null for undefined', () => expect(getExternalDomain(undefined)).toBeNull());
  });
});
