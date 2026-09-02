import React from 'react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCalendarStats } from './useCalendarStats';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

interface TestTask {
  echeance?: string;
  date_realisation?: string;
  statut?: string;
  responsable_id?: string;
  categorie_id?: string;
  categories_taches?: { nom: string; couleur: string };
  responsable?: { prenom: string; nom: string };
}

const START_DATE = new Date(2024, 5, 1, 0, 0, 0);
const END_DATE = new Date(2024, 5, 30, 23, 59, 59);

const TASKS: TestTask[] = [
  {
    echeance: '2024-06-05T10:00:00',
    statut: 'terminee',
    categorie_id: 'c1',
    categories_taches: { nom: 'Admin', couleur: '#f00' },
    responsable_id: 'r1',
    responsable: { prenom: 'Jean', nom: 'Dupont' },
  },
  {
    echeance: '2024-06-10T10:00:00',
    statut: 'en_cours',
    categorie_id: 'c1',
    categories_taches: { nom: 'Admin', couleur: '#f00' },
    responsable_id: 'r1',
    responsable: { prenom: 'Jean', nom: 'Dupont' },
  },
  {
    echeance: '2024-06-18T10:00:00',
    statut: 'en_cours',
    categorie_id: 'c2',
    categories_taches: { nom: 'Tech', couleur: '#0f0' },
  },
  {
    echeance: '2024-07-10T10:00:00',
    statut: 'en_cours',
  },
  {
    statut: 'en_cours',
  },
];

describe('useCalendarStats', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 5, 15, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calcule les totaux et le taux de complétion sur la période', () => {
    const { result } = renderHook(() => useCalendarStats(TASKS, START_DATE, END_DATE), {
      wrapper: createWrapper(),
    });

    expect(result.current.totalTasks).toBe(3);
    expect(result.current.completedTasks).toBe(1);
    expect(result.current.completionRate).toBeCloseTo((1 / 3) * 100, 5);
    expect(result.current.period.start).toBe(START_DATE);
    expect(result.current.period.end).toBe(END_DATE);
  });

  it('compte les tâches en retard (non terminées avec échéance passée)', () => {
    const { result } = renderHook(() => useCalendarStats(TASKS, START_DATE, END_DATE), {
      wrapper: createWrapper(),
    });

    expect(result.current.overdueTasks).toBe(1);
  });

  it('compte les tâches à venir sur 7 et 30 jours', () => {
    const { result } = renderHook(() => useCalendarStats(TASKS, START_DATE, END_DATE), {
      wrapper: createWrapper(),
    });

    expect(result.current.upcomingTasks.next7Days).toBe(1);
    expect(result.current.upcomingTasks.next30Days).toBe(2);
  });

  it('calcule la moyenne de tâches par jour selon la durée de la période', () => {
    const { result } = renderHook(() => useCalendarStats(TASKS, START_DATE, END_DATE), {
      wrapper: createWrapper(),
    });

    const daysDiff = Math.max(
      1,
      Math.ceil((END_DATE.getTime() - START_DATE.getTime()) / (1000 * 60 * 60 * 24))
    );
    expect(result.current.avgTasksPerDay).toBeCloseTo(3 / daysDiff, 5);
  });

  it('répartit les tâches par catégorie triées par count décroissant', () => {
    const { result } = renderHook(() => useCalendarStats(TASKS, START_DATE, END_DATE), {
      wrapper: createWrapper(),
    });

    expect(result.current.tasksByCategory).toHaveLength(2);
    expect(result.current.tasksByCategory[0]).toEqual({
      categoryId: 'c1',
      categoryName: 'Admin',
      count: 2,
      percentage: (2 / 3) * 100,
      color: '#f00',
    });
    expect(result.current.tasksByCategory[1]).toEqual({
      categoryId: 'c2',
      categoryName: 'Tech',
      count: 1,
      percentage: (1 / 3) * 100,
      color: '#0f0',
    });
  });

  it('répartit les tâches par responsable avec workload low pour <= 3 tâches', () => {
    const { result } = renderHook(() => useCalendarStats(TASKS, START_DATE, END_DATE), {
      wrapper: createWrapper(),
    });

    expect(result.current.tasksByAssignee).toHaveLength(1);
    expect(result.current.tasksByAssignee[0]).toEqual({
      assigneeId: 'r1',
      assigneeName: 'Jean Dupont',
      count: 2,
      workload: 'low',
    });
  });

  it('attribue workload medium (4-6) et high (>6) selon le nombre de tâches', () => {
    const makeTasks = (count: number, assigneeId: string): TestTask[] =>
      Array.from({ length: count }, (_, i) => ({
        echeance: `2024-06-${String(2 + i).padStart(2, '0')}T10:00:00`,
        statut: 'en_cours',
        responsable_id: assigneeId,
        responsable: { prenom: 'Marie', nom: 'Curie' },
      }));

    const mediumTasks = makeTasks(5, 'r2');
    const { result: mediumResult } = renderHook(
      () => useCalendarStats(mediumTasks, START_DATE, END_DATE),
      { wrapper: createWrapper() }
    );
    expect(mediumResult.current.tasksByAssignee[0].workload).toBe('medium');

    const highTasks = makeTasks(7, 'r3');
    const { result: highResult } = renderHook(
      () => useCalendarStats(highTasks, START_DATE, END_DATE),
      { wrapper: createWrapper() }
    );
    expect(highResult.current.tasksByAssignee[0].workload).toBe('high');
  });

  it('construit la distribution temporelle triée par date', () => {
    const { result } = renderHook(() => useCalendarStats(TASKS, START_DATE, END_DATE), {
      wrapper: createWrapper(),
    });

    expect(result.current.timeDistribution).toEqual([
      { date: '2024-06-05', count: 1 },
      { date: '2024-06-10', count: 1 },
      { date: '2024-06-18', count: 1 },
    ]);
  });

  it('agrège plusieurs tâches le même jour dans timeDistribution', () => {
    const sameDayTasks: TestTask[] = [
      { echeance: '2024-06-08T08:00:00', statut: 'en_cours' },
      { echeance: '2024-06-08T15:00:00', statut: 'terminee' },
    ];
    const { result } = renderHook(
      () => useCalendarStats(sameDayTasks, START_DATE, END_DATE),
      { wrapper: createWrapper() }
    );

    expect(result.current.timeDistribution).toEqual([{ date: '2024-06-08', count: 2 }]);
    expect(result.current.totalTasks).toBe(2);
    expect(result.current.completedTasks).toBe(1);
  });

  it('retourne des valeurs neutres avec une liste de tâches vide', () => {
    const emptyTasks: TestTask[] = [];
    const { result } = renderHook(
      () => useCalendarStats(emptyTasks, START_DATE, END_DATE),
      { wrapper: createWrapper() }
    );

    expect(result.current.totalTasks).toBe(0);
    expect(result.current.completedTasks).toBe(0);
    expect(result.current.completionRate).toBe(0);
    expect(result.current.overdueTasks).toBe(0);
    expect(result.current.upcomingTasks).toEqual({ next7Days: 0, next30Days: 0 });
    expect(result.current.avgTasksPerDay).toBe(0);
    expect(result.current.tasksByCategory).toEqual([]);
    expect(result.current.tasksByAssignee).toEqual([]);
    expect(result.current.timeDistribution).toEqual([]);
  });

  it('ignore les tâches sans échéance et hors période pour les totaux', () => {
    const outsideTasks: TestTask[] = [
      { statut: 'en_cours' },
      { echeance: '2024-08-01T10:00:00', statut: 'en_cours' },
    ];
    const { result } = renderHook(
      () => useCalendarStats(outsideTasks, START_DATE, END_DATE),
      { wrapper: createWrapper() }
    );

    expect(result.current.totalTasks).toBe(0);
    expect(result.current.timeDistribution).toEqual([]);
  });
});