import { render, screen } from "@testing-library/react";
import { FinancesPnL } from "./FinancesPnL";

const { HOOK_DATA, LOADING_DATA, mockUseAnalyse } = vi.hoisted(() => {
  const y = new Date().getFullYear();
  const jan = `${y}-01`;
  const HOOK_DATA = {
    isLoading: false,
    months: [jan, `${y}-02`],
    revenueGrandTotal: { [jan]: 5000 },
    tree: [
      { code: "DEP_CHARGES_EXT", monthlyData: { [jan]: 2000 } },
      { code: "DEP_SALAIRES", monthlyData: { [jan]: 1000 } },
    ],
  };
  const LOADING_DATA = {
    isLoading: true,
    months: [],
    revenueGrandTotal: {},
    tree: [],
  };
  return { HOOK_DATA, LOADING_DATA, mockUseAnalyse: vi.fn() };
});

vi.mock("@/hooks/tresorerie/useTresorerieDepensesParCategorie", () => ({
  useTresorerieDepensesParCategorie: mockUseAnalyse,
}));

vi.mock("@/components/common/PageDataState", () => ({
  PageDataState: ({
    isLoading,
    children,
  }: {
    isLoading: boolean;
    isError: boolean;
    children: React.ReactNode;
  }) => (isLoading ? <div data-testid="page-loading" /> : <>{children}</>),
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="select">{children}</div>
  ),
  SelectTrigger: ({ children }: { children?: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
  SelectValue: () => null,
  SelectContent: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SelectItem: ({ children }: { children?: React.ReactNode }) => (
    <div role="option" aria-selected={false}>
      {children}
    </div>
  ),
}));

vi.mock("lucide-react", () => ({
  Sigma: () => <svg data-testid="icon-sigma" />,
}));

describe("FinancesPnL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAnalyse.mockReturnValue(HOOK_DATA);
  });

  it("affiche l'état de chargement quand le hook charge", () => {
    mockUseAnalyse.mockReturnValue(LOADING_DATA);
    render(<FinancesPnL />);
    expect(screen.getByTestId("page-loading")).toBeInTheDocument();
    expect(
      screen.queryByText("Soldes intermédiaires de gestion")
    ).not.toBeInTheDocument();
  });

  it("affiche le titre, le badge et les libellés des postes du P&L", () => {
    render(<FinancesPnL />);
    expect(
      screen.getByText("Soldes intermédiaires de gestion")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Vue mensualisée · réel + prévu")
    ).toBeInTheDocument();
    expect(screen.getByText("Chiffre d'affaires")).toBeInTheDocument();
    expect(screen.getByText("Valeur ajoutée")).toBeInTheDocument();
    expect(
      screen.getByText("Excédent brut d'exploitation (EBE)")
    ).toBeInTheDocument();
    expect(screen.getByText("Résultat courant")).toBeInTheDocument();
    expect(screen.getByText("Flux net de l'exercice")).toBeInTheDocument();
    expect(
      screen.getByText("– Consommations et charges externes")
    ).toBeInTheDocument();
    expect(screen.getByText("– Charges de personnel")).toBeInTheDocument();
  });

  it("calcule et affiche les valeurs métier : CA 5000, VA 3000, EBE 2000", () => {
    render(<FinancesPnL />);
    // CA janvier = 5000 € (valeur mensuelle + total identique → 2 occurrences)
    expect(screen.getAllByText(/5\s000\s€/).length).toBeGreaterThanOrEqual(2);
    // VA = 5000 - 2000 (consommations) = 3000 €
    expect(screen.getAllByText(/3\s000\s€/).length).toBeGreaterThanOrEqual(2);
    // EBE = 3000 - 1000 (personnel) = 2000 € ; charges externes affichées en -2000
    expect(screen.getAllByText(/2\s000\s€/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/-2\s000\s€/).length).toBeGreaterThanOrEqual(2);
    // Les mois sans données affichent le tiret "–"
    expect(screen.getAllByText("–").length).toBeGreaterThan(10);
  });

  it("affiche les 12 en-têtes de mois et la colonne Total", () => {
    render(<FinancesPnL />);
    const monthLabels = [
      "Jan",
      "Fév",
      "Mar",
      "Avr",
      "Mai",
      "Juin",
      "Juil",
      "Août",
      "Sep",
      "Oct",
      "Nov",
      "Déc",
    ];
    monthLabels.forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getByText("Poste")).toBeInTheDocument();
  });

  it("propose l'année en cours dans le sélecteur avec le suffixe '(en cours)'", () => {
    render(<FinancesPnL />);
    const currentYear = new Date().getFullYear();
    expect(
      screen.getByText(`${currentYear} (en cours)`)
    ).toBeInTheDocument();
  });
});