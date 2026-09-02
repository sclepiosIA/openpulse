import { describe, it, expect } from 'vitest';
import { getSmartTaskGroups, getGroupStats, getPriorityStyle } from '../agendaUtils';

const iso = (offsetDays: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString();
};

describe('agendaUtils', () => {
  it('getSmartTaskGroups buckets by period', () => {
    const groups = getSmartTaskGroups([
      { id: '1', echeance: iso(-5), statut: 'en_cours' }, // overdue
      { id: '2', echeance: iso(0) }, // today
      { id: '3', echeance: iso(3) }, // this week
      { id: '4', echeance: iso(10) }, // next week
      { id: '5', echeance: iso(30) }, // later
      { id: '6' }, // no date — excluded
    ]);
    const ids = groups.map(g => g.id);
    expect(ids).toContain('overdue');
    expect(ids).toContain('today');
    expect(ids).toContain('thisWeek');
    expect(ids).toContain('nextWeek');
    expect(ids).toContain('later');
  });

  it('getSmartTaskGroups skips completed overdue', () => {
    const groups = getSmartTaskGroups([
      { id: '1', echeance: iso(-5), statut: 'terminee' },
    ]);
    expect(groups.find(g => g.id === 'overdue')).toBeUndefined();
  });

  it('getGroupStats computes completion + assignees', () => {
    const stats = getGroupStats([
      { id: '1', statut: 'terminee', responsable_id: 'u1' },
      { id: '2', statut: 'en_cours', responsable_id: 'u2' },
      { id: '3', statut: 'en_cours', responsable_id: 'u1', echeance: iso(-3) },
    ]);
    expect(stats.total).toBe(3);
    expect(stats.completed).toBe(1);
    expect(stats.completionRate).toBe(33);
    expect(stats.assigneeCount).toBe(2);
    expect(stats.avgDelay).toBeGreaterThanOrEqual(2);
  });

  it('getGroupStats empty', () => {
    const stats = getGroupStats([]);
    expect(stats.total).toBe(0);
    expect(stats.completionRate).toBe(0);
    expect(stats.avgDelay).toBe(0);
  });

  it('getPriorityStyle variants', () => {
    expect(getPriorityStyle('high').className).toContain('destructive');
    expect(getPriorityStyle('medium').className).toContain('warning');
    expect(getPriorityStyle('low').className).toContain('muted');
    expect(getPriorityStyle('unknown').icon).toBe('📋');
  });
});
