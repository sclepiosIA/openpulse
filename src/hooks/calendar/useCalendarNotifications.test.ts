/* @vitest-environment jsdom */

import React from 'react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCalendarNotifications } from './useCalendarNotifications';

const { FIXED_NOW, EMPTY_TASKS, BASE_TASKS } = vi.hoisted(() => ({
  FIXED_NOW: new Date('2024-06-10T10:00:00.000Z'),
  EMPTY_TASKS: [] as Array<{
    id: string;
    titre: string;
    echeance?: string;
    statut?: string;
    priorite?: string;
    responsable_id?: string;
  }>,
  BASE_TASKS: [
    {
      id: 't-overdue',
      titre: 'Corriger incident',
      echeance: '2024-06-08T10:00:00.000Z',
      statut: 'en_cours',
      priorite: 'low',
      responsable_id: 'u1',
    },
    {
      id: 't-today-high',
      titre: 'Préparer démo',
      echeance: '2024-06-10T18:00:00.000Z',
      statut: 'en_cours',
      priorite: 'high',
      responsable_id: 'u1',
    },
    {
      id: 't-deadline-1',
      titre: 'Envoyer rapport',
      echeance: '2024-06-11T10:00:00.000Z',
      statut: 'en_cours',
      priorite: 'medium',
      responsable_id: 'u1',
    },
    {
      id: 't-deadline-3',
      titre: 'Finaliser budget',
      echeance: '2024-06-13T10:00:00.000Z',
      statut: 'en_cours',
      priorite: 'low',
      responsable_id: 'u1',
    },
    {
      id: 't-far',
      titre: 'Plan annuel',
      echeance: '2024-06-20T10:00:00.000Z',
      statut: 'en_cours',
      priorite: 'low',
      responsable_id: 'u1',
    },
    {
      id: 't-done',
      titre: 'Tâche terminée',
      echeance: '2024-06-11T10:00:00.000Z',
      statut: 'terminee',
      priorite: 'high',
      responsable_id: 'u1',
    },
    {
      id: 't-other-user',
      titre: 'Tâche autre utilisateur',
      echeance: '2024-06-11T10:00:00.000Z',
      statut: 'en_cours',
      priorite: 'high',
      responsable_id: 'u2',
    },
    {
      id: 't-no-date',
      titre: 'Sans échéance',
      statut: 'en_cours',
      priorite: 'high',
      responsable_id: 'u1',
    },
  ] as Array<{
    id: string;
    titre: string;
    echeance?: string;
    statut?: string;
    priorite?: string;
    responsable_id?: string;
  }>,
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

describe('useCalendarNotifications', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retourne des notifications métier correctes, filtre les tâches terminées/non assignées et trie par priorité puis date', () => {
    const wrapper = createWrapper();

    const { result } = renderHook(
      () => useCalendarNotifications(BASE_TASKS, 'u1', 3),
      { wrapper }
    );

    expect(result.current).toHaveLength(4);

    expect(result.current.map(n => n.id)).toEqual([
      'overdue-t-overdue',
      'today-t-today-high',
      'deadline-t-deadline-1',
      'deadline-t-deadline-3',
    ]);

    expect(result.current[0]).toMatchObject({
      id: 'overdue-t-overdue',
      type: 'overdue',
      taskId: 't-overdue',
      taskTitle: 'Corriger incident',
      message: 'Tâche en retard de 2 jour(s)',
      priority: 'high',
    });
    expect(result.current[0].date.toISOString()).toBe('2024-06-08T10:00:00.000Z');

    expect(result.current[1]).toMatchObject({
      id: 'today-t-today-high',
      type: 'today',
      taskId: 't-today-high',
      taskTitle: 'Préparer démo',
      message: "Tâche à terminer aujourd'hui",
      priority: 'high',
    });
    expect(result.current[1].date.toISOString()).toBe('2024-06-10T18:00:00.000Z');

    expect(result.current[2]).toMatchObject({
      id: 'deadline-t-deadline-1',
      type: 'deadline',
      taskId: 't-deadline-1',
      taskTitle: 'Envoyer rapport',
      message: 'Échéance dans 1 jour(s)',
      priority: 'high',
    });
    expect(result.current[2].date.toISOString()).toBe('2024-06-11T10:00:00.000Z');

    expect(result.current[3]).toMatchObject({
      id: 'deadline-t-deadline-3',
      type: 'deadline',
      taskId: 't-deadline-3',
      taskTitle: 'Finaliser budget',
      message: 'Échéance dans 3 jour(s)',
      priority: 'medium',
    });
    expect(result.current[3].date.toISOString()).toBe('2024-06-13T10:00:00.000Z');
  });

  it('retourne une liste vide pendant le chargement initial simulé puis les notifications au succès via rerender', () => {
    const wrapper = createWrapper();

    const loadedTasks = [
      {
        id: 't1',
        titre: 'Revue contrat',
        echeance: '2024-06-10T12:00:00.000Z',
        statut: 'en_cours',
        priorite: 'low',
        responsable_id: 'u1',
      },
      {
        id: 't2',
        titre: 'Déployer correctif',
        echeance: '2024-06-09T10:00:00.000Z',
        statut: 'en_cours',
        priorite: 'medium',
        responsable_id: 'u1',
      },
    ];

    const { result, rerender } = renderHook(
      ({ tasks }) => useCalendarNotifications(tasks, 'u1', 3),
      {
        wrapper,
        initialProps: { tasks: EMPTY_TASKS },
      }
    );

    expect(result.current).toEqual([]);

    rerender({ tasks: loadedTasks });

    expect(result.current).toHaveLength(2);
    expect(result.current.map(n => n.type)).toEqual(['overdue', 'today']);
    expect(result.current.map(n => n.message)).toEqual([
      'Tâche en retard de 1 jour(s)',
      "Tâche à terminer aujourd'hui",
    ]);
    expect(result.current.map(n => n.priority)).toEqual(['high', 'medium']);
  });

  it('retourne une liste vide quand aucune tâche exploitable n’est fournie', () => {
    const wrapper = createWrapper();

    const { result } = renderHook(
      () => useCalendarNotifications(EMPTY_TASKS, 'u1', 3),
      { wrapper }
    );

    expect(result.current).toEqual([]);
  });

  it('n’applique pas le filtre utilisateur si currentUserId est non fourni', () => {
    const wrapper = createWrapper();

    const tasks = [
      {
        id: 'a',
        titre: 'Tâche A',
        echeance: '2024-06-11T10:00:00.000Z',
        statut: 'en_cours',
        priorite: 'low',
        responsable_id: 'u1',
      },
      {
        id: 'b',
        titre: 'Tâche B',
        echeance: '2024-06-09T10:00:00.000Z',
        statut: 'en_cours',
        priorite: 'low',
        responsable_id: 'u2',
      },
    ];

    const { result } = renderHook(
      () => useCalendarNotifications(tasks, undefined, 3),
      { wrapper }
    );

    expect(result.current).toHaveLength(2);
    expect(result.current.map(n => n.taskId)).toEqual(['b', 'a']);
    expect(result.current.map(n => n.message)).toEqual([
      'Tâche en retard de 1 jour(s)',
      'Échéance dans 1 jour(s)',
    ]);
  });

  it('respecte daysBeforeDeadline personnalisé', () => {
    const wrapper = createWrapper();

    const tasks = [
      {
        id: 'within-threshold',
        titre: 'Échéance proche',
        echeance: '2024-06-12T10:00:00.000Z',
        statut: 'en_cours',
        priorite: 'medium',
        responsable_id: 'u1',
      },
      {
        id: 'outside-threshold',
        titre: 'Échéance trop lointaine',
        echeance: '2024-06-13T10:00:00.000Z',
        statut: 'en_cours',
        priorite: 'medium',
        responsable_id: 'u1',
      },
    ];

    const { result } = renderHook(
      () => useCalendarNotifications(tasks, 'u1', 2),
      { wrapper }
    );

    expect(result.current).toHaveLength(1);
    expect(result.current[0]).toMatchObject({
      id: 'deadline-within-threshold',
      type: 'deadline',
      taskId: 'within-threshold',
      taskTitle: 'Échéance proche',
      message: 'Échéance dans 2 jour(s)',
      priority: 'medium',
    });
  });

  it('retourne une notification today de priorité medium quand la tâche du jour n’est pas prioritaire high', () => {
    const wrapper = createWrapper();

    const tasks = [
      {
        id: 'today-medium',
        titre: 'Point équipe',
        echeance: '2024-06-10T15:00:00.000Z',
        statut: 'en_cours',
        priorite: 'low',
        responsable_id: 'u1',
      },
    ];

    const { result } = renderHook(
      () => useCalendarNotifications(tasks, 'u1', 3),
      { wrapper }
    );

    expect(result.current).toHaveLength(1);
    expect(result.current[0]).toMatchObject({
      id: 'today-today-medium',
      type: 'today',
      message: "Tâche à terminer aujourd'hui",
      priority: 'medium',
    });
  });
});