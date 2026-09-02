import { describe, it, expect } from 'vitest';
import { removeUndefinedFields } from '../objectHelpers';

describe('removeUndefinedFields', () => {
  it('supprime les valeurs undefined', () => {
    expect(removeUndefinedFields({ a: 1, b: undefined, c: 'x' })).toEqual({ a: 1, c: 'x' });
  });

  it('préserve null, 0, false et chaîne vide (non-UUID)', () => {
    expect(removeUndefinedFields({ a: null, b: 0, c: false, d: '' })).toEqual({
      a: null, b: 0, c: false, d: '',
    });
  });

  it('supprime chaîne vide pour les champs UUID', () => {
    const out = removeUndefinedFields({
      commercial_id: '', chef_projet_id: 'uuid-1', csm_id: 'none', responsable_id: 'unassigned',
    });
    expect(out).toEqual({ chef_projet_id: 'uuid-1' });
  });

  it('supprime "none" et "unassigned" pour tous les champs UUID listés', () => {
    const fields = ['etablissement_id', 'groupe_id', 'partenaire_id', 'responsable_marque_id'];
    for (const f of fields) {
      const obj = { [f]: 'unassigned' } as Record<string, unknown>;
      expect(removeUndefinedFields(obj)).toEqual({});
    }
  });

  it('objet vide → objet vide', () => {
    expect(removeUndefinedFields({})).toEqual({});
  });
});
