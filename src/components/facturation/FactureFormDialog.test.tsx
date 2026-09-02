import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { FactureFormDialog } from "./FactureFormDialog";

const {
  ETABS,
  AUTH_STATE,
  MODELE_LOADING,
  MODELE_SUCCESS,
  MODELE_NULL,
  INSERTED_FACTURE,
  mockFrom,
  mockInvoke,
  toastSuccess,
  toastError,
  debugWarn,
  debugError,
  invalidateQueriesSpy,
} = vi.hoisted(() => {
  const ETABS = [
    {
      id: "etab-1",
      nom: "Clinique Alpha",
      ville: "Paris",
      email_facturation: "facturation@alpha.fr",
      adresse_facturation: "1 rue de Paris",
      siret_facturation: "12345678901234",
      conditions_paiement_defaut: "30 jours",
    },
    {
      id: "etab-2",
      nom: "Cabinet Beta",
      ville: "Lyon",
      email_facturation: null,
      adresse_facturation: null,
      siret_facturation: null,
      conditions_paiement_defaut: "45 jours",
    },
  ];

  const AUTH_STATE = {
    user: { id: "user-1", email: "user@test.fr" },
    session: { user: { id: "user-1" } },
    isLoading: false,
  };

  const MODELE_LOADING = { data: undefined, isLoading: true };
  const MODELE_SUCCESS = {
    data: {
      modele: "Succès",
      periodicite: "mensuelle",
      montant_annuel: 1200,
      montant_periodique: 100,
      pallier_vise: "50 patients",
    },
    isLoading: false,
  };
  const MODELE_NULL = { data: null, isLoading: false };

  const INSERTED_FACTURE = { id: "fact-1" };

  const mockFrom = vi.fn();
  const mockInvoke = vi.fn();
  const toastSuccess = vi.fn();
  const toastError = vi.fn();
  const debugWarn = vi.fn();
  const debugError = vi.fn();
  const invalidateQueriesSpy = vi.fn();

  return {
    ETABS,
    AUTH_STATE,
    MODELE_LOADING,
    MODELE_SUCCESS,
    MODELE_NULL,
    INSERTED_FACTURE,
    mockFrom,
    mockInvoke,
    toastSuccess,
    toastError,
    debugWarn,
    debugError,
    invalidateQueriesSpy,
  };
});

function createBuilder(config?: {
  data?: unknown;
  error?: { message: string } | null;
  singleData?: unknown;
  singleError?: { message: string } | null;
}) {
  const builder: any = {
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
    single: vi.fn(async () => ({
      data: config?.singleData ?? config?.data ?? null,
      error: config?.singleError ?? config?.error ?? null,
    })),
    maybeSingle: vi.fn(async () => ({
      data: config?.singleData ?? config?.data ?? null,
      error: config?.singleError ?? config?.error ?? null,
    })),
    then: (onFulfilled: (value: { data: unknown; error: { message: string } | null }) => unknown) =>
      Promise.resolve({
        data: config?.data ?? null,
        error: config?.error ?? null,
      }).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve({
        data: config?.data ?? null,
        error: config?.error ?? null,
      }).catch(onRejected),
  };
  return builder;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
    functions: {
      invoke: mockInvoke,
    },
  },
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/hooks/billing/useFacturationEtablissement", () => ({
  useEtablissementModeleEconomique: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock("@/lib/debug", () => ({
  debug: {
    warn: debugWarn,
    error: debugError,
  },
}));

vi.mock("@/lib/formatters", () => ({
  formatCurrency: (value: number) => `${value.toFixed(2)} €`,
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="dialog-root">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    variant,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
  }) => (
    <button type="button" data-variant={variant} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: ({
    value,
    onChange,
    placeholder,
    type,
  }: {
    value?: string | number;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    type?: string;
  }) => <input value={value} onChange={onChange} placeholder={placeholder} type={type} />,
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <label className={className}>{children}</label>
  ),
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange: (v: string) => void;
    children: React.ReactNode;
  }) => (
    <div>
      <select
        data-testid="etablissement-select"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
      >
        <option value="">Sélectionner un établissement</option>
        {children}
      </select>
    </div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <option value="">{placeholder}</option>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({
    value,
    children,
  }: {
    value: string;
    children: React.ReactNode;
  }) => <option value={value}>{children}</option>,
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/components/ui/separator", () => ({
  Separator: () => <hr />,
}));

vi.mock("lucide-react", () => ({
  Euro: () => <span>Euro</span>,
  TrendingUp: () => <span>TrendingUp</span>,
  Calendar: () => <span>Calendar</span>,
  Loader2: () => <span>Loader2</span>,
  Info: () => <span>Info</span>,
}));

vi.mock("@/components/catalogue/ProduitSelector", () => ({
  ProduitSelector: ({ onSelect }: { onSelect: (p: { nom: string; prix_unitaire_ht: number } | null) => void }) => (
    <button type="button" onClick={() => onSelect({ nom: "Produit Catalogue", prix_unitaire_ht: 250 })}>
      Choisir produit mock
    </button>
  ),
}));

import { useEtablissementModeleEconomique } from "@/hooks/billing/useFacturationEtablissement";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function renderWithClient(ui: React.ReactElement) {
  const client = createQueryClient();
  vi.spyOn(client, "invalidateQueries").mockImplementation(invalidateQueriesSpy);
  return {
    client,
    ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>),
  };
}

describe("FactureFormDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche l'état de chargement du modèle économique après sélection d'un établissement", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "etablissements") {
        return createBuilder({ data: ETABS });
      }
      return createBuilder({});
    });

    vi.mocked(useEtablissementModeleEconomique).mockImplementation((id: string | null) => {
      if (id === "etab-1") return MODELE_LOADING;
      return MODELE_NULL;
    });

    renderWithClient(
      <FactureFormDialog
        open={true}
        onOpenChange={vi.fn()}
        prefilledData={null}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Clinique Alpha (Paris)")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId("etablissement-select"), {
      target: { value: "etab-1" },
    });

    expect(await screen.findByText("Chargement du modèle économique...")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Clinique Alpha")).toBeInTheDocument();
    expect(screen.getByDisplayValue("facturation@alpha.fr")).toBeInTheDocument();
    expect(screen.getByDisplayValue("1 rue de Paris")).toBeInTheDocument();
    expect(screen.getByDisplayValue("12345678901234")).toBeInTheDocument();
  });

  it("préremplit depuis le modèle économique et crée une facture avec les bonnes valeurs métier", async () => {
    const onOpenChange = vi.fn();

    mockFrom.mockImplementation((table: string) => {
      if (table === "etablissements") {
        return createBuilder({ data: ETABS });
      }
      if (table === "factures") {
        const builder = createBuilder({ singleData: INSERTED_FACTURE });
        return builder;
      }
      return createBuilder({});
    });

    mockInvoke.mockResolvedValue({ data: { ok: true }, error: null });

    vi.mocked(useEtablissementModeleEconomique).mockImplementation((id: string | null) => {
      if (id === "etab-1") return MODELE_SUCCESS;
      return MODELE_NULL;
    });

    renderWithClient(
      <FactureFormDialog
        open={true}
        onOpenChange={onOpenChange}
        prefilledData={null}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Clinique Alpha (Paris)")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId("etablissement-select"), {
      target: { value: "etab-1" },
    });

    expect(await screen.findByText("Modèle économique détecté")).toBeInTheDocument();
    expect(screen.getByText("Succès")).toBeInTheDocument();
    expect(screen.getByText("mensuelle")).toBeInTheDocument();
    expect(screen.getByText("1200.00 €")).toBeInTheDocument();
    expect(screen.getByText("100.00 €")).toBeInTheDocument();
    expect(screen.getByText("Palier visé : 50 patients")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByDisplayValue("100")).toBeInTheDocument();
    });

    const designationInput = screen.getByPlaceholderText("Abonnement OpenPulse - Janvier 2026") as HTMLInputElement;
    expect(designationInput.value).toContain("Abonnement OpenPulse -");
    expect(screen.getByText("TTC : 120.00 €")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Créer la facture"));

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith("factures");
    });

    const facturesCallIndex = mockFrom.mock.calls.findIndex((args) => args[0] === "factures");
    expect(facturesCallIndex).toBeGreaterThan(-1);
    const facturesBuilder: any = mockFrom.mock.results[facturesCallIndex].value;

    expect(facturesBuilder.insert).toHaveBeenCalledTimes(1);

    const insertedArg = facturesBuilder.insert.mock.calls[0][0] as {
      client_nom: string;
      client_email: string | null;
      client_adresse: string | null;
      client_siret: string | null;
      etablissement_id: string | null;
      montant_ht: number;
      montant_tva: number;
      montant_ttc: number;
      created_by: string | undefined;
      statut: string;
      periodicite_source: string | null;
      echeance_mois: string | null;
    };

    expect(insertedArg.client_nom).toBe("Clinique Alpha");
    expect(insertedArg.client_email).toBe("facturation@alpha.fr");
    expect(insertedArg.client_adresse).toBe("1 rue de Paris");
    expect(insertedArg.client_siret).toBe("12345678901234");
    expect(insertedArg.etablissement_id).toBe("etab-1");
    expect(insertedArg.montant_ht).toBe(100);
    expect(insertedArg.montant_tva).toBe(20);
    expect(insertedArg.montant_ttc).toBe(120);
    expect(insertedArg.created_by).toBe("user-1");
    expect(insertedArg.statut).toBe("brouillon");
    expect(insertedArg.periodicite_source).toBe("mensuelle");
    expect(insertedArg.echeance_mois).toBeNull();

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("sync-factures-tresorerie", {
        body: { factureId: "fact-1", action: "create" },
      });
    });

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ["factures"] });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ["tresorerie-revenus"] });
    expect(toastSuccess).toHaveBeenCalledWith("Facture créée avec succès");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("affiche une erreur si l'insertion renvoie une erreur Supabase", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "etablissements") {
        return createBuilder({ data: ETABS });
      }
      if (table === "factures") {
        return createBuilder({
          singleData: null,
          singleError: { message: "x" },
        });
      }
      return createBuilder({});
    });

    vi.mocked(useEtablissementModeleEconomique).mockImplementation((id: string | null) => {
      if (id === "etab-1") return MODELE_SUCCESS;
      return MODELE_NULL;
    });

    renderWithClient(
      <FactureFormDialog
        open={true}
        onOpenChange={vi.fn()}
        prefilledData={null}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Clinique Alpha (Paris)")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId("etablissement-select"), {
      target: { value: "etab-1" },
    });

    await screen.findByText("Modèle économique détecté");

    fireEvent.click(screen.getByText("Créer la facture"));

    await waitFor(() => {
      expect(debugError).toHaveBeenCalledWith({ message: "x" });
    });

    expect(toastError).toHaveBeenCalledWith("Erreur lors de la création");
  });

  it("utilise les données préremplies et désactive l'auto-fill du modèle économique", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "etablissements") {
        return createBuilder({ data: ETABS });
      }
      return createBuilder({});
    });

    vi.mocked(useEtablissementModeleEconomique).mockImplementation((id: string | null) => {
      if (id === "etab-1") return MODELE_SUCCESS;
      return MODELE_NULL;
    });

    renderWithClient(
      <FactureFormDialog
        open={true}
        onOpenChange={vi.fn()}
        prefilledData={{
          etablissementId: "etab-1",
          montant: 555,
          libelle: "Facturation échéance mai",
          echeanceMois: new Date("2026-05-01"),
          periodicite: "trimestrielle",
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue("Clinique Alpha")).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue("555")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Facturation échéance mai")).toBeInTheDocument();
    expect(screen.getByText("TTC : 666.00 €")).toBeInTheDocument();
  });
});