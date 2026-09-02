/* @vitest-environment jsdom */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCalendarFilters, type FilterableTask, type EtablissementWithStatus } from './useCalendarFilters';
import { filterTasksByEstablishmentPhase } from '../tasks/useTaskPhaseFilter';

const { mockFilterTasksByEstablishmentPhase, ETABLISSEMENTS, TASKS } = vi.hoisted(() => {
  const now = new Date();
  const within10Days = new Date(now);
  within10Days.setDate(now.getDate() + 10);

  const within5Days = new Date(now);
  within5Days.setDate(now.getDate() + 5);

  const old40Days = new Date(now);
  old40Days.setDate(now.getDate() - 40);

  return {
    mockFilterTasksByEstablishmentPhase: vi.fn(),
    ETABLISSEMENTS: [
      { id: 'e1', statut: 'ouvert' },
      { id: 'e2', statut: 'ferme' },
    ] satisfies EtablissementWithStatus[],
    TASKS: [
      {
        id: 't1',
        titre: 'Audit sécurité',
        description: 'Contrôle complet',
        statut: 'En cours',
        priorite: 'Haute',
        echeance: within10Days.toISOString(),
        responsable_id: 'u1',
        categorie_id: 'c1',
        etablissement_id: 'e1',
        archive: false,
      },
      {
        id: 't2',
        titre: 'Rapport final',
        description: 'Document à valider',
        statut: 'Terminé',
        priorite: 'Basse',
        echeance: within5Days.toISOString(),
        responsable_id: 'u2',
        categorie_id: 'c2',
        etablissement_id: 'e2',
        archive: false,
      },
      {
        id: 't3',
        titre: 'Ancienne relance',
        description: 'Tâche dépassée',
        statut: 'En cours',
        priorite: 'Moyenne',
        echeance: old40Days.toISOString(),
        responsable_id: 'u1',
        categorie_id: 'c1',
        etablissement_id: 'e1',
        archive: false,
      },
      {
        id: 't4',
        titre: 'Archive interne',
        description: 'Ne doit jamais sortir',
        statut: 'En cours',
        priorite: 'Haute',
        echeance: within10Days.toISOString(),
        responsable_id: 'u1',
        categorie_id: 'c1',
        etablissement_id: 'e1',
        archive: true,
      },
      {
        id: 't5',
        titre: 'Inspection cuisine',
        description: 'Visite sur site',
        statut: 'En attente',
        priorite: 'Moyenne',
        echeance: within5Days.toISOString(),
        responsable_id: 'u3',
        categorie_id: 'c3',
        etablissement_id: 'e2',
        archive: false,
      },
    ] satisfies FilterableTask[],
  };
});

vi.mock('../tasks/useTaskPhaseFilter', () => ({
  filterTasksByEstablishmentPhase: mockFilterTasksByEstablishmentPhase,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useCalendarFilters', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockFilterTasksByEstablishmentPhase.mockImplementation((tasks: FilterableTask[]) => tasks);
  });

  it('initialise avec les filtres par défaut et hasActiveFilters à false', () => {
    const { result } = renderHook(() => useCalendarFilters('u1'), {
      wrapper: createWrapper(),
    });

    expect(result.current.filters).toEqual({
      search: '',
      responsables: [],
      categories: [],
      statuts: [],
      priorites: [],
      etablissements: [],
      dateRange: { start: null, end: null },
      showOnlyMyTasks: false,
      hideCompleted: true,
      hideObsolete: true,
    });
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it('charge les filtres depuis localStorage et reconvertit les dates', () => {
    localStorage.setItem(
      'calendar-filters',
      JSON.stringify({
        search: 'audit',
        responsables: ['u1'],
        dateRange: {
          start: '2024-02-01T00:00:00.000Z',
          end: '2024-02-20T00:00:00.000Z',
        },
        hideCompleted: false,
      })
    );

    const { result } = renderHook(() => useCalendarFilters('u1'), {
      wrapper: createWrapper(),
    });

    expect(result.current.filters.search).toBe('audit');
    expect(result.current.filters.responsables).toEqual(['u1']);
    expect(result.current.filters.hideCompleted).toBe(false);
    expect(result.current.filters.dateRange.start instanceof Date).toBe(true);
    expect(result.current.filters.dateRange.end instanceof Date).toBe(true);
    expect(result.current.filters.dateRange.start?.toISOString()).toBe('2024-02-01T00:00:00.000Z');
    expect(result.current.filters.dateRange.end?.toISOString()).toBe('2024-02-20T00:00:00.000Z');
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('retombe sur les valeurs par défaut si le JSON localStorage est invalide', () => {
    localStorage.setItem('calendar-filters', '{invalid-json');

    const { result } = renderHook(() => useCalendarFilters('u1'), {
      wrapper: createWrapper(),
    });

    expect(result.current.filters.search).toBe('');
    expect(result.current.filters.hideCompleted).toBe(true);
    expect(result.current.filters.hideObsolete).toBe(true);
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it('updateFilters met à jour l état et persiste dans localStorage', () => {
    const { result } = renderHook(() => useCalendarFilters('u1'), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.updateFilters({
        search: 'inspection',
        responsables: ['u3'],
        hideCompleted: false,
      });
    });

    expect(result.current.filters.search).toBe('inspection');
    expect(result.current.filters.responsables).toEqual(['u3']);
    expect(result.current.filters.hideCompleted).toBe(false);
    expect(result.current.hasActiveFilters).toBe(true);

    const saved = localStorage.getItem('calendar-filters');
    expect(saved).not.toBeNull();
    expect(JSON.parse(saved as string)).toMatchObject({
      search: 'inspection',
      responsables: ['u3'],
      hideCompleted: false,
    });
  });

  it('resetFilters restaure les valeurs par défaut et supprime localStorage', () => {
    const { result } = renderHook(() => useCalendarFilters('u1'), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.updateFilters({
        search: 'audit',
        categories: ['c1'],
        hideCompleted: false,
      });
    });

    expect(localStorage.getItem('calendar-filters')).not.toBeNull();

    act(() => {
      result.current.resetFilters();
    });

    expect(result.current.filters).toEqual({
      search: '',
      responsables: [],
      categories: [],
      statuts: [],
      priorites: [],
      etablissements: [],
      dateRange: { start: null, end: null },
      showOnlyMyTasks: false,
      hideCompleted: true,
      hideObsolete: true,
    });
    expect(result.current.hasActiveFilters).toBe(false);
    expect(localStorage.getItem('calendar-filters')).toBeNull();
  });

  it('filtre les tâches par défaut: exclut archivées, terminées et obsolètes', () => {
    const { result } = renderHook(() => useCalendarFilters('u1'), {
      wrapper: createWrapper(),
    });

    const filtered = result.current.filterTasks(TASKS);

    expect(filtered.map(task => task.id)).toEqual(['t1', 't5']);
  });

  it('applique la recherche textuelle sur titre et description', () => {
    const { result } = renderHook(() => useCalendarFilters('u1'), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.updateFilters({
        search: 'sécurité',
        hideCompleted: false,
        hideObsolete: false,
      });
    });

    const filtered = result.current.filterTasks(TASKS);

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe('t1');
  });

  it('filtre par showOnlyMyTasks avec currentUserId', () => {
    const { result } = renderHook(() => useCalendarFilters('u1'), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.updateFilters({
        showOnlyMyTasks: true,
        hideCompleted: false,
        hideObsolete: false,
      });
    });

    const filtered = result.current.filterTasks(TASKS);

    expect(filtered.map(task => task.id)).toEqual(['t1', 't3']);
  });

  it('applique les filtres par responsables, catégories, statuts, priorités et établissements', () => {
    const { result } = renderHook(() => useCalendarFilters('u1'), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.updateFilters({
        responsables: ['u3'],
        categories: ['c3'],
        statuts: ['En attente'],
        priorites: ['Moyenne'],
        etablissements: ['e2'],
        hideCompleted: false,
        hideObsolete: false,
      });
    });

    const filtered = result.current.filterTasks(TASKS);

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe('t5');
  });

  it('applique le filtre de plage de dates avec start et end inclusifs', () => {
    const start = new Date(TASKS[4].echeance as string);
    start.setDate(start.getDate() - 1);

    const end = new Date(TASKS[0].echeance as string);
    end.setDate(end.getDate() + 1);

    const { result } = renderHook(() => useCalendarFilters('u1'), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.updateFilters({
        dateRange: { start, end },
        hideCompleted: false,
        hideObsolete: false,
      });
    });

    const filtered = result.current.filterTasks(TASKS);

    expect(filtered.map(task => task.id)).toEqual(['t1', 't2', 't5']);
  });

  it('applique le filtre de date avec start seul puis end seul', () => {
    const startOnly = new Date(TASKS[0].echeance as string);
    startOnly.setDate(startOnly.getDate() - 1);

    const { result } = renderHook(() => useCalendarFilters('u1'), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.updateFilters({
        dateRange: { start: startOnly, end: null },
        hideCompleted: false,
        hideObsolete: false,
      });
    });

    const startFiltered = result.current.filterTasks(TASKS);
    expect(startFiltered.map(task => task.id)).toEqual(['t1']);

    const endOnly = new Date(TASKS[4].echeance as string);
    endOnly.setDate(endOnly.getDate() + 1);

    act(() => {
      result.current.updateFilters({
        dateRange: { start: null, end: endOnly },
        hideCompleted: false,
        hideObsolete: false,
      });
    });

    const endFiltered = result.current.filterTasks(TASKS);
    expect(endFiltered.map(task => task.id)).toEqual(['t2', 't3', 't5']);
  });

  it('appelle filterTasksByEstablishmentPhase quand des établissements sont fournis', () => {
    mockFilterTasksByEstablishmentPhase.mockReturnValue([TASKS[0], TASKS[1], TASKS[3]]);

    const { result } = renderHook(() => useCalendarFilters('u1', ETABLISSEMENTS), {
      wrapper: createWrapper(),
    });

    const filtered = result.current.filterTasks(TASKS);

    expect(filterTasksByEstablishmentPhase).toHaveBeenCalledTimes(1);
    expect(filterTasksByEstablishmentPhase).toHaveBeenCalledWith(TASKS, ETABLISSEMENTS);
    expect(filtered.map(task => task.id)).toEqual(['t1']);
  });

  it('n appelle pas filterTasksByEstablishmentPhase sans établissements', () => {
    const { result } = renderHook(() => useCalendarFilters('u1', []), {
      wrapper: createWrapper(),
    });

    const filtered = result.current.filterTasks(TASKS);

    expect(filterTasksByEstablishmentPhase).not.toHaveBeenCalled();
    expect(filtered.map(task => task.id)).toEqual(['t1', 't5']);
  });
});