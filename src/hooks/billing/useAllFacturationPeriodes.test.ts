import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { YEAR, ROWS_PERIODES, ROWS_GROUPES, mockFrom, makeBuilder } = vi.hoisted(() => {
  const YEAR = new Date().getFullYear();

  const ROWS_PERIODES = [
    {
      id: "p1",
      etablissement_id: "e1",
      date_debut: `${YEAR}-01-01`,
      date_fin: `${YEAR}-01-31`,
      montant_prevu: 100,
      montant_percu: 120,
      statut: "encaissee",
      date_facture: null,
      date_virement_estimee: null,
      type_periode: "mensuelle",
      notes: null,
      etablissement: { id: "e1", nom: "Alpha", client_facturation: null },
    },
    {
      id: "p2",
      etablissement_id: "e2",
      date_debut: `${YEAR}-02-01`,
      date_fin: `${YEAR}-02-28`,
      montant_prevu: 200,
      montant_percu: null,
      statut: "prevue",
      date_facture: null,
      date_virement_estimee: `${YEAR + 1}-06-15`,
      type_periode: "mensuelle",
      notes: null,
      etablissement: { id: "e2", nom: "Beta", client_facturation: "groupe" },
    },
    {
      id: "p3",
      etablissement_id: "e3",
      date_debut: `${YEAR}-02-01`,
      date_fin: `${YEAR}-02-28`,
      montant_prevu: 999,
      montant_percu: null,
      statut: "prevue",
      date_facture: null,
      date_virement_estimee: null,
      type_periode: "mensuelle",
      notes: null,
      etablissement: { id: "e3", nom: "Gamma", client_facturation: "groupe" },
    },
    {
      id: "p4",
      etablissement_id: "e1",
      date_debut: `${YEAR}-03-01`,
      date_fin: `${YEAR}-03-31`,
      montant_prevu: 50,
      montant_percu: null,
      statut: "en_retard",
      date_facture: null,
      date_virement_estimee: null,
      type_periode: "mensuelle",
      notes: null,
      etablissement: { id: "e1", nom: "Alpha", client_facturation: null },
    },
  ];

  const ROWS_GROUPES = [
    { etablissement_id: "e2", groupe_id: "g1" },
    { etablissement_id: "e3", groupe_id: "g1" },
  ];

  type Result = { data: unknown; error: { message: string } | null };

  const makeBuilder = (result: Result) => {
    const builder: Record<string, unknown> = {};
    const methods = [
      "select",
      "eq",
      "neq",
      "gte",
      "lte",
      "in",
      "is",
      "not",
      "order",
      "limit",
      "insert",
      "update",
      "delete",
      "upsert",
    ];
    for (const m of methods) {
      builder[m] = vi.fn(() => builder);
    }
    builder.single = vi.fn(() => Promise.resolve(result));
    builder.maybeSingle = vi.fn(() => Promise.resolve(result));
    builder.then = (
      onFulfilled?: (v: Result) => unknown,
      onRejected?: (r: unknown) => unknown
    ) => Promise.resolve(result).then(onFulfilled, onRejected);
    builder.catch = (onRejected?: (r: unknown) => unknown) =>
      Promise.resolve(result).catch(onRejected);
    return builder;
  };

  const mockFrom = vi.fn();

  return { YEAR, ROWS_PERIODES, ROWS_GROUPES, mockFrom, makeBuilder };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mockFrom },
}));

import { useAllFacturationPeriodes } from "./useAllFacturationPeriodes";

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

describe("useAllFacturationPeriodes", () => {
  beforeEach(() => {
    mockFrom.mockReset();
    mockFrom.mockImplementation((table: string) => {
      if (table === "facturation_periodes") {
        return makeBuilder({ data: ROWS_PERIODES, error: null });
      }
      if (table === "etablissements_groupes") {
        return makeBuilder({ data: ROWS_GROUPES, error: null });
      }
      return makeBuilder({ data: [], error: null });
    });
  });

  it("démarre en chargement puis se termine", async () => {
    const { result } = renderHook(() => useAllFacturationPeriodes(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.periodes).toEqual([]);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockFrom).toHaveBeenCalledWith("facturation_periodes");
    expect(mockFrom).toHaveBeenCalledWith("etablissements_groupes");
  });

  it("déduplique les périodes des établissements en facturation groupe", async () => {
    const { result } = renderHook(() => useAllFacturationPeriodes(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.periodes).toHaveLength(3);
    expect(result.current.periodes.map((p) => p.id)).toEqual(["p1", "p2", "p4"]);
  });

  it("calcule les totaux et compteurs métier", async () => {
    const { result } = renderHook(() => useAllFacturationPeriodes(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.currentYear).toBe(YEAR);
    expect(result.current.totalPrevuAnnuel).toBe(350);
    expect(result.current.totalEncaisse).toBe(120);
    expect(result.current.totalFacture).toBe(0);
    expect(result.current.totalEnRetard).toBe(50);
    expect(result.current.nbEnRetard).toBe(1);
    expect(result.current.nbPrevu).toBe(3);
    expect(result.current.nbEncaisse).toBe(1);
    expect(result.current.nbFacture).toBe(0);
    expect(result.current.parStatut).toEqual({
      encaissee: 1,
      prevue: 1,
      en_retard: 1,
    });
    expect(result.current.tauxEncaissement).toBe(34);
  });

  it("calcule les détails top 5, virements à venir et paiements attendus", async () => {
    const { result } = renderHook(() => useAllFacturationPeriodes(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.detailPrevu).toEqual([
      { nom: "Beta", montant: 200, count: 1 },
      { nom: "Alpha", montant: 150, count: 2 },
    ]);
    expect(result.current.detailEncaisse).toEqual([
      { nom: "Alpha", montant: 120, count: 1 },
    ]);
    expect(result.current.detailEnRetard).toEqual([
      { nom: "Alpha", montant: 50, count: 1 },
    ]);

    expect(result.current.prochainsVirements).toHaveLength(1);
    expect(result.current.prochainsVirements[0].id).toBe("p2");

    expect(result.current.paiementsAttendusAnnee.map((p) => p.id)).toEqual([
      "p2",
      "p4",
    ]);

    expect(result.current.periodesEnRetard).toHaveLength(1);
    expect(result.current.periodesEnRetard[0].id).toBe("p4");

    expect(result.current.evolution).toHaveLength(12);
    expect(result.current.evolution[0]).toEqual(
      expect.objectContaining({
        mois: expect.any(String),
        prevu: expect.any(Number),
        encaisse: expect.any(Number),
      })
    );

    const pieEncaissee = result.current.statutPieData.find(
      (s) => s.statut === "encaissee"
    );
    expect(pieEncaissee).toEqual({ name: "Encaissée", value: 1, statut: "encaissee" });
  });

  it("retourne des données vides et des totaux à zéro en cas d'erreur supabase", async () => {
    mockFrom.mockReset();
    mockFrom.mockImplementation(() =>
      makeBuilder({ data: null, error: { message: "x" } })
    );

    const { result } = renderHook(() => useAllFacturationPeriodes(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.periodes).toEqual([]);
    expect(result.current.totalPrevuAnnuel).toBe(0);
    expect(result.current.totalEncaisse).toBe(0);
    expect(result.current.nbEnRetard).toBe(0);
    expect(result.current.tauxEncaissement).toBe(0);
    expect(result.current.statutPieData).toEqual([]);
  });
});