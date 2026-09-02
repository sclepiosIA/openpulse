import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";

const hoisted = vi.hoisted(() => {
  const etablissementsRows = [{ id: "e1", nom: "Clinique Alpha", ville: "Lyon", statut: "Actif" }];

  const emailsRows = [
    {
      id: "m1",
      subject: "Sujet brut",
      ai_generated_title: "Titre IA",
      category: "Support",
      last_message_date: "2025-01-10T12:00:00.000Z",
      etablissement: { id: "e1", nom: "Clinique Alpha" },
    },
  ];

  const tachesRows = [
    {
      id: "t1",
      titre: "Faire le point",
      statut: "open",
      priorite: "high",
      etablissement_id: "e1",
      etablissement: { id: "e1", nom: "Clinique Alpha" },
    },
  ];

  const contactsRows = [
    {
      id: "c1",
      nom: "Martin",
      prenom: "Jean",
      email: "jean@example.test",
      fonction: "Directeur",
      etablissement_id: "e1",
    },
  ];

  const groupesRows = [{ id: "g1", nom: "Groupe Nord", type: "Région" }];

  const eventsRows = [
    {
      id: "ev1",
      title: "Réunion",
      description: "Point hebdo",
      location: "Salle 1",
      start_time: "2025-02-03T09:30:00.000Z",
      status: "confirmed",
      etablissement: { id: "e1", nom: "Clinique Alpha" },
    },
  ];

  const pulseMessagesRows = [
    {
      id: "pm1",
      content: "Un message Pulse très long qui doit être tronqué au-delà de soixante caractères pour le titre",
      created_at: "2025-03-01T08:00:00.000Z",
      conversation_id: "pc1",
      conversation: { name: "Ops" },
    },
  ];

  const pulseConversationsRows = [
    {
      id: "pc1",
      name: "Ops",
      description: "Description assez longue pour être tronquée au-delà de cinquante caractères sur l'UI",
      updated_at: "2025-03-02T10:00:00.000Z",
    },
  ];

  const profilesRows = [
    {
      id: "p1",
      nom: "Durand",
      prenom: "Alice",
      email: "alice@example.test",
      fonction: "Chef de projet",
      avatar_url: null,
    },
  ];

  const documentsRows = [
    {
      id: "d1",
      name: "Contrat.pdf",
      description: "Contrat de prestation",
      mime_type: "application/pdf",
      created_at: "2025-01-02T00:00:00.000Z",
    },
  ];

  const sanitizePostgrestValue = vi.fn((s: string) => s.replaceAll("%", "\\%"));
  const buildIlikeOrFilter = vi.fn((fields: string[], s: string) => fields.map((f) => `${f}.ilike.%${s}%`).join(","));

  type SupabaseTable =
    | "etablissements"
    | "email_threads"
    | "taches"
    | "contacts"
    | "groupes_etablissements"
    | "calendar_events"
    | "pulse_messages"
    | "pulse_conversations"
    | "profiles"
    | "documents";

  const tableDataByName: Record<SupabaseTable, unknown[]> = {
    etablissements: etablissementsRows,
    email_threads: emailsRows,
    taches: tachesRows,
    contacts: contactsRows,
    groupes_etablissements: groupesRows,
    calendar_events: eventsRows,
    pulse_messages: pulseMessagesRows,
    pulse_conversations: pulseConversationsRows,
    profiles: profilesRows,
    documents: documentsRows,
  };

  const tableErrorByName: Partial<Record<SupabaseTable, { message: string }>> = {};

  type Resp<T> = { data: T | null; error: { message: string } | null };

  const mockFrom = vi.fn((table: string) => {
    const tableName = table as SupabaseTable;

    const state: {
      table: SupabaseTable;
      data: unknown[] | null;
      error: { message: string } | null;
      limit?: number;
    } = {
      table: tableName,
      data: tableDataByName[tableName] ?? [],
      error: tableErrorByName[tableName] ?? null,
    };

    const resolve = async (): Promise<Resp<unknown[]>> => {
      if (state.error) return { data: null, error: state.error };
      const full = state.data ?? [];
      const limited = typeof state.limit === "number" ? full.slice(0, Math.max(0, state.limit)) : full;
      return { data: limited, error: null };
    };

    const builder: {
      select: ReturnType<typeof vi.fn>;
      eq: ReturnType<typeof vi.fn>;
      neq: ReturnType<typeof vi.fn>;
      gte: ReturnType<typeof vi.fn>;
      lte: ReturnType<typeof vi.fn>;
      in: ReturnType<typeof vi.fn>;
      or: ReturnType<typeof vi.fn>;
      ilike: ReturnType<typeof vi.fn>;
      is: ReturnType<typeof vi.fn>;
      order: ReturnType<typeof vi.fn>;
      limit: ReturnType<typeof vi.fn>;
      insert: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
      upsert: ReturnType<typeof vi.fn>;
      single: ReturnType<typeof vi.fn>;
      maybeSingle: ReturnType<typeof vi.fn>;
      then: (onFulfilled?: (v: Resp<unknown[]>) => unknown, onRejected?: (e: unknown) => unknown) => Promise<unknown>;
      catch: (onRejected?: (e: unknown) => unknown) => Promise<unknown>;
    } = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      neq: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      or: vi.fn(() => builder),
      ilike: vi.fn(() => builder),
      is: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn((n: number) => {
        state.limit = n;
        return builder;
      }),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      upsert: vi.fn(() => builder),
      single: vi.fn(async () => {
        const r = await resolve();
        const first = Array.isArray(r.data) ? (r.data[0] ?? null) : null;
        return { data: first, error: r.error };
      }),
      maybeSingle: vi.fn(async () => {
        const r = await resolve();
        const first = Array.isArray(r.data) ? (r.data[0] ?? null) : null;
        return { data: first, error: r.error };
      }),
      then: (onFulfilled?: (v: Resp<unknown[]>) => unknown, onRejected?: (e: unknown) => unknown) =>
        (resolve() as Promise<Resp<unknown[]>>).then(onFulfilled, onRejected),
      catch: (onRejected?: (e: unknown) => unknown) => (resolve() as Promise<Resp<unknown[]>>).catch(onRejected),
    };

    return builder;
  });

  return {
    etablissementsRows,
    emailsRows,
    tachesRows,
    contactsRows,
    groupesRows,
    eventsRows,
    pulseMessagesRows,
    pulseConversationsRows,
    profilesRows,
    documentsRows,
    sanitizePostgrestValue,
    buildIlikeOrFilter,
    mockFrom,
    tableErrorByName,
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: hoisted.mockFrom,
  },
}));

vi.mock("@/lib/sanitize", () => ({
  sanitizePostgrestValue: hoisted.sanitizePostgrestValue,
  buildIlikeOrFilter: hoisted.buildIlikeOrFilter,
}));

import { useCoreSearch } from "./useCoreSearch";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children);
  }

  return { Wrapper, queryClient };
}

describe("useCoreSearch", () => {
  it("passe de isLoading à succès et mappe les résultats métier", async () => {
    hoisted.mockFrom.mockClear();
    hoisted.sanitizePostgrestValue.mockClear();
    hoisted.buildIlikeOrFilter.mockClear();

    hoisted.tableErrorByName.contacts = undefined;

    const permissions = {
      canViewAllEtablissements: true,
      canViewAllEmails: true,
      canViewSharedEmails: false,
      canViewCalendar: true,
      viewScope: "all",
    } as const;

    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useCoreSearch("alp", true, permissions), { wrapper: Wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(hoisted.sanitizePostgrestValue).toHaveBeenCalledWith("alp");
    expect(hoisted.buildIlikeOrFilter).toHaveBeenCalledWith(["nom", "ville"], "alp");
    expect(hoisted.buildIlikeOrFilter).toHaveBeenCalledWith(["subject", "ai_summary"], "alp");

    expect(hoisted.mockFrom).toHaveBeenCalledWith("etablissements");
    expect(hoisted.mockFrom).toHaveBeenCalledWith("email_threads");
    expect(hoisted.mockFrom).toHaveBeenCalledWith("taches");
    expect(hoisted.mockFrom).toHaveBeenCalledWith("contacts");
    expect(hoisted.mockFrom).toHaveBeenCalledWith("groupes_etablissements");
    expect(hoisted.mockFrom).toHaveBeenCalledWith("calendar_events");
    expect(hoisted.mockFrom).toHaveBeenCalledWith("pulse_messages");
    expect(hoisted.mockFrom).toHaveBeenCalledWith("pulse_conversations");
    expect(hoisted.mockFrom).toHaveBeenCalledWith("profiles");
    expect(hoisted.mockFrom).toHaveBeenCalledWith("documents");

    const etab = result.current.slice.etablissements[0];
    expect(etab).toMatchObject({
      id: "e1",
      type: "etablissement",
      title: "Clinique Alpha",
      subtitle: "Lyon",
      badge: "Actif",
      href: "/etablissements/e1",
    });

    const email = result.current.slice.emails[0];
    expect(email).toMatchObject({
      id: "m1",
      type: "email",
      title: "Titre IA",
      subtitle: "Support",
      badge: "Support",
      href: "/emails?thread=m1",
      linkedEtablissement: { id: "e1", nom: "Clinique Alpha" },
    });

    const tache = result.current.slice.taches[0];
    expect(tache).toMatchObject({
      id: "t1",
      type: "tache",
      title: "Faire le point",
      subtitle: "open",
      badge: "Haute",
      href: "/etablissements/e1?tab=kanban",
      linkedEtablissement: { id: "e1", nom: "Clinique Alpha" },
    });

    const contact = result.current.slice.contacts[0];
    expect(contact.id).toBe("c1");
    expect(contact.type).toBe("contact");
    expect(contact.title).toBe("Jean Martin");
    expect(contact.subtitle).toBe("Directeur");
    expect(contact.href).toBe("/emails?compose=true&to=jean%40example.test&toName=Jean%20Martin");

    const groupe = result.current.slice.groupes[0];
    expect(groupe).toMatchObject({
      id: "g1",
      type: "groupe",
      title: "Groupe Nord",
      subtitle: "Région",
      href: "/groupes/g1",
    });

    const event = result.current.slice.events[0];
    expect(event).toMatchObject({
      id: "ev1",
      type: "event",
      title: "Réunion",
      badge: "Salle 1",
      href: "/calendrier?event=ev1",
      linkedEtablissement: { id: "e1", nom: "Clinique Alpha" },
    });
    expect(typeof event.subtitle).toBe("string");
    expect(event.subtitle).toContain("2025");

    const pulseMsg = result.current.slice.pulseMessages[0];
    expect(pulseMsg.id).toBe("pm1");
    expect(pulseMsg.type).toBe("pulse");
    expect(pulseMsg.title.endsWith("...")).toBe(true);
    expect(pulseMsg.title.length).toBe(63);
    expect(pulseMsg.subtitle).toBe("Ops");
    expect(pulseMsg.href).toBe("/pulse?conversation=pc1&message=pm1");

    const pulseConv = result.current.slice.pulseConversations[0];
    expect(pulseConv).toMatchObject({
      id: "pc1",
      type: "pulse_conversation",
      title: "Ops",
      href: "/pulse?conversation=pc1",
    });
    expect(typeof pulseConv.badge).toBe("string");
    expect(pulseConv.subtitle?.endsWith("...")).toBe(true);
    expect(pulseConv.subtitle?.length).toBe(53);

    const profile = result.current.slice.profiles[0];
    expect(profile).toMatchObject({
      id: "p1",
      type: "profile",
      title: "Alice Durand",
      subtitle: "Chef de projet",
      href: "/people?profile=p1",
    });

    const doc = result.current.slice.documents[0];
    expect(doc).toMatchObject({
      id: "d1",
      type: "document",
      title: "Contrat.pdf",
      subtitle: "Contrat de prestation",
      badge: "PDF",
      href: "/documents?doc=d1",
    });
  });

  it("met la query 'contacts' en erreur quand Supabase renvoie {data:null,error}", async () => {
    hoisted.tableErrorByName.contacts = { message: "x" };

    const permissions = {
      canViewAllEtablissements: false,
      canViewAllEmails: false,
      canViewSharedEmails: false,
      canViewCalendar: false,
      viewScope: "own",
    } as const;

    const { Wrapper, queryClient } = createWrapper();

    const { result } = renderHook(() => useCoreSearch("je", true, permissions), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await waitFor(() => {
      const state = queryClient.getQueryState(["global-search-contacts", "je"]);
      expect(state?.status).toBe("error");
      expect((state?.error as { message?: string } | null)?.message).toBe("x");
    });

    expect(hoisted.mockFrom).toHaveBeenCalledWith("contacts");
  });
});