import { describe, it, expect } from 'vitest';
import { removeUndefinedFields } from '../utils/objectHelpers';

describe('objectHelpers (removeUndefinedFields)', () => {
  it('removes undefined values', () => {
    expect(removeUndefinedFields({ a: 1, b: undefined, c: 'hi' })).toEqual({ a: 1, c: 'hi' });
  });

  it('keeps null values', () => {
    expect(removeUndefinedFields({ a: null, b: 1 })).toEqual({ a: null, b: 1 });
  });

  it('removes empty string UUID fields', () => {
    expect(removeUndefinedFields({ commercial_id: '', nom: 'test' })).toEqual({ nom: 'test' });
  });

  it('removes "none" UUID fields', () => {
    expect(removeUndefinedFields({ chef_projet_id: 'none', nom: 'ok' })).toEqual({ nom: 'ok' });
  });

  it('removes "unassigned" UUID fields', () => {
    expect(removeUndefinedFields({ csm_id: 'unassigned', nom: 'ok' })).toEqual({ nom: 'ok' });
  });

  it('keeps valid UUID fields', () => {
    const data = { commercial_id: '123e4567-e89b-12d3-a456-426614174000', nom: 'test' };
    expect(removeUndefinedFields(data)).toEqual(data);
  });

  it('keeps empty strings for non-UUID fields', () => {
    expect(removeUndefinedFields({ nom: '', ville: 'Paris' })).toEqual({ nom: '', ville: 'Paris' });
  });

  it('handles empty object', () => {
    expect(removeUndefinedFields({})).toEqual({});
  });

  it('handles all UUID fields', () => {
    const result = removeUndefinedFields({
      commercial_id: '',
      chef_projet_id: 'none',
      csm_id: 'unassigned',
      responsable_id: undefined,
      etablissement_id: 'valid-id',
    });
    expect(result).toEqual({ etablissement_id: 'valid-id' });
  });
});
