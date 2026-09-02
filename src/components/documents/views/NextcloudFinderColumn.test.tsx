/* @vitest-environment jsdom */
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent, act, cleanup, renderHook } from "@testing-library/react";
import { NextcloudFinderColumn } from "./NextcloudFinderColumn";
import { useNextcloudFolderContents } from "@/hooks/documents/useNextcloudFolderTree";

const {
  FOLDER_A,
  FOLDER_B,
  FILE_PDF,
  FILE_IMG,
  DATA_SUCCESS,
  DATA_EMPTY,
  AUTH_STATE,
  LOADING_RESULT,
  SUCCESS_RESULT,
  ERROR_RESULT,
  mockUseNextcloudFolderContents,
  mockMatchMediaAdd,
  mockMatchMediaRemove,
} = vi.hoisted(() => {
  const FOLDER_A = { path: "/docs/projects", name: "projects", type: "folder" as const };
  const FOLDER_B = { path: "/docs/archive", name: "archive", type: "folder" as const };
  const FILE_PDF = { path: "/docs/readme.pdf", name: "readme.pdf", type: "file" as const };
  const FILE_IMG = { path: "/docs/photo.jpg", name: "photo.jpg", type: "file" as const };
  const DATA_SUCCESS = {
    folders: [FOLDER_A, FOLDER_B],
    files: [FILE_PDF, FILE_IMG],
  };
  const DATA_EMPTY = {
    folders: [],
    files: [],
  };
  const AUTH_STATE = {
    user: { id: "u1", email: "t@t.co" },
    session: { user: { id: "u1" } },
    isLoading: false,
  };
  const LOADING_RESULT = {
    data: undefined,
    isLoading: true,
    isError: false,
    error: null,
  };
  const SUCCESS_RESULT = {
    data: DATA_SUCCESS,
    isLoading: false,
    isError: false,
    error: null,
  };
  const ERROR_RESULT = {
    data: null,
    isLoading: false,
    isError: true,
    error: { message: "x" },
  };

  return {
    FOLDER_A,
    FOLDER_B,
    FILE_PDF,
    FILE_IMG,
    DATA_SUCCESS,
    DATA_EMPTY,
    AUTH_STATE,
    LOADING_RESULT,
    SUCCESS_RESULT,
    ERROR_RESULT,
    mockUseNextcloudFolderContents: vi.fn(),
    mockMatchMediaAdd: vi.fn(),
    mockMatchMediaRemove: vi.fn(),
  };
});

vi.mock("@/hooks/documents/useNextcloudFolderTree", () => ({
  useNextcloudFolderContents: mockUseNextcloudFolderContents,
}));

vi.mock("@/lib/utils", () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="scroll-area" className={className}>
      {children}
    </div>
  ),
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

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("NextcloudFinderColumn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: true,
        media: "(hover: hover) and (pointer: fine)",
        onchange: null,
        addEventListener: mockMatchMediaAdd,
        removeEventListener: mockMatchMediaRemove,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    mockUseNextcloudFolderContents.mockReturnValue(SUCCESS_RESULT);
  });

  afterEach(() => {
    cleanup();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("gère le hook mocké dans un QueryClientProvider: loading puis succès puis erreur", () => {
    const wrapper = createWrapper();
    let currentResult = LOADING_RESULT;

    mockUseNextcloudFolderContents.mockImplementation(() => currentResult);

    const { result, rerender } = renderHook(() => useNextcloudFolderContents("/docs"), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
    expect(mockUseNextcloudFolderContents).toHaveBeenCalledWith("/docs");

    currentResult = SUCCESS_RESULT;
    rerender();

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.data).toEqual(DATA_SUCCESS);
    expect(result.current.data.folders).toHaveLength(2);
    expect(result.current.data.files).toHaveLength(2);
    expect(result.current.data.folders[0].name).toBe("projects");
    expect(result.current.data.files[0].name).toBe("readme.pdf");

    currentResult = ERROR_RESULT;
    rerender();

    expect(result.current.isError).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toEqual({ message: "x" });
  });

  it("affiche un loader pendant le chargement", () => {
    mockUseNextcloudFolderContents.mockReturnValue(LOADING_RESULT);

    const { container } = render(
      <NextcloudFinderColumn
        path="/docs"
        selectedId={null}
        selectedType={null}
        onSelectFolder={vi.fn()}
        onSelectFile={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    expect(container.querySelector("svg")).toBeTruthy();
    expect(screen.queryByText("Dossier vide")).not.toBeInTheDocument();
    expect(screen.queryByText("projects")).not.toBeInTheDocument();
  });

  it("affiche les dossiers et fichiers avec leurs valeurs métier réelles", () => {
    render(
      <NextcloudFinderColumn
        path="/docs"
        selectedId="/docs/projects"
        selectedType="folder"
        onSelectFolder={vi.fn()}
        onSelectFile={vi.fn()}
        isActive={true}
        selectedIndex={0}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText("projects")).toBeInTheDocument();
    expect(screen.getByText("archive")).toBeInTheDocument();
    expect(screen.getByText("readme.pdf")).toBeInTheDocument();
    expect(screen.getByText("photo.jpg")).toBeInTheDocument();
    expect(screen.queryByText("Dossier vide")).not.toBeInTheDocument();

    const scrollArea = screen.getByTestId("scroll-area");
    expect(scrollArea.className).toContain("bg-muted/5");
  });

  it("affiche l'état dossier vide quand il n'y a aucun élément", () => {
    mockUseNextcloudFolderContents.mockReturnValue({
      data: DATA_EMPTY,
      isLoading: false,
      isError: false,
      error: null,
    });

    render(
      <NextcloudFinderColumn
        path="/empty"
        selectedId={null}
        selectedType={null}
        onSelectFolder={vi.fn()}
        onSelectFile={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText("Dossier vide")).toBeInTheDocument();
    expect(screen.queryByText("projects")).not.toBeInTheDocument();
    expect(screen.queryByText("readme.pdf")).not.toBeInTheDocument();
  });

  it("déclenche la sélection commit d'un dossier au clic", async () => {
    const onSelectFolder = vi.fn();
    const onSelectFile = vi.fn();

    render(
      <NextcloudFinderColumn
        path="/docs"
        selectedId={null}
        selectedType={null}
        onSelectFolder={onSelectFolder}
        onSelectFile={onSelectFile}
      />,
      { wrapper: createWrapper() }
    );

    await act(async () => {
      fireEvent.click(screen.getByText("projects"));
    });

    expect(onSelectFolder).toHaveBeenCalledTimes(1);
    expect(onSelectFolder).toHaveBeenCalledWith(FOLDER_A, "commit");
    expect(onSelectFile).not.toHaveBeenCalled();
  });

  it("déclenche la sélection d'un fichier au clic", async () => {
    const onSelectFolder = vi.fn();
    const onSelectFile = vi.fn();

    render(
      <NextcloudFinderColumn
        path="/docs"
        selectedId={null}
        selectedType={null}
        onSelectFolder={onSelectFolder}
        onSelectFile={onSelectFile}
      />,
      { wrapper: createWrapper() }
    );

    await act(async () => {
      fireEvent.click(screen.getByText("readme.pdf"));
    });

    expect(onSelectFile).toHaveBeenCalledTimes(1);
    expect(onSelectFile).toHaveBeenCalledWith(FILE_PDF);
    expect(onSelectFolder).not.toHaveBeenCalled();
  });

  it("déclenche le hover dossier après 150ms sur appareil compatible hover", async () => {
    const onSelectFolder = vi.fn();

    render(
      <NextcloudFinderColumn
        path="/docs"
        selectedId={null}
        selectedType={null}
        onSelectFolder={onSelectFolder}
        onSelectFile={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    await act(async () => {
      fireEvent.mouseEnter(screen.getByText("archive"));
      vi.advanceTimersByTime(149);
    });

    expect(onSelectFolder).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(onSelectFolder).toHaveBeenCalledWith(FOLDER_B, "hover");
  });

  it("annule le hover dossier si la souris quitte avant le délai", async () => {
    const onSelectFolder = vi.fn();

    render(
      <NextcloudFinderColumn
        path="/docs"
        selectedId={null}
        selectedType={null}
        onSelectFolder={onSelectFolder}
        onSelectFile={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    const folderNode = screen.getByText("projects");

    await act(async () => {
      fireEvent.mouseEnter(folderNode);
      fireEvent.mouseLeave(folderNode);
      vi.advanceTimersByTime(200);
    });

    expect(onSelectFolder).not.toHaveBeenCalled();
  });

  it("déclenche le hover fichier après 100ms", async () => {
    const onHoverFile = vi.fn();

    render(
      <NextcloudFinderColumn
        path="/docs"
        selectedId={null}
        selectedType={null}
        onSelectFolder={vi.fn()}
        onSelectFile={vi.fn()}
        onHoverFile={onHoverFile}
      />,
      { wrapper: createWrapper() }
    );

    await act(async () => {
      fireEvent.mouseEnter(screen.getByText("photo.jpg"));
      vi.advanceTimersByTime(99);
    });

    expect(onHoverFile).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(onHoverFile).toHaveBeenCalledTimes(1);
    expect(onHoverFile).toHaveBeenCalledWith(FILE_IMG);
  });

  it("ne déclenche pas le hover fichier si onHoverFile est absent", async () => {
    render(
      <NextcloudFinderColumn
        path="/docs"
        selectedId={null}
        selectedType={null}
        onSelectFolder={vi.fn()}
        onSelectFile={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    await act(async () => {
      fireEvent.mouseEnter(screen.getByText("photo.jpg"));
      vi.advanceTimersByTime(150);
    });

    expect(screen.getByText("photo.jpg")).toBeInTheDocument();
  });

  it("désactive les comportements de hover sur appareil sans support hover", async () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: "(hover: hover) and (pointer: fine)",
        onchange: null,
        addEventListener: mockMatchMediaAdd,
        removeEventListener: mockMatchMediaRemove,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    const onSelectFolder = vi.fn();
    const onHoverFile = vi.fn();

    render(
      <NextcloudFinderColumn
        path="/docs"
        selectedId={null}
        selectedType={null}
        onSelectFolder={onSelectFolder}
        onSelectFile={vi.fn()}
        onHoverFile={onHoverFile}
      />,
      { wrapper: createWrapper() }
    );

    await act(async () => {
      fireEvent.mouseEnter(screen.getByText("projects"));
      fireEvent.mouseEnter(screen.getByText("readme.pdf"));
      vi.advanceTimersByTime(200);
    });

    expect(onSelectFolder).not.toHaveBeenCalled();
    expect(onHoverFile).not.toHaveBeenCalled();
  });
});