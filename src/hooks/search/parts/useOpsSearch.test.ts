/* @vitest-environment jsdom */

import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useOpsSearch } from "./useOpsSearch";

const {
  TODOS_ROWS,
  RD_US_ROWS,
  RD_PROJ_ROWS,
  SUPPORT_ROWS,
  PARTNER_ROWS,
  mockFrom,
  mockSanitizePostgrestValue,
  mockBuildIlikeOrFilter,
} = vi.hoisted(() => ({
  TODOS_ROWS: [
    {
      id: "todo-1",
      title: "Relancer dossier",
      description: "Appeler le partenaire",
      is_done: true,
      due_date: "2024-05-12T00:00:00.000Z",
    },
  ],
  RD_US_ROWS: [
    {
      id: "us-1",
      titre: "Story recherche",
      description: "Améliorer le moteur",
      statut: "En cours",
      points: 8,
      sprint: { nom: "Sprint 12" },
    },
  ],
  RD_PROJ_ROWS: [
    {
      id: "proj-1",
      nom: "Plateforme Ops",
      description: "Projet de modernisation des outils internes et optimisation des flux",
      statut: "Actif",
    },
  ],
  SUPPORT_ROWS: [
    {
      id: "ticket-1",
      titre: "Erreur connexion",
      description: "Impossible de se connecter",
      statut: "Ouvert",
      priorite: "urgente",
      numero_ticket: "42",
    },
  ],
  PARTNER_ROWS: [
    {
      id: "partner-1",
      nom: "Clinique du Centre",
      type_partenaire: "Hôpital",
      ville: "Lyon",
    },
  ],
  mockFrom: vi.fn(),
  mockSanitizePostgrestValue: vi.fn((value: string) => value.trim()),
  mockBuildIlikeOrFilter: vi.fn((fields: string[], value: string) =>
    fields.map((field) => `${field}.ilike.%${value}%`).join(","),
  ),
}));

vi.mock("@/lib/sanitize", () => ({
  sanitizePostgrestValue: mockSanitizePostgrestValue,
  buildIlikeOrFilter: mockBuildIlikeOrFilter,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}));

type QueryResult = {
  data: unknown[] | null;
  error: { message: string } | null;
};

type Builder = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  neq: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  or: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  then: PromiseLike<QueryResult>["then"];
  catch: Promise<QueryResult>["catch"];
};

function createThenableBuilder(result: QueryResult): Builder {
  const builder = {} as Builder;

  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.neq = vi.fn(() => builder);
  builder.gte = vi.fn(() => builder);
  builder.lte = vi.fn(() => builder);
  builder.in = vi.fn(() => builder);
  builder.or = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.limit = vi.fn(() => builder);
  builder.insert = vi.fn(() => builder);
  builder.update = vi.fn(() => builder);
  builder.delete = vi.fn(() => builder);
  builder.single = vi.fn(() => Promise.resolve(result));
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  builder.then = (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected);
  builder.catch = (onRejected) => Promise.resolve(result).catch(onRejected);

  return builder;
}

function setupFromSuccess() {
  mockFrom.mockImplementation((table: string) => {
    switch (table) {
      case "personal_todos":
        return createThenableBuilder({ data: TODOS_ROWS, error: null });
      case "rd_user_stories":
        return createThenableBuilder({ data: RD_US_ROWS, error: null });
      case "rd_projets":
        return createThenableBuilder({ data: RD_PROJ_ROWS, error: null });
      case "support_tickets":
        return createThenableBuilder({ data: SUPPORT_ROWS, error: null });
      case "partenaires":
        return createThenableBuilder({ data: PARTNER_ROWS, error: null });
      default:
        return createThenableBuilder({ data: [], error: null });
    }
  });
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

describe("useOpsSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("expose isLoading puis mappe correctement les résultats métier de toutes les slices", async () => {
    setupFromSuccess();

    const { result } = renderHook(
      () =>
        useOpsSearch("  ops  ", true, {
          canViewRD: true,
          canViewAllTickets: true,
          canViewAllEtablissements: true,
        }),
      { wrapper: createWrapper() },
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockSanitizePostgrestValue).toHaveBeenCalledWith("  ops  ");
    expect(mockBuildIlikeOrFilter).toHaveBeenCalledWith(["title", "description"], "ops");
    expect(mockBuildIlikeOrFilter).toHaveBeenCalledWith(["titre", "description"], "ops");
    expect(mockBuildIlikeOrFilter).toHaveBeenCalledWith(["nom", "description"], "ops");
    expect(mockBuildIlikeOrFilter).toHaveBeenCalledWith(["titre", "description", "numero_ticket"], "ops");

    expect(mockFrom).toHaveBeenCalledWith("personal_todos");
    expect(mockFrom).toHaveBeenCalledWith("rd_user_stories");
    expect(mockFrom).toHaveBeenCalledWith("rd_projets");
    expect(mockFrom).toHaveBeenCalledWith("support_tickets");
    expect(mockFrom).toHaveBeenCalledWith("partenaires");

    expect(result.current.slice.todos).toEqual([
      {
        id: "todo-1",
        type: "todo",
        title: "Relancer dossier",
        subtitle: "12 mai 2024",
        badge: "Terminé",
        href: "/todos?id=todo-1",
      },
    ]);

    expect(result.current.slice.rdUserStories).toEqual([
      {
        id: "us-1",
        type: "rd_user_story",
        title: "Story recherche",
        subtitle: "Sprint 12",
        badge: "8 pts",
        href: "/rd?story=us-1",
      },
    ]);

    expect(result.current.slice.rdProjets).toEqual([
      {
        id: "proj-1",
        type: "rd_projet",
        title: "Plateforme Ops",
        subtitle: "Projet de modernisation des outils internes et opt",
        badge: "Actif",
        href: "/rd?projet=proj-1",
      },
    ]);

    expect(result.current.slice.supportTickets).toEqual([
      {
        id: "ticket-1",
        type: "support_ticket",
        title: "#42: Erreur connexion",
        subtitle: "Ouvert",
        badge: "Urgent",
        href: "/support?ticket=ticket-1",
      },
    ]);

    expect(result.current.slice.partenaires).toEqual([
      {
        id: "partner-1",
        type: "partenaire",
        title: "Clinique du Centre",
        subtitle: "Lyon",
        badge: "Hôpital",
        href: "/partenaires/partner-1",
      },
    ]);
  });

  it("respecte les permissions en n'exécutant pas les slices interdites", async () => {
    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case "personal_todos":
          return createThenableBuilder({ data: TODOS_ROWS, error: null });
        default:
          return createThenableBuilder({ data: [], error: null });
      }
    });

    const { result } = renderHook(
      () =>
        useOpsSearch("ops", true, {
          canViewRD: false,
          canViewAllTickets: false,
          canViewAllEtablissements: false,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith("personal_todos");

    expect(result.current.slice.todos).toHaveLength(1);
    expect(result.current.slice.rdUserStories).toEqual([]);
    expect(result.current.slice.rdProjets).toEqual([]);
    expect(result.current.slice.supportTickets).toEqual([]);
    expect(result.current.slice.partenaires).toEqual([]);
  });

  it("retourne des slices vides et ne lance aucune requête si shouldSearch vaut false", () => {
    const { result } = renderHook(
      () =>
        useOpsSearch("ops", false, {
          canViewRD: true,
          canViewAllTickets: true,
          canViewAllEtablissements: true,
        }),
      { wrapper: createWrapper() },
    );

    expect(mockFrom).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.slice).toEqual({
      todos: [],
      rdUserStories: [],
      rdProjets: [],
      supportTickets: [],
      partenaires: [],
    });
  });

  it("passe en erreur quand une requête supabase renvoie une erreur", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "personal_todos") {
        return createThenableBuilder({
          data: null,
          error: { message: "x" },
        });
      }
      return createThenableBuilder({ data: [], error: null });
    });

    const { result } = renderHook(() => useOpsSearch("ops", true), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.slice.todos).toEqual([]);
    expect(result.current.slice.rdUserStories).toEqual([]);
    expect(result.current.slice.rdProjets).toEqual([]);
    expect(result.current.slice.supportTickets).toEqual([]);
    expect(result.current.slice.partenaires).toEqual([]);
  });
});