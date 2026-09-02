/* @vitest-environment jsdom */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DomainGroupeAssociationDialog } from "./DomainGroupeAssociationDialog";

const { GROUPES, AUTH_STATE, mockFrom, mockUseGroupes } = vi.hoisted(() => {
  const GROUPES_DATA = [
    {
      id: "g1",
      nom: "Groupe Alpha",
      type: "Holding",
      ville_siege: "Paris",
      nombre_etablissements: 3,
    },
    {
      id: "g2",
      nom: "Beta Santé",
      type: "Clinique",
      ville_siege: "Lyon",
      nombre_etablissements: 1,
    },
    {
      id: "g3",
      nom: "Gamma Care",
      type: "Association",
      ville_siege: "Marseille",
      nombre_etablissements: 0,
    },
  ] as const;

  return {
    GROUPES: GROUPES_DATA,
    AUTH_STATE: {
      user: { id: "u1", email: "t@t.co" },
      session: { user: { id: "u1" } },
      isLoading: false,
    },
    mockFrom: vi.fn(() => {
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
        maybeSingle: vi.fn(async () => ({ data: null, error: null })),
        then: (onFulfilled: (value: { data: null; error: null }) => unknown) =>
          Promise.resolve({ data: null, error: null }).then(onFulfilled),
        catch: (onRejected: (reason: unknown) => unknown) =>
          Promise.resolve({ data: null, error: null }).catch(onRejected),
      };
      return builder;
    }),
    mockUseGroupes: vi.fn(),
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock("@/hooks/crm/useGroupes", () => ({
  useGroupes: mockUseGroupes,
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

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("lucide-react", () => ({
  Building2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="building-icon" {...props} />,
  Search: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="search-icon" {...props} />,
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    open,
    children,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
  }) => (open ? <div data-testid="dialog-root">{children}</div> : null),
  DialogContent: ({ children }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-content">{children}</div>
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
    <button type="button" onClick={onClick} disabled={disabled} data-variant={variant}>
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
    onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
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

vi.mock("@/components/ui/select", async () => {
  const ReactModule = await import("react");
  const SelectContext = ReactModule.createContext<{
    value: string;
    onValueChange: (value: string) => void;
  }>({
    value: "high",
    onValueChange: () => {},
  });

  return {
    Select: ({
      value,
      onValueChange,
      children,
    }: {
      value: string;
      onValueChange: (value: string) => void;
      children: React.ReactNode;
    }) => (
      <SelectContext.Provider value={{ value, onValueChange }}>
        <div>{children}</div>
      </SelectContext.Provider>
    ),
    SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectValue: () => {
      const ctx = ReactModule.useContext(SelectContext);
      return <span>{ctx.value}</span>;
    },
    SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectItem: ({
      value,
      children,
    }: {
      value: string;
      children: React.ReactNode;
    }) => {
      const ctx = ReactModule.useContext(SelectContext);
      return (
        <button type="button" onClick={() => ctx.onValueChange(value)}>
          {children}
        </button>
      );
    },
  };
});

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="scroll-area" className={className}>
      {children}
    </div>
  ),
}));

vi.mock("@/components/ui/groupe-badge", () => ({
  GroupeBadge: ({ type }: { type?: string }) => <span>{type}</span>,
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

describe("DomainGroupeAssociationDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche le chargement des groupes", () => {
    mockUseGroupes.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    });

    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();

    render(
      <DomainGroupeAssociationDialog
        open={true}
        onOpenChange={onOpenChange}
        domain="alpha.fr"
        onConfirm={onConfirm}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText("Associer le domaine à un groupe")).toBeInTheDocument();
    expect(screen.getByText(/Domaine :/)).toHaveTextContent("Domaine : alpha.fr");
    expect(screen.getByText("Chargement des groupes...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmer l'association" })).toBeDisabled();
    expect(screen.getByText("Groupes disponibles (0)")).toBeInTheDocument();
  });

  it("affiche les groupes, filtre la recherche, permet de sélectionner un groupe et confirme avec le niveau choisi", () => {
    mockUseGroupes.mockReturnValue({
      data: GROUPES,
      isLoading: false,
      isError: false,
      error: null,
    });

    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();

    render(
      <DomainGroupeAssociationDialog
        open={true}
        onOpenChange={onOpenChange}
        domain="beta.fr"
        onConfirm={onConfirm}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText("Groupes disponibles (3)")).toBeInTheDocument();
    expect(screen.getByText("Groupe Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta Santé")).toBeInTheDocument();
    expect(screen.getByText("Gamma Care")).toBeInTheDocument();
    expect(screen.getByText("Paris")).toBeInTheDocument();
    expect(screen.getByText("3 établissement(s)")).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText("Rechercher un groupe...");
    fireEvent.change(searchInput, { target: { value: "lyon" } });

    expect(screen.getByText("Groupes disponibles (1)")).toBeInTheDocument();
    expect(screen.queryByText("Groupe Alpha")).not.toBeInTheDocument();
    expect(screen.getByText("Beta Santé")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Moyen (domaine probable)" }));
    fireEvent.click(screen.getByRole("button", { name: /Beta Santé/ }));

    const confirmButton = screen.getByRole("button", { name: "Confirmer l'association" });
    expect(confirmButton).toBeEnabled();

    fireEvent.click(confirmButton);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith("g2", "medium");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("réinitialise la sélection et la recherche après confirmation puis désactive les actions pendant isLoading", () => {
    mockUseGroupes.mockReturnValue({
      data: GROUPES,
      isLoading: false,
      isError: false,
      error: null,
    });

    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();

    const { rerender } = render(
      <DomainGroupeAssociationDialog
        open={true}
        onOpenChange={onOpenChange}
        domain="gamma.fr"
        onConfirm={onConfirm}
        isLoading={false}
      />,
      { wrapper: createWrapper() }
    );

    fireEvent.change(screen.getByPlaceholderText("Rechercher un groupe..."), {
      target: { value: "alpha" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Groupe Alpha/ }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmer l'association" }));

    expect(onConfirm).toHaveBeenCalledWith("g1", "high");

    rerender(
      <DomainGroupeAssociationDialog
        open={true}
        onOpenChange={onOpenChange}
        domain="gamma.fr"
        onConfirm={onConfirm}
        isLoading={true}
      />
    );

    expect(screen.getByPlaceholderText("Rechercher un groupe...")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Annuler" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Association..." })).toBeDisabled();
    expect(screen.getByText("Groupes disponibles (3)")).toBeInTheDocument();
  });

  it("affiche aucun groupe trouvé quand la recherche ne correspond à rien", () => {
    mockUseGroupes.mockReturnValue({
      data: GROUPES,
      isLoading: false,
      isError: false,
      error: null,
    });

    render(
      <DomainGroupeAssociationDialog
        open={true}
        onOpenChange={vi.fn()}
        domain="none.fr"
        onConfirm={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    fireEvent.change(screen.getByPlaceholderText("Rechercher un groupe..."), {
      target: { value: "zzz" },
    });

    expect(screen.getByText("Groupes disponibles (0)")).toBeInTheDocument();
    expect(screen.getByText("Aucun groupe trouvé")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmer l'association" })).toBeDisabled();
  });

  it("gère le cas d'erreur du hook en affichant une liste vide", () => {
    mockUseGroupes.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      error: { message: "x" },
    });

    render(
      <DomainGroupeAssociationDialog
        open={true}
        onOpenChange={vi.fn()}
        domain="error.fr"
        onConfirm={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText("Groupes disponibles (0)")).toBeInTheDocument();
    expect(screen.getByText("Aucun groupe trouvé")).toBeInTheDocument();
    expect(screen.getByText(/Domaine :/)).toHaveTextContent("Domaine : error.fr");
  });
});