/* @vitest-environment jsdom */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import { DomainPartenaireAssociationDialog } from "./DomainPartenaireAssociationDialog";

const {
  PARTENAIRES,
  AUTH_STATE,
  mockUsePartenaires,
  mockNavigate,
  toastSuccess,
  toastError,
  mockFrom,
} = vi.hoisted(() => {
  const PARTENAIRES = [
    {
      id: "p1",
      nom: "Alpha Industries",
      type_partenaire: "industriel",
      ville: "Lyon",
      sous_type: "Fabrication",
    },
    {
      id: "p2",
      nom: "Ville de Paris",
      type_partenaire: "institutionnel",
      ville: "Paris",
      sous_type: "Collectivité",
    },
    {
      id: "p3",
      nom: "Beta Services",
      type_partenaire: "prestataire",
      ville: "Marseille",
      sous_type: "Conseil",
    },
  ] as const;

  const AUTH_STATE = {
    user: { id: "u1", email: "user@test.local" },
    session: { user: { id: "u1" } },
    isLoading: false,
  };

  const mockUsePartenaires = vi.fn();
  const mockNavigate = vi.fn();
  const toastSuccess = vi.fn();
  const toastError = vi.fn();

  const createBuilder = () => {
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    builder.select = vi.fn(chain);
    builder.eq = vi.fn(chain);
    builder.neq = vi.fn(chain);
    builder.gt = vi.fn(chain);
    builder.gte = vi.fn(chain);
    builder.lt = vi.fn(chain);
    builder.lte = vi.fn(chain);
    builder.in = vi.fn(chain);
    builder.order = vi.fn(chain);
    builder.limit = vi.fn(chain);
    builder.insert = vi.fn(chain);
    builder.update = vi.fn(chain);
    builder.upsert = vi.fn(chain);
    builder.delete = vi.fn(chain);
    builder.single = vi.fn(async () => ({ data: null, error: null }));
    builder.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
    builder.then = (onFulfilled: (value: { data: null; error: null }) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled);
    builder.catch = (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).catch(onRejected);
    return builder;
  };

  const mockFrom = vi.fn(() => createBuilder());

  return {
    PARTENAIRES,
    AUTH_STATE,
    mockUsePartenaires,
    mockNavigate,
    toastSuccess,
    toastError,
    mockFrom,
  };
});

vi.mock("@/hooks/crm/usePartenaires", () => ({
  usePartenaires: mockUsePartenaires,
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

vi.mock("@/hooks/useAdminRole", () => ({
  useAdminRole: () => true,
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getSession: vi.fn(async () => ({ data: { session: AUTH_STATE.session }, error: null })),
      getUser: vi.fn(async () => ({ data: { user: AUTH_STATE.user }, error: null })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="dialog-root">{children}</div> : null,
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    variant,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
  }) => (
    <button type="button" data-variant={variant} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

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
  }) => (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
    />
  ),
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
    value?: string;
    onValueChange?: (value: string) => void;
    children: React.ReactNode;
  }) => (
    <div>
      <select
        aria-label="Niveau de confiance"
        value={value}
        onChange={(e) => onValueChange?.(e.target.value)}
      >
        <option value="high">Élevé (domaine officiel du partenaire)</option>
        <option value="medium">Moyen (domaine probable)</option>
        <option value="low">Faible (à vérifier)</option>
      </select>
      {children}
    </div>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => <span />,
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({
    children,
    variant,
  }: {
    children: React.ReactNode;
    variant?: string;
  }) => <span data-variant={variant}>{children}</span>,
}));

vi.mock("lucide-react", () => ({
  Handshake: () => <svg data-testid="handshake-icon" />,
  Search: () => <svg data-testid="search-icon" />,
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function createWrapper() {
  const queryClient = createQueryClient();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("DomainPartenaireAssociationDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche le chargement puis les partenaires avec les libellés métier attendus", async () => {
    mockUsePartenaires
      .mockReturnValueOnce({
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
      })
      .mockReturnValue({
        data: PARTENAIRES,
        isLoading: false,
        isError: false,
        error: null,
      });

    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();

    const { rerender } = render(
      <DomainPartenaireAssociationDialog
        open={true}
        onOpenChange={onOpenChange}
        domain="alpha.fr"
        onConfirm={onConfirm}
      />
    );

    expect(screen.getByText("Chargement des partenaires...")).toBeInTheDocument();
    expect(screen.getByText(/Domaine :/)).toBeInTheDocument();
    expect(screen.getByText("alpha.fr")).toBeInTheDocument();

    rerender(
      <DomainPartenaireAssociationDialog
        open={true}
        onOpenChange={onOpenChange}
        domain="alpha.fr"
        onConfirm={onConfirm}
      />
    );

    expect(screen.getByText("Partenaires disponibles (3)")).toBeInTheDocument();
    expect(screen.getByText("Alpha Industries")).toBeInTheDocument();
    expect(screen.getByText("Ville de Paris")).toBeInTheDocument();
    expect(screen.getByText("Beta Services")).toBeInTheDocument();
    expect(screen.getByText("Industriel")).toBeInTheDocument();
    expect(screen.getByText("Institutionnel")).toBeInTheDocument();
    expect(screen.getByText("Prestataire")).toBeInTheDocument();
    expect(screen.getByText("Lyon")).toBeInTheDocument();
    expect(screen.getByText("Collectivité")).toBeInTheDocument();
  });

  it("filtre les partenaires par nom, type et ville", async () => {
    mockUsePartenaires.mockReturnValue({
      data: PARTENAIRES,
      isLoading: false,
      isError: false,
      error: null,
    });

    render(
      <DomainPartenaireAssociationDialog
        open={true}
        onOpenChange={vi.fn()}
        domain="example.org"
        onConfirm={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText("Rechercher un partenaire...");

    await userEvent.type(input, "paris");
    expect(screen.getByText("Partenaires disponibles (1)")).toBeInTheDocument();
    expect(screen.getByText("Ville de Paris")).toBeInTheDocument();
    expect(screen.queryByText("Alpha Industries")).not.toBeInTheDocument();

    await userEvent.clear(input);
    await userEvent.type(input, "prestataire");
    expect(screen.getByText("Partenaires disponibles (1)")).toBeInTheDocument();
    expect(screen.getByText("Beta Services")).toBeInTheDocument();

    await userEvent.clear(input);
    await userEvent.type(input, "alpha");
    expect(screen.getByText("Partenaires disponibles (1)")).toBeInTheDocument();
    expect(screen.getByText("Alpha Industries")).toBeInTheDocument();
  });

  it("confirme l'association avec le niveau de confiance sélectionné et ferme la boîte de dialogue", async () => {
    mockUsePartenaires.mockReturnValue({
      data: PARTENAIRES,
      isLoading: false,
      isError: false,
      error: null,
    });

    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();

    render(
      <DomainPartenaireAssociationDialog
        open={true}
        onOpenChange={onOpenChange}
        domain="partner.test"
        onConfirm={onConfirm}
      />
    );

    const confirmButton = screen.getByRole("button", { name: "Confirmer l'association" });
    expect(confirmButton).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /Ville de Paris/i }));

    expect(confirmButton).not.toBeDisabled();

    fireEvent.change(screen.getByLabelText("Niveau de confiance"), {
      target: { value: "medium" },
    });

    await act(async () => {
      fireEvent.click(confirmButton);
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith("p2", "medium");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("désactive les actions pendant le loading de mutation", () => {
    mockUsePartenaires.mockReturnValue({
      data: PARTENAIRES,
      isLoading: false,
      isError: false,
      error: null,
    });

    render(
      <DomainPartenaireAssociationDialog
        open={true}
        onOpenChange={vi.fn()}
        domain="busy.test"
        onConfirm={vi.fn()}
        isLoading={true}
      />
    );

    expect(screen.getByRole("button", { name: "Annuler" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Association..." })).toBeDisabled();
  });

  it("gère le cas sans résultat", async () => {
    mockUsePartenaires.mockReturnValue({
      data: PARTENAIRES,
      isLoading: false,
      isError: false,
      error: null,
    });

    render(
      <DomainPartenaireAssociationDialog
        open={true}
        onOpenChange={vi.fn()}
        domain="none.test"
        onConfirm={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText("Rechercher un partenaire...");
    await userEvent.type(input, "zzz");

    expect(screen.getByText("Partenaires disponibles (0)")).toBeInTheDocument();
    expect(screen.getByText("Aucun partenaire trouvé")).toBeInTheDocument();
  });

  it("le wrapper QueryClientProvider fonctionne avec renderHook et un état d'erreur mocké", async () => {
    const wrapper = createWrapper();

    const { result, rerender } = renderHook(() => mockUsePartenaires(), { wrapper });

    mockUsePartenaires.mockReturnValueOnce({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    });

    rerender();

    mockUsePartenaires.mockReturnValueOnce({
      data: null,
      isLoading: false,
      isError: true,
      error: { message: "x" },
    });

    rerender();

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toEqual({ message: "x" });
  });
});