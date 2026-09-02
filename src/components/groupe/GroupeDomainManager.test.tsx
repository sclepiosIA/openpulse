/* @vitest-environment jsdom */
import React from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderHook, act } from "@testing-library/react";
import { GroupeDomainManager } from "./GroupeDomainManager";

const {
  AUTH_STATE,
  TOAST_FN,
  INVOKE_EDGE_FN,
  SANITIZE_FN,
  MAPPINGS_ROWS,
  EMPTY_ROWS,
  ADD_MUTATE_ASYNC,
  REMOVE_MUTATE_ASYNC,
  EMAIL_MAPPINGS_HOOK,
  ADD_HOOK_STATE,
  REMOVE_HOOK_STATE,
  mockFrom,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    user: { id: "u1", email: "t@t.co" },
    session: { user: { id: "u1" } },
    isLoading: false,
  },
  TOAST_FN: vi.fn(),
  INVOKE_EDGE_FN: vi.fn(),
  SANITIZE_FN: vi.fn(),
  MAPPINGS_ROWS: [
    {
      id: "m1",
      domain: "mapped.com",
      verified: true,
      confidence_level: "high",
    },
    {
      id: "m2",
      domain: "pending.org",
      verified: false,
      confidence_level: "medium",
    },
  ],
  EMPTY_ROWS: [],
  ADD_MUTATE_ASYNC: vi.fn(),
  REMOVE_MUTATE_ASYNC: vi.fn(),
  EMAIL_MAPPINGS_HOOK: vi.fn(),
  ADD_HOOK_STATE: {
    mutateAsync: vi.fn(),
    isPending: false,
  },
  REMOVE_HOOK_STATE: {
    mutateAsync: vi.fn(),
    isPending: false,
  },
  mockFrom: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => {
  const result = { data: null, error: null };
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
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (onFulfilled: (value: typeof result) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
  };

  mockFrom.mockReturnValue(builder);

  return {
    supabase: {
      from: mockFrom,
    },
  };
});

vi.mock("@/hooks/shared/use-toast", () => ({
  useToast: () => ({
    toast: TOAST_FN,
  }),
}));

vi.mock("@/lib/supabaseErrorSanitizer", () => ({
  sanitizeSupabaseError: SANITIZE_FN,
}));

vi.mock("@/services/edgeFunctions", () => ({
  invokeEdge: INVOKE_EDGE_FN,
}));

vi.mock("@/hooks/email/useEmailDomainMappings", () => ({
  useEmailDomainMappings: EMAIL_MAPPINGS_HOOK,
  useAddDomainMapping: () => ADD_HOOK_STATE,
  useRemoveDomainMapping: () => REMOVE_HOOK_STATE,
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

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 className={className}>{children}</h2>
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: (props: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    type?: "button" | "submit" | "reset";
    "aria-label"?: string;
  }) => (
    <button
      type={props.type ?? "button"}
      onClick={props.onClick}
      disabled={props.disabled}
      aria-label={props["aria-label"]}
    >
      {props.children}
    </button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: {
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    placeholder?: string;
    className?: string;
    "aria-label"?: string;
  }) => (
    <input
      value={props.value}
      onChange={props.onChange}
      onKeyDown={props.onKeyDown}
      placeholder={props.placeholder}
      className={props.className}
      aria-label={props["aria-label"]}
    />
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span className={className}>{children}</span>
  ),
}));

vi.mock("lucide-react", () => ({
  Globe: () => <svg data-testid="icon-globe" />,
  Plus: () => <svg data-testid="icon-plus" />,
  Trash2: () => <svg data-testid="icon-trash" />,
  Loader2: () => <svg data-testid="icon-loader" />,
  RefreshCw: () => <svg data-testid="icon-refresh" />,
  ShieldCheck: () => <svg data-testid="icon-shield-check" />,
  ShieldAlert: () => <svg data-testid="icon-shield-alert" />,
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function createWrapper(client?: QueryClient) {
  const queryClient = client ?? createQueryClient();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("GroupeDomainManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    ADD_HOOK_STATE.mutateAsync = ADD_MUTATE_ASYNC;
    ADD_HOOK_STATE.isPending = false;
    REMOVE_HOOK_STATE.mutateAsync = REMOVE_MUTATE_ASYNC;
    REMOVE_HOOK_STATE.isPending = false;

    EMAIL_MAPPINGS_HOOK.mockReturnValue({
      data: MAPPINGS_ROWS,
      isLoading: false,
      isError: false,
      error: null,
    });

    INVOKE_EDGE_FN.mockResolvedValue({ ok: true });
    SANITIZE_FN.mockReturnValue("sanitized failure");
    ADD_MUTATE_ASYNC.mockResolvedValue({ data: null, error: null });
    REMOVE_MUTATE_ASYNC.mockResolvedValue({ data: null, error: null });
  });

  it("affiche le chargement puis les domaines officiels et mappés avec leurs statuts métier", async () => {
    EMAIL_MAPPINGS_HOOK
      .mockReturnValueOnce({
        data: MAPPINGS_ROWS,
        isLoading: true,
        isError: false,
        error: null,
      })
      .mockReturnValue({
        data: MAPPINGS_ROWS,
        isLoading: false,
        isError: false,
        error: null,
      });

    const queryClient = createQueryClient();
    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <GroupeDomainManager groupeId="g1" officialDomains={["official.fr"]} />
      </QueryClientProvider>,
    );

    expect(screen.getByText("Chargement...")).toBeInTheDocument();

    rerender(
      <QueryClientProvider client={queryClient}>
        <GroupeDomainManager groupeId="g1" officialDomains={["official.fr"]} />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Domaines email officiels")).toBeInTheDocument();
    expect(screen.getByText("official.fr")).toBeInTheDocument();
    expect(screen.getByText("mapped.com")).toBeInTheDocument();
    expect(screen.getByText("pending.org")).toBeInTheDocument();
    expect(screen.getByText("Vérifié")).toBeInTheDocument();
    expect(screen.getByText("Non vérifié")).toBeInTheDocument();
    expect(screen.getByText("high")).toBeInTheDocument();
    expect(screen.getByText("medium")).toBeInTheDocument();
  });

  it("ajoute un domaine valide normalisé en minuscules avec confidenceLevel high", async () => {
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={createQueryClient()}>
        <GroupeDomainManager groupeId="g1" officialDomains={["official.fr"]} />
      </QueryClientProvider>,
    );

    const input = screen.getByLabelText("Nouveau domaine à ajouter");
    await user.type(input, "  New-Domain.COM  ");
    await user.click(screen.getByRole("button", { name: /Ajouter/i }));

    await waitFor(() => {
      expect(ADD_MUTATE_ASYNC).toHaveBeenCalledWith({
        groupeId: "g1",
        domain: "new-domain.com",
        confidenceLevel: "high",
      });
    });

    expect((input as HTMLInputElement).value).toBe("");
  });

  it("supprime un domaine mappé via la mutation dédiée", async () => {
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={createQueryClient()}>
        <GroupeDomainManager groupeId="g1" officialDomains={[]} />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Supprimer le domaine mapped.com" }));

    await waitFor(() => {
      expect(REMOVE_MUTATE_ASYNC).toHaveBeenCalledWith("m1");
    });
  });

  it("refuse un domaine vide, invalide ou en doublon avec des messages spécifiques", async () => {
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={createQueryClient()}>
        <GroupeDomainManager groupeId="g1" officialDomains={["official.fr"]} />
      </QueryClientProvider>,
    );

    const input = screen.getByLabelText("Nouveau domaine à ajouter");
    const addButton = screen.getByRole("button", { name: /Ajouter/i });

    await user.click(addButton);
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: "Erreur",
      description: "Veuillez entrer un domaine",
      variant: "destructive",
    });

    await user.type(input, "bad_domain");
    await user.click(addButton);
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: "Erreur",
      description: "Format de domaine invalide (ex: example.com)",
      variant: "destructive",
    });

    await user.clear(input);
    await user.type(input, "mapped.com");
    await user.click(addButton);
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: "Erreur",
      description: "Ce domaine est déjà associé",
      variant: "destructive",
    });

    await user.clear(input);
    await user.type(input, "official.fr");
    await user.click(addButton);
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: "Erreur",
      description: "Ce domaine est déjà associé",
      variant: "destructive",
    });

    expect(ADD_MUTATE_ASYNC).not.toHaveBeenCalled();
  });

  it("affiche le message vide quand aucun domaine mappé n'existe", () => {
    EMAIL_MAPPINGS_HOOK.mockReturnValue({
      data: EMPTY_ROWS,
      isLoading: false,
      isError: false,
      error: null,
    });

    render(
      <QueryClientProvider client={createQueryClient()}>
        <GroupeDomainManager groupeId="g1" officialDomains={[]} />
      </QueryClientProvider>,
    );

    expect(
      screen.getByText(
        "Aucun domaine mappé. Ajoutez des domaines pour classifier automatiquement les emails.",
      ),
    ).toBeInTheDocument();
  });

  it("reclassifie les emails, invalide les bonnes query keys et affiche un toast de succès", async () => {
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <GroupeDomainManager groupeId="g42" officialDomains={[]} />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Reclasser les emails par domaine" }));

    await waitFor(() => {
      expect(INVOKE_EDGE_FN).toHaveBeenCalledWith("auto-match-emails", { limit: 100 });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["email-domain-mappings", "g42"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["email-threads-groupe", "g42"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["email-threads"] });
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: "Reclassification terminée",
      description: "Les emails ont été reclassés selon les domaines",
    });
  });

  it("gère l'erreur de reclassification en sanitizant le message", async () => {
    INVOKE_EDGE_FN.mockRejectedValueOnce(new Error("edge failed"));
    SANITIZE_FN.mockReturnValueOnce("message propre");
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={createQueryClient()}>
        <GroupeDomainManager groupeId="g1" officialDomains={[]} />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Reclasser les emails par domaine" }));

    await waitFor(() => {
      expect(SANITIZE_FN).toHaveBeenCalled();
    });

    expect(TOAST_FN).toHaveBeenCalledWith({
      title: "Erreur",
      description: "message propre",
      variant: "destructive",
    });
  });

  it("supporte renderHook avec un wrapper QueryClientProvider configuré retry 0 et gcTime 0", async () => {
    const client = createQueryClient();
    const wrapper = createWrapper(client);

    const { result } = renderHook(
      () => {
        const queryClient = useQueryClient();
        return queryClient.getDefaultOptions();
      },
      { wrapper },
    );

    expect(result.current.queries?.retry).toBe(0);
    expect(result.current.queries?.gcTime).toBe(0);
    expect(result.current.mutations?.retry).toBe(0);

    await act(async () => {
      await Promise.resolve();
    });
  });

  it("expose un état erreur au niveau du hook mocké", async () => {
    EMAIL_MAPPINGS_HOOK.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      error: { message: "x" },
    });

    const wrapper = createWrapper();

    const { result } = renderHook(() => EMAIL_MAPPINGS_HOOK({ groupeId: "g1" }) as {
      data: typeof MAPPINGS_ROWS | null;
      isLoading: boolean;
      isError: boolean;
      error: { message: string } | null;
    }, { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isError).toBe(true);
    expect(result.current.error).toEqual({ message: "x" });
    expect(result.current.data).toBeNull();
  });
});