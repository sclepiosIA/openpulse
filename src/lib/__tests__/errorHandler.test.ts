import { describe, it, expect, vi } from 'vitest';
import { isError, getErrorMessage, handleError } from '../errorHandler';

vi.mock('../debug', () => ({
  debug: { error: vi.fn(), warn: vi.fn(), log: vi.fn() },
}));

describe('errorHandler', () => {
  describe('isError', () => {
    it('returns true for Error', () => {
      expect(isError(new Error('test'))).toBe(true);
    });
    it('returns false for string', () => {
      expect(isError('not an error')).toBe(false);
    });
    it('returns false for null', () => {
      expect(isError(null)).toBe(false);
    });
  });

  describe('getErrorMessage', () => {
    it('extracts message from Error', () => {
      expect(getErrorMessage(new Error('test msg'))).toBe('test msg');
    });
    it('returns string directly', () => {
      expect(getErrorMessage('string error')).toBe('string error');
    });
    it('extracts from object with message', () => {
      expect(getErrorMessage({ message: 'obj msg' })).toBe('obj msg');
    });
    it('returns default for unknown types', () => {
      expect(getErrorMessage(42)).toBe('Une erreur inconnue est survenue');
    });
  });

  describe('handleError', () => {
    it('calls onError callback with message', () => {
      const callback = vi.fn();
      handleError(new Error('test'), 'Context', callback);
      expect(callback).toHaveBeenCalledWith('test');
    });
    it('does not throw without callback', () => {
      expect(() => handleError(new Error('test'), 'Context')).not.toThrow();
    });
  });
});
