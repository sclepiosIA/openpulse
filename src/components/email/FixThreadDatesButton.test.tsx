/* @vitest-environment jsdom */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { FixThreadDatesButton } from "./FixThreadDatesButton";

const {
  mockInvokeEdge,
  mockToastInfo,
  mockToastSuccess,
  mockToastError,
  mockSanitizeSupabaseError,
  mockDebugLog,
  mockDebugError,
  AUTH_STATE,
} = vi.hoisted(() => ({
  mockInvokeEdge: vi.fn(),
  mockToastInfo: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockSanitizeSupabaseError: vi.fn(),
  mockDebugLog: vi.fn(),
  mockDebugError: vi.fn(),
  AUTH_STATE: {
    user: { id: "u1", email: "t@t.co" },
    session: { user: { id: "u1" } },
    isLoading: false,
  },
}));

vi.mock("@/services/edgeFunctions", () => ({
  invokeEdge: mockInvokeEdge,
}));

vi.mock("sonner", () => ({
  toast: {
    info: mockToastInfo,
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock("@/lib/supabaseErrorSanitizer", () => ({
  sanitizeSupabaseError: mockSanitizeSupabaseError,
}));

vi.mock("@/lib/debug", () => ({
  debug: {
    log: mockDebugLog,
    error: mockDebugError,
  },
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
    variant,
    size,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
    variant?: string;
    size?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={className}
      data-variant={variant}
      data-size={size}
    >
      {children}
    </button>
  ),
}));

vi.mock("lucide-react", () => ({
  Calendar: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="calendar-icon" {...props} />,
  Loader2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="loader-icon" {...props} />,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => AUTH_STATE,
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

describe("FixThreadDatesButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSanitizeSupabaseError.mockReturnValue("message nettoyé");
  });

  it("affiche le contenu initial et le hook wrapper React Query fonctionne", () => {
    const wrapper = createWrapper();

    const { result } = renderHook(() => React.useState("ready"), { wrapper });
    expect(result.current[0]).toBe("ready");

    render(
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
        <FixThreadDatesButton />
      </QueryClientProvider>,
    );

    expect(screen.getByText("Recalculer les dates")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Recalcule les dates des threads à partir des messages réels. Utile en cas d'incohérences d'affichage.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /recalculer/i })).toBeEnabled();
    expect(screen.getByTestId("calendar-icon")).toBeInTheDocument();
  });

  it("passe en état de chargement puis affiche le succès avec les valeurs métier réelles", async () => {
    const user = userEvent.setup();

    let resolveInvoke: ((value: { success: boolean; corrected?: number; skipped?: number }) => void) | undefined;
    mockInvokeEdge.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveInvoke = resolve;
        }),
    );

    render(
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
        <FixThreadDatesButton />
      </QueryClientProvider>,
    );

    const button = screen.getByRole("button", { name: /recalculer/i });
    await user.click(button);

    expect(mockDebugLog).toHaveBeenCalledWith("🔧 Triggering thread date fix...");
    expect(mockToastInfo).toHaveBeenCalledWith("🔧 Recalcul des dates en cours...", {
      description: "Cela peut prendre quelques instants",
      duration: 4000,
    });
    expect(mockInvokeEdge).toHaveBeenCalledWith("fix-thread-dates");

    expect(screen.getByRole("button", { name: /calcul/i })).toBeDisabled();
    expect(screen.getByTestId("loader-icon")).toBeInTheDocument();

    if (resolveInvoke) {
      resolveInvoke({ success: true, corrected: 7, skipped: 3 });
    }

    await waitFor(() => {
      expect(mockDebugLog).toHaveBeenCalledWith("✅ Thread dates fixed:", {
        success: true,
        corrected: 7,
        skipped: 3,
      });
    });

    expect(mockToastSuccess).toHaveBeenCalledWith("✅ Dates recalculées avec succès!", {
      description: "7 threads corrigés, 3 ignorés",
      duration: 5000,
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /recalculer/i })).toBeEnabled();
    });
  });

  it("gère l'erreur de réponse métier et affiche le message sanitizé", async () => {
    const user = userEvent.setup();

    mockInvokeEdge.mockResolvedValue({
      success: false,
      error: "échec métier",
    });

    render(
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
        <FixThreadDatesButton />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole("button", { name: /recalculer/i }));

    await waitFor(() => {
      expect(mockDebugError).toHaveBeenCalled();
    });

    const debugErrorCall = mockDebugError.mock.calls[0];
    expect(debugErrorCall[0]).toBe("Error fixing thread dates:");
    expect(debugErrorCall[1]).toBeInstanceOf(Error);
    expect((debugErrorCall[1] as Error).message).toBe("échec métier");

    expect(mockSanitizeSupabaseError).toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledWith("❌ Erreur lors du recalcul des dates", {
      description: "message nettoyé",
    });
    expect(mockToastSuccess).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /recalculer/i })).toBeEnabled();
    });
  });
});