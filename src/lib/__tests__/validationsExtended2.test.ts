import { describe, it, expect } from 'vitest';
import {
  EtablissementType,
  EtablissementStatut,
  TypeDpi,
  PrioriteTache,
  StatutTache,
  UserRole,
  CreateEtablissementSchema,
  CreateTacheSchema,
  CreateContactSchema,
  CreateProfileSchema,
  CreatePartenaireSchema,
  PartenaireType,
  PartenaireStatutRelation,
  HealthStatus,
  PaymentStatus,
  UpdateHealthMetricsSchema,
} from '../validations';

describe('validations extended2', () => {
  describe('Enums', () => {
    it('EtablissementType has 5 values', () => {
      expect(EtablissementType.options).toHaveLength(5);
      expect(EtablissementType.parse('CH')).toBe('CH');
      expect(EtablissementType.parse('CHU')).toBe('CHU');
      expect(() => EtablissementType.parse('Invalid')).toThrow();
    });

    it('EtablissementStatut has all phases', () => {
      expect(EtablissementStatut.parse('Prospect')).toBe('Prospect');
      expect(EtablissementStatut.parse('Production')).toBe('Production');
      expect(EtablissementStatut.parse('Vendu')).toBe('Vendu');
      expect(() => EtablissementStatut.parse('Bad')).toThrow();
    });

    it('TypeDpi covers all DPI systems', () => {
      expect(TypeDpi.parse('ORBIS')).toBe('ORBIS');
      expect(TypeDpi.parse('Sillage')).toBe('Sillage');
      expect(TypeDpi.parse('Maincare')).toBe('Maincare');
      expect(() => TypeDpi.parse('SAP')).toThrow();
    });

    it('PrioriteTache', () => {
      expect(PrioriteTache.options).toEqual(['low', 'medium', 'high']);
    });

    it('StatutTache', () => {
      expect(StatutTache.options).toEqual(['A faire', 'En cours', 'Bloqué', 'Terminé']);
    });

    it('UserRole', () => {
      expect(UserRole.options).toContain('admin');
      expect(UserRole.options).toContain('commercial');
    });

    it('PartenaireType', () => {
      expect(PartenaireType.options).toEqual(['institutionnel', 'industriel', 'prestataire']);
    });

    it('PartenaireStatutRelation', () => {
      expect(PartenaireStatutRelation.options).toEqual(['prospect', 'actif', 'inactif', 'termine']);
    });

    it('HealthStatus', () => {
      expect(HealthStatus.parse('healthy')).toBe('healthy');
      expect(HealthStatus.parse('critical')).toBe('critical');
    });

    it('PaymentStatus', () => {
      expect(PaymentStatus.parse('on_time')).toBe('on_time');
      expect(PaymentStatus.parse('overdue')).toBe('overdue');
    });
  });

  describe('CreateEtablissementSchema', () => {
    const validData = {
      nom: 'CHU Test',
      ville: 'Paris',
      region: 'IDF',
      type: 'CHU' as const,
      date_prise_contact: '2025-01-15',
    };

    it('valid data passes', () => {
      const result = CreateEtablissementSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('missing nom fails', () => {
      const result = CreateEtablissementSchema.safeParse({ ...validData, nom: '' });
      expect(result.success).toBe(false);
    });

    it('invalid type fails', () => {
      const result = CreateEtablissementSchema.safeParse({ ...validData, type: 'Invalid' });
      expect(result.success).toBe(false);
    });

    it('invalid email fails', () => {
      const result = CreateEtablissementSchema.safeParse({ ...validData, email: 'not-email' });
      expect(result.success).toBe(false);
    });

    it('valid email passes', () => {
      const result = CreateEtablissementSchema.safeParse({ ...validData, email: 'test@chu.fr' });
      expect(result.success).toBe(true);
    });

    it('empty email passes', () => {
      const result = CreateEtablissementSchema.safeParse({ ...validData, email: '' });
      expect(result.success).toBe(true);
    });

    it('invalid date format fails', () => {
      const result = CreateEtablissementSchema.safeParse({ ...validData, date_prise_contact: '15/01/2025' });
      expect(result.success).toBe(false);
    });

    it('defaults statut to Prospect', () => {
      const result = CreateEtablissementSchema.parse(validData);
      expect(result.statut).toBe('Prospect');
    });

    it('rejects too long nom', () => {
      const result = CreateEtablissementSchema.safeParse({ ...validData, nom: 'x'.repeat(256) });
      expect(result.success).toBe(false);
    });
  });

  describe('CreateTacheSchema', () => {
    const validTache = {
      titre: 'Test tâche',
      categorie_id: '550e8400-e29b-41d4-a716-446655440000',
      etablissement_id: '550e8400-e29b-41d4-a716-446655440001',
    };

    it('valid data passes', () => {
      expect(CreateTacheSchema.safeParse(validTache).success).toBe(true);
    });

    it('missing titre fails', () => {
      expect(CreateTacheSchema.safeParse({ ...validTache, titre: '' }).success).toBe(false);
    });

    it('invalid UUID fails', () => {
      expect(CreateTacheSchema.safeParse({ ...validTache, categorie_id: 'bad' }).success).toBe(false);
    });

    it('defaults priorite to medium', () => {
      expect(CreateTacheSchema.parse(validTache).priorite).toBe('medium');
    });

    it('defaults statut to A faire', () => {
      expect(CreateTacheSchema.parse(validTache).statut).toBe('A faire');
    });
  });

  describe('CreateContactSchema', () => {
    const validContact = {
      nom: 'Dupont',
      fonction: 'Directeur',
      etablissement_id: '550e8400-e29b-41d4-a716-446655440000',
    };

    it('valid passes', () => {
      expect(CreateContactSchema.safeParse(validContact).success).toBe(true);
    });

    it('missing fonction fails', () => {
      expect(CreateContactSchema.safeParse({ ...validContact, fonction: '' }).success).toBe(false);
    });

    it('defaults est_contact_principal to false', () => {
      expect(CreateContactSchema.parse(validContact).est_contact_principal).toBe(false);
    });
  });

  describe('CreateProfileSchema', () => {
    it('valid passes', () => {
      const result = CreateProfileSchema.safeParse({ prenom: 'Jean', nom: 'Dupont', email: 'j@test.fr' });
      expect(result.success).toBe(true);
    });

    it('invalid email fails', () => {
      expect(CreateProfileSchema.safeParse({ prenom: 'J', nom: 'D', email: 'bad' }).success).toBe(false);
    });

    it('defaults role to commercial', () => {
      const result = CreateProfileSchema.parse({ prenom: 'J', nom: 'D', email: 'j@t.fr' });
      expect(result.role).toBe('commercial');
    });
  });

  describe('CreatePartenaireSchema', () => {
    const validPartenaire = {
      nom: 'Partner',
      type_partenaire: 'industriel' as const,
    };

    it('valid passes', () => {
      expect(CreatePartenaireSchema.safeParse(validPartenaire).success).toBe(true);
    });

    it('invalid type fails', () => {
      expect(CreatePartenaireSchema.safeParse({ ...validPartenaire, type_partenaire: 'bad' }).success).toBe(false);
    });

    it('defaults engagement_score to 0', () => {
      expect(CreatePartenaireSchema.parse(validPartenaire).engagement_score).toBe(0);
    });
  });

  describe('UpdateHealthMetricsSchema', () => {
    it('valid passes', () => {
      const result = UpdateHealthMetricsSchema.safeParse({
        etablissement_id: '550e8400-e29b-41d4-a716-446655440000',
        taux_utilisation_cotation: 85,
        nps_score: 8,
      });
      expect(result.success).toBe(true);
    });

    it('taux > 100 fails', () => {
      const result = UpdateHealthMetricsSchema.safeParse({
        etablissement_id: '550e8400-e29b-41d4-a716-446655440000',
        taux_utilisation_cotation: 150,
      });
      expect(result.success).toBe(false);
    });

    it('nps > 10 fails', () => {
      const result = UpdateHealthMetricsSchema.safeParse({
        etablissement_id: '550e8400-e29b-41d4-a716-446655440000',
        nps_score: 11,
      });
      expect(result.success).toBe(false);
    });
  });
});
