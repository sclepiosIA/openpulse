import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useTresoreriePrevisionnel } from "./useTresoreriePrevisionnel";

const { ETABS_INIT, SALAIRES_INIT, DEPENSES_INIT, dataMap, errorMap, mockFrom, QONTO } = vi.hoisted(() => {
  const ETABS_INIT = [
    {
      id: "e1",
      nom: "Etablissement 1",
      statut: "Contractuel",
      date_signature: null,
      date_previsionnelle_signature: null,
      pallier_vise: "1",
      tarifs_palliers: { pallier1: 1200 },
      modele_statique_succes: null,
      periodicite_paiement: "mensuel",
      type_offre: null,
      nombre_passages_urgences_annuel: null,
    },
  ];

  const SALAIRES_INIT = [
    { salaire_net: 1000, cotisations_patronales: 200, mois: "2026-05" },
    { salaire_net: 1000, cotisations_patronales: 200, mois: "2026-04" },
  ];

  const DEPENSES_INIT = [{ montant: 300, categorie_code: "loc", nom: "Loyer" }];

  const dataMap: Record<string, any[]> = {
    etablissements: [...ETABS_INIT],
    rh_salaires_mensuels: [...SALAIRES_INIT],
    tresorerie_depenses: [...DEPENSES_INIT],
  };

  const errorMap: Record<string, string | null> = {
    etablissements: null,
    rh_salaires_mensuels: null,
    tresorerie_depenses: null,
  };

  const mockFrom = vi.fn((table: string) => {
    const builder: any = {
      _table: table,
      select: () => builder,
      not: () => builder,
      limit: () => builder,
      order: () => builder,
      eq: () => builder,
      neq: () => builder,
      then(onFulfilled?: any, onRejected?: any) {
        const res = errorMap[table]
          ? { data: null, error: { message: errorMap[table] } }
          : { data: dataMap[table], error: null };
        // If then is called with callbacks, propagate; otherwise resolve to res
        return Promise.resolve(res).then(onFulfilled, onRejected);
      },
      catch(onRejected: any) {
        return Promise.resolve().catch(onRejected);
      },
    };
    return builder;
  });

  const QONTO = {
    connection: {
      bank_accounts: [{ balance: 4000 }, { balance: 6000 }],
    },
  };

  return { ETABS_INIT, SALAIRES_INIT, DEPENSES_INIT, dataMap, errorMap, mockFrom, QONTO };
});

vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      from: mockFrom,
    },
  };
});

vi.mock("@/hooks/tresorerie/useQontoTransactions", () => {
  return {
    useQontoTransactions: () => ({ connection: QONTO.connection }),
  };
});

vi.mock("@/lib/queryPresets", () => {
  return {
    queryPresets: { standard: { staleTime: 0 } },
  };
});

describe("useTresoreriePrevisionnel", () => {
  const createQueryClient = () =>
    new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });

  beforeEach(() => {
    // Reset data and errors to initial stable values
    dataMap.etablissements.length = 0;
    dataMap.rh_salaires_mensuels.length = 0;
    dataMap.tresorerie_depenses.length = 0;
    dataMap.etablissements.push(...ETABS_INIT);
    dataMap.rh_salaires_mensuels.push(...SALAIRES_INIT);
    dataMap.tresorerie_depenses.push(...DEPENSES_INIT);

    errorMap.etablissements = null;
    errorMap.rh_salaires_mensuels = null;
    errorMap.tresorerie_depenses = null;

    mockFrom.mockClear();
  });

  it("should report loading then compute 12 months of previsions and etablissementsPrevisions correctly", async () => {
    const client = createQueryClient();
    const wrapper = ({ children }: { children: any }) =>
      React.createElement(QueryClientProvider, { client }, children);

    const { result } = renderHook(() => useTresoreriePrevisionnel(), { wrapper });

    // initially loading should be true
    expect(result.current.isLoading).toBe(true);

    // wait until finished
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // One call per query at initial mount
    expect(mockFrom).toHaveBeenCalledTimes(3);
    expect(mockFrom).toHaveBeenCalledWith("etablissements");
    expect(mockFrom).toHaveBeenCalledWith("rh_salaires_mensuels");
    expect(mockFrom).toHaveBeenCalledWith("tresorerie_depenses");

    const { previsions, etablissementsPrevisions } = result.current;

    // Should produce 12 months
    expect(Array.isArray(previsions)).toBe(true);
    expect(previsions).toHaveLength(12);

    // Business value assertions for first month
    const first = previsions[0];

    // From our ETABS_INIT: tarif pallier1 = 1200 monthly, statut Contractuel => probabilite 1 => contractualises
    expect(first.revenusContractualises).toBe(1200);
    expect(first.revenus).toBe(1200);

    // Salaries monthly average: each month (1000+200)=1200, average over 2 months = 1200
    // Depenses recurrentes monthly = 300
    expect(first.depensesSalaires).toBe(1200);
    expect(first.depensesRecurrentes).toBe(300);
    expect(first.depenses).toBe(1500);

    // Flux = revenus - depenses = -300
    expect(first.fluxTresorerie).toBe(-300);

    // Initial qonto balance = 4000+6000 = 10000 => soldePrevu = 10000 + (-300)
    expect(first.soldePrevu).toBe(9700);

    // Probabilité = revenusContractualises / revenus = 1
    expect(first.probabilite).toBe(1);

    // etablissementsPrevisions should contain our etab with revenuMensuelEstime 1200 and probabilite 1
    expect(Array.isArray(etablissementsPrevisions)).toBe(true);
    expect(etablissementsPrevisions.length).toBeGreaterThanOrEqual(1);
    const etab = etablissementsPrevisions.find((e) => e.id === "e1");
    expect(etab).toBeDefined();
    expect(etab?.revenuMensuelEstime).toBe(1200);
    expect(etab?.probabilite).toBe(1);

    // Trigger refetch (wrapped in act)
    await act(async () => {
      result.current.refetch();
    });

    // After refetch, supabase.from should have been called again for each query (at least 6 calls total)
    await waitFor(() => {
      expect(mockFrom.mock.calls.length).toBeGreaterThanOrEqual(6);
    });
  });

  it("should handle a supabase error for etablissements and result in empty previsions", async () => {
    // Inject an error for the etablissements query
    errorMap.etablissements = "boom";

    const client = createQueryClient();
    const wrapper = ({ children }: { children: any }) =>
      React.createElement(QueryClientProvider, { client }, children);

    const { result } = renderHook(() => useTresoreriePrevisionnel(), { wrapper });

    // wait until finished
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should have called supabase for each query
    expect(mockFrom).toHaveBeenCalledWith("etablissements");
    expect(mockFrom).toHaveBeenCalledWith("rh_salaires_mensuels");
    expect(mockFrom).toHaveBeenCalledWith("tresorerie_depenses");

    // Because etablissements errored, the hook should treat etablissements as empty and therefore previsions empty
    expect(result.current.previsions).toEqual([]);
    expect(result.current.etablissementsPrevisions).toEqual([]);
  });
});