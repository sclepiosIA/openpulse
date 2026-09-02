/* @vitest-environment jsdom */
import React from "react";
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { TresorerieJour } from "./TresorerieJour";

const {
  TXS,
  CONNECTION,
  DEPENSES,
  REVENUS,
  OVERRIDES,
  SALAIRES,
  AUTH_STATE,
  mockUseQontoTransactions,
  mockUseTresorerieDepenses,
  mockUseTresorerieRevenus,
  mockUseSalaireProjectionsOverrides,
  mockUseRHSalaires,
  mockFrom,
  toastSuccess,
  toastError,
} = vi.hoisted(() => {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();

  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const currentMonthDay10 = new Date(y, m, 10);
  const currentMonthDay12 = new Date(y, m, 12);
  const currentMonthDay15 = new Date(y, m, 15);

  const nextMonth = new Date(y, m + 1, 1);
  const nextMonthDay01 = new Date(y, m + 1, 1);
  const nextMonthDay20 = new Date(y, m + 1, 20);

  return {
    TXS: [
      {
        id: "tx-debit-1",
        date_operation: fmt(currentMonthDay10),
        montant: -120.5,
        type_operation: "debit",
        libelle: "Fournitures Bureau",
      },
      {
        id: "tx-credit-1",
        date_operation: fmt(currentMonthDay12),
        montant: 350,
        type_operation: "credit",
        libelle: "Versement Client",
      },
    ],
    CONNECTION: {
      bank_accounts: [{ balance: 1000 }],
    },
    DEPENSES: [
      {
        id: "dep-futur-1",
        nom: "Loyer bureau principal",
        montant: 800,
        date_prevue: fmt(nextMonthDay20),
        statut: "en_attente",
        source: "manuel",
      },
      {
        id: "dep-late-1",
        nom: "Facture reportée",
        montant: 150,
        date_prevue: "1900-01-01",
        statut: "a_payer_plus_tard",
        source: "manuel",
      },
    ],
    REVENUS: [
      {
        id: "rev-paid-no-tx",
        statut: "paye",
        source_modele: "qonto",
        date_paiement_reel: fmt(currentMonthDay15),
        montant_paye: 200,
        montant_prevu: 200,
        notes: "[Qonto] Régul client",
        type_revenu: "Commission",
        etablissements: { nom: "Clinique A" },
      },
      {
        id: "rev-futur-1",
        statut: "a_recevoir",
        mois: `${nextMonth.getFullYear()}-${pad(nextMonth.getMonth() + 1)}`,
        date_facture: fmt(nextMonthDay01),
        montant_prevu: 600,
        etablissements: { nom: "Cabinet B" },
        type_revenu: "Consultation",
      },
    ],
    OVERRIDES: [
      { profile_id: "p1", mois: `${nextMonth.getFullYear()}-${pad(nextMonth.getMonth() + 1)}-01`, montant: 2100 },
    ],
    SALAIRES: [
      {
        profile_id: "p1",
        mois: `${y}-${pad(m === 0 ? 12 : m)}-01`,
        net_paye: 1800,
        salaire_net: 1800,
        profiles: { prenom: "Jean", nom: "Dupont" },
      },
    ],
    AUTH_STATE: {
      user: { id: "u1", email: "t@t.co" },
      session: { user: { id: "u1" } },
      isLoading: false,
    },
    mockUseQontoTransactions: vi.fn(),
    mockUseTresorerieDepenses: vi.fn(),
    mockUseTresorerieRevenus: vi.fn(),
    mockUseSalaireProjectionsOverrides: vi.fn(),
    mockUseRHSalaires: vi.fn(),
    mockFrom: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
  };
});

vi.mock("@/integrations/supabase/client", () => {
  const result = { data: null, error: null };
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
    upsert: vi.fn(() => builder),
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(resolve(result)),
    catch: vi.fn(),
  };
  mockFrom.mockReturnValue(builder);
  return { supabase: { from: mockFrom } };
});

vi.mock("@/hooks/tresorerie/useQontoTransactions", () => ({
  useQontoTransactions: mockUseQontoTransactions,
}));

vi.mock("@/hooks/tresorerie/useTresorerieDepenses", () => ({
  useTresorerieDepenses: mockUseTresorerieDepenses,
}));

vi.mock("@/hooks/tresorerie/useTresorerieRevenus", () => ({
  useTresorerieRevenus: mockUseTresorerieRevenus,
}));

vi.mock("@/hooks/hr/useSalaireProjectionsOverrides", () => ({
  useSalaireProjectionsOverrides: mockUseSalaireProjectionsOverrides,
}));

vi.mock("@/hooks/hr/useRHSalaires", () => ({
  useRHSalaires: mockUseRHSalaires,
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
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

vi.mock("@/lib/utils", () => ({
  cn: (...args: Array<string | false | null | undefined>) => args.filter(Boolean).join(" "),
}));

vi.mock("@/lib/formatters", () => ({
  formatCurrency: (n: number) => `${n.toFixed(2)} €`,
}));

vi.mock("@/lib/frenchHolidays", () => ({
  isFrenchHoliday: () => false,
}));

vi.mock("lucide-react", () => ({
  Clock: () => React.createElement("span", { "data-testid": "icon-clock" }),
  TrendingUp: () => React.createElement("span", { "data-testid": "icon-up" }),
  TrendingDown: () => React.createElement("span", { "data-testid": "icon-down" }),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => React.createElement("div", {}, children),
  CardContent: ({ children }: { children: React.ReactNode }) => React.createElement("div", {}, children),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) =>
    React.createElement("button", props, children),
}));

vi.mock("@/components/ui/table", () => ({
  Table: ({ children }: { children: React.ReactNode }) => React.createElement("table", {}, children),
  TableBody: ({ children }: { children: React.ReactNode }) => React.createElement("tbody", {}, children),
  TableCell: ({ children }: { children: React.ReactNode }) => React.createElement("td", {}, children),
  TableHead: ({ children }: { children: React.ReactNode }) => React.createElement("th", {}, children),
  TableHeader: ({ children }: { children: React.ReactNode }) => React.createElement("thead", {}, children),
  TableRow: ({ children }: { children: React.ReactNode }) => React.createElement("tr", {}, children),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => React.createElement("span", {}, children),
}));

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: () => React.createElement("div", { "data-testid": "skeleton" }),
}));

vi.mock("./DayDetailTooltip", () => ({
  DayDetailTooltip: ({ children }: { children: React.ReactNode }) => React.createElement("div", {}, children),
}));

vi.mock("./CreateDepensePrevisionnelleDialog", () => ({
  CreateDepensePrevisionnelleDialog: () => React.createElement("div", { "data-testid": "create-depense-dialog" }),
}));

vi.mock("./CreateRecettePrevisionnelleDialog", () => ({
  CreateRecettePrevisionnelleDialog: () => React.createElement("div", { "data-testid": "create-recette-dialog" }),
}));

vi.mock("./DepenseActionsDialog", () => ({
  DepenseActionsDialog: () => React.createElement("div", { "data-testid": "depense-actions-dialog" }),
}));

vi.mock("./EditDepenseDialog", () => ({
  EditDepenseDialog: () => React.createElement("div", { "data-testid": "edit-depense-dialog" }),
}));

vi.mock("./APayerPlusTardDialog", () => ({
  APayerPlusTardDialog: () => React.createElement("div", { "data-testid": "a-payer-plus-tard-dialog" }),
}));

vi.mock("./SalairePrevActionsDialog", () => ({
  SalairePrevActionsDialog: () => React.createElement("div", { "data-testid": "salaire-prev-dialog" }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("TresorerieJour", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseQontoTransactions.mockReturnValue({
      transactions: TXS,
      connection: CONNECTION,
      isLoading: false,
      isError: false,
      error: null,
    });

    mockUseTresorerieDepenses.mockReturnValue({
      depenses: DEPENSES,
      isLoading: false,
      isError: false,
      error: null,
    });

    mockUseTresorerieRevenus.mockReturnValue({
      revenus: REVENUS,
      isLoading: false,
      isError: false,
      error: null,
    });

    mockUseSalaireProjectionsOverrides.mockReturnValue({
      overrides: OVERRIDES,
      isLoading: false,
      isError: false,
      error: null,
      getApplicableOverride: (profileId: string, mois: string) =>
        OVERRIDES.find((o) => o.profile_id === profileId && o.mois === mois),
    });

    mockUseRHSalaires.mockReturnValue({
      salaires: SALAIRES,
      isLoading: false,
      isError: false,
      error: null,
    });
  });

  it("affiche un état de chargement quand une source est loading", () => {
    mockUseQontoTransactions.mockReturnValue({
      transactions: TXS,
      connection: CONNECTION,
      isLoading: true,
      isError: false,
      error: null,
    });

    const Wrapper = createWrapper();
    render(React.createElement(TresorerieJour), { wrapper: Wrapper });

    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);
  });

  it("agrège les données métier visibles sans compter le revenu historique payé si le jour n'est pas prévisionnel", () => {
    const Wrapper = createWrapper();
    const { container } = render(React.createElement(TresorerieJour), { wrapper: Wrapper });
    const text = container.textContent ?? "";

    expect(text).toContain("Fournitures Bur");
    expect(text).toContain("Versement Cl");
    expect(text).toContain("Loyer bureau p");
    expect(text).toContain("Cabinet B");
    expect(text).toContain("Sal. Jean");

    expect(text).toContain("120.50");
    expect(text).toContain("350.00");
    expect(text).toContain("800.00");
    expect(text).toContain("600.00");
    expect(text).toContain("2100.00");

    const historiquePaye = REVENUS[0];
    const dateHistorique = new Date(historiquePaye.date_paiement_reel);
    const titreMoisHistorique = format(dateHistorique, "MMMM yyyy", { locale: fr });
    const libelleJourHistorique = format(dateHistorique, "EEEEEE dd", { locale: fr });
    const titreMois = screen.getByRole("heading", { name: titreMoisHistorique });
    const tableauMois = titreMois.parentElement?.nextElementSibling?.querySelector("table");

    if (!tableauMois) {
      throw new Error("Tableau du mois du revenu historique introuvable");
    }

    const ligneHistorique = within(tableauMois).getByText(libelleJourHistorique).closest("tr");
    if (!ligneHistorique) {
      throw new Error("Ligne du revenu historique introuvable");
    }

    expect(text).not.toContain("Régul client");
    expect(within(ligneHistorique).queryByText("Régul client")).not.toBeInTheDocument();

    // La colonne Recettes (et non le solde de la ligne) ne doit pas inclure les 200.00 € payés hors transaction Qonto.
    const celluleRecettesHistorique = ligneHistorique.querySelectorAll("td")[1];
    expect(celluleRecettesHistorique).not.toHaveTextContent("200.00");
  });

  it("supporte les erreurs des hooks sans réseau réel", () => {
    mockUseQontoTransactions.mockReturnValue({
      transactions: null,
      connection: CONNECTION,
      isLoading: false,
      isError: true,
      error: { message: "x" },
    });

    mockUseTresorerieDepenses.mockReturnValue({
      depenses: null,
      isLoading: false,
      isError: true,
      error: { message: "x" },
    });

    mockUseTresorerieRevenus.mockReturnValue({
      revenus: null,
      isLoading: false,
      isError: true,
      error: { message: "x" },
    });

    mockUseSalaireProjectionsOverrides.mockReturnValue({
      overrides: [],
      isLoading: false,
      isError: true,
      error: { message: "x" },
      getApplicableOverride: () => undefined,
    });

    mockUseRHSalaires.mockReturnValue({
      salaires: [],
      isLoading: false,
      isError: true,
      error: { message: "x" },
    });

    const Wrapper = createWrapper();
    const { container } = render(React.createElement(TresorerieJour), { wrapper: Wrapper });

    expect(container).toBeTruthy();
    expect(mockFrom).not.toHaveBeenCalled();
    expect((container.textContent ?? "").includes("undefined")).toBe(false);
  });
});