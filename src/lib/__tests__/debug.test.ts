import { describe, it, expect, vi } from 'vitest';
import { debug } from '../debug';

describe('debug', () => {
  describe('maskId', () => {
    it('masks null/undefined', () => {
      expect(debug.maskId(null)).toBe('[null]');
      expect(debug.maskId(undefined)).toBe('[null]');
    });
    it('masks short IDs entirely', () => {
      expect(debug.maskId('abc')).toBe('***');
    });
    it('masks long IDs keeping prefix', () => {
      expect(debug.maskId('abc12345-6789-uuid')).toBe('abc12345***');
    });
  });

  describe('error', () => {
    it('always logs errors', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      debug.error('test error');
      expect(spy).toHaveBeenCalledWith('test error');
      spy.mockRestore();
    });
  });

  describe('log', () => {
    it('is a function', () => {
      expect(typeof debug.log).toBe('function');
    });
  });

  describe('warn', () => {
    it('is a function', () => {
      expect(typeof debug.warn).toBe('function');
    });
  });
});
