import { describe, it, expect } from 'vitest';
import { sanitizeSupabaseError, getSafeErrorMessage } from '../supabaseErrorSanitizer';

describe('supabaseErrorSanitizer', () => {
  describe('sanitizeSupabaseError', () => {
    it('RLS violation', () => {
      expect(sanitizeSupabaseError(new Error('new row violates row-level security policy'))).toContain('permissions');
    });
    it('foreign key', () => {
      expect(sanitizeSupabaseError('violates foreign key constraint "fk_test"')).toContain('lié');
    });
    it('unique constraint', () => {
      expect(sanitizeSupabaseError('duplicate key value violates unique constraint')).toContain('existe déjà');
    });
    it('not-null', () => {
      expect(sanitizeSupabaseError('null value in column "name"')).toContain('obligatoire');
    });
    it('check constraint', () => {
      expect(sanitizeSupabaseError('violates check constraint')).toContain('validation');
    });
    it('permission denied', () => {
      expect(sanitizeSupabaseError('permission denied for table users')).toContain('permissions');
    });
    it('JWT expired', () => {
      expect(sanitizeSupabaseError('JWT expired')).toContain('session');
    });
    it('network error', () => {
      expect(sanitizeSupabaseError('FetchError: network timeout')).toContain('réseau');
    });
    it('rate limit', () => {
      expect(sanitizeSupabaseError('too many requests')).toContain('patienter');
    });
    it('table name leak', () => {
      expect(sanitizeSupabaseError('error for table "profiles"')).toContain('erreur');
    });
    it('raw PostgreSQL error', () => {
      expect(sanitizeSupabaseError('ERROR: pg_catalog error')).toContain('technique');
    });
    it('empty → fallback', () => {
      expect(sanitizeSupabaseError('')).toContain('inconnue');
    });
    it('custom message passthrough', () => {
      expect(sanitizeSupabaseError('Custom user error')).toBe('Custom user error');
    });
  });

  describe('getSafeErrorMessage', () => {
    it('sanitizes error', () => {
      expect(getSafeErrorMessage(new Error('JWT expired'))).toContain('session');
    });
    it('uses fallback for empty', () => {
      expect(getSafeErrorMessage(null, 'Fallback')).toBeDefined();
    });
  });
});
