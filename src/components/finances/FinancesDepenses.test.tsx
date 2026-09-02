import { render, screen, fireEvent } from "@testing-library/react";
import { FinancesDepenses } from "./FinancesDepenses";

const { YEAR, DATA, LOADING_DATA, EMPTY_DATA, mockUseAnalyse } = vi.hoisted(() => {
  const YEAR = String(new Date().getFullYear());
  const m1 = `${YEAR}-01`;
  const m2 = `${YEAR}-02`;
  const child = {
    id: "a1",
    nom: "Courses",
    monthlyData: { [m1]: 100 },
    total: 100,
    children: [],
  };
  const nodeA = {
    id: "a",
    nom: "Alimentation",
    monthlyData: { [m1]: 100, [m2]: 200 },
    total: 500,
    children: [child],
  };
  const nodeB = {
    id: "b",
    nom: "Transport",
    monthlyData: { [m1]: 50 },
    total: 50,
    children: [],
  };
  const DATA = {
    isLoading: false,
    months: [m1, m2],
    tree: [nodeA, nodeB],
    grandTotal: { [m1]: 150, [m2]: 200 },
    grandTotalAll: 550,
  };
  const LOADING_DATA = {
    isLoading: true,
    months: [],
    tree: [],
    grandTotal: {},
    grandTotalAll: 0,
  };
  const EMPTY_DATA = {
    isLoading: false,
    months: [],
    tree: [],
    grandTotal: {},
    grandTotalAll: 0,
  };
  return { YEAR, DATA, LOADING_DATA, EMPTY_DATA, mockUseAnalyse: vi.fn() };
});

vi.mock("@/hooks/tresorerie/useTresorerieDepensesParCategorie", () => ({
  useTresorerieDepensesParCategorie: mockUseAnalyse,
}));

vi.mock("@/components/common/PageDataState", () => ({
  PageDataState: ({
    isLoading,
    isEmpty,
    emptyTitle,
    children,
  }: {
    isLoading: boolean;
    isEmpty: boolean;
    emptyTitle?: string;
    children?: React.ReactNode;
  }) => {
    if (isLoading) return <div data-testid="loading-state" />;
    if (isEmpty) return <div data-testid="empty-state">{emptyTitle}</div>;
    return <div data-testid="content-state">{children}</div>;
  },
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children?: React.ReactNode }) => <span data-testid="badge">{children}</span>,
}));

vi.mock("@/components/ui/table", () => ({
  Table: ({ children }: { children?: React.ReactNode }) => <table>{children}</table>,
  TableHeader: ({ children }: { children?: React.ReactNode }) => <thead>{children}</thead>,
  TableBody: ({ children }: { children?: React.ReactNode }) => <tbody>{children}</tbody>,
  TableRow: ({
    children,
    onClick,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
  }) => <tr onClick={onClick}>{children}</tr>,
  TableHead: ({ children }: { children?: React.ReactNode }) => <th>{children}</th>,
  TableCell: ({ children }: { children?: React.ReactNode }) => <td>{children}</td>,
}));

vi.mock("lucide-react", () => ({
  ArrowDownRight: () => null,
  ChevronDown: () => null,
  ChevronRight: () => null,
}));

vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

// Normalise les espaces (Intl utilise des espaces insécables \u202f/\u00a0)
const norm = (s: string) => s.replace(/\s+/g, " ").trim();

const fmt = (value: number) =>
  norm(
    new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(value || 0)
  );

// Matcher robuste : compare le textContent normalisé des cellules <td>
const cellsWithText = (expected: string) =>
  screen.queryAllByText((_content, element) => {
    if (!element || element.tagName !== "TD") return false;
    return norm(element.textContent ?? "") === expected;
  });

describe("FinancesDepenses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAnalyse.mockReturnValue(DATA);
  });

  it("affiche l'état de chargement quand le hook charge", () => {
    mockUseAnalyse.mockReturnValue(LOADING_DATA);
    render(<FinancesDepenses />);
    expect(screen.getByTestId("loading-state")).toBeTruthy();
    expect(screen.queryByText("Postes de dépenses")).toBeNull();
  });

  it("affiche l'état vide quand l'arbre est vide", () => {
    mockUseAnalyse.mockReturnValue(EMPTY_DATA);
    render(<FinancesDepenses />);
    expect(screen.getByTestId("empty-state").textContent).toBe("Aucune dépense");
  });

  it("affiche les postes racine avec les totaux annuels calculés", () => {
    render(<FinancesDepenses />);
    expect(screen.getByText("Postes de dépenses")).toBeTruthy();
    expect(screen.getByText("Alimentation")).toBeTruthy();
    expect(screen.getByText("Transport")).toBeTruthy();

    // Badge total annuel = 150 + 200 = 350 €
    const badge = screen.getByTestId("badge");
    expect(norm(badge.textContent ?? "")).toContain(fmt(350));
    expect(norm(badge.textContent ?? "")).toContain(`Total ${YEAR}`);

    // Total annuel du noeud Alimentation = 100 + 200 = 300 €
    expect(cellsWithText(fmt(300)).length).toBeGreaterThan(0);
    // Moyenne mensuelle Alimentation = 300 / 2 = 150 €
    expect(cellsWithText(fmt(150)).length).toBeGreaterThan(0);
    // Part de Alimentation = 300 / 350 = 85.7 %
    expect(cellsWithText("85.7 %").length).toBe(1);
    // Part de Transport = 50 / 350 = 14.3 %
    expect(cellsWithText("14.3 %").length).toBe(1);
    // Cumul global depuis 2025 = 550 €
    expect(cellsWithText(fmt(550)).length).toBeGreaterThan(0);

    // Ligne de total : 350 € annuel, 175 € / mois, 100 %
    expect(screen.getByText("Total dépenses")).toBeTruthy();
    expect(cellsWithText(fmt(175)).length).toBe(1);
    expect(cellsWithText("100 %").length).toBe(1);
  });

  it("masque les enfants par défaut puis les affiche au clic sur la ligne parent", () => {
    render(<FinancesDepenses />);
    expect(screen.queryByText("Courses")).toBeNull();

    const parentRow = screen.getByText("Alimentation").closest("tr");
    expect(parentRow).not.toBeNull();
    if (parentRow) {
      fireEvent.click(parentRow);
    }
    expect(screen.getByText("Courses")).toBeTruthy();
    // Total annuel de l'enfant Courses = 100 €
    expect(cellsWithText(fmt(100)).length).toBeGreaterThan(0);

    if (parentRow) {
      fireEvent.click(parentRow);
    }
    expect(screen.queryByText("Courses")).toBeNull();
  });

  it("trie les postes racine par total annuel décroissant", () => {
    render(<FinancesDepenses />);
    const alimentation = screen.getByText("Alimentation");
    const transport = screen.getByText("Transport");
    // Alimentation (300 €) doit apparaître avant Transport (50 €)
    const position = alimentation.compareDocumentPosition(transport);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});