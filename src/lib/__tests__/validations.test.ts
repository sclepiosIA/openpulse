import { describe, it, expect } from 'vitest';
import {
  CreateProfileSchema,
  CreateEtablissementSchema,
  CreateTacheSchema,
  CreateContactSchema,
  CreatePartenaireSchema,
  EtablissementStatut,
  EtablissementType,
  PartenaireStatutRelation,
  PartenaireType,
  PaymentStatus,
  PrioriteTache,
  UpdateHealthMetricsSchema,
  UpdatePartenaireSchema,
  UserRole,
} from '../validations';

describe('validations (zod)', () => {
  it('CreateEtablissementSchema validates minimal payload', () => {
    const ok = CreateEtablissementSchema.safeParse({
      nom: 'CH Paris',
      ville: 'Paris',
      region: 'IDF',
      type: 'CH',
      date_prise_contact: '2024-01-15',
    });
    expect(ok.success).toBe(true);
  });

  it('CreateEtablissementSchema rejects missing nom', () => {
    const ko = CreateEtablissementSchema.safeParse({
      ville: 'Paris', region: 'IDF', type: 'CH', date_prise_contact: '2024-01-15',
    });
    expect(ko.success).toBe(false);
  });

  it('CreateEtablissementSchema rejects bad date format', () => {
    const ko = CreateEtablissementSchema.safeParse({
      nom: 'X', ville: 'P', region: 'IDF', type: 'CH', date_prise_contact: '15/01/2024',
    });
    expect(ko.success).toBe(false);
  });

  it('CreateTacheSchema requires UUIDs', () => {
    const ok = CreateTacheSchema.safeParse({
      titre: 'T1',
      categorie_id: '00000000-0000-0000-0000-000000000000',
      etablissement_id: '00000000-0000-0000-0000-000000000000',
    });
    expect(ok.success).toBe(true);
    const ko = CreateTacheSchema.safeParse({
      titre: 'T1', categorie_id: 'not-uuid', etablissement_id: 'x',
    });
    expect(ko.success).toBe(false);
  });

  it('CreateContactSchema validates email format', () => {
    const ko = CreateContactSchema.safeParse({
      nom: 'X', fonction: 'CTO', email: 'bad', etablissement_id: '00000000-0000-0000-0000-000000000000',
    });
    expect(ko.success).toBe(false);
  });

  it('CreatePartenaireSchema defaults pays to France', () => {
    const r = CreatePartenaireSchema.safeParse({
      nom: 'Acme', type_partenaire: 'industriel',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.pays).toBe('France');
      expect(r.data.statut_relation).toBe('prospect');
    }
  });

  it('UpdateHealthMetricsSchema bounds NPS 0-10', () => {
    const ok = UpdateHealthMetricsSchema.safeParse({
      etablissement_id: '00000000-0000-0000-0000-000000000000', nps_score: 8,
    });
    expect(ok.success).toBe(true);
    const ko = UpdateHealthMetricsSchema.safeParse({
      etablissement_id: '00000000-0000-0000-0000-000000000000', nps_score: 11,
    });
    expect(ko.success).toBe(false);
  });

  it('expose les enums métier principaux', () => {
    expect(EtablissementType.safeParse('CHU').success).toBe(true);
    expect(EtablissementType.safeParse('Cabinet').success).toBe(false);
    expect(EtablissementStatut.safeParse('Négociation').success).toBe(true);
    expect(PrioriteTache.safeParse('urgent').success).toBe(false);
    expect(UserRole.safeParse('csm').success).toBe(true);
    expect(PartenaireType.safeParse('institutionnel').success).toBe(true);
    expect(PartenaireStatutRelation.safeParse('termine').success).toBe(true);
    expect(PaymentStatus.safeParse('overdue').success).toBe(true);
  });

  it('CreateEtablissementSchema accepte les champs optionnels URL/email vides', () => {
    const result = CreateEtablissementSchema.safeParse({
      nom: 'CH Test',
      ville: 'Fort-de-France',
      region: 'Martinique',
      type: 'CHU',
      logo_url: '',
      email: '',
      stats_utilisation_url: '',
      stats_urgences_url: '',
      date_prise_contact: '2026-06-07',
      nombre_passages_urgences_annuel: 12000,
    });

    expect(result.success).toBe(true);
  });

  it('CreateEtablissementSchema rejette les volumes annuels hors bornes', () => {
    const result = CreateEtablissementSchema.safeParse({
      nom: 'CH Test',
      ville: 'Paris',
      region: 'IDF',
      type: 'CH',
      date_prise_contact: '2026-06-07',
      nombre_passages_urgences_annuel: 1000001,
    });

    expect(result.success).toBe(false);
  });

  it('CreateTacheSchema applique les valeurs par défaut', () => {
    const result = CreateTacheSchema.safeParse({
      titre: 'Préparer go-live',
      categorie_id: '00000000-0000-0000-0000-000000000000',
      etablissement_id: '00000000-0000-0000-0000-000000000000',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priorite).toBe('medium');
      expect(result.data.statut).toBe('A faire');
    }
  });

  it('CreateContactSchema applique est_contact_principal à false par défaut', () => {
    const result = CreateContactSchema.safeParse({
      nom: 'Martin',
      fonction: 'DSI',
      etablissement_id: '00000000-0000-0000-0000-000000000000',
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.est_contact_principal).toBe(false);
  });

  it('CreateProfileSchema applique rôle commercial et actif true par défaut', () => {
    const result = CreateProfileSchema.safeParse({
      prenom: 'Ada',
      nom: 'Lovelace',
      email: 'ada@exploitant.example.org',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe('commercial');
      expect(result.data.actif).toBe(true);
    }
  });

  it('UpdatePartenaireSchema accepte un patch partiel et rejette les mauvais URLs', () => {
    expect(UpdatePartenaireSchema.safeParse({ ville: 'Paris' }).success).toBe(true);
    expect(UpdatePartenaireSchema.safeParse({ site_web: 'pas-une-url' }).success).toBe(false);
  });
});
