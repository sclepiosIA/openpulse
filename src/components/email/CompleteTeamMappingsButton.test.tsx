/* @vitest-environment jsdom */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CompleteTeamMappingsButton } from "./CompleteTeamMappingsButton";

const {
  invokeMock,
  toastInfo,
  toastSuccess,
  toastWarning,
  toastError,
  debugError,
  sanitizeSupabaseErrorMock,
} = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  toastInfo: vi.fn(),
  toastSuccess: vi.fn(),
  toastWarning: vi.fn(),
  toastError: vi.fn(),
  debugError: vi.fn(),
  sanitizeSupabaseErrorMock: vi.fn(),
}));

vi.mock("@/lib/supabaseBrowser", () => ({
  supabase: {
    functions: {
      invoke: invokeMock,
    },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    info: toastInfo,
    success: toastSuccess,
    warning: toastWarning,
    error: toastError,
  },
}));

vi.mock("@/lib/debug", () => ({
  debug: {
    error: debugError,
  },
}));

vi.mock("@/lib/supabaseErrorSanitizer", () => ({
  sanitizeSupabaseError: sanitizeSupabaseErrorMock,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    variant,
    className,
  }: {
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    disabled?: boolean;
    variant?: string;
    className?: string;
  }) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant} className={className}>
      {children}
    </button>
  ),
}));

vi.mock("lucide-react", () => ({
  Users: ({ className }: { className?: string }) => <svg data-testid="users-icon" className={className} />,
  Loader2: ({ className }: { className?: string }) => <svg data-testid="loader-icon" className={className} />,
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

describe("CompleteTeamMappingsButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sanitizeSupabaseErrorMock.mockReturnValue("erreur test");
  });

  it("affiche le libellé initial et déclenche les deux appels avec toasts de succès", async () => {
    invokeMock
      .mockResolvedValueOnce({
        data: { success: true, success_count: 7, total: 10 },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { matched: 12, suggested: 3 },
        error: null,
      });

    render(<CompleteTeamMappingsButton />, { wrapper: createWrapper() });

    const button = screen.getByRole("button", { name: /compléter mappings équipe/i });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute("data-variant", "outline");
    expect(screen.getByTestId("users-icon")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(button);

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledTimes(2);
    });

    expect(invokeMock).toHaveBeenNthCalledWith(1, "complete-team-email-mappings", {
      body: {},
    });
    expect(invokeMock).toHaveBeenNthCalledWith(2, "auto-match-emails", {
      body: { limit: 100, force_reprocess: false },
    });

    expect(toastInfo).toHaveBeenNthCalledWith(1, "Mise à jour des mappings d'équipe en cours...");
    expect(toastSuccess).toHaveBeenNthCalledWith(
      1,
      "Mappings d'équipe complétés : 7/10 emails configurés"
    );
    expect(toastInfo).toHaveBeenNthCalledWith(2, "Reclassification des emails en cours...");
    expect(toastSuccess).toHaveBeenNthCalledWith(
      2,
      "Reclassification terminée : 12 emails associés, 3 suggestions"
    );
    expect(toastWarning).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /compléter mappings équipe/i })).not.toBeDisabled();
    });
  });

  it("affiche l'état de chargement pendant l'opération", async () => {
    let resolveFirst:
      | ((value: { data: { success: boolean; success_count: number; total: number }; error: null }) => void)
      | undefined;

    const firstPromise = new Promise<{ data: { success: boolean; success_count: number; total: number }; error: null }>(
      (resolve) => {
        resolveFirst = resolve;
      }
    );

    invokeMock
      .mockReturnValueOnce(firstPromise)
      .mockResolvedValueOnce({
        data: { matched: 2, suggested: 1 },
        error: null,
      });

    render(<CompleteTeamMappingsButton />, { wrapper: createWrapper() });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /compléter mappings équipe/i }));

    expect(screen.getByRole("button", { name: /mise à jour\.\.\./i })).toBeDisabled();
    expect(screen.getByTestId("loader-icon")).toBeInTheDocument();
    expect(toastInfo).toHaveBeenCalledWith("Mise à jour des mappings d'équipe en cours...");

    if (resolveFirst) {
      resolveFirst({
        data: { success: true, success_count: 4, total: 4 },
        error: null,
      });
    }

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /compléter mappings équipe/i })).not.toBeDisabled();
    });
  });

  it("affiche une erreur métier quand la complétion retourne success=false", async () => {
    invokeMock.mockResolvedValueOnce({
      data: { success: false, error_count: 2, total: 5 },
      error: null,
    });

    render(<CompleteTeamMappingsButton />, { wrapper: createWrapper() });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /compléter mappings équipe/i }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledTimes(1);
    });

    expect(toastError).toHaveBeenCalledWith("Erreurs lors de la mise à jour : 2/5 ont échoué");
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastWarning).not.toHaveBeenCalled();
  });

  it("affiche un warning si la reclassification échoue après création des mappings", async () => {
    invokeMock
      .mockResolvedValueOnce({
        data: { success: true, success_count: 6, total: 8 },
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: { message: "reclass fail" },
      });

    render(<CompleteTeamMappingsButton />, { wrapper: createWrapper() });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /compléter mappings équipe/i }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledTimes(2);
    });

    expect(toastSuccess).toHaveBeenCalledWith("Mappings d'équipe complétés : 6/8 emails configurés");
    expect(toastWarning).toHaveBeenCalledWith("Mappings créés mais erreur lors de la reclassification");
    expect(toastError).not.toHaveBeenCalled();
  });

  it("gère une erreur levée par supabase et affiche le message sanitizé", async () => {
    invokeMock.mockResolvedValueOnce({
      data: null,
      error: { message: "x" },
    });
    sanitizeSupabaseErrorMock.mockReturnValue("message propre");

    render(<CompleteTeamMappingsButton />, { wrapper: createWrapper() });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /compléter mappings équipe/i }));

    await waitFor(() => {
      expect(debugError).toHaveBeenCalledTimes(1);
    });

    expect(debugError).toHaveBeenCalledWith("Error completing team mappings:", { message: "x" });
    expect(sanitizeSupabaseErrorMock).toHaveBeenCalledWith({ message: "x" });
    expect(toastError).toHaveBeenCalledWith("Erreur : message propre");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /compléter mappings équipe/i })).not.toBeDisabled();
    });
  });
});