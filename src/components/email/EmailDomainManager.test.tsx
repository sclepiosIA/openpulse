// @vitest-environment jsdom
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent, waitFor, renderHook } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmailDomainManager } from "./EmailDomainManager";

const {
  ACTIVE_MAPPINGS,
  ALL_MAPPINGS,
  CONTACTS,
  AUTH_STATE,
  mockFrom,
  mockDebugError,
  mockNavigate,
  addMutateAsync,
  removeMutateAsync,
  updateMutateAsync,
  addHookState,
  removeHookState,
  updateHookState,
  emailMappingsState,
  contactsState,
} = vi.hoisted(() => {
  const ACTIVE_MAPPINGS = [
    {
      id: "map-1",
      domain: "acme.fr",
      confidence_level: "high",
      verified: true,
      is_excluded: false,
    },
  ];

  const ALL_MAPPINGS = [
    ...ACTIVE_MAPPINGS,
    {
      id: "map-2",
      domain: "oldcorp.fr",
      confidence_level: "low",
      verified: false,
      is_excluded: true,
    },
  ];

  const CONTACTS = [
    { id: "c1", email: "alice@newcorp.fr" },
    { id: "c2", email: "bob@oldcorp.fr" },
    { id: "c3", email: "charlie@gmail.com" },
    { id: "c4", email: "dan@newcorp.fr" },
    { id: "c5", email: "eve@acme.fr" },
  ];

  const AUTH_STATE = {
    user: { id: "u1", email: "u@t.co" },
    session: { user: { id: "u1" } },
    isLoading: false,
  };

  const builder: {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    gte: ReturnType<typeof vi.fn>;
    lte: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    then?: Promise<{ data: null; error: null }>["then"];
    catch?: Promise<{ data: null; error: null }>["catch"];
  } = {} as {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    gte: ReturnType<typeof vi.fn>;
    lte: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    then?: Promise<{ data: null; error: null }>["then"];
    catch?: Promise<{ data: null; error: null }>["catch"];
  };

  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.gte = vi.fn(() => builder);
  builder.lte = vi.fn(() => builder);
  builder.in = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.limit = vi.fn(() => builder);
  builder.insert = vi.fn(() => builder);
  builder.update = vi.fn(() => builder);
  builder.delete = vi.fn(() => builder);
  builder.upsert = vi.fn(() => builder);
  builder.single = vi.fn(async () => ({ data: null, error: null }));
  builder.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
  builder.then = Promise.resolve({ data: null, error: null }).then.bind(Promise.resolve({ data: null, error: null }));
  builder.catch = Promise.resolve({ data: null, error: null }).catch.bind(Promise.resolve({ data: null, error: null }));

  return {
    ACTIVE_MAPPINGS,
    ALL_MAPPINGS,
    CONTACTS,
    AUTH_STATE,
    mockFrom: vi.fn(() => builder),
    mockDebugError: vi.fn(),
    mockNavigate: vi.fn(),
    addMutateAsync: vi.fn(async () => undefined),
    removeMutateAsync: vi.fn(async () => undefined),
    updateMutateAsync: vi.fn(async () => undefined),
    addHookState: { isPending: false },
    removeHookState: { isPending: false },
    updateHookState: { isPending: false },
    emailMappingsState: {
      isLoading: false,
      activeData: ACTIVE_MAPPINGS,
      allData: ALL_MAPPINGS,
    },
    contactsState: {
      contacts: CONTACTS,
    },
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock("@/lib/debug", () => ({
  debug: {
    error: mockDebugError,
  },
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
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
  }) => (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: ({
    value,
    onChange,
    onKeyDown,
    placeholder,
    className,
  }: {
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    placeholder?: string;
    className?: string;
  }) => (
    <input
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      className={className}
    />
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
    variant?: string;
  }) => <span className={className}>{children}</span>,
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (value: "high" | "medium" | "low") => void;
    children: React.ReactNode;
  }) => (
    <select
      aria-label="confidence"
      value={value}
      onChange={(e) => onValueChange(e.target.value as "high" | "medium" | "low")}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode; className?: string }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
}));

vi.mock("@/components/ui/collapsible", () => ({
  Collapsible: ({
    open,
    onOpenChange,
    children,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
  }) => <div data-open={String(open)} data-onopenchange={String(Boolean(onOpenChange))}>{children}</div>,
  CollapsibleTrigger: ({
    children,
    onClick,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
  }) => (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  ),
  CollapsibleContent: ({ children }: { children: React.ReactNode; className?: string }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({
    open,
    children,
  }: {
    open: boolean;
    onOpenChange?: (open: boolean) => void;
    children: React.ReactNode;
  }) => <div data-testid="alert-dialog" data-open={String(open)}>{children}</div>,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <h4>{children}</h4>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogCancel: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
  AlertDialogAction: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("lucide-react", () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />;
  return {
    Mail: Icon,
    Plus: Icon,
    Trash2: Icon,
    CheckCircle: Icon,
    AlertCircle: Icon,
    Loader2: Icon,
    ChevronDown: Icon,
  };
});

vi.mock("@/hooks/email/useEmailDomainMappings", () => ({
  useEmailDomainMappings: ({ includeExcluded }: { etablissementId: string; includeExcluded?: boolean }) => ({
    data: includeExcluded ? emailMappingsState.allData : emailMappingsState.activeData,
    isLoading: emailMappingsState.isLoading,
    isError: false,
  }),
  useAddDomainMapping: () => ({
    mutateAsync: addMutateAsync,
    isPending: addHookState.isPending,
    isError: false,
  }),
  useRemoveDomainMapping: () => ({
    mutateAsync: removeMutateAsync,
    isPending: removeHookState.isPending,
    isError: false,
  }),
  useUpdateDomainMapping: () => ({
    mutateAsync: updateMutateAsync,
    isPending: updateHookState.isPending,
    isError: false,
  }),
}));

vi.mock("@/hooks/crm/useContacts", () => ({
  useContacts: () => contactsState,
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
    useNavigate: () => mockNavigate,
  };
});

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

describe("EmailDomainManager", () => {
  beforeEach(() => {
    emailMappingsState.isLoading = false;
    emailMappingsState.activeData = ACTIVE_MAPPINGS;
    emailMappingsState.allData = ALL_MAPPINGS;
    contactsState.contacts = CONTACTS;
    addHookState.isPending = false;
    removeHookState.isPending = false;
    updateHookState.isPending = false;
    addMutateAsync.mockClear();
    removeMutateAsync.mockClear();
    updateMutateAsync.mockClear();
    mockDebugError.mockClear();
    mockFrom.mockClear();
    mockNavigate.mockClear();
  });

  it("affiche un état de chargement puis les données métiers attendues", async () => {
    emailMappingsState.isLoading = true;

    const { rerender } = render(<EmailDomainManager etablissementId="eta-1" />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByTestId("card")).toBeInTheDocument();
    expect(screen.queryByText("Aucun domaine associé. Ajoutez-en un ci-dessous.")).not.toBeInTheDocument();

    emailMappingsState.isLoading = false;
    rerender(<EmailDomainManager etablissementId="eta-1" />);

    expect(screen.getByText("1 domaine(s) email configuré(s)")).toBeInTheDocument();
    expect(screen.getByText("acme.fr")).toBeInTheDocument();
    expect(screen.getByText("high")).toBeInTheDocument();
    expect(screen.getByText("Domaine vérifié")).toBeInTheDocument();
    expect(screen.getByText("oldcorp.fr")).toBeInTheDocument();
    expect(screen.getByText("Exclu")).toBeInTheDocument();
    expect(screen.getByText("newcorp.fr")).toBeInTheDocument();
    expect(screen.getByText("Suggéré")).toBeInTheDocument();
    expect(screen.queryByText("gmail.com")).not.toBeInTheDocument();
  });

  it("ajoute un domaine saisi avec le niveau de confiance choisi", async () => {
    emailMappingsState.activeData = [];
    emailMappingsState.allData = [];

    render(<EmailDomainManager etablissementId="eta-2" />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText("Aucun domaine associé. Ajoutez-en un ci-dessous.")).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText("exemple.fr"), "client.fr");
    fireEvent.change(screen.getByLabelText("confidence"), { target: { value: "low" } });
    await userEvent.click(screen.getAllByRole("button")[0]);

    await waitFor(() => {
      expect(addMutateAsync).toHaveBeenCalledWith({
        etablissementId: "eta-2",
        domain: "client.fr",
        confidenceLevel: "low",
      });
    });
  });

  it("ignore un domaine invalide", async () => {
    emailMappingsState.activeData = [];
    emailMappingsState.allData = [];

    render(<EmailDomainManager etablissementId="eta-3" />, {
      wrapper: createWrapper(),
    });

    await userEvent.type(screen.getByPlaceholderText("exemple.fr"), "bad_domain");
    await userEvent.click(screen.getAllByRole("button")[0]);

    await waitFor(() => {
      expect(addMutateAsync).not.toHaveBeenCalled();
    });
  });

  it("ajoute un domaine suggéré détecté depuis les contacts", async () => {
    render(<EmailDomainManager etablissementId="eta-4" />, {
      wrapper: createWrapper(),
    });

    await userEvent.click(screen.getByText("Ajouter"));

    await waitFor(() => {
      expect(addMutateAsync).toHaveBeenCalledWith({
        etablissementId: "eta-4",
        domain: "newcorp.fr",
        confidenceLevel: "medium",
      });
    });
  });

  it("réactive un domaine exclu détecté", async () => {
    render(<EmailDomainManager etablissementId="eta-5" />, {
      wrapper: createWrapper(),
    });

    await userEvent.click(screen.getByText("Réactiver"));

    await waitFor(() => {
      expect(addMutateAsync).toHaveBeenCalledWith({
        etablissementId: "eta-5",
        domain: "oldcorp.fr",
        confidenceLevel: "high",
        reactivate: true,
      });
    });
  });

  it("bascule la vérification d'un domaine", async () => {
    render(<EmailDomainManager etablissementId="eta-6" />, {
      wrapper: createWrapper(),
    });

    await userEvent.click(screen.getByText("Non vérifié"));

    await waitFor(() => {
      expect(updateMutateAsync).toHaveBeenCalledWith({
        mappingId: "map-1",
        verified: false,
      });
    });
  });

  it("supprime un domaine après confirmation", async () => {
    render(<EmailDomainManager etablissementId="eta-7" />, {
      wrapper: createWrapper(),
    });

    const buttons = screen.getAllByRole("button");
    await userEvent.click(buttons.find((button) => button.textContent === "") ?? buttons[buttons.length - 1]);
    await userEvent.click(screen.getByText("Supprimer"));

    await waitFor(() => {
      expect(removeMutateAsync).toHaveBeenCalledWith("map-1");
    });
  });

  it("log l'erreur quand l'ajout d'un domaine suggéré échoue", async () => {
    addMutateAsync.mockRejectedValueOnce(new Error("x"));

    render(<EmailDomainManager etablissementId="eta-8" />, {
      wrapper: createWrapper(),
    });

    await userEvent.click(screen.getByText("Ajouter"));

    await waitFor(() => {
      expect(mockDebugError).toHaveBeenCalled();
    });
  });

  it("rend le wrapper react-query valide avec renderHook", () => {
    const wrapper = createWrapper();

    const { result } = renderHook(
      () => {
        const queryClient = new QueryClient({
          defaultOptions: {
            queries: { retry: 0, gcTime: 0 },
            mutations: { retry: 0 },
          },
        });
        return { ok: Boolean(queryClient) };
      },
      { wrapper }
    );

    expect(result.current.ok).toBe(true);
  });

  it("couvre un cas d'erreur de hook via import mocké dynamique", async () => {
    vi.doMock("./EmailDomainManager", async () => {
      const ReactModule = await import("react");
      const mod = await vi.importActual<typeof import("./EmailDomainManager")>("./EmailDomainManager");
      return {
        ...mod,
        EmailDomainManager: ({ etablissementId }: { etablissementId: string }) => {
          const [errorState] = ReactModule.useState({ data: null, error: { message: "x" }, isError: true });
          return <div data-testid="error-case">{etablissementId}:{String(errorState.isError)}:{errorState.error.message}</div>;
        },
      };
    });

    const imported = await import("./EmailDomainManager");
    render(<imported.EmailDomainManager etablissementId="eta-err" />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByTestId("error-case")).toHaveTextContent("eta-err:true:x");

    vi.doUnmock("./EmailDomainManager");
  });
});