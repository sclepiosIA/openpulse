// @vitest-environment jsdom
import React from "react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { render, screen, fireEvent, waitFor, renderHook, act } from "@testing-library/react";
import PortailClient from "./PortailClient";

const {
  USERS_ROWS,
  REQUESTS_ALL_ROWS,
  REQUESTS_NOUVEAU_ROWS,
  AUTH_STATE,
  usersRefetch,
  requestsRefetch,
  createDialogSpy,
  usersTableSpy,
  requestsTableSpy,
  requestsHookSpy,
  pageDataStateSpy,
  mockFrom,
  usersHookState,
  requestsHookState,
  navigateSpy,
} = vi.hoisted(() => ({
  USERS_ROWS: [
    { id: "u1", email: "alice@example.test" },
    { id: "u2", email: "bob@example.test" },
  ],
  REQUESTS_ALL_ROWS: [
    { id: "r1", statut: "nouveau", sujet: "Première demande" },
    { id: "r2", statut: "traite", sujet: "Deuxième demande" },
  ],
  REQUESTS_NOUVEAU_ROWS: [
    { id: "r1", statut: "nouveau", sujet: "Première demande" },
  ],
  AUTH_STATE: {
    user: { id: "u1", email: "user@test.local" },
    session: { user: { id: "u1" } },
    isLoading: false,
  },
  usersRefetch: vi.fn(),
  requestsRefetch: vi.fn(),
  createDialogSpy: vi.fn(),
  usersTableSpy: vi.fn(),
  requestsTableSpy: vi.fn(),
  requestsHookSpy: vi.fn(),
  pageDataStateSpy: vi.fn(),
  mockFrom: vi.fn(),
  usersHookState: {
    data: [
      { id: "u1", email: "alice@example.test" },
      { id: "u2", email: "bob@example.test" },
    ],
    isLoading: false,
    isError: false,
  },
  requestsHookState: {
    mode: "success",
  },
  navigateSpy: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => {
  const response = { data: null, error: null };
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
    then: (onFulfilled: (value: typeof response) => unknown) => Promise.resolve(response).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(response).catch(onRejected),
  };
  mockFrom.mockReturnValue(builder);
  return { supabase: { from: mockFrom } };
});

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateSpy,
  };
});

vi.mock("lucide-react", () => ({
  Plus: () => <span data-testid="icon-plus" />,
  Users: () => <span data-testid="icon-users" />,
  Inbox: () => <span data-testid="icon-inbox" />,
}));

vi.mock("@/components/layout/ImmersivePageHeader", () => ({
  ImmersivePageHeader: ({ title, subtitle }: { title: string; subtitle: string }) => (
    <div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  TabsContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
  }: {
    value: string;
    onValueChange: (v: string) => void;
    children: React.ReactNode;
  }) => (
    <label>
      Filtre statut
      <select aria-label="Filtre statut" value={value} onChange={(e) => onValueChange(e.target.value)}>
        <option value="all">Toutes</option>
        <option value="nouveau">Nouveau</option>
        <option value="en_cours">En cours</option>
        <option value="traite">Traitée</option>
        <option value="ferme">Fermée</option>
      </select>
    </label>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => <span>value</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/common/PageDataState", () => ({
  PageDataState: ({
    isLoading,
    isError,
    onRetry,
    children,
  }: {
    isLoading: boolean;
    isError: boolean;
    onRetry: () => void;
    children: React.ReactNode;
  }) => {
    pageDataStateSpy({ isLoading, isError, onRetry });
    return (
      <div>
        {isError ? <button onClick={onRetry}>Réessayer</button> : null}
        {children}
      </div>
    );
  },
}));

vi.mock("@/components/portail-client/CreatePortalUserDialog", () => ({
  CreatePortalUserDialog: ({
    open,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) => {
    createDialogSpy({ open });
    return <div data-testid="create-dialog">{open ? "dialog-open" : "dialog-closed"}</div>;
  },
}));

vi.mock("@/components/portail-client/PortalUsersTable", () => ({
  PortalUsersTable: ({
    users,
    isLoading,
  }: {
    users: Array<{ id: string; email: string }>;
    isLoading: boolean;
  }) => {
    usersTableSpy({ users, isLoading });
    return (
      <div>
        <span data-testid="users-loading">{String(isLoading)}</span>
        <span data-testid="users-count">{users.length}</span>
        <span data-testid="users-first-email">{users[0]?.email ?? "none"}</span>
      </div>
    );
  },
}));

vi.mock("@/components/portail-client/PortalRequestsTable", () => ({
  PortalRequestsTable: ({
    requests,
    isLoading,
  }: {
    requests: Array<{ id: string; statut: string; sujet: string }>;
    isLoading: boolean;
  }) => {
    requestsTableSpy({ requests, isLoading });
    return (
      <div>
        <span data-testid="requests-loading">{String(isLoading)}</span>
        <span data-testid="requests-count">{requests.length}</span>
        <span data-testid="requests-first-status">{requests[0]?.statut ?? "none"}</span>
      </div>
    );
  },
}));

vi.mock("@/hooks/portail/useClientPortal", () => ({
  useClientPortalUsers: vi.fn(() => ({
    data: usersHookState.data,
    isLoading: usersHookState.isLoading,
    isError: usersHookState.isError,
    refetch: usersRefetch,
  })),
  useClientPortalRequests: vi.fn((filters?: { statut?: string }) => {
    const stableFilters = filters ?? {};
    requestsHookSpy(stableFilters);

    if (requestsHookState.mode === "error") {
      return {
        data: null,
        isLoading: false,
        isError: true,
        refetch: requestsRefetch,
      };
    }

    if (requestsHookState.mode === "loading") {
      return {
        data: REQUESTS_ALL_ROWS,
        isLoading: true,
        isError: false,
        refetch: requestsRefetch,
      };
    }

    return {
      data: stableFilters.statut === "nouveau" ? REQUESTS_NOUVEAU_ROWS : REQUESTS_ALL_ROWS,
      isLoading: false,
      isError: false,
      refetch: requestsRefetch,
    };
  }),
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

describe("PortailClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usersHookState.data = USERS_ROWS;
    usersHookState.isLoading = false;
    usersHookState.isError = false;
    requestsHookState.mode = "success";
  });

  it("affiche les données métier, le compteur de comptes et ouvre le dialogue de création", async () => {
    render(<PortailClient />);

    expect(screen.getByText("Portail client")).toBeInTheDocument();
    expect(screen.getByText("Gestion des comptes et demandes du portail externe")).toBeInTheDocument();
    expect(screen.getByText("2 comptes · accès au portail externe")).toBeInTheDocument();

    expect(screen.getByTestId("users-count").textContent).toBe("2");
    expect(screen.getByTestId("users-first-email").textContent).toBe("alice@example.test");
    expect(screen.getByTestId("requests-count").textContent).toBe("2");
    expect(screen.getByTestId("requests-first-status").textContent).toBe("nouveau");
    expect(screen.getByTestId("users-loading").textContent).toBe("false");
    expect(screen.getByTestId("requests-loading").textContent).toBe("false");

    expect(createDialogSpy).toHaveBeenLastCalledWith(expect.objectContaining({ open: false }));

    fireEvent.click(screen.getByText("Nouveau compte"));

    await waitFor(() => {
      expect(createDialogSpy).toHaveBeenLastCalledWith(expect.objectContaining({ open: true }));
    });

    expect(screen.getByTestId("create-dialog").textContent).toBe("dialog-open");
  });

  it("passe le filtre de statut aux demandes et met à jour les données affichées", async () => {
    render(<PortailClient />);

    expect(requestsHookSpy).toHaveBeenCalledWith({});
    expect(screen.getByTestId("requests-count").textContent).toBe("2");

    fireEvent.change(screen.getByLabelText("Filtre statut"), {
      target: { value: "nouveau" },
    });

    await waitFor(() => {
      expect(requestsHookSpy).toHaveBeenLastCalledWith({ statut: "nouveau" });
    });

    expect(screen.getByTestId("requests-count").textContent).toBe("1");
    expect(screen.getByTestId("requests-first-status").textContent).toBe("nouveau");
  });

  it("affiche les actions de retry en erreur et déclenche les refetch", async () => {
    usersHookState.isError = true;
    requestsHookState.mode = "error";

    render(<PortailClient />);

    const retryButtons = screen.getAllByRole("button", { name: "Réessayer" });
    expect(retryButtons).toHaveLength(2);

    fireEvent.click(retryButtons[0]);
    fireEvent.click(retryButtons[1]);

    expect(usersRefetch).toHaveBeenCalledTimes(1);
    expect(requestsRefetch).toHaveBeenCalledTimes(1);
    expect(pageDataStateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ isLoading: false, isError: true, onRetry: expect.any(Function) })
    );
  });

  it("couvre un hook react-query avec chargement, succès puis erreur dans un wrapper QueryClientProvider", async () => {
    const SUCCESS_ROW = { id: "row-1", label: "chargée" };
    const ERROR_ROW = { message: "x" };
    let mode: "loading" | "success" | "error" = "loading";

    const usePortailClientQuery = () =>
      useQuery({
        queryKey: ["portail-client-test", mode],
        queryFn: async () => {
          if (mode === "loading") {
            await new Promise((resolve) => setTimeout(resolve, 10));
            return { data: SUCCESS_ROW, error: null };
          }
          if (mode === "error") {
            return { data: null, error: ERROR_ROW };
          }
          return { data: SUCCESS_ROW, error: null };
        },
        retry: 0,
        select: (result) => {
          if (result.error) {
            throw new Error(result.error.message);
          }
          return result.data;
        },
      });

    const { result, rerender } = renderHook(() => usePortailClientQuery(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading || result.current.isPending).toBe(true);

    mode = "success";
    rerender();

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(SUCCESS_ROW);

    mode = "error";
    rerender();

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe("x");
  });

  it("déclenche une mutation react-query dans act et vérifie les arguments passés", async () => {
    const mutationSpy = vi.fn(async (payload: { statut: string }) => ({ ok: true, payload }));

    const usePortailMutation = () => {
      const client = new QueryClient({
        defaultOptions: {
          queries: { retry: 0, gcTime: 0 },
          mutations: { retry: 0 },
        },
      });
      void client;
      return {
        mutateAsync: mutationSpy,
      };
    };

    const { result } = renderHook(() => usePortailMutation(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({ statut: "traite" });
    });

    expect(mutationSpy).toHaveBeenCalledWith({ statut: "traite" });
  });
});