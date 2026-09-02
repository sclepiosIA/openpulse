import type { TaskForAnalytics, ProfileForTable } from './taches-analytics';
import { describe, it, expect } from 'vitest';

describe('taches-analytics module types', () => {
  it('TaskForAnalytics has required fields and sensible defaults', () => {
    const task: TaskForAnalytics = {
      id: 't1',
      titre: 'Analyse',
      statut: 'open',
    };
    expect(task.id).toBe('t1');
    expect(task.titre).toBe('Analyse');
    expect(task.statut).toBe('open');
  });

  it('TaskForAnalytics supports nullable optional fields', () => {
    const task: TaskForAnalytics = {
      id: 't2',
      titre: 'Suivi',
      statut: 'in_progress',
      echeance: null,
      date_debut: null,
      categories_taches: null,
      etablissements: null,
      responsable_profile: null,
    };
    expect(task.echeance).toBeNull();
    expect(task.date_debut).toBeNull();
    expect(task.categories_taches).toBeNull();
    expect(task.etablissements).toBeNull();
    expect(task.responsable_profile).toBeNull();
  });

  it('ProfileForTable has required fields', () => {
    const profile: ProfileForTable = {
      id: 'u1',
      prenom: 'Alice',
      nom: 'Dupont',
      email: 'alice@example.com',
    };
    expect(profile.id).toBe('u1');
    expect(profile.prenom).toBe('Alice');
    expect(profile.nom).toBe('Dupont');
    expect(profile.email).toBe('alice@example.com');
  });
});