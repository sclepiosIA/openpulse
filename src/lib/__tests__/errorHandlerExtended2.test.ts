import { describe, it, expect, vi } from 'vitest';
import { isError, getErrorMessage, logError, handleError } from '../errorHandler';

vi.mock('../debug', () => ({ debug: { error: vi.fn(), warn: vi.fn(), log: vi.fn() } }));

describe('errorHandler extended2', () => {
  describe('isError', () => {
    it('Error → true', () => expect(isError(new Error('x'))).toBe(true));
    it('TypeError → true', () => expect(isError(new TypeError('x'))).toBe(true));
    it('RangeError → true', () => expect(isError(new RangeError('x'))).toBe(true));
    it('string → false', () => expect(isError('error')).toBe(false));
    it('number → false', () => expect(isError(42)).toBe(false));
    it('null → false', () => expect(isError(null)).toBe(false));
    it('undefined → false', () => expect(isError(undefined)).toBe(false));
    it('object with message → false', () => expect(isError({ message: 'x' })).toBe(false));
    it('empty object → false', () => expect(isError({})).toBe(false));
  });

  describe('getErrorMessage', () => {
    it('Error → message', () => expect(getErrorMessage(new Error('fail'))).toBe('fail'));
    it('string → string', () => expect(getErrorMessage('my error')).toBe('my error'));
    it('object with message → message', () => {
      expect(getErrorMessage({ message: 'obj error' })).toBe('obj error');
    });
    it('null → default', () => expect(getErrorMessage(null)).toBe('Une erreur inconnue est survenue'));
    it('undefined → default', () => expect(getErrorMessage(undefined)).toBe('Une erreur inconnue est survenue'));
    it('number → default', () => expect(getErrorMessage(42)).toBe('Une erreur inconnue est survenue'));
    it('empty object → default', () => expect(getErrorMessage({})).toBe('Une erreur inconnue est survenue'));
  });

  describe('logError', () => {
    it('logs with context', async () => {
      const { debug } = await import('../debug');
      logError(new Error('test'), 'MyContext');
      expect(debug.error).toHaveBeenCalledWith('[MyContext]', 'test', expect.any(Error));
    });

    it('logs string error', async () => {
      const { debug } = await import('../debug');
      logError('simple error', 'Ctx');
      expect(debug.error).toHaveBeenCalledWith('[Ctx]', 'simple error', 'simple error');
    });
  });

  describe('handleError', () => {
    it('calls onError callback', () => {
      const onError = vi.fn();
      handleError(new Error('test'), 'Ctx', onError);
      expect(onError).toHaveBeenCalledWith('test');
    });

    it('works without callback', () => {
      expect(() => handleError(new Error('test'), 'Ctx')).not.toThrow();
    });

    it('handles string error', () => {
      const onError = vi.fn();
      handleError('string error', 'Ctx', onError);
      expect(onError).toHaveBeenCalledWith('string error');
    });

    it('handles null error', () => {
      const onError = vi.fn();
      handleError(null, 'Ctx', onError);
      expect(onError).toHaveBeenCalledWith('Une erreur inconnue est survenue');
    });
  });
});
