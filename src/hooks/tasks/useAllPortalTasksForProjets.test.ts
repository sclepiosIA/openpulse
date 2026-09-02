/* @vitest-environment jsdom */
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { useAllPortalTasksForProjets } from "./useAllPortalTasksForProjets";

const { PORTAL_ROWS, AUTH_STATE, mockFrom, mockToastSuccess, mockToastError, mockNavigate } = vi.hoisted(() => ({
  PORTAL_ROWS: [
    {
      id: "pt-1",
      titre: "Configurer accès",
      description: "Créer les accès initiaux",
      statut: "todo",
      phase: "deploiement" as const,
      due_date: "2025-02-10",
      etablissement_id: "etab-1",
      created_at: "2025-01-05T10:00:00.000Z",
      updated_at: "2025-01-06T11:00:00.000Z",
      etablissements: { id: "etab-1", nom: "Clinique du Lac" },
    },
    {
      id: "pt-2",
      titre: "Importer données",
      description: null,
      statut: "in_progress",
      phase: "production" as const,
      due_date: null,
      etablissement_id: null,
      created_at: "2025-01-04T09:00:00.000Z",
      updated_at: "2025-01-07T12:00:00.000Z",
      etablissements: null,
    },
    {
      id: "pt-3",
      titre: "Vérification finale",
      description: "Contrôler les éléments livrés",
      statut: "unknown_status",
      phase: null,
      due_date: "2025-03-01",
      etablissement_id: "etab-2",
      created_at: "2025-01-03T08:00:00.000Z",
      updated_at: "2025-01-08T13:00:00.000Z",
      etablissements: { id: "etab-2", nom: "Centre Horizon" },
    },
  ],
  AUTH_STATE: {
    user: { id: "u1", email: "t@t.co" },
    session: { user: { id: "u1" } },
    isLoading: false,
  },
  mockFrom: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockNavigate: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => AUTH_STATE,
}));

type BuilderResult = {
  data: unknown;
  error: unknown;
};

function createThenableBuilder(result: BuilderResult) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (
      onFulfilled?: (value: BuilderResult) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve(result).then(onFulfilled, onRejected),
    catch: (onRejected?: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
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

  return function Wrapper(props: { children?: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children);
  };
}

describe("useAllPortalTasksForProjets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("charge puis mappe correctement les tâches portail au format métier attendu", async () => {
    const builder = createThenableBuilder({
      data: PORTAL_ROWS,
      error: null,
    });
    mockFrom.mockReturnValue(builder);

    const { result } = renderHook(() => useAllPortalTasksForProjets(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFrom).toHaveBeenCalledWith("client_portal_tasks");
    expect(builder.select).toHaveBeenCalledWith(
      "id, etablissement_id, titre, description, assignee, statut, phase, due_date, created_at, updated_at, etablissements(id, nom)"
    );
    expect(builder.eq).toHaveBeenCalledWith("assignee", "marque");
    expect(builder.neq).toHaveBeenCalledWith("statut", "done");
    expect(builder.order).toHaveBeenCalledWith("created_at", { ascending: false });

    expect(result.current.data).toEqual([
      {
        id: "portal-pt-1",
        __isPortal: true,
        __portalRawId: "pt-1",
        titre: "Configurer accès",
        description: "Créer les accès initiaux",
        statut: "A faire",
        priorite: "medium",
        echeance: "2025-02-10",
        date_debut: null,
        date_realisation: null,
        responsable_id: null,
        etablissement_id: "etab-1",
        categorie_id: null,
        archive: false,
        created_at: "2025-01-05T10:00:00.000Z",
        updated_at: "2025-01-06T11:00:00.000Z",
        ordre: 0,
        categories_taches: { id: "portal", nom: "Portail client", couleur: "#8b5cf6" },
        etablissements: { id: "etab-1", nom: "Clinique du Lac" },
        responsable_profile: null,
        __phase: "deploiement",
      },
      {
        id: "portal-pt-2",
        __isPortal: true,
        __portalRawId: "pt-2",
        titre: "Importer données",
        description: null,
        statut: "En cours",
        priorite: "medium",
        echeance: null,
        date_debut: null,
        date_realisation: null,
        responsable_id: null,
        etablissement_id: null,
        categorie_id: null,
        archive: false,
        created_at: "2025-01-04T09:00:00.000Z",
        updated_at: "2025-01-07T12:00:00.000Z",
        ordre: 0,
        categories_taches: { id: "portal", nom: "Portail client", couleur: "#8b5cf6" },
        etablissements: null,
        responsable_profile: null,
        __phase: "production",
      },
      {
        id: "portal-pt-3",
        __isPortal: true,
        __portalRawId: "pt-3",
        titre: "Vérification finale",
        description: "Contrôler les éléments livrés",
        statut: "A faire",
        priorite: "medium",
        echeance: "2025-03-01",
        date_debut: null,
        date_realisation: null,
        responsable_id: null,
        etablissement_id: "etab-2",
        categorie_id: null,
        archive: false,
        created_at: "2025-01-03T08:00:00.000Z",
        updated_at: "2025-01-08T13:00:00.000Z",
        ordre: 0,
        categories_taches: { id: "portal", nom: "Portail client", couleur: "#8b5cf6" },
        etablissements: { id: "etab-2", nom: "Centre Horizon" },
        responsable_profile: null,
        __phase: null,
      },
    ]);
  });

  it("retourne une liste vide si Supabase renvoie data null sans erreur", async () => {
    const builder = createThenableBuilder({
      data: null,
      error: null,
    });
    mockFrom.mockReturnValue(builder);

    const { result } = renderHook(() => useAllPortalTasksForProjets(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([]);
  });

  it("passe en erreur quand Supabase renvoie une erreur", async () => {
    const builder = createThenableBuilder({
      data: null,
      error: { message: "x" },
    });
    mockFrom.mockReturnValue(builder);

    const { result } = renderHook(() => useAllPortalTasksForProjets(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual({ message: "x" });
  });
});