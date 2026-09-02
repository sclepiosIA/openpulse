import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('@/hooks/hr/useRHAbsences', () => ({
  useRHAbsences: () => ({
    absences: [
      {
        id: 'a1',
        profile_id: 'p1',
        date_debut: '2026-03-10',
        date_fin: '2026-03-12',
        type_absence: 'conges_payes',
        statut: 'approuve',
        motif: 'Vacances',
        profiles: { prenom: 'Jean', nom: 'Dupont', email: 'jean@test.com' },
      },
      {
        id: 'a2',
        profile_id: 'p2',
        date_debut: '2026-03-15',
        date_fin: '2026-03-15',
        type_absence: 'rtt',
        statut: 'en_attente',
        profiles: { prenom: 'Marie', nom: 'Martin', email: 'marie@test.com' },
      },
      {
        id: 'a3',
        profile_id: 'p2',
        date_debut: '2026-03-20',
        date_fin: '2026-03-21',
        type_absence: 'maladie',
        statut: 'approuvé',
        profiles: { prenom: 'Marie', nom: 'Martin', email: 'marie@test.com' },
      },
    ],
    isLoading: false,
  }),
}));

import { useCalendarAbsences } from '../calendar/useCalendarAbsences';

describe('useCalendarAbsences', () => {
  it('filters only approved absences', () => {
    const { result } = renderHook(() => useCalendarAbsences());
    // a1 (approuve) + a3 (approuvé) = 2, a2 (en_attente) excluded
    expect(result.current.absences).toHaveLength(2);
    expect(result.current.totalCount).toBe(2);
  });

  it('filters by profileIds', () => {
    const { result } = renderHook(() => useCalendarAbsences(undefined, undefined, ['p1']));
    expect(result.current.absences).toHaveLength(1);
    expect(result.current.absences[0].profile_id).toBe('p1');
  });

  it('generates correct title with type label and name', () => {
    const { result } = renderHook(() => useCalendarAbsences());
    expect(result.current.absences[0].title).toContain('Congés payés');
    expect(result.current.absences[0].title).toContain('Jean Dupont');
  });

  it('assigns correct colors by absence type', () => {
    const { result } = renderHook(() => useCalendarAbsences());
    // Congés payés = blue
    expect(result.current.absences[0].color).toBe('#3B82F6');
    // Maladie = amber
    expect(result.current.absences[1].color).toBe('#F59E0B');
  });

  it('getAbsencesForDay returns matching absences', () => {
    const { result } = renderHook(() => useCalendarAbsences());
    const day = new Date('2026-03-11');
    const dayAbsences = result.current.getAbsencesForDay(day);
    expect(dayAbsences).toHaveLength(1);
    expect(dayAbsences[0].id).toBe('a1');
  });

  it('getAbsencesForDay returns empty for day with no absences', () => {
    const { result } = renderHook(() => useCalendarAbsences());
    const day = new Date('2026-03-25');
    expect(result.current.getAbsencesForDay(day)).toHaveLength(0);
  });

  it('absenceCountByDay counts correctly across ranges', () => {
    const { result } = renderHook(() => useCalendarAbsences());
    const counts = result.current.absenceCountByDay;
    // a1: 10, 11, 12 mars = 3 days
    expect(counts['2026-03-10']).toBe(1);
    expect(counts['2026-03-11']).toBe(1);
    expect(counts['2026-03-12']).toBe(1);
    // a3: 20, 21 mars
    expect(counts['2026-03-20']).toBe(1);
    expect(counts['2026-03-21']).toBe(1);
  });

  it('sets isAllDay to true for all absences', () => {
    const { result } = renderHook(() => useCalendarAbsences());
    result.current.absences.forEach(a => {
      expect(a.isAllDay).toBe(true);
    });
  });

  it('returns isLoading from underlying hook', () => {
    const { result } = renderHook(() => useCalendarAbsences());
    expect(result.current.isLoading).toBe(false);
  });
});
