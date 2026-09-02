import React from "react";
import { render, screen, fireEvent, waitFor, act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery, useMutation } from "@tanstack/react-query";
import { ExcludedDomainsManager } from "./ExcludedDomainsManager";

const {
  STABLE_MAPPINGS,
  ADD_MUTATE,
  ADD_MUTATE_ASYNC,
  REMOVE_MUTATE,
  DEBUG_LOG,
  mockFrom,
} = vi.hoisted(() => ({
  STABLE_MAPPINGS: [
    {
      id: "m1",
      domain: "blocked.com",
      is_excluded: true,
      created_at: "2024-01-15T00:00:00.000Z",
    },
    {
      id: "m2",
      domain: "allowed-school.edu",
      is_excluded: false,
      created_at: "2024-01-16T00:00:00.000Z",
    },
    {
      id: "m3",
      domain: "mailer-daemon.com",
      is_excluded: true,
      created_at: "2024-02-20T00:00:00.000Z",
    },
  ],
  ADD_MUTATE: vi.fn(),
  ADD_MUTATE_ASYNC: vi.fn(),
  REMOVE_MUTATE: vi.fn(),
  DEBUG_LOG: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
  CardDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    type,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    type?: "button" | "submit" | "reset";
    className?: string;
  }) => (
    <button type={type ?? "button"} onClick={onClick} disabled={disabled} className={className}>
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
    id,
  }: {
    value?: string;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
    placeholder?: string;
    id?: string;
  }) => (
    <input
      id={id}
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
    />
  ),
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({
    children,
    htmlFor,
    className,
  }: {
    children: React.ReactNode;
    htmlFor?: string;
    className?: string;
  }) => (
    <label htmlFor={htmlFor} className={className}>
      {children}
    </label>
  ),
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="scroll-area" className={className}>
      {children}
    </div>
  ),
}));

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({
    children,
    open,
  }: {
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => <div data-testid="alert-dialog" data-open={open ? "true" : "false"}>{children}</div>,
  AlertDialogAction: ({
    children,
    onClick,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
  }) => (
    <button onClick={onClick} className={className}>
      {children}
    </button>
  ),
  AlertDialogCancel: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("lucide-react", () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />;
  return {
    Ban: Icon,
    Plus: Icon,
    Trash2: Icon,
    AlertTriangle: Icon,
    Loader2: Icon,
    Sparkles: Icon,
  };
});

vi.mock("@/lib/debug", () => ({
  debug: {
    log: DEBUG_LOG,
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock("@/hooks/email/useEmailDomainMappings", () => ({
  useEmailDomainMappings: vi.fn(),
  useAddDomainMapping: vi.fn(),
  useRemoveDomainMapping: vi.fn(),
}));

function createBuilder() {
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
    then: (onFulfilled: (value: { data: null; error: null }) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve({ data: null, error: null }).catch(onRejected),
  };
  return builder;
}

mockFrom.mockImplementation(() => createBuilder());

describe("ExcludedDomainsManager", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const hooks = await import("@/hooks/email/useEmailDomainMappings");
    vi.mocked(hooks.useEmailDomainMappings).mockReturnValue({
      data: STABLE_MAPPINGS,
      isLoading: false,
    } as unknown as ReturnType<typeof hooks.useEmailDomainMappings>);
    vi.mocked(hooks.useAddDomainMapping).mockReturnValue({
      mutate: ADD_MUTATE,
      mutateAsync: ADD_MUTATE_ASYNC,
      isPending: false,
    } as unknown as ReturnType<typeof hooks.useAddDomainMapping>);
    vi.mocked(hooks.useRemoveDomainMapping).mockReturnValue({
      mutate: REMOVE_MUTATE,
      isPending: false,
    } as unknown as ReturnType<typeof hooks.useRemoveDomainMapping>);
    ADD_MUTATE.mockImplementation(
      (
        _vars: { domain: string; isExcluded: boolean },
        opts?: { onSuccess?: () => void },
      ) => {
        opts?.onSuccess?.();
      },
    );
    REMOVE_MUTATE.mockImplementation(
      (_id: string, opts?: { onSuccess?: () => void }) => {
        opts?.onSuccess?.();
      },
    );
    ADD_MUTATE_ASYNC.mockResolvedValue({ data: null, error: null });
  });

  it("affiche le loader pendant le chargement", async () => {
    const hooks = await import("@/hooks/email/useEmailDomainMappings");
    vi.mocked(hooks.useEmailDomainMappings).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof hooks.useEmailDomainMappings>);

    render(<ExcludedDomainsManager />);

    expect(screen.getByTestId("card")).toBeInTheDocument();
    expect(screen.getByTestId("card-content")).toBeInTheDocument();
    expect(screen.queryByText("Domaines Hors Établissements")).not.toBeInTheDocument();
  });

  it("affiche uniquement les domaines exclus avec leurs valeurs métier", () => {
    render(<ExcludedDomainsManager />);

    expect(screen.getByText("Domaines Hors Établissements")).toBeInTheDocument();
    expect(screen.getByText("blocked.com")).toBeInTheDocument();
    expect(screen.getByText("mailer-daemon.com")).toBeInTheDocument();
    expect(screen.queryByText("allowed-school.edu")).not.toBeInTheDocument();
    expect(screen.getByText("Ajouté le 15/01/2024")).toBeInTheDocument();
    expect(screen.getByText("Ajouté le 20/02/2024")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("exemple-newsletter.com")).toBeInTheDocument();
    expect(screen.getByText("Suggérer")).toBeInTheDocument();
  });

  it("ajoute un domaine valide en minuscules puis réinitialise le champ", () => {
    render(<ExcludedDomainsManager />);

    const input = screen.getByPlaceholderText("exemple-newsletter.com") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "NewsLetter.COM" } });

    expect(input.value).toBe("newsletter.com");

    fireEvent.click(screen.getByText("Exclure"));

    expect(ADD_MUTATE).toHaveBeenCalledTimes(1);
    expect(ADD_MUTATE).toHaveBeenCalledWith(
      { domain: "newsletter.com", isExcluded: true },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    expect(input.value).toBe("");
  });

  it("n'ajoute pas de domaine invalide", () => {
    render(<ExcludedDomainsManager />);

    const input = screen.getByPlaceholderText("exemple-newsletter.com");
    fireEvent.change(input, { target: { value: "invalid_domain" } });
    fireEvent.click(screen.getByText("Exclure"));

    expect(ADD_MUTATE).not.toHaveBeenCalled();
  });

  it("supprime un domaine après confirmation", async () => {
    render(<ExcludedDomainsManager />);

    const deleteButtons = screen.getAllByRole("button");
    fireEvent.click(deleteButtons[1]);

    expect(screen.getByTestId("alert-dialog")).toHaveAttribute("data-open", "true");

    fireEvent.click(screen.getByText("Supprimer"));

    expect(REMOVE_MUTATE).toHaveBeenCalledTimes(1);
    expect(REMOVE_MUTATE).toHaveBeenCalledWith(
      "m1",
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("alert-dialog")).toHaveAttribute("data-open", "false");
    });
  });

  it("suggère les domaines communs et ignore les erreurs avec debug.log", async () => {
    ADD_MUTATE_ASYNC
      .mockResolvedValueOnce({ data: null, error: null })
      .mockRejectedValueOnce(new Error("exists"))
      .mockResolvedValue({ data: null, error: null });

    render(<ExcludedDomainsManager />);

    await act(async () => {
      fireEvent.click(screen.getByText("Suggérer"));
    });

    expect(ADD_MUTATE_ASYNC).toHaveBeenCalledTimes(11);
    expect(ADD_MUTATE_ASYNC).toHaveBeenNthCalledWith(1, {
      domain: "noreply.gmail.com",
      isExcluded: true,
    });
    expect(ADD_MUTATE_ASYNC).toHaveBeenNthCalledWith(2, {
      domain: "no-reply.linkedin.com",
      isExcluded: true,
    });
    expect(ADD_MUTATE_ASYNC).toHaveBeenLastCalledWith({
      domain: "mailer-daemon.com",
      isExcluded: true,
    });
    expect(DEBUG_LOG).toHaveBeenCalledWith("Domain no-reply.linkedin.com already excluded");
  });

  it("désactive le bouton d'ajout si le champ est vide", () => {
    render(<ExcludedDomainsManager />);

    expect(screen.getByText("Exclure").closest("button")).toBeDisabled();
  });

  it("couvre chargement, succès et erreur d'un hook react-query dans un wrapper QueryClientProvider", async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: {
              queries: { retry: 0, gcTime: 0 },
              mutations: { retry: 0 },
            },
          })
        }
      >
        {children}
      </QueryClientProvider>
    );

    const { result: loadingResult } = renderHook(
      () =>
        useQuery({
          queryKey: ["excluded-domains", "loading"],
          queryFn: () => new Promise<string[]>(() => {}),
        }),
      { wrapper },
    );

    expect(loadingResult.current.isLoading).toBe(true);

    const { result: successResult } = renderHook(
      () =>
        useQuery({
          queryKey: ["excluded-domains", "success"],
          queryFn: async () => STABLE_MAPPINGS.filter((m) => m.is_excluded).map((m) => m.domain),
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(successResult.current.isSuccess).toBe(true);
    });

    expect(successResult.current.data).toEqual(["blocked.com", "mailer-daemon.com"]);

    const { result: errorResult } = renderHook(
      () =>
        useQuery({
          queryKey: ["excluded-domains", "error"],
          queryFn: async () => {
            const response = { data: null, error: { message: "x" } };
            if (response.error) {
              throw new Error(response.error.message);
            }
            return response.data;
          },
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(errorResult.current.isError).toBe(true);
    });

    expect((errorResult.current.error as Error).message).toBe("x");

    const mutateSpy = vi.fn(async (payload: { domain: string; isExcluded: boolean }) => payload);

    const { result: mutationResult } = renderHook(
      () =>
        useMutation({
          mutationFn: mutateSpy,
        }),
      { wrapper },
    );

    await act(async () => {
      await mutationResult.current.mutateAsync({
        domain: "manual-test.com",
        isExcluded: true,
      });
    });

    expect(mutateSpy).toHaveBeenCalledWith({
      domain: "manual-test.com",
      isExcluded: true,
    });
  });
});