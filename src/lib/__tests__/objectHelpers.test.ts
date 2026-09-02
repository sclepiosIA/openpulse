import { describe, it, expect } from 'vitest';
import { removeUndefinedFields } from '../utils/objectHelpers';

describe('objectHelpers - removeUndefinedFields', () => {
  it('removes undefined fields', () => {
    const result = removeUndefinedFields({ a: 1, b: undefined, c: 'test' });
    expect(result).toEqual({ a: 1, c: 'test' });
  });

  it('keeps null fields', () => {
    const result = removeUndefinedFields({ a: null, b: 'test' });
    expect(result).toEqual({ a: null, b: 'test' });
  });

  it('removes empty string UUID fields', () => {
    const result = removeUndefinedFields({ commercial_id: '', nom: 'Test' });
    expect(result).toEqual({ nom: 'Test' });
  });

  it('removes "none" UUID fields', () => {
    const result = removeUndefinedFields({ chef_projet_id: 'none', nom: 'Test' });
    expect(result).toEqual({ nom: 'Test' });
  });

  it('removes "unassigned" UUID fields', () => {
    const result = removeUndefinedFields({ responsable_id: 'unassigned', nom: 'Test' });
    expect(result).toEqual({ nom: 'Test' });
  });

  it('keeps valid UUID fields', () => {
    const result = removeUndefinedFields({ commercial_id: 'abc-123', nom: 'Test' });
    expect(result).toEqual({ commercial_id: 'abc-123', nom: 'Test' });
  });

  it('keeps empty strings for non-UUID fields', () => {
    const result = removeUndefinedFields({ nom: '', email: '' });
    expect(result).toEqual({ nom: '', email: '' });
  });
});
