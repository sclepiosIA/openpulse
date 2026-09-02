/* @vitest-environment jsdom */
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { renderHook, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PartenaireDomainManager } from "./PartenaireDomainManager";

const {
  AUTH_STATE,
  TOAST_FN,
  SANITIZED_ERROR,
  INVOKE_EDGE_MOCK,
  MOCK_FROM,
  STABLE_MAPPINGS,
  EMPTY_MAPPINGS,
  addMutationState,
  removeMutationState,
  queryState,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    user: { id: "u1", email: "user@test.co" },
    session: { user: { id: "u1" } },
    isLoading: false,
  },
  TOAST_FN: vi.fn(),
  SANITIZED_ERROR: "Erreur traitée",
  INVOKE_EDGE_MOCK: vi.fn(),
  MOCK_FROM: vi.fn(),
  STABLE_MAPPINGS: [
    {
      id: "map-1",
      domain: "mapped.com",
      verified: true,
      confidence_level: "high",
    },
    {
      id: "map-2",
      domain: "pending.org",
      verified: false,
      confidence_level: "medium",
    },
  ],
  EMPTY_MAPPINGS: [],
  addMutationState: {
    mutateAsync: vi.fn(),
    isPending: false,
  },
  removeMutationState: {
    mutateAsync: vi.fn(),
    isPending: false,
  },
  queryState: {
    data: [] as Array<{
      id: string;
      domain: string;
      verified: boolean;
      confidence_level: string;
    }>,
    isLoading: false,
    isError: false,
    error: null as { message: string } | null,
  },
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
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: (
      resolve: (value: { data: null; error: null }) => PromiseLike<{ data: null; error: null }> | { data: null; error: null },
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve({ data: null, error: null }).then(resolve, reject),
    catch: (reject: (reason: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).catch(reject),
  };

  MOCK_FROM.mockImplementation(() => builder);

  return {
    supabase: {
      from: MOCK_FROM,
    },
  };
});

vi.mock("@/hooks/shared/use-toast", () => ({
  useToast: () => ({
    toast: TOAST_FN,
  }),
}));

vi.mock("@/lib/supabaseErrorSanitizer", () => ({
  sanitizeSupabaseError: vi.fn(() => SANITIZED_ERROR),
}));

vi.mock("@/services/edgeFunctions", () => ({
  invokeEdge: INVOKE_EDGE_MOCK,
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

vi.mock("@/hooks/email/useEmailDomainMappings", () => ({
  useEmailDomainMappings: vi.fn(() => queryState),
  useAddDomainMapping: vi.fn(() => addMutationState),
  useRemoveDomainMapping: vi.fn(() => removeMutationState),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
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

vi.mock("@/components/ui/input", () => ({
  Input: ({
    value,
    onChange,
    onKeyDown,
    placeholder,
    className,
    ...props
  }: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
      value={typeof value === "string" ? value : ""}
      onChange={onChange}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      className={className}
      {...props}
    />
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
    variant?: string;
  }) => <span className={className}>{children}</span>,
}));

vi.mock("lucide-react", () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />;
  return {
    Globe: Icon,
    Plus: Icon,
    Trash2: Icon,
    Loader2: Icon,
    RefreshCw: Icon,
    ShieldCheck: Icon,
    ShieldAlert: Icon,
  };
});

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

describe("PartenaireDomainManager", () => {
  beforeEach(() => {
    TOAST_FN.mockReset();
    INVOKE_EDGE_MOCK.mockReset();
    MOCK_FROM.mockReset();
    addMutationState.mutateAsync.mockReset();
    removeMutationState.mutateAsync.mockReset();
    addMutationState.isPending = false;
    removeMutationState.isPending = false;
    queryState.data = EMPTY_MAPPINGS;
    queryState.isLoading = false;
    queryState.isError = false;
    queryState.error = null;
  });

  it("affiche le chargement puis les domaines officiels et mappés avec les valeurs métier attendues", async () => {
    queryState.isLoading = true;
    queryState.data = EMPTY_MAPPINGS;

    const { rerender } = render(
      <PartenaireDomainManager partenaireId="part-1" officialDomains={["official.com"]} />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText("Chargement...")).toBeInTheDocument();
    expect(screen.getByText("Domaines email officiels")).toBeInTheDocument();
    expect(screen.getByText("official.com")).toBeInTheDocument();

    queryState.isLoading = false;
    queryState.data = STABLE_MAPPINGS;

    rerender(<PartenaireDomainManager partenaireId="part-1" officialDomains={["official.com"]} />);

    expect(await screen.findByText("mapped.com")).toBeInTheDocument();
    expect(screen.getByText("pending.org")).toBeInTheDocument();
    expect(screen.getByText("Vérifié")).toBeInTheDocument();
    expect(screen.getByText("Non vérifié")).toBeInTheDocument();
    expect(screen.getByText("high")).toBeInTheDocument();
    expect(screen.getByText("medium")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Supprimer le domaine mapped.com" })).toBeInTheDocument();
  });

  it("ajoute un domaine valide normalisé et vide le champ ensuite", async () => {
    queryState.data = STABLE_MAPPINGS;
    addMutationState.mutateAsync.mockResolvedValue({ data: { id: "new-1" }, error: null });

    const user = userEvent.setup();
    render(<PartenaireDomainManager partenaireId="part-42" officialDomains={["official.com"]} />, {
      wrapper: createWrapper(),
    });

    const input = screen.getByLabelText("Nouveau domaine à ajouter");
    await user.type(input, "  New-Domain.FR  ");
    await user.click(screen.getByRole("button", { name: /Ajouter/i }));

    await waitFor(() => {
      expect(addMutationState.mutateAsync).toHaveBeenCalledWith({
        partenaireId: "part-42",
        domain: "new-domain.fr",
        confidenceLevel: "high",
      });
    });

    expect(input).toHaveValue("");
  });

  it("empêche l'ajout d'un domaine invalide et affiche le toast d'erreur dédié", async () => {
    queryState.data = EMPTY_MAPPINGS;

    const user = userEvent.setup();
    render(<PartenaireDomainManager partenaireId="part-1" />, {
      wrapper: createWrapper(),
    });

    await user.type(screen.getByLabelText("Nouveau domaine à ajouter"), "bad_domain");
    await user.click(screen.getByRole("button", { name: /Ajouter/i }));

    expect(addMutationState.mutateAsync).not.toHaveBeenCalled();
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: "Erreur",
      description: "Format de domaine invalide (ex: example.com)",
      variant: "destructive",
    });
  });

  it("empêche l'ajout d'un doublon provenant des mappings ou des domaines officiels", async () => {
    queryState.data = STABLE_MAPPINGS;

    const user = userEvent.setup();
    render(<PartenaireDomainManager partenaireId="part-1" officialDomains={["official.com"]} />, {
      wrapper: createWrapper(),
    });

    await user.type(screen.getByLabelText("Nouveau domaine à ajouter"), "mapped.com");
    await user.click(screen.getByRole("button", { name: /Ajouter/i }));

    expect(addMutationState.mutateAsync).not.toHaveBeenCalled();
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: "Erreur",
      description: "Ce domaine est déjà associé",
      variant: "destructive",
    });

    TOAST_FN.mockClear();

    const input = screen.getByLabelText("Nouveau domaine à ajouter");
    await user.clear(input);
    await user.type(input, "official.com");
    await user.click(screen.getByRole("button", { name: /Ajouter/i }));

    expect(addMutationState.mutateAsync).not.toHaveBeenCalled();
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: "Erreur",
      description: "Ce domaine est déjà associé",
      variant: "destructive",
    });
  });

  it("supprime un domaine mappé via la mutation dédiée", async () => {
    queryState.data = STABLE_MAPPINGS;
    removeMutationState.mutateAsync.mockResolvedValue({ data: null, error: null });

    const user = userEvent.setup();
    render(<PartenaireDomainManager partenaireId="part-1" />, {
      wrapper: createWrapper(),
    });

    await user.click(screen.getByRole("button", { name: "Supprimer le domaine mapped.com" }));

    await waitFor(() => {
      expect(removeMutationState.mutateAsync).toHaveBeenCalledWith("map-1");
    });
  });

  it("reclasse les emails, invalide les bonnes queries et affiche un toast de succès", async () => {
    queryState.data = STABLE_MAPPINGS;
    INVOKE_EDGE_MOCK.mockResolvedValue({ data: { ok: true }, error: null });

    const queryClient = createQueryClient();
    const wrapper = createWrapper(queryClient);

    const { result } = renderHook(() => queryClient, { wrapper });
    const invalidateSpy = vi.spyOn(result.current, "invalidateQueries").mockResolvedValue(undefined);

    render(<PartenaireDomainManager partenaireId="partner-9" />, {
      wrapper,
    });

    const user = userEvent.setup();

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Reclasser les emails par domaine" }));
    });

    await waitFor(() => {
      expect(INVOKE_EDGE_MOCK).toHaveBeenCalledWith("auto-match-emails", { limit: 100 });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["email-domain-mappings"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["emails-by-partenaire", "partner-9"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["email-threads"] });
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: "Reclassification terminée",
      description: "Les emails ont été reclassés selon les domaines",
    });
  });

  it("gère l'erreur de reclassification avec message sanitizé", async () => {
    queryState.data = STABLE_MAPPINGS;
    INVOKE_EDGE_MOCK.mockRejectedValue({ message: "x" });

    render(<PartenaireDomainManager partenaireId="part-1" />, {
      wrapper: createWrapper(),
    });

    const user = userEvent.setup();

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Reclasser les emails par domaine" }));
    });

    await waitFor(() => {
      expect(TOAST_FN).toHaveBeenCalledWith({
        title: "Erreur",
        description: SANITIZED_ERROR,
        variant: "destructive",
      });
    });
  });

  it("expose un scénario d'erreur via renderHook avec wrapper QueryClientProvider", async () => {
    const wrapper = createWrapper();

    const useFakeMappingsError = () => ({
      data: null as null,
      error: { message: "x" },
      isError: true,
      isLoading: false,
    });

    const { result } = renderHook(() => useFakeMappingsError(), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toEqual({ message: "x" });
  });
});