/* @vitest-environment jsdom */

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useTresorerieKPIs } from "./useTresorerieKPIs";

const {
  AGGREGATES_OK,
  PREVISIONS,
  ETABS,
  AUTH_STATE,
  mockRpc,
  mockFrom,
  mockPrevRefetch,
  mockToastSuccess,
  mockToastError,
  mockNavigate,
} = vi.hoisted(() => ({
  AGGREGATES_OK: {
    depensesReelles6m: 6000,
    depensesProjetees6m: 12000,
    facturesEnAttenteCount: 3,
    facturesEnAttenteMontant: 4500,
    caParExercice: [
      { annee: 2023, caComptable: 100000, caPercu: 90000 },
      { annee: 2024, caComptable: 120000, caPercu: 110000 },
    ],
  },
  PREVISIONS: [
    { mois: "2026-01", moisLabel: "janv. 2026", depensesSalaires: 1000, soldePrevu: 10000, fluxTresorerie: 2000 },
    { mois: "2026-02", moisLabel: "févr. 2026", depensesSalaires: 1100, soldePrevu: 8000, fluxTresorerie: -500 },
    { mois: "2026-03", moisLabel: "mars 2026", depensesSalaires: 1200, soldePrevu: 5000, fluxTresorerie: -1000 },
    { mois: "2026-04", moisLabel: "avr. 2026", depensesSalaires: 1300, soldePrevu: 2000, fluxTresorerie: -1500 },
    { mois: "2026-05", moisLabel: "mai 2026", depensesSalaires: 1400, soldePrevu: -500, fluxTresorerie: -1000 },
    { mois: "2026-06", moisLabel: "juin 2026", depensesSalaires: 1500, soldePrevu: -1000, fluxTresorerie: -500 },
    { mois: "2026-12", moisLabel: "déc. 2026", depensesSalaires: 1600, soldePrevu: 7000, fluxTresorerie: 1000 },
  ],
  ETABS: [
    { probabilite: 1.0, revenuMensuelEstime: 1000 },
    { probabilite: 0.9, revenuMensuelEstime: 2000 },
    { probabilite: 0.7, revenuMensuelEstime: 3000 },
    { probabilite: 0.4, revenuMensuelEstime: 4000 },
    { probabilite: 0.2, revenuMensuelEstime: 5000 },
  ],
  AUTH_STATE: {
    user: { id: "u1", email: "t@t.co" },
    session: { user: { id: "u1" } },
    isLoading: false,
  },
  mockRpc: vi.fn(),
  mockFrom: vi.fn(),
  mockPrevRefetch: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockNavigate: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => {
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
    upsert: vi.fn(() => builder),
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: (onFulfilled: (value: { data: null; error: null }) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve().catch(onRejected),
  };

  mockFrom.mockImplementation(() => builder);

  return {
    supabase: {
      from: mockFrom,
      rpc: mockRpc,
    },
  };
});

vi.mock("@/hooks/tresorerie/useTresoreriePrevisionnel", () => ({
  useTresoreriePrevisionnel: vi.fn(() => ({
    previsions: PREVISIONS,
    etablissementsPrevisions: ETABS,
    isLoading: false,
    refetch: mockPrevRefetch,
  })),
}));

vi.mock("@/lib/queryPresets", () => ({
  queryPresets: {
    standard: {},
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => AUTH_STATE,
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

describe("useTresorerieKPIs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("expose un état de chargement puis calcule correctement les KPIs métier", async () => {
    mockRpc.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ data: AGGREGATES_OK, error: null }), 0);
        }),
    );

    const { result } = renderHook(() => useTresorerieKPIs(), {
      wrapper: createWrapper(),
    });

    // initial loading state while query is in flight
    expect(result.current.isLoading).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith("get_tresorerie_kpis_aggregates");

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.cashburnMoyen6MoisPasses).toBe(1000);
    expect(result.current.cashburnMoyenProjete6Mois).toBe(2000);
    expect(result.current.cashburnSalairesUniquement).toBe(1250);

    expect(result.current.facturesEnAttente).toEqual({
      count: 3,
      montant: 4500,
    });

    expect(result.current.caParExercice).toEqual([
      { annee: 2023, caComptable: 100000, caPercu: 90000 },
      { annee: 2024, caComptable: 120000, caPercu: 110000 },
    ]);

    expect(result.current.fondsPropreActuels).toBe(8000);
    expect(result.current.projectionFinAnnee).toBe(7000);
    expect(result.current.prochainTrouTresorerie).toEqual({
      mois: "mai 2026",
      solde: -500,
    });

    expect(result.current.pipelineNiveaux).toEqual([
      {
        label: "Production",
        count: 1,
        montantMensuel: 1000,
        montantAnnuel: 12000,
        probabilite: 1.0,
      },
      {
        label: "Contractuel",
        count: 1,
        montantMensuel: 2000,
        montantAnnuel: 24000,
        probabilite: 0.8,
      },
      {
        label: "Négociation",
        count: 1,
        montantMensuel: 3000,
        montantAnnuel: 36000,
        probabilite: 0.55,
      },
      {
        label: "Étude émise",
        count: 1,
        montantMensuel: 4000,
        montantAnnuel: 48000,
        probabilite: 0.3,
      },
      {
        label: "Prospection",
        count: 1,
        montantMensuel: 5000,
        montantAnnuel: 60000,
        probabilite: 0.01,
      },
    ]);
  });

  it("retourne des valeurs par défaut quand la RPC agrégée renvoie une erreur (isLoading false)", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "x" },
    });

    const { result } = renderHook(() => useTresorerieKPIs(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Lorsque la RPC échoue le hook doit rester fonctionnel et calculer des valeurs par défaut
    expect(result.current.cashburnMoyen6MoisPasses).toBe(0);
    expect(result.current.cashburnMoyenProjete6Mois).toBe(0);

    // Les agrégats manquants produisent un tableau vide pour le CA par exercice
    expect(result.current.caParExercice).toEqual([]);

    // Factures en attente doivent être à zéro en l'absence d'agrégats
    expect(result.current.facturesEnAttente).toEqual({ count: 0, montant: 0 });

    // Les prévisions locales restent utilisables (projection venant de PREVISIONS)
    expect(result.current.projectionFinAnnee).toBe(7000);

    expect(mockRpc).toHaveBeenCalledWith("get_tresorerie_kpis_aggregates");
  });

  it("refetch déclenche le refetch du prévisionnel et de la query d'agrégats", async () => {
    mockRpc.mockResolvedValue({
      data: AGGREGATES_OK,
      error: null,
    });

    const { result } = renderHook(() => useTresorerieKPIs(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockPrevRefetch).not.toHaveBeenCalled();
    expect(mockRpc).toHaveBeenCalledTimes(1);

    await act(async () => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(mockPrevRefetch).toHaveBeenCalledTimes(1);
      expect(mockRpc).toHaveBeenCalledTimes(2);
    });

    expect(mockRpc).toHaveBeenLastCalledWith("get_tresorerie_kpis_aggregates");
  });
});