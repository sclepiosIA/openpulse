type SupabaseMockResponse = {
  data: unknown | readonly unknown[] | null;
  error: { message: string } | null;
};

type SupabaseMockBuilder = {
  select: (columns: string) => SupabaseMockBuilder;
  order: (column: string, options?: unknown) => SupabaseMockBuilder;
  eq: (...args: readonly unknown[]) => SupabaseMockBuilder;
  gte: (...args: readonly unknown[]) => SupabaseMockBuilder;
  lte: (...args: readonly unknown[]) => SupabaseMockBuilder;
  "in": (...args: readonly unknown[]) => SupabaseMockBuilder;
  limit: (...args: readonly unknown[]) => SupabaseMockBuilder;
  insert: (...args: readonly unknown[]) => SupabaseMockBuilder;
  update: (...args: readonly unknown[]) => SupabaseMockBuilder;
  "delete": (...args: readonly unknown[]) => SupabaseMockBuilder;
  upsert: (...args: readonly unknown[]) => SupabaseMockBuilder;
  range: (...args: readonly unknown[]) => SupabaseMockBuilder;
  or: (...args: readonly unknown[]) => SupabaseMockBuilder;
  neq: (...args: readonly unknown[]) => SupabaseMockBuilder;
  is: (...args: readonly unknown[]) => SupabaseMockBuilder;
  returns: (...args: readonly unknown[]) => SupabaseMockBuilder;
  single: () => Promise<SupabaseMockResponse>;
  maybeSingle: () => Promise<SupabaseMockResponse>;
  then: <TResult1 = SupabaseMockResponse, TResult2 = never>(
    onfulfilled?: ((value: SupabaseMockResponse) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) => Promise<TResult1 | TResult2>;
  catch: <TResult = never>(
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null,
  ) => Promise<SupabaseMockResponse | TResult>;
};

const {
  ETABLISSEMENTS_WITH_VILLE_TYPE,
  ETABLISSEMENTS_WITH_VILLE,
  GROUPES_LITE,
  GROUPES_LITE_WITH_TYPE,
  PARTENAIRES_LITE,
  calls,
  mockFrom,
  resetSupabaseMock,
  useErrorResponse,
} = vi.hoisted(() => {
  const ETABLISSEMENTS_WITH_VILLE_TYPE = [
    { id: "etab-1", nom: "Collège Alpha", ville: "Paris", type: "college" },
    { id: "etab-2", nom: "Lycée Beta", ville: null, type: null },
  ] as const;

  const ETABLISSEMENTS_WITH_VILLE = [
    { id: "etab-1", nom: "Collège Alpha", ville: "Paris" },
    { id: "etab-2", nom: "Lycée Beta", ville: null },
  ] as const;

  const GROUPES_LITE = [
    { id: "grp-1", nom: "Groupe Nord" },
    { id: "grp-2", nom: "Groupe Sud" },
  ] as const;

  const GROUPES_LITE_WITH_TYPE = [
    { id: "grp-1", nom: "Groupe Nord", type: "public" },
    { id: "grp-2", nom: "Groupe Sud", type: null },
  ] as const;

  const PARTENAIRES_LITE = [
    { id: "part-1", nom: "Mairie Centre", ville: "Lyon", type_partenaire: "collectivite" },
    { id: "part-2", nom: "Association Est", ville: null, type_partenaire: null },
  ] as const;

  const EMPTY_ROWS = [] as const;
  const ERROR_X = { message: "x" } as const;

  const calls = {
    from: [] as string[],
    select: [] as string[],
    order: [] as string[],
    chain: [] as Array<{ method: string; args: readonly unknown[] }>,
  };

  let currentError: { message: string } | null = null;

  const responseFor = (table: string, selectedColumns: string): SupabaseMockResponse => {
    if (currentError) {
      return { data: null, error: currentError };
    }

    if (table === "etablissements" && selectedColumns === "id, nom, ville, type") {
      return { data: ETABLISSEMENTS_WITH_VILLE_TYPE, error: null };
    }

    if (table === "etablissements" && selectedColumns === "id, nom, ville") {
      return { data: ETABLISSEMENTS_WITH_VILLE, error: null };
    }

    if (table === "groupes_etablissements" && selectedColumns === "id, nom, type") {
      return { data: GROUPES_LITE_WITH_TYPE, error: null };
    }

    if (table === "groupes_etablissements" && selectedColumns === "id, nom") {
      return { data: GROUPES_LITE, error: null };
    }

    if (table === "partenaires" && selectedColumns === "id, nom, ville, type_partenaire") {
      return { data: PARTENAIRES_LITE, error: null };
    }

    return { data: EMPTY_ROWS, error: null };
  };

  const singleResponseFor = (table: string, selectedColumns: string): SupabaseMockResponse => {
    const response = responseFor(table, selectedColumns);

    if (response.error) {
      return response;
    }

    if (Array.isArray(response.data)) {
      return { data: response.data.length > 0 ? response.data[0] : null, error: null };
    }

    return response;
  };

  const createBuilder = (table: string): SupabaseMockBuilder => {
    let selectedColumns = "";
    let builder: SupabaseMockBuilder;

    const makeChainMethod = (method: string) =>
      vi.fn((...args: readonly unknown[]) => {
        calls.chain.push({ method, args });
        return builder;
      });

    builder = {
      select: vi.fn((columns: string) => {
        selectedColumns = columns;
        calls.select.push(columns);
        calls.chain.push({ method: "select", args: [columns] });
        return builder;
      }),
      order: vi.fn((column: string, options?: unknown) => {
        calls.order.push(column);
        calls.chain.push({ method: "order", args: options === undefined ? [column] : [column, options] });
        return builder;
      }),
      eq: makeChainMethod("eq"),
      gte: makeChainMethod("gte"),
      lte: makeChainMethod("lte"),
      "in": makeChainMethod("in"),
      limit: makeChainMethod("limit"),
      insert: makeChainMethod("insert"),
      update: makeChainMethod("update"),
      "delete": makeChainMethod("delete"),
      upsert: makeChainMethod("upsert"),
      range: makeChainMethod("range"),
      or: makeChainMethod("or"),
      neq: makeChainMethod("neq"),
      is: makeChainMethod("is"),
      returns: makeChainMethod("returns"),
      single: vi.fn(() => Promise.resolve(singleResponseFor(table, selectedColumns))),
      maybeSingle: vi.fn(() => Promise.resolve(singleResponseFor(table, selectedColumns))),
      then: vi.fn(
        <TResult1 = SupabaseMockResponse, TResult2 = never>(
          onfulfilled?: ((value: SupabaseMockResponse) => TResult1 | PromiseLike<TResult1>) | null,
          onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
        ) => Promise.resolve(responseFor(table, selectedColumns)).then(onfulfilled, onrejected),
      ),
      catch: vi.fn(
        <TResult = never>(onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null) =>
          Promise.resolve(responseFor(table, selectedColumns)).catch(onrejected),
      ),
    };

    return builder;
  };

  const mockFrom = vi.fn((table: string) => {
    calls.from.push(table);
    return createBuilder(table);
  });

  const resetSupabaseMock = () => {
    currentError = null;
    calls.from.length = 0;
    calls.select.length = 0;
    calls.order.length = 0;
    calls.chain.length = 0;
    mockFrom.mockClear();
  };

  const useErrorResponse = () => {
    currentError = ERROR_X;
  };

  return {
    ETABLISSEMENTS_WITH_VILLE_TYPE,
    ETABLISSEMENTS_WITH_VILLE,
    GROUPES_LITE,
    GROUPES_LITE_WITH_TYPE,
    PARTENAIRES_LITE,
    calls,
    mockFrom,
    resetSupabaseMock,
    useErrorResponse,
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}));

import {
  fetchEtablissementsWithVille,
  fetchEtablissementsWithVilleType,
  fetchGroupesLite,
  fetchPartenairesLite,
} from "./entitiesLite";

describe("entitiesLite", () => {
  it("fetchEtablissementsWithVilleType lit les établissements avec ville et type triés par nom", async () => {
    resetSupabaseMock();

    const result = await fetchEtablissementsWithVilleType();

    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith("etablissements");
    expect(calls.select).toEqual(["id, nom, ville, type"]);
    expect(calls.order).toEqual(["nom"]);
    expect(result).toEqual(ETABLISSEMENTS_WITH_VILLE_TYPE);
    expect(result).toHaveLength(2);
    expect(result.at(0)).toEqual({ id: "etab-1", nom: "Collège Alpha", ville: "Paris", type: "college" });
    expect(result.at(1)).toEqual({ id: "etab-2", nom: "Lycée Beta", ville: null, type: null });
  });

  it("fetchEtablissementsWithVille lit les établissements sans colonne type", async () => {
    resetSupabaseMock();

    const result = await fetchEtablissementsWithVille();

    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith("etablissements");
    expect(calls.select).toEqual(["id, nom, ville"]);
    expect(calls.order).toEqual(["nom"]);
    expect(result).toEqual(ETABLISSEMENTS_WITH_VILLE);
    expect(result.map((etablissement) => etablissement.nom)).toEqual(["Collège Alpha", "Lycée Beta"]);
    expect(result.at(0)).toEqual({ id: "etab-1", nom: "Collège Alpha", ville: "Paris" });
  });

  it("fetchGroupesLite lit les groupes sans type par défaut", async () => {
    resetSupabaseMock();

    const result = await fetchGroupesLite();

    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith("groupes_etablissements");
    expect(calls.select).toEqual(["id, nom"]);
    expect(calls.order).toEqual(["nom"]);
    expect(result).toEqual(GROUPES_LITE);
    expect(result.at(0)).toEqual({ id: "grp-1", nom: "Groupe Nord" });
    expect(result.at(1)).toEqual({ id: "grp-2", nom: "Groupe Sud" });
  });

  it("fetchGroupesLite lit aussi la colonne type quand withType vaut true", async () => {
    resetSupabaseMock();

    const result = await fetchGroupesLite({ withType: true });

    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith("groupes_etablissements");
    expect(calls.select).toEqual(["id, nom, type"]);
    expect(calls.order).toEqual(["nom"]);
    expect(result).toEqual(GROUPES_LITE_WITH_TYPE);
    expect(result.at(0)).toEqual({ id: "grp-1", nom: "Groupe Nord", type: "public" });
    expect(result.at(1)).toEqual({ id: "grp-2", nom: "Groupe Sud", type: null });
  });

  it("fetchPartenairesLite lit les partenaires avec ville et type_partenaire", async () => {
    resetSupabaseMock();

    const result = await fetchPartenairesLite();

    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith("partenaires");
    expect(calls.select).toEqual(["id, nom, ville, type_partenaire"]);
    expect(calls.order).toEqual(["nom"]);
    expect(result).toEqual(PARTENAIRES_LITE);
    expect(result).toHaveLength(2);
    expect(result.at(0)).toEqual({
      id: "part-1",
      nom: "Mairie Centre",
      ville: "Lyon",
      type_partenaire: "collectivite",
    });
    expect(result.at(1)).toEqual({
      id: "part-2",
      nom: "Association Est",
      ville: null,
      type_partenaire: null,
    });
  });

  it.each([
    [
      "fetchEtablissementsWithVilleType",
      () => fetchEtablissementsWithVilleType(),
      "etablissements",
      "id, nom, ville, type",
    ],
    ["fetchEtablissementsWithVille", () => fetchEtablissementsWithVille(), "etablissements", "id, nom, ville"],
    ["fetchGroupesLite", () => fetchGroupesLite(), "groupes_etablissements", "id, nom"],
    ["fetchPartenairesLite", () => fetchPartenairesLite(), "partenaires", "id, nom, ville, type_partenaire"],
  ] as const)(
    "%s retourne un tableau vide quand Supabase renvoie data null avec une erreur",
    async (_name, fetcher, expectedTable, expectedSelect) => {
      resetSupabaseMock();
      useErrorResponse();

      const result = await fetcher();

      expect(result).toEqual([]);
      expect(mockFrom).toHaveBeenCalledTimes(1);
      expect(mockFrom).toHaveBeenCalledWith(expectedTable);
      expect(calls.select).toEqual([expectedSelect]);
      expect(calls.order).toEqual(["nom"]);
    },
  );
});