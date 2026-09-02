import { describe, it, expect } from 'vitest';
import {
  CATEGORIE_LABELS,
  CATEGORIE_COLORS,
  NIVEAU_LABELS,
  NIVEAU_VALUES,
  NIVEAU_COLORS,
  CERTIFICATION_STATUT_LABELS,
  CERTIFICATION_STATUT_COLORS,
  ACTION_TYPE_LABELS,
  PLAN_STATUT_LABELS,
  PLAN_STATUT_COLORS,
  ACTION_STATUT_LABELS,
} from './competences';

describe('competences module', () => {
  it('devrait définir correctement les labels des catégories', () => {
    expect(CATEGORIE_LABELS.technique).toBe('Technique');
    expect(CATEGORIE_LABELS.metier).toBe('Métier Santé');
    expect(CATEGORIE_LABELS.soft_skill).toBe('Soft Skills');
    expect(CATEGORIE_LABELS.langue).toBe('Langues');
    expect(CATEGORIE_LABELS.outil).toBe('Outils');
    expect(CATEGORIE_LABELS.certification).toBe('Certifications');
  });

  it('devrait définir correctement les couleurs des catégories', () => {
    expect(CATEGORIE_COLORS.technique).toContain('bg-blue-100');
    expect(CATEGORIE_COLORS.metier).toContain('bg-purple-100');
    expect(CATEGORIE_COLORS.soft_skill).toContain('bg-green-100');
    expect(CATEGORIE_COLORS.langue).toContain('bg-orange-100');
    expect(CATEGORIE_COLORS.outil).toContain('bg-gray-100');
    expect(CATEGORIE_COLORS.certification).toContain('bg-yellow-100');
  });

  it('devrait définir correctement les labels des niveaux', () => {
    expect(NIVEAU_LABELS.debutant).toBe('Débutant');
    expect(NIVEAU_LABELS.intermediaire).toBe('Intermédiaire');
    expect(NIVEAU_LABELS.avance).toBe('Avancé');
    expect(NIVEAU_LABELS.expert).toBe('Expert');
  });

  it('devrait définir correctement les valeurs numériques des niveaux', () => {
    expect(NIVEAU_VALUES.debutant).toBe(1);
    expect(NIVEAU_VALUES.intermediaire).toBe(2);
    expect(NIVEAU_VALUES.avance).toBe(3);
    expect(NIVEAU_VALUES.expert).toBe(4);
    expect(NIVEAU_VALUES.expert).toBeGreaterThan(NIVEAU_VALUES.debutant);
  });

  it('devrait définir correctement les couleurs des niveaux', () => {
    expect(NIVEAU_COLORS.debutant).toContain('bg-red-100');
    expect(NIVEAU_COLORS.intermediaire).toContain('bg-yellow-100');
    expect(NIVEAU_COLORS.avance).toContain('bg-blue-100');
    expect(NIVEAU_COLORS.expert).toContain('bg-green-100');
  });

  it('devrait définir correctement les labels des statuts de certification', () => {
    expect(CERTIFICATION_STATUT_LABELS.valide).toBe('Valide');
    expect(CERTIFICATION_STATUT_LABELS.expiree).toBe('Expirée');
    expect(CERTIFICATION_STATUT_LABELS.en_cours).toBe('En cours');
    expect(CERTIFICATION_STATUT_LABELS.a_renouveler).toBe('À renouveler');
  });

  it('devrait définir correctement les couleurs des statuts de certification', () => {
    expect(CERTIFICATION_STATUT_COLORS.valide).toContain('bg-green-100');
    expect(CERTIFICATION_STATUT_COLORS.expiree).toContain('bg-red-100');
    expect(CERTIFICATION_STATUT_COLORS.en_cours).toContain('bg-blue-100');
    expect(CERTIFICATION_STATUT_COLORS.a_renouveler).toContain('bg-orange-100');
  });

  it('devrait définir correctement les labels des types d’action', () => {
    expect(ACTION_TYPE_LABELS.formation).toBe('Formation');
    expect(ACTION_TYPE_LABELS.certification).toBe('Certification');
    expect(ACTION_TYPE_LABELS.projet).toBe('Projet pratique');
    expect(ACTION_TYPE_LABELS.mentorat).toBe('Mentorat');
    expect(ACTION_TYPE_LABELS.autoformation).toBe('Autoformation');
    expect(ACTION_TYPE_LABELS.autre).toBe('Autre');
  });

  it('devrait définir correctement les labels des statuts de plan', () => {
    expect(PLAN_STATUT_LABELS.brouillon).toBe('Brouillon');
    expect(PLAN_STATUT_LABELS.en_cours).toBe('En cours');
    expect(PLAN_STATUT_LABELS.termine).toBe('Terminé');
    expect(PLAN_STATUT_LABELS.abandonne).toBe('Abandonné');
  });

  it('devrait définir correctement les couleurs des statuts de plan', () => {
    expect(PLAN_STATUT_COLORS.brouillon).toContain('bg-gray-100');
    expect(PLAN_STATUT_COLORS.en_cours).toContain('bg-blue-100');
    expect(PLAN_STATUT_COLORS.termine).toContain('bg-green-100');
    expect(PLAN_STATUT_COLORS.abandonne).toContain('bg-red-100');
  });

  it('devrait définir correctement les labels des statuts d’action', () => {
    expect(ACTION_STATUT_LABELS.a_faire).toBe('À faire');
    expect(ACTION_STATUT_LABELS.en_cours).toBe('En cours');
    expect(ACTION_STATUT_LABELS.termine).toBe('Terminé');
    expect(ACTION_STATUT_LABELS.annule).toBe('Annulé');
  });
});