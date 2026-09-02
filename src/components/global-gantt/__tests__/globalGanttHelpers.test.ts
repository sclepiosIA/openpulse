import { describe, it, expect, vi } from 'vitest';
import { computeGanttStats, computeGanttAlerts, sortTasks } from '../globalGanttHelpers';

const today = new Date('2026-06-01T12:00:00Z');
vi.setSystemTime(today);

const T = (over: Record<string, any> = {}) => ({
  id: Math.random().toString(36).slice(2),
  statut: 'A faire',
  echeance: null,
  ...over,
});

describe('computeGanttStats', () => {
  it('retourne 0 partout pour liste vide', () => {
    const s = computeGanttStats([]);
    expect(s).toMatchObject({ total: 0, completed: 0, inProgress: 0, blocked: 0, overdue: 0, completionRate: 0 });
    expect(s.nextDeadline).toBeUndefined();
  });

  it('agrège correctement statuts et taux de complétion', () => {
    const s = computeGanttStats([
      T({ statut: 'Terminé' }), T({ statut: 'Terminé' }),
      T({ statut: 'En cours' }), T({ statut: 'Bloqué' }),
    ]);
    expect(s).toMatchObject({ total: 4, completed: 2, inProgress: 1, blocked: 1, completionRate: 50 });
  });

  it('compte les tâches en retard (non terminées + échéance passée)', () => {
    const s = computeGanttStats([
      T({ statut: 'A faire', echeance: '2026-05-01' }),
      T({ statut: 'Terminé', echeance: '2026-05-01' }),
      T({ statut: 'A faire', echeance: '2026-07-01' }),
    ]);
    expect(s.overdue).toBe(1);
  });

  it('prochaine deadline = la plus proche dans le futur (hors Terminé)', () => {
    const s = computeGanttStats([
      T({ statut: 'A faire', echeance: '2026-06-15', id: 'mid' }),
      T({ statut: 'A faire', echeance: '2026-06-05', id: 'soon' }),
      T({ statut: 'Terminé', echeance: '2026-06-02', id: 'done' }),
    ]);
    expect(s.nextDeadline?.id).toBe('soon');
  });
});

describe('computeGanttAlerts', () => {
  it('alerte critique pour retards > 7j', () => {
    const a = computeGanttAlerts([T({ echeance: '2026-05-01' })]);
    expect(a.find((x) => x.type === 'critical')).toBeTruthy();
  });

  it('alerte warning pour tâches bloquées', () => {
    const a = computeGanttAlerts([T({ statut: 'Bloqué' })]);
    expect(a.find((x) => x.id === 'blocked' && x.type === 'warning')).toBeTruthy();
  });

  it('alerte info pour deadlines ≤ 48h', () => {
    const a = computeGanttAlerts([T({ echeance: '2026-06-02' })]);
    expect(a.find((x) => x.id === 'urgent' && x.type === 'info')).toBeTruthy();
  });

  it('liste vide si rien à signaler', () => {
    expect(computeGanttAlerts([T({ statut: 'Terminé' })])).toEqual([]);
  });
});

describe('sortTasks', () => {
  it('trie par titre ascendant (locale FR)', () => {
    const out = sortTasks([T({ titre: 'éclat' }), T({ titre: 'avant' })], 'titre', 'asc');
    expect(out[0].titre).toBe('avant');
  });

  it('inverse l’ordre en desc', () => {
    const out = sortTasks([T({ titre: 'a' }), T({ titre: 'b' })], 'titre', 'desc');
    expect(out[0].titre).toBe('b');
  });

  it('trie par priorité (high > medium > low)', () => {
    const out = sortTasks(
      [T({ priorite: 'low' }), T({ priorite: 'high' }), T({ priorite: 'medium' })],
      'priorite', 'asc',
    );
    expect(out.map((t) => t.priorite)).toEqual(['high', 'medium', 'low']);
  });

  it('trie par statut (Bloqué d’abord, Terminé en dernier)', () => {
    const out = sortTasks(
      [T({ statut: 'Terminé' }), T({ statut: 'Bloqué' }), T({ statut: 'En cours' })],
      'statut', 'asc',
    );
    expect(out.map((t) => t.statut)).toEqual(['Bloqué', 'En cours', 'Terminé']);
  });

  it('échéance nulle → fin de liste en asc', () => {
    const out = sortTasks(
      [T({ echeance: null, id: 'null' }), T({ echeance: '2026-06-02', id: 'has' })],
      'echeance', 'asc',
    );
    expect(out[0].id).toBe('has');
  });

  it('ne mute pas le tableau source', () => {
    const src = [T({ titre: 'b' }), T({ titre: 'a' })];
    const snap = [...src];
    sortTasks(src, 'titre', 'asc');
    expect(src).toEqual(snap);
  });
});
