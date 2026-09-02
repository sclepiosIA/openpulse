/* @vitest-environment jsdom */
import React from "react";
import { render, screen, waitFor, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TresorerieAnalyseTab } from "./TresorerieAnalyseTab";
import { useTresorerieDepensesParCategorie } from "@/hooks/tresorerie/useTresorerieDepensesParCategorie";

const {
  MONTHS,
  TREE,
  REVENUE_TREE,
  GRAND_TOTAL,
  GRAND_TRANSACTIONS,
  REVENUE_GRAND_TOTAL,
  REVENUE_GRAND_TRANSACTIONS,
  SOLDE,
  SOLDE_CUMULE,
  HOOK_STATE,
  LOADING_STATE,
  ERROR_STATE,
  AUTH_STATE,
  mockUseTresorerieDepensesParCategorie,
  mockFrom,
  toastSuccess,
  toastError,
  navigateMock,
} = vi.hoisted(() => {
  const MONTHS = ["2024-01", "2024-02", "2024-03"];

  const TREE = [
    {
      id: "dep-1",
      nom: "Loyer",
      monthlyData: {
        "2024-01": 1200,
        "2024-02": 1200,
        "2024-03": 1300,
      },
      transactions: {
        "2024-01": [{ nom: "Loyer janvier", montant: 1200, statut: "paye" }],
        "2024-02": [{ nom: "Loyer février", montant: 1200, statut: "realise" }],
        "2024-03": [{ nom: "Loyer mars", montant: 1300, statut: "prevu" }],
      },
      children: [],
    },
    {
      id: "dep-2",
      nom: "Marketing",
      monthlyData: {
        "2024-01": 300,
        "2024-02": 0,
        "2024-03": 450,
      },
      transactions: {
        "2024-01": [{ nom: "Campagne A", montant: 300, statut: "paye" }],
        "2024-03": [{ nom: "Campagne B", montant: 450, statut: "en_attente" }],
      },
      children: [
        {
          id: "dep-2-1",
          nom: "Ads",
          monthlyData: {
            "2024-01": 300,
            "2024-02": 0,
            "2024-03": 450,
          },
          transactions: {
            "2024-01": [{ nom: "Google Ads", montant: 300, statut: "paye" }],
            "2024-03": [{ nom: "Meta Ads", montant: 450, statut: "en_attente" }],
          },
          children: [],
        },
      ],
    },
  ];

  const REVENUE_TREE = [
    {
      id: "rev-1",
      nom: "Prestations",
      monthlyData: {
        "2024-01": 5000,
        "2024-02": 4200,
        "2024-03": 4800,
      },
      transactions: {
        "2024-01": [{ nom: "Client A", montant: 5000, statut: "realise" }],
        "2024-02": [{ nom: "Client B", montant: 4200, statut: "realise" }],
        "2024-03": [{ nom: "Client C", montant: 4800, statut: "a_facturer" }],
      },
      children: [],
    },
  ];

  const GRAND_TOTAL = {
    "2024-01": 1500,
    "2024-02": 1200,
    "2024-03": 1750,
  };

  const GRAND_TRANSACTIONS = {
    "2024-01": [
      { nom: "Loyer janvier", montant: 1200, statut: "paye" },
      { nom: "Campagne A", montant: 300, statut: "paye" },
    ],
    "2024-02": [{ nom: "Loyer février", montant: 1200, statut: "realise" }],
    "2024-03": [
      { nom: "Loyer mars", montant: 1300, statut: "prevu" },
      { nom: "Campagne B", montant: 450, statut: "en_attente" },
    ],
  };

  const REVENUE_GRAND_TOTAL = {
    "2024-01": 5000,
    "2024-02": 4200,
    "2024-03": 4800,
  };

  const REVENUE_GRAND_TRANSACTIONS = {
    "2024-01": [{ nom: "Client A", montant: 5000, statut: "realise" }],
    "2024-02": [{ nom: "Client B", montant: 4200, statut: "realise" }],
    "2024-03": [{ nom: "Client C", montant: 4800, statut: "a_facturer" }],
  };

  const SOLDE = {
    "2024-01": 3500,
    "2024-02": 3000,
    "2024-03": 3050,
  };

  const SOLDE_CUMULE = {
    "2024-01": 3500,
    "2024-02": 6500,
    "2024-03": 9550,
  };

  const HOOK_STATE = {
    tree: TREE,
    months: MONTHS,
    currentMonth: "2024-02",
    grandTotal: GRAND_TOTAL,
    grandTotalAll: 4450,
    grandTransactions: GRAND_TRANSACTIONS,
    revenueTree: REVENUE_TREE,
    revenueGrandTotal: REVENUE_GRAND_TOTAL,
    revenueGrandTotalAll: 14000,
    revenueGrandTransactions: REVENUE_GRAND_TRANSACTIONS,
    solde: SOLDE,
    soldeCumule: SOLDE_CUMULE,
    isLoading: false,
    isError: false,
    error: null,
  };

  const LOADING_STATE = {
    ...HOOK_STATE,
    isLoading: true,
  };

  const ERROR_STATE = {
    ...HOOK_STATE,
    tree: [],
    revenueTree: [],
    grandTotal: {},
    grandTransactions: {},
    revenueGrandTotal: {},
    revenueGrandTransactions: {},
    solde: {},
    soldeCumule: {},
    isLoading: false,
    isError: true,
    error: { message: "x" },
  };

  const AUTH_STATE = {
    user: { id: "u1", email: "user@test.local" },
    session: { user: { id: "u1" } },
    isLoading: false,
  };

  return {
    MONTHS,
    TREE,
    REVENUE_TREE,
    GRAND_TOTAL,
    GRAND_TRANSACTIONS,
    REVENUE_GRAND_TOTAL,
    REVENUE_GRAND_TRANSACTIONS,
    SOLDE,
    SOLDE_CUMULE,
    HOOK_STATE,
    LOADING_STATE,
    ERROR_STATE,
    AUTH_STATE,
    mockUseTresorerieDepensesParCategorie: vi.fn(() => HOOK_STATE),
    mockFrom: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    navigateMock: vi.fn(),
  };
});

vi.mock("@/hooks/tresorerie/useTresorerieDepensesParCategorie", () => ({
  useTresorerieDepensesParCategorie: mockUseTresorerieDepensesParCategorie,
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
    useNavigate: () => navigateMock,
  };
});

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock("@/lib/utils", () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
}));

vi.mock("@/integrations/supabase/client", () => {
  const result = { data: null, error: null };
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    gt: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lt: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    like: vi.fn(() => builder),
    ilike: vi.fn(() => builder),
    is: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    range: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(resolve(result)),
    catch: () => Promise.resolve(result),
  };

  return {
    supabase: {
      from: mockFrom.mockImplementation(() => builder),
      auth: {
        getSession: vi.fn(async () => ({ data: { session: AUTH_STATE.session }, error: null })),
        getUser: vi.fn(async () => ({ data: { user: AUTH_STATE.user }, error: null })),
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        })),
      },
    },
  };
});

vi.mock("lucide-react", () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />;
  return {
    ChevronRight: Icon,
    ChevronDown: Icon,
    Loader2: Icon,
    ChevronsRight: Icon,
    ChevronsDown: Icon,
  };
});

vi.mock("recharts", () => {
  const Comp = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    BarChart: Comp,
    Bar: Comp,
    XAxis: Comp,
    YAxis: Comp,
    CartesianGrid: Comp,
    Tooltip: Comp,
    ResponsiveContainer: Comp,
    ReferenceLine: Comp,
    ComposedChart: Comp,
    Area: Comp,
  };
});

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Tooltip: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
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

describe("TresorerieAnalyseTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTresorerieDepensesParCategorie.mockImplementation(() => HOOK_STATE);
  });

  it("passe par isLoading puis affiche les données métier attendues", async () => {
    mockUseTresorerieDepensesParCategorie
      .mockImplementationOnce(() => LOADING_STATE)
      .mockImplementation(() => HOOK_STATE);

    const { rerender, container } = render(<TresorerieAnalyseTab />, {
      wrapper: createWrapper(),
    });

    expect(container.querySelector(".animate-spin")).toBeTruthy();

    rerender(<TresorerieAnalyseTab />);

    await waitFor(() => {
      expect(screen.getByText("Loyer")).toBeInTheDocument();
    });

    expect(screen.getByText("Marketing")).toBeInTheDocument();
    expect(screen.getByText("Prestations")).toBeInTheDocument();
    expect(screen.getByText("TOTAL DÉPENSES")).toBeInTheDocument();
    expect(screen.getByText("TOTAL RECETTES")).toBeInTheDocument();
    expect(screen.getByText("SOLDE MENSUEL")).toBeInTheDocument();
    expect(screen.getByText("SOLDE CUMULÉ")).toBeInTheDocument();

    const text = container.textContent ?? "";
    expect(text).toContain("1.2K");
    expect(text).toContain("1.3K");
    expect(text).toContain("5.0K");
    expect(text).toContain("4.2K");
    expect(text).toContain("4.8K");
    expect(text).toContain("3.5K");
    expect(text).toContain("6.5K");
    expect(text).toContain("9.6K");
  });

  it("affiche les bons agrégats réels dans les lignes concernées", async () => {
    render(<TresorerieAnalyseTab />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText("Loyer")).toBeInTheDocument();
    });

    const loyerRow = screen.getByText("Loyer").closest("tr");
    expect(loyerRow).not.toBeNull();
    expect(loyerRow?.textContent ?? "").toContain("3.7K");
    expect(loyerRow?.textContent ?? "").toContain("1.2K");
    expect(loyerRow?.textContent ?? "").toContain("1.3K");

    const marketingRow = screen.getByText("Marketing").closest("tr");
    expect(marketingRow).not.toBeNull();
    expect(marketingRow?.textContent ?? "").toContain("750");
    expect(marketingRow?.textContent ?? "").toContain("300");
    expect(marketingRow?.textContent ?? "").toContain("450");

    const prestationsRow = screen.getByText("Prestations").closest("tr");
    expect(prestationsRow).not.toBeNull();
    expect(prestationsRow?.textContent ?? "").toContain("14.0K");
    expect(prestationsRow?.textContent ?? "").toContain("5.0K");
    expect(prestationsRow?.textContent ?? "").toContain("4.2K");
    expect(prestationsRow?.textContent ?? "").toContain("4.8K");

    const totalDepensesRow = screen.getByText("TOTAL DÉPENSES").closest("tr");
    expect(totalDepensesRow).not.toBeNull();
    expect(totalDepensesRow?.textContent ?? "").toContain("1.5K");
    expect(totalDepensesRow?.textContent ?? "").toContain("1.2K");
    expect(totalDepensesRow?.textContent ?? "").toContain("1.8K");
    expect(totalDepensesRow?.textContent ?? "").toContain("4.5K");

    const totalRecettesRow = screen.getByText("TOTAL RECETTES").closest("tr");
    expect(totalRecettesRow).not.toBeNull();
    expect(totalRecettesRow?.textContent ?? "").toContain("14.0K");

    const soldeMensuelRow = screen.getByText("SOLDE MENSUEL").closest("tr");
    expect(soldeMensuelRow).not.toBeNull();
    expect(soldeMensuelRow?.textContent ?? "").toContain("3.5K");
    expect(soldeMensuelRow?.textContent ?? "").toContain("3.0K");
    expect(soldeMensuelRow?.textContent ?? "").toContain("9.6K");

    const soldeCumuleRow = screen.getByText("SOLDE CUMULÉ").closest("tr");
    expect(soldeCumuleRow).not.toBeNull();
    expect(soldeCumuleRow?.textContent ?? "").toContain("3.5K");
    expect(soldeCumuleRow?.textContent ?? "").toContain("6.5K");
    expect(soldeCumuleRow?.textContent ?? "").toContain("9.6K");
    expect(soldeCumuleRow?.textContent ?? "").toContain("19.6K");
  });

  it("expose un état hook d'erreur avec isError et le message attendu", async () => {
    mockUseTresorerieDepensesParCategorie.mockImplementation(() => ERROR_STATE);

    const { result } = renderHook(() => useTresorerieDepensesParCategorie(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual({ message: "x" });
    expect(result.current.tree).toEqual([]);
    expect(result.current.revenueTree).toEqual([]);
  });
});