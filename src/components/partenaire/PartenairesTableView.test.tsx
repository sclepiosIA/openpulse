import React from "react";
import { QueryClient, QueryClientProvider, useMutation, useQuery } from "@tanstack/react-query";
import { render, screen, fireEvent, waitFor, renderHook, act } from "@testing-library/react";
import { PartenairesTableView } from "./PartenairesTableView";

const {
  PARTENAIRES,
  AUTH_STATE,
  mockNavigate,
  mockToastSuccess,
  mockToastError,
  mockMutateAsync,
  mockUseDeletePartenaire,
  mockFrom,
} = vi.hoisted(() => ({
  PARTENAIRES: [
    {
      id: "p1",
      nom: "Beta Group",
      type_partenaire: "media",
      statut_relation: "actif",
      ville: "Lyon",
      region: "ARA",
      logo_url: null,
      email: "beta@ex.co",
      dernier_contact: "2024-01-10T00:00:00.000Z",
      prochaine_action: "2099-12-31T00:00:00.000Z",
      valeur_partenariat: 12000,
      engagement_score: 75,
      responsable: { prenom: "Alice", nom: "Martin" },
    },
    {
      id: "p2",
      nom: "Alpha Org",
      type_partenaire: "association",
      statut_relation: "prospect",
      ville: "Paris",
      region: "IDF",
      logo_url: null,
      email: null,
      dernier_contact: null,
      prochaine_action: "2000-01-01T00:00:00.000Z",
      valeur_partenariat: 5000,
      engagement_score: 0,
      responsable: { prenom: "Bob", nom: "Durand" },
    },
  ],
  AUTH_STATE: {
    user: { id: "u1", email: "user@test.co" },
    session: { user: { id: "u1" } },
    isLoading: false,
  },
  mockNavigate: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockMutateAsync: vi.fn(),
  mockUseDeletePartenaire: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => {
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
    upsert: vi.fn(() => builder),
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: (resolve: (value: { data: null; error: null }) => unknown) =>
      Promise.resolve(resolve({ data: null, error: null })),
    catch: vi.fn(() => Promise.resolve({ data: null, error: null })),
  };

  mockFrom.mockImplementation(() => builder);

  return {
    supabase: {
      from: mockFrom,
      auth: {
        getSession: vi.fn(async () => ({ data: { session: AUTH_STATE.session }, error: null })),
        getUser: vi.fn(async () => ({ data: { user: AUTH_STATE.user }, error: null })),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      },
    },
  };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock("date-fns", () => ({
  formatDistanceToNow: vi.fn((date: Date) => {
    const iso = date.toISOString();
    if (iso.startsWith("2024-01-10")) return "il y a 5 mois";
    return "il y a quelque temps";
  }),
}));

vi.mock("date-fns/locale", () => ({
  fr: {},
}));

vi.mock("@/lib/utils", () => ({
  cn: (...args: Array<string | false | null | undefined>) => args.filter(Boolean).join(" "),
}));

vi.mock("lucide-react", () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => React.createElement("svg", props);
  return {
    MoreHorizontal: Icon,
    Eye: Icon,
    Mail: Icon,
    Trash2: Icon,
    Pencil: Icon,
    Sparkles: Icon,
    Handshake: Icon,
  };
});

vi.mock("@/components/ui/table", () => ({
  Table: ({ children }: { children: React.ReactNode }) => <table>{children}</table>,
  TableHeader: ({ children }: { children: React.ReactNode }) => <thead>{children}</thead>,
  TableBody: ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>,
  TableRow: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    role?: string;
    tabIndex?: number;
    "aria-label"?: string;
    onClick?: React.MouseEventHandler<HTMLTableRowElement>;
    onKeyDown?: React.KeyboardEventHandler<HTMLTableRowElement>;
    className?: string;
    style?: React.CSSProperties;
  }) => <tr {...props}>{children}</tr>,
  TableHead: ({ children, ...props }: { children: React.ReactNode; className?: string }) => <th {...props}>{children}</th>,
  TableCell: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    className?: string;
    onClick?: React.MouseEventHandler<HTMLTableCellElement>;
  }) => <td {...props}>{children}</td>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    variant?: string;
    size?: string;
    className?: string;
    "aria-label"?: string;
  }) => (
    <button type="button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, ...props }: { children: React.ReactNode; className?: string; variant?: string }) => (
    <span {...props}>{children}</span>
  ),
}));

vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
    "aria-label": ariaLabel,
  }: {
    checked?: boolean;
    onCheckedChange?: (value: boolean) => void;
    "aria-label"?: string;
  }) => (
    <input
      type="checkbox"
      aria-label={ariaLabel}
      checked={Boolean(checked)}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
    />
  ),
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode; align?: string }) => <div>{children}</div>,
  DropdownMenuItem: ({
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
  DropdownMenuSeparator: () => <hr />,
}));

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({
    children,
    open,
  }: {
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => <div data-open={open ? "true" : "false"}>{children}</div>,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogCancel: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  AlertDialogAction: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/partenaire-badge", () => ({
  PartenaireBadge: ({ type }: { type: string }) => <span>{type}</span>,
}));

vi.mock("@/components/ui/avatar", () => ({
  Avatar: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
  AvatarFallback: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span className={className}>{children}</span>
  ),
}));

vi.mock("@/components/ui/EntityAvatar", () => ({
  EntityAvatar: ({ name }: { name: string; logoUrl?: string | null; size?: string }) => <span>{name.slice(0, 1)}</span>,
}));

vi.mock("@/components/layout/CRMTableWrapper", () => ({
  CRMTableWrapper: ({ children }: { children: React.ReactNode; minWidth?: string; withCard?: boolean }) => <div>{children}</div>,
}));

vi.mock("@/components/layout/CRMSortableHeader", () => ({
  CRMSortableHeader: ({
    children,
    field,
    onSort,
  }: {
    children: React.ReactNode;
    field: string;
    currentSortField?: string;
    currentSortDirection?: "asc" | "desc";
    onSort: (field: string) => void;
  }) => (
    <th>
      <button type="button" onClick={() => onSort(field)}>
        {children}
      </button>
    </th>
  ),
}));

vi.mock("@/components/layout/CRMEmptyState", () => ({
  CRMEmptyState: ({
    title,
    description,
    createLabel,
    onCreate,
  }: {
    title: string;
    description: string;
    createLabel: string;
    onCreate?: () => void;
  }) => (
    <div>
      <div>{title}</div>
      <div>{description}</div>
      <button type="button" onClick={onCreate}>
        {createLabel}
      </button>
    </div>
  ),
}));

vi.mock("@/hooks/crm/usePartenaires", () => ({
  useDeletePartenaire: () => mockUseDeletePartenaire(),
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

function HookStates() {
  const loading = useQuery({
    queryKey: ["loading-state"],
    queryFn: () => new Promise<never>(() => {}),
  });

  const success = useQuery({
    queryKey: ["success-state"],
    queryFn: async () => PARTENAIRES,
  });

  const error = useQuery({
    queryKey: ["error-state"],
    queryFn: async () => {
      throw { message: "x" };
    },
    retry: 0,
  });

  const mutation = useMutation({
    mutationFn: async (id: string) => mockMutateAsync(id),
  });

  return { loading, success, error, mutation };
}

describe("PartenairesTableView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseDeletePartenaire.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    });
    mockMutateAsync.mockResolvedValue({ data: null, error: null });
  });

  it("couvre les états de hook loading/success/error et la mutation dans un wrapper QueryClientProvider", async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(() => HookStates(), { wrapper });

    expect(result.current.loading.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.success.isSuccess).toBe(true);
    });
    expect(result.current.success.data).toEqual(PARTENAIRES);
    expect(result.current.success.data[0].nom).toBe("Beta Group");
    expect(result.current.success.data[1].valeur_partenariat).toBe(5000);

    await waitFor(() => {
      expect(result.current.error.isError).toBe(true);
    });
    expect(result.current.error.error).toEqual({ message: "x" });

    await act(async () => {
      await result.current.mutation.mutateAsync("p1");
    });
    expect(mockMutateAsync).toHaveBeenCalledWith("p1");
  });

  it("affiche l'état vide et déclenche onCreate", () => {
    const onCreate = vi.fn();

    render(
      <PartenairesTableView
        partenaires={[]}
        selectedIds={[]}
        onSelectAll={vi.fn()}
        onSelectOne={vi.fn()}
        onCreate={onCreate}
      />,
    );

    expect(screen.getByText("Aucun partenaire")).toBeInTheDocument();
    expect(
      screen.getByText("Commencez par ajouter votre premier partenaire pour développer votre réseau."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Nouveau partenaire" }));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it("affiche les valeurs métier, trie, sélectionne et navigue vers la fiche", () => {
    const onSort = vi.fn();
    const onSelectAll = vi.fn();
    const onSelectOne = vi.fn();
    const onEdit = vi.fn();

    render(
      <PartenairesTableView
        partenaires={PARTENAIRES}
        selectedIds={["p1"]}
        onSelectAll={onSelectAll}
        onSelectOne={onSelectOne}
        onSort={onSort}
        sortField="nom"
        sortDirection="asc"
        onEdit={onEdit}
        pendingCounts={{ p1: 3 }}
      />,
    );

    const rows = screen.getAllByRole("link");
    expect(rows).toHaveLength(2);
    expect(screen.getByText("Alpha Org")).toBeInTheDocument();
    expect(screen.getByText("Beta Group")).toBeInTheDocument();

    const firstPartnerName = rows[0].textContent ?? "";
    expect(firstPartnerName).toContain("Alpha Org");
    const secondPartnerName = rows[1].textContent ?? "";
    expect(secondPartnerName).toContain("Beta Group");

    expect(screen.getByText("Lyon • ARA")).toBeInTheDocument();
    expect(screen.getByText("Paris • IDF")).toBeInTheDocument();
    expect(screen.getByText("Alice Martin")).toBeInTheDocument();
    expect(screen.getByText("Bob Durand")).toBeInTheDocument();
    expect(screen.getByText("il y a 5 mois")).toBeInTheDocument();
    expect(screen.getByText("31/12/2099")).toBeInTheDocument();
    expect(screen.getByText("01/01/2000")).toBeInTheDocument();
    expect(screen.getByText("12k€")).toBeInTheDocument();
    expect(screen.getByText("5k€")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("actif")).toBeInTheDocument();
    expect(screen.getByText("prospect")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "Sélectionner tout" }));
    expect(onSelectAll).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByRole("checkbox", { name: "Sélectionner Beta Group" }));
    expect(onSelectOne).toHaveBeenCalledWith("p1");

    fireEvent.click(screen.getByRole("button", { name: "Nom" }));
    expect(onSort).toHaveBeenCalledWith("nom");

    fireEvent.click(screen.getByRole("button", { name: "Localisation" }));
    expect(onSort).toHaveBeenCalledWith("ville");

    fireEvent.click(screen.getByRole("link", { name: "Ouvrir la fiche partenaire Alpha Org" }));
    expect(mockNavigate).toHaveBeenCalledWith("/partenaires/p2");
  });
});