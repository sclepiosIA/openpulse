import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDeploymentHealth, getHealthColor, getHealthBadgeColor, getHealthLabel, getHealthIcon } from '../production/useDeploymentHealth';

describe('useDeploymentHealth', () => {
  const baseEtab = {
    id: 'e1', nom: 'CH Test', statut: 'Contractuel',
    progression: 80, date_signature: new Date().toISOString(),
    csm_id: 'u1', chef_projet_id: 'u2',
  };

  it('returns healthy for well-progressing etablissement', () => {
    const { result } = renderHook(() => useDeploymentHealth([baseEtab as any]));
    const health = result.current.get('e1');
    expect(health).toBeDefined();
    expect(health!.status).toBe('healthy');
    expect(health!.score).toBeGreaterThanOrEqual(80);
  });

  it('penalizes missing team members', () => {
    const noTeam = { ...baseEtab, csm_id: null, chef_projet_id: null };
    const { result } = renderHook(() => useDeploymentHealth([noTeam as any]));
    const health = result.current.get('e1');
    expect(health!.reasons).toContain('Équipe incomplète');
  });

  it('penalizes delayed tasks', () => {
    const tasks = new Map([['e1', { total: 10, onTime: 3, delayed: 5, blocked: 0 }]]);
    const { result } = renderHook(() => useDeploymentHealth([baseEtab as any], tasks));
    const health = result.current.get('e1');
    expect(health!.score).toBeLessThan(100);
  });

  it('penalizes blocked tasks', () => {
    const tasks = new Map([['e1', { total: 10, onTime: 5, delayed: 0, blocked: 2 }]]);
    const { result } = renderHook(() => useDeploymentHealth([baseEtab as any], tasks));
    const health = result.current.get('e1');
    expect(health!.reasons.some(r => r.includes('bloqueur'))).toBe(true);
  });

  it('handles empty array', () => {
    const { result } = renderHook(() => useDeploymentHealth([]));
    expect(result.current.size).toBe(0);
  });
});

describe('getHealth helpers', () => {
  it('getHealthColor returns string for each status', () => {
    expect(getHealthColor('healthy')).toContain('green');
    expect(getHealthColor('at-risk')).toContain('orange');
    expect(getHealthColor('delayed')).toContain('red');
    expect(getHealthColor('blocked')).toContain('red');
  });

  it('getHealthBadgeColor returns string for each status', () => {
    expect(getHealthBadgeColor('healthy')).toContain('green');
    expect(getHealthBadgeColor('blocked')).toContain('red');
  });

  it('getHealthLabel returns French label', () => {
    expect(getHealthLabel('healthy')).toBe('Dans les temps');
    expect(getHealthLabel('at-risk')).toBe('À risque');
    expect(getHealthLabel('delayed')).toBe('En retard');
    expect(getHealthLabel('blocked')).toBe('Bloqué');
  });

  it('getHealthIcon returns emoji for each status', () => {
    expect(getHealthIcon('healthy')).toBe('🟢');
    expect(getHealthIcon('at-risk')).toBe('🟠');
    expect(getHealthIcon('delayed')).toBe('🔴');
    expect(getHealthIcon('blocked')).toBe('🚨');
  });
});
