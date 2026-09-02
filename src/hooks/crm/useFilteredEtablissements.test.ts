import React from "react";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFilteredEtablissements } from "./useFilteredEtablissements";

type Etab = {
  id: string;
  nom: string;
  ville: string;
  region: string;
  statut: string;
  type?: string | null;
  dpi?: string | null;
  commercial_id?: string | null;
  chef_projet_id?: string | null;
  csm_id?: string | null;
  progression?: number | null;
  date_signature?: string | null;
  date_previsionnelle_signature?: string | null;
  created_at: string;
};

const { FIXED_NOW, ETABS, USER_COMMERCIAL, USER_CHEF, USER_CSM } = vi.hoisted(() => ({
  FIXED_NOW: new Date("2025-01-15T12:00:00.000Z").getTime(),
  USER_COMMERCIAL: { id: "u-commercial", role: "commercial" },
  USER_CHEF: { id: "u-chef", role: "chef_projet" },
  USER_CSM: { id: "u-csm", role: "csm" },
  ETABS: [
    {
      id: "e1",
      nom: "Alpha Clinic",
      ville: "Paris",
      region: "Ile-de-France",
      statut: "En cours",
      type: "Hopital",
      dpi: "DPI-A",
      commercial_id: "u-commercial",
      chef_projet_id: "u-chef",
      csm_id: "u-csm",
      progression: 20,
      date_signature: "2025-01-10T00:00:00.000Z",
      date_previsionnelle_signature: "2025-01-25T00:00:00.000Z",
      created_at: "2025-01-12T00:00:00.000Z",
    },
    {
      id: "e2",
      nom: "Beta Center",
      ville: "Lyon",
      region: "Auvergne-Rhone-Alpes",
      statut: "Bloqué",
      type: "Clinique",
      dpi: "DPI-B",
      commercial_id: "u-other",
      chef_projet_id: "u-chef",
      csm_id: "u-other-csm",
      progression: 80,
      date_signature: null,
      date_previsionnelle_signature: "2025-03-10T00:00:00.000Z",
      created_at: "2024-12-01T00:00:00.000Z",
    },
    {
      id: "e3",
      nom: "Gamma Lab",
      ville: "Marseille",
      region: "PACA",
      statut: "Terminé",
      type: "Hopital",
      dpi: "DPI-A",
      commercial_id: "u-commercial",
      chef_projet_id: "u-other-chef",
      csm_id: "u-csm",
      progression: 100,
      date_signature: "2024-11-05T00:00:00.000Z",
      date_previsionnelle_signature: "2024-11-01T00:00:00.000Z",
      created_at: "2024-11-01T00:00:00.000Z",
    },
    {
      id: "e4",
      nom: "Delta House",
      ville: "Paris",
      region: "Ile-de-France",
      statut: "Prospect",
      type: "Cabinet",
      dpi: null,
      commercial_id: "u-other",
      chef_projet_id: "u-other-chef",
      csm_id: "u-csm",
      progression: 10,
      date_signature: null,
      date_previsionnelle_signature: null,
      created_at: "2025-01-14T00:00:00.000Z",
    },
  ] as Etab[],
}));

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

function renderUseFiltered(
  override?: Partial<Parameters<typeof useFilteredEtablissements<Etab>>[0]>
) {
  const baseParams: Parameters<typeof useFilteredEtablissements<Etab>>[0] = {
    source: ETABS,
    debouncedSearchTerm: "",
    showOnlyMine: false,
    userProfile: null,
    statutFilter: null,
    typeFilter: null,
    dpiFilter: null,
    regionFilter: null,
    commercialFilter: null,
    chefProjetFilter: null,
    csmFilter: null,
    signatureYearFilter: null,
    smartFilter: null,
    sortField: "nom",
    sortDirection: "asc",
  };

  return renderHook(() => useFilteredEtablissements<Etab>({ ...baseParams, ...override }), {
    wrapper: createWrapper(),
  });
}

describe("useFilteredEtablissements", () => {
  beforeEach(() => {
    vi.spyOn(Date, "now").mockReturnValue(FIXED_NOW);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retourne une liste vide quand source est undefined", () => {
    const { result } = renderUseFiltered({ source: undefined });

    expect(result.current).toEqual([]);
  });

  it("filtre par recherche texte sur nom, ville, region et statut", () => {
    const byName = renderUseFiltered({ debouncedSearchTerm: "alpha" });
    expect(byName.result.current.map((e) => e.id)).toEqual(["e1"]);

    const byVille = renderUseFiltered({ debouncedSearchTerm: "lyon" });
    expect(byVille.result.current.map((e) => e.id)).toEqual(["e2"]);

    const byRegion = renderUseFiltered({ debouncedSearchTerm: "paca" });
    expect(byRegion.result.current.map((e) => e.id)).toEqual(["e3"]);

    const byStatut = renderUseFiltered({ debouncedSearchTerm: "bloqué" });
    expect(byStatut.result.current.map((e) => e.id)).toEqual(["e2"]);
  });

  it("filtre showOnlyMine selon le rôle commercial", () => {
    const { result } = renderUseFiltered({
      showOnlyMine: true,
      userProfile: USER_COMMERCIAL,
      sortField: "nom",
      sortDirection: "asc",
    });

    expect(result.current.map((e) => e.id)).toEqual(["e1", "e3"]);
  });

  it("filtre showOnlyMine selon le rôle chef de projet", () => {
    const { result } = renderUseFiltered({
      showOnlyMine: true,
      userProfile: USER_CHEF,
      sortField: "nom",
      sortDirection: "asc",
    });

    expect(result.current.map((e) => e.id)).toEqual(["e1", "e2"]);
  });

  it("filtre showOnlyMine selon le rôle csm", () => {
    const { result } = renderUseFiltered({
      showOnlyMine: true,
      userProfile: USER_CSM,
      sortField: "nom",
      sortDirection: "asc",
    });

    expect(result.current.map((e) => e.id)).toEqual(["e1", "e4", "e3"]);
  });

  it("ne filtre pas showOnlyMine pour un rôle non géré", () => {
    const { result } = renderUseFiltered({
      showOnlyMine: true,
      userProfile: { id: "u-admin", role: "admin" },
      sortField: "nom",
      sortDirection: "asc",
    });

    expect(result.current.map((e) => e.id)).toEqual(["e1", "e2", "e4", "e3"]);
  });

  it("applique les filtres statut, type, dpi, region, commercial, chefProjet, csm", () => {
    const statut = renderUseFiltered({ statutFilter: "En cours, Bloqué" });
    expect(statut.result.current.map((e) => e.id)).toEqual(["e1", "e2"]);

    const type = renderUseFiltered({ typeFilter: "Hopital" });
    expect(type.result.current.map((e) => e.id)).toEqual(["e1", "e3"]);

    const dpi = renderUseFiltered({ dpiFilter: "DPI-A, DPI-B" });
    expect(dpi.result.current.map((e) => e.id)).toEqual(["e1", "e2", "e3"]);

    const region = renderUseFiltered({ regionFilter: "Ile-de-France" });
    expect(region.result.current.map((e) => e.id)).toEqual(["e1", "e4"]);

    const commercial = renderUseFiltered({ commercialFilter: "u-commercial" });
    expect(commercial.result.current.map((e) => e.id)).toEqual(["e1", "e3"]);

    const chefProjet = renderUseFiltered({ chefProjetFilter: "u-chef" });
    expect(chefProjet.result.current.map((e) => e.id)).toEqual(["e1", "e2"]);

    const csm = renderUseFiltered({ csmFilter: "u-csm" });
    expect(csm.result.current.map((e) => e.id)).toEqual(["e1", "e4", "e3"]);
  });

  it("filtre par année de signature prévisionnelle", () => {
    const { result } = renderUseFiltered({
      signatureYearFilter: "2025",
      sortField: "nom",
      sortDirection: "asc",
    });

    expect(result.current.map((e) => e.id)).toEqual(["e1", "e2"]);
  });

  it("applique le smartFilter urgents", () => {
    const { result } = renderUseFiltered({
      smartFilter: "urgents",
      sortField: "nom",
      sortDirection: "asc",
    });

    expect(result.current.map((e) => e.id)).toEqual(["e1", "e2", "e4"]);
  });

  it("applique le smartFilter echeances sur les 30 prochains jours uniquement", () => {
    const { result } = renderUseFiltered({
      smartFilter: "echeances",
      sortField: "nom",
      sortDirection: "asc",
    });

    expect(result.current.map((e) => e.id)).toEqual(["e1"]);
  });

  it("applique le smartFilter nouveaux sur les 7 derniers jours", () => {
    const { result } = renderUseFiltered({
      smartFilter: "nouveaux",
      sortField: "nom",
      sortDirection: "asc",
    });

    expect(result.current.map((e) => e.id)).toEqual(["e1", "e4"]);
  });

  it("combine plusieurs filtres métier correctement", () => {
    const { result } = renderUseFiltered({
      debouncedSearchTerm: "paris",
      regionFilter: "Ile-de-France",
      dpiFilter: "DPI-A",
      showOnlyMine: true,
      userProfile: USER_COMMERCIAL,
      smartFilter: "urgents",
      sortField: "nom",
      sortDirection: "asc",
    });

    expect(result.current).toHaveLength(1);
    expect(result.current[0]?.id).toBe("e1");
    expect(result.current[0]?.nom).toBe("Alpha Clinic");
  });

  it("trie par nom asc et desc", () => {
    const asc = renderUseFiltered({ sortField: "nom", sortDirection: "asc" });
    expect(asc.result.current.map((e) => e.id)).toEqual(["e1", "e2", "e4", "e3"]);

    const desc = renderUseFiltered({ sortField: "nom", sortDirection: "desc" });
    expect(desc.result.current.map((e) => e.id)).toEqual(["e3", "e4", "e2", "e1"]);
  });

  it("trie par date_creation", () => {
    const { result } = renderUseFiltered({
      sortField: "date_creation",
      sortDirection: "asc",
    });

    expect(result.current.map((e) => e.id)).toEqual(["e3", "e2", "e1", "e4"]);
  });

  it("trie par progression", () => {
    const { result } = renderUseFiltered({
      sortField: "progression",
      sortDirection: "desc",
    });

    expect(result.current.map((e) => e.id)).toEqual(["e3", "e2", "e1", "e4"]);
  });

  it("trie par date_signature en mettant les dates absentes à 0", () => {
    const { result } = renderUseFiltered({
      sortField: "date_signature",
      sortDirection: "asc",
    });

    expect(result.current.map((e) => e.id)).toEqual(["e2", "e4", "e3", "e1"]);
  });

  it("trie par ville", () => {
    const { result } = renderUseFiltered({
      sortField: "ville",
      sortDirection: "asc",
    });

    expect(result.current.map((e) => e.id)).toEqual(["e2", "e3", "e1", "e4"]);
  });

  it("préserve les champs additionnels via le générique", () => {
    const extended = ETABS.map((e, index) => ({
      ...e,
      extraLabel: `label-${index + 1}`,
    }));

    const { result } = renderHook(
      () =>
        useFilteredEtablissements({
          source: extended,
          debouncedSearchTerm: "alpha",
          showOnlyMine: false,
          userProfile: null,
          statutFilter: null,
          typeFilter: null,
          dpiFilter: null,
          regionFilter: null,
          commercialFilter: null,
          chefProjetFilter: null,
          csmFilter: null,
          signatureYearFilter: null,
          smartFilter: null,
          sortField: "nom",
          sortDirection: "asc",
        }),
      { wrapper: createWrapper() }
    );

    expect(result.current).toHaveLength(1);
    expect(result.current[0]?.id).toBe("e1");
    expect(result.current[0]?.extraLabel).toBe("label-1");
  });
});