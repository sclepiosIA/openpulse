/* @vitest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor, renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextcloudBrowser } from "./NextcloudBrowser";

const {
  STATUS_OK,
  STATUS_NOT_CONFIGURED,
  STATUS_DISCONNECTED,
  ROOT_FILES,
  DOCS_FILES,
  EMPTY_FILES,
  DOWNLOAD_RESULT,
  AUTH_STATE,
  mockUseNextcloudStatus,
  mockUseNextcloudFiles,
  mockDownloadNextcloudFile,
  mockToastSuccess,
  mockToastError,
  mockDebugError,
  mockFormatFileSize,
  mockSafeFormat,
  mockRefetch,
  mockCreateObjectURL,
  mockRevokeObjectURL,
} = vi.hoisted(() => ({
  STATUS_OK: { configured: true, connected: true, error: null },
  STATUS_NOT_CONFIGURED: { configured: false, connected: false, error: null },
  STATUS_DISCONNECTED: { configured: true, connected: false, error: "Serveur indisponible" },
  ROOT_FILES: [
    {
      name: "Documents",
      path: "/Documents",
      isDirectory: true,
      mimeType: "httpd/unix-directory",
      size: 0,
      modified: "2024-01-10T00:00:00.000Z",
    },
    {
      name: "rapport.pdf",
      path: "/rapport.pdf",
      isDirectory: false,
      mimeType: "application/pdf",
      size: 2048,
      modified: "2024-02-15T00:00:00.000Z",
    },
  ],
  DOCS_FILES: [
    {
      name: "photo.png",
      path: "/Documents/photo.png",
      isDirectory: false,
      mimeType: "image/png",
      size: 512,
      modified: "2024-03-20T00:00:00.000Z",
    },
  ],
  EMPTY_FILES: [],
  DOWNLOAD_RESULT: {
    content: new Blob(["file-content"], { type: "application/pdf" }),
  },
  AUTH_STATE: {
    user: { id: "u1", email: "t@t.co" },
    session: { user: { id: "u1" } },
    isLoading: false,
  },
  mockUseNextcloudStatus: vi.fn(),
  mockUseNextcloudFiles: vi.fn(),
  mockDownloadNextcloudFile: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockDebugError: vi.fn(),
  mockFormatFileSize: vi.fn(),
  mockSafeFormat: vi.fn(),
  mockRefetch: vi.fn(),
  mockCreateObjectURL: vi.fn(),
  mockRevokeObjectURL: vi.fn(),
}));

vi.mock("@/lib/debug", () => ({
  debug: {
    error: mockDebugError,
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock("@/hooks/documents/useNextcloudFiles", () => ({
  useNextcloudStatus: mockUseNextcloudStatus,
  useNextcloudFiles: mockUseNextcloudFiles,
}));

vi.mock("@/hooks/documents/useNextcloudStorage", () => ({
  downloadNextcloudFile: mockDownloadNextcloudFile,
}));

vi.mock("@/types/documents", () => ({
  formatFileSize: mockFormatFileSize,
}));

vi.mock("@/lib/safeDate", () => ({
  safeFormat: mockSafeFormat,
}));

vi.mock("date-fns/locale", () => ({
  fr: {},
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("lucide-react", () => {
  const icon =
    (name: string) =>
    ({ className }: { className?: string }) =>
      React.createElement("svg", { "data-testid": name, className });
  return {
    Cloud: icon("Cloud"),
    Folder: icon("Folder"),
    File: icon("File"),
    FileText: icon("FileText"),
    Image: icon("Image"),
    FileSpreadsheet: icon("FileSpreadsheet"),
    FileType: icon("FileType"),
    Download: icon("Download"),
    ChevronRight: icon("ChevronRight"),
    RefreshCw: icon("RefreshCw"),
    AlertCircle: icon("AlertCircle"),
    Loader2: icon("Loader2"),
    ArrowLeft: icon("ArrowLeft"),
  };
});

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) =>
    React.createElement("button", { onClick, disabled, ...props }, children),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) =>
    React.createElement("div", props, children),
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) =>
    React.createElement("div", props, children),
}));

vi.mock("@/components/ui/breadcrumb", () => ({
  Breadcrumb: ({ children }: { children: React.ReactNode }) => React.createElement("nav", {}, children),
  BreadcrumbList: ({ children }: { children: React.ReactNode }) => React.createElement("ol", {}, children),
  BreadcrumbItem: ({ children }: { children: React.ReactNode }) => React.createElement("li", {}, children),
  BreadcrumbLink: ({
    children,
    onClick,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
  }) => React.createElement("button", { onClick, className, type: "button" }, children),
  BreadcrumbSeparator: ({ children }: { children: React.ReactNode }) =>
    React.createElement("span", {}, children),
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) =>
    React.createElement("div", props, children),
}));

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: ({ className }: { className?: string }) =>
    React.createElement("div", { "data-testid": "skeleton", className }),
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

describe("NextcloudBrowser", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockFormatFileSize.mockImplementation((size: number) => `${size} octets`);
    mockSafeFormat.mockImplementation((date: string) => `fmt:${date.slice(0, 10)}`);
    mockRefetch.mockResolvedValue(undefined);

    mockUseNextcloudStatus.mockReturnValue({
      data: STATUS_OK,
      isLoading: false,
    });

    mockUseNextcloudFiles.mockImplementation((path: string) => ({
      data: path === "/Documents" ? DOCS_FILES : ROOT_FILES,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
      isRefetching: false,
    }));

    mockDownloadNextcloudFile.mockResolvedValue(DOWNLOAD_RESULT);

    mockCreateObjectURL.mockReturnValue("blob:test-url");
    mockRevokeObjectURL.mockImplementation(() => undefined);

    Object.defineProperty(URL, "createObjectURL", {
      writable: true,
      value: mockCreateObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      writable: true,
      value: mockRevokeObjectURL,
    });
  });

  it("rend le composant via renderHook avec QueryClientProvider puis affiche le loader initial", () => {
    const { result } = renderHook(() => NextcloudBrowser(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBeTruthy();

    mockUseNextcloudStatus.mockReturnValueOnce({
      data: undefined,
      isLoading: true,
    });

    render(<NextcloudBrowser />, { wrapper: createWrapper() });

    expect(screen.getByTestId("Loader2")).toBeInTheDocument();
  });

  it("affiche le message de non configuration si Nextcloud n'est pas configuré", () => {
    mockUseNextcloudStatus.mockReturnValueOnce({
      data: STATUS_NOT_CONFIGURED,
      isLoading: false,
    });

    render(<NextcloudBrowser />, { wrapper: createWrapper() });

    expect(screen.getByText("Nextcloud non configuré")).toBeInTheDocument();
    expect(screen.getByText(/Les secrets Nextcloud ne sont pas configurés/i)).toBeInTheDocument();
  });

  it("affiche une erreur de connexion et relance refetch au clic sur Réessayer", () => {
    mockUseNextcloudStatus.mockReturnValueOnce({
      data: STATUS_DISCONNECTED,
      isLoading: false,
    });

    render(<NextcloudBrowser />, { wrapper: createWrapper() });

    expect(screen.getByText("Connexion impossible")).toBeInTheDocument();
    expect(screen.getByText("Serveur indisponible")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Réessayer/i }));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it("affiche les fichiers métier, navigue dans un dossier, met à jour le breadcrumb et permet le retour", async () => {
    render(<NextcloudBrowser />, { wrapper: createWrapper() });

    expect(screen.getByText("Documents")).toBeInTheDocument();
    expect(screen.getByText("rapport.pdf")).toBeInTheDocument();
    expect(screen.getByText("2048 octets")).toBeInTheDocument();
    expect(screen.getByText("fmt:2024-02-15")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nextcloud" })).toBeInTheDocument();

    fireEvent.click(screen.getByText("Documents"));

    await waitFor(() => {
      expect(screen.getByText("photo.png")).toBeInTheDocument();
    });

    expect(screen.getByText("512 octets")).toBeInTheDocument();
    expect(screen.getByText("fmt:2024-03-20")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retour" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Documents" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retour" }));

    await waitFor(() => {
      expect(screen.getByText("rapport.pdf")).toBeInTheDocument();
    });
  });

  it("déclenche le téléchargement d'un fichier et affiche un toast de succès", async () => {
    const appendSpy = vi.spyOn(document.body, "appendChild");
    const removeSpy = vi.spyOn(document.body, "removeChild");
    const createElementSpy = vi.spyOn(document, "createElement");
    let clicked = false;

    createElementSpy.mockImplementation(((tagName: string) => {
      if (tagName === "a") {
        const anchor = document.createElementNS("http://www.w3.org/1999/xhtml", "a");
        anchor.click = () => {
          clicked = true;
        };
        return anchor as HTMLAnchorElement;
      }
      return document.createElementNS("http://www.w3.org/1999/xhtml", tagName) as HTMLElement;
    }) as typeof document.createElement);

    render(<NextcloudBrowser />, { wrapper: createWrapper() });

    const downloadButtons = screen.getAllByRole("button", { name: "Chargement" });

    await act(async () => {
      fireEvent.click(downloadButtons[0]);
    });

    await waitFor(() => {
      expect(mockDownloadNextcloudFile).toHaveBeenCalledWith("/rapport.pdf");
    });

    expect(mockCreateObjectURL).toHaveBeenCalledWith(DOWNLOAD_RESULT.content);
    expect(clicked).toBe(true);
    expect(appendSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
    expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:test-url");
    expect(mockToastSuccess).toHaveBeenCalledWith("rapport.pdf téléchargé");
  });

  it("affiche un toast d'erreur si le téléchargement échoue", async () => {
    mockDownloadNextcloudFile.mockRejectedValueOnce(new Error("boom"));

    render(<NextcloudBrowser />, { wrapper: createWrapper() });

    const downloadButtons = screen.getAllByRole("button", { name: "Chargement" });

    await act(async () => {
      fireEvent.click(downloadButtons[0]);
    });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Erreur lors du téléchargement");
    });

    expect(mockDownloadNextcloudFile).toHaveBeenCalledWith("/rapport.pdf");
    expect(mockDebugError).toHaveBeenCalled();
  });

  it("affiche le chargement de la liste puis l'état vide", async () => {
    mockUseNextcloudFiles
      .mockReturnValueOnce({
        data: ROOT_FILES,
        isLoading: true,
        error: null,
        refetch: mockRefetch,
        isRefetching: false,
      })
      .mockReturnValue({
        data: EMPTY_FILES,
        isLoading: false,
        error: null,
        refetch: mockRefetch,
        isRefetching: false,
      });

    const { rerender } = render(<NextcloudBrowser />, { wrapper: createWrapper() });

    expect(screen.getAllByTestId("skeleton")).toHaveLength(15);

    rerender(<NextcloudBrowser />);

    await waitFor(() => {
      expect(screen.getByText("Dossier vide")).toBeInTheDocument();
    });
  });

  it("affiche l'erreur issue du hook fichiers quand useNextcloudFiles retourne { data:null, error:{ message:'x' } }", () => {
    mockUseNextcloudFiles.mockReturnValueOnce({
      data: null,
      isLoading: false,
      error: { message: "x" },
      refetch: mockRefetch,
      isRefetching: false,
    });

    render(<NextcloudBrowser />, { wrapper: createWrapper() });

    expect(screen.getByText("Connexion impossible")).toBeInTheDocument();
    expect(screen.getByText("x")).toBeInTheDocument();
  });

  it("déclenche refetch via le bouton Actualiser", () => {
    render(<NextcloudBrowser />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByRole("button", { name: /Actualiser/i }));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });
});