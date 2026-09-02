import React from 'react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFindAvailableSlots } from './useFindAvailableSlots';

const H = vi.hoisted(() => {
  const EVENTS = [
    {
      id: 'e1',
      start_time: new Date(2025, 0, 6, 9, 0, 0).toISOString(),
      end_time: new Date(2025, 0, 6, 10, 0, 0).toISOString(),
      status: 'confirmed',
    },
  ];
  const NO_EVENTS: typeof EVENTS = [];
  const CANCELLED_EVENTS = [
    {
      id: 'e2',
      start_time: new Date(2025, 0, 6, 9, 0, 0).toISOString(),
      end_time: new Date(2025, 0, 6, 10, 0, 0).toISOString(),
      status: 'cancelled',
    },
  ];
  const ABSENCE_TUESDAY = [
    {
      profile_id: 'u1',
      start: new Date(2025, 0, 7, 0, 0, 0),
      end: new Date(2025, 0, 7, 23, 0, 0),
    },
  ];
  const NO_ABSENCES: typeof ABSENCE_TUESDAY = [];
  const NO_AVAILABILITIES: { user_id: string; start_time: string; end_time: string }[] = [];
  return {
    EVENTS,
    NO_EVENTS,
    CANCELLED_EVENTS,
    ABSENCE_TUESDAY,
    NO_ABSENCES,
    NO_AVAILABILITIES,
    mockUseCalendarEvents: vi.fn(),
    mockUseCalendarAbsences: vi.fn(),
    mockUseTeamAvailabilities: vi.fn(),
  };
});

vi.mock('../calendar/useCalendarEvents', () => ({
  useCalendarEvents: H.mockUseCalendarEvents,
}));

vi.mock('../calendar/useCalendarAbsences', () => ({
  useCalendarAbsences: H.mockUseCalendarAbsences,
}));

vi.mock('./useAvailabilities', () => ({
  useTeamAvailabilities: H.mockUseTeamAvailabilities,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

const NO_EVENTS_RESULT = { data: H.NO_EVENTS };
const EVENTS_RESULT = { data: H.EVENTS };
const CANCELLED_RESULT = { data: H.CANCELLED_EVENTS };
const NO_ABSENCES_RESULT = { absences: H.NO_ABSENCES };
const ABSENCE_RESULT = { absences: H.ABSENCE_TUESDAY };
const NO_AVAIL_RESULT = { data: H.NO_AVAILABILITIES };
const UNDEFINED_EVENTS_RESULT = { data: undefined };
const UNDEFINED_ABSENCES_RESULT = { absences: undefined };
const UNDEFINED_AVAIL_RESULT = { data: undefined };

describe('useFindAvailableSlots', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Lundi 6 janvier 2025, 08:00 locale
    vi.setSystemTime(new Date(2025, 0, 6, 8, 0, 0));
    H.mockUseCalendarEvents.mockReturnValue(NO_EVENTS_RESULT);
    H.mockUseCalendarAbsences.mockReturnValue(NO_ABSENCES_RESULT);
    H.mockUseTeamAvailabilities.mockReturnValue(NO_AVAIL_RESULT);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  const baseParams = {
    participantUserIds: ['u1', 'u2'],
    durationMinutes: 60,
    searchStartDate: new Date(2025, 0, 6, 0, 0, 0),
    searchEndDate: new Date(2025, 0, 8, 0, 0, 0),
  };

  it('retourne un tableau vide si aucun participant', () => {
    const { result } = renderHook(
      () =>
        useFindAvailableSlots({
          ...baseParams,
          participantUserIds: [],
        }),
      { wrapper: createWrapper() }
    );

    expect(result.current.slots).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('trouve des créneaux dans les heures de travail et évite les conflits avec les événements', () => {
    H.mockUseCalendarEvents.mockReturnValue(EVENTS_RESULT);

    const { result } = renderHook(() => useFindAvailableSlots(baseParams), {
      wrapper: createWrapper(),
    });

    const slots = result.current.slots;
    expect(slots.length).toBe(10);

    // Le meilleur créneau est lundi 10:00 (score 120 : +20 pour 10h, 0 jour d'écart)
    expect(slots[0].start.getTime()).toBe(new Date(2025, 0, 6, 10, 0, 0).getTime());
    expect(slots[0].end.getTime()).toBe(new Date(2025, 0, 6, 11, 0, 0).getTime());
    expect(slots[0].score).toBe(120);

    // Aucun créneau ne chevauche l'événement lundi 9:00-10:00
    const eventStart = new Date(2025, 0, 6, 9, 0, 0).getTime();
    const eventEnd = new Date(2025, 0, 6, 10, 0, 0).getTime();
    for (const slot of slots) {
      const overlaps =
        slot.start.getTime() < eventEnd && slot.end.getTime() > eventStart;
      expect(overlaps).toBe(false);
      // Heures de travail respectées (9h-18h)
      expect(slot.start.getHours()).toBeGreaterThanOrEqual(9);
      expect(slot.end.getHours() + slot.end.getMinutes() / 60).toBeLessThanOrEqual(18);
    }

    // Tri par score décroissant
    const scores = slots.map(s => s.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('ignore les événements annulés', () => {
    H.mockUseCalendarEvents.mockReturnValue(CANCELLED_RESULT);

    const { result } = renderHook(() => useFindAvailableSlots(baseParams), {
      wrapper: createWrapper(),
    });

    // Le créneau lundi 9:00 est disponible car l'événement est annulé
    const mondayNine = result.current.slots.find(
      s => s.start.getTime() === new Date(2025, 0, 6, 9, 0, 0).getTime()
    );
    expect(mondayNine).toBeDefined();
    expect(mondayNine?.score).toBe(110); // 100 + 10 (9h) - 0 jours
  });

  it('exclut les jours entiers couverts par une absence', () => {
    H.mockUseCalendarAbsences.mockReturnValue(ABSENCE_RESULT);

    const { result } = renderHook(() => useFindAvailableSlots(baseParams), {
      wrapper: createWrapper(),
    });

    const slots = result.current.slots;
    expect(slots.length).toBeGreaterThan(0);
    // Aucun créneau le mardi 7 janvier (absence toute la journée)
    for (const slot of slots) {
      expect(slot.start.getDate()).toBe(6);
      expect(slot.start.getMonth()).toBe(0);
    }
  });

  it('saute les week-ends quand includeWeekends est false', () => {
    // Vendredi 10 janvier 2025, 08:00
    vi.setSystemTime(new Date(2025, 0, 10, 8, 0, 0));

    const { result } = renderHook(
      () =>
        useFindAvailableSlots({
          ...baseParams,
          searchStartDate: new Date(2025, 0, 10, 0, 0, 0),
          searchEndDate: new Date(2025, 0, 14, 0, 0, 0),
          maxResults: 20,
        }),
      { wrapper: createWrapper() }
    );

    const slots = result.current.slots;
    expect(slots.length).toBeGreaterThan(0);
    for (const slot of slots) {
      const day = slot.start.getDay();
      expect(day).not.toBe(0); // pas dimanche
      expect(day).not.toBe(6); // pas samedi
    }
    // Présence de créneaux vendredi (10) et lundi (13)
    expect(slots.some(s => s.start.getDate() === 10)).toBe(true);
    expect(slots.some(s => s.start.getDate() === 13)).toBe(true);
  });

  it('limite le nombre de résultats avec maxResults', () => {
    const { result } = renderHook(
      () => useFindAvailableSlots({ ...baseParams, maxResults: 3 }),
      { wrapper: createWrapper() }
    );

    expect(result.current.slots.length).toBe(3);
    expect(result.current.slots[0].score).toBe(120);
  });

  it('reste stable quand les hooks internes renvoient undefined (chargement)', () => {
    H.mockUseCalendarEvents.mockReturnValue(UNDEFINED_EVENTS_RESULT);
    H.mockUseCalendarAbsences.mockReturnValue(UNDEFINED_ABSENCES_RESULT);
    H.mockUseTeamAvailabilities.mockReturnValue(UNDEFINED_AVAIL_RESULT);

    const { result } = renderHook(() => useFindAvailableSlots(baseParams), {
      wrapper: createWrapper(),
    });

    // Sans données busy, des créneaux sont quand même calculés
    expect(result.current.slots.length).toBe(10);
    expect(result.current.isLoading).toBe(false);
    // Premier créneau possible : lundi 9:00 n'est pas bloqué
    const nineAm = new Date(2025, 0, 6, 9, 0, 0).getTime();
    expect(result.current.slots.some(s => s.start.getTime() === nineAm)).toBe(true);
  });

  it('respecte les heures de travail personnalisées et bloque les indisponibilités personnelles', () => {
    const AVAIL_RESULT = {
      data: [
        {
          user_id: 'u1',
          start_time: new Date(2025, 0, 6, 10, 0, 0).toISOString(),
          end_time: new Date(2025, 0, 6, 12, 0, 0).toISOString(),
        },
      ],
    };
    H.mockUseTeamAvailabilities.mockReturnValue(AVAIL_RESULT);

    const { result } = renderHook(
      () =>
        useFindAvailableSlots({
          ...baseParams,
          workingHoursStart: 10,
          workingHoursEnd: 14,
          maxResults: 20,
        }),
      { wrapper: createWrapper() }
    );

    const slots = result.current.slots;
    expect(slots.length).toBeGreaterThan(0);

    const blockedStart = new Date(2025, 0, 6, 10, 0, 0).getTime();
    const blockedEnd = new Date(2025, 0, 6, 12, 0, 0).getTime();
    for (const slot of slots) {
      // Heures de travail 10h-14h respectées
      expect(slot.start.getHours()).toBeGreaterThanOrEqual(10);
      expect(slot.end.getHours() + slot.end.getMinutes() / 60).toBeLessThanOrEqual(14);
      // Pas de chevauchement avec l'indisponibilité lundi 10:00-12:00
      const overlaps =
        slot.start.getTime() < blockedEnd && slot.end.getTime() > blockedStart;
      expect(overlaps).toBe(false);
    }

    // Le créneau lundi 12:00-13:00 existe (juste après le blocage)
    expect(
      slots.some(s => s.start.getTime() === new Date(2025, 0, 6, 12, 0, 0).getTime())
    ).toBe(true);
  });
});