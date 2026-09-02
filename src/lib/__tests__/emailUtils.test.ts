import { describe, it, expect } from 'vitest';
import { isGenericDomain, formatContactRole, GENERIC_EMAIL_DOMAINS } from '../emailUtils';

describe('isGenericDomain', () => {
  it('detects common public mailbox domains', () => {
    expect(isGenericDomain('gmail.com')).toBe(true);
    expect(isGenericDomain('Hotmail.fr')).toBe(true); // case-insensitive
    expect(isGenericDomain('yahoo.fr')).toBe(true);
    expect(isGenericDomain('orange.fr')).toBe(true);
    expect(isGenericDomain('protonmail.com')).toBe(true);
  });
  it('rejects professional domains', () => {
    expect(isGenericDomain('exploitant.example.org')).toBe(false);
    expect(isGenericDomain('clinique-monceau.example.org')).toBe(false);
  });
  it('GENERIC_EMAIL_DOMAINS is non-empty unique array', () => {
    expect(GENERIC_EMAIL_DOMAINS.length).toBeGreaterThan(20);
    expect(new Set(GENERIC_EMAIL_DOMAINS).size).toBe(GENERIC_EMAIL_DOMAINS.length);
  });
});

describe('formatContactRole', () => {
  it('returns null for falsy input', () => {
    expect(formatContactRole(null)).toBeNull();
    expect(formatContactRole('')).toBeNull();
  });
  it('maps known roles to friendly labels', () => {
    expect(formatContactRole('direction')).toBe('Direction');
    expect(formatContactRole('administratif')).toBe('Admin');
    expect(formatContactRole('informatique')).toBe('DSI');
    expect(formatContactRole('dsi')).toBe('DSI');
    expect(formatContactRole('dim')).toBe('DIM');
    expect(formatContactRole('operationnel')).toBe('Opérationnel');
    expect(formatContactRole('cliniciens')).toBe('Clinicien');
    expect(formatContactRole('secretariat')).toBe('Secrétariat');
    expect(formatContactRole('medical')).toBe('Médical');
    expect(formatContactRole('technique')).toBe('Technique');
  });
});
