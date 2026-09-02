// @vitest-environment jsdom
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { QuickClassificationDialog } from "./QuickClassificationDialog";

const {
  ETABLISSEMENTS,
  PARTENAIRES,
  GROUPES,
  EMPTY_ROWS,
  mockFrom,
  createEntityDialogSpy,
} = vi.hoisted(() => ({
  ETABLISSEMENTS: [
    { id: "e1", nom: "Alpha School", ville: "Paris", type: "Lycée" },
    { id: "e2", nom: "Beta Campus", ville: "Lyon", type: "Collège" },
  ],
  PARTENAIRES: [
    { id: "p1", nom: "Partner One", ville: "Marseille", type_partenaire: "Entreprise" },
    { id: "p2", nom: "Partner Two", ville: "Bordeaux", type_partenaire: "Association" },
  ],
  GROUPES: [
    { id: "g1", nom: "Groupe Nord" },
    { id: "g2", nom: "Groupe Sud" },
  ],
  EMPTY_ROWS: [],
  mockFrom: vi.fn(),
  createEntityDialogSpy: vi.fn(),
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
  DialogTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => <h1 className={className}>{children}</h1>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/input", () => ({
  Input: ({
    value,
    onChange,
    placeholder,
    className,
  }: {
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    className?: string;
  }) => <input value={value} onChange={onChange} placeholder={placeholder} className={className} />,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
  }) => (
    <button onClick={onClick} className={className}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => <span className={className}>{children}</span>,
}));

vi.mock("lucide-react", () => ({
  Building2: () => <svg data-testid="building-icon" />,
  Users: () => <svg data-testid="users-icon" />,
  Briefcase: () => <svg data-testid="briefcase-icon" />,
  Search: () => <svg data-testid="search-icon" />,
  Plus: () => <svg data-testid="plus-icon" />,
}));

vi.mock("@/lib/utils", () => ({
  cn: (...classes: Array<string | undefined | false | null>) => classes.filter(Boolean).join(" "),
}));

vi.mock("./CreateEntityDialog", () => ({
  CreateEntityDialog: ({
    open,
    onCreated,
    type,
  }: {
    open: boolean;
    onCreated: (id: string, name: string) => void;
    type: "etablissement" | "partenaire" | "groupe";
  }) => {
    createEntityDialogSpy({ open, type });
    return open ? (
      <button onClick={() => onCreated("new-id", `Nouveau ${type}`)}>trigger-create</button>
    ) : null;
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}));

function createBuilder(data: unknown, error: { message: string } | null = null) {
  const result = Promise.resolve({ data, error });
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
    single: vi.fn(() => result),
    maybeSingle: vi.fn(() => result),
    then: result.then.bind(result),
    catch: result.catch.bind(result),
  };
  return builder;
}

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("QuickClassificationDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche les établissements, le sujet du thread et filtre par ville", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "etablissements") {
        return createBuilder(ETABLISSEMENTS);
      }
      return createBuilder(EMPTY_ROWS);
    });

    renderWithClient(
      <QuickClassificationDialog
        open
        onOpenChange={vi.fn()}
        type="etablissement"
        onSelect={vi.fn()}
        threadData={{ subject: "Sujet du fil", participants: {} }}
      />,
    );

    expect(screen.getByText("Classer l'établissement")).toBeInTheDocument();
    expect(screen.getByText("Pour: Sujet du fil")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Rechercher un établissement...")).toBeInTheDocument();
    expect(screen.getByText("Créer un nouveau établissement")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Alpha School")).toBeInTheDocument();
      expect(screen.getByText("Paris")).toBeInTheDocument();
      expect(screen.getByText("Lycée")).toBeInTheDocument();
      expect(screen.getByText("Beta Campus")).toBeInTheDocument();
      expect(screen.getByText("Collège")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText("Rechercher un établissement...");
    fireEvent.change(input, { target: { value: "lyon" } });

    await waitFor(() => {
      expect(screen.queryByText("Alpha School")).not.toBeInTheDocument();
      expect(screen.getByText("Beta Campus")).toBeInTheDocument();
      expect(screen.getByText("Lyon")).toBeInTheDocument();
    });
  });

  it("sélectionne un partenaire, ferme la dialog et transmet id + nom", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "partenaires") {
        return createBuilder(PARTENAIRES);
      }
      return createBuilder(EMPTY_ROWS);
    });

    const onSelect = vi.fn();
    const onOpenChange = vi.fn();

    renderWithClient(
      <QuickClassificationDialog
        open
        onOpenChange={onOpenChange}
        type="partenaire"
        onSelect={onSelect}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Classer le partenaire")).toBeInTheDocument();
      expect(screen.getByText("Partner One")).toBeInTheDocument();
      expect(screen.getByText("Entreprise")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Partner One"));

    expect(onSelect).toHaveBeenCalledWith("p1", "Partner One");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("affiche un état vide quand la requête renvoie data null avec erreur", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "groupes_etablissements") {
        return createBuilder(null, { message: "x" });
      }
      return createBuilder(EMPTY_ROWS);
    });

    renderWithClient(
      <QuickClassificationDialog
        open
        onOpenChange={vi.fn()}
        type="groupe"
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("Classer le groupe")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Rechercher un groupe...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Aucun résultat trouvé")).toBeInTheDocument();
    });
  });

  it("ouvre la création puis sélectionne l'entité créée", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "groupes_etablissements") {
        return createBuilder(GROUPES);
      }
      return createBuilder(EMPTY_ROWS);
    });

    const onSelect = vi.fn();
    const onOpenChange = vi.fn();

    renderWithClient(
      <QuickClassificationDialog
        open
        onOpenChange={onOpenChange}
        type="groupe"
        onSelect={onSelect}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Groupe Nord")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Créer un nouveau groupe"));

    await waitFor(() => {
      expect(screen.getByText("trigger-create")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("trigger-create"));

    expect(onSelect).toHaveBeenCalledWith("new-id", "Nouveau groupe");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("ne lance pas de requête quand open est false", () => {
    renderWithClient(
      <QuickClassificationDialog
        open={false}
        onOpenChange={vi.fn()}
        type="etablissement"
        onSelect={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("dialog-root")).not.toBeInTheDocument();
    expect(mockFrom).not.toHaveBeenCalled();
  });
});