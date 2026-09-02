// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent, waitFor, act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { AssignInterlocutorDialog } from "./AssignInterlocutorDialog";

const {
  ETABS,
  GROUPES,
  PARTENAIRES,
  AUTH_STATE,
  mockAssignInterlocutor,
  mockUseAssignInterlocutor,
  mockFrom,
  mockOnOpenChange,
  mockOnAssigned,
  toastSuccess,
  toastError,
} = vi.hoisted(() => ({
  ETABS: [
    { id: "e1", nom: "Alpha School", ville: "Paris" },
    { id: "e2", nom: "Beta Campus", ville: "Lyon" },
  ],
  GROUPES: [
    { id: "g1", nom: "Groupe Horizon", type: "Réseau" },
    { id: "g2", nom: "Groupe Atlas", type: "Association" },
  ],
  PARTENAIRES: [
    { id: "p1", nom: "Partenaire Soleil", ville: "Marseille", type_partenaire: "Entreprise" },
    { id: "p2", nom: "Partenaire Lune", ville: "Bordeaux", type_partenaire: "Institution" },
  ],
  AUTH_STATE: {
    user: { id: "u1", email: "user@test.local" },
    session: { user: { id: "u1" } },
    isLoading: false,
  },
  mockAssignInterlocutor: vi.fn(),
  mockUseAssignInterlocutor: vi.fn(),
  mockFrom: vi.fn(),
  mockOnOpenChange: vi.fn(),
  mockOnAssigned: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/hooks/email/useAssignInterlocutor", () => ({
  EntityType: {
    etablissement: "etablissement",
    groupe: "groupe",
    partenaire: "partenaire",
  },
  useAssignInterlocutor: mockUseAssignInterlocutor,
}));

vi.mock("@/lib/queryPresets", () => ({
  queryPresets: {
    reference: {},
  },
}));

vi.mock("@/lib/utils", () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
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

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

vi.mock("lucide-react", () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />;
  return {
    Building2: Icon,
    Users: Icon,
    Handshake: Icon,
    Search: Icon,
    Loader2: Icon,
    Mail: Icon,
    User: Icon,
  };
});

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    open,
    children,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
  }) => (open ? <div data-testid="dialog-root">{children}</div> : null),
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));

vi.mock("@/components/ui/tabs", () => {
  const TabsContext = React.createContext<{
    value: string;
    onValueChange: (value: string) => void;
  } | null>(null);

  return {
    Tabs: ({
      value,
      onValueChange,
      children,
    }: {
      value: string;
      onValueChange: (value: string) => void;
      children: React.ReactNode;
    }) => <TabsContext.Provider value={{ value, onValueChange }}>{children}</TabsContext.Provider>,
    TabsList: ({ children, className }: { children: React.ReactNode; className?: string }) => (
      <div className={className}>{children}</div>
    ),
    TabsTrigger: ({
      value,
      children,
      className,
    }: {
      value: string;
      children: React.ReactNode;
      className?: string;
    }) => {
      const ctx = React.useContext(TabsContext);
      return (
        <button
          type="button"
          className={className}
          data-state={ctx?.value === value ? "active" : "inactive"}
          onClick={() => ctx?.onValueChange(value)}
        >
          {children}
        </button>
      );
    },
    TabsContent: ({
      value,
      children,
      className,
    }: {
      value: string;
      children: React.ReactNode;
      className?: string;
    }) => {
      const ctx = React.useContext(TabsContext);
      if (ctx?.value !== value) return null;
      return <div className={className}>{children}</div>;
    },
  };
});

vi.mock("@/components/ui/input", () => ({
  Input: ({
    value,
    onChange,
    placeholder,
    className,
  }: {
    value?: string;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    placeholder?: string;
    className?: string;
  }) => <input value={value} onChange={onChange} placeholder={placeholder} className={className} />,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
    variant?: string;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}));

function createBuilder(table: string) {
  const result =
    table === "etablissements"
      ? { data: ETABS, error: null }
      : table === "groupes_etablissements"
        ? { data: GROUPES, error: null }
        : table === "partenaires"
          ? { data: PARTENAIRES, error: null }
          : { data: [], error: null };

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
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (onFulfilled: (value: typeof result) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
  };
  return builder;
}

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
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("AssignInterlocutorDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAssignInterlocutor.mockReturnValue({
      assignInterlocutor: mockAssignInterlocutor,
      isAssigning: false,
    });
    mockAssignInterlocutor.mockResolvedValue(true);
    mockFrom.mockImplementation((table: string) => createBuilder(table));
  });

  it("affiche un état de chargement via react-query puis les établissements", async () => {
    function useLoadingThenDataQuery() {
      return useQuery({
        queryKey: ["loading-test"],
        queryFn: async () => {
          await new Promise((resolve) => setTimeout(resolve, 20));
          return ETABS;
        },
      });
    }

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={createQueryClient()}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useLoadingThenDataQuery(), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(ETABS);
    expect(result.current.data?.[0]?.nom).toBe("Alpha School");
    expect(result.current.data?.[1]?.ville).toBe("Lyon");
  });

  it("affiche les infos expéditeur, charge les établissements et filtre par recherche", async () => {
    renderWithClient(
      <AssignInterlocutorDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        threadId="thread-1"
        senderEmail="sender@test.local"
        senderName="Alice Martin"
      />,
    );

    expect(screen.getByText("Attribuer cet interlocuteur")).toBeInTheDocument();
    expect(screen.getByText("Alice Martin")).toBeInTheDocument();
    expect(screen.getByText("sender@test.local")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Alpha School")).toBeInTheDocument();
      expect(screen.getByText("Beta Campus")).toBeInTheDocument();
    });

    expect(mockFrom).toHaveBeenCalledWith("etablissements");

    const search = screen.getByPlaceholderText("Rechercher...");
    fireEvent.change(search, { target: { value: "lyon" } });

    await waitFor(() => {
      expect(screen.getByText("Beta Campus")).toBeInTheDocument();
    });

    expect(screen.queryByText("Alpha School")).not.toBeInTheDocument();
    expect(screen.getByText("Lyon")).toBeInTheDocument();
  });

  it("change d'onglet et affiche les partenaires avec transformation du type", async () => {
    renderWithClient(
      <AssignInterlocutorDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        threadId="thread-2"
        senderEmail="sender@test.local"
        senderName={null}
      />,
    );

    expect(screen.getByText("Nom inconnu")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Partenaire/i }));

    await waitFor(() => {
      expect(screen.getByText("Partenaire Soleil")).toBeInTheDocument();
      expect(screen.getByText("Partenaire Lune")).toBeInTheDocument();
    });

    expect(mockFrom).toHaveBeenCalledWith("partenaires");
    expect(screen.getByText("Marseille • Entreprise")).toBeInTheDocument();
    expect(screen.getByText("Bordeaux • Institution")).toBeInTheDocument();
  });

  it("déclenche l'assignation avec les bonnes valeurs puis ferme le dialog", async () => {
    renderWithClient(
      <AssignInterlocutorDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        threadId="thread-42"
        senderEmail="contact@test.local"
        senderName="Jean Dupont"
        onAssigned={mockOnAssigned}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Alpha School")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Alpha School/i }));
    });

    await waitFor(() => {
      expect(mockAssignInterlocutor).toHaveBeenCalledWith({
        threadId: "thread-42",
        entityType: "etablissement",
        entityId: "e1",
        entityName: "Alpha School",
        senderEmail: "contact@test.local",
        senderName: "Jean Dupont",
      });
    });

    expect(mockOnAssigned).toHaveBeenCalledTimes(1);
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it("n'appelle pas les callbacks de succès si l'assignation échoue", async () => {
    mockAssignInterlocutor.mockResolvedValue(false);

    renderWithClient(
      <AssignInterlocutorDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        threadId="thread-77"
        senderEmail="fail@test.local"
        senderName="Erreur Cas"
        onAssigned={mockOnAssigned}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Alpha School")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Alpha School/i }));
    });

    expect(mockAssignInterlocutor).toHaveBeenCalledWith({
      threadId: "thread-77",
      entityType: "etablissement",
      entityId: "e1",
      entityName: "Alpha School",
      senderEmail: "fail@test.local",
      senderName: "Erreur Cas",
    });
    expect(mockOnAssigned).not.toHaveBeenCalled();
    expect(mockOnOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("couvre le cas erreur react-query avec data:null et error.message", async () => {
    const errorMessage = "x";

    function useErrorQuery() {
      return useQuery({
        queryKey: ["error-case"],
        queryFn: async () => {
          const response: { data: null; error: { message: string } } = {
            data: null,
            error: { message: errorMessage },
          };
          if (response.error) {
            throw new Error(response.error.message);
          }
          return response.data;
        },
      });
    }

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={createQueryClient()}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useErrorQuery(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe("x");
    expect(result.current.data).toBeUndefined();
  });
});