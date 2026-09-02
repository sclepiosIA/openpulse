/* @vitest-environment jsdom */

import React from "react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { render, screen, fireEvent, waitFor, renderHook, within } from "@testing-library/react";
import { DepenseActionsDialog } from "./DepenseActionsDialog";

const {
  AUTH_STATE,
  TOAST_FN,
  UPDATE_DEPENSE_FN,
  DELETE_DEPENSE_FN,
  FORMAT_CURRENCY_FN,
  MOCK_FROM,
  QUERY_ROWS,
  DEPENSE,
  ALL_DEPENSES,
  FUTURE_COUNT,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: "u1", email: "t@t.co" },
    session: { user: { id: "u1" } },
    isLoading: false,
  };

  const TOAST_FN = vi.fn();
  const UPDATE_DEPENSE_FN = vi.fn();
  const DELETE_DEPENSE_FN = vi.fn();
  const FORMAT_CURRENCY_FN = vi.fn((value: number) => `${value.toFixed(2)} €`);

  const QUERY_ROWS = [{ id: "1", name: "row" }];

  const createBuilder = () => {
    const builder: {
      select: ReturnType<typeof vi.fn>;
      eq: ReturnType<typeof vi.fn>;
      gte: ReturnType<typeof vi.fn>;
      lte: ReturnType<typeof vi.fn>;
      in: ReturnType<typeof vi.fn>;
      order: ReturnType<typeof vi.fn>;
      limit: ReturnType<typeof vi.fn>;
      insert: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
      single: ReturnType<typeof vi.fn>;
      maybeSingle: ReturnType<typeof vi.fn>;
      then: (onFulfilled?: (value: { data: typeof QUERY_ROWS; error: null }) => unknown, onRejected?: (reason: unknown) => unknown) => Promise<unknown>;
      catch: (onRejected?: (reason: unknown) => unknown) => Promise<unknown>;
    } = {
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
      then(onFulfilled, onRejected) {
        return Promise.resolve({ data: QUERY_ROWS, error: null }).then(onFulfilled, onRejected);
      },
      catch(onRejected) {
        return Promise.resolve({ data: QUERY_ROWS, error: null }).catch(onRejected);
      },
    };

    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.gte.mockReturnValue(builder);
    builder.lte.mockReturnValue(builder);
    builder.in.mockReturnValue(builder);
    builder.order.mockReturnValue(builder);
    builder.limit.mockReturnValue(builder);
    builder.insert.mockReturnValue(builder);
    builder.update.mockReturnValue(builder);
    builder.delete.mockReturnValue(builder);
    builder.single.mockResolvedValue({ data: QUERY_ROWS[0], error: null });
    builder.maybeSingle.mockResolvedValue({ data: QUERY_ROWS[0], error: null });

    return builder;
  };

  const MOCK_FROM = vi.fn(() => createBuilder());

  const DEPENSE = {
    id: "dep-2",
    nom: "Abonnement (janv. 30)",
    montant: 25,
    source: "manuel_previsionnel",
    date_prevue: "2030-01-15",
  };

  const ALL_DEPENSES = [
    {
      id: "dep-1",
      nom: "Abonnement (déc. 29)",
      montant: 25,
      source: "manuel_previsionnel",
      date_prevue: "2029-12-15",
    },
    DEPENSE,
    {
      id: "dep-3",
      nom: "Abonnement (févr. 30)",
      montant: 25,
      source: "manuel_previsionnel",
      date_prevue: "2030-02-15",
    },
    {
      id: "dep-4",
      nom: "Abonnement (mars 30)",
      montant: 25,
      source: "manuel_previsionnel",
      date_prevue: "1900-01-01",
    },
    {
      id: "dep-5",
      nom: "Autre charge",
      montant: 60,
      source: "manuel_previsionnel",
      date_prevue: "2030-03-01",
    },
  ];

  const FUTURE_COUNT = 4;

  return {
    AUTH_STATE,
    TOAST_FN,
    UPDATE_DEPENSE_FN,
    DELETE_DEPENSE_FN,
    FORMAT_CURRENCY_FN,
    MOCK_FROM,
    QUERY_ROWS,
    DEPENSE,
    ALL_DEPENSES,
    FUTURE_COUNT,
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: MOCK_FROM,
  },
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

vi.mock("@/hooks/shared/use-toast", () => ({
  useToast: () => ({ toast: TOAST_FN }),
}));

vi.mock("@/lib/formatters", () => ({
  formatCurrency: FORMAT_CURRENCY_FN,
}));

vi.mock("@/hooks/tresorerie/useTresorerieDepenses", () => ({
  useTresorerieDepenses: () => ({
    updateDepense: UPDATE_DEPENSE_FN,
    deleteDepense: DELETE_DEPENSE_FN,
    isUpdating: false,
    isDeleting: false,
  }),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="dialog-root">{children}</div> : null,
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 className={className}>{children}</h2>
  ),
}));

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="alert-dialog-root">{children}</div> : null,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogCancel: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
  AlertDialogAction: ({
    children,
    onClick,
    disabled,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  ),
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
      checked={Boolean(checked)}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
    />
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("lucide-react", () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    Pencil: Icon,
    Pause: Icon,
    Trash2: Icon,
    RefreshCw: Icon,
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

function TestLoadingHook({ mode }: { mode: "success" | "error" }) {
  const result = useQuery({
    queryKey: ["depense-actions-dialog-test", mode],
    queryFn: async () => {
      await Promise.resolve();
      if (mode === "error") {
        throw new Error("x");
      }
      return { label: "loaded" };
    },
  });

  return (
    <div>
      <span data-testid="loading">{String(result.isLoading)}</span>
      <span data-testid="error">{String(result.isError)}</span>
      <span data-testid="data">{result.data?.label ?? ""}</span>
    </div>
  );
}

describe("DepenseActionsDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    FORMAT_CURRENCY_FN.mockImplementation((value: number) => `${value.toFixed(2)} €`);
  });

  it("couvre le chargement puis le succès d'un hook avec QueryClientProvider", async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ["loading-success"],
          queryFn: async () => {
            await Promise.resolve();
            return { total: QUERY_ROWS.length, firstId: QUERY_ROWS[0].id };
          },
        }),
      { wrapper }
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual({ total: 1, firstId: "1" });
    expect(result.current.isError).toBe(false);
  });

  it("couvre l'erreur d'un hook avec isError à true", async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ["loading-error"],
          queryFn: async () => {
            await Promise.resolve();
            throw new Error("x");
          },
        }),
      { wrapper }
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe("x");
  });

  it("affiche les valeurs métier réelles de la dépense et la récurrence détectée", () => {
    const onOpenChange = vi.fn();
    const onEdit = vi.fn();

    render(
      <DepenseActionsDialog
        open={true}
        onOpenChange={onOpenChange}
        depense={DEPENSE}
        allDepenses={ALL_DEPENSES}
        onEdit={onEdit}
      />
    );

    expect(screen.getByText("Abonnement (janv. 30)")).toBeInTheDocument();
    expect(screen.getByText("-25.00 €")).toBeInTheDocument();
    expect(FORMAT_CURRENCY_FN).toHaveBeenCalledWith(25);
    expect(screen.getByText("Cette dépense fait partie d'une récurrence")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(
      screen.getByLabelText(`Appliquer à toutes les occurrences futures (${FUTURE_COUNT})`)
    ).toBeInTheDocument();
  });

  it("déclenche onEdit lors du clic sur Modifier", () => {
    const onOpenChange = vi.fn();
    const onEdit = vi.fn();

    render(
      <DepenseActionsDialog
        open={true}
        onOpenChange={onOpenChange}
        depense={DEPENSE}
        allDepenses={ALL_DEPENSES}
        onEdit={onEdit}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /modifier/i }));

    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("suspend une seule dépense et ferme le dialogue", async () => {
    UPDATE_DEPENSE_FN.mockImplementation(
      (
        payload: { id: string; updates: { date_prevue: string } },
        options?: { onSuccess?: () => void; onError?: (error: Error) => void }
      ) => {
        options?.onSuccess?.();
        return payload;
      }
    );

    const onOpenChange = vi.fn();
    const onEdit = vi.fn();

    render(
      <DepenseActionsDialog
        open={true}
        onOpenChange={onOpenChange}
        depense={DEPENSE}
        allDepenses={ALL_DEPENSES}
        onEdit={onEdit}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /suspendre/i }));

    await waitFor(() => {
      expect(UPDATE_DEPENSE_FN).toHaveBeenCalledTimes(1);
    });

    expect(UPDATE_DEPENSE_FN).toHaveBeenCalledWith(
      { id: "dep-2", updates: { date_prevue: "1900-01-01" } },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      })
    );

    expect(TOAST_FN).toHaveBeenCalledWith({
      title: "Dépense(s) suspendue(s)",
      description: '1 dépense(s) déplacée(s) vers "À payer plus tard"',
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("suspend toutes les occurrences futures quand la case est cochée", async () => {
    UPDATE_DEPENSE_FN.mockImplementation(
      (
        payload: { id: string; updates: { date_prevue: string } },
        options?: { onSuccess?: () => void; onError?: (error: Error) => void }
      ) => {
        options?.onSuccess?.();
        return payload;
      }
    );

    const onOpenChange = vi.fn();

    render(
      <DepenseActionsDialog
        open={true}
        onOpenChange={onOpenChange}
        depense={DEPENSE}
        allDepenses={ALL_DEPENSES}
        onEdit={vi.fn()}
      />
    );

    fireEvent.click(
      screen.getByLabelText(`Appliquer à toutes les occurrences futures (${FUTURE_COUNT})`)
    );
    fireEvent.click(screen.getByRole("button", { name: /suspendre/i }));

    await waitFor(() => {
      expect(UPDATE_DEPENSE_FN).toHaveBeenCalledTimes(FUTURE_COUNT);
    });

    expect(UPDATE_DEPENSE_FN).toHaveBeenNthCalledWith(
      1,
      { id: "dep-1", updates: { date_prevue: "1900-01-01" } },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) })
    );
    expect(UPDATE_DEPENSE_FN).toHaveBeenNthCalledWith(
      2,
      { id: "dep-2", updates: { date_prevue: "1900-01-01" } },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) })
    );
    expect(UPDATE_DEPENSE_FN).toHaveBeenNthCalledWith(
      3,
      { id: "dep-3", updates: { date_prevue: "1900-01-01" } },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) })
    );
    expect(UPDATE_DEPENSE_FN).toHaveBeenNthCalledWith(
      4,
      { id: "dep-4", updates: { date_prevue: "1900-01-01" } },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) })
    );

    expect(TOAST_FN).toHaveBeenCalledWith({
      title: "Dépense(s) suspendue(s)",
      description: '4 dépense(s) déplacée(s) vers "À payer plus tard"',
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("affiche une erreur si la suspension échoue", async () => {
    UPDATE_DEPENSE_FN.mockImplementation(
      (
        _payload: { id: string; updates: { date_prevue: string } },
        options?: { onSuccess?: () => void; onError?: (error: Error) => void }
      ) => {
        options?.onError?.(new Error("x"));
      }
    );

    render(
      <DepenseActionsDialog
        open={true}
        onOpenChange={vi.fn()}
        depense={DEPENSE}
        allDepenses={ALL_DEPENSES}
        onEdit={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /suspendre/i }));

    await waitFor(() => {
      expect(TOAST_FN).toHaveBeenCalledWith({
        title: "Erreur",
        description: "Impossible de suspendre la dépense",
        variant: "destructive",
      });
    });
  });

  it("supprime une dépense après confirmation", async () => {
    DELETE_DEPENSE_FN.mockImplementation(
      (
        id: string,
        options?: { onSuccess?: () => void; onError?: (error: Error) => void }
      ) => {
        options?.onSuccess?.();
        return id;
      }
    );

    const onOpenChange = vi.fn();

    render(
      <DepenseActionsDialog
        open={true}
        onOpenChange={onOpenChange}
        depense={DEPENSE}
        allDepenses={ALL_DEPENSES}
        onEdit={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /supprimer/i }));
    expect(screen.getByText("Confirmer la suppression")).toBeInTheDocument();
    expect(
      screen.getByText(/Vous allez supprimer la dépense "Abonnement \(janv\. 30\)"/i)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^supprimer$/i }));

    await waitFor(() => {
      expect(DELETE_DEPENSE_FN).toHaveBeenCalledTimes(1);
    });

    expect(DELETE_DEPENSE_FN).toHaveBeenCalledWith(
      "dep-2",
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      })
    );

    expect(TOAST_FN).toHaveBeenCalledWith({
      title: "Dépense(s) supprimée(s)",
      description: "1 dépense(s) supprimée(s)",
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("supprime toutes les occurrences futures quand applyToAll est actif", async () => {
    DELETE_DEPENSE_FN.mockImplementation(
      (
        id: string,
        options?: { onSuccess?: () => void; onError?: (error: Error) => void }
      ) => {
        options?.onSuccess?.();
        return id;
      }
    );

    render(
      <DepenseActionsDialog
        open={true}
        onOpenChange={vi.fn()}
        depense={DEPENSE}
        allDepenses={ALL_DEPENSES}
        onEdit={vi.fn()}
      />
    );

    fireEvent.click(
      screen.getByLabelText(`Appliquer à toutes les occurrences futures (${FUTURE_COUNT})`)
    );
    fireEvent.click(screen.getByRole("button", { name: /supprimer/i }));

    const alertRoot = screen.getByTestId("alert-dialog-root");
    expect(within(alertRoot).getByText(/Vous allez supprimer/i)).toBeInTheDocument();
    expect(within(alertRoot).getByText(String(FUTURE_COUNT))).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^supprimer$/i }));

    await waitFor(() => {
      expect(DELETE_DEPENSE_FN).toHaveBeenCalledTimes(FUTURE_COUNT);
    });

    expect(DELETE_DEPENSE_FN).toHaveBeenNthCalledWith(
      1,
      "dep-1",
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) })
    );
    expect(DELETE_DEPENSE_FN).toHaveBeenNthCalledWith(
      2,
      "dep-2",
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) })
    );
    expect(DELETE_DEPENSE_FN).toHaveBeenNthCalledWith(
      3,
      "dep-3",
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) })
    );
    expect(DELETE_DEPENSE_FN).toHaveBeenNthCalledWith(
      4,
      "dep-4",
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) })
    );

    expect(TOAST_FN).toHaveBeenCalledWith({
      title: "Dépense(s) supprimée(s)",
      description: "4 dépense(s) supprimée(s)",
    });
  });

  it("affiche une erreur si la suppression échoue", async () => {
    DELETE_DEPENSE_FN.mockImplementation(
      (
        _id: string,
        options?: { onSuccess?: () => void; onError?: (error: Error) => void }
      ) => {
        options?.onError?.(new Error("x"));
      }
    );

    render(
      <DepenseActionsDialog
        open={true}
        onOpenChange={vi.fn()}
        depense={DEPENSE}
        allDepenses={ALL_DEPENSES}
        onEdit={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /supprimer/i }));
    fireEvent.click(screen.getByRole("button", { name: /^supprimer$/i }));

    await waitFor(() => {
      expect(TOAST_FN).toHaveBeenCalledWith({
        title: "Erreur",
        description: "Impossible de supprimer la dépense",
        variant: "destructive",
      });
    });
  });

  it("retourne null quand depense est null", () => {
    const { container } = render(
      <DepenseActionsDialog
        open={true}
        onOpenChange={vi.fn()}
        depense={null}
        allDepenses={ALL_DEPENSES}
        onEdit={vi.fn()}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("valide visuellement le cycle chargement -> succès -> erreur avec un composant de test", async () => {
    const wrapper = createWrapper();

    const { rerender } = render(<TestLoadingHook mode="success" />, { wrapper });

    expect(screen.getByTestId("loading").textContent).toBe("true");

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    expect(screen.getByTestId("error").textContent).toBe("false");
    expect(screen.getByTestId("data").textContent).toBe("loaded");

    rerender(<TestLoadingHook mode="error" />);

    await waitFor(() => {
      expect(screen.getByTestId("error").textContent).toBe("true");
    });
  });
});