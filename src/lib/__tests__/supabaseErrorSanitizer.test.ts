import { describe, it, expect } from 'vitest';
import { sanitizeSupabaseError, getSafeErrorMessage } from '../supabaseErrorSanitizer';

describe('supabaseErrorSanitizer', () => {
  describe('sanitizeSupabaseError', () => {
    it('sanitizes RLS violation', () => {
      expect(sanitizeSupabaseError('new row violates row-level security policy for table "profiles"'))
        .toBe("Vous n'avez pas les permissions pour cette action.");
    });

    it('sanitizes foreign key violation', () => {
      expect(sanitizeSupabaseError('violates foreign key constraint "fk_xyz"'))
        .toBe("Cet élément est lié à d'autres données et ne peut pas être modifié.");
    });

    it('sanitizes referenced from table', () => {
      expect(sanitizeSupabaseError('is still referenced from table "taches"'))
        .toBe("Cet élément est utilisé ailleurs et ne peut pas être supprimé.");
    });

    it('sanitizes unique constraint', () => {
      expect(sanitizeSupabaseError('violates unique constraint "profiles_email_key"'))
        .toBe("Un élément avec ces informations existe déjà.");
    });

    it('sanitizes duplicate key', () => {
      expect(sanitizeSupabaseError('duplicate key value violates unique constraint'))
        .toBe("Un élément avec ces informations existe déjà.");
    });

    it('sanitizes not-null violation', () => {
      expect(sanitizeSupabaseError('null value in column "nom" violates not-null constraint'))
        .toBe("Un champ obligatoire n'a pas été renseigné.");
    });

    it('sanitizes check constraint', () => {
      expect(sanitizeSupabaseError('violates check constraint "valid_email"'))
        .toBe("Les données saisies ne respectent pas les règles de validation.");
    });

    it('sanitizes permission denied', () => {
      expect(sanitizeSupabaseError('permission denied for table etablissements'))
        .toBe("Vous n'avez pas les permissions nécessaires.");
    });

    it('sanitizes JWT expired', () => {
      expect(sanitizeSupabaseError('JWT expired'))
        .toBe("Votre session a expiré. Veuillez vous reconnecter.");
    });

    it('sanitizes network errors', () => {
      expect(sanitizeSupabaseError('FetchError: network connection lost'))
        .toBe("Erreur réseau. Vérifiez votre connexion internet.");
    });

    it('sanitizes timeout', () => {
      expect(sanitizeSupabaseError('AbortError: The operation was aborted'))
        .toBe("La requête a pris trop de temps. Réessayez.");
    });

    it('sanitizes rate limit', () => {
      expect(sanitizeSupabaseError('too many requests'))
        .toBe("Trop de requêtes. Veuillez patienter.");
    });

    it('sanitizes "for table" leaks', () => {
      expect(sanitizeSupabaseError('some error for table "secret_table"'))
        .toBe("Une erreur est survenue lors de l'opération.");
    });

    it('sanitizes raw PostgreSQL errors', () => {
      expect(sanitizeSupabaseError('ERROR: relation "pg_catalog.xyz" does not exist'))
        .toBe("Erreur de configuration. Contactez le support.");
    });

    it('passes through safe user-facing messages', () => {
      expect(sanitizeSupabaseError('Veuillez remplir tous les champs'))
        .toBe('Veuillez remplir tous les champs');
    });

    it('handles Error objects', () => {
      expect(sanitizeSupabaseError(new Error('JWT expired')))
        .toBe("Votre session a expiré. Veuillez vous reconnecter.");
    });

    it('returns default for empty/null', () => {
      expect(sanitizeSupabaseError(null)).toBe("Une erreur inconnue est survenue.");
      expect(sanitizeSupabaseError('')).toBe("Une erreur inconnue est survenue.");
    });
  });

  describe('getSafeErrorMessage', () => {
    it('returns sanitized message', () => {
      expect(getSafeErrorMessage('JWT expired'))
        .toBe("Votre session a expiré. Veuillez vous reconnecter.");
    });
    it('uses fallback when empty', () => {
      expect(getSafeErrorMessage(null, 'Fallback message'))
        .toBe("Une erreur inconnue est survenue.");
    });
  });
});
