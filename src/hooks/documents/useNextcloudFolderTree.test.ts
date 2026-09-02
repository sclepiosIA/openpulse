import React from "react";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useNextcloudFolderTree,
  useNextcloudFolderContents,
  getNextcloudPathFromId,
  createNextcloudFolderId,
  isNextcloudFolderId,
} from "./useNextcloudFolderTree";

const { ROOT_FILES, FOLDER_CONTENTS, mockInvoke, mockFrom } = vi.hoisted(() => {
  const ROOT_FILES = [
    {
      name: "Documents",
      path: "/Documents",
      isDirectory: true,
      size: 0,
      lastModified: "2024-01-01T00:00:00Z",
      mimeType: "httpd/unix-directory",
    },
    {
      name: "Photos",
      path: "/Photos",
      isDirectory: true,
      size: 0,
      lastModified: "2024-01-02T00:00:00Z",
      mimeType: "httpd/unix-directory",
    },
    {
      name: "readme.txt",
      path: "/readme.txt",
      isDirectory: false,
      size: 123,
      lastModified: "2024-01-03T00:00:00Z",
      mimeType: "text/plain",
    },
  ];
  const FOLDER_CONTENTS = [
    {
      name: "zebra",
      path: "/Documents/zebra",
      isDirectory: true,
      size: 0,
      lastModified: "2024-01-01T00:00:00Z",
      mimeType: "httpd/unix-directory",
    },
    {
      name: "alpha",
      path: "/Documents/alpha",
      isDirectory: true,
      size: 0,
      lastModified: "2024-01-01T00:00:00Z",
      mimeType: "httpd/unix-directory",
    },
    {
      name: "notes.md",
      path: "/Documents/notes.md",
      isDirectory: false,
      size: 42,
      lastModified: "2024-01-01T00:00:00Z",
      mimeType: "text/markdown",
    },
    {
      name: "budget.xlsx",
      path: "/Documents/budget.xlsx",
      isDirectory: false,
      size: 999,
      lastModified: "2024-01-01T00:00:00Z",
      mimeType: "application/vnd.ms-excel",
    },
  ];
  return {
    ROOT_FILES,
    FOLDER_CONTENTS,
    mockInvoke: vi.fn(),
    mockFrom: vi.fn(),
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
    functions: { invoke: mockInvoke },
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0, retryDelay: 1 },
      mutations: { retry: 0 },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useNextcloudFolderTree", () => {
  it("démarre en chargement puis construit l'arbre avec uniquement les dossiers", async () => {
    mockInvoke.mockResolvedValue({ data: ROOT_FILES, error: null });

    const { result } = renderHook(() => useNextcloudFolderTree(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.tree).toEqual([]);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockInvoke).toHaveBeenCalledWith("nextcloud-files", {
      body: { action: "list", path: "/" },
    });

    expect(result.current.tree).toHaveLength(2);
    expect(result.current.tree[0]).toMatchObject({
      id: "nextcloud:/Documents",
      name: "Documents",
      parentId: null,
      folderType: "personal",
      isExpanded: false,
      nextcloudPath: "/Documents",
      isNextcloud: true,
    });
    expect(result.current.tree[1].id).toBe("nextcloud:/Photos");
    expect(result.current.tree.map((n) => n.name)).toEqual(["Documents", "Photos"]);
  });

  it("toggleExpand inverse l'état d'expansion d'un nœud", async () => {
    mockInvoke.mockResolvedValue({ data: ROOT_FILES, error: null });

    const { result } = renderHook(() => useNextcloudFolderTree(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.toggleExpand("nextcloud:/Documents");
    });
    expect(result.current.expandedIds.has("nextcloud:/Documents")).toBe(true);
    expect(result.current.tree[0].isExpanded).toBe(true);
    expect(result.current.tree[1].isExpanded).toBe(false);

    await act(async () => {
      result.current.toggleExpand("nextcloud:/Documents");
    });
    expect(result.current.expandedIds.has("nextcloud:/Documents")).toBe(false);
    expect(result.current.tree[0].isExpanded).toBe(false);
  });

  it("expandAll et collapseAll mettent à jour tous les nœuds", async () => {
    mockInvoke.mockResolvedValue({ data: ROOT_FILES, error: null });

    const { result } = renderHook(() => useNextcloudFolderTree(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.tree).toHaveLength(2));

    await act(async () => {
      result.current.expandAll();
    });
    expect(result.current.expandedIds.size).toBe(2);
    expect(result.current.tree.every((n) => n.isExpanded)).toBe(true);

    await act(async () => {
      result.current.collapseAll();
    });
    expect(result.current.expandedIds.size).toBe(0);
    expect(result.current.tree.every((n) => n.isExpanded === false)).toBe(true);
  });

  it("expose une erreur quand l'edge function échoue", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: "x" } });

    const { result } = renderHook(() => useNextcloudFolderTree(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.error).not.toBeNull(), {
      timeout: 8000,
    });
    expect(result.current.tree).toEqual([]);
  }, 10000);

  it("lève une erreur quand data.error est présent dans la réponse", async () => {
    mockInvoke.mockResolvedValue({ data: { error: "accès refusé" }, error: null });

    const { result } = renderHook(() => useNextcloudFolderTree(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.error).not.toBeNull(), {
      timeout: 8000,
    });
    expect((result.current.error as Error).message).toBe("accès refusé");
  }, 10000);
});

describe("useNextcloudFolderContents", () => {
  it("sépare et trie les dossiers et fichiers", async () => {
    mockInvoke.mockResolvedValue({ data: FOLDER_CONTENTS, error: null });

    const { result } = renderHook(() => useNextcloudFolderContents("/Documents"), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockInvoke).toHaveBeenCalledWith("nextcloud-files", {
      body: { action: "list", path: "/Documents" },
    });

    expect(result.current.data?.folders.map((f) => f.name)).toEqual(["alpha", "zebra"]);
    expect(result.current.data?.files.map((f) => f.name)).toEqual(["budget.xlsx", "notes.md"]);
    expect(result.current.data?.folders[0].path).toBe("/Documents/alpha");
  });

  it("retourne des listes vides quand data est null", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useNextcloudFolderContents("/Vide"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ folders: [], files: [] });
  });

  it("passe en erreur quand l'invocation échoue", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: "x" } });

    const { result } = renderHook(() => useNextcloudFolderContents("/Documents"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true), {
      timeout: 8000,
    });
    expect(result.current.data).toBeUndefined();
  }, 10000);
});

describe("getNextcloudPathFromId", () => {
  it.each([
    ["nextcloud:/Documents", "/Documents"],
    ["nextcloud:/A/B/C", "/A/B/C"],
    ["nextcloud:", ""],
  ])("extrait le path de %s", (input, expected) => {
    expect(getNextcloudPathFromId(input)).toBe(expected);
  });

  it("retourne null pour un id non Nextcloud", () => {
    expect(getNextcloudPathFromId("folder-123")).toBeNull();
    expect(getNextcloudPathFromId("")).toBeNull();
  });
});

describe("createNextcloudFolderId", () => {
  it.each([
    ["/Documents", "nextcloud:/Documents"],
    ["/", "nextcloud:/"],
    ["", "nextcloud:"],
  ])("crée l'id pour le path %s", (path, expected) => {
    expect(createNextcloudFolderId(path)).toBe(expected);
  });
});

describe("isNextcloudFolderId", () => {
  it.each([
    ["nextcloud:/Documents", true],
    ["nextcloud:", true],
    ["folder-abc", false],
    ["", false],
    [null, false],
  ])("retourne %s → %s", (input, expected) => {
    expect(isNextcloudFolderId(input)).toBe(expected);
  });
});