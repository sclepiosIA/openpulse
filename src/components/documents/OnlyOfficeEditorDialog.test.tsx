import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { OnlyOfficeEditorDialog } from "./OnlyOfficeEditorDialog";

const {
  AUTH_STATE,
  PROFILE_DATA,
  TOKEN_SUCCESS,
  TOKEN_SERVER_URL,
  DOCUMENT,
  debugMock,
  toastError,
  mockInvalidateQueries,
  mockFrom,
  mockInvoke,
  mockGetSession,
  mockUseAuth,
  docEditorInstance,
  docEditorCtor,
  fixedNow,
} = vi.hoisted(() => {
  const authState = {
    user: { id: "u1", email: "user@test.co" },
    session: { user: { id: "u1" } },
    isLoading: false,
  };

  const profileData = { nom: "Dupont", prenom: "Jean" };
  const tokenSuccess = {
    token: "tok-ok",
    documentUrl: "https://doc.test/file.docx",
  };
  const tokenServerUrl = {
    serverUrl: "https://onlyoffice.test",
  };
  const documentValue = {
    id: "doc-1",
    name: "Contrat.docx",
    mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };

  return {
    AUTH_STATE: authState,
    PROFILE_DATA: profileData,
    TOKEN_SUCCESS: tokenSuccess,
    TOKEN_SERVER_URL: tokenServerUrl,
    DOCUMENT: documentValue,
    debugMock: {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    toastError: vi.fn(),
    mockInvalidateQueries: vi.fn(),
    mockFrom: vi.fn(),
    mockInvoke: vi.fn(),
    mockGetSession: vi.fn(),
    mockUseAuth: vi.fn(() => authState),
    docEditorInstance: {
      destroyEditor: vi.fn(),
    },
    docEditorCtor: vi.fn(() => ({
      destroyEditor: vi.fn(),
    })),
    fixedNow: 1700000000000,
  };
});

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="dialog-root">{children}</div> : null,
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("lucide-react", () => ({
  X: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-x" {...props} />,
  Loader2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-loader" {...props} />,
}));

vi.mock("@/lib/debug", () => ({
  debug: debugMock,
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastError,
    success: vi.fn(),
  },
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: mockUseAuth,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
    functions: {
      invoke: mockInvoke,
    },
    auth: {
      getSession: mockGetSession,
    },
  },
}));

function createBuilder(profile = PROFILE_DATA) {
  const awaitedResult = { data: null, error: null };
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: profile, error: null })),
    then: (
      onFulfilled?: (value: { data: null; error: null }) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(awaitedResult).then(onFulfilled, onRejected),
    catch: (onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(awaitedResult).catch(onRejected),
  };
  return builder;
}

function createClient() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  vi.spyOn(client, "invalidateQueries").mockImplementation(mockInvalidateQueries);
  return client;
}

function renderWithProviders(
  ui: React.ReactElement,
  { client = createClient() }: { client?: QueryClient } = {},
) {
  return {
    client,
    ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>),
  };
}

describe("OnlyOfficeEditorDialog", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.spyOn(Date, "now").mockReturnValue(fixedNow);

    mockUseAuth.mockReturnValue(AUTH_STATE);
    mockFrom.mockImplementation(() => createBuilder(PROFILE_DATA));
    mockInvoke.mockImplementation(async (fnName: string, payload?: { body?: { action?: string } }) => {
      if (fnName === "onlyoffice-token" && payload?.body?.action === "getServerUrl") {
        return { data: TOKEN_SERVER_URL, error: null };
      }
      return { data: TOKEN_SUCCESS, error: null };
    });
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: "u1" } } },
      error: null,
    });

    docEditorCtor.mockImplementation(() => docEditorInstance);

    Object.defineProperty(window, "DocsAPI", {
      configurable: true,
      writable: true,
      value: {
        DocEditor: docEditorCtor,
      },
    });
  });

  it("affiche le chargement puis initialise l'éditeur avec les valeurs métier attendues", async () => {
    const onOpenChange = vi.fn();

    renderWithProviders(
      <OnlyOfficeEditorDialog
        document={DOCUMENT}
        open={true}
        onOpenChange={onOpenChange}
      />,
    );

    expect(screen.getByText("Chargement de l'éditeur...")).toBeInTheDocument();
    expect(screen.getByText("Contrat.docx")).toBeInTheDocument();
    expect(screen.getByText("Édition collaborative")).toBeInTheDocument();

    await waitFor(() => {
      expect(docEditorCtor).toHaveBeenCalledTimes(1);
    });

    expect(mockFrom).toHaveBeenCalledWith("profiles");
    expect(mockInvoke).toHaveBeenCalledWith("onlyoffice-token", {
      body: { documentId: "doc-1" },
    });
    expect(mockGetSession).toHaveBeenCalledTimes(1);

    const docEditorCall = docEditorCtor.mock.calls[0];
    expect(docEditorCall[0]).toBe("onlyoffice-editor");

    const config = docEditorCall[1] as {
      document: {
        fileType: string;
        title: string;
        url: string;
        permissions: { edit: boolean; download: boolean; print: boolean };
        key: string;
      };
      documentType: string;
      editorConfig: {
        callbackUrl: string;
        user: { id: string; name: string };
        lang: string;
        mode: string;
        customization: {
          autosave: boolean;
          forcesave: boolean;
          chat: boolean;
          comments: boolean;
          compactHeader: boolean;
          feedback: boolean;
          help: boolean;
        };
      };
      token?: string;
      height: string;
      width: string;
      events: {
        onReady: () => void;
        onError: (event: unknown) => void;
        onDocumentStateChange: (event: { data: string }) => void;
        onRequestClose: () => void;
      };
    };

    expect(config.document.fileType).toBe("docx");
    expect(config.document.title).toBe("Contrat.docx");
    expect(config.document.url).toBe("https://doc.test/file.docx");
    expect(config.document.permissions).toEqual({
      edit: true,
      download: true,
      print: true,
    });
    expect(config.document.key).toBe(`doc-1-${fixedNow}`);
    expect(config.documentType).toBe("word");
    expect(config.editorConfig.user).toEqual({
      id: "u1",
      name: "Jean Dupont",
    });
    expect(config.editorConfig.lang).toBe("fr");
    expect(config.editorConfig.mode).toBe("edit");
    expect(config.editorConfig.customization).toEqual({
      autosave: true,
      forcesave: true,
      chat: true,
      comments: true,
      compactHeader: true,
      feedback: false,
      help: false,
    });
    expect(config.token).toBe("tok-ok");
    expect(config.height).toBe("100%");
    expect(config.width).toBe("100%");
    expect(config.editorConfig.callbackUrl).toContain("/functions/v1/onlyoffice-callback?documentId=doc-1");

    await waitFor(() => {
      expect(screen.queryByText("Chargement de l'éditeur...")).not.toBeInTheDocument();
    });

    expect(document.getElementById("onlyoffice-editor")).toBeInTheDocument();
  });

  it("affiche une erreur si la configuration OnlyOffice échoue", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: { message: "x" },
    });

    renderWithProviders(
      <OnlyOfficeEditorDialog
        document={DOCUMENT}
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Erreur de configuration OnlyOffice")).toBeInTheDocument();
    });

    expect(screen.getByText("Vérifiez que le serveur OnlyOffice est correctement configuré.")).toBeInTheDocument();
    expect(debugMock.error).toHaveBeenCalledWith("Token error:", { message: "x" });
    expect(docEditorCtor).not.toHaveBeenCalled();
  });

  it("ferme le dialogue et invalide la liste des documents", async () => {
    const onOpenChange = vi.fn();

    renderWithProviders(
      <OnlyOfficeEditorDialog
        document={DOCUMENT}
        open={true}
        onOpenChange={onOpenChange}
      />,
    );

    await waitFor(() => {
      expect(docEditorCtor).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["documents"] });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("déclenche un toast quand l'éditeur remonte une erreur", async () => {
    renderWithProviders(
      <OnlyOfficeEditorDialog
        document={DOCUMENT}
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(docEditorCtor).toHaveBeenCalledTimes(1);
    });

    const config = docEditorCtor.mock.calls[0][1] as {
      events: {
        onError: (event: { code: string }) => void;
      };
    };

    config.events.onError({ code: "editor-fail" });

    expect(debugMock.error).toHaveBeenCalledWith("OnlyOffice error:", { code: "editor-fail" });
    expect(toastError).toHaveBeenCalledWith("Erreur de l'éditeur OnlyOffice");
  });
});