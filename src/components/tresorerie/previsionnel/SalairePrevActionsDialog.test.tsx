// @vitest-environment jsdom

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { SalairePrevActionsDialog } from "./SalairePrevActionsDialog";

const {
  mockNavigate,
  mockCreateDepense,
  mockCreateOverride,
  mockDebugError,
  authState,
  stableBuilder,
} = vi.hoisted(() => {
  const builder: Record<string, unknown> = {};
  const chain = [
    "select",
    "eq",
    "gte",
    "lte",
    "in",
    "order",
    "limit",
    "insert",
    "update",
    "delete",
    "upsert",
    "match",
    "ilike",
    "or",
    "not",
  ];
  for (const key of chain) {
    builder[key] = vi.fn(() => builder);
  }
  builder.single = vi.fn(async () => ({ data: null, error: null }));
  builder.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
  builder.then = (onFulfilled?: (value: { data: null; error: null }) => unknown) =>
    Promise.resolve({ data: null, error: null }).then(onFulfilled);
  builder.catch = (onRejected?: (reason: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null }).catch(onRejected);

  return {
    mockNavigate: vi.fn(),
    mockCreateDepense: vi.fn(),
    mockCreateOverride: vi.fn(),
    mockDebugError: vi.fn(),
    authState: {
      user: { id: "u1", email: "t@t.co" },
      session: { user: { id: "u1" } },
      isLoading: false,
    },
    stableBuilder: builder,
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => stableBuilder),
  },
}));

vi.mock("@/lib/debug", () => ({
  debug: {
    error: mockDebugError,
    log: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => authState,
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => authState,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

vi.mock("@/hooks/tresorerie/useTresorerieDepenses", () => ({
  useTresorerieDepenses: () => ({
    createDepense: mockCreateDepense,
    isCreating: false,
  }),
}));

vi.mock("@/hooks/hr/useSalaireProjectionsOverrides", () => ({
  useSalaireProjectionsOverrides: () => ({
    createOverride: mockCreateOverride,
    isCreating: false,
  }),
}));

vi.mock("@/lib/formatters", () => ({
  formatCurrency: (value: number) => `${value.toFixed(2)} €`,
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
  DialogContent: ({ children }: { children: React.ReactNode; className?: string }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode; className?: string }) => <h1>{children}</h1>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
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
    className?: string;
    type?: "button" | "submit" | "reset";
  }) => (
    <button type={type ?? "button"} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode; variant?: string; className?: string }) => (
    <span>{children}</span>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: ({
    value,
    onChange,
    id,
    placeholder,
    type,
  }: {
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    id?: string;
    placeholder?: string;
    type?: string;
    step?: string;
    min?: string;
  }) => <input id={id} value={value} onChange={onChange} placeholder={placeholder} type={type} />,
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({
    children,
    htmlFor,
  }: {
    children: React.ReactNode;
    htmlFor?: string;
    className?: string;
  }) => <label htmlFor={htmlFor}>{children}</label>,
}));

vi.mock("@/components/ui/radio-group", () => ({
  RadioGroup: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (v: string) => void;
    children: React.ReactNode;
  }) => <div data-value={value} data-on-change={String(Boolean(onValueChange))}>{children}</div>,
  RadioGroupItem: ({
    value,
    id,
  }: {
    value: string;
    id: string;
    className?: string;
  }) => (
    <input
      type="radio"
      id={id}
      value={value}
      name={id.includes("edit_") ? "edit-scope" : "exclude-scope"}
      onChange={() => {}}
    />
  ),
}));

vi.mock("lucide-react", () => {
  const Icon = () => <span />;
  return {
    User: Icon,
    Info: Icon,
    ExternalLink: Icon,
    Pencil: Icon,
    Pause: Icon,
    Trash2: Icon,
    Loader2: Icon,
  };
});

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

describe("SalairePrevActionsDialog", () => {
  const salaireItem = {
    id: "salaire-prev-profile-123-2024-03-01",
    montant: 2450,
    label: "Salaire",
    type: "depense",
    date: "2024-03-01",
  };

  const derniersNetPayes = new Map([
    [
      "profile-123",
      {
        prenom: "Jean",
        nom: "Dupont",
        netPaye: 2300,
        dernierMois: "2024-01-01",
      },
    ],
  ]);

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateDepense.mockImplementation(() => undefined);
    mockCreateOverride.mockResolvedValue(undefined);
  });

  it("rend les informations métier du salaire projeté", () => {
    const wrapper = createWrapper();

    const { result } = renderHook(() => ({ ok: true }), { wrapper });
    expect(result.current.ok).toBe(true);

    render(
      <SalairePrevActionsDialog
        open
        onOpenChange={vi.fn()}
        salaireItem={salaireItem}
        derniersNetPayes={derniersNetPayes}
      />,
      { wrapper }
    );

    expect(screen.getByText("Salaire Jean Dupont")).toBeInTheDocument();
    expect(screen.getByText("-2450.00 €")).toBeInTheDocument();
    expect(screen.getByText("Projection automatique du salaire net")).toBeInTheDocument();
    expect(screen.getByText(/Projection basée sur le dernier net payé connu/i)).toBeInTheDocument();
    expect(screen.getByText("2300.00 €")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Modifier le montant/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Suspendre/i })).toBeInTheDocument();
  });

  it("affiche le fallback quand les informations salaire sont introuvables", () => {
    const wrapper = createWrapper();

    render(
      <SalairePrevActionsDialog
        open
        onOpenChange={vi.fn()}
        salaireItem={{
          id: "salaire-prev-inconnu-2024-03-01",
          montant: 1000,
          label: "Salaire",
          type: "depense",
          date: "2024-03-01",
        }}
        derniersNetPayes={new Map()}
      />,
      { wrapper }
    );

    expect(screen.getByText("Détails du salaire")).toBeInTheDocument();
    expect(screen.getByText("Impossible de charger les informations du salaire.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fermer" })).toBeInTheDocument();
  });

  it("sauvegarde une modification à partir de ce mois via createOverride", async () => {
    const wrapper = createWrapper();
    const onOpenChange = vi.fn();

    render(
      <SalairePrevActionsDialog
        open
        onOpenChange={onOpenChange}
        salaireItem={salaireItem}
        derniersNetPayes={derniersNetPayes}
      />,
      { wrapper }
    );

    fireEvent.click(screen.getByRole("button", { name: /Modifier le montant/i }));

    const input = screen.getByLabelText(/Nouveau montant/i);
    fireEvent.change(input, { target: { value: "2600" } });

    fireEvent.click(screen.getByRole("button", { name: /Enregistrer/i }));

    await waitFor(() => {
      expect(mockCreateOverride).toHaveBeenCalledTimes(1);
    });

    expect(mockCreateOverride).toHaveBeenCalledWith({
      profile_id: "profile-123",
      montant: 2600,
      date_effet: "2024-03-01",
      notes: "Modification à partir de mars 2024",
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mockCreateDepense).not.toHaveBeenCalled();
  });

  it("suspend le salaire via createDepense avec date 1900-01-01", async () => {
    const wrapper = createWrapper();
    const onOpenChange = vi.fn();

    render(
      <SalairePrevActionsDialog
        open
        onOpenChange={onOpenChange}
        salaireItem={salaireItem}
        derniersNetPayes={derniersNetPayes}
      />,
      { wrapper }
    );

    fireEvent.click(screen.getByRole("button", { name: /Suspendre/i }));

    await waitFor(() => {
      expect(mockCreateDepense).toHaveBeenCalledTimes(1);
    });

    expect(mockCreateDepense).toHaveBeenCalledWith({
      nom: "Salaire Jean Dupont (mars 2024)",
      montant: 2300,
      date_prevue: "1900-01-01",
      notes: "Salaire suspendu depuis la projection de 2024-03",
      statut: "en_attente",
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("gère l'erreur de sauvegarde d'override sans fermer le dialog", async () => {
    const wrapper = createWrapper();
    const onOpenChange = vi.fn();
    const error = new Error("x");
    mockCreateOverride.mockRejectedValueOnce(error);

    render(
      <SalairePrevActionsDialog
        open
        onOpenChange={onOpenChange}
        salaireItem={salaireItem}
        derniersNetPayes={derniersNetPayes}
      />,
      { wrapper }
    );

    fireEvent.click(screen.getByRole("button", { name: /Modifier le montant/i }));
    fireEvent.change(screen.getByLabelText(/Nouveau montant/i), { target: { value: "2600" } });
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer/i }));

    await waitFor(() => {
      expect(mockDebugError).toHaveBeenCalled();
    });

    expect(mockDebugError).toHaveBeenCalledWith("Erreur lors de la sauvegarde:", error);
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});