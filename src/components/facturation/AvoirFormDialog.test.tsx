/* @vitest-environment jsdom */
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { AvoirFormDialog } from "./AvoirFormDialog";

const {
  FACTURES_ROWS,
  AVOIR_MOTIF_LABELS_STABLE,
  mockFrom,
  mockInvoke,
  mockToastSuccess,
  mockToastError,
  mockDebugError,
  mockInvalidateQueries,
} = vi.hoisted(() => {
  const FACTURES_ROWS = [
    {
      id: "fac-1",
      numero: "F-001",
      client_nom: "Client Alpha",
      client_email: "alpha@example.test",
      client_adresse: "1 rue Exemple",
      client_siret: "12345678900011",
      etablissement_id: "eta-1",
      montant_ttc: 120,
    },
    {
      id: "fac-2",
      numero: "F-002",
      client_nom: "Client Beta",
      client_email: null,
      client_adresse: null,
      client_siret: null,
      etablissement_id: null,
      montant_ttc: 240,
    },
  ];

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
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: (onFulfilled: (value: { data: typeof FACTURES_ROWS; error: null }) => unknown) =>
      Promise.resolve({ data: FACTURES_ROWS, error: null }).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve({ data: FACTURES_ROWS, error: null }).catch(onRejected),
  };

  return {
    FACTURES_ROWS,
    AVOIR_MOTIF_LABELS_STABLE: {
      erreur_facturation: "Erreur de facturation",
      geste_commercial: "Geste commercial",
      annulation_partielle: "Annulation partielle",
    },
    mockFrom: vi.fn(() => builder),
    mockInvoke: vi.fn(async () => ({ error: null })),
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
    mockDebugError: vi.fn(),
    mockInvalidateQueries: vi.fn(),
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
    functions: {
      invoke: mockInvoke,
    },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock("@/lib/debug", () => ({
  debug: {
    error: mockDebugError,
  },
}));

vi.mock("@/types/avoir", () => ({
  AVOIR_MOTIF_LABELS: AVOIR_MOTIF_LABELS_STABLE,
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    open,
    children,
  }: {
    open: boolean;
    children: React.ReactNode;
    onOpenChange?: (open: boolean) => void;
  }) => (open ? <div data-testid="dialog-root">{children}</div> : null),
  DialogContent: ({ children }: { children: React.ReactNode; className?: string }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    type,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
    type?: "button" | "submit" | "reset";
  }) => (
    <button type={type ?? "button"} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: ({
    value,
    onChange,
    type,
    step,
  }: {
    value?: string | number;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    type?: string;
    step?: string;
  }) => <input value={value} onChange={onChange} type={type} step={step} />,
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
}));

vi.mock("@/components/ui/textarea", () => ({
  Textarea: ({
    value,
    onChange,
    placeholder,
    rows,
  }: {
    value?: string;
    onChange?: React.ChangeEventHandler<HTMLTextAreaElement>;
    placeholder?: string;
    rows?: number;
  }) => <textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows} />,
}));

vi.mock("@/components/ui/select", () => {
  const ReactLocal = React;

  function Select({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    children: React.ReactNode;
  }) {
    const items: Array<{ value: string; label: string }> = [];

    ReactLocal.Children.forEach(children, (child) => {
      if (!ReactLocal.isValidElement(child)) return;
      ReactLocal.Children.forEach(child.props.children, (nested) => {
        if (!ReactLocal.isValidElement(nested)) return;
        ReactLocal.Children.forEach(nested.props.children, (item) => {
          if (!ReactLocal.isValidElement(item)) return;
          if (typeof item.props.value === "string") {
            const raw = item.props.children;
            const label =
              typeof raw === "string"
                ? raw
                : Array.isArray(raw)
                  ? raw.join("")
                  : String(raw ?? item.props.value);
            items.push({ value: item.props.value, label });
          }
        });
      });
    });

    return (
      <select
        aria-label="select"
        value={value ?? ""}
        onChange={(e) => onValueChange?.(e.target.value)}
      >
        <option value="">Sélectionner</option>
        {items.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    );
  }

  return {
    Select,
    SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    SelectValue: ({ placeholder }: { placeholder?: string }) => <>{placeholder ?? null}</>,
    SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    SelectItem: ({ children }: { value: string; children: React.ReactNode }) => <>{children}</>,
  };
});

describe("AvoirFormDialog", () => {
  function createWrapper() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });

    vi.spyOn(queryClient, "invalidateQueries").mockImplementation(mockInvalidateQueries);

    return {
      queryClient,
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue({ error: null });
  });

  it("charge les factures à l'ouverture et préremplit les champs depuis la facture sélectionnée", async () => {
    const onOpenChange = vi.fn();
    const { wrapper } = createWrapper();

    render(<AvoirFormDialog open factureId="fac-1" onOpenChange={onOpenChange} />, { wrapper });

    expect(screen.getByText("Nouvel avoir (note de crédit)")).toBeInTheDocument();

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith("factures");
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue("Client Alpha")).toBeInTheDocument();
      expect(screen.getByDisplayValue("alpha@example.test")).toBeInTheDocument();
      expect(screen.getByDisplayValue("1 rue Exemple")).toBeInTheDocument();
      expect(screen.getByDisplayValue("12345678900011")).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue("100")).toBeInTheDocument();
    expect(screen.getByText(/TVA \(20%\): 20,00 €/)).toBeInTheDocument();
    expect(screen.getByText(/TTC: 120,00 €/)).toBeInTheDocument();
  });

  it("crée un avoir avec les valeurs métier attendues puis invalide les queries", async () => {
    const onOpenChange = vi.fn();
    const { wrapper } = createWrapper();

    render(<AvoirFormDialog open factureId="fac-1" onOpenChange={onOpenChange} />, { wrapper });

    await waitFor(() => {
      expect(screen.getByDisplayValue("Client Alpha")).toBeInTheDocument();
    });

    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "Client Alpha Modifié" } });
    fireEvent.change(inputs[1], { target: { value: "modif@example.test" } });
    fireEvent.change(inputs[2], { target: { value: "2 avenue Test" } });
    fireEvent.change(inputs[3], { target: { value: "98765432100022" } });

    fireEvent.change(screen.getByPlaceholderText("Précisez la raison de l'avoir..."), {
      target: { value: "Correction sur une ligne de facture" },
    });

    const numberInput = screen.getByDisplayValue("100");
    fireEvent.change(numberInput, { target: { value: "50.5" } });

    fireEvent.change(screen.getByPlaceholderText("Notes visibles uniquement en interne..."), {
      target: { value: "Validation service compta" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Créer l'avoir" }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledTimes(1);
    });

    expect(mockInvoke).toHaveBeenCalledWith("facturation-actions", {
      body: {
        action: "create_avoir",
        facture_id: "fac-1",
        etablissement_id: "eta-1",
        client_nom: "Client Alpha Modifié",
        client_email: "modif@example.test",
        client_adresse: "2 avenue Test",
        client_siret: "98765432100022",
        montant_ht: 50.5,
        motif: "erreur_facturation",
        motif_detail: "Correction sur une ligne de facture",
        notes_internes: "Validation service compta",
      },
    });

    await waitFor(() => {
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["avoirs"] });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["factures"] });
      expect(mockToastSuccess).toHaveBeenCalledWith("Avoir créé avec succès");
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("affiche une erreur métier si le client est vide et n'appelle pas la fonction", async () => {
    const onOpenChange = vi.fn();
    const { wrapper } = createWrapper();

    render(<AvoirFormDialog open factureId="fac-1" onOpenChange={onOpenChange} />, { wrapper });

    await waitFor(() => {
      expect(screen.getByDisplayValue("Client Alpha")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByDisplayValue("Client Alpha"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Créer l'avoir" }));

    expect(mockToastError).toHaveBeenCalledWith("Nom du client requis");
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("gère l'erreur de création depuis la fonction edge", async () => {
    mockInvoke.mockResolvedValueOnce({ error: { message: "x" } });

    const onOpenChange = vi.fn();
    const { wrapper } = createWrapper();

    render(<AvoirFormDialog open factureId="fac-1" onOpenChange={onOpenChange} />, { wrapper });

    await waitFor(() => {
      expect(screen.getByDisplayValue("Client Alpha")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Créer l'avoir" }));

    await waitFor(() => {
      expect(mockDebugError).toHaveBeenCalled();
      expect(mockToastError).toHaveBeenCalledWith("Erreur lors de la création de l'avoir");
    });

    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});