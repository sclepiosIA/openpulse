/* @vitest-environment jsdom */
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import {
  useDocuments,
  useDocument,
  useDocumentsByEntity,
  useDeleteDocument,
  useRestoreDocument,
  useUpdateDocumentTags,
  useRenameDocument,
  useAddDocumentRelation,
} from "./useDocuments";

const {
  AUTH_STATE,
  DOCUMENT_ROWS,
  SINGLE_DOCUMENT,
  RELATION_ROWS,
  OLD_TAGS_DOC,
  OLD_NAME_DOC,
  sanitizePostgrestValueMock,
  toastSuccess,
  toastError,
  debugError,
  mockFrom,
  mockRpc,
  builderMethods,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: "u1", email: "user@test.co" },
    session: { user: { id: "u1" } },
    isLoading: false,
  };

  const DOCUMENT_ROWS = [
    {
      id: "doc-1",
      name: "Guide RH",
      description: "Procédure accueil",
      mime_type: "application/pdf",
      tags: ["rh", "onboarding"],
      created_by: "u1",
      created_at: "2024-01-10T10:00:00.000Z",
      deleted_at: null,
      is_hard_deleted: false,
      creator: { id: "u1", nom: "Doe", prenom: "Jane", avatar_url: null },
      relations: [
        {
          id: "rel-1",
          relation_type: "etablissement",
          related_etablissement_id: "eta-1",
          related_tache_id: null,
          related_profile_id: null,
          related_groupe_id: null,
          related_partenaire_id: null,
          etablissement: { id: "eta-1", nom: "Clinique A" },
          tache: null,
          groupe: null,
          partenaire: null,
        },
      ],
    },
    {
      id: "doc-2",
      name: "Contrat",
      description: "Version signée",
      mime_type: "image/png",
      tags: ["legal"],
      created_by: "u2",
      created_at: "2024-01-09T09:00:00.000Z",
      deleted_at: null,
      is_hard_deleted: false,
      creator: { id: "u2", nom: "Smith", prenom: "John", avatar_url: null },
      relations: [],
    },
  ];

  const SINGLE_DOCUMENT = {
    ...DOCUMENT_ROWS[0],
    shares: [
      {
        id: "share-1",
        permission_level: "read",
        shared_at: "2024-01-11T11:00:00.000Z",
        expires_at: null,
        shared_with_user: {
          id: "u2",
          nom: "Smith",
          prenom: "John",
          email: "john@test.co",
          avatar_url: null,
        },
        shared_by_user: {
          id: "u1",
          nom: "Doe",
          prenom: "Jane",
        },
      },
    ],
  };

  const RELATION_ROWS = [{ document_id: "doc-1" }, { document_id: "doc-2" }, { document_id: "doc-1" }];
  const OLD_TAGS_DOC = { tags: ["old", "archive"] };
  const OLD_NAME_DOC = { name: "Ancien nom" };

  const sanitizePostgrestValueMock = vi.fn((value: string) => `safe-${value}`);
  const toastSuccess = vi.fn();
  const toastError = vi.fn();
  const debugError = vi.fn();

  const mockFrom = vi.fn();
  const mockRpc = vi.fn();

  const builderMethods = {
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    is: vi.fn(),
    or: vi.fn(),
    textSearch: vi.fn(),
    overlaps: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    then: vi.fn(),
    catch: vi.fn(),
  };

  return {
    AUTH_STATE,
    DOCUMENT_ROWS,
    SINGLE_DOCUMENT,
    RELATION_ROWS,
    OLD_TAGS_DOC,
    OLD_NAME_DOC,
    sanitizePostgrestValueMock,
    toastSuccess,
    toastError,
    debugError,
    mockFrom,
    mockRpc,
    builderMethods,
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
  },
}));

vi.mock("@/lib/sanitize", () => ({
  sanitizePostgrestValue: sanitizePostgrestValueMock,
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock("@/lib/debug", () => ({
  debug: {
    error: debugError,
  },
}));

type QueueResponse = { data: unknown; error: { message: string } | null };

function createBuilder(response: QueueResponse) {
  const builder = {
    select: vi.fn((...args: unknown[]) => {
      builderMethods.select(...args);
      return builder;
    }),
    eq: vi.fn((...args: unknown[]) => {
      builderMethods.eq(...args);
      return builder;
    }),
    gte: vi.fn((...args: unknown[]) => {
      builderMethods.gte(...args);
      return builder;
    }),
    lte: vi.fn((...args: unknown[]) => {
      builderMethods.lte(...args);
      return builder;
    }),
    in: vi.fn((...args: unknown[]) => {
      builderMethods.in(...args);
      return builder;
    }),
    order: vi.fn((...args: unknown[]) => {
      builderMethods.order(...args);
      return builder;
    }),
    limit: vi.fn((...args: unknown[]) => {
      builderMethods.limit(...args);
      return builder;
    }),
    is: vi.fn((...args: unknown[]) => {
      builderMethods.is(...args);
      return builder;
    }),
    or: vi.fn((...args: unknown[]) => {
      builderMethods.or(...args);
      return builder;
    }),
    textSearch: vi.fn((...args: unknown[]) => {
      builderMethods.textSearch(...args);
      return builder;
    }),
    overlaps: vi.fn((...args: unknown[]) => {
      builderMethods.overlaps(...args);
      return builder;
    }),
    insert: vi.fn((...args: unknown[]) => {
      builderMethods.insert(...args);
      return builder;
    }),
    update: vi.fn((...args: unknown[]) => {
      builderMethods.update(...args);
      return builder;
    }),
    delete: vi.fn((...args: unknown[]) => {
      builderMethods.delete(...args);
      return builder;
    }),
    single: vi.fn(async (...args: unknown[]) => {
      builderMethods.single(...args);
      return response;
    }),
    maybeSingle: vi.fn(async (...args: unknown[]) => {
      builderMethods.maybeSingle(...args);
      return response;
    }),
    then: (onFulfilled?: (value: QueueResponse) => unknown, onRejected?: (reason: unknown) => unknown) => {
      builderMethods.then(onFulfilled, onRejected);
      return Promise.resolve(response).then(onFulfilled, onRejected);
    },
    catch: (onRejected?: (reason: unknown) => unknown) => {
      builderMethods.catch(onRejected);
      return Promise.resolve(response).catch(onRejected);
    },
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

describe("useDocuments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("charge puis retourne les documents filtrés avec les bonnes clauses de requête", async () => {
    const relationBuilder = createBuilder({ data: RELATION_ROWS, error: null });
    const docsBuilder = createBuilder({ data: DOCUMENT_ROWS, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "document_relations") return relationBuilder;
      if (table === "documents") return docsBuilder;
      return createBuilder({ data: null, error: null });
    });

    const filters = {
      relatedEtablissementId: "eta-1",
      search: "contrat",
      mimeTypes: ["application/pdf"],
      tags: ["rh"],
      createdBy: "u1",
      dateFrom: "2024-01-01",
      dateTo: "2024-01-31",
      showDeleted: false,
    };

    const { result } = renderHook(
      () => useDocuments(filters, { field: "created_at", order: "desc" }, 10),
      { wrapper: createWrapper() }
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(DOCUMENT_ROWS);
    expect(result.current.data?.[0]?.name).toBe("Guide RH");
    expect(result.current.data?.[1]?.mime_type).toBe("image/png");
    expect(mockFrom).toHaveBeenNthCalledWith(1, "document_relations");
    expect(mockFrom).toHaveBeenNthCalledWith(2, "documents");
    expect(builderMethods.eq).toHaveBeenCalledWith("related_etablissement_id", "eta-1");
    expect(builderMethods.in).toHaveBeenCalledWith("id", ["doc-1", "doc-2"]);
    expect(builderMethods.is).toHaveBeenCalledWith("deleted_at", null);
    // La recherche passe par la colonne engendrée `recherche`, qui couvre le
    // CORPS des pages en plus du titre et de la description. Le ILIKE
    // précédent ne voyait ni le contenu ni les accents : sur un wiki, il
    // rendait 0 résultat pour un mot lu dans une page.
    expect(builderMethods.textSearch).toHaveBeenCalledWith(
      "recherche",
      "contrat",
      // La configuration est NOMMÉE : sans elle, PostgREST emploie
      // `pg_catalog.english` alors que la colonne est construite en français
      // sans accents. Les radicaux coïncident pour certains mots et divergent
      // pour d'autres — « ergonomie » donne `ergonomi` contre `ergonom` —, si
      // bien que la recherche marche un mot sur deux, sans jamais d'erreur.
      { type: "websearch", config: "francais_sans_accent" },
    );
    // Et il ne reste plus de ILIKE sur le nom : le laisser en parallèle aurait
    // masqué une recherche plein texte inopérante derrière des résultats de
    // repli.
    expect(builderMethods.or).not.toHaveBeenCalledWith(
      expect.stringContaining("name.ilike"),
    );
    expect(builderMethods.in).toHaveBeenCalledWith("mime_type", ["application/pdf"]);
    expect(builderMethods.overlaps).toHaveBeenCalledWith("tags", ["rh"]);
    expect(builderMethods.eq).toHaveBeenCalledWith("created_by", "u1");
    expect(builderMethods.gte).toHaveBeenCalledWith("created_at", "2024-01-01");
    expect(builderMethods.lte).toHaveBeenCalledWith("created_at", "2024-01-31");
    expect(builderMethods.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(builderMethods.limit).toHaveBeenCalledWith(10);
  });

  it("passe en erreur quand la requête documents échoue", async () => {
    const docsBuilder = createBuilder({ data: null, error: { message: "boom" } });

    mockFrom.mockImplementation((table: string) => {
      if (table === "documents") return docsBuilder;
      return createBuilder({ data: null, error: null });
    });

    const { result } = renderHook(() => useDocuments(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("boom");
  });
});

describe("useDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne un document unique avec ses shares", async () => {
    const docsBuilder = createBuilder({ data: SINGLE_DOCUMENT, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "documents") return docsBuilder;
      return createBuilder({ data: null, error: null });
    });

    const { result } = renderHook(() => useDocument("doc-1"), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(SINGLE_DOCUMENT);
    expect(result.current.data?.shares?.[0]?.permission_level).toBe("read");
    expect(result.current.data?.creator?.nom).toBe("Doe");
    expect(builderMethods.eq).toHaveBeenCalledWith("id", "doc-1");
    expect(builderMethods.maybeSingle).toHaveBeenCalled();
  });

  it("retourne en erreur si maybeSingle renvoie une erreur", async () => {
    const docsBuilder = createBuilder({ data: null, error: { message: "not-found" } });

    mockFrom.mockImplementation((table: string) => {
      if (table === "documents") return docsBuilder;
      return createBuilder({ data: null, error: null });
    });

    const { result } = renderHook(() => useDocument("doc-404"), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("not-found");
  });
});

describe("useDocumentsByEntity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("récupère les documents liés à une entité", async () => {
    const relationBuilder = createBuilder({ data: RELATION_ROWS, error: null });
    const docsBuilder = createBuilder({ data: DOCUMENT_ROWS, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "document_relations") return relationBuilder;
      if (table === "documents") return docsBuilder;
      return createBuilder({ data: null, error: null });
    });

    const { result } = renderHook(() => useDocumentsByEntity("etablissement", "eta-1"), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(DOCUMENT_ROWS);
    expect(result.current.data?.map((doc) => doc.id)).toEqual(["doc-1", "doc-2"]);
    expect(builderMethods.eq).toHaveBeenCalledWith("related_etablissement_id", "eta-1");
    expect(builderMethods.in).toHaveBeenCalledWith("id", ["doc-1", "doc-2", "doc-1"]);
    expect(builderMethods.is).toHaveBeenCalledWith("deleted_at", null);
    expect(builderMethods.eq).toHaveBeenCalledWith("is_hard_deleted", false);
    expect(builderMethods.order).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("passe en erreur si la requête de relations échoue", async () => {
    const relationBuilder = createBuilder({ data: null, error: { message: "rel-error" } });

    mockFrom.mockImplementation((table: string) => {
      if (table === "document_relations") return relationBuilder;
      return createBuilder({ data: null, error: null });
    });

    const { result } = renderHook(() => useDocumentsByEntity("tache", "task-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("rel-error");
  });
});

describe("mutations documents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("useDeleteDocument soft delete puis log audit", async () => {
    const docsBuilder = createBuilder({ data: null, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "documents") return docsBuilder;
      return createBuilder({ data: null, error: null });
    });
    mockRpc.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useDeleteDocument(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync("doc-1");
    });

    expect(mockFrom).toHaveBeenCalledWith("documents");
    expect(builderMethods.update).toHaveBeenCalledTimes(1);
    expect(builderMethods.update.mock.calls[0]?.[0]).toMatchObject({
      deleted_by: "u1",
    });
    expect(typeof builderMethods.update.mock.calls[0]?.[0]?.deleted_at).toBe("string");
    expect(builderMethods.eq).toHaveBeenCalledWith("id", "doc-1");
    expect(mockRpc).toHaveBeenCalledWith("log_document_audit", {
      p_document_id: "doc-1",
      p_action: "deleted",
    });
    expect(toastSuccess).toHaveBeenCalledWith("Document supprimé");
  });

  it("useRestoreDocument restaure puis log audit", async () => {
    const docsBuilder = createBuilder({ data: null, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "documents") return docsBuilder;
      return createBuilder({ data: null, error: null });
    });
    mockRpc.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useRestoreDocument(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync("doc-1");
    });

    expect(builderMethods.update).toHaveBeenCalledWith({
      deleted_at: null,
      deleted_by: null,
    });
    expect(builderMethods.eq).toHaveBeenCalledWith("id", "doc-1");
    expect(mockRpc).toHaveBeenCalledWith("log_document_audit", {
      p_document_id: "doc-1",
      p_action: "restored",
    });
    expect(toastSuccess).toHaveBeenCalledWith("Document restauré");
  });

  it("useUpdateDocumentTags met à jour les tags et journalise l'ancien et le nouveau contenu", async () => {
    const oldBuilder = createBuilder({ data: OLD_TAGS_DOC, error: null });
    const updateBuilder = createBuilder({ data: null, error: null });

    mockFrom
      .mockImplementationOnce((table: string) => {
        if (table === "documents") return oldBuilder;
        return createBuilder({ data: null, error: null });
      })
      .mockImplementationOnce((table: string) => {
        if (table === "documents") return updateBuilder;
        return createBuilder({ data: null, error: null });
      });

    mockRpc.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useUpdateDocumentTags(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({ documentId: "doc-1", tags: ["finance", "urgent"] });
    });

    expect(builderMethods.update).toHaveBeenCalledWith({ tags: ["finance", "urgent"] });
    expect(mockRpc).toHaveBeenCalledWith("log_document_audit", {
      p_document_id: "doc-1",
      p_action: "tagged",
      p_old_value: { tags: ["old", "archive"] },
      p_new_value: { tags: ["finance", "urgent"] },
    });
    expect(toastSuccess).toHaveBeenCalledWith("Tags mis à jour");
  });

  it("useRenameDocument renomme le document et journalise l'ancien nom", async () => {
    const oldBuilder = createBuilder({ data: OLD_NAME_DOC, error: null });
    const updateBuilder = createBuilder({ data: null, error: null });

    mockFrom
      .mockImplementationOnce((table: string) => {
        if (table === "documents") return oldBuilder;
        return createBuilder({ data: null, error: null });
      })
      .mockImplementationOnce((table: string) => {
        if (table === "documents") return updateBuilder;
        return createBuilder({ data: null, error: null });
      });

    mockRpc.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useRenameDocument(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({ id: "doc-1", newName: "Nouveau titre" });
    });

    expect(builderMethods.update).toHaveBeenCalledWith({ name: "Nouveau titre" });
    expect(mockRpc).toHaveBeenCalledWith("log_document_audit", {
      p_document_id: "doc-1",
      p_action: "renamed",
      p_old_value: { name: "Ancien nom" },
      p_new_value: { name: "Nouveau titre" },
    });
    expect(toastSuccess).toHaveBeenCalledWith("Document renommé");
  });

  it("useAddDocumentRelation insère la relation avec created_by puis log audit", async () => {
    const relationBuilder = createBuilder({ data: null, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "document_relations") return relationBuilder;
      return createBuilder({ data: null, error: null });
    });
    mockRpc.mockResolvedValue({ data: null, error: null });

    const relation = {
      document_id: "doc-1",
      relation_type: "etablissement",
      related_etablissement_id: "eta-1",
      related_tache_id: null,
      related_profile_id: null,
      related_groupe_id: null,
      related_partenaire_id: null,
    };

    const { result } = renderHook(() => useAddDocumentRelation(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync(relation);
    });

    expect(builderMethods.insert).toHaveBeenCalledWith({
      ...relation,
      created_by: "u1",
    });
    expect(mockRpc).toHaveBeenCalledWith("log_document_audit", {
      p_document_id: "doc-1",
      p_action: "relation_added",
      p_new_value: relation,
    });
    expect(toastSuccess).toHaveBeenCalledWith("Relation ajoutée");
  });

  it("passe en erreur sur suppression si update échoue", async () => {
    const docsBuilder = createBuilder({ data: null, error: { message: "delete-failed" } });

    mockFrom.mockImplementation((table: string) => {
      if (table === "documents") return docsBuilder;
      return createBuilder({ data: null, error: null });
    });

    const { result } = renderHook(() => useDeleteDocument(), { wrapper: createWrapper() });

    await act(async () => {
      await expect(result.current.mutateAsync("doc-1")).rejects.toMatchObject({ message: "delete-failed" });
    });

    expect(debugError).toHaveBeenCalledWith(
      "Erreur suppression document:",
      expect.objectContaining({ message: "delete-failed" })
    );
    expect(toastError).toHaveBeenCalledWith("Erreur lors de la suppression");
  });
});