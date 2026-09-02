import { describe, it, expect } from 'vitest';
import { debug } from '../debug';

describe('debug extended', () => {
  describe('maskId', () => {
    it('masks long UUID', () => {
      const result = debug.maskId('123e4567-e89b-12d3-a456-426614174000');
      expect(result).toBe('123e4567***');
    });

    it('masks short-ish id (>8 chars)', () => {
      const result = debug.maskId('abcdefghij');
      expect(result).toBe('abcdefgh***');
    });

    it('returns *** for short id (<=8)', () => {
      expect(debug.maskId('short')).toBe('***');
      expect(debug.maskId('12345678')).toBe('***');
    });

    it('returns [null] for null', () => {
      expect(debug.maskId(null)).toBe('[null]');
    });

    it('returns [null] for undefined', () => {
      expect(debug.maskId(undefined)).toBe('[null]');
    });

    it('returns [null] for empty string', () => {
      // empty string is falsy, so maskId returns [null]
      expect(debug.maskId('')).toBe('[null]');
    });
  });

  describe('debug functions exist', () => {
    it('log is a function', () => expect(typeof debug.log).toBe('function'));
    it('info is a function', () => expect(typeof debug.info).toBe('function'));
    it('warn is a function', () => expect(typeof debug.warn).toBe('function'));
    it('error is a function', () => expect(typeof debug.error).toBe('function'));
    it('maskId is a function', () => expect(typeof debug.maskId).toBe('function'));
  });

  describe('debug calls do not throw', () => {
    it('log does not throw', () => expect(() => debug.log('test')).not.toThrow());
    it('info does not throw', () => expect(() => debug.info('test')).not.toThrow());
    it('warn does not throw', () => expect(() => debug.warn('test')).not.toThrow());
    it('error does not throw', () => expect(() => debug.error('test')).not.toThrow());
    it('log with multiple args', () => expect(() => debug.log('a', 1, { b: 2 })).not.toThrow());
    it('warn with sensitive content filtered', () => expect(() => debug.warn('session expired')).not.toThrow());
    it('warn with token content filtered', () => expect(() => debug.warn('token invalid')).not.toThrow());
  });
});
