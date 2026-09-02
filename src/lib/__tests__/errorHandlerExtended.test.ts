import { describe, it, expect, vi } from 'vitest';
import { isError, getErrorMessage, logError, handleError } from '../errorHandler';

vi.mock('../debug', () => ({
  debug: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
}));

describe('errorHandler', () => {
  describe('isError', () => {
    it('true for Error', () => expect(isError(new Error('test'))).toBe(true));
    it('false for string', () => expect(isError('test')).toBe(false));
    it('false for null', () => expect(isError(null)).toBe(false));
    it('false for object', () => expect(isError({ message: 'test' })).toBe(false));
  });

  describe('getErrorMessage', () => {
    it('extracts from Error', () => expect(getErrorMessage(new Error('msg'))).toBe('msg'));
    it('returns string directly', () => expect(getErrorMessage('direct')).toBe('direct'));
    it('extracts from object with message', () => expect(getErrorMessage({ message: 'obj' })).toBe('obj'));
    it('fallback for unknown', () => expect(getErrorMessage(42)).toBe('Une erreur inconnue est survenue'));
    it('fallback for null', () => expect(getErrorMessage(null)).toBe('Une erreur inconnue est survenue'));
  });

  describe('logError', () => {
    it('does not throw', () => {
      expect(() => logError(new Error('test'), 'context')).not.toThrow();
    });
  });

  describe('handleError', () => {
    it('calls onError callback', () => {
      const onError = vi.fn();
      handleError(new Error('test'), 'ctx', onError);
      expect(onError).toHaveBeenCalledWith('test');
    });
    it('works without callback', () => {
      expect(() => handleError('err', 'ctx')).not.toThrow();
    });
  });
});
