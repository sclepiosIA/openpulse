import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import type { RDSprint, RDUserStory } from '@/types/rd';
import { useSprintBurndown, useCumulativeFlowData } from './useSprintHistory';

vi.mock('date-fns', async (importOriginal) => {
  const actual = await importOriginal<typeof import('date-fns')>();
  return {
    ...actual,
    parseISO: (value: string) => {
      if (value === 'BAD') {
        throw new Error('x');
      }
      return actual.parseISO(value);
    },
  };
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

const SPRINT = {
  id: 'sprint-1',
  date_debut: '2025-01-06',
  date_fin: '2025-01-10',
} as unknown as RDSprint;

const STORIES = [
  { id: 's1', statut: 'done', points: 5 },
  { id: 's2', statut: 'todo', points: 5 },
] as unknown as RDUserStory[];

const CFD_STORIES = [
  { id: 'a', statut: 'done' },
  { id: 'b', statut: 'done' },
  { id: 'c', statut: 'done' },
  { id: 'd', statut: 'done' },
  { id: 'e', statut: 'todo' },
  { id: 'f', statut: 'todo' },
  { id: 'g', statut: 'in_progress' },
  { id: 'h', statut: 'review' },
  { id: 'i', statut: 'backlog' },
  { id: 'j', statut: 'backlog' },
] as unknown as RDUserStory[];

describe('useSprintHistory', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2025, 0, 10, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('useSprintBurndown', () => {
    it('reste désactivé (idle) quand le sprint est null', () => {
      const { result } = renderHook(() => useSprintBurndown(null, STORIES), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe('idle');
      expect(result.current.data).toBeUndefined();
    });

    it('reste désactivé quand les stories sont undefined', () => {
      const { result } = renderHook(() => useSprintBurndown(SPRINT, undefined), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe('idle');
      expect(result.current.data).toBeUndefined();
    });

    it('passe par isLoading puis calcule le burndown idéal et réel', async () => {
      const { result } = renderHook(() => useSprintBurndown(SPRINT, STORIES), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const data = result.current.data ?? [];
      expect(data).toHaveLength(5);

      // Premier jour : 10 points restants partout
      expect(data[0]).toEqual({ date: '06/01', ideal: 10, actual: 10, remaining: 10 });

      // Jour 2 : ideal = 10 - 2.5, actual interpolé = 10 - 5 * (1/4) = 8.75 → 8.8
      expect(data[1]).toEqual({ date: '07/01', ideal: 7.5, actual: 8.8, remaining: 8.8 });

      // Jour 4 : 10 - 5 * (3/4) = 6.25 → 6.3
      expect(data[3]).toEqual({ date: '09/01', ideal: 2.5, actual: 6.3, remaining: 6.3 });

      // Dernier jour (= aujourd'hui) : ideal 0, restant réel = 10 - 5 done = 5
      expect(data[4]).toEqual({ date: '10/01', ideal: 0, actual: 5, remaining: 5 });
    });

    it('retourne un tableau vide quand le total des points est 0', async () => {
      const zeroStories = [
        { id: 's1', statut: 'todo', points: 0 },
        { id: 's2', statut: 'done', points: null },
      ] as unknown as RDUserStory[];

      const { result } = renderHook(() => useSprintBurndown(SPRINT, zeroStories), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual([]);
    });

    it('passe en isError quand le parsing des dates du sprint échoue', async () => {
      const badSprint = {
        id: 'sprint-bad',
        date_debut: 'BAD',
        date_fin: '2025-01-10',
      } as unknown as RDSprint;

      const { result } = renderHook(() => useSprintBurndown(badSprint, STORIES), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toBeInstanceOf(Error);
      expect((result.current.error as Error).message).toBe('x');
      expect(result.current.data).toBeUndefined();
    });
  });

  describe('useCumulativeFlowData', () => {
    it('reste désactivé (idle) quand projetId est undefined', () => {
      const { result } = renderHook(() => useCumulativeFlowData(undefined, CFD_STORIES), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe('idle');
      expect(result.current.data).toBeUndefined();
    });

    it('retourne un tableau vide quand il n y a aucune story', async () => {
      const { result } = renderHook(() => useCumulativeFlowData('projet-1', []), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual([]);
    });

    it('génère 14 points de CFD avec progression simulée du done', async () => {
      const { result } = renderHook(() => useCumulativeFlowData('projet-1', CFD_STORIES), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const data = result.current.data ?? [];
      expect(data).toHaveLength(14);

      // Premier point (il y a 13 jours, le 28/12) : progress = 0, done simulé = 0
      // remainingFromDone = 4 → backlog 2+round(1.2)=3, todo 2+round(1)=3,
      // in_progress 1+round(1)=2, review 1+round(0.8)=2
      expect(data[0]).toEqual({
        date: '28/12',
        backlog: 3,
        todo: 3,
        in_progress: 2,
        review: 2,
        done: 0,
      });

      // Dernier point (aujourd'hui 10/01) : progress = 1, done simulé = 4, comptages réels
      expect(data[13]).toEqual({
        date: '10/01',
        backlog: 2,
        todo: 2,
        in_progress: 1,
        review: 1,
        done: 4,
      });

      // Le done simulé est croissant sur la période
      const doneValues = data.map((point) => point.done);
      const sorted = [...doneValues].sort((a, b) => a - b);
      expect(doneValues).toEqual(sorted);
    });
  });
});