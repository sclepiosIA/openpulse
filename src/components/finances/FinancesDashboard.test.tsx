import type { HTMLAttributes, ReactNode, SVGProps } from "react";

const financeMocks = vi.hoisted(() => {
  type Mode = "success" | "loading" | "error";

  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;
  const monthOne = `${currentYear}-01`;
  const monthTwo = `${currentYear}-02`;
  const previousMonth = `${previousYear}-12`;

  const kpisRefetch = vi.fn();
  const objectifRefetch = vi.fn();

  const state = {
    kpisMode: "success" as Mode,
    objectifMode: "success" as Mode,
    mrrMode: "success" as Mode,
    qontoMode: "success" as Mode,
    analyseMode: "success" as Mode,
  };

  const kpisSuccess = {
    isLoading: false,
    refetch: kpisRefetch,
    caParExercice: [
      { annee: previousYear, caComptable: 70000, caPercu: 68000 },
      { annee: currentYear, caComptable: 120000, caPercu: 95000 },
    ],
    projectionFinAnnee: 45000,
    prochainTrouTresorerie: null,
    cashburnMoyen6MoisPasses: 8000,
    cashburnMoyenProjete6Mois: 10000,
    facturesEnAttente: { montant: 15000, count: 3 },
  };

  const kpisLoading = {
    ...kpisSuccess,
    isLoading: true,
  };

  const objectifData = {
    realise: 100000,
    cible: 200000,
    progression: 50,
    resteAFaire: 100000,
  };

  const objectifSuccess = {
    isLoading: false,
    isError: false,
    error: null,
    data: objectifData,
    refetch: objectifRefetch,
  };

  const objectifLoading = {
    ...objectifSuccess,
    isLoading: true,
  };

  const objectifError = {
    isLoading: false,
    isError: true,
    error: { message: "x" },
    data: null,
    refetch: objectifRefetch,
  };

  const mrrSuccess = {
    isLoading: false,
    currentMRR: 12000,
    arr: 144000,
    payingClients: 2,
  };

  const mrrLoading = {
    ...mrrSuccess,
    isLoading: true,
  };

  const qontoSuccess = {
    isLoading: false,
    connection: {
      is_active: true,
      bank_accounts: [
        { id: "ba-1", balance: 25000 },
        { id: "ba-2", balance: 5000 },
      ],
    },
    transactions: [
      { id: "tx-1", amount: 1200, settled_at: monthOne },
      { id: "tx-2", amount: -300, settled_at: monthTwo },
    ],
  };

  const qontoLoading = {
    ...qontoSuccess,
    isLoading: true,
  };

  const analyseSuccess = {
    isLoading: false,
    months: [monthOne, monthTwo, previousMonth],
    grandTotal: {
      [monthOne]: 10000,
      [monthTwo]: 5000,
      [previousMonth]: 9999,
    },
    revenueGrandTotal: {
      [monthOne]: 60000,
      [monthTwo]: 40000,
      [previousMonth]: 12000,
    },
  };

  const analyseLoading = {
    ...analyseSuccess,
    isLoading: true,
  };

  const mockUseTresorerieKPIs = vi.fn(() => (state.kpisMode === "loading" ? kpisLoading : kpisSuccess));

  const mockUseObjectifCASummary = vi.fn(() => {
    if (state.objectifMode === "loading") {
      return objectifLoading;
    }

    if (state.objectifMode === "error") {
      return objectifError;
    }

    return objectifSuccess;
  });

  const mockUseMRRData = vi.fn(() => (state.mrrMode === "loading" ? mrrLoading : mrrSuccess));

  const mockUseQontoTransactions = vi.fn(() => (state.qontoMode === "loading" ? qontoLoading : qontoSuccess));

  const mockUseTresorerieDepensesParCategorie = vi.fn(() =>
    state.analyseMode === "loading" ? analyseLoading : analyseSuccess,
  );

  return {
    currentYear,
    previousYear,
    state,
    kpisRefetch,
    objectifRefetch,
    mockUseTresorerieKPIs,
    mockUseObjectifCASummary,
    mockUseMRRData,
    mockUseQontoTransactions,
    mockUseTresorerieDepensesParCategorie,
  };
});

vi.mock("@/components/ui/card", async () => {
  const React = await import("react");

  type DivProps = HTMLAttributes<HTMLDivElement> & { children?: ReactNode };

  const createComponent = (testId: string) =>
    React.forwardRef<HTMLDivElement, DivProps>(({ children, ...props }, ref) =>
      React.createElement("div", { ref, "data-testid": testId, ...props }, children),
    );

  return {
    Card: createComponent("card"),
    CardHeader: createComponent("card-header"),
    CardTitle: createComponent("card-title"),
    CardDescription: createComponent("card-description"),
    CardContent: createComponent("card-content"),
    CardFooter: createComponent("card-footer"),
  };
});

vi.mock("@/components/ui/progress", async () => {
  const React = await import("react");

  type ProgressProps = {
    value?: number;
    className?: string;
  };

  return {
    Progress: ({ value = 0, className }: ProgressProps) =>
      React.createElement("div", {
        role: "progressbar",
        "aria-valuenow": value,
        "aria-valuemin": 0,
        "aria-valuemax": 100,
        "data-testid": "progress",
        className,
      }),
  };
});

vi.mock("@/components/common/PageDataState", async () => {
  const React = await import("react");

  type PageDataStateProps = {
    isLoading?: boolean;
    isError?: boolean;
    error?: { message?: string } | null;
    onRetry?: () => void;
    children?: ReactNode;
  };

  return {
    PageDataState: ({ isLoading, isError, error, onRetry, children }: PageDataStateProps) => {
      if (isLoading) {
        return React.createElement("div", { "data-testid": "page-loading" }, "Chargement des finances");
      }

      if (isError) {
        return React.createElement(
          "div",
          { role: "alert" },
          React.createElement("p", null, `Erreur: ${error?.message ?? "inconnue"}`),
          React.createElement("button", { type: "button", onClick: onRetry }, "Réessayer"),
        );
      }

      return React.createElement(React.Fragment, null, children);
    },
  };
});

vi.mock("@/components/finances/FinancesChartsSection", async () => {
  const React = await import("react");

  type ChartsProps = {
    transactions: readonly unknown[];
    soldeActuel: number;
    hasQonto: boolean;
    months: readonly string[];
    caParMois: Record<string, number>;
    coutsParMois: Record<string, number>;
  };

  return {
    FinancesChartsSection: ({ transactions, soldeActuel, hasQonto, months, caParMois, coutsParMois }: ChartsProps) =>
      React.createElement(
        "section",
        { "data-testid": "finances-charts" },
        `Graphiques hasQonto:${String(hasQonto)} solde:${soldeActuel} transactions:${transactions.length} mois:${months.length} ca:${caParMois[months[0] ?? ""] ?? 0} couts:${coutsParMois[months[0] ?? ""] ?? 0}`,
      ),
  };
});

vi.mock("@/hooks/tresorerie/useTresorerieKPIs", () => ({
  useTresorerieKPIs: financeMocks.mockUseTresorerieKPIs,
}));

vi.mock("@/hooks/billing/useObjectifsCA", () => ({
  useObjectifCASummary: financeMocks.mockUseObjectifCASummary,
}));

vi.mock("@/hooks/analytics/useMRRData", () => ({
  useMRRData: financeMocks.mockUseMRRData,
}));

vi.mock("@/hooks/tresorerie/useQontoTransactions", () => ({
  useQontoTransactions: financeMocks.mockUseQontoTransactions,
}));

vi.mock("@/hooks/tresorerie/useTresorerieDepensesParCategorie", () => ({
  useTresorerieDepensesParCategorie: financeMocks.mockUseTresorerieDepensesParCategorie,
}));

vi.mock("lucide-react", async () => {
  const React = await import("react");

  type IconProps = SVGProps<SVGSVGElement>;

  const createIcon = (name: string) => (props: IconProps) =>
    React.createElement("svg", { ...props, "aria-hidden": "true", "data-testid": `icon-${name}` });

  return {
    Wallet: createIcon("Wallet"),
    CreditCard: createIcon("CreditCard"),
    FileSignature: createIcon("FileSignature"),
    TrendingUp: createIcon("TrendingUp"),
    Package: createIcon("Package"),
    BarChart3: createIcon("BarChart3"),
    Flame: createIcon("Flame"),
    Sigma: createIcon("Sigma"),
    CalendarClock: createIcon("CalendarClock"),
    AlertTriangle: createIcon("AlertTriangle"),
    Receipt: createIcon("Receipt"),
    Target: createIcon("Target"),
    ChevronRight: createIcon("ChevronRight"),
    CheckCircle2: createIcon("CheckCircle2"),
    Repeat: createIcon("Repeat"),
    ArrowDownRight: createIcon("ArrowDownRight"),
    Landmark: createIcon("Landmark"),
  };
});

import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { FinancesDashboard } from "./FinancesDashboard";

function renderDashboard(props: { onNavigateTab?: (tab: string) => void } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <FinancesDashboard {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function normalizedText(element: Element): string {
  return (element.textContent ?? "").replace(/[\u00a0\u202f]/g, " ").replace(/\s+/g, " ").trim();
}

function getClickableCardByText(text: string): HTMLElement {
  const cards = screen.getAllByRole("button");
  const card = cards.find((button) => normalizedText(button).includes(text));

  if (card) {
    return card;
  }

  throw new Error(`Carte cliquable introuvable: ${text}`);
}

function expectLinkHref(container: HTMLElement, label: string, href: string) {
  const links = Array.from(container.querySelectorAll("a"));
  const link = links.find((item) => normalizedText(item).includes(label));

  expect(link).toBeDefined();
  expect(link?.getAttribute("href")).toBe(href);
}

describe("FinancesDashboard", () => {
  beforeEach(() => {
    financeMocks.state.kpisMode = "success";
    financeMocks.state.objectifMode = "success";
    financeMocks.state.mrrMode = "success";
    financeMocks.state.qontoMode = "success";
    financeMocks.state.analyseMode = "success";
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("affiche l'état de chargement quand une source de données charge", () => {
    financeMocks.state.kpisMode = "loading";

    renderDashboard();

    expect(screen.getByTestId("page-loading")).toHaveTextContent("Chargement des finances");
    expect(screen.queryByText("Solde trésorerie")).not.toBeInTheDocument();
    expect(financeMocks.mockUseTresorerieKPIs).toHaveBeenCalled();
  });

  it("affiche les indicateurs financiers calculés à partir des données métier", () => {
    const { container } = renderDashboard();
    const text = normalizedText(container);

    expect(text).toContain("Solde trésorerie");
    expect(text).toContain("30 000 €");

    expect(text).toContain("MRR");
    expect(text).toContain("12 000 €");
    expect(text).toContain("ARR : 144 000 € · 2 clients payants");

    expect(text).toContain(`CA ${financeMocks.currentYear}`);
    expect(text).toContain("120 000 €");
    expect(text).toContain("Perçu : 95 000 €");

    expect(text).toContain(`Coûts ${financeMocks.currentYear}`);
    expect(text).toContain("15 000 €");
    expect(text).toContain("Réel + prévu sur l'année");

    expect(text).toContain(`Résultat net ${financeMocks.currentYear}`);
    expect(text).toContain("105 000 €");
    expect(text).toContain("CA − coûts (réel + prévu)");

    expect(text).toContain(`Projection fin ${financeMocks.currentYear}`);
    expect(text).toContain("45 000 €");
    expect(text).toContain("Aucun trou de trésorerie prévu");

    expect(text).toContain("Cashburn moyen / mois");
    expect(text).toContain("8 000 €");
    expect(text).toContain("Projeté 6 mois : 10 000 €/mois");

    expect(text).toContain("Factures en attente");
    expect(text).toContain("3 factures à encaisser");

    expect(text).toContain(`Objectif CA ${financeMocks.currentYear}`);
    expect(text).toContain("100 000 €");
    expect(text).toContain("sur 200 000 €");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
    expect(text).toContain("50% atteint");
    expect(text).toContain("Reste à faire : 100 000 €");

    expect(text).toContain("CA par exercice");
    expect(text).toContain(String(financeMocks.previousYear));
    expect(text).toContain("Comptable : 70 000 €");
    expect(text).toContain("Perçu : 68 000 €");

    expect(screen.getByTestId("finances-charts")).toHaveTextContent(
      "Graphiques hasQonto:true solde:30000 transactions:2 mois:3 ca:60000 couts:10000",
    );

    expect(text).toContain("Modules financiers");
    expectLinkHref(container, "Trésorerie", "/tresorerie");
    expectLinkHref(container, "Facturation", "/facturation");
    expectLinkHref(container, "Rapports", "/rapports");
  });

  it("déclenche la navigation par onglet sur clic et clavier pour les cartes configurées", () => {
    const onNavigateTab = vi.fn();

    renderDashboard({ onNavigateTab });

    fireEvent.click(getClickableCardByText("Solde trésorerie"));
    fireEvent.keyDown(getClickableCardByText(`CA ${financeMocks.currentYear}`), { key: "Enter" });
    fireEvent.keyDown(getClickableCardByText(`Résultat net ${financeMocks.currentYear}`), { key: " " });

    expect(onNavigateTab).toHaveBeenCalledTimes(3);
    expect(onNavigateTab).toHaveBeenNthCalledWith(1, "tresorerie");
    expect(onNavigateTab).toHaveBeenNthCalledWith(2, "revenus");
    expect(onNavigateTab).toHaveBeenNthCalledWith(3, "pnl");
  });

  it("affiche l'erreur d'objectif CA et relance les requêtes principales au retry", () => {
    financeMocks.state.objectifMode = "error";

    renderDashboard();

    expect(screen.getByRole("alert")).toHaveTextContent("Erreur: x");
    expect(screen.queryByText("Modules financiers")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));

    expect(financeMocks.kpisRefetch).toHaveBeenCalledTimes(1);
    expect(financeMocks.objectifRefetch).toHaveBeenCalledTimes(1);
  });
});