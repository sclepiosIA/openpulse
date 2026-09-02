import { describe, it, expect } from 'vitest';
import { sanitizeEmailSubject, sanitizeDisplayName } from '@/lib/emailUtils';

describe('sanitizeEmailSubject', () => {
  it('should handle null and undefined', () => {
    expect(sanitizeEmailSubject(null)).toBe('(Sans objet)');
    expect(sanitizeEmailSubject(undefined)).toBe('(Sans objet)');
    expect(sanitizeEmailSubject('')).toBe('(Sans objet)');
  });

  it('should decode RFC 2047 MIME encoded words (quoted-printable)', () => {
    expect(sanitizeEmailSubject('=?UTF-8?Q?R=C3=A9sum=C3=A9?=')).toBe('Résumé');
    expect(sanitizeEmailSubject('=?ISO-8859-1?Q?Caf=E9?=')).toBe('Café');
    expect(sanitizeEmailSubject('=?UTF-8?Q?Bonjour_le_monde?=')).toBe('Bonjour le monde');
  });

  it('should decode RFC 2047 MIME encoded words (Base64)', () => {
    // "Résumé" in Base64
    expect(sanitizeEmailSubject('=?UTF-8?B?UsOpc3Vtw6k=?=')).toBe('Résumé');
  });

  it('should fix malformed UTF-8 encoding', () => {
    expect(sanitizeEmailSubject('RÃ©sumÃ©')).toBe('Résumé');
    expect(sanitizeEmailSubject('CafÃ© et thÃ©')).toBe('Café et thé');
    expect(sanitizeEmailSubject('Ã‰tablissement')).toBe('Établissement');
  });

  it('should decode HTML entities', () => {
    expect(sanitizeEmailSubject('R&eacute;sum&eacute;')).toBe('Résumé');
    expect(sanitizeEmailSubject('&lt;Test&gt;')).toBe('<Test>');
    expect(sanitizeEmailSubject('&amp;&amp;')).toBe('&&');
  });

  it('should handle double-encoded content', () => {
    // First MIME, then malformed UTF-8
    expect(sanitizeEmailSubject('=?UTF-8?Q?Test?= RÃ©sumÃ©')).toBe('Test Résumé');
  });

  it('should normalize whitespace', () => {
    expect(sanitizeEmailSubject('  Multiple   spaces  ')).toBe('Multiple spaces');
    expect(sanitizeEmailSubject('Line\nBreak')).toBe('Line Break');
    expect(sanitizeEmailSubject('Tab\tCharacter')).toBe('Tab Character');
  });

  it('should handle complex real-world examples', () => {
    expect(sanitizeEmailSubject('=?UTF-8?Q?Re:_Demande_d=27information?=')).toBe("Re: Demande d'information");
    expect(sanitizeEmailSubject('FW: =?ISO-8859-1?Q?Caf=E9_du_matin?=')).toBe('FW: Café du matin');
  });

  it('should preserve already-correct text', () => {
    expect(sanitizeEmailSubject('Simple Subject')).toBe('Simple Subject');
    expect(sanitizeEmailSubject('Réunion de projet')).toBe('Réunion de projet');
  });

  it('should handle empty subject after cleaning', () => {
    expect(sanitizeEmailSubject('   ')).toBe('(Sans objet)');
    expect(sanitizeEmailSubject('\n\n')).toBe('(Sans objet)');
  });
});

describe('sanitizeDisplayName', () => {
  it('should handle null and undefined', () => {
    expect(sanitizeDisplayName(null)).toBe(null);
    expect(sanitizeDisplayName(undefined)).toBe(null);
    expect(sanitizeDisplayName('')).toBe(null);
  });

  it('should decode RFC 2047 MIME encoded names', () => {
    expect(sanitizeDisplayName('=?UTF-8?Q?Jean_Fran=C3=A7ois?=')).toBe('Jean François');
    expect(sanitizeDisplayName('=?ISO-8859-1?Q?Ren=E9_Dupont?=')).toBe('René Dupont');
  });

  it('should fix malformed UTF-8 encoding in names', () => {
    expect(sanitizeDisplayName('Jean-FranÃ§ois')).toBe('Jean-François');
    expect(sanitizeDisplayName('RenÃ© Dupont')).toBe('René Dupont');
  });

  it('should normalize whitespace in names', () => {
    expect(sanitizeDisplayName('  Jean   Dupont  ')).toBe('Jean Dupont');
    expect(sanitizeDisplayName('Marie\nDubois')).toBe('Marie Dubois');
  });

  it('should preserve already-correct names', () => {
    expect(sanitizeDisplayName('Jean Dupont')).toBe('Jean Dupont');
    expect(sanitizeDisplayName('François Martin')).toBe('François Martin');
  });

  it('should return null for whitespace-only names', () => {
    expect(sanitizeDisplayName('   ')).toBe(null);
    expect(sanitizeDisplayName('\n\t')).toBe(null);
  });
});
