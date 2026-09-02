import { describe, it, expect } from 'vitest';
import {
  createApplicationError,
  type ApplicationError,
  type ResetPasswordData,
  type ResetPasswordResult,
} from './admin';

describe('admin', () => {
  describe('createApplicationError', () => {
    it('crée une erreur applicative avec le message et les détails', () => {
      const error = createApplicationError('Operation failed', 'Invalid state');

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Operation failed');
      expect(error.details).toBe('Invalid state');
      expect(error.isApplicationError).toBe(true);
    });

    it('crée une erreur applicative sans détails quand non fournis', () => {
      const error = createApplicationError('Only message');

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Only message');
      expect(error.details).toBeUndefined();
      expect(error.isApplicationError).toBe(true);
    });

    it('retourne un objet compatible avec l’interface ApplicationError', () => {
      const error: ApplicationError = createApplicationError('Typed error', 'Context info');

      expect(typeof error.name).toBe('string');
      expect(typeof error.message).toBe('string');
      expect(error.message).toBe('Typed error');
      expect(error.details).toBe('Context info');
      expect(error.isApplicationError).toBe(true);
    });

    it('préserve le comportement standard d’une Error', () => {
      const error = createApplicationError('Boom');

      expect(error.name).toBe('Error');
      expect(typeof error.stack).toBe('string');
      expect(String(error)).toContain('Boom');
    });
  });

  describe('types runtime shape', () => {
    it('accepte une structure ResetPasswordData valide', () => {
      const payload: ResetPasswordData = {
        userId: 'user-1',
        newPassword: 'new-pass',
      };

      expect(payload).toEqual({
        userId: 'user-1',
        newPassword: 'new-pass',
      });
    });

    it('accepte une structure ResetPasswordResult de succès', () => {
      const result: ResetPasswordResult = {
        success: true,
        message: 'Password reset',
      };

      expect(result.success).toBe(true);
      expect(result.message).toBe('Password reset');
      expect(result.error).toBeUndefined();
      expect(result.details).toBeUndefined();
    });

    it('accepte une structure ResetPasswordResult d’échec', () => {
      const result: ResetPasswordResult = {
        success: false,
        error: 'Reset failed',
        details: 'User not found',
      };

      expect(result.success).toBe(false);
      expect(result.error).toBe('Reset failed');
      expect(result.details).toBe('User not found');
      expect(result.message).toBeUndefined();
    });
  });
});