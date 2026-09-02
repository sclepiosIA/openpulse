import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCalendarFilters, type FilterableTask } from '../calendar/useCalendarFilters';

// AuthProvider mock — hook uses useAuth() internally.
vi.mock('@/components/AuthProvider', () => ({
  AuthProvider: ({ children }: { children: any }) => children,
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'test@test.com' },
    session: { access_token: 'mock-token' },
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
  useAuthSafe: () => ({
    user: { id: 'test-user-id', email: 'test@test.com' },
    session: { access_token: 'mock-token' },
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
}));


beforeEach(() => {
  localStorage.clear();
});

// Dates dynamiques pour éviter que les tests deviennent obsolètes :
// id '1' doit toujours être dans le futur, id '2' récent, id '4' >30j passé.
const futureDate = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const makeTasks = (): FilterableTask[] => [
  { id: '1', titre: 'Tâche Alpha', statut: 'En cours', priorite: 'Haute', echeance: futureDate(30), responsable_id: 'u1', categorie_id: 'c1', etablissement_id: 'e1' },
  { id: '2', titre: 'Tâche Beta', statut: 'Terminé', priorite: 'Basse', echeance: futureDate(7), responsable_id: 'u2', categorie_id: 'c2', etablissement_id: 'e2' },
  { id: '3', titre: 'Tâche Gamma', statut: 'En cours', priorite: 'Haute', echeance: futureDate(-200), responsable_id: 'u1', archive: true },
  { id: '4', titre: 'Obsolète', statut: 'En cours', echeance: futureDate(-90), responsable_id: 'u1' },
];

describe('useCalendarFilters', () => {
  it('initializes with default filters', () => {
    const { result } = renderHook(() => useCalendarFilters());
    expect(result.current.filters.search).toBe('');
    expect(result.current.filters.hideCompleted).toBe(true);
    expect(result.current.filters.hideObsolete).toBe(true);
  });

  it('filters archived tasks always', () => {
    const { result } = renderHook(() => useCalendarFilters());
    const filtered = result.current.filterTasks(makeTasks());
    expect(filtered.find(t => t.id === '3')).toBeUndefined();
  });

  it('hides completed tasks by default', () => {
    const { result } = renderHook(() => useCalendarFilters());
    const filtered = result.current.filterTasks(makeTasks());
    expect(filtered.find(t => t.statut === 'Terminé')).toBeUndefined();
  });

  it('hides obsolete tasks (>30 days past) by default', () => {
    const { result } = renderHook(() => useCalendarFilters());
    const filtered = result.current.filterTasks(makeTasks());
    expect(filtered.find(t => t.id === '4')).toBeUndefined();
  });

  it('filters by search text', () => {
    const { result } = renderHook(() => useCalendarFilters());
    act(() => { result.current.updateFilters({ search: 'alpha' }); });
    const filtered = result.current.filterTasks(makeTasks());
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('1');
  });

  it('filters by responsable', () => {
    const { result } = renderHook(() => useCalendarFilters());
    act(() => { result.current.updateFilters({ responsables: ['u2'], hideCompleted: false }); });
    const filtered = result.current.filterTasks(makeTasks());
    expect(filtered.every(t => t.responsable_id === 'u2')).toBe(true);
  });

  it('filters showOnlyMyTasks', () => {
    const { result } = renderHook(() => useCalendarFilters('u1'));
    act(() => { result.current.updateFilters({ showOnlyMyTasks: true }); });
    const filtered = result.current.filterTasks(makeTasks());
    expect(filtered.every(t => t.responsable_id === 'u1')).toBe(true);
  });

  it('resets filters', () => {
    const { result } = renderHook(() => useCalendarFilters());
    act(() => { result.current.updateFilters({ search: 'test' }); });
    act(() => { result.current.resetFilters(); });
    expect(result.current.filters.search).toBe('');
  });

  it('hasActiveFilters detects changes', () => {
    const { result } = renderHook(() => useCalendarFilters());
    expect(result.current.hasActiveFilters).toBe(false);
    act(() => { result.current.updateFilters({ search: 'x' }); });
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('filters by statut', () => {
    const { result } = renderHook(() => useCalendarFilters());
    act(() => { result.current.updateFilters({ statuts: ['En cours'], hideObsolete: false }); });
    const filtered = result.current.filterTasks(makeTasks());
    expect(filtered.every(t => t.statut === 'En cours')).toBe(true);
  });

  it('filters by etablissement', () => {
    const { result } = renderHook(() => useCalendarFilters());
    act(() => { result.current.updateFilters({ etablissements: ['e1'] }); });
    const filtered = result.current.filterTasks(makeTasks());
    expect(filtered.every(t => t.etablissement_id === 'e1')).toBe(true);
  });

  it('persists filters to localStorage', () => {
    const { result } = renderHook(() => useCalendarFilters());
    act(() => { result.current.updateFilters({ search: 'saved' }); });
    expect(localStorage.getItem('calendar-filters')).toContain('saved');
  });
});
