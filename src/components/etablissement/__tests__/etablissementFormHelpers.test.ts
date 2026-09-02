import { describe, it, expect } from 'vitest';
import {
  buildEtablissementFormDefaults,
  sanitizeEtablissementPayload,
} from '../etablissementFormHelpers';

const baseEtab = {
  id: 'e1',
  nom: 'Hôpital X',
  type: 'public',
  ville: 'Lyon',
  region: 'ARA',
  statut: 'prospect',
  date_prise_contact: '2025-01-15',
} as any;

describe('buildEtablissementFormDefaults', () => {
  it('mappe les champs requis directement', () => {
    const d = buildEtablissementFormDefaults(baseEtab);
    expect(d.nom).toBe('Hôpital X');
    expect(d.ville).toBe('Lyon');
    expect(d.statut).toBe('prospect');
    expect(d.date_prise_contact).toBe('2025-01-15');
  });

  it('remplit date_prise_contact avec aujourd’hui si absente', () => {
    const d = buildEtablissementFormDefaults({ ...baseEtab, date_prise_contact: null });
    expect(d.date_prise_contact).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('utilise "unassigned" pour les FK profils nulles', () => {
    const d = buildEtablissementFormDefaults({
      ...baseEtab, commercial_id: null, chef_projet_id: null, csm_id: null,
    });
    expect(d.commercial_id).toBe('unassigned');
    expect(d.chef_projet_id).toBe('unassigned');
    expect(d.csm_id).toBe('unassigned');
  });

  it('défaut "" pour les champs texte/date optionnels nuls', () => {
    const d = buildEtablissementFormDefaults({ ...baseEtab, adresse: null, telephone: null });
    expect(d.adresse).toBe('');
    expect(d.telephone).toBe('');
  });

  it('défauts []/{} pour les objets/listes nuls', () => {
    const d = buildEtablissementFormDefaults({
      ...baseEtab, modules_proposes: null, seuils_palliers: null, tarifs_palliers: null,
    });
    expect(d.modules_proposes).toEqual([]);
    expect(d.seuils_palliers).toEqual({});
    expect(d.tarifs_palliers).toEqual({});
  });
});

describe('sanitizeEtablissementPayload', () => {
  it('convertit "" → undefined sur les champs optionnels', () => {
    const out = sanitizeEtablissementPayload({
      adresse: '', telephone: '', email: '', date_signature: '',
    } as any);
    expect(out.adresse).toBeUndefined();
    expect(out.telephone).toBeUndefined();
    expect(out.email).toBeUndefined();
    expect(out.date_signature).toBeUndefined();
  });

  it('convertit "unassigned" → undefined pour les FK profils', () => {
    const out = sanitizeEtablissementPayload({
      commercial_id: 'unassigned', chef_projet_id: 'uuid-1', csm_id: '',
    } as any);
    expect(out.commercial_id).toBeUndefined();
    expect(out.chef_projet_id).toBe('uuid-1');
    expect(out.csm_id).toBeUndefined();
  });

  it('objets palliers vides → undefined, non-vides → préservés', () => {
    expect(sanitizeEtablissementPayload({ seuils_palliers: {} } as any).seuils_palliers).toBeUndefined();
    expect(
      sanitizeEtablissementPayload({ tarifs_palliers: { p1: 100 } } as any).tarifs_palliers,
    ).toEqual({ p1: 100 });
  });

  it('dpi falsy → undefined, valeur → conservée', () => {
    expect(sanitizeEtablissementPayload({ dpi: '' } as any).dpi).toBeUndefined();
    expect(sanitizeEtablissementPayload({ dpi: 'orbis' } as any).dpi).toBe('orbis');
  });

  it('valeurs non vides sont préservées', () => {
    const out = sanitizeEtablissementPayload({
      adresse: '12 rue X', commercial_id: 'uuid-c', notes: 'ok',
    } as any);
    expect(out.adresse).toBe('12 rue X');
    expect(out.commercial_id).toBe('uuid-c');
    expect(out.notes).toBe('ok');
  });
});
