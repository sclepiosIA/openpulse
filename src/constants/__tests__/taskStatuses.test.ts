import { describe, it, expect } from 'vitest';
import {
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  TASK_STATUS_COLORS,
  TASK_STATUS_ICONS,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_COLORS,
} from '../taskStatuses';

describe('taskStatuses', () => {
  it('expose les 4 statuts canoniques', () => {
    expect(Object.values(TASK_STATUSES).sort()).toEqual(
      ['A faire', 'Bloqué', 'En cours', 'Terminé'].sort()
    );
  });

  it('chaque statut a un label, une couleur et une icône', () => {
    for (const s of Object.values(TASK_STATUSES)) {
      expect(TASK_STATUS_LABELS[s]).toBeTruthy();
      expect(TASK_STATUS_COLORS[s]).toMatch(/bg-/);
      expect(TASK_STATUS_COLORS[s]).toMatch(/text-/);
      expect(TASK_STATUS_ICONS[s]).toMatch(/^[A-Z]/);
    }
  });

  it('"À faire" est bien accentué dans le label affiché', () => {
    expect(TASK_STATUS_LABELS['A faire']).toBe('À faire');
  });

  it('utilise des tokens du design system (pas de couleurs en dur)', () => {
    for (const c of Object.values(TASK_STATUS_COLORS)) {
      expect(c).not.toMatch(/#[0-9a-f]/i);
      expect(c).not.toMatch(/\brgb\(/);
    }
  });

  it('priorités: 3 niveaux avec couleurs distinctes', () => {
    expect(Object.values(TASK_PRIORITIES).sort()).toEqual(['high', 'low', 'medium']);
    expect(TASK_PRIORITY_LABELS.high).toBe('Haute');
    expect(TASK_PRIORITY_LABELS.medium).toBe('Moyenne');
    expect(TASK_PRIORITY_LABELS.low).toBe('Basse');
    expect(TASK_PRIORITY_COLORS.high).toContain('destructive');
  });

  it('chaque priorité a un label et une couleur complète', () => {
    for (const priority of Object.values(TASK_PRIORITIES)) {
      expect(TASK_PRIORITY_LABELS[priority]).toBeTruthy();
      expect(TASK_PRIORITY_COLORS[priority]).toMatch(/bg-/);
      expect(TASK_PRIORITY_COLORS[priority]).toMatch(/text-/);
      expect(TASK_PRIORITY_COLORS[priority]).not.toMatch(/#[0-9a-f]/i);
    }
  });

  it('les clés de statut restent alignées avec les mappings', () => {
    expect(Object.keys(TASK_STATUS_LABELS).sort()).toEqual(Object.values(TASK_STATUSES).sort());
    expect(Object.keys(TASK_STATUS_COLORS).sort()).toEqual(Object.values(TASK_STATUSES).sort());
    expect(Object.keys(TASK_STATUS_ICONS).sort()).toEqual(Object.values(TASK_STATUSES).sort());
  });
});
