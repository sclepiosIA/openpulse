import { describe, it, expect } from 'vitest';
import { sanitizeSupabaseError, getSafeErrorMessage } from '../supabaseErrorSanitizer';

describe('supabaseErrorSanitizer extended2', () => {
  describe('sanitizeSupabaseError', () => {
    it('RLS violation', () => {
      expect(sanitizeSupabaseError(new Error('new row violates row-level security policy for table users'))).toBe("Vous n'avez pas les permissions pour cette action.");
    });

    it('FK violation', () => {
      expect(sanitizeSupabaseError('violates foreign key constraint "fk_user"')).toBe("Cet élément est lié à d'autres données et ne peut pas être modifié.");
    });

    it('referenced from table', () => {
      expect(sanitizeSupabaseError('is still referenced from table "orders"')).toBe("Cet élément est utilisé ailleurs et ne peut pas être supprimé.");
    });

    it('unique violation', () => {
      expect(sanitizeSupabaseError('violates unique constraint "email_key"')).toBe("Un élément avec ces informations existe déjà.");
    });

    it('duplicate key', () => {
      expect(sanitizeSupabaseError('duplicate key value violates unique constraint')).toBe("Un élément avec ces informations existe déjà.");
    });

    it('not null violation', () => {
      expect(sanitizeSupabaseError('violates not-null constraint')).toBe("Un champ obligatoire n'a pas été renseigné.");
    });

    it('null value in column', () => {
      expect(sanitizeSupabaseError('null value in column "name"')).toBe("Un champ obligatoire n'a pas été renseigné.");
    });

    it('check constraint', () => {
      expect(sanitizeSupabaseError('violates check constraint "positive_amount"')).toBe("Les données saisies ne respectent pas les règles de validation.");
    });

    it('permission denied', () => {
      expect(sanitizeSupabaseError('permission denied for table users')).toBe("Vous n'avez pas les permissions nécessaires.");
    });

    it('JWT expired', () => {
      expect(sanitizeSupabaseError('JWT expired')).toBe("Votre session a expiré. Veuillez vous reconnecter.");
    });

    it('invalid claim', () => {
      expect(sanitizeSupabaseError('invalid claim: iss')).toBe("Erreur d'authentification. Veuillez vous reconnecter.");
    });

    it('function does not exist', () => {
      expect(sanitizeSupabaseError('function my_func does not exist')).toBe("Fonctionnalité temporairement indisponible.");
    });

    it('relation does not exist', () => {
      expect(sanitizeSupabaseError('relation "my_table" does not exist')).toBe("Erreur de configuration. Contactez le support.");
    });

    it('network error', () => {
      expect(sanitizeSupabaseError('FetchError: network timeout')).toBe("Erreur réseau. Vérifiez votre connexion internet.");
    });

    it('timeout', () => {
      expect(sanitizeSupabaseError('AbortError: timeout')).toBe("La requête a pris trop de temps. Réessayez.");
    });

    it('rate limit', () => {
      expect(sanitizeSupabaseError('too many requests')).toBe("Trop de requêtes. Veuillez patienter.");
    });

    it('table name leak → sanitized', () => {
      expect(sanitizeSupabaseError('error for table "secret_table"')).toBe("Une erreur est survenue lors de l'opération.");
    });

    it('pg_ error → sanitized', () => {
      expect(sanitizeSupabaseError('ERROR: pg_catalog issue')).toBe("Une erreur technique est survenue. Réessayez ou contactez le support.");
    });

    it('empty → default', () => {
      expect(sanitizeSupabaseError('')).toBe("Une erreur inconnue est survenue.");
    });

    it('null → default', () => {
      expect(sanitizeSupabaseError(null)).toBe("Une erreur inconnue est survenue.");
    });

    it('safe message passes through', () => {
      expect(sanitizeSupabaseError('Cet email est déjà utilisé')).toBe('Cet email est déjà utilisé');
    });
  });

  describe('getSafeErrorMessage', () => {
    it('returns sanitized message', () => {
      expect(getSafeErrorMessage(new Error('JWT expired'))).toBe("Votre session a expiré. Veuillez vous reconnecter.");
    });

    it('uses fallback for empty — sanitizeSupabaseError returns default', () => {
      expect(getSafeErrorMessage('', 'Mon fallback')).toBe("Une erreur inconnue est survenue.");
    });

    it('default fallback for null', () => {
      expect(getSafeErrorMessage(null)).toBe("Une erreur inconnue est survenue.");
    });
  });
});
