import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

const {
  MOCK_TRANSACTIONS,
  MOCK_CONNECTION,
  MOCK_FACTURES,
  MOCK_UNPAID_FACTURES,
  mockUseQontoTransactions,
  mockUseFactures,
  mockSupabaseFrom,
  mockToastSuccess,
  mockToastError,
  mockSanitizeSupabaseError,
} = vi.hoisted(() => {
  const MOCK_TRANSACTIONS = [
    {
      id: "t1",
      montant: 100,
      date_operation: "2024-01-10",
      libelle: "Paiement ACME facture FAC-001",
      reconcilie: false,
    },
    {
      id: "t2",
      montant: 200,
      date_operation: "2024-01-15",
      libelle: "Virement inconnu",
      reconcilie: false,
    },
  ];

  const MOCK_CONNECTION = {
    bank_accounts: [
      {
        balance: 1234.56,
      },
    ],
    last_sync_at: "2024-01-20T10:00:00.000Z",
  };

  const MOCK_FACTURES = [
    {
      id: "f1",
      numero: "FAC-001",
      client_nom: "ACME Corporation",
      montant_ttc: 100,
      date_echeance: "2024-01-11",
      statut: "en_attente",
    },
    {
      id: "f2",
      numero: "FAC-002",
      client_nom: "Other Client",
      montant_ttc: 300,
      date_echeance: "2024-01-30",
      statut: "payee",
    },
  ];

  const MOCK_UNPAID_FACTURES = [
    {
      id: "f3",
      numero: "FAC-003",
      client_nom: "Client B",
      montant_ttc: 150,
      date_echeance: "2024-02-10",
      statut: "brouillon",
    },
  ];

  const mockUseQontoTransactions = vi.fn();
  const mockUseFactures = vi.fn();

  const buildQueryResult = (data: unknown, error: unknown = null) => {
    return Promise.resolve({ data, error });
  };

  const mockSupabaseFrom = vi.fn((table: string) => {
    const builder: any = {
      table,
      params: {},
      update(values: unknown) {
        builder.params.update = values;
        return builder;
      },
      insert(values: unknown) {
        builder.params.insert = values;
        return builder;
      },
      delete() {
        builder.params.delete = true;
        return builder;
      },
      select() {
        return builder;
      },
      eq(column: string, value: unknown) {
        builder.params[column] = value;
        return builder;
      },
      gte() {
        return builder;
      },
      lte() {
        return builder;
      },
      in() {
        return builder;
      },
      order() {
        return builder;
      },
      limit() {
        return builder;
      },
      single() {
        return buildQueryResult(null, null);
      },
      maybeSingle() {
        return buildQueryResult(null, null);
      },
      then(onFulfilled: (value: unknown) => void, onRejected?: (reason: unknown) => void) {
        return buildQueryResult(null, null).then(onFulfilled, onRejected);
      },
      catch(onRejected: (reason: unknown) => void) {
        return buildQueryResult(null, null).catch(onRejected);
      },
    };
    return builder;
  });

  const mockToastSuccess = vi.fn();
  const mockToastError = vi.fn();
  const mockSanitizeSupabaseError = vi.fn((error: unknown) => {
    if (error && typeof error === "object" && "message" in (error as any)) {
      return (error as { message?: string }).message || "Erreur";
    }
    return "Erreur";
  });

  return {
    MOCK_TRANSACTIONS,
    MOCK_CONNECTION,
    MOCK_FACTURES,
    MOCK_UNPAID_FACTURES,
    mockUseQontoTransactions,
    mockUseFactures,
    mockSupabaseFrom,
    mockToastSuccess,
    mockToastError,
    mockSanitizeSupabaseError,
  };
});

vi.mock("@/hooks/tresorerie/useQontoTransactions", () => ({
  useQontoTransactions: mockUseQontoTransactions,
}));

vi.mock("@/hooks/billing/useFactures", () => ({
  useFactures: mockUseFactures,
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
  CardHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card-header">{children}</div>
  ),
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 data-testid="card-title" className={className}>
      {children}
    </h2>
  ),
  CardDescription: ({ children }: { children: React.ReactNode }) => (
    <p data-testid="card-description">{children}</p>
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, disabled, className }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; className?: string }) => (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span data-testid="badge" className={className}>
      {children}
    </span>
  ),
}));

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={className} />
  ),
}));

vi.mock("lucide-react", () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />;
  return {
    RefreshCw: Icon,
    Link2: Icon,
    Link2Off: Icon,
    Landmark: Icon,
    ArrowRight: Icon,
    CheckCircle2: Icon,
    AlertCircle: Icon,
    Clock: Icon,
    Euro: Icon,
  };
});

vi.mock("@/lib/utils", () => ({
  cn: (...classes: string[]) => classes.filter(Boolean).join(" "),
}));

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock("@/lib/supabaseErrorSanitizer", () => ({
  sanitizeSupabaseError: mockSanitizeSupabaseError,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockSupabaseFrom,
  },
}));

vi.mock("@/components/AuthProvider", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "test@example.com" },
    session: { user: { id: "u1" } },
    isLoading: false,
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "test@example.com" },
    session: { user: { id: "u1" } },
    isLoading: false,
  }),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

import { FacturationQontoReconciliation } from "./FacturationQontoReconciliation";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 0,
        gcTime: 0,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

function renderWithClient(ui: React.ReactElement) {
  const client = createQueryClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("FacturationQontoReconciliation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche les skeletons quand les données chargent", () => {
    mockUseQontoTransactions.mockReturnValue({
      transactions: [],
      connection: null,
      isLoading: true,
      sync: vi.fn(),
      isSyncing: false,
    });

    mockUseFactures.mockReturnValue({
      factures: [],
      isLoading: true,
    });

    renderWithClient(<FacturationQontoReconciliation />);

    const skeletons = screen.getAllByTestId("skeleton");
    expect(skeletons.length).toBeGreaterThanOrEqual(2);
  });

  it("affiche les KPI, suggestions et états quand les données sont chargées", () => {
    mockUseQontoTransactions.mockReturnValue({
      transactions: MOCK_TRANSACTIONS,
      connection: MOCK_CONNECTION,
      isLoading: false,
      sync: vi.fn(),
      isSyncing: false,
    });

    mockUseFactures.mockReturnValue({
      factures: MOCK_FACTURES,
      isLoading: false,
    });

    renderWithClient(<FacturationQontoReconciliation />);

    expect(screen.getByText("Solde Qonto")).toBeInTheDocument();
    expect(screen.getByText("Crédits non rapprochés")).toBeInTheDocument();
    expect(screen.getByText("Factures en attente")).toBeInTheDocument();
    expect(screen.getByText("Suggestions")).toBeInTheDocument();

    expect(screen.getByText(/rapprochement bancaire/i)).toBeInTheDocument();
    expect(screen.getByText(/Rapprocher/)).toBeInTheDocument();

    expect(
      screen.getByText((content) => content.includes("Dernière sync"))
    ).toBeInTheDocument();

    const facBadge = screen.getByText("FAC-001");
    expect(facBadge).toBeInTheDocument();
    const clientName = screen.getByText("ACME Corporation");
    expect(clientName).toBeInTheDocument();

    const suggestionsCount = screen.getByText(/rapprochements possibles/i).previousSibling as HTMLElement;
    expect(suggestionsCount.textContent).toBe("1");
  });

  it("affiche le message tout est à jour quand aucune transaction ni facture", () => {
    mockUseQontoTransactions.mockReturnValue({
      transactions: [],
      connection: { bank_accounts: [], last_sync_at: null },
      isLoading: false,
      sync: vi.fn(),
      isSyncing: false,
    });

    mockUseFactures.mockReturnValue({
      factures: [],
      isLoading: false,
    });

    renderWithClient(<FacturationQontoReconciliation />);

    expect(screen.getByText(/Tout est à jour/i)).toBeInTheDocument();
    expect(screen.getByText(/Aucun rapprochement en attente/i)).toBeInTheDocument();
  });

  it("affiche le message aucune correspondance trouvée quand pas de suggestions mais des éléments en attente", () => {
    mockUseQontoTransactions.mockReturnValue({
      transactions: [
        {
          id: "tX",
          montant: 999,
          date_operation: "2024-03-01",
          libelle: "Transaction sans correspondance",
          reconcilie: false,
        },
      ],
      connection: MOCK_CONNECTION,
      isLoading: false,
      sync: vi.fn(),
      isSyncing: false,
    });

    mockUseFactures.mockReturnValue({
      factures: MOCK_UNPAID_FACTURES,
      isLoading: false,
    });

    renderWithClient(<FacturationQontoReconciliation />);

    expect(screen.getByText(/Aucune correspondance trouvée/i)).toBeInTheDocument();
    expect(
      screen.getByText((content) => content.includes("1 crédit") && content.includes("1 facture"))
    ).toBeInTheDocument();
  });

  it("appelle la mutation de rapprochement (supabase) et invalide les caches en cas de succès", async () => {
    const mockSync = vi.fn();

    mockUseQontoTransactions.mockReturnValue({
      transactions: MOCK_TRANSACTIONS,
      connection: MOCK_CONNECTION,
      isLoading: false,
      sync: mockSync,
      isSyncing: false,
    });

    mockUseFactures.mockReturnValue({
      factures: MOCK_FACTURES,
      isLoading: false,
    });

    const transUpdateSpy = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    const factUpdateSpy = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    mockSupabaseFrom.mockImplementation((table: string) => {
      const builder: any = {
        update(values: unknown) {
          if (table === "tresorerie_operations_bancaires") {
            return transUpdateSpy(values);
          }
          if (table === "factures") {
            return factUpdateSpy(values);
          }
          return builder;
        },
        eq(_column: string, _value: unknown) {
          return Promise.resolve({ data: null, error: null });
        },
        then(onFulfilled: (value: unknown) => void, onRejected?: (reason: unknown) => void) {
          return Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected);
        },
        catch(onRejected: (reason: unknown) => void) {
          return Promise.resolve({ data: null, error: null }).catch(onRejected);
        },
      };
      return builder;
    });

    const invalidateSpy = vi.spyOn(QueryClient.prototype, "invalidateQueries");

    renderWithClient(<FacturationQontoReconciliation />);

    const reconcileButton = screen.getAllByText(/Rapprocher/)[0];
    fireEvent.click(reconcileButton);

    await waitFor(() => {
      expect(transUpdateSpy).toHaveBeenCalledTimes(1);
      expect(factUpdateSpy).toHaveBeenCalledTimes(1);
    });

    expect(transUpdateSpy).toHaveBeenCalledWith({
      reconcilie: true,
      notes: "Rapproché avec facture FAC-001",
    });

    expect(factUpdateSpy).toHaveBeenCalledWith({
      statut: "payee",
      date_paiement: MOCK_TRANSACTIONS[0].date_operation,
    });

    expect(mockToastSuccess).toHaveBeenCalledWith("Rapprochement effectué", {
      description: "Facture FAC-001 marquée comme payée",
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["qonto-transactions"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["factures"] });
  });

  it("affiche une erreur toast si la mise à jour supabase échoue", async () => {
    mockUseQontoTransactions.mockReturnValue({
      transactions: MOCK_TRANSACTIONS,
      connection: MOCK_CONNECTION,
      isLoading: false,
      sync: vi.fn(),
      isSyncing: false,
    });

    mockUseFactures.mockReturnValue({
      factures: MOCK_FACTURES,
      isLoading: false,
    });

    const updateError = { message: "update failed" };

    const transUpdateSpy = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: updateError }),
    });

    const factUpdateSpy = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    mockSupabaseFrom.mockImplementation((table: string) => {
      const builder: any = {
        update(values: unknown) {
          if (table === "tresorerie_operations_bancaires") {
            return transUpdateSpy(values);
          }
          if (table === "factures") {
            return factUpdateSpy(values);
          }
          return builder;
        },
        eq(_column: string, _value: unknown) {
          if (table === "tresorerie_operations_bancaires") {
            return Promise.resolve({ data: null, error: updateError });
          }
          return Promise.resolve({ data: null, error: null });
        },
        then(onFulfilled: (value: unknown) => void, onRejected?: (reason: unknown) => void) {
          return Promise.resolve({ data: null, error: updateError }).then(onFulfilled, onRejected);
        },
        catch(onRejected: (reason: unknown) => void) {
          return Promise.resolve({ data: null, error: updateError }).catch(onRejected);
        },
      };
      return builder;
    });

    renderWithClient(<FacturationQontoReconciliation />);

    const reconcileButton = screen.getAllByText(/Rapprocher/)[0];
    fireEvent.click(reconcileButton);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledTimes(1);
    });

    expect(mockSanitizeSupabaseError).toHaveBeenCalledWith(updateError);
    expect(mockToastError).toHaveBeenCalledWith("Erreur lors du rapprochement", {
      description: "update failed",
    });
  });

  it("déclenche la synchronisation Qonto via le bouton", () => {
    const syncMock = vi.fn();

    mockUseQontoTransactions.mockReturnValue({
      transactions: MOCK_TRANSACTIONS,
      connection: MOCK_CONNECTION,
      isLoading: false,
      sync: syncMock,
      isSyncing: false,
    });

    mockUseFactures.mockReturnValue({
      factures: MOCK_FACTURES,
      isLoading: false,
    });

    renderWithClient(<FacturationQontoReconciliation />);

    const syncButton = screen.getByText(/Synchroniser Qonto/i);
    fireEvent.click(syncButton);

    expect(syncMock).toHaveBeenCalledWith({});
  });
});