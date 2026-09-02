// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EtablissementPortalTab } from "./EtablissementPortalTab";

const {
  USERS,
  REQUESTS,
  authRole,
  mockUseClientPortalUsersByEtablissement,
  mockUseClientPortalRequests,
  mockUpdateEtablissementBackendUrl,
  mockToastSuccess,
  mockToastError,
  mockInvalidateQueries,
  mockUseQueryClient,
} = vi.hoisted(() => ({
  USERS: [
    { id: "user-1", email: "alpha@example.test" },
    { id: "user-2", email: "beta@example.test" },
  ],
  REQUESTS: [
    { id: "req-1", type: "activation" },
    { id: "req-2", type: "support" },
  ],
  authRole: { isAdmin: true },
  mockUseClientPortalUsersByEtablissement: vi.fn(),
  mockUseClientPortalRequests: vi.fn(),
  mockUpdateEtablissementBackendUrl: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockInvalidateQueries: vi.fn(),
  mockUseQueryClient: vi.fn(),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-classname={className}>{children}</div>
  ),
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 data-classname={className}>{children}</h2>
  ),
  CardDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-classname={className}>{children}</div>
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: ({
    id,
    value,
    onChange,
    placeholder,
    type,
  }: {
    id?: string;
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    type?: string;
  }) => (
    <input id={id} value={value} onChange={onChange} placeholder={placeholder} type={type} />
  ),
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
}));

vi.mock("lucide-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("lucide-react")>()),
  Plus: () => <span>plus-icon</span>,
  Save: () => <span>save-icon</span>,
  ExternalLink: () => <span>external-link-icon</span>,
  ListChecks: () => <span>list-checks-icon</span>,
}));

vi.mock("./CreatePortalUserDialog", () => ({
  CreatePortalUserDialog: ({
    open,
    etablissementId,
  }: {
    open: boolean;
    etablissementId: string;
    onOpenChange: (open: boolean) => void;
  }) => <div>{`create-dialog:${String(open)}:${etablissementId}`}</div>,
}));

vi.mock("./PortalUsersTable", () => ({
  PortalUsersTable: ({
    users,
    isLoading,
    hideEtablissement,
  }: {
    users: Array<{ id: string; email?: string }>;
    isLoading: boolean;
    hideEtablissement?: boolean;
  }) => (
    <div>
      <span>{`users-loading:${String(isLoading)}`}</span>
      <span>{`users-count:${users.length}`}</span>
      <span>{`hide-etablissement:${String(Boolean(hideEtablissement))}`}</span>
      {users.map((u) => (
        <span key={u.id}>{u.email}</span>
      ))}
    </div>
  ),
}));

vi.mock("./PortalRequestsTable", () => ({
  PortalRequestsTable: ({
    requests,
    isLoading,
  }: {
    requests: Array<{ id: string; type?: string }>;
    isLoading: boolean;
  }) => (
    <div>
      <span>{`requests-loading:${String(isLoading)}`}</span>
      <span>{`requests-count:${requests.length}`}</span>
      {requests.map((r) => (
        <span key={r.id}>{r.type}</span>
      ))}
    </div>
  ),
}));

vi.mock("./TaskList", () => ({
  TaskList: ({ etablissementId }: { etablissementId: string }) => (
    <div>{`task-list:${etablissementId}`}</div>
  ),
}));

vi.mock("@/hooks/portail/useClientPortal", () => ({
  useClientPortalUsersByEtablissement: (etablissementId: string) =>
    mockUseClientPortalUsersByEtablissement(etablissementId),
  useClientPortalRequests: (params: { etablissementId: string }) =>
    mockUseClientPortalRequests(params),
}));

vi.mock("@/hooks/shared/useUserRole", () => ({
  useUserRole: () => authRole,
}));

vi.mock("@/services/etablissement/etablissementMutations", () => ({
  updateEtablissementBackendUrl: (etablissementId: string, url: string | null) =>
    mockUpdateEtablissementBackendUrl(etablissementId, url),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return {
    ...actual,
    useQueryClient: () => mockUseQueryClient(),
  };
});

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function renderWithClient(ui: React.ReactElement) {
  const client = createTestQueryClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("EtablissementPortalTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authRole.isAdmin = true;
    mockUseQueryClient.mockReturnValue({
      invalidateQueries: mockInvalidateQueries,
    });
    mockUseClientPortalUsersByEtablissement.mockReturnValue({
      data: USERS,
      isLoading: false,
    });
    mockUseClientPortalRequests.mockReturnValue({
      data: REQUESTS,
      isLoading: false,
    });
    mockUpdateEtablissementBackendUrl.mockResolvedValue(undefined);
  });

  it("affiche les états de chargement puis les données métier réelles", () => {
    mockUseClientPortalUsersByEtablissement.mockReturnValueOnce({
      data: undefined,
      isLoading: true,
    });
    mockUseClientPortalRequests.mockReturnValueOnce({
      data: undefined,
      isLoading: true,
    });

    const { rerender } = renderWithClient(
      <EtablissementPortalTab etablissementId="eta-1" initialBackendUrl="https://initial.test/stats" />,
    );

    expect(screen.getByText("Comptes portail client")).toBeInTheDocument();
    expect(screen.getByText("0 compte pour cet établissement")).toBeInTheDocument();
    expect(screen.getByText("users-loading:true")).toBeInTheDocument();
    expect(screen.getByText("requests-loading:true")).toBeInTheDocument();
    expect(screen.getByText("task-list:eta-1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("https://initial.test/stats")).toBeInTheDocument();

    rerender(
      <QueryClientProvider client={createTestQueryClient()}>
        <EtablissementPortalTab etablissementId="eta-1" initialBackendUrl="https://initial.test/stats" />
      </QueryClientProvider>,
    );

    expect(screen.getByText("2 comptes pour cet établissement")).toBeInTheDocument();
    expect(screen.getByText("users-loading:false")).toBeInTheDocument();
    expect(screen.getByText("requests-loading:false")).toBeInTheDocument();
    expect(screen.getByText("users-count:2")).toBeInTheDocument();
    expect(screen.getByText("requests-count:2")).toBeInTheDocument();
    expect(screen.getByText("alpha@example.test")).toBeInTheDocument();
    expect(screen.getByText("beta@example.test")).toBeInTheDocument();
    expect(screen.getByText("activation")).toBeInTheDocument();
    expect(screen.getByText("support")).toBeInTheDocument();
    expect(screen.getByText("hide-etablissement:true")).toBeInTheDocument();
  });

  it("ouvre la dialog de création au clic sur Nouveau compte", () => {
    renderWithClient(<EtablissementPortalTab etablissementId="eta-2" initialBackendUrl={null} />);

    expect(screen.getByText("create-dialog:false:eta-2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /nouveau compte/i }));

    expect(screen.getByText("create-dialog:true:eta-2")).toBeInTheDocument();
  });

  it("sauvegarde l'URL backend trimée, affiche un succès et invalide la query établissement", async () => {
    renderWithClient(<EtablissementPortalTab etablissementId="eta-3" initialBackendUrl="  https://old.test/x  " />);

    const input = screen.getByLabelText("URL");
    fireEvent.change(input, { target: { value: "  https://new.test/stats  " } });

    fireEvent.click(screen.getByRole("button", { name: /enregistrer/i }));

    await waitFor(() => {
      expect(mockUpdateEtablissementBackendUrl).toHaveBeenCalledWith("eta-3", "https://new.test/stats");
    });

    expect(mockToastSuccess).toHaveBeenCalledWith("URL backend enregistrée");
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["etablissement", "eta-3"] });
  });

  it("envoie null quand l'URL est vide et gère l'erreur de sauvegarde", async () => {
    mockUpdateEtablissementBackendUrl.mockRejectedValueOnce(new Error("échec sauvegarde"));

    renderWithClient(<EtablissementPortalTab etablissementId="eta-4" initialBackendUrl="https://existing.test" />);

    const input = screen.getByLabelText("URL");
    fireEvent.change(input, { target: { value: "   " } });

    fireEvent.click(screen.getByRole("button", { name: /enregistrer/i }));

    await waitFor(() => {
      expect(mockUpdateEtablissementBackendUrl).toHaveBeenCalledWith("eta-4", null);
    });

    expect(mockToastError).toHaveBeenCalledWith("échec sauvegarde");
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(mockInvalidateQueries).not.toHaveBeenCalled();
  });

  it("masque la section admin quand l'utilisateur n'est pas admin", () => {
    authRole.isAdmin = false;

    renderWithClient(<EtablissementPortalTab etablissementId="eta-5" initialBackendUrl="https://hidden.test" />);

    expect(screen.queryByText("URL backend dédié (iframe stats)")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("URL")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /enregistrer/i })).not.toBeInTheDocument();
  });
});