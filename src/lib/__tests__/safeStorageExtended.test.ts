import { describe, it, expect, beforeEach } from 'vitest';
import { safeStorage } from '../safeStorage';

describe('safeStorage extended', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('setItem and getItem work', () => {
    safeStorage.setItem('test-key', 'test-value');
    expect(safeStorage.getItem('test-key')).toBe('test-value');
  });

  it('getItem returns null for missing key', () => {
    expect(safeStorage.getItem('nonexistent')).toBeNull();
  });

  it('removeItem removes key', () => {
    safeStorage.setItem('to-remove', 'value');
    safeStorage.removeItem('to-remove');
    expect(safeStorage.getItem('to-remove')).toBeNull();
  });

  it('clear removes all keys', () => {
    safeStorage.setItem('key1', 'val1');
    safeStorage.setItem('key2', 'val2');
    safeStorage.clear();
    expect(safeStorage.getItem('key1')).toBeNull();
    expect(safeStorage.getItem('key2')).toBeNull();
  });

  it('setItem overwrites existing value', () => {
    safeStorage.setItem('key', 'old');
    safeStorage.setItem('key', 'new');
    expect(safeStorage.getItem('key')).toBe('new');
  });

  it('handles JSON values', () => {
    const obj = { name: 'test', count: 42 };
    safeStorage.setItem('json-key', JSON.stringify(obj));
    const retrieved = JSON.parse(safeStorage.getItem('json-key')!);
    expect(retrieved).toEqual(obj);
  });

  it('handles empty string value', () => {
    safeStorage.setItem('empty', '');
    expect(safeStorage.getItem('empty')).toBe('');
  });
});
