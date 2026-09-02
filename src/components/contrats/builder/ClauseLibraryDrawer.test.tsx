// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent, waitFor, act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClauseLibraryDrawer } from "./ClauseLibraryDrawer";

const {
  CLAUSES,
  EMPTY_CLAUSES,
  SECTIONS,
  CATEGORIES,
  AUTH_STATE,
  mutateMock,
  onOpenChangeMock,
  onClauseAddedMock,
  mockFrom,
} = vi.hoisted(() => ({
  CLAUSES: [
    {
      id: "c1",
      titre: "Paiement rapide",
      categorie: "finance",
      contenu_html: "<p>Clause de <strong>paiement</strong> standard.</p>",
      usage_count: 3,
    },
    {
      id: "c2",
      titre: "Confidentialité",
      categorie: "legal",
      contenu_html: "<script>bad()</script><p>Informations sensibles protégées.</p>",
      usage_count: 0,
    },
    {
      id: "c3",
      titre: "Livraison",
      categorie: "operations",
      contenu_html: null,
    },
  ],
  EMPTY_CLAUSES: [],
  SECTIONS: [
    { id: "s1", parent_id: null },
    { id: "s2", parent_id: "s1" },
    { id: "s3", parent_id: null },
  ],
  CATEGORIES: ["finance", "legal", "operations"],
  AUTH_STATE: {
    user: { id: "u1", email: "t@t.co" },
    session: { user: { id: "u1" } },
    isLoading: false,
  },
  mutateMock: vi.fn(),
  onOpenChangeMock: vi.fn(),
  onClauseAddedMock: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock("dompurify", () => ({
  default: {
    sanitize: vi.fn((html: string) => html.replace(/<script[^>]*>.*?<\/script>/gis, "")),
  },
}));

vi.mock("@/types/contrats", () => ({
  CLAUSE_CATEGORIES: CATEGORIES,
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
    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
    then: (resolve: (value: { data: []; error: null }) => unknown) => Promise.resolve(resolve({ data: [], error: null })),
    catch: vi.fn(() => Promise.resolve(builder)),
  };
  mockFrom.mockImplementation(() => builder);
  return {
    supabase: {
      from: mockFrom,
    },
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

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="sheet-root">{children}</div> : null,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
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
      data-testid="search-input"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
    />
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    disabled?: boolean;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({
    children,
    value,
    className,
  }: {
    children: React.ReactNode;
    value: string;
    className?: string;
  }) => (
    <button type="button" data-value={value} className={className}>
      {children}
    </button>
  ),
  TabsContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({
    children,
    onMouseEnter,
    onMouseLeave,
  }: {
    children: React.ReactNode;
    onMouseEnter?: React.MouseEventHandler<HTMLDivElement>;
    onMouseLeave?: React.MouseEventHandler<HTMLDivElement>;
  }) => (
    <div onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      {children}
    </div>
  ),
}));

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: ({ className }: { className?: string }) => <div data-testid="skeleton" className={className} />,
}));

vi.mock("lucide-react", () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />;
  return {
    Search: Icon,
    Plus: Icon,
    FileText: Icon,
    Tag: Icon,
    TrendingUp: Icon,
    GripVertical: Icon,
  };
});

vi.mock("@/hooks/contracts/useContratTemplates", () => ({
  useContratClauses: vi.fn(),
}));

vi.mock("@/hooks/contracts/useContractSections", () => ({
  useContractSections: vi.fn(),
  useCreateSectionFromClause: vi.fn(),
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

describe("ClauseLibraryDrawer", () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    const templatesModule = await import("@/hooks/contracts/useContratTemplates");
    vi.mocked(templatesModule.useContratClauses).mockReturnValue({
      data: CLAUSES,
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof templatesModule.useContratClauses>);

    const sectionsModule = await import("@/hooks/contracts/useContractSections");
    vi.mocked(sectionsModule.useContractSections).mockReturnValue({
      data: SECTIONS,
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof sectionsModule.useContractSections>);

    vi.mocked(sectionsModule.useCreateSectionFromClause).mockReturnValue({
      mutate: mutateMock,
      isPending: false,
    } as unknown as ReturnType<typeof sectionsModule.useCreateSectionFromClause>);
  });

  it("utilise un wrapper QueryClientProvider compatible avec renderHook", () => {
    const { result } = renderHook(() => 42, { wrapper: createWrapper() });
    expect(result.current).toBe(42);
  });

  it("affiche les skeletons pendant le chargement", async () => {
    const templatesModule = await import("@/hooks/contracts/useContratTemplates");
    vi.mocked(templatesModule.useContratClauses).mockReturnValue({
      data: CLAUSES,
      isLoading: true,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof templatesModule.useContratClauses>);

    render(
      <ClauseLibraryDrawer
        open={true}
        onOpenChange={onOpenChangeMock}
        contratId="ctr-1"
        onClauseAdded={onClauseAddedMock}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getAllByTestId("skeleton")).toHaveLength(3);
    expect(screen.queryByText("Paiement rapide")).not.toBeInTheDocument();
  });

  it("affiche les clauses, les compteurs, nettoie le preview html et filtre par recherche", () => {
    render(
      <ClauseLibraryDrawer
        open={true}
        onOpenChange={onOpenChangeMock}
        contratId="ctr-1"
        onClauseAdded={onClauseAddedMock}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText("Bibliothèque de clauses")).toBeInTheDocument();

    expect(screen.getByText("Paiement rapide")).toBeInTheDocument();
    expect(screen.getByText("Confidentialité")).toBeInTheDocument();
    expect(screen.getByText("Livraison")).toBeInTheDocument();

    expect(screen.getByText("Clause de paiement standard.")).toBeInTheDocument();
    expect(screen.getByText("Informations sensibles protégées.")).toBeInTheDocument();
    expect(screen.getByText("Aucun contenu")).toBeInTheDocument();

    expect(screen.getAllByText("finance").length).toBeGreaterThan(0);
    expect(screen.getAllByText("legal").length).toBeGreaterThan(0);
    expect(screen.getAllByText("operations").length).toBeGreaterThan(0);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.queryByText(/bad\(\)/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Rechercher une clause..."), {
      target: { value: "confident" },
    });

    expect(screen.queryByText("Paiement rapide")).not.toBeInTheDocument();
    expect(screen.getByText("Confidentialité")).toBeInTheDocument();
    expect(screen.queryByText("Livraison")).not.toBeInTheDocument();
  });

  it("affiche un état vide quand aucune clause ne correspond", () => {
    render(
      <ClauseLibraryDrawer
        open={true}
        onOpenChange={onOpenChangeMock}
        contratId="ctr-1"
        onClauseAdded={onClauseAddedMock}
      />,
      { wrapper: createWrapper() },
    );

    fireEvent.change(screen.getByPlaceholderText("Rechercher une clause..."), {
      target: { value: "introuvable" },
    });

    expect(screen.getByText("Aucune clause trouvée")).toBeInTheDocument();
  });

  it("déclenche la mutation avec les valeurs métier attendues et appelle onClauseAdded au succès", async () => {
    mutateMock.mockImplementation(
      (
        variables: {
          contrat_id: string;
          clauseId: string;
          titre: string;
          contenu: string;
          ordre: number;
        },
        options?: { onSuccess?: () => void },
      ) => {
        options?.onSuccess?.();
        return variables;
      },
    );

    render(
      <ClauseLibraryDrawer
        open={true}
        onOpenChange={onOpenChangeMock}
        contratId="ctr-99"
        onClauseAdded={onClauseAddedMock}
      />,
      { wrapper: createWrapper() },
    );

    const addButtons = screen.getAllByRole("button", { name: /ajouter/i });

    await act(async () => {
      fireEvent.click(addButtons[0]);
    });

    await waitFor(() => {
      expect(mutateMock).toHaveBeenCalledTimes(1);
    });

    expect(mutateMock).toHaveBeenCalledWith(
      {
        contrat_id: "ctr-99",
        clauseId: "c1",
        titre: "Paiement rapide",
        contenu: "<p>Clause de <strong>paiement</strong> standard.</p>",
        ordre: 2,
      },
      expect.objectContaining({
        onSuccess: expect.any(Function),
      }),
    );

    expect(onClauseAddedMock).toHaveBeenCalledTimes(1);
  });

  it("désactive le bouton d'ajout pendant une mutation en cours", async () => {
    const sectionsModule = await import("@/hooks/contracts/useContractSections");
    vi.mocked(sectionsModule.useCreateSectionFromClause).mockReturnValue({
      mutate: mutateMock,
      isPending: true,
    } as unknown as ReturnType<typeof sectionsModule.useCreateSectionFromClause>);

    render(
      <ClauseLibraryDrawer
        open={true}
        onOpenChange={onOpenChangeMock}
        contratId="ctr-1"
        onClauseAdded={onClauseAddedMock}
      />,
      { wrapper: createWrapper() },
    );

    const addButtons = screen.getAllByRole("button", { name: /ajouter/i });
    expect(addButtons[0]).toBeDisabled();
  });

  it("gère un retour d'erreur du hook de clauses sans planter et affiche l'état vide", async () => {
    const templatesModule = await import("@/hooks/contracts/useContratTemplates");
    vi.mocked(templatesModule.useContratClauses).mockReturnValue({
      data: EMPTY_CLAUSES,
      isLoading: false,
      isError: true,
      error: { message: "x" },
    } as unknown as ReturnType<typeof templatesModule.useContratClauses>);

    render(
      <ClauseLibraryDrawer
        open={true}
        onOpenChange={onOpenChangeMock}
        contratId="ctr-1"
        onClauseAdded={onClauseAddedMock}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText("Aucune clause trouvée")).toBeInTheDocument();
    expect(screen.queryByText("Paiement rapide")).not.toBeInTheDocument();
  });
});