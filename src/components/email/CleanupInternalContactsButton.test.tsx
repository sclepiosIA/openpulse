// @vitest-environment jsdom

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CleanupInternalContactsButton } from "./CleanupInternalContactsButton";

const {
  invokeMock,
  mockInvalidateQueries,
  successPayload,
  sanitizedMessage,
  builder,
} = vi.hoisted(() => {
  const successPayloadValue = {
    contacts_deleted: 3,
    generic_contacts_deleted: 2,
    partenaire_contacts_deleted: 4,
    generic_partenaire_contacts_deleted: 1,
    pending_contacts_deleted: 5,
    pending_generic_deleted: 6,
  };

  const chain = {
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
    upsert: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    then: vi.fn(),
    catch: vi.fn(),
  };

  Object.values(chain).forEach((fn) => {
    fn.mockImplementation(() => chain);
  });

  chain.single.mockResolvedValue({ data: null, error: null });
  chain.maybeSingle.mockResolvedValue({ data: null, error: null });
  chain.then.mockImplementation((onFulfilled: ((value: unknown) => unknown) | undefined) =>
    Promise.resolve({ data: null, error: null }).then(onFulfilled)
  );
  chain.catch.mockImplementation((onRejected: ((reason: unknown) => unknown) | undefined) =>
    Promise.resolve({ data: null, error: null }).catch(onRejected)
  );

  return {
    invokeMock: vi.fn(),
    mockInvalidateQueries: vi.fn(),
    successPayload: successPayloadValue,
    sanitizedMessage: "sanitized failure",
    builder: chain,
  };
});

vi.mock("@/lib/supabaseBrowser", () => ({
  supabase: {
    from: vi.fn(() => builder),
    functions: {
      invoke: invokeMock,
    },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/supabaseErrorSanitizer", () => ({
  sanitizeSupabaseError: vi.fn(() => sanitizedMessage),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("lucide-react", () => ({
  Trash2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="trash-icon" {...props} />,
}));

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTrigger: ({ children }: { children?: React.ReactNode; asChild?: boolean }) => <div>{children}</div>,
  AlertDialogContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  AlertDialogCancel: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) => (
    <button {...props}>{children}</button>
  ),
  AlertDialogAction: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) => (
    <button {...props}>{children}</button>
  ),
}));

function createQueryClient() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  vi.spyOn(client, "invalidateQueries").mockImplementation(mockInvalidateQueries);

  return client;
}

function renderWithClient() {
  const queryClient = createQueryClient();

  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <CleanupInternalContactsButton />
      </QueryClientProvider>
    ),
  };
}

describe("CleanupInternalContactsButton", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { toast } = await import("sonner");
    const { sanitizeSupabaseError } = await import("@/lib/supabaseErrorSanitizer");
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
    vi.mocked(sanitizeSupabaseError).mockClear();
    mockInvalidateQueries.mockReset();
  });

  it("affiche l'état initial puis exécute le nettoyage avec succès et invalide les bonnes queries", async () => {
    const user = userEvent.setup();

    let resolveInvoke: ((value: unknown) => void) | undefined;
    invokeMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveInvoke = resolve;
        })
    );

    renderWithClient();

    expect(screen.getByRole("button", { name: "Nettoyer contacts internes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmer le nettoyage" })).toBeInTheDocument();
    expect(screen.getByText("Nettoyer les contacts internes et génériques")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Confirmer le nettoyage" }));

    expect(invokeMock).toHaveBeenCalledWith("cleanup-internal-contacts");
    expect(screen.getByRole("button", { name: "Nettoyage en cours..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Nettoyage..." })).toBeDisabled();

    resolveInvoke?.({ data: successPayload, error: null });

    const { toast } = await import("sonner");

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        "Nettoyage terminé : 3 contacts (domaines), 2 contacts (noms génériques), 4 partenaires (domaines), 1 partenaires (noms génériques), 11 validations en attente supprimées"
      );
    });

    expect(mockInvalidateQueries).toHaveBeenCalledTimes(2);
    expect(mockInvalidateQueries).toHaveBeenNthCalledWith(1, { queryKey: ["contacts"] });
    expect(mockInvalidateQueries).toHaveBeenNthCalledWith(2, { queryKey: ["partenaires"] });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Nettoyer contacts internes" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "Confirmer le nettoyage" })).toBeEnabled();
    });
  });

  it("gère une erreur renvoyée par la fonction et affiche le message sanitizé", async () => {
    const user = userEvent.setup();
    const functionError = { message: "x" };

    invokeMock.mockResolvedValue({ data: null, error: functionError });

    renderWithClient();

    await user.click(screen.getByRole("button", { name: "Confirmer le nettoyage" }));

    const { toast } = await import("sonner");
    const { sanitizeSupabaseError } = await import("@/lib/supabaseErrorSanitizer");

    await waitFor(() => {
      expect(sanitizeSupabaseError).toHaveBeenCalledWith(functionError);
      expect(toast.error).toHaveBeenCalledWith("Erreur lors du nettoyage : sanitized failure");
    });

    expect(mockInvalidateQueries).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Nettoyer contacts internes" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "Confirmer le nettoyage" })).toBeEnabled();
    });
  });
});