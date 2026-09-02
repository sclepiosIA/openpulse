/* @vitest-environment jsdom */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import Finances from "./Finances";

const {
  pageTitleMock,
  mrrData,
  qontoData,
  headerPropsSpy,
  globalSearchPropsSpy,
} = vi.hoisted(() => ({
  pageTitleMock: vi.fn(),
  mrrData: { currentMRR: 12345 },
  qontoData: {
    connection: {
      bank_accounts: [
        { balance: 1500 },
        { balance: 2500 },
      ],
    },
  },
  headerPropsSpy: vi.fn(),
  globalSearchPropsSpy: vi.fn(),
}));

vi.mock("@/hooks/shared/usePageTitle", () => ({
  usePageTitle: pageTitleMock,
}));

vi.mock("@/hooks/analytics/useMRRData", () => ({
  useMRRData: () => mrrData,
}));

vi.mock("@/hooks/tresorerie/useQontoTransactions", () => ({
  useQontoTransactions: () => qontoData,
}));

vi.mock("@/components/ui/tabs", async () => {
  const ReactModule = await import("react");
  return {
    Tabs: ({
      children,
      value,
      onValueChange,
      className,
    }: {
      children: React.ReactNode;
      value: string;
      onValueChange?: (value: string) => void;
      className?: string;
    }) => (
      <div data-testid="tabs-root" data-value={value} data-classname={className}>
        <button type="button" onClick={() => onValueChange?.("revenus")}>
          switch-tabs-mock
        </button>
        {children}
      </div>
    ),
    TabsContent: ({
      children,
      value,
      className,
    }: {
      children: React.ReactNode;
      value: string;
      className?: string;
    }) => (
      <section data-testid={`tab-content-${value}`} data-classname={className}>
        {children}
      </section>
    ),
  };
});

vi.mock("@/components/layout/ImmersivePageHeader", () => ({
  ImmersivePageHeader: ({
    title,
    subtitle,
    stats,
    searchPlaceholder,
    onSearchClick,
    children,
  }: {
    title: string;
    subtitle: string;
    stats: Array<{ label: string; value: string; highlight?: boolean }>;
    searchPlaceholder?: string;
    onSearchClick?: () => void;
    children?: React.ReactNode;
  }) => {
    headerPropsSpy({ title, subtitle, stats, searchPlaceholder });
    return (
      <header data-testid="immersive-header">
        <h1>{title}</h1>
        <p>{subtitle}</p>
        <div data-testid="header-stat-solde">
          {stats[0]?.label}:{stats[0]?.value}:{String(stats[0]?.highlight)}
        </div>
        <div data-testid="header-stat-mrr">
          {stats[1]?.label}:{stats[1]?.value}
        </div>
        <button type="button" onClick={onSearchClick}>
          open-search
        </button>
        <div>{children}</div>
      </header>
    );
  },
}));

vi.mock("@/components/search/GlobalSearchDialog", () => ({
  GlobalSearchDialog: ({
    open,
    setOpen,
    hideTrigger,
  }: {
    open: boolean;
    setOpen: (value: boolean) => void;
    hideTrigger?: boolean;
  }) => {
    globalSearchPropsSpy({ open, hideTrigger });
    return (
      <div data-testid="global-search-dialog">
        <span>{open ? "open" : "closed"}</span>
        <span>{hideTrigger ? "hidden-trigger" : "visible-trigger"}</span>
        <button type="button" onClick={() => setOpen(false)}>
          close-search
        </button>
      </div>
    );
  },
}));

vi.mock("@/components/finances/FinancesDashboard", () => ({
  FinancesDashboard: ({
    onNavigateTab,
  }: {
    onNavigateTab: (value: string) => void;
  }) => (
    <div data-testid="finances-dashboard">
      <button type="button" onClick={() => onNavigateTab("pnl")}>
        dashboard-go-pnl
      </button>
      dashboard-content
    </div>
  ),
}));

vi.mock("@/components/finances/FinancesPnL", () => ({
  FinancesPnL: () => <div data-testid="finances-pnl">pnl-content</div>,
}));

vi.mock("@/components/finances/FinancesRevenus", () => ({
  FinancesRevenus: () => <div data-testid="finances-revenus">revenus-content</div>,
}));

vi.mock("@/components/finances/FinancesDepenses", () => ({
  FinancesDepenses: () => <div data-testid="finances-depenses">depenses-content</div>,
}));

vi.mock("@/components/tresorerie/TresorerieBanque", () => ({
  TresorerieBanque: () => <div data-testid="tresorerie-banque">tresorerie-content</div>,
}));

vi.mock("lucide-react", () => {
  const icon = ({ className }: { className?: string }) => (
    <svg data-testid="icon" className={className} />
  );
  return {
    Landmark: icon,
    LayoutDashboard: icon,
    Sigma: icon,
    ArrowUpRight: icon,
    ArrowDownRight: icon,
    Wallet: icon,
  };
});

describe("Finances", () => {
  beforeEach(() => {
    pageTitleMock.mockClear();
    headerPropsSpy.mockClear();
    globalSearchPropsSpy.mockClear();
    mrrData.currentMRR = 12345;
    qontoData.connection = {
      bank_accounts: [{ balance: 1500 }, { balance: 2500 }],
    };
  });

  it("rend le titre, les stats calculées et les sections principales", () => {
    render(<Finances />);

    expect(pageTitleMock).toHaveBeenCalledWith("Finances");
    expect(screen.getByText("Finances")).toBeInTheDocument();
    expect(
      screen.getByText("Pilotage financier : indicateurs, P&L, revenus, dépenses et trésorerie")
    ).toBeInTheDocument();

    expect(screen.getByTestId("header-stat-solde").textContent).toContain("solde tréso:4 000");
    expect(screen.getByTestId("header-stat-solde").textContent).toContain("€:true");
    expect(screen.getByTestId("header-stat-mrr").textContent).toContain("MRR:12 345");
    expect(screen.getByTestId("header-stat-mrr").textContent).toContain("€");

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Trésorerie")).toBeInTheDocument();
    expect(screen.getByText("P&L")).toBeInTheDocument();
    expect(screen.getByText("Revenus")).toBeInTheDocument();
    expect(screen.getByText("Dépenses")).toBeInTheDocument();

    expect(screen.getByTestId("finances-dashboard")).toBeInTheDocument();
    expect(screen.getByTestId("tresorerie-banque")).toBeInTheDocument();
    expect(screen.getByTestId("finances-pnl")).toBeInTheDocument();
    expect(screen.getByTestId("finances-revenus")).toBeInTheDocument();
    expect(screen.getByTestId("finances-depenses")).toBeInTheDocument();

    expect(headerPropsSpy).toHaveBeenCalledTimes(1);
    expect(globalSearchPropsSpy).toHaveBeenCalledWith({ open: false, hideTrigger: true });
  });

  it("ouvre puis ferme la recherche globale via les callbacks passés aux enfants", () => {
    render(<Finances />);

    expect(screen.getByText("closed")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "open-search" }));
    expect(screen.getByText("open")).toBeInTheDocument();
    expect(globalSearchPropsSpy).toHaveBeenLastCalledWith({ open: true, hideTrigger: true });

    fireEvent.click(screen.getByRole("button", { name: "close-search" }));
    expect(screen.getByText("closed")).toBeInTheDocument();
    expect(globalSearchPropsSpy).toHaveBeenLastCalledWith({ open: false, hideTrigger: true });
  });

  it("change l'onglet actif via les boutons du header et via le dashboard", () => {
    render(<Finances />);

    expect(screen.getByTestId("tabs-root")).toHaveAttribute("data-value", "dashboard");

    fireEvent.click(screen.getByRole("button", { name: "Trésorerie" }));
    expect(screen.getByTestId("tabs-root")).toHaveAttribute("data-value", "tresorerie");

    fireEvent.click(screen.getByRole("button", { name: "P&L" }));
    expect(screen.getByTestId("tabs-root")).toHaveAttribute("data-value", "pnl");

    fireEvent.click(screen.getByRole("button", { name: "dashboard-go-pnl" }));
    expect(screen.getByTestId("tabs-root")).toHaveAttribute("data-value", "pnl");

    fireEvent.click(screen.getByRole("button", { name: "switch-tabs-mock" }));
    expect(screen.getByTestId("tabs-root")).toHaveAttribute("data-value", "revenus");
  });

  it("gère les valeurs absentes en retombant à 0 € pour le solde et le MRR", () => {
    mrrData.currentMRR = 0;
    qontoData.connection = { bank_accounts: [{ balance: 0 }, {}] };

    render(<Finances />);

    expect(screen.getByTestId("header-stat-solde").textContent).toContain("solde tréso:0");
    expect(screen.getByTestId("header-stat-solde").textContent).toContain("€");
    expect(screen.getByTestId("header-stat-mrr").textContent).toContain("MRR:0");
    expect(screen.getByTestId("header-stat-mrr").textContent).toContain("€");
  });
});