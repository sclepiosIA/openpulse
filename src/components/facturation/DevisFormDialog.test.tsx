/* @vitest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DevisFormDialog } from "./DevisFormDialog";

const {
  ETABLISSEMENTS,
  mockFrom,
  mockInvoke,
  mockOrder,
  toastSuccess,
  toastError,
  debugError,
} = vi.hoisted(() => {
  const ETABLISSEMENTS = [
    { id: "etab-1", nom: "Clinique Alpha", ville: "Paris" },
    { id: "etab-2", nom: "Cabinet Beta", ville: "Lyon" },
  ];

  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    then: vi.fn(),
    catch: vi.fn(),
  };

  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.gte.mockReturnValue(builder);
  builder.lte.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  builder.order.mockImplementation(() => Promise.resolve({ data: ETABLISSEMENTS, error: null }));
  builder.limit.mockReturnValue(builder);
  builder.insert.mockReturnValue(builder);
  builder.update.mockReturnValue(builder);
  builder.delete.mockReturnValue(builder);
  builder.single.mockResolvedValue({ data: null, error: null });
  builder.maybeSingle.mockResolvedValue({ data: null, error: null });
  builder.then.mockImplementation((onFulfilled: (value: { data: typeof ETABLISSEMENTS; error: null }) => unknown) =>
    Promise.resolve({ data: ETABLISSEMENTS, error: null }).then(onFulfilled)
  );
  builder.catch.mockImplementation(
    (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve({ data: ETABLISSEMENTS, error: null }).catch(onRejected)
  );

  return {
    ETABLISSEMENTS,
    mockFrom: vi.fn(() => builder),
    mockInvoke: vi.fn(async () => ({ data: { ok: true }, error: null })),
    mockOrder: builder.order,
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    debugError: vi.fn(),
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
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock("@/lib/debug", () => ({
  debug: {
    error: debugError,
  },
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
    type,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
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
  }: {
    value?: string | number;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    type?: string;
  }) => <input value={value} onChange={onChange} type={type} />,
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    children: React.ReactNode;
  }) => (
    <div>
      <select
        data-testid="etablissement-select"
        value={value}
        onChange={(e) => onValueChange?.(e.target.value)}
      >
        <option value="">Sélectionner</option>
        {ETABLISSEMENTS.map((e) => (
          <option key={e.id} value={e.id}>
            {e.nom}
          </option>
        ))}
      </select>
      {children}
    </div>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <div data-value={value}>{children}</div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}));

vi.mock("@/components/catalogue/ProduitSelector", () => ({
  ProduitSelector: ({ onSelect }: { onSelect: (p: { prix_unitaire_ht: number } | null) => void }) => (
    <button data-testid="produit-selector" onClick={() => onSelect({ prix_unitaire_ht: 123.45 })}>
      Choisir produit
    </button>
  ),
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

describe("DevisFormDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrder.mockImplementation(() => Promise.resolve({ data: ETABLISSEMENTS, error: null }));
    mockInvoke.mockImplementation(async () => ({ data: { ok: true }, error: null }));
  });

  it("affiche le titre de création et charge les établissements quand la dialog est ouverte", async () => {
    const onOpenChange = vi.fn();
    const Wrapper = createWrapper();

    render(
      <Wrapper>
        <DevisFormDialog open={true} onOpenChange={onOpenChange} />
      </Wrapper>
    );

    expect(screen.getByText("Nouveau devis")).toBeInTheDocument();

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith("etablissements");
    });

    expect(mockOrder).toHaveBeenCalledWith("nom");
    expect(screen.getByTestId("etablissement-select")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Créer" })).toBeInTheDocument();
  });

  it("pré-remplit le nom client selon l'établissement, remplit le montant via produit et crée un devis", async () => {
    const onOpenChange = vi.fn();
    const Wrapper = createWrapper();

    render(
      <Wrapper>
        <DevisFormDialog open={true} onOpenChange={onOpenChange} />
      </Wrapper>
    );

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith("etablissements");
    });

    fireEvent.change(screen.getByTestId("etablissement-select"), {
      target: { value: "etab-1" },
    });

    await waitFor(() => {
      const inputs = screen.getAllByRole("textbox");
      expect(inputs[0]).toHaveValue("Clinique Alpha");
    });

    const textboxes = screen.getAllByRole("textbox");
    fireEvent.change(textboxes[1], { target: { value: "client@example.com" } });

    fireEvent.click(screen.getByTestId("produit-selector"));

    const numberInput = screen.getByDisplayValue("123.45");
    expect(numberInput).toBeInTheDocument();

    const dateInput = screen.getByDisplayValue("") as HTMLInputElement;
    const allInputs = screen.getAllByDisplayValue("");
    const dateField = allInputs.find((el) => (el as HTMLInputElement).type === "date") as HTMLInputElement;
    fireEvent.change(dateField, { target: { value: "2026-07-15" } });

    fireEvent.click(screen.getByRole("button", { name: "Créer" }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("facturation-actions", {
        body: {
          action: "create_devis",
          etablissement_id: "etab-1",
          client_nom: "Clinique Alpha",
          client_email: "client@example.com",
          montant_ht: 123.45,
          date_validite: "2026-07-15",
        },
      });
    });

    expect(toastSuccess).toHaveBeenCalledWith("Devis créé");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("affiche une erreur si le nom du client est vide et ne soumet pas", async () => {
    const onOpenChange = vi.fn();
    const Wrapper = createWrapper();

    render(
      <Wrapper>
        <DevisFormDialog open={true} onOpenChange={onOpenChange} />
      </Wrapper>
    );

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith("etablissements");
    });

    fireEvent.click(screen.getByRole("button", { name: "Créer" }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Nom du client requis");
    });

    expect(mockInvoke).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("gère l'erreur de création et affiche le toast d'échec", async () => {
    mockInvoke.mockImplementation(async () => ({
      data: null,
      error: { message: "x" },
    }));

    const onOpenChange = vi.fn();
    const Wrapper = createWrapper();

    render(
      <Wrapper>
        <DevisFormDialog open={true} onOpenChange={onOpenChange} />
      </Wrapper>
    );

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith("etablissements");
    });

    const textboxes = screen.getAllByRole("textbox");
    fireEvent.change(textboxes[0], { target: { value: "Client manuel" } });

    fireEvent.click(screen.getByRole("button", { name: "Créer" }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Erreur lors de la création");
    });

    expect(debugError).toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("affiche le titre d'édition quand devisId est fourni", () => {
    const onOpenChange = vi.fn();
    const Wrapper = createWrapper();

    render(
      <Wrapper>
        <DevisFormDialog devisId="dev-1" open={true} onOpenChange={onOpenChange} />
      </Wrapper>
    );

    expect(screen.getByText("Modifier le devis")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mettre à jour" })).toBeInTheDocument();
  });
});