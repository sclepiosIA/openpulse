// @vitest-environment jsdom

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { useUpcomingAppointments, useWeeklyAppointmentsCount } from "./useUpcomingAppointments";

const {
  AUTH_STATE,
  CALENDAR_ROWS,
  EVENTS_ROWS,
  EMPTY_ROWS,
  COUNT_RESULT,
  debugError,
  mockFrom,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    user: { id: "u1", email: "t@t.co" },
    session: { user: { id: "u1" } },
    isLoading: false,
  },
  CALENDAR_ROWS: [{ id: "cal-1" }, { id: "cal-2" }],
  EVENTS_ROWS: [
    {
      id: "evt-1",
      title: "RDV client",
      start_time: "2025-01-10T10:00:00.000Z",
      end_time: "2025-01-10T11:00:00.000Z",
      location: "Paris",
      description: "Premier contact",
      video_conference_url: "",
      all_day: false,
      etablissement_id: "eta-1",
      etablissements: { nom: "Clinique A" },
      calendar: { name: "Pro", color: "#f00" },
    },
    {
      id: "evt-2",
      title: "Présentation produit",
      start_time: "2025-01-10T10:30:00.000Z",
      end_time: "2025-01-10T11:30:00.000Z",
      location: "",
      description: "",
      video_conference_url: "visio-room",
      all_day: false,
      etablissement_id: "eta-2",
      etablissements: { nom: "Cabinet B" },
      calendar: { name: "Equipe", color: "#0f0" },
    },
    {
      id: "evt-3",
      title: "Proposition commerciale",
      start_time: "2025-01-11T09:00:00.000Z",
      end_time: "2025-01-11T10:00:00.000Z",
      location: "Lyon",
      description: "Offre finale",
      video_conference_url: null,
      all_day: false,
      etablissement_id: null,
      etablissements: null,
      calendar: { name: "Pro", color: "#f00" },
    },
    {
      id: "evt-4",
      title: "Proposition commerciale",
      start_time: "2025-01-11T09:00:00.000Z",
      end_time: "2025-01-11T10:00:00.000Z",
      location: "Lyon",
      description: "Doublon",
      video_conference_url: null,
      all_day: false,
      etablissement_id: null,
      etablissements: null,
      calendar: { name: "Pro", color: "#f00" },
    },
    {
      id: "evt-5",
      title: "Tâche libre",
      start_time: "2025-01-12T00:00:00.000Z",
      end_time: "2025-01-12T23:59:00.000Z",
      location: null,
      description: null,
      video_conference_url: null,
      all_day: true,
      etablissement_id: null,
      etablissements: null,
      calendar: { name: "Perso", color: "#00f" },
    },
  ],
  EMPTY_ROWS: [],
  COUNT_RESULT: 7,
  debugError: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/lib/debug", () => ({
  debug: {
    error: debugError,
    log: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}));

type BuilderResult = {
  data?: unknown;
  error?: unknown;
  count?: number | null;
};

function createThenableBuilder(result: BuilderResult) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (
      onFulfilled?: (value: BuilderResult) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(onFulfilled, onRejected),
    catch: (onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).catch(onRejected),
    finally: (onFinally?: (() => void) | undefined) =>
      Promise.resolve(result).finally(onFinally),
  };
  return builder;
}

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

describe("useUpcomingAppointments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.setSystemTime(new Date("2025-01-10T08:00:00.000Z"));
  });

  it("passe de isLoading à succès et mappe, déduplique et détecte les conflits", async () => {
    const calendarsBuilder = createThenableBuilder({ data: CALENDAR_ROWS, error: null });
    const eventsBuilder = createThenableBuilder({ data: EVENTS_ROWS, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "calendars") return calendarsBuilder;
      if (table === "calendar_events") return eventsBuilder;
      return createThenableBuilder({ data: EMPTY_ROWS, error: null });
    });

    const { result } = renderHook(() => useUpcomingAppointments(5), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFrom).toHaveBeenNthCalledWith(1, "calendars");
    expect(mockFrom).toHaveBeenNthCalledWith(2, "calendar_events");
    expect(calendarsBuilder.select).toHaveBeenCalledWith("id");
    expect(calendarsBuilder.eq).toHaveBeenCalledWith("owner_id", "u1");
    expect(eventsBuilder.in).toHaveBeenCalledWith("calendar_id", ["cal-1", "cal-2"]);
    expect(eventsBuilder.gte).toHaveBeenCalledWith("start_time", "2025-01-10T08:00:00.000Z");
    expect(eventsBuilder.eq).toHaveBeenCalledWith("status", "confirmed");
    expect(eventsBuilder.order).toHaveBeenCalledWith("start_time", { ascending: true });
    expect(eventsBuilder.limit).toHaveBeenCalledWith(5);

    const appointments = result.current.data;
    expect(appointments).toHaveLength(4);

    if (!appointments) {
      throw new Error("Appointments should be defined");
    }

    expect(appointments[0]).toMatchObject({
      id: "evt-1",
      title: "RDV client",
      type: "rdv",
      location: "Paris",
      description: "Premier contact",
      etablissement_id: "eta-1",
      etablissement_nom: "Clinique A",
      calendar_name: "Pro",
      calendar_color: "#f00",
      all_day: false,
      hasConflict: true,
    });
    const localTime0 = new Date('2025-01-10T10:00:00.000Z').toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    expect(appointments[0].formattedDate).toContain("Aujourd'hui");
    expect(appointments[0].formattedDate).toContain(localTime0);
    expect(appointments[0].video_conference_url).toBeUndefined();

    expect(appointments[1]).toMatchObject({
      id: "evt-2",
      title: "Présentation produit",
      type: "presentation",
      video_conference_url: "visio-room",
      etablissement_nom: "Cabinet B",
      calendar_name: "Equipe",
      calendar_color: "#0f0",
      hasConflict: true,
    });
    expect(appointments[1].location).toBeUndefined();
    expect(appointments[1].description).toBeUndefined();

    expect(appointments[2]).toMatchObject({
      id: "evt-3",
      title: "Proposition commerciale",
      type: "negociation",
      location: "Lyon",
      hasConflict: false,
    });
    const localTime2 = new Date('2025-01-11T09:00:00.000Z').toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    expect(appointments[2].formattedDate).toContain("Demain");
    expect(appointments[2].formattedDate).toContain(localTime2);

    expect(appointments[3]).toMatchObject({
      id: "evt-5",
      title: "Tâche libre",
      type: "autre",
      all_day: true,
      hasConflict: false,
    });

    expect(appointments.map((item) => item.id)).toEqual(["evt-1", "evt-2", "evt-3", "evt-5"]);
  });

  it("retourne un tableau vide et logge quand la récupération des événements échoue", async () => {
    const calendarsBuilder = createThenableBuilder({ data: CALENDAR_ROWS, error: null });
    const eventsBuilder = createThenableBuilder({ data: null, error: { message: "x" } });

    mockFrom.mockImplementation((table: string) => {
      if (table === "calendars") return calendarsBuilder;
      if (table === "calendar_events") return eventsBuilder;
      return createThenableBuilder({ data: EMPTY_ROWS, error: null });
    });

    const { result } = renderHook(() => useUpcomingAppointments(3), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.isError).toBe(false);
    expect(result.current.data).toEqual([]);
    expect(debugError).toHaveBeenCalledWith("Error fetching appointments:", { message: "x" });
  });

  it("retourne un tableau vide quand aucun calendrier n'est trouvé", async () => {
    const calendarsBuilder = createThenableBuilder({ data: EMPTY_ROWS, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "calendars") return calendarsBuilder;
      return createThenableBuilder({ data: EMPTY_ROWS, error: null });
    });

    const { result } = renderHook(() => useUpcomingAppointments(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith("calendars");
    expect(result.current.data).toEqual([]);
  });
});

describe("useWeeklyAppointmentsCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.setSystemTime(new Date("2025-01-10T08:00:00.000Z"));
  });

  it("charge puis retourne le nombre exact de rendez-vous de la semaine", async () => {
    const calendarsBuilder = createThenableBuilder({ data: CALENDAR_ROWS, error: null });
    const countBuilder = createThenableBuilder({ count: COUNT_RESULT, error: null, data: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "calendars") return calendarsBuilder;
      if (table === "calendar_events") return countBuilder;
      return createThenableBuilder({ data: EMPTY_ROWS, error: null });
    });

    const { result } = renderHook(() => useWeeklyAppointmentsCount(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBe(7);
    expect(calendarsBuilder.eq).toHaveBeenCalledWith("owner_id", "u1");
    expect(countBuilder.select).toHaveBeenCalledWith("id", { count: "exact", head: true });
    expect(countBuilder.in).toHaveBeenCalledWith("calendar_id", ["cal-1", "cal-2"]);
    expect(countBuilder.gte).toHaveBeenCalledWith("start_time", "2025-01-10T08:00:00.000Z");
    expect(countBuilder.eq).toHaveBeenCalledWith("status", "confirmed");
  });

  it("retourne 0 et logge en cas d'erreur de comptage", async () => {
    const calendarsBuilder = createThenableBuilder({ data: CALENDAR_ROWS, error: null });
    const countBuilder = createThenableBuilder({ count: null, error: { message: "x" }, data: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "calendars") return calendarsBuilder;
      if (table === "calendar_events") return countBuilder;
      return createThenableBuilder({ data: EMPTY_ROWS, error: null });
    });

    const { result } = renderHook(() => useWeeklyAppointmentsCount(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBe(0);
    expect(debugError).toHaveBeenCalledWith("Error counting appointments:", { message: "x" });
  });

  it("retourne 0 quand aucun calendrier n'est trouvé", async () => {
    const calendarsBuilder = createThenableBuilder({ data: EMPTY_ROWS, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "calendars") return calendarsBuilder;
      return createThenableBuilder({ data: EMPTY_ROWS, error: null });
    });

    const { result } = renderHook(() => useWeeklyAppointmentsCount(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBe(0);
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });
});