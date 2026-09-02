/* @vitest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, act } from "@testing-library/react";
import { EditDepenseDialog } from "./EditDepenseDialog";

const {
  AUTH_STATE,
  TOAST_FN,
  UPDATE_DEPENSE_FN,
  NAVIGATE_FN,
  SUPABASE_SINGLE_RESULT,
  SUPABASE_MAYBE_SINGLE_RESULT,
  mockFrom,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: "u1", email: "test@local.dev" },
    session: { user: { id: "u1" } },
    isLoading: false,
  };
  const TOAST_FN = vi.fn();
  const UPDATE_DEPENSE_FN = vi.fn();
  const NAVIGATE_FN = vi.fn();
  const SUPABASE_SINGLE_RESULT = { data: null, error: null };
  const SUPABASE_MAYBE_SINGLE_RESULT = { data: null, error: null };
  const mockFrom = vi.fn();
  return {
    AUTH_STATE,
    TOAST_FN,
    UPDATE_DEPENSE_FN,
    NAVIGATE_FN,
    SUPABASE_SINGLE_RESULT,
    SUPABASE_MAYBE_SINGLE_RESULT,
    mockFrom,
  };
});

vi.mock("@/integrations/supabase/client", () => {
  const createBuilder = () => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      neq: vi.fn(() => builder),
      gt: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lt: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      contains: vi.fn(() => builder),
      ilike: vi.fn(() => builder),
      like: vi.fn(() => builder),
      is: vi.fn(() => builder),
      or: vi.fn(() => builder),
      not: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      range: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      upsert: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      single: vi.fn(async () => SUPABASE_SINGLE_RESULT),
      maybeSingle: vi.fn(async () => SUPABASE_MAYBE_SINGLE_RESULT),
      then: (onFulfilled: (value: { data: null; error: null }) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(onFulfilled),
      catch: (onRejected: (reason: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).catch(onRejected),
    };
    return builder;
  };

  mockFrom.mockImplementation(() => createBuilder());

  return {
    supabase: {
      from: mockFrom,
      auth: {
        getSession: vi.fn(async () => ({ data: { session: AUTH_STATE.session }, error: null })),
        getUser: vi.fn(async () => ({ data: { user: AUTH_STATE.user }, error: null })),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      },
    },
  };
});

vi.mock("@/hooks/tresorerie/useTresorerieDepenses", () => ({
  useTresorerieDepenses: vi.fn(() => ({
    updateDepense: UPDATE_DEPENSE_FN,
    isUpdating: false,
  })),
}));

vi.mock("@/hooks/shared/use-toast", () => ({
  useToast: () => ({
    toast: TOAST_FN,
  }),
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

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => NAVIGATE_FN,
  };
});

vi.mock("lucide-react", () => ({
  RefreshCw: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="refresh-icon" {...props} />,
  Save: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="save-icon" {...props} />,
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
  DialogContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    type = "button",
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    type?: "button" | "submit" | "reset";
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    disabled?: boolean;
    variant?: string;
  }) => (
    <button type={type} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({
    children,
    htmlFor,
  }: {
    children: React.ReactNode;
    htmlFor?: string;
  }) => <label htmlFor={htmlFor}>{children}</label>,
}));

vi.mock("@/components/ui/textarea", () => ({
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}));

vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({
    id,
    checked,
    onCheckedChange,
  }: {
    id?: string;
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }) => (
    <input
      id={id}
      type="checkbox"
      checked={!!checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
    />
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
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
  }) => <div data-value={value} data-on-change={onValueChange ? "1" : "0"}>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({
    value,
    children,
  }: {
    value: string;
    children: React.ReactNode;
  }) => <button type="button" data-select-value={value}>{children}</button>,
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

describe("EditDepenseDialog", () => {
  const depense = {
    id: "dep-1",
    nom: "Abonnement Cloud (janv. 25)",
    montant: 120,
    date_prevue: "2025-01-10",
    categorie_code: "logiciels",
    notes: "note initiale",
    source: "manuel_previsionnel",
  };

  const allDepenses = [
    depense,
    {
      id: "dep-2",
      nom: "Abonnement Cloud (févr. 25)",
      montant: 120,
      date_prevue: "2099-02-10",
      categorie_code: "logiciels",
      notes: null,
      source: "manuel_previsionnel",
    },
    {
      id: "dep-3",
      nom: "Abonnement Cloud (mars. 25)",
      montant: 120,
      date_prevue: "1900-01-01",
      categorie_code: "logiciels",
      notes: null,
      source: "manuel_previsionnel",
    },
    {
      id: "dep-x",
      nom: "Autre charge",
      montant: 10,
      date_prevue: "2099-03-01",
      categorie_code: "divers",
      notes: null,
      source: "manuel_previsionnel",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderHook avec QueryClientProvider fonctionne dans l'environnement de test", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => React.useState("loading"), { wrapper });

    expect(result.current[0]).toBe("loading");

    await act(async () => {
      result.current[1]("success");
    });

    expect(result.current[0]).toBe("success");
  });

  it("affiche les valeurs initiales métier et les informations de récurrence", () => {
    render(
      <EditDepenseDialog
        open={true}
        onOpenChange={vi.fn()}
        depense={depense}
        allDepenses={allDepenses}
      />
    );

    expect(screen.getByRole("heading", { name: "Modifier la dépense" })).toBeInTheDocument();
    expect(screen.getByLabelText("Libellé *")).toHaveValue("Abonnement Cloud (janv. 25)");
    expect(screen.getByLabelText("Montant (€) *")).toHaveValue(120);
    expect(screen.getByLabelText("Date prévue")).toHaveValue("2025-01-10");
    expect(screen.getByLabelText("Notes")).toHaveValue("note initiale");
    expect(screen.getByText("Cette dépense fait partie d'une récurrence")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(
      screen.getByText("Appliquer le nouveau montant à toutes les occurrences futures (2)")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Enregistrer/i })).toBeEnabled();
  });

  it("retourne null quand aucune dépense n'est fournie", () => {
    const { container } = render(
      <EditDepenseDialog
        open={true}
        onOpenChange={vi.fn()}
        depense={null}
        allDepenses={allDepenses}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("affiche une erreur si le montant est invalide et n'appelle pas la mutation", async () => {
    const user = userEvent.setup();

    render(
      <EditDepenseDialog
        open={true}
        onOpenChange={vi.fn()}
        depense={depense}
        allDepenses={allDepenses}
      />
    );

    const montantInput = screen.getByLabelText("Montant (€) *");
    await user.clear(montantInput);
    await user.type(montantInput, "0");

    await user.click(screen.getByRole("button", { name: /Enregistrer/i }));

    expect(UPDATE_DEPENSE_FN).not.toHaveBeenCalled();
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: "Erreur",
      description: "Le montant doit être supérieur à 0",
      variant: "destructive",
    });
  });

  it("met à jour la dépense courante puis les occurrences futures quand la case est cochée", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    UPDATE_DEPENSE_FN.mockImplementation(
      (
        _vars: unknown,
        options?: { onSuccess?: () => void; onError?: (error: unknown) => void }
      ) => {
        options?.onSuccess?.();
      }
    );

    render(
      <EditDepenseDialog
        open={true}
        onOpenChange={onOpenChange}
        depense={depense}
        allDepenses={allDepenses}
      />
    );

    await user.clear(screen.getByLabelText("Libellé *"));
    await user.type(screen.getByLabelText("Libellé *"), "Abonnement Cloud Pro");
    await user.clear(screen.getByLabelText("Montant (€) *"));
    await user.type(screen.getByLabelText("Montant (€) *"), "150.5");
    await user.clear(screen.getByLabelText("Date prévue"));
    await user.type(screen.getByLabelText("Date prévue"), "2025-04-15");
    await user.clear(screen.getByLabelText("Notes"));
    await user.type(screen.getByLabelText("Notes"), "mise à jour annuelle");

    fireEvent.click(screen.getByLabelText(/Appliquer le nouveau montant à toutes les occurrences futures/));

    await act(async () => {
      await user.click(screen.getByRole("button", { name: /Enregistrer/i }));
    });

    await waitFor(() => {
      expect(UPDATE_DEPENSE_FN).toHaveBeenCalledTimes(3);
    });

    expect(UPDATE_DEPENSE_FN).toHaveBeenNthCalledWith(
      1,
      {
        id: "dep-1",
        updates: {
          nom: "Abonnement Cloud Pro",
          montant: 150.5,
          date_prevue: "2025-04-15",
          categorie_code: "logiciels",
          notes: "mise à jour annuelle",
        },
      },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      })
    );

    expect(UPDATE_DEPENSE_FN).toHaveBeenNthCalledWith(
      2,
      { id: "dep-2", updates: { montant: 150.5 } },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      })
    );

    expect(UPDATE_DEPENSE_FN).toHaveBeenNthCalledWith(
      3,
      { id: "dep-3", updates: { montant: 150.5 } },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      })
    );

    expect(TOAST_FN).toHaveBeenCalledWith({
      title: "Dépense mise à jour",
      description: "2 dépenses mises à jour",
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("met à jour uniquement la dépense courante quand la propagation n'est pas cochée", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    UPDATE_DEPENSE_FN.mockImplementation(
      (
        _vars: unknown,
        options?: { onSuccess?: () => void; onError?: (error: unknown) => void }
      ) => {
        options?.onSuccess?.();
      }
    );

    render(
      <EditDepenseDialog
        open={true}
        onOpenChange={onOpenChange}
        depense={depense}
        allDepenses={allDepenses}
      />
    );

    await user.clear(screen.getByLabelText("Montant (€) *"));
    await user.type(screen.getByLabelText("Montant (€) *"), "200");

    await act(async () => {
      await user.click(screen.getByRole("button", { name: /Enregistrer/i }));
    });

    await waitFor(() => {
      expect(UPDATE_DEPENSE_FN).toHaveBeenCalledTimes(1);
    });

    expect(UPDATE_DEPENSE_FN).toHaveBeenCalledWith(
      {
        id: "dep-1",
        updates: {
          nom: "Abonnement Cloud (janv. 25)",
          montant: 200,
          date_prevue: "2025-01-10",
          categorie_code: "logiciels",
          notes: "note initiale",
        },
      },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      })
    );

    expect(TOAST_FN).toHaveBeenCalledWith({
      title: "Dépense mise à jour",
      description: "La dépense a été modifiée",
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("gère l'erreur de mutation en affichant un toast destructif", async () => {
    const user = userEvent.setup();

    UPDATE_DEPENSE_FN.mockImplementation(
      (
        _vars: unknown,
        options?: { onSuccess?: () => void; onError?: (error: unknown) => void }
      ) => {
        options?.onError?.({ message: "x" });
      }
    );

    render(
      <EditDepenseDialog
        open={true}
        onOpenChange={vi.fn()}
        depense={depense}
        allDepenses={allDepenses}
      />
    );

    await act(async () => {
      await user.click(screen.getByRole("button", { name: /Enregistrer/i }));
    });

    await waitFor(() => {
      expect(TOAST_FN).toHaveBeenCalledWith({
        title: "Erreur",
        description: "Impossible de mettre à jour la dépense",
        variant: "destructive",
      });
    });
  });
});