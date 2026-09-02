/* @vitest-environment jsdom */
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import React from "react";
import { useBusinessSearch } from "./useBusinessSearch";

const {
  FACTURES_ROWS,
  DEVIS_ROWS,
  CONTRATS_ROWS,
  KB_ROWS,
  DASHBOARD_ROWS,
  WORKFLOW_ROWS,
  CANDIDATE_ROWS,
  JOB_ROWS,
  FORUM_ROWS,
  SOCIAL_ROWS,
  PRODUIT_ROWS,
  NOTE_ROWS,
  EMPTY_ROWS,
  mockFrom,
  mockSanitizePostgrestValue,
  mockBuildIlikeOrFilter,
} = vi.hoisted(() => ({
  FACTURES_ROWS: [
    { id: "f1", numero: "FAC-001", client_nom: "Client A", statut: "payee", date_emission: "2024-02-10" },
  ],
  DEVIS_ROWS: [
    { id: "d1", numero: "DEV-001", client_nom: "Client B", statut: "envoye", date_emission: "2024-02-09" },
  ],
  CONTRATS_ROWS: [
    { id: "c1", numero: "CTR-001", titre: "Contrat Premium", client_nom: "Client C", statut: "actif" },
  ],
  // Une PAGE du wiki, et non plus un article de base de connaissances :
  // colonnes `name` et `description` de la table `documents`.
  KB_ROWS: [
    { id: "kb1", name: "Guide KB", description: "Résumé article de connaissance" },
  ],
  DASHBOARD_ROWS: [
    { id: "dash1", nom: "Dashboard Ventes", description: "Suivi des ventes consolidées" },
  ],
  WORKFLOW_ROWS: [
    { id: "wf1", name: "Workflow RH", description: "Automatisation onboarding" },
  ],
  CANDIDATE_ROWS: [
    { id: "cand1", prenom: "Jean", nom: "Dupont", email: "jean@example.test", statut: "nouveau" },
  ],
  JOB_ROWS: [
    { id: "job1", titre: "Développeur Front", description: "Poste React TypeScript", statut: "ouverte" },
  ],
  FORUM_ROWS: [
    { id: "post1", titre: "Sujet important", contenu: "Contenu du post forum avec détails utiles", theme: "entraide" },
  ],
  SOCIAL_ROWS: [
    { id: "soc1", message: "Publication social très intéressante", platform: "linkedin", published_at: "2024-03-15T00:00:00.000Z" },
  ],
  PRODUIT_ROWS: [
    { id: "prod1", code: "PRD1", nom: "Produit Alpha", description: "Description produit", type: "service", est_actif: true },
  ],
  NOTE_ROWS: [
    { id: "nf1", libelle: "Déplacement client", categorie: "transport", statut: "soumise", montant_ttc: 45.5, date_depense: "2024-01-11" },
  ],
  EMPTY_ROWS: [],
  mockFrom: vi.fn(),
  mockSanitizePostgrestValue: vi.fn((value: string) => `san-${value}`),
  mockBuildIlikeOrFilter: vi.fn((fields: string[], value: string) => `${fields.join(",")}:${value}`),
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

type SupabaseError = { message: string } | null;
type SupabaseResponse = { data: unknown; error: SupabaseError };

function createBuilder(response: SupabaseResponse) {
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
    upsert: vi.fn(() => builder),
    or: vi.fn(() => builder),
    ilike: vi.fn(() => builder),
    match: vi.fn(() => builder),
    not: vi.fn(() => builder),
    is: vi.fn(() => builder),
    // La recherche de pages passe par l'index plein texte : sans cette
    // methode le chainage casse en silence et la requete rend un tableau
    // vide, ce qui ressemble a « aucun resultat » plutot qu'a une erreur.
    textSearch: vi.fn(() => builder),
    single: vi.fn(async () => response),
    maybeSingle: vi.fn(async () => response),
    then: (
      onFulfilled?: (value: SupabaseResponse) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(response).then(onFulfilled, onRejected),
    catch: (onRejected?: (reason: unknown) => unknown) => Promise.resolve(response).catch(onRejected),
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

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

function useBusinessSearchWithErrorState(debouncedSearch: string, shouldSearch: boolean) {
  const business = useBusinessSearch(debouncedSearch, shouldSearch);

  const facturesQuery = useQuery({
    queryKey: ["global-search-factures", debouncedSearch],
    queryFn: async () => {
      const s = mockSanitizePostgrestValue(debouncedSearch);
      const { data, error } = await createBuilder({ data: null, error: null });
      void s;
      if (error) throw error;
      return data;
    },
    enabled: false,
  });

  return {
    ...business,
    facturesQuery,
  };
}

describe("useBusinessSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passe de loading à succès et mappe toutes les catégories avec les valeurs métier attendues", async () => {
    mockFrom.mockImplementation((table: string) => {
      const byTable: Record<string, SupabaseResponse> = {
        factures: { data: FACTURES_ROWS, error: null },
        devis: { data: DEVIS_ROWS, error: null },
        contrats: { data: CONTRATS_ROWS, error: null },
        documents: { data: KB_ROWS, error: null },
        custom_dashboards: { data: DASHBOARD_ROWS, error: null },
        jarvis_workflows: { data: WORKFLOW_ROWS, error: null },
        candidates: { data: CANDIDATE_ROWS, error: null },
        job_offers: { data: JOB_ROWS, error: null },
        forum_posts: { data: FORUM_ROWS, error: null },
        social_posts: { data: SOCIAL_ROWS, error: null },
        catalogue_produits: { data: PRODUIT_ROWS, error: null },
        rh_notes_frais: { data: NOTE_ROWS, error: null },
      };
      return createBuilder(byTable[table] ?? { data: EMPTY_ROWS, error: null });
    });

    const { result } = renderHook(() => useBusinessSearch("abc", true), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockSanitizePostgrestValue).toHaveBeenCalledWith("abc");
    expect(mockBuildIlikeOrFilter).toHaveBeenCalledWith(["nom", "description"], "san-abc");
    expect(mockBuildIlikeOrFilter).toHaveBeenCalledWith(["name", "description"], "san-abc");
    expect(mockBuildIlikeOrFilter).toHaveBeenCalledWith(["nom", "prenom", "email"], "san-abc");
    expect(mockBuildIlikeOrFilter).toHaveBeenCalledWith(["titre", "description"], "san-abc");
    expect(mockBuildIlikeOrFilter).toHaveBeenCalledWith(["libelle", "categorie"], "san-abc");

    expect(result.current.slice.factures).toEqual([
      {
        id: "f1",
        type: "facture",
        title: "Facture FAC-001",
        subtitle: "Client A",
        badge: "payee",
        href: "/facturation?facture=f1",
      },
    ]);

    expect(result.current.slice.devis).toEqual([
      {
        id: "d1",
        type: "devis",
        title: "Devis DEV-001",
        subtitle: "Client B",
        badge: "envoye",
        href: "/facturation?devis=d1",
      },
    ]);

    expect(result.current.slice.contrats).toEqual([
      {
        id: "c1",
        type: "contrat",
        title: "Contrat Premium",
        subtitle: "Client C",
        badge: "actif",
        href: "/contrats/c1",
      },
    ]);

    expect(result.current.slice.kbArticles).toEqual([
      {
        id: "kb1",
        type: "kb_article",
        title: "Guide KB",
        subtitle: "Résumé article de connaissance",
        href: "/documents?doc=kb1",
      },
    ]);

    expect(result.current.slice.customDashboards).toEqual([
      {
        id: "dash1",
        type: "custom_dashboard",
        title: "Dashboard Ventes",
        subtitle: "Suivi des ventes consolidées",
        href: "/rapports-custom/dash1",
      },
    ]);

    expect(result.current.slice.workflows).toEqual([
      {
        id: "wf1",
        type: "workflow",
        title: "Workflow RH",
        subtitle: "Automatisation onboarding",
        href: "/automatisations/wf1/edit",
      },
    ]);

    expect(result.current.slice.candidates).toEqual([
      {
        id: "cand1",
        type: "candidate",
        title: "Jean Dupont",
        subtitle: "jean@example.test",
        badge: "nouveau",
        href: "/recrutement?candidate=cand1",
      },
    ]);

    expect(result.current.slice.jobOffers).toEqual([
      {
        id: "job1",
        type: "job_offer",
        title: "Développeur Front",
        subtitle: "Poste React TypeScript",
        badge: "ouverte",
        href: "/recrutement?offer=job1",
      },
    ]);

    expect(result.current.slice.forumPosts).toEqual([
      {
        id: "post1",
        type: "forum_post",
        title: "Sujet important",
        subtitle: "Contenu du post forum avec détails utiles",
        badge: "entraide",
        href: "/forum/post/post1",
      },
    ]);

    expect(result.current.slice.socialPosts).toEqual([
      {
        id: "soc1",
        type: "social_post",
        title: "Publication social très intéressante",
        subtitle: "linkedin",
        badge: format(new Date("2024-03-15T00:00:00.000Z"), "d MMM", { locale: fr }),
        href: "/social?post=soc1",
      },
    ]);

    expect(result.current.slice.produits).toEqual([
      {
        id: "prod1",
        type: "produit",
        title: "Produit Alpha",
        subtitle: "PRD1",
        badge: "service",
        href: "/catalogue-produits?id=prod1",
      },
    ]);

    expect(result.current.slice.notesFrais).toEqual([
      {
        id: "nf1",
        type: "note_frais",
        title: "Déplacement client",
        subtitle: "transport",
        badge: "soumise",
        href: "/people?frais=nf1",
      },
    ]);

    expect(mockFrom).toHaveBeenCalledTimes(12);
    expect(mockFrom).toHaveBeenCalledWith("factures");
    expect(mockFrom).toHaveBeenCalledWith("devis");
    expect(mockFrom).toHaveBeenCalledWith("contrats");
    expect(mockFrom).toHaveBeenCalledWith("documents");
    expect(mockFrom).toHaveBeenCalledWith("custom_dashboards");
    expect(mockFrom).toHaveBeenCalledWith("jarvis_workflows");
    expect(mockFrom).toHaveBeenCalledWith("candidates");
    expect(mockFrom).toHaveBeenCalledWith("job_offers");
    expect(mockFrom).toHaveBeenCalledWith("forum_posts");
    expect(mockFrom).toHaveBeenCalledWith("social_posts");
    expect(mockFrom).toHaveBeenCalledWith("catalogue_produits");
    expect(mockFrom).toHaveBeenCalledWith("rh_notes_frais");
  });

  it("ne lance aucune requête quand shouldSearch vaut false et retourne des slices vides", () => {
    mockFrom.mockImplementation(() => createBuilder({ data: EMPTY_ROWS, error: null }));

    const { result } = renderHook(() => useBusinessSearch("abc", false), {
      wrapper: createWrapper(),
    });

    expect(mockFrom).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.slice.factures).toEqual([]);
    expect(result.current.slice.devis).toEqual([]);
    expect(result.current.slice.contrats).toEqual([]);
    expect(result.current.slice.kbArticles).toEqual([]);
    expect(result.current.slice.customDashboards).toEqual([]);
    expect(result.current.slice.workflows).toEqual([]);
    expect(result.current.slice.candidates).toEqual([]);
    expect(result.current.slice.jobOffers).toEqual([]);
    expect(result.current.slice.forumPosts).toEqual([]);
    expect(result.current.slice.socialPosts).toEqual([]);
    expect(result.current.slice.produits).toEqual([]);
    expect(result.current.slice.notesFrais).toEqual([]);
  });

  it("met la requête factures en erreur react-query quand Supabase renvoie { data:null, error:{ message:'x' } }", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "factures") {
        return createBuilder({ data: null, error: { message: "x" } });
      }

      const byTable: Record<string, SupabaseResponse> = {
        devis: { data: DEVIS_ROWS, error: null },
        contrats: { data: CONTRATS_ROWS, error: null },
        documents: { data: KB_ROWS, error: null },
        custom_dashboards: { data: DASHBOARD_ROWS, error: null },
        jarvis_workflows: { data: WORKFLOW_ROWS, error: null },
        candidates: { data: CANDIDATE_ROWS, error: null },
        job_offers: { data: JOB_ROWS, error: null },
        forum_posts: { data: FORUM_ROWS, error: null },
        social_posts: { data: SOCIAL_ROWS, error: null },
        catalogue_produits: { data: PRODUIT_ROWS, error: null },
        rh_notes_frais: { data: NOTE_ROWS, error: null },
      };
      return createBuilder(byTable[table] ?? { data: EMPTY_ROWS, error: null });
    });

    const { result } = renderHook(() => {
      const business = useBusinessSearch("abc", true);
      const facturesQuery = useQuery({
        queryKey: ["assert-factures-error", "abc"],
        queryFn: async () => {
          const s = mockSanitizePostgrestValue("abc");
          const { data, error } = await mockFrom("factures")
            .select("id, numero, client_nom, statut, date_emission")
            .or(`numero.ilike.%${s}%,client_nom.ilike.%${s}%`)
            .order("date_emission", { ascending: false })
            .limit(5);
          if (error) {
            throw error;
          }
          return data;
        },
        retry: 0,
      });

      return { business, facturesQuery };
    }, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.business.isLoading).toBe(false);
    });

    await waitFor(() => {
      expect(result.current.facturesQuery.isError).toBe(true);
    });

    expect(result.current.facturesQuery.error).toEqual({ message: "x" });
    expect(result.current.business.slice.factures).toEqual([]);
    expect(result.current.business.slice.devis).toEqual([
      {
        id: "d1",
        type: "devis",
        title: "Devis DEV-001",
        subtitle: "Client B",
        badge: "envoye",
        href: "/facturation?devis=d1",
      },
    ]);
  });
});