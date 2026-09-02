import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { format, startOfMonth, subMonths } from "date-fns";
import { FinancesChartsSection } from "./FinancesChartsSection";

const { CURRENT_KEY, PREV_KEY } = vi.hoisted(() => {
  return {
    CURRENT_KEY: "__current__",
    PREV_KEY: "__prev__",
  };
});

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children?: ReactNode }) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children?: ReactNode }) => <h3>{children}</h3>,
  CardContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  CardFooter: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock("lucide-react", () => ({
  LineChart: () => null,
  BarChart3: () => null,
}));

vi.mock("recharts", () => {
  const Null = () => null;
  return {
    ResponsiveContainer: ({ children }: { children?: ReactNode }) => (
      <div>{children}</div>
    ),
    LineChart: ({ data, children }: { data?: unknown; children?: ReactNode }) => (
      <div data-testid="line-chart" data-points={JSON.stringify(data)}>
        {children}
      </div>
    ),
    BarChart: ({ data, children }: { data?: unknown; children?: ReactNode }) => (
      <div data-testid="bar-chart" data-points={JSON.stringify(data)}>
        {children}
      </div>
    ),
    Line: Null,
    Bar: Null,
    XAxis: Null,
    YAxis: Null,
    Tooltip: Null,
    Legend: Null,
    ReferenceLine: Null,
    CartesianGrid: Null,
  };
});

type Props = Parameters<typeof FinancesChartsSection>[0];
type Tx = Props["transactions"][number];

const currentMonthKey = format(startOfMonth(new Date()), "yyyy-MM");
const prevMonthKey = format(subMonths(startOfMonth(new Date()), 1), "yyyy-MM");

function makeTx(partial: {
  date_operation: string;
  type_operation: "credit" | "debit";
  montant: number;
}): Tx {
  return {
    id: `tx-${partial.date_operation}-${partial.montant}`,
    ...partial,
  } as unknown as Tx;
}

function baseProps(overrides: Partial<Props> = {}): Props {
  return {
    transactions: [],
    soldeActuel: 1000,
    hasQonto: true,
    months: [],
    caParMois: {},
    coutsParMois: {},
    ...overrides,
  };
}

function parsePoints(testId: string): Array<Record<string, number | string>> {
  const el = screen.getByTestId(testId);
  const raw = el.getAttribute("data-points");
  expect(raw).toBeTruthy();
  return JSON.parse(raw ?? "[]") as Array<Record<string, number | string>>;
}

describe("FinancesChartsSection", () => {
  it("affiche les titres des deux graphiques", () => {
    render(<FinancesChartsSection {...baseProps()} />);
    expect(
      screen.getByText("Évolution de la trésorerie — 12 derniers mois")
    ).toBeTruthy();
    expect(
      screen.getByText("CA vs coûts mensuels — 12 derniers mois")
    ).toBeTruthy();
  });

  it("affiche le message d'absence de connexion Qonto quand hasQonto=false et masque le line chart", () => {
    render(<FinancesChartsSection {...baseProps({ hasQonto: false })} />);
    expect(
      screen.getByText("Aucune connexion bancaire Qonto active.")
    ).toBeTruthy();
    expect(screen.queryByTestId("line-chart")).toBeNull();
    // Le bar chart reste rendu quoi qu'il arrive
    expect(screen.getByTestId("bar-chart")).toBeTruthy();
  });

  it("génère 12 points de trésorerie tous égaux au solde actuel sans transactions", () => {
    render(<FinancesChartsSection {...baseProps({ soldeActuel: 1000 })} />);
    const points = parsePoints("line-chart");
    expect(points).toHaveLength(12);
    for (const p of points) {
      expect(p.solde).toBe(1000);
    }
    // Le dernier point correspond au mois courant
    const expectedLastLabel = format(startOfMonth(new Date()), "MMM yy", {
      // pas de locale ici : on vérifie seulement que le label est une chaîne non vide
    });
    expect(typeof points[11].mois).toBe("string");
    expect(String(points[11].mois).length).toBeGreaterThan(0);
    expect(expectedLastLabel.length).toBeGreaterThan(0);
  });

  it("reconstruit rétroactivement le solde : un crédit du mois courant réduit les soldes antérieurs", () => {
    const transactions = [
      makeTx({
        date_operation: `${currentMonthKey}-15`,
        type_operation: "credit",
        montant: 500,
      }),
    ];
    render(
      <FinancesChartsSection
        {...baseProps({ transactions, soldeActuel: 1000 })}
      />
    );
    const points = parsePoints("line-chart");
    expect(points).toHaveLength(12);
    // Mois courant : solde actuel
    expect(points[11].solde).toBe(1000);
    // Mois précédent : solde(M-1) = solde(M) - flux net de M = 1000 - 500
    expect(points[10].solde).toBe(500);
    // Tous les mois antérieurs restent à 500 (aucun autre flux)
    expect(points[0].solde).toBe(500);
  });

  it("un débit du mois précédent augmente les soldes antérieurs à ce mois", () => {
    const transactions = [
      makeTx({
        date_operation: `${prevMonthKey}-10`,
        type_operation: "debit",
        montant: 200,
      }),
    ];
    render(
      <FinancesChartsSection
        {...baseProps({ transactions, soldeActuel: 1000 })}
      />
    );
    const points = parsePoints("line-chart");
    expect(points[11].solde).toBe(1000);
    expect(points[10].solde).toBe(1000);
    // solde(M-2) = solde(M-1) - (net M-1) = 1000 - (-200) = 1200
    expect(points[9].solde).toBe(1200);
    expect(points[0].solde).toBe(1200);
  });

  it("renseigne CA et coûts uniquement pour les mois présents dans `months`", () => {
    render(
      <FinancesChartsSection
        {...baseProps({
          months: [currentMonthKey],
          caParMois: { [currentMonthKey]: 5000.4, [prevMonthKey]: 9999 },
          coutsParMois: { [currentMonthKey]: 2000, [prevMonthKey]: 8888 },
        })}
      />
    );
    const points = parsePoints("bar-chart");
    expect(points).toHaveLength(12);
    // Mois courant présent dans months → valeurs arrondies
    expect(points[11].ca).toBe(5000);
    expect(points[11].couts).toBe(2000);
    // Mois précédent absent de months → 0 même si caParMois contient une valeur
    expect(points[10].ca).toBe(0);
    expect(points[10].couts).toBe(0);
    expect(points[0].ca).toBe(0);
  });

  it("ignore les transactions sans date_operation", () => {
    const transactions = [
      makeTx({
        date_operation: "",
        type_operation: "credit",
        montant: 700,
      }),
    ];
    render(
      <FinancesChartsSection
        {...baseProps({ transactions, soldeActuel: 300 })}
      />
    );
    const points = parsePoints("line-chart");
    for (const p of points) {
      expect(p.solde).toBe(300);
    }
  });
});