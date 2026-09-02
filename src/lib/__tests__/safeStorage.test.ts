import { describe, it, expect, beforeEach } from 'vitest';
import { safeStorage } from '../safeStorage';

describe('safeStorage', () => {
  beforeEach(() => localStorage.clear());

  it('setItem + getItem', () => {
    safeStorage.setItem('k', 'v');
    expect(safeStorage.getItem('k')).toBe('v');
  });

  it('removeItem', () => {
    safeStorage.setItem('k', 'v');
    safeStorage.removeItem('k');
    expect(safeStorage.getItem('k')).toBeNull();
  });

  it('clear', () => {
    safeStorage.setItem('a', '1');
    safeStorage.setItem('b', '2');
    safeStorage.clear();
    expect(safeStorage.getItem('a')).toBeNull();
    expect(safeStorage.getItem('b')).toBeNull();
  });

  it('getItem missing returns null', () => {
    expect(safeStorage.getItem('missing')).toBeNull();
  });
});
