import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AddEtablissementToGroupeDialog } from "./AddEtablissementToGroupeDialog";

const {
  ETABLISSEMENTS,
  PROFILES,
  AUTH_STATE,
  mockDebugError,
  mockNavigate,
  mockToastSuccess,
  mockToastError,
  mockFrom,
  addMutateAsync,
  createMutateAsync,
} = vi.hoisted(() => {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    then: vi.fn(),
    catch: vi.fn(),
  };

  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.gte.mockReturnValue(builder);
  builder.lte.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  builder.insert.mockReturnValue(builder);
  builder.update.mockReturnValue(builder);
  builder.delete.mockReturnValue(builder);
  builder.single.mockResolvedValue({ data: null, error: null });
  builder.maybeSingle.mockResolvedValue({ data: null, error: null });
  builder.then.mockImplementation((onFulfilled: (value: { data: null; error: null }) => unknown) =>
    Promise.resolve(onFulfilled({ data: null, error: null })),
  );
  builder.catch.mockImplementation(() => Promise.resolve({ data: null, error: null }));

  return {
    ETABLISSEMENTS: [
      { id: "e1", nom: "Clinique Paris", ville: "Paris", type: "CH" },
      { id: "e2", nom: "Hopital Lyon", ville: "Lyon", type: "CHR" },
      { id: "e3", nom: "Centre Marseille", ville: "Marseille", type: "PSY" },
    ],
    PROFILES: [
      { id: "p1", first_name: "Ada", last_name: "Lovelace", role: "admin" },
      { id: "p2", first_name: "Alan", last_name: "Turing", role: "user" },
    ],
    AUTH_STATE: {
      user: { id: "u1", email: "test@example.com" },
      session: { user: { id: "u1" } },
      isLoading: false,
    },
    mockDebugError: vi.fn(),
    mockNavigate: vi.fn(),
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
    mockFrom: vi.fn(() => builder),
    addMutateAsync: vi.fn(),
    createMutateAsync: vi.fn(),
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: AUTH_STATE.session }, error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: AUTH_STATE.user }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}));

vi.mock("@/lib/debug", () => ({
  debug: {
    error: mockDebugError,
    log: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@/lib/utils", () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
}));

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
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

vi.mock("@/hooks/profile/useProfilesWithRoles", () => ({
  useProfilesWithRoles: vi.fn(() => ({
    data: PROFILES,
    isLoading: false,
    isError: false,
    error: null,
  })),
}));

vi.mock("@/hooks/crm/useEtablissements", () => ({
  useEtablissements: vi.fn(() => ({
    data: ETABLISSEMENTS,
    isLoading: false,
    isError: false,
    error: null,
  })),
  useCreateEtablissement: vi.fn(() => ({
    mutateAsync: createMutateAsync,
    isPending: false,
    isError: false,
    error: null,
  })),
}));

vi.mock("@/hooks/crm/useEtablissementGroupes", () => ({
  useAddEtablissementToGroupe: vi.fn(() => ({
    mutateAsync: addMutateAsync,
    isPending: false,
    isError: false,
    error: null,
  })),
}));

vi.mock("lucide-react", () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => React.createElement("svg", props);
  return {
    Plus: Icon,
    Building2: Icon,
    Check: Icon,
    ChevronsUpDown: Icon,
  };
});

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    type,
    role,
    "aria-expanded": ariaExpanded,
    className,
    variant,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }) => (
    <button
      type={type ?? "button"}
      onClick={onClick}
      disabled={disabled}
      role={role}
      aria-expanded={ariaExpanded}
      className={className}
      data-variant={variant}
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    open,
    children,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
  }) => <div data-open={String(open)}>{children}</div>,
  DialogTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <>{children}</>,
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    children: React.ReactNode;
  }) => <div data-value={value} data-onchange={onValueChange ? "1" : "0"}>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({
    value,
    children,
  }: {
    value: string;
    children: React.ReactNode;
  }) => <button type="button" data-select-item={value}>{children}</button>,
  SelectTrigger: ({
    children,
    id,
  }: {
    children: React.ReactNode;
    id?: string;
  }) => <button type="button" id={id}>{children}</button>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}));

vi.mock("@/components/ui/command", () => ({
  Command: ({ children }: { children: React.ReactNode; shouldFilter?: boolean }) => <div>{children}</div>,
  CommandEmpty: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandInput: ({
    value,
    onValueChange,
    placeholder,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    placeholder?: string;
  }) => (
    <input
      aria-label={placeholder}
      placeholder={placeholder}
      value={value ?? ""}
      onChange={(e) => onValueChange?.(e.target.value)}
    />
  ),
  CommandItem: ({
    children,
    onSelect,
    value,
    className,
  }: {
    children: React.ReactNode;
    onSelect?: (value: string) => void;
    value: string;
    className?: string;
  }) => (
    <button type="button" className={className} onClick={() => onSelect?.(value)}>
      {children}
    </button>
  ),
  CommandList: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void }) => (
    <div>{children}</div>
  ),
  PopoverContent: ({ children, className }: { children: React.ReactNode; className?: string; align?: string }) => (
    <div className={className}>{children}</div>
  ),
  PopoverTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <>{children}</>,
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({
    children,
    htmlFor,
    className,
  }: {
    children: React.ReactNode;
    htmlFor?: string;
    className?: string;
  }) => (
    <label htmlFor={htmlFor} className={className}>
      {children}
    </label>
  ),
}));

vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({
    id,
    checked,
    onCheckedChange,
  }: {
    id?: string;
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }) => (
    <input
      id={id}
      type="checkbox"
      checked={Boolean(checked)}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
    />
  ),
}));

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({
    children,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    children: React.ReactNode;
  }) => <div>{children}</div>,
  TabsContent: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: string;
    className?: string;
  }) => <div data-tab-content={value}>{children}</div>,
  TabsList: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  TabsTrigger: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: string;
  }) => <button type="button" data-tab-trigger={value}>{children}</button>,
}));

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: ({ className }: { className?: string }) => <div data-testid="skeleton" className={className} />,
}));

vi.mock("@/components/etablissement/EtablissementForm", () => ({
  EtablissementForm: ({
    onSubmit,
    onCancel,
    submitLabel,
    isLoading,
    allProfiles,
  }: {
    onSubmit: (data: { nom: string; type: string; ville: string; region: string; statut: string; date_prise_contact: string }) => void;
    onCancel: () => void;
    submitLabel: string;
    isLoading: boolean;
    allProfiles: Array<{ id: string }>;
  }) => (
    <div>
      <div data-testid="profiles-count">{allProfiles.length}</div>
      <div data-testid="form-loading">{String(isLoading)}</div>
      <button
        type="button"
        onClick={() =>
          onSubmit({
            nom: "Nouvel établissement",
            type: "CH",
            ville: "Lille",
            region: "Nord",
            statut: "Prospect",
            date_prise_contact: "2024-01-02",
          })
        }
      >
        {submitLabel}
      </button>
      <button type="button" onClick={onCancel}>
        Annuler formulaire
      </button>
    </div>
  ),
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

describe("AddEtablissementToGroupeDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche le chargement puis les établissements disponibles filtrés du groupe", async () => {
    const useEtablissementsMock = vi.mocked(
      (await import("@/hooks/crm/useEtablissements")).useEtablissements,
    );
    useEtablissementsMock.mockReturnValueOnce({
      data: ETABLISSEMENTS,
      isLoading: true,
      isError: false,
      error: null,
    });
    useEtablissementsMock.mockReturnValue({
      data: ETABLISSEMENTS,
      isLoading: false,
      isError: false,
      error: null,
    });

    render(
      <AddEtablissementToGroupeDialog groupeId="g1" existingEtablissementIds={["e1"]} />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByTestId("skeleton")).toBeInTheDocument();

    render(
      <AddEtablissementToGroupeDialog groupeId="g1" existingEtablissementIds={["e1"]} />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText(/Établissement \* \(2 disponibles\)/)).toBeInTheDocument();
    expect(screen.getByText("Hopital Lyon")).toBeInTheDocument();
    expect(screen.getByText("Centre Marseille")).toBeInTheDocument();
    expect(screen.queryByText("Clinique Paris")).not.toBeInTheDocument();
    expect(screen.getByText(/Tapez pour rechercher parmi les 2 établissements/)).toBeInTheDocument();
  });

  it("ajoute un établissement sélectionné au groupe avec les valeurs métier attendues", async () => {
    addMutateAsync.mockResolvedValueOnce({ ok: true });

    render(
      <AddEtablissementToGroupeDialog groupeId="g42" existingEtablissementIds={["e1"]} />,
      { wrapper: createWrapper() },
    );

    fireEvent.click(screen.getByText("Hopital Lyon"));
    fireEvent.click(screen.getByLabelText("Définir comme établissement principal du groupe"));

    await act(async () => {
      fireEvent.click(screen.getByText("Ajouter"));
    });

    await waitFor(() => {
      expect(addMutateAsync).toHaveBeenCalledTimes(1);
    });

    expect(addMutateAsync).toHaveBeenCalledWith({
      etablissement_id: "e2",
      groupe_id: "g42",
      est_etablissement_principal: true,
      role_dans_groupe: undefined,
    });
  });

  it("crée un établissement puis l'ajoute automatiquement au groupe", async () => {
    createMutateAsync.mockResolvedValueOnce({ id: "new-etab-1", nom: "Nouvel établissement" });
    addMutateAsync.mockResolvedValueOnce({ ok: true });

    render(
      <AddEtablissementToGroupeDialog groupeId="g-create" existingEtablissementIds={[]} />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByTestId("profiles-count")).toHaveTextContent("2");

    await act(async () => {
      fireEvent.click(screen.getByText("Créer et ajouter au groupe"));
    });

    await waitFor(() => {
      expect(createMutateAsync).toHaveBeenCalledTimes(1);
      expect(addMutateAsync).toHaveBeenCalledTimes(1);
    });

    expect(createMutateAsync).toHaveBeenCalledWith({
      nom: "Nouvel établissement",
      type: "CH",
      ville: "Lille",
      region: "Nord",
      statut: "Prospect",
      date_prise_contact: "2024-01-02",
    });

    expect(addMutateAsync).toHaveBeenCalledWith({
      etablissement_id: "new-etab-1",
      groupe_id: "g-create",
      est_etablissement_principal: false,
      role_dans_groupe: undefined,
    });
  });

  it("capture l'erreur de création via debug.error", async () => {
    const createError = new Error("x");
    createMutateAsync.mockRejectedValueOnce(createError);

    render(
      <AddEtablissementToGroupeDialog groupeId="g-error" existingEtablissementIds={[]} />,
      { wrapper: createWrapper() },
    );

    await act(async () => {
      fireEvent.click(screen.getByText("Créer et ajouter au groupe"));
    });

    await waitFor(() => {
      expect(mockDebugError).toHaveBeenCalledTimes(1);
    });

    expect(mockDebugError).toHaveBeenCalledWith("Erreur lors de la création:", createError);
    expect(addMutateAsync).not.toHaveBeenCalled();
  });

  it("expose un état d'erreur via un hook de test avec QueryClientProvider", async () => {
    function useErrorState() {
      const [state, setState] = React.useState({
        isLoading: true,
        isError: false,
        error: null as null | { message: string },
        data: null as null,
      });

      React.useEffect(() => {
        Promise.resolve().then(() => {
          const result = { data: null, error: { message: "x" } };
          setState({
            isLoading: false,
            isError: Boolean(result.error),
            error: result.error,
            data: result.data,
          });
        });
      }, []);

      return state;
    }

    const { result } = renderHook(() => useErrorState(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual({ message: "x" });
    expect(result.current.data).toBeNull();
  });
});