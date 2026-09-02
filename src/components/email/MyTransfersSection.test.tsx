// @vitest-environment jsdom
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MyTransfersSection } from "./MyTransfersSection";

const {
  TRANSFERS,
  EMPTY_TRANSFERS,
  ERROR_OBJ,
  AUTH_STATE,
  toastFn,
  mockFrom,
  invalidateQueriesMock,
} = vi.hoisted(() => ({
  TRANSFERS: [
    {
      id: "tr-1",
      token: "tok-1",
      subject: "Documents projet",
      expires_at: "2999-12-31T23:59:59.000Z",
      file_count: 3,
      total_size_bytes: 1536,
      download_count: 2,
      purged_at: null,
      created_at: "2024-01-02T10:00:00.000Z",
    },
    {
      id: "tr-2",
      token: "tok-2",
      subject: null,
      expires_at: "2000-01-01T00:00:00.000Z",
      file_count: 1,
      total_size_bytes: 5,
      download_count: 0,
      purged_at: null,
      created_at: "2024-01-01T10:00:00.000Z",
    },
  ] as const,
  EMPTY_TRANSFERS: [] as const,
  ERROR_OBJ: { message: "x" },
  AUTH_STATE: {
    user: { id: "u1", email: "t@t.co" },
    session: { user: { id: "u1" } },
    isLoading: false,
  },
  toastFn: vi.fn(),
  mockFrom: vi.fn(),
  invalidateQueriesMock: vi.fn(),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    title,
    disabled,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    title?: string;
    disabled?: boolean;
  }) => (
    <button type="button" onClick={onClick} title={title} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/hooks/shared/use-toast", () => ({
  useToast: () => ({ toast: toastFn }),
}));

vi.mock("lucide-react", () => ({
  Copy: () => <svg data-testid="icon-copy" />,
  Trash2: () => <svg data-testid="icon-trash" />,
  FileArchive: () => <svg data-testid="icon-archive" />,
  Clock: () => <svg data-testid="icon-clock" />,
}));

vi.mock("date-fns", () => ({
  formatDistanceToNow: () => "dans longtemps",
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
  AuthProvider: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}));

function createThenableBuilder(response: { data: unknown; error: unknown }) {
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
    single: vi.fn(async () => response),
    maybeSingle: vi.fn(async () => response),
    then: (onFulfilled: (value: { data: unknown; error: unknown }) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(response).then(onFulfilled, onRejected),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(response).catch(onRejected),
  };
  return builder;
}

function createClient() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  vi.spyOn(qc, "invalidateQueries").mockImplementation(invalidateQueriesMock);

  return qc;
}

function renderWithClient() {
  const client = createClient();
  return render(
    <QueryClientProvider client={client}>
      <MyTransfersSection />
    </QueryClientProvider>
  );
}

describe("MyTransfersSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(window, "location", {
      value: { origin: "http://localhost" },
      writable: true,
      configurable: true,
    });

    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });
  });

  it("affiche le chargement puis les transferts avec les valeurs métier attendues", async () => {
    mockFrom.mockImplementation((table: string) => {
      expect(table).toBe("email_transfers");
      return createThenableBuilder({ data: TRANSFERS, error: null });
    });

    renderWithClient();

    expect(screen.getByText("Chargement…")).toBeInTheDocument();

    expect(await screen.findByText("Documents projet")).toBeInTheDocument();
    expect(screen.getByText("Sans objet")).toBeInTheDocument();
    expect(screen.getByText("3 fichier(s) · 1.5 Ko")).toBeInTheDocument();
    expect(screen.getByText("1 fichier(s) · 5 o")).toBeInTheDocument();
    expect(screen.getByText("2 téléchargement(s)")).toBeInTheDocument();
    expect(screen.getByText("0 téléchargement(s)")).toBeInTheDocument();
    expect(screen.getAllByText("Expiré")).toHaveLength(2);
    expect(screen.getByText("Expire dans longtemps")).toBeInTheDocument();
    expect(screen.getAllByTitle("Supprimer")).toHaveLength(2);
    expect(screen.getAllByTitle("Copier le lien")).toHaveLength(1);
  });

  it("affiche l'état vide quand aucun transfert n'est retourné", async () => {
    mockFrom.mockImplementation(() => createThenableBuilder({ data: EMPTY_TRANSFERS, error: null }));

    renderWithClient();

    expect(await screen.findByText("Aucun transfert pour le moment.")).toBeInTheDocument();
  });

  it("copie le lien du transfert actif et affiche un toast", async () => {
    mockFrom.mockImplementation(() => createThenableBuilder({ data: TRANSFERS, error: null }));

    renderWithClient();

    const copyButton = await screen.findByTitle("Copier le lien");
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("http://localhost/transfer/tok-1");
    });

    expect(toastFn).toHaveBeenCalledWith({ title: "Lien copié" });
  });

  it("supprime un transfert, affiche un toast et invalide la query", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "email_transfers") {
        return createThenableBuilder({ data: TRANSFERS, error: null });
      }
      return createThenableBuilder({ data: null, error: null });
    });

    renderWithClient();

    const deleteButtons = await screen.findAllByTitle("Supprimer");
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith("email_transfers");
      expect(toastFn).toHaveBeenCalledWith({ title: "Transfert supprimé" });
      expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ["my-email-transfers"] });
    });
  });

  it("remonte une erreur de chargement via le boundary react-query", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    mockFrom.mockImplementation(() => createThenableBuilder({ data: null, error: ERROR_OBJ }));

    expect(() => renderWithClient()).not.toThrow();

    await waitFor(() => {
      expect(screen.queryByText("Chargement…")).not.toBeInTheDocument();
    });

    consoleErrorSpy.mockRestore();
  });
});