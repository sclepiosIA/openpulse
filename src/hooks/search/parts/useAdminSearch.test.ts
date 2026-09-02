import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAdminSearch } from "./useAdminSearch";

const {
  AVOIRS,
  EMAIL_TEMPLATES,
  EMAIL_SEQUENCES,
  BOOKINGS,
  BOOKING_PAGES,
  CONTRAT_TEMPLATES,
  CSM_PLAYBOOKS,
  AI_AGENTS,
  CLIENT_SEGMENTS,
  CALENDARS,
  ERROR_TABLES,
  mockFrom,
} = vi.hoisted(() => {
  const AVOIRS = [
    { id: "a1", numero: "N1", client_nom: "C1", statut: "paid" },
  ];
  const EMAIL_TEMPLATES = [
    { id: "et1", name: "Welcome", subject: "Hello" },
  ];
  const EMAIL_SEQUENCES = [
    { id: "es1", nom: "Seq 1", description: "Description Seq", statut: "active" },
  ];
  const BOOKINGS = [
    { id: "b1", guest_name: "John Doe", guest_email: "j@example.com", guest_company: "Acme", status: "confirmed", start_time: "2023-01-01T12:00:00Z" },
  ];
  const BOOKING_PAGES = [
    { id: "bp1", title: "Page 1", description: "Desc", slug: "page-1" },
  ];
  const CONTRAT_TEMPLATES = [
    { id: "ct1", nom: "Contrat 1", description: "Contrat desc" },
  ];
  const CSM_PLAYBOOKS = [
    { id: "pb1", name: "Playbook 1", description: "Playbook desc" },
  ];
  const AI_AGENTS = [
    { id: "ag1", name: "Agent 1", description: "Agent desc" },
  ];
  const CLIENT_SEGMENTS = [
    { id: "cs1", nom: "Segment 1", description: "Segment desc" },
  ];
  const CALENDARS = [
    { id: "cal1", name: "Calendar 1", description: "Cal desc" },
  ];

  const ERROR_TABLES = new Set<string>();

  function createBuilder(tableName: string) {
    let _single = false;
    const map: Record<string, any[]> = {
      avoirs: AVOIRS,
      email_templates: EMAIL_TEMPLATES,
      email_sequences: EMAIL_SEQUENCES,
      bookings: BOOKINGS,
      booking_pages: BOOKING_PAGES,
      contrat_templates: CONTRAT_TEMPLATES,
      csm_playbooks: CSM_PLAYBOOKS,
      ai_agents_config: AI_AGENTS,
      client_segments: CLIENT_SEGMENTS,
      calendars: CALENDARS,
    };
    const resp = () => {
      if (ERROR_TABLES.has(tableName)) {
        return { data: null, error: { message: "boom" } };
      }
      const data = map[tableName] ?? [];
      return { data, error: null };
    };
    const builder: any = {
      select() { return builder; },
      or() { return builder; },
      order() { return builder; },
      limit() { return builder; },
      eq() { return builder; },
      gte() { return builder; },
      lte() { return builder; },
      "in"() { return builder; },
      insert() { return builder; },
      update() { return builder; },
      delete() { return builder; },
      single() { _single = true; return builder; },
      maybeSingle() { _single = true; return builder; },
      then(onFulfilled: any, onRejected: any) {
        const r = resp();
        if (_single) {
          const singleData = Array.isArray(r.data) ? (r.data.length ? r.data[0] : null) : r.data;
          return Promise.resolve({ data: singleData, error: r.error }).then(onFulfilled, onRejected);
        }
        return Promise.resolve(r).then(onFulfilled, onRejected);
      },
      catch(onRejected: any) {
        return builder.then(undefined, onRejected);
      },
    };
    return builder;
  }

  const mockFrom = vi.fn((table: string) => createBuilder(table));

  return {
    AVOIRS,
    EMAIL_TEMPLATES,
    EMAIL_SEQUENCES,
    BOOKINGS,
    BOOKING_PAGES,
    CONTRAT_TEMPLATES,
    CSM_PLAYBOOKS,
    AI_AGENTS,
    CLIENT_SEGMENTS,
    CALENDARS,
    ERROR_TABLES,
    mockFrom,
  };
});

vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      from: (table: string) => mockFrom(table),
    },
  };
});

vi.mock("@/lib/sanitize", () => {
  return {
    sanitizePostgrestValue: (s: string) => String(s),
    buildIlikeOrFilter: (fields: string[], s: string) => fields.map((f) => `${f}.ilike.%${s}%`).join(","),
  };
});

vi.mock("date-fns", () => {
  return {
    format: vi.fn(() => "FORMATTED"),
    fr: {},
  };
});

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function createWrapper() {
  const client = createQueryClient();
  return ({ children }: { children: React.ReactNode }) => React.createElement(QueryClientProvider, { client }, children);
}

describe("useAdminSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // ensure no error tables by default
    ERROR_TABLES.clear();
  });

  it("loads and maps results when shouldSearch is true", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAdminSearch("foo", true, { canViewCalendar: true }), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const slice = result.current.slice;

    expect(slice.avoirs).toHaveLength(1);
    expect(slice.avoirs[0]).toEqual({
      id: "a1",
      type: "avoir",
      title: "Avoir N1",
      subtitle: "C1",
      badge: "paid",
      href: "/facturation?avoir=a1",
    });

    expect(slice.emailTemplates).toHaveLength(1);
    expect(slice.emailTemplates[0]).toEqual({
      id: "et1",
      type: "email_template",
      title: "Welcome",
      subtitle: "Hello",
      href: "/parametres?tab=email-templates&id=et1",
    });

    expect(slice.emailSequences).toHaveLength(1);
    expect(slice.emailSequences[0]).toMatchObject({
      id: "es1",
      type: "email_sequence",
      title: "Seq 1",
      badge: "active",
      href: "/emails?sequence=es1",
    });

    expect(slice.bookings).toHaveLength(1);
    expect(slice.bookings[0]).toMatchObject({
      id: "b1",
      type: "booking",
      title: "John Doe",
      badge: "confirmed",
      href: "/booking?id=b1",
    });
    // booking subtitle is produced by mocked date-fns.format
    expect(slice.bookings[0].subtitle).toBe("FORMATTED");

    expect(slice.bookingPages).toHaveLength(1);
    expect(slice.bookingPages[0]).toEqual({
      id: "bp1",
      type: "booking_page",
      title: "Page 1",
      subtitle: "/page-1",
      href: "/booking/pages/bp1",
    });

    expect(slice.contratTemplates).toHaveLength(1);
    expect(slice.contratTemplates[0]).toMatchObject({
      id: "ct1",
      type: "contrat_template",
      title: "Contrat 1",
      href: "/contrats/templates/ct1",
    });

    expect(slice.csmPlaybooks).toHaveLength(1);
    expect(slice.csmPlaybooks[0]).toMatchObject({
      id: "pb1",
      type: "csm_playbook",
      title: "Playbook 1",
      href: "/csm?playbook=pb1",
    });

    expect(slice.aiAgents).toHaveLength(1);
    expect(slice.aiAgents[0]).toMatchObject({
      id: "ag1",
      type: "ai_agent",
      title: "Agent 1",
      href: "/parametres?tab=jarvis-agents&id=ag1",
    });

    expect(slice.clientSegments).toHaveLength(1);
    expect(slice.clientSegments[0]).toMatchObject({
      id: "cs1",
      type: "client_segment",
      title: "Segment 1",
      href: "/segments?id=cs1",
    });

    expect(slice.calendars).toHaveLength(1);
    expect(slice.calendars[0]).toMatchObject({
      id: "cal1",
      type: "calendar",
      title: "Calendar 1",
      href: "/calendrier?calendar=cal1",
    });

    // ensure supabase.from was called for a known table
    expect(mockFrom).toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalledWith("avoirs");
  });

  it("does not run queries when shouldSearch is false", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAdminSearch("foo", false), { wrapper });

    // when disabled, isLoading should be false and slices empty arrays
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const slice = result.current.slice;
    expect(slice.avoirs).toHaveLength(0);
    expect(slice.emailTemplates).toHaveLength(0);
    expect(slice.emailSequences).toHaveLength(0);
    expect(slice.bookings).toHaveLength(0);
    expect(slice.bookingPages).toHaveLength(0);
    expect(slice.contratTemplates).toHaveLength(0);
    expect(slice.csmPlaybooks).toHaveLength(0);
    expect(slice.aiAgents).toHaveLength(0);
    expect(slice.clientSegments).toHaveLength(0);
    expect(slice.calendars).toHaveLength(0);
  });

  it("handles supabase returning an error for a specific table and does not populate that slice", async () => {
    // simulate error on csm_playbooks
    ERROR_TABLES.add("csm_playbooks");
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAdminSearch("foo", true), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const slice = result.current.slice;

    // csmPlaybooks should be empty due to error
    expect(slice.csmPlaybooks).toHaveLength(0);

    // other slices still populated
    expect(slice.avoirs).toHaveLength(1);
    expect(slice.emailTemplates).toHaveLength(1);

    // cleanup
    ERROR_TABLES.clear();
  });
});