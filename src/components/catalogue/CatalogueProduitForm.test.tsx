// @vitest-environment jsdom
import React from "react";
import { QueryClient, QueryClientProvider, useMutation, useQuery } from "@tanstack/react-query";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { CatalogueProduitForm } from "./CatalogueProduitForm";

const {
  AUTH_STATE,
  PRODUCT_TYPE_LABELS,
  RECUR_LABELS,
  EXISTING_PRODUCT,
  createProduitMock,
  updateProduitMock,
  navigateMock,
  toastSuccessMock,
  toastErrorMock,
  mockFrom,
  builderResult,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    user: { id: "u1", email: "t@t.co" },
    session: { user: { id: "u1" } },
    isLoading: false,
  },
  PRODUCT_TYPE_LABELS: {
    service: "Service",
    produit: "Produit",
    licence: "Licence",
    formation: "Formation",
    maintenance: "Maintenance",
  },
  RECUR_LABELS: {
    none: "Aucune",
    monthly: "Mensuelle",
    quarterly: "Trimestrielle",
    yearly: "Annuelle",
  },
  EXISTING_PRODUCT: {
    id: "p1",
    code: "PROD-42",
    nom: "Audit sécurité",
    description: "Analyse détaillée",
    type: "service",
    categorie: "Conseil",
    recurrence: "monthly",
    prix_unitaire_ht: 1500,
    prix_min_ht: 1200,
    prix_max_ht: 2000,
    remise_max_pct: 10,
    taux_tva: 20,
    unite: "jour",
    notes_internes: "prioritaire",
    est_actif: false,
  },
  createProduitMock: vi.fn(),
  updateProduitMock: vi.fn(),
  navigateMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
  mockFrom: vi.fn(),
  builderResult: { data: null, error: null },
}));

vi.mock("@/integrations/supabase/client", () => {
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
    single: vi.fn(async () => builderResult),
    maybeSingle: vi.fn(async () => builderResult),
    then: (resolve: (value: typeof builderResult) => unknown) => Promise.resolve(resolve(builderResult)),
    catch: vi.fn(() => Promise.resolve(builderResult)),
  };
  mockFrom.mockImplementation(() => builder);
  return { supabase: { from: mockFrom } };
});

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

vi.mock("@/types/facturation", () => ({
  PRODUIT_TYPE_LABELS: PRODUCT_TYPE_LABELS,
  RECURRENCE_LABELS: RECUR_LABELS,
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div data-testid="dialog-root">{children}</div> : null),
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => <div data-testid="dialog-content" className={className}>{children}</div>,
  DialogHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
  DialogFooter: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    type = "button",
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    type?: "button" | "submit";
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button type={type} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>((props, ref) => <input ref={ref} {...props} />),
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
}));

vi.mock("@/components/ui/textarea", () => ({
  Textarea: React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>((props, ref) => <textarea ref={ref} {...props} />),
}));

vi.mock("@/components/ui/switch", () => ({
  Switch: ({
    checked,
    onCheckedChange,
  }: {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked ? "true" : "false"}
      onClick={() => onCheckedChange?.(!checked)}
    >
      {checked ? "on" : "off"}
    </button>
  ),
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
    <select aria-label="select" value={value} onChange={(e) => onValueChange?.(e.target.value)}>
      {children}
    </select>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: () => null,
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
}));

vi.mock("@/hooks/catalogue/useCatalogueProduits", () => ({
  useCatalogueProduits: () => ({
    createProduit: createProduitMock,
    updateProduit: updateProduitMock,
    isCreating: false,
    isUpdating: false,
  }),
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

describe("CatalogueProduitForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createProduitMock.mockResolvedValue({ id: "new-1" });
    updateProduitMock.mockResolvedValue({ id: EXISTING_PRODUCT.id });
  });

  it("expose les états loading puis success avec renderHook dans un QueryClientProvider", async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ["catalogue-produits-loading-success"],
          queryFn: async () => {
            await Promise.resolve();
            return [EXISTING_PRODUCT];
          },
        }),
      { wrapper }
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([EXISTING_PRODUCT]);
    expect(result.current.data?.[0]?.code).toBe("PROD-42");
    expect(result.current.data?.[0]?.prix_unitaire_ht).toBe(1500);
  });

  it("expose un état d'erreur avec renderHook", async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ["catalogue-produits-error"],
          queryFn: async () => {
            const response = { data: null, error: { message: "x" } };
            if (response.error) {
              throw new Error(response.error.message);
            }
            return response.data;
          },
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe("x");
  });

  it("affiche les valeurs par défaut en création et soumet un payload métier normalisé", async () => {
    const onOpenChange = vi.fn();

    render(<CatalogueProduitForm open={true} onOpenChange={onOpenChange} produit={null} />);

    expect(screen.getByText("Nouveau produit")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("PROD-001")).toHaveValue("");
    expect(screen.getByPlaceholderText("Nom du produit ou service")).toHaveValue("");
    expect(screen.getByDisplayValue("20")).toBeInTheDocument();
    expect(screen.getByDisplayValue("unité")).toBeInTheDocument();
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");

    fireEvent.change(screen.getByPlaceholderText("PROD-001"), { target: { value: "PROD-001" } });
    fireEvent.change(screen.getByPlaceholderText("Nom du produit ou service"), { target: { value: "Abonnement cloud" } });
    fireEvent.change(screen.getByPlaceholderText("Description détaillée…"), { target: { value: "" } });
    fireEvent.change(screen.getByPlaceholderText("ex: Infrastructure, Conseil…"), { target: { value: "" } });
    fireEvent.change(screen.getByDisplayValue("unité"), { target: { value: "poste" } });
    fireEvent.change(screen.getByPlaceholderText("Visible uniquement en interne"), { target: { value: "" } });

    const spinbuttons = screen.getAllByRole("spinbutton");
    fireEvent.change(spinbuttons[0], { target: { value: "99.99" } });
    fireEvent.change(spinbuttons[1], { target: { value: "5.5" } });
    fireEvent.change(spinbuttons[2], { target: { value: "15" } });
    fireEvent.change(spinbuttons[3], { target: { value: "" } });
    fireEvent.change(spinbuttons[4], { target: { value: "" } });

    const selects = screen.getAllByLabelText("select");
    fireEvent.change(selects[0], { target: { value: "licence" } });
    fireEvent.change(selects[1], { target: { value: "yearly" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Créer" }));
    });

    await waitFor(() => {
      expect(createProduitMock).toHaveBeenCalledTimes(1);
    });

    expect(createProduitMock).toHaveBeenCalledWith({
      code: "PROD-001",
      nom: "Abonnement cloud",
      description: null,
      type: "licence",
      categorie: null,
      recurrence: "yearly",
      prix_unitaire_ht: 99.99,
      prix_min_ht: null,
      prix_max_ht: null,
      remise_max_pct: 15,
      taux_tva: 5.5,
      unite: "poste",
      notes_internes: null,
      est_actif: true,
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("préremplit le formulaire en édition et appelle updateProduit avec l'id et les valeurs modifiées", async () => {
    const onOpenChange = vi.fn();

    render(<CatalogueProduitForm open={true} onOpenChange={onOpenChange} produit={EXISTING_PRODUCT} />);

    expect(screen.getByText("Modifier le produit")).toBeInTheDocument();
    expect(screen.getByDisplayValue("PROD-42")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Audit sécurité")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Analyse détaillée")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Conseil")).toBeInTheDocument();
    expect(screen.getByDisplayValue("1500")).toBeInTheDocument();
    expect(screen.getByDisplayValue("1200")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2000")).toBeInTheDocument();
    expect(screen.getByDisplayValue("10")).toBeInTheDocument();
    expect(screen.getByDisplayValue("20")).toBeInTheDocument();
    expect(screen.getByDisplayValue("jour")).toBeInTheDocument();
    expect(screen.getByDisplayValue("prioritaire")).toBeInTheDocument();
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");

    fireEvent.change(screen.getByDisplayValue("Audit sécurité"), { target: { value: "Audit sécurité premium" } });
    fireEvent.change(screen.getByDisplayValue("1500"), { target: { value: "1750" } });
    fireEvent.click(screen.getByRole("switch"));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Mettre à jour" }));
    });

    await waitFor(() => {
      expect(updateProduitMock).toHaveBeenCalledTimes(1);
    });

    expect(updateProduitMock).toHaveBeenCalledWith({
      id: "p1",
      code: "PROD-42",
      nom: "Audit sécurité premium",
      description: "Analyse détaillée",
      type: "service",
      categorie: "Conseil",
      recurrence: "monthly",
      prix_unitaire_ht: 1750,
      prix_min_ht: 1200,
      prix_max_ht: 2000,
      remise_max_pct: 10,
      taux_tva: 20,
      unite: "jour",
      notes_internes: "prioritaire",
      est_actif: true,
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("n'appelle pas la mutation si le formulaire est invalide et affiche les messages zod", async () => {
    const onOpenChange = vi.fn();

    render(<CatalogueProduitForm open={true} onOpenChange={onOpenChange} produit={null} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Créer" }));
    });

    expect(await screen.findByText("Code requis")).toBeInTheDocument();
    expect(await screen.findByText("Nom requis")).toBeInTheDocument();
    expect(createProduitMock).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("peut être testé comme mutation react-query: succès puis erreur", async () => {
    const wrapper = createWrapper();

    const { result: successResult } = renderHook(
      () =>
        useMutation({
          mutationFn: async (payload: { code: string; nom: string }) => createProduitMock(payload),
        }),
      { wrapper }
    );

    await act(async () => {
      await successResult.current.mutateAsync({ code: "PROD-777", nom: "Service managé" });
    });

    await waitFor(() => {
      expect(successResult.current.isSuccess).toBe(true);
    });

    expect(createProduitMock).toHaveBeenCalledWith({ code: "PROD-777", nom: "Service managé" });

    const failingMutation = vi.fn(async () => {
      const response = { data: null, error: { message: "x" } };
      throw new Error(response.error.message);
    });

    const { result: errorResult } = renderHook(
      () =>
        useMutation({
          mutationFn: failingMutation,
        }),
      { wrapper }
    );

    await act(async () => {
      try {
        await errorResult.current.mutateAsync();
      } catch {}
    });

    await waitFor(() => {
      expect(errorResult.current.isError).toBe(true);
    });

    expect(failingMutation).toHaveBeenCalledTimes(1);
    expect(errorResult.current.error).toBeInstanceOf(Error);
    expect(errorResult.current.error?.message).toBe("x");
  });
});