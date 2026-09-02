/* @vitest-environment jsdom */
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCalendarAbsences } from './useCalendarAbsences';

type RHAbsence = {
  id: string;
  profile_id: string;
  type_absence: string;
  statut: string;
  date_debut: string;
  date_fin: string;
  motif?: string;
  profiles?: {
    prenom?: string;
    nom?: string;
    email?: string;
  };
};

const { RH_STATE, useRHAbsencesMock } = vi.hoisted(() => ({
  RH_STATE: {
    absences: undefined as RHAbsence[] | undefined,
    isLoading: true,
  },
  useRHAbsencesMock: vi.fn(),
}));

vi.mock('../hr/useRHAbsences', () => ({
  useRHAbsences: useRHAbsencesMock,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children);
  };
}

describe('useCalendarAbsences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    RH_STATE.absences = undefined;
    RH_STATE.isLoading = true;
    useRHAbsencesMock.mockImplementation(() => ({
      absences: RH_STATE.absences,
      isLoading: RH_STATE.isLoading,
    }));
  });

  it('expose le chargement puis transforme et filtre correctement les absences approuvées', async () => {
    const wrapper = createWrapper();

    const { result, rerender } = renderHook(
      () => useCalendarAbsences('2024-05-01', '2024-05-31'),
      { wrapper }
    );

    expect(useRHAbsencesMock).toHaveBeenCalledWith(undefined, '2024-05-01', '2024-05-31');
    expect(result.current.isLoading).toBe(true);
    expect(result.current.absences).toEqual([]);
    expect(result.current.totalCount).toBe(0);
    expect(result.current.absenceCountByDay).toEqual({});

    RH_STATE.absences = [
      {
        id: 'a1',
        profile_id: 'p1',
        type_absence: 'conges_payes',
        statut: 'approuve',
        date_debut: '2024-05-10',
        date_fin: '2024-05-12',
        motif: 'vacances',
        profiles: { prenom: 'Jean', nom: 'Dupont', email: 'jean@example.test' },
      },
      {
        id: 'a2',
        profile_id: 'p2',
        type_absence: 'rtt',
        statut: 'validé',
        date_debut: '2024-05-11',
        date_fin: '2024-05-11',
        profiles: { prenom: 'Lina', nom: 'Martin', email: 'lina@example.test' },
      },
      {
        id: 'a3',
        profile_id: 'p3',
        type_absence: 'maladie',
        statut: 'en_attente',
        date_debut: '2024-05-09',
        date_fin: '2024-05-09',
        profiles: { prenom: 'Paul', nom: 'Durand', email: 'paul@example.test' },
      },
      {
        id: 'a4',
        profile_id: 'p4',
        type_absence: 'teletravail',
        statut: 'approuvé',
        date_debut: '2024-05-12',
        date_fin: '2024-05-12',
        profiles: { prenom: 'Nora', nom: 'Petit', email: 'nora@example.test' },
      },
      {
        id: 'a5',
        profile_id: 'p5',
        type_absence: 'type_inconnu',
        statut: 'approuve',
        date_debut: '2024-05-13',
        date_fin: '2024-05-13',
        profiles: { prenom: 'Zoe', nom: 'Roux', email: 'zoe@example.test' },
      },
    ];
    RH_STATE.isLoading = false;

    rerender();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.totalCount).toBe(4);
    });

    expect(result.current.absences).toHaveLength(4);

    expect(result.current.absences[0]).toMatchObject({
      id: 'a1',
      title: 'Congés payés - Jean Dupont',
      profile_id: 'p1',
      profile_name: 'Jean Dupont',
      profile_email: 'jean@example.test',
      type: 'conges_payes',
      status: 'approuve',
      motif: 'vacances',
      color: '#3B82F6',
      isAllDay: true,
    });
    expect(result.current.absences[0].start).toEqual(new Date(2024, 4, 10));
    expect(result.current.absences[0].end).toEqual(new Date(2024, 4, 12));

    expect(result.current.absences[1]).toMatchObject({
      id: 'a2',
      title: 'RTT - Lina Martin',
      color: '#10B981',
    });

    expect(result.current.absences[2]).toMatchObject({
      id: 'a4',
      title: 'Télétravail - Nora Petit',
      color: '#6366F1',
    });

    expect(result.current.absences[3]).toMatchObject({
      id: 'a5',
      title: 'type_inconnu - Zoe Roux',
      color: '#6B7280',
    });

    expect(result.current.absenceCountByDay).toEqual({
      '2024-05-10': 1,
      '2024-05-11': 2,
      '2024-05-12': 2,
      '2024-05-13': 1,
    });

    const onMay11 = result.current.getAbsencesForDay(new Date('2024-05-11T00:00:00.000Z'));
    expect(onMay11.map((absence) => absence.id)).toEqual(['a1', 'a2']);

    const onMay12 = result.current.getAbsencesForDay(new Date('2024-05-12T00:00:00.000Z'));
    expect(onMay12.map((absence) => absence.id)).toEqual(['a1', 'a4']);

    const onMay14 = result.current.getAbsencesForDay(new Date('2024-05-14T00:00:00.000Z'));
    expect(onMay14).toEqual([]);
  });

  it('filtre par profileIds quand la liste est fournie', async () => {
    const wrapper = createWrapper();

    RH_STATE.absences = [
      {
        id: 'b1',
        profile_id: 'p1',
        type_absence: 'formation',
        statut: 'approuve',
        date_debut: '2024-06-03',
        date_fin: '2024-06-04',
        profiles: { prenom: 'Eva', nom: 'Morel', email: 'eva@example.test' },
      },
      {
        id: 'b2',
        profile_id: 'p2',
        type_absence: 'autre',
        statut: 'approuve',
        date_debut: '2024-06-04',
        date_fin: '2024-06-04',
        profiles: { prenom: 'Tom', nom: 'Bernard', email: 'tom@example.test' },
      },
      {
        id: 'b3',
        profile_id: 'p3',
        type_absence: 'rtt',
        statut: 'refuse',
        date_debut: '2024-06-04',
        date_fin: '2024-06-04',
        profiles: { prenom: 'Mia', nom: 'Lopez', email: 'mia@example.test' },
      },
    ];
    RH_STATE.isLoading = false;

    const { result } = renderHook(
      () => useCalendarAbsences('2024-06-01', '2024-06-30', ['p2']),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.totalCount).toBe(1);
    expect(result.current.absences).toHaveLength(1);
    expect(result.current.absences[0]).toMatchObject({
      id: 'b2',
      profile_id: 'p2',
      title: 'Autre - Tom Bernard',
      color: '#6B7280',
    });
    expect(result.current.absenceCountByDay).toEqual({
      '2024-06-04': 1,
    });
  });

  it('retourne un état vide quand absences est nullish', async () => {
    const wrapper = createWrapper();

    RH_STATE.absences = undefined;
    RH_STATE.isLoading = false;

    const { result } = renderHook(() => useCalendarAbsences(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.absences).toEqual([]);
    expect(result.current.totalCount).toBe(0);
    expect(result.current.absenceCountByDay).toEqual({});
    expect(result.current.getAbsencesForDay(new Date('2024-07-01T00:00:00.000Z'))).toEqual([]);
  });
});