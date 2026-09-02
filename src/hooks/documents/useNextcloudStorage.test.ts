import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { format } from "date-fns";
import {
  useNextcloudUpload,
  useNextcloudDelete,
  useNextcloudMove,
  useNextcloudCreateFolder,
  getNextcloudDownloadUrl,
  downloadNextcloudFile,
} from "./useNextcloudStorage";

const { mockInvoke, mockToastSuccess, mockToastError, mockDebugError } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockDebugError: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: mockInvoke },
    from: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock("@/lib/debug", () => ({
  debug: {
    error: mockDebugError,
    log: vi.fn(),
    warn: vi.fn(),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

const FIXED_UUID = "11111111-2222-3333-4444-555555555555" as const;

beforeEach(() => {
  vi.clearAllMocks();
  if (typeof globalThis.crypto.randomUUID !== "function") {
    Object.defineProperty(globalThis.crypto, "randomUUID", {
      value: () => FIXED_UUID,
      configurable: true,
      writable: true,
    });
  }
  vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(FIXED_UUID);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useNextcloudUpload", () => {
  it("uploade un fichier converti en base64 avec le bon chemin et invalide le cache", async () => {
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });
    const { result } = renderHook(() => useNextcloudUpload(), { wrapper: createWrapper() });

    const file = new File(["hello"], "test.txt", { type: "text/plain" });
    let uploadResult: { path: string } | undefined;

    await act(async () => {
      uploadResult = await result.current.mutateAsync({ file });
    });

    const dateFolder = format(new Date(), "yyyy-MM");
    const expectedPath = `/${dateFolder}/${FIXED_UUID}.txt`;

    expect(uploadResult?.path).toBe(expectedPath);
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith("nextcloud-files", {
      body: {
        action: "upload",
        path: expectedPath,
        content: "aGVsbG8=",
        contentType: "text/plain",
      },
    });
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it("préfixe le chemin avec folderPath quand fourni", async () => {
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });
    const { result } = renderHook(() => useNextcloudUpload(), { wrapper: createWrapper() });

    const file = new File(["abc"], "doc.pdf", { type: "application/pdf" });

    await act(async () => {
      await result.current.mutateAsync({ file, folderPath: "/projets" });
    });

    const dateFolder = format(new Date(), "yyyy-MM");
    expect(mockInvoke).toHaveBeenCalledWith("nextcloud-files", {
      body: {
        action: "upload",
        path: `/projets/${dateFolder}/${FIXED_UUID}.pdf`,
        content: "YWJj",
        contentType: "application/pdf",
      },
    });
  });

  it("affiche un toast d'erreur quand l'edge function renvoie une erreur", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: "x" } });
    const { result } = renderHook(() => useNextcloudUpload(), { wrapper: createWrapper() });

    const file = new File(["err"], "fail.txt", { type: "text/plain" });

    await act(async () => {
      await expect(result.current.mutateAsync({ file })).rejects.toEqual({ message: "x" });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(mockToastError).toHaveBeenCalledWith("Erreur lors de l'upload vers Nextcloud");
    expect(mockDebugError).toHaveBeenCalled();
  });

  it("rejette quand data.error est présent dans la réponse", async () => {
    mockInvoke.mockResolvedValue({ data: { error: "quota dépassé" }, error: null });
    const { result } = renderHook(() => useNextcloudUpload(), { wrapper: createWrapper() });

    const file = new File(["err"], "fail.txt", { type: "text/plain" });

    await act(async () => {
      await expect(result.current.mutateAsync({ file })).rejects.toThrow("quota dépassé");
    });

    expect(mockToastError).toHaveBeenCalledWith("Erreur lors de l'upload vers Nextcloud");
  });
});

describe("useNextcloudDelete", () => {
  it("supprime un fichier et affiche un toast de succès", async () => {
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });
    const { result } = renderHook(() => useNextcloudDelete(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync("/2024-01/file.txt");
    });

    expect(mockInvoke).toHaveBeenCalledWith("nextcloud-files", {
      body: { action: "delete", path: "/2024-01/file.txt" },
    });
    expect(mockToastSuccess).toHaveBeenCalledWith("Fichier supprimé de Nextcloud");
  });

  it("affiche un toast d'erreur en cas d'échec", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: "x" } });
    const { result } = renderHook(() => useNextcloudDelete(), { wrapper: createWrapper() });

    await act(async () => {
      await expect(result.current.mutateAsync("/bad.txt")).rejects.toEqual({ message: "x" });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(mockToastError).toHaveBeenCalledWith("Erreur lors de la suppression");
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });
});

describe("useNextcloudMove", () => {
  it("déplace un fichier avec source et destination", async () => {
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });
    const { result } = renderHook(() => useNextcloudMove(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({
        sourcePath: "/a/old.txt",
        destinationPath: "/b/new.txt",
      });
    });

    expect(mockInvoke).toHaveBeenCalledWith("nextcloud-files", {
      body: { action: "move", path: "/a/old.txt", destinationPath: "/b/new.txt" },
    });
    expect(mockToastSuccess).toHaveBeenCalledWith("Fichier déplacé");
  });

  it("affiche un toast d'erreur si le déplacement échoue", async () => {
    mockInvoke.mockResolvedValue({ data: { error: "conflit" }, error: null });
    const { result } = renderHook(() => useNextcloudMove(), { wrapper: createWrapper() });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ sourcePath: "/a", destinationPath: "/b" })
      ).rejects.toThrow("conflit");
    });

    expect(mockToastError).toHaveBeenCalledWith("Erreur lors du déplacement");
  });
});

describe("useNextcloudCreateFolder", () => {
  it("crée un dossier et affiche un toast de succès", async () => {
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });
    const { result } = renderHook(() => useNextcloudCreateFolder(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync("/nouveau-dossier");
    });

    expect(mockInvoke).toHaveBeenCalledWith("nextcloud-files", {
      body: { action: "mkdir", path: "/nouveau-dossier" },
    });
    expect(mockToastSuccess).toHaveBeenCalledWith("Dossier créé");
  });

  it("affiche un toast d'erreur si la création échoue", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: "x" } });
    const { result } = renderHook(() => useNextcloudCreateFolder(), { wrapper: createWrapper() });

    await act(async () => {
      await expect(result.current.mutateAsync("/ko")).rejects.toEqual({ message: "x" });
    });

    expect(mockToastError).toHaveBeenCalledWith("Erreur lors de la création du dossier");
  });
});

describe("getNextcloudDownloadUrl", () => {
  it("retourne l'URL de téléchargement renvoyée par l'edge function", async () => {
    mockInvoke.mockResolvedValue({
      data: { url: "https://cloud.example.com/dl/file.txt" },
      error: null,
    });

    const url = await getNextcloudDownloadUrl("/2024-01/file.txt");

    expect(url).toBe("https://cloud.example.com/dl/file.txt");
    expect(mockInvoke).toHaveBeenCalledWith("nextcloud-files", {
      body: { action: "download-url", path: "/2024-01/file.txt" },
    });
  });

  it("rejette si l'edge function renvoie une erreur", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: "x" } });

    await expect(getNextcloudDownloadUrl("/ko")).rejects.toEqual({ message: "x" });
  });

  it("rejette si data.error est présent", async () => {
    mockInvoke.mockResolvedValue({ data: { error: "introuvable" }, error: null });

    await expect(getNextcloudDownloadUrl("/ko")).rejects.toThrow("introuvable");
  });
});

describe("downloadNextcloudFile", () => {
  it("décode le contenu base64 en Blob avec le bon mimeType", async () => {
    mockInvoke.mockResolvedValue({
      data: { content: btoa("hi"), mimeType: "text/plain" },
      error: null,
    });

    const { content, mimeType } = await downloadNextcloudFile("/2024-01/file.txt");

    expect(mimeType).toBe("text/plain");
    expect(content).toBeInstanceOf(Blob);
    expect(content.size).toBe(2);
    expect(content.type).toBe("text/plain");
    expect(mockInvoke).toHaveBeenCalledWith("nextcloud-files", {
      body: { action: "download", path: "/2024-01/file.txt" },
    });
  });

  it("rejette si l'edge function renvoie une erreur", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: "x" } });

    await expect(downloadNextcloudFile("/ko")).rejects.toEqual({ message: "x" });
  });
});