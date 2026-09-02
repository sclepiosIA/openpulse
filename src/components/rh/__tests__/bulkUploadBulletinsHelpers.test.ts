import { describe, it, expect, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

import {
  sanitizeFileName,
  normalizeString,
  normalizeMonthToDate,
} from '../bulkUploadBulletinsHelpers';

describe('sanitizeFileName', () => {
  it('remplace espaces par underscores et passe en minuscules', () => {
    expect(sanitizeFileName('Mon Bulletin.PDF')).toBe('mon_bulletin.pdf');
  });
  it('retire les caractères spéciaux (parenthèses, ponctuation)', () => {
    expect(sanitizeFileName('Bulletin (Mars) 2025!.pdf')).toBe('bulletin_mars_2025.pdf');
  });
  it('préserve underscore, tiret et point', () => {
    expect(sanitizeFileName('a_b-c.pdf')).toBe('a_b-c.pdf');
  });
  it('fichier sans extension', () => {
    expect(sanitizeFileName('Sans Extension')).toBe('sans_extension');
  });
  it('garde la dernière extension uniquement', () => {
    expect(sanitizeFileName('arch.tar.gz')).toBe('arch.tar.gz');
  });
});

describe('normalizeString', () => {
  it('vide / null-like → ""', () => {
    expect(normalizeString('')).toBe('');
    expect(normalizeString(undefined as any)).toBe('');
  });
  it('retire accents et passe en minuscules', () => {
    expect(normalizeString('Éléonore')).toBe('eleonore');
  });
  it('ponctuation → espace, espaces multiples compressés', () => {
    expect(normalizeString('Dupont,  Jean-Marc')).toBe('dupont jean marc');
  });
  it('trim externe', () => {
    expect(normalizeString('  Marie  ')).toBe('marie');
  });
});

describe('normalizeMonthToDate', () => {
  it('YYYY-MM → YYYY-MM-01', () => {
    expect(normalizeMonthToDate('2025-03')).toBe('2025-03-01');
  });
  it('YYYY-MM-DD → 1er du mois', () => {
    expect(normalizeMonthToDate('2025-03-15')).toBe('2025-03-01');
  });
  it('format inattendu retourné tel quel', () => {
    expect(normalizeMonthToDate('mars 2025')).toBe('mars 2025');
  });
});
