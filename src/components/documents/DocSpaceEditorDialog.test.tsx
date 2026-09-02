/* @vitest-environment jsdom */
import React from "react";
import { render, screen, waitFor, act, fireEvent, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DocSpaceEditorDialog } from "./DocSpaceEditorDialog";

const {
  DOCUMENT,
  CONFIG_RESPONSE,
  UPLOAD_RESPONSE,
  DOWNLOAD_RESPONSE,
  AUTH_STATE,
  mockInvokeEdge,
  mockToastSuccess,
  mockToastError,
  mockToastInfo,
  mockDebugError,
  mockDebugLog,
  mockDebugWarn,
  mockUseNavigate,
  mockDestroyFrame,
  mockInitFrame,
  sdkFrames,
} = vi.hoisted(() => {
  const DOCUMENT = {
    id: "doc-1",
    name: "Plan projet.docx",
  };

  const CONFIG_RESPONSE = {
    docSpaceUrl: "https://docspace.local",
    sdkUrl: "https://docspace.local/sdk.js",
  };

  const UPLOAD_RESPONSE = {
    docSpaceFileId: "file-42",
  };

  const DOWNLOAD_RESPONSE = {
    success: true,
  };

  const AUTH_STATE = {
    user: { id: "u1", email: "test@example.com" },
    session: { user: { id: "u1" } },
    isLoading: false,
  };

  return {
    DOCUMENT,
    CONFIG_RESPONSE,
    UPLOAD_RESPONSE,
    DOWNLOAD_RESPONSE,
    AUTH_STATE,
    mockInvokeEdge: vi.fn(),
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
    mockToastInfo: vi.fn(),
    mockDebugError: vi.fn(),
    mockDebugLog: vi.fn(),
    mockDebugWarn: vi.fn(),
    mockUseNavigate: vi.fn(),
    mockDestroyFrame: vi.fn(),
    mockInitFrame: vi.fn(),
    sdkFrames: {} as Record<string, { destroyFrame: () => void }>,
  };
});

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    open,
    children,
  }: {
    open: boolean;
    onOpenChange?: (open: boolean) => void;
    children: React.ReactNode;
  }) => (open ? <div data-testid="dialog-root">{children}</div> : null),
  DialogContent: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    "aria-label": ariaLabel,
    variant,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    "aria-label"?: string;
    variant?: string;
    className?: string;
  }) => (
    <button onClick={onClick} aria-label={ariaLabel} data-variant={variant} className={className}>
      {children}
    </button>
  ),
}));

vi.mock("lucide-react", () => ({
  X: () => <svg data-testid="icon-x" />,
  Loader2: () => <svg data-testid="icon-loader" />,
  AlertCircle: () => <svg data-testid="icon-alert" />,
  RefreshCw: () => <svg data-testid="icon-refresh" />,
}));

vi.mock("@/services/edgeFunctions", () => ({
  invokeEdge: mockInvokeEdge,
}));

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
    info: mockToastInfo,
  },
}));

vi.mock("@/lib/debug", () => ({
  debug: {
    error: mockDebugError,
    log: mockDebugLog,
    warn: mockDebugWarn,
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockUseNavigate,
  };
});

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function renderWithClient(ui: React.ReactElement) {
  const queryClient = createQueryClient();
  return {
    queryClient,
    ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>),
  };
}

describe("DocSpaceEditorDialog", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    Object.keys(sdkFrames).forEach((key) => delete sdkFrames[key]);

    mockDestroyFrame.mockImplementation(() => {});
    mockInitFrame.mockImplementation((config: { frameId: string }) => {
      const instance = { destroyFrame: mockDestroyFrame };
      sdkFrames[config.frameId] = instance;
      return instance;
    });

    window.DocSpace = {
      SDK: {
        initFrame: mockInitFrame,
        frames: sdkFrames,
      },
    };
  });

  it("affiche le chargement puis initialise l'éditeur avec les valeurs métier attendues", async () => {
    mockInvokeEdge.mockImplementation((name: string, payload?: { documentId: string }) => {
      if (name === "docspace-config") {
        return Promise.resolve(CONFIG_RESPONSE);
      }
      if (name === "docspace-upload") {
        return Promise.resolve({
          ...UPLOAD_RESPONSE,
          receivedDocumentId: payload?.documentId,
        });
      }
      if (name === "docspace-download") {
        return Promise.resolve(DOWNLOAD_RESPONSE);
      }
      return Promise.resolve(null);
    });

    const onOpenChange = vi.fn();

    renderWithClient(
      <DocSpaceEditorDialog document={DOCUMENT} open={true} onOpenChange={onOpenChange} />
    );

    expect(screen.getByText("Plan projet.docx")).toBeInTheDocument();
    expect(screen.getByText("Chargement de l'éditeur DocSpace...")).toBeInTheDocument();

    await waitFor(() => {
      expect(mockInvokeEdge).toHaveBeenCalledWith("docspace-config");
    });

    await waitFor(() => {
      expect(mockInvokeEdge).toHaveBeenCalledWith("docspace-upload", { documentId: "doc-1" });
    });

    await waitFor(() => {
      expect(mockInitFrame).toHaveBeenCalledTimes(1);
    });

    expect(mockInitFrame).toHaveBeenCalledWith(
      expect.objectContaining({
        frameId: "docspace-frame-doc-1",
        width: "100%",
        height: "100%",
        mode: "editor",
        id: "file-42",
        showMenu: false,
        showFilter: false,
        showHeader: true,
      })
    );

    expect(document.getElementById("docspace-frame-doc-1")).toBeInTheDocument();
    expect(screen.queryByText("Chargement de l'éditeur DocSpace...")).not.toBeInTheDocument();
    expect(screen.queryByText("Upload du document vers DocSpace...")).not.toBeInTheDocument();
  });

  it("ferme, sauvegarde le document, détruit le frame et invalide les documents", async () => {
    mockInvokeEdge.mockImplementation((name: string) => {
      if (name === "docspace-config") {
        return Promise.resolve(CONFIG_RESPONSE);
      }
      if (name === "docspace-upload") {
        return Promise.resolve(UPLOAD_RESPONSE);
      }
      if (name === "docspace-download") {
        return Promise.resolve(DOWNLOAD_RESPONSE);
      }
      return Promise.resolve(null);
    });

    const onOpenChange = vi.fn();
    const { queryClient } = renderWithClient(
      <DocSpaceEditorDialog document={DOCUMENT} open={true} onOpenChange={onOpenChange} />
    );
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    await waitFor(() => {
      expect(mockInitFrame).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Fermer"));
    });

    await waitFor(() => {
      expect(mockToastInfo).toHaveBeenCalledWith("Sauvegarde en cours...");
    });

    expect(mockInvokeEdge).toHaveBeenCalledWith("docspace-download", {
      documentId: "doc-1",
      docSpaceFileId: "file-42",
      deleteFromDocSpace: true,
    });
    expect(mockToastSuccess).toHaveBeenCalledWith("Document sauvegardé");
    expect(mockDestroyFrame).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["documents"] });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("affiche une erreur si la configuration DocSpace échoue puis permet de réessayer", async () => {
    mockInvokeEdge
      .mockRejectedValueOnce(new Error("config failed"))
      .mockResolvedValueOnce(CONFIG_RESPONSE)
      .mockResolvedValueOnce(UPLOAD_RESPONSE);

    const onOpenChange = vi.fn();

    renderWithClient(
      <DocSpaceEditorDialog document={DOCUMENT} open={true} onOpenChange={onOpenChange} />
    );

    await waitFor(() => {
      expect(screen.getByText("Erreur de configuration DocSpace")).toBeInTheDocument();
    });

    expect(screen.getByText(/Vérifiez que DocSpace est correctement configuré/)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText("Réessayer"));
    });

    await waitFor(() => {
      expect(mockInvokeEdge).toHaveBeenCalledWith("docspace-config");
    });

    await waitFor(() => {
      expect(mockInitFrame).toHaveBeenCalledTimes(1);
    });

    expect(document.getElementById("docspace-frame-doc-1")).toBeInTheDocument();
  });

  it("remonte une erreur DocSpace via toast quand le frame émet onAppError", async () => {
    mockInvokeEdge.mockImplementation((name: string) => {
      if (name === "docspace-config") {
        return Promise.resolve(CONFIG_RESPONSE);
      }
      if (name === "docspace-upload") {
        return Promise.resolve(UPLOAD_RESPONSE);
      }
      return Promise.resolve(null);
    });

    renderWithClient(
      <DocSpaceEditorDialog document={DOCUMENT} open={true} onOpenChange={vi.fn()} />
    );

    await waitFor(() => {
      expect(mockInitFrame).toHaveBeenCalledTimes(1);
    });

    const frameConfig = mockInitFrame.mock.calls[0][0] as {
      events?: { onAppError?: (error: string) => void };
    };

    await act(async () => {
      frameConfig.events?.onAppError?.("serveur indisponible");
    });

    expect(mockToastError).toHaveBeenCalledWith("Erreur DocSpace: serveur indisponible");
  });
});