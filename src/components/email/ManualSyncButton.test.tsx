// @vitest-environment jsdom
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { ManualSyncButton } from "./ManualSyncButton";

const {
  mockFrom,
  mockInvoke,
  mockSanitizeSupabaseError,
  mockDebugError,
  toastSuccess,
  toastError,
  toastInfo,
} = vi.hoisted(() => {
  const builder = {
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
    then: vi.fn(),
    catch: vi.fn(),
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
  builder.single.mockResolvedValue({ data: null, error: null });
  builder.maybeSingle.mockResolvedValue({ data: null, error: null });
  builder.then.mockImplementation((onFulfilled: (value: unknown) => unknown) =>
    Promise.resolve(onFulfilled({ data: null, error: null }))
  );
  builder.catch.mockImplementation(() => Promise.resolve({ data: null, error: null }));

  return {
    mockFrom: vi.fn(() => builder),
    mockInvoke: vi.fn(),
    mockSanitizeSupabaseError: vi.fn(),
    mockDebugError: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    toastInfo: vi.fn(),
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
    functions: {
      invoke: mockInvoke,
    },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
    info: toastInfo,
  },
}));

vi.mock("@/lib/supabaseErrorSanitizer", () => ({
  sanitizeSupabaseError: mockSanitizeSupabaseError,
}));

vi.mock("@/lib/debug", () => ({
  debug: {
    error: mockDebugError,
  },
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
    <button onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  CardDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock("lucide-react", () => ({
  RefreshCw: ({ className }: { className?: string }) => <svg data-testid="refresh-icon" className={className} />,
  CheckCircle2: ({ className }: { className?: string }) => <svg data-testid="check-icon" className={className} />,
  AlertCircle: ({ className }: { className?: string }) => <svg data-testid="alert-icon" className={className} />,
  History: ({ className }: { className?: string }) => <svg data-testid="history-icon" className={className} />,
  Info: ({ className }: { className?: string }) => <svg data-testid="info-icon" className={className} />,
}));

describe("ManualSyncButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockClear();
    mockInvoke.mockReset();
    mockSanitizeSupabaseError.mockReset();
    mockDebugError.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
    toastInfo.mockReset();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("affiche les textes statiques et lance une sync rapide avec succès", async () => {
    mockInvoke.mockResolvedValue({
      data: {
        summary: {
          emails_fetched: 12,
          unprocessed_threads_found: 4,
          ai_analyses_performed: 3,
          new_threads_created: 2,
          existing_threads_updated: 5,
        },
      },
      error: null,
    });

    render(<ManualSyncButton />);

    expect(screen.getByText("Synchronisation Manuelle")).toBeInTheDocument();
    expect(screen.getByText("Sync rapide")).toBeInTheDocument();
    expect(screen.getByText("Sync complète")).toBeInTheDocument();
    expect(screen.getByText("Sync historique")).toBeInTheDocument();
    expect(screen.getByText(/Synchronisation historique intelligente/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /sync rapide/i }));

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith("email_sync_logs");
    });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("hourly-email-sync-and-analysis", {
        body: { mode: "manual", full_resync: false },
      });
    });

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(
        "✅ Synchronisation terminée\n📧 12 emails traités\n🧵 Threads: 2 nouveaux / 5 mis à jour\n🤖 3 analyses IA"
      );
    });

    expect(await screen.findByText(/Dernière synchronisation :/)).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("affiche l'état de chargement pour la sync complète puis le succès", async () => {
    let resolveInvoke: ((value: unknown) => void) | undefined;
    mockInvoke.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveInvoke = resolve;
        })
    );

    render(<ManualSyncButton />);

    fireEvent.click(screen.getByRole("button", { name: /sync complète/i }));

    expect(window.confirm).toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.getByText("Sync complète...")).toBeInTheDocument();
    });

    if (resolveInvoke) {
      resolveInvoke({
        data: {
          summary: {
            emails_fetched: 20,
            unprocessed_threads_found: 8,
            ai_analyses_performed: 6,
            new_threads_created: 7,
            existing_threads_updated: 9,
          },
        },
        error: null,
      });
    }

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(
        "✅ Synchronisation complète terminée\n📧 20 emails traités\n🧵 7 nouveaux threads\n🔄 9 threads mis à jour"
      );
    });

    expect(mockInvoke).toHaveBeenCalledWith("hourly-email-sync-and-analysis", {
      body: { mode: "manual", full_resync: true },
    });
  });

  it("n'appelle pas la fonction de sync complète si la confirmation est refusée", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<ManualSyncButton />);

    fireEvent.click(screen.getByRole("button", { name: /sync complète/i }));

    expect(mockInvoke).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });

  it("empêche la synchronisation si une autre sync est déjà en cours", async () => {
    const builder = mockFrom();
    builder.maybeSingle.mockResolvedValueOnce({ data: { id: "running-1" }, error: null });

    render(<ManualSyncButton />);

    fireEvent.click(screen.getByRole("button", { name: /sync rapide/i }));

    await waitFor(() => {
      expect(toastInfo).toHaveBeenCalledWith(
        "Une synchronisation est déjà en cours, réessayez dans quelques minutes"
      );
    });

    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("lance une sync historique avec message de progression quand il reste des emails", async () => {
    mockInvoke.mockResolvedValue({
      data: {
        summary: {
          emails_fetched: 50,
          unprocessed_threads_found: 11,
          ai_analyses_performed: 0,
          new_threads_created: 10,
          remaining_estimate: 200,
        },
      },
      error: null,
    });

    render(<ManualSyncButton />);

    fireEvent.click(screen.getByRole("button", { name: /sync historique/i }));

    expect(window.confirm).toHaveBeenCalled();

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("hourly-email-sync-and-analysis", {
        body: {
          mode: "manual",
          historical_backfill: true,
        },
      });
    });

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(
        "✅ Synchronisation historique en cours\n📧 50 emails récupérés\n🧵 10 nouveaux threads\n⏳ Environ 200 emails restants\n💡 Relancez pour continuer"
      );
    });

    expect(await screen.findByText(/Dernière synchronisation :/)).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.getByText("11")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("gère l'erreur de sync rapide via sanitizeSupabaseError", async () => {
    const syncError = { message: "x" };
    mockInvoke.mockResolvedValue({
      data: null,
      error: syncError,
    });
    mockSanitizeSupabaseError.mockReturnValue("x");

    render(<ManualSyncButton />);

    fireEvent.click(screen.getByRole("button", { name: /sync rapide/i }));

    await waitFor(() => {
      expect(mockDebugError).toHaveBeenCalledWith("Sync error:", syncError);
    });

    expect(mockSanitizeSupabaseError).toHaveBeenCalledWith(syncError);

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Erreur lors de la synchronisation : x");
    });
  });

  it("gère l'erreur de sync historique via sanitizeSupabaseError", async () => {
    const backfillError = { message: "x" };
    mockInvoke.mockResolvedValue({
      data: null,
      error: backfillError,
    });
    mockSanitizeSupabaseError.mockReturnValue("x");

    render(<ManualSyncButton />);

    fireEvent.click(screen.getByRole("button", { name: /sync historique/i }));

    await waitFor(() => {
      expect(mockDebugError).toHaveBeenCalledWith("Historical backfill error:", backfillError);
    });

    expect(mockSanitizeSupabaseError).toHaveBeenCalledWith(backfillError);

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Erreur lors de la synchronisation historique : x");
    });
  });
});