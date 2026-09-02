// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { OffboardingActionDialog } from "./OffboardingActionDialog";

const {
  PROFILES,
  AUTH_STATE,
  mockFrom,
  mockInvokeEdge,
  mockToastSuccess,
  mockToastError,
  mockSanitizeSupabaseError,
  mockOnCompleted,
  UPSERT_OK,
  QUERY_OK,
} = vi.hoisted(() => ({
  PROFILES: [
    {
      id: "p-target",
      user_id: "u-target",
      prenom: "Jean",
      nom: "Dupont",
      email: "jean@example.test",
      actif: true,
    },
    {
      id: "p-1",
      user_id: "u-1",
      prenom: "Alice",
      nom: "Martin",
      email: "alice@example.test",
      actif: true,
    },
    {
      id: "p-2",
      user_id: "u-2",
      prenom: "Bob",
      nom: "Durand",
      email: "bob@example.test",
      actif: false,
    },
  ],
  AUTH_STATE: {
    user: { id: "u-auth", email: "auth@example.test" },
    session: { user: { id: "u-auth" } },
    isLoading: false,
  },
  mockFrom: vi.fn(),
  mockInvokeEdge: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockSanitizeSupabaseError: vi.fn(),
  mockOnCompleted: vi.fn(),
  UPSERT_OK: { data: null, error: null },
  QUERY_OK: { data: null, error: null },
}));

type Builder = ReturnType<typeof createBuilder>;

function createBuilder() {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    upsert: vi.fn(() => Promise.resolve(UPSERT_OK)),
    single: vi.fn(() => Promise.resolve(QUERY_OK)),
    maybeSingle: vi.fn(() => Promise.resolve(QUERY_OK)),
    then: (onFulfilled: (value: typeof QUERY_OK) => unknown) =>
      Promise.resolve(onFulfilled(QUERY_OK)),
    catch: () => Promise.resolve(QUERY_OK),
  };

  return builder;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock("@/hooks/profile/useProfilesWithRoles", () => ({
  useProfilesWithRoles: vi.fn(() => ({
    data: PROFILES,
    isLoading: false,
    isError: false,
    error: null,
  })),
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: vi.fn(() => AUTH_STATE),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(() => AUTH_STATE),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(() => AUTH_STATE),
}));

vi.mock("@/services/edgeFunctions", () => ({
  invokeEdge: mockInvokeEdge,
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

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    children,
  }: {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children: React.ReactNode;
  }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode; className?: string }) => (
    <div>{children}</div>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode; className?: string }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode; className?: string }) => (
    <h2>{children}</h2>
  ),
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

vi.mock("@/components/ui/input", () => ({
  Input: ({
    value,
    onChange,
    placeholder,
    id,
    type,
    autoComplete,
  }: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
      id={id}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      autoComplete={autoComplete}
    />
  ),
}));

vi.mock("@/components/ui/textarea", () => ({
  Textarea: ({
    value,
    onChange,
    placeholder,
    id,
    rows,
  }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <textarea id={id} value={value} onChange={onChange} placeholder={placeholder} rows={rows} />
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
    <select
      aria-label="Réassigner les tâches et événements à"
      value={value}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <option value="__placeholder__">{placeholder}</option>
  ),
}));

vi.mock("@/components/ui/alert", () => ({
  Alert: ({ children }: { children: React.ReactNode; variant?: string }) => <div>{children}</div>,
  AlertDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("lucide-react", () => ({
  AlertTriangle: () => <span data-testid="icon-alert" />,
  UserMinus: () => <span data-testid="icon-user-minus" />,
  Loader2: () => <span data-testid="icon-loader" />,
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function createWrapper(queryClient?: QueryClient) {
  const client = queryClient ?? createQueryClient();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function renderWithClient(ui: React.ReactElement) {
  const queryClient = createQueryClient();
  const invalidateSpy = vi
    .spyOn(queryClient, "invalidateQueries")
    .mockResolvedValue(undefined);
  return {
    queryClient,
    invalidateSpy,
    ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>),
  };
}

describe("OffboardingActionDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockImplementation(() => createBuilder());
    mockSanitizeSupabaseError.mockImplementation((error: unknown) => {
      if (error instanceof Error) return error.message;
      if (
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof (error as { message?: unknown }).message === "string"
      ) {
        return (error as { message: string }).message;
      }
      return "Erreur inconnue";
    });
    mockInvokeEdge.mockResolvedValue({
      summary: {
        taches_reassigned: 3,
        events_reassigned: 2,
        email_accounts_deactivated: 1,
      },
    });
  });

  it("gère le chargement puis le succès avec renderHook dans un wrapper QueryClientProvider", async () => {
    const queryClient = createQueryClient();
    const wrapper = createWrapper(queryClient);

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ["hook-loading-success"],
          queryFn: async () => {
            await Promise.resolve();
            return { status: "ok", total: 2 };
          },
        }),
      { wrapper },
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual({ status: "ok", total: 2 });
  });

  it("gère l'erreur avec renderHook dans un wrapper QueryClientProvider", async () => {
    const queryClient = createQueryClient();
    const wrapper = createWrapper(queryClient);

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ["hook-error"],
          queryFn: async () => {
            throw new Error("x");
          },
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe("x");
  });

  it("affiche les valeurs métier, filtre les candidats et confirme un offboarding réussi", async () => {
    const { invalidateSpy } = renderWithClient(
      <OffboardingActionDialog
        profileId="p-target"
        profileName=" Jean Dupont "
        onCompleted={mockOnCompleted}
      />,
    );

    expect(screen.getByText("Offboarder ce collaborateur")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Offboarding — Jean Dupont/i })).toBeInTheDocument();
    expect(screen.getByText(/Cette action est irréversible/i)).toBeInTheDocument();
    expect(screen.getByText(/Le profil sera marqué/i)).toHaveTextContent(
      "Le profil sera marqué inactif, le compte d'authentification supprimé et les rôles révoqués.",
    );

    const select = screen.getByLabelText("Réassigner les tâches et événements à") as HTMLSelectElement;
    const options = Array.from(select.querySelectorAll("option")).map((option) => ({
      value: option.value,
      text: option.textContent,
    }));

    expect(options).toEqual(
      expect.arrayContaining([
        {
          value: "__none__",
          text: "Aucune réassignation (laisser vacant)",
        },
        {
          value: "u-1",
          text: "Alice Martin — alice@example.test",
        },
      ]),
    );
    expect(options.some((option) => option.value === "u-target")).toBe(false);
    expect(options.some((option) => option.value === "u-2")).toBe(false);

    const confirmInput = screen.getByPlaceholderText("OFFBOARD JEAN DUPONT");
    const submitButton = screen.getByRole("button", { name: /Confirmer l'offboarding/i });
    const dateInput = screen.getByLabelText("Date de sortie");
    const motifInput = screen.getByLabelText("Motif de sortie");

    expect(submitButton).toBeDisabled();

    fireEvent.change(dateInput, { target: { value: "2026-03-14" } });
    fireEvent.change(motifInput, { target: { value: "Démission" } });
    fireEvent.change(select, { target: { value: "u-1" } });
    fireEvent.change(confirmInput, { target: { value: "offboard jean dupont" } });

    expect(submitButton).not.toBeDisabled();

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith("rh_onboarding_offboarding");
    });

    const builder = mockFrom.mock.results[0]?.value as Builder;
    expect(builder.upsert).toHaveBeenCalledWith(
      {
        profile_id: "p-target",
        statut: "sorti",
        date_sortie: "2026-03-14",
        motif_sortie: "Démission",
      },
      { onConflict: "profile_id" },
    );

    await waitFor(() => {
      expect(mockInvokeEdge).toHaveBeenCalledWith("offboard-user", {
        target_profile_id: "p-target",
        reassign_to_user_id: "u-1",
      });
    });

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Offboarding terminé pour  Jean Dupont ", {
        description: "Tâches: 3 • Évén.: 2 • Comptes email: 1",
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["profiles"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["profiles-with-roles"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["onboarding-offboarding"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["taches"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["calendar_events"] });

    await waitFor(() => {
      expect(mockOnCompleted).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(confirmInput).toHaveValue("");
    });
  });

  it("gère une erreur de la fonction edge et affiche le message sanitizé", async () => {
    mockInvokeEdge.mockResolvedValueOnce({
      error: "x",
    });
    mockSanitizeSupabaseError.mockReturnValueOnce("x");

    renderWithClient(
      <OffboardingActionDialog profileId="p-target" profileName="Jean Dupont" />,
    );

    fireEvent.change(screen.getByLabelText(/Pour confirmer, tapez/i), {
      target: { value: "OFFBOARD JEAN DUPONT" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Confirmer l'offboarding/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Échec de l'offboarding", {
        description: "x",
      });
    });

    expect(mockSanitizeSupabaseError).toHaveBeenCalled();
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(mockOnCompleted).not.toHaveBeenCalled();
  });
});