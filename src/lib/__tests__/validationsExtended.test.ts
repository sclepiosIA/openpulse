import { describe, it, expect } from 'vitest';
import {
  EtablissementType,
  EtablissementStatut,
  PrioriteTache,
  StatutTache,
  UserRole,
  CreateEtablissementSchema,
  CreateTacheSchema,
  CreateContactSchema,
  CreateProfileSchema,
  CreatePartenaireSchema,
} from '../validations';

describe('validations (Zod schemas)', () => {
  describe('Enums', () => {
    it('EtablissementType valid', () => expect(EtablissementType.parse('CH')).toBe('CH'));
    it('EtablissementType invalid', () => expect(() => EtablissementType.parse('XXX')).toThrow());
    it('EtablissementStatut valid', () => expect(EtablissementStatut.parse('Production')).toBe('Production'));
    it('PrioriteTache valid', () => expect(PrioriteTache.parse('high')).toBe('high'));
    it('StatutTache valid', () => expect(StatutTache.parse('En cours')).toBe('En cours'));
    it('UserRole valid', () => expect(UserRole.parse('admin')).toBe('admin'));
  });

  describe('CreateEtablissementSchema', () => {
    const valid = {
      nom: 'CHU Test',
      ville: 'Paris',
      region: 'IDF',
      type: 'CHU',
      date_prise_contact: '2026-01-01',
    };
    it('validates correct data', () => expect(() => CreateEtablissementSchema.parse(valid)).not.toThrow());
    it('rejects empty nom', () => expect(() => CreateEtablissementSchema.parse({ ...valid, nom: '' })).toThrow());
    it('rejects invalid type', () => expect(() => CreateEtablissementSchema.parse({ ...valid, type: 'XXX' })).toThrow());
    it('rejects invalid date format', () => expect(() => CreateEtablissementSchema.parse({ ...valid, date_prise_contact: 'not-a-date' })).toThrow());
    it('accepts optional email', () => expect(() => CreateEtablissementSchema.parse({ ...valid, email: 'test@test.com' })).not.toThrow());
    it('rejects invalid email', () => expect(() => CreateEtablissementSchema.parse({ ...valid, email: 'notanemail' })).toThrow());
    it('defaults statut to Prospect', () => {
      const result = CreateEtablissementSchema.parse(valid);
      expect(result.statut).toBe('Prospect');
    });
  });

  describe('CreateTacheSchema', () => {
    const valid = {
      titre: 'Test task',
      categorie_id: '00000000-0000-0000-0000-000000000001',
      etablissement_id: '00000000-0000-0000-0000-000000000002',
    };
    it('validates correct data', () => expect(() => CreateTacheSchema.parse(valid)).not.toThrow());
    it('rejects empty titre', () => expect(() => CreateTacheSchema.parse({ ...valid, titre: '' })).toThrow());
    it('defaults priorite to medium', () => expect(CreateTacheSchema.parse(valid).priorite).toBe('medium'));
    it('defaults statut to A faire', () => expect(CreateTacheSchema.parse(valid).statut).toBe('A faire'));
  });

  describe('CreateContactSchema', () => {
    const valid = {
      nom: 'Dupont',
      fonction: 'DG',
      etablissement_id: '00000000-0000-0000-0000-000000000001',
    };
    it('validates', () => expect(() => CreateContactSchema.parse(valid)).not.toThrow());
    it('rejects empty nom', () => expect(() => CreateContactSchema.parse({ ...valid, nom: '' })).toThrow());
  });

  describe('CreateProfileSchema', () => {
    const valid = { prenom: 'Jean', nom: 'Dupont', email: 'jean@test.com' };
    it('validates', () => expect(() => CreateProfileSchema.parse(valid)).not.toThrow());
    it('defaults role to commercial', () => expect(CreateProfileSchema.parse(valid).role).toBe('commercial'));
    it('rejects invalid email', () => expect(() => CreateProfileSchema.parse({ ...valid, email: 'bad' })).toThrow());
  });

  describe('CreatePartenaireSchema', () => {
    const valid = { nom: 'Partner', type_partenaire: 'industriel' };
    it('validates', () => expect(() => CreatePartenaireSchema.parse(valid)).not.toThrow());
    it('defaults statut_relation to prospect', () => expect(CreatePartenaireSchema.parse(valid).statut_relation).toBe('prospect'));
    it('rejects invalid type', () => expect(() => CreatePartenaireSchema.parse({ ...valid, type_partenaire: 'bad' })).toThrow());
  });
});
