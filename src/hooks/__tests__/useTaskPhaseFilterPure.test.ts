import { describe, it, expect } from 'vitest';
import {
  filterTasksByEstablishmentPhase,
  getAllowedCategoriesForEstablishment,
  type EtablissementWithStatus,
  type PhaseFilterableTask,
} from '../tasks/useTaskPhaseFilter';

describe('filterTasksByEstablishmentPhase', () => {
  const makeTask = (overrides: Partial<PhaseFilterableTask> = {}): PhaseFilterableTask => ({
    id: 'task-1',
    etablissement_id: 'etab-1',
    categories_taches: { nom: 'Prospection' },
    ...overrides,
  });

  const makeEtab = (overrides: Partial<EtablissementWithStatus> = {}): EtablissementWithStatus => ({
    id: 'etab-1',
    statut: 'Prospect',
    ...overrides,
  });

  it('returns empty for empty tasks', () => {
    expect(filterTasksByEstablishmentPhase([], [makeEtab()])).toEqual([]);
  });

  it('returns all tasks when no establishments', () => {
    const tasks = [makeTask()];
    expect(filterTasksByEstablishmentPhase(tasks, [])).toEqual(tasks);
  });

  it('keeps global tasks (no etablissement_id)', () => {
    const tasks = [makeTask({ etablissement_id: null })];
    expect(filterTasksByEstablishmentPhase(tasks, [makeEtab()])).toHaveLength(1);
  });

  it('keeps tasks with unknown establishment', () => {
    const tasks = [makeTask({ etablissement_id: 'unknown' })];
    expect(filterTasksByEstablishmentPhase(tasks, [makeEtab()])).toHaveLength(1);
  });

  it('keeps tasks without category', () => {
    const tasks = [makeTask({ categories_taches: null })];
    expect(filterTasksByEstablishmentPhase(tasks, [makeEtab()])).toHaveLength(1);
  });

  it('handles undefined tasks', () => {
    expect(filterTasksByEstablishmentPhase(undefined as any, [makeEtab()])).toEqual([]);
  });
});

describe('getAllowedCategoriesForEstablishment', () => {
  it('returns null for undefined establishment', () => {
    expect(getAllowedCategoriesForEstablishment(undefined)).toBeNull();
  });

  it('returns null for unknown phase', () => {
    expect(getAllowedCategoriesForEstablishment({ id: '1', statut: 'Unknown_Status_XYZ' })).toBeNull();
  });

  it('returns categories for Production establishment', () => {
    const result = getAllowedCategoriesForEstablishment({ id: '1', statut: 'Production' });
    expect(result).not.toBeNull();
    expect(result!.length).toBeGreaterThan(0);
  });

  it('returns categories for Prospect establishment', () => {
    const result = getAllowedCategoriesForEstablishment({ id: '1', statut: 'Prospect' });
    expect(result).not.toBeNull();
    expect(result!.length).toBeGreaterThan(0);
  });
});
