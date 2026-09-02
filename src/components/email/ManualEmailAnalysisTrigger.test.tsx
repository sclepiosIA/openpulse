// @vitest-environment jsdom
import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ManualEmailAnalysisTrigger } from "./ManualEmailAnalysisTrigger";

const {
  THREADS_SUCCESS,
  THREADS_EMPTY,
  THREADS_ERROR,
  INVOKE_SUCCESS_RESULTS,
  INVOKE_PARTIAL_ERROR_RESULTS,
  mockFrom,
  mockInvoke,
  toastSuccess,
  toastError,
  toastInfo,
  debugError,
  sanitizeSupabaseError,
} = vi.hoisted(() => ({
  THREADS_SUCCESS: [
    { id: "thread-1", subject: "Sujet 1", etablissement_id: "e1", partenaire_id: null, groupe_id: null },
    { id: "thread-2", subject: "Sujet 2", etablissement_id: "e1", partenaire_id: null, groupe_id: null },
    { id: "thread-3", subject: "Sujet 3", etablissement_id: "e2", partenaire_id: null, groupe_id: null },
  ],
  THREADS_EMPTY: [],
  THREADS_ERROR: { message: "threads failed" },
  INVOKE_SUCCESS_RESULTS: [
    { data: { contacts_created: 2 }, error: null },
    { data: { contacts_created: 0 }, error: null },
    { data: { contacts_created: 1 }, error: null },
  ],
  INVOKE_PARTIAL_ERROR_RESULTS: [
    { data: { contacts_created: 1 }, error: null },
    { data: null, error: { message: "invoke failed" } },
    { data: { contacts_created: 2 }, error: null },
  ],
  mockFrom: vi.fn(),
  mockInvoke: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
  debugError: vi.fn(),
  sanitizeSupabaseError: vi.fn(),
}));

vi.mock("@/lib/debug", () => ({
  debug: {
    error: debugError,
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
  sanitizeSupabaseError,
}));

vi.mock("lucide-react", () => ({
  Brain: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="brain-icon" {...props} />,
  Loader2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="loader-icon" {...props} />,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
  }: {
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    disabled?: boolean;
    className?: string;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 className={className}>{children}</h2>
  ),
  CardDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock("@/components/ui/progress", () => ({
  Progress: ({ value, className }: { value: number; className?: string }) => (
    <div data-testid="progress" data-value={String(value)} className={className} />
  ),
}));

vi.mock("@/lib/supabaseBrowser", () => ({
  supabase: {
    from: mockFrom,
    functions: {
      invoke: mockInvoke,
    },
  },
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createQueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function createFromBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => Promise.resolve(result)),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    is: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (
      onFulfilled?: (value: { data: unknown; error: unknown }) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve(result).then(onFulfilled, onRejected),
    catch: (onRejected?: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
  };
  return builder;
}

describe("ManualEmailAnalysisTrigger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sanitizeSupabaseError.mockReturnValue("message nettoye");
  });

  it("affiche le contenu initial stable", () => {
    mockFrom.mockReturnValue(createFromBuilder({ data: THREADS_EMPTY, error: null }));

    renderWithProviders(<ManualEmailAnalysisTrigger />);

    expect(screen.getByText("Analyse IA manuelle")).toBeInTheDocument();
    expect(
      screen.getByText("Traiter les emails non analysés pour extraire automatiquement les contacts")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Analyser les emails non traités/i })).toBeEnabled();
    expect(screen.queryByText("Dernière analyse :")).not.toBeInTheDocument();
  });

  it("traite les emails avec succès et affiche le résumé final métier", async () => {
    mockFrom.mockReturnValue(createFromBuilder({ data: THREADS_SUCCESS, error: null }));
    mockInvoke
      .mockResolvedValueOnce(INVOKE_SUCCESS_RESULTS[0])
      .mockResolvedValueOnce(INVOKE_SUCCESS_RESULTS[1])
      .mockResolvedValueOnce(INVOKE_SUCCESS_RESULTS[2]);

    const user = userEvent.setup();
    renderWithProviders(<ManualEmailAnalysisTrigger />);

    await user.click(screen.getByRole("button", { name: /Analyser les emails non traités/i }));

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith("email_threads");
      expect(mockInvoke).toHaveBeenCalledTimes(3);
    });

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(
        "Analyse terminée : 3 contacts créés sur 3 emails traités"
      );
    });

    expect(mockInvoke).toHaveBeenNthCalledWith(1, "process-email-with-ai", {
      body: { thread_id: "thread-1" },
    });
    expect(mockInvoke).toHaveBeenNthCalledWith(2, "process-email-with-ai", {
      body: { thread_id: "thread-2" },
    });
    expect(mockInvoke).toHaveBeenNthCalledWith(3, "process-email-with-ai", {
      body: { thread_id: "thread-3" },
    });

    expect(screen.getByText("Dernière analyse :")).toBeInTheDocument();

    const processedContainer = screen.getByText(/Emails traités :/i).closest("div");
    const contactsContainer = screen.getByText(/Contacts créés :/i).closest("div");

    expect(processedContainer).not.toBeNull();
    expect(contactsContainer).not.toBeNull();

    expect(within(processedContainer as HTMLElement).getByText("3")).toBeInTheDocument();
    expect(within(contactsContainer as HTMLElement).getByText("3")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: /Analyser les emails non traités/i })).toBeEnabled();
  });

  it("affiche un message informatif quand aucun email n'est à traiter", async () => {
    mockFrom.mockReturnValue(createFromBuilder({ data: THREADS_EMPTY, error: null }));

    const user = userEvent.setup();
    renderWithProviders(<ManualEmailAnalysisTrigger />);

    await user.click(screen.getByRole("button", { name: /Analyser les emails non traités/i }));

    await waitFor(() => {
      expect(toastInfo).toHaveBeenCalledWith("Aucun email à traiter");
    });

    expect(mockInvoke).not.toHaveBeenCalled();
    expect(screen.queryByText("Dernière analyse :")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Analyser les emails non traités/i })).toBeEnabled();
  });

  it("gère une erreur globale de récupération et affiche le message sanitizé", async () => {
    mockFrom.mockReturnValue(createFromBuilder({ data: null, error: THREADS_ERROR }));

    const user = userEvent.setup();
    renderWithProviders(<ManualEmailAnalysisTrigger />);

    await user.click(screen.getByRole("button", { name: /Analyser les emails non traités/i }));

    await waitFor(() => {
      expect(debugError).toHaveBeenCalledWith("Error during manual analysis:", THREADS_ERROR);
      expect(sanitizeSupabaseError).toHaveBeenCalledWith(THREADS_ERROR);
      expect(toastError).toHaveBeenCalledWith("Erreur lors de l'analyse : message nettoye");
    });

    expect(mockInvoke).not.toHaveBeenCalled();
    expect(screen.queryByText("Dernière analyse :")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Analyser les emails non traités/i })).toBeEnabled();
  });

  it("continue si un thread échoue et comptabilise les erreurs dans le résumé", async () => {
    mockFrom.mockReturnValue(createFromBuilder({ data: THREADS_SUCCESS, error: null }));
    mockInvoke
      .mockResolvedValueOnce(INVOKE_PARTIAL_ERROR_RESULTS[0])
      .mockResolvedValueOnce(INVOKE_PARTIAL_ERROR_RESULTS[1])
      .mockResolvedValueOnce(INVOKE_PARTIAL_ERROR_RESULTS[2]);

    const user = userEvent.setup();
    renderWithProviders(<ManualEmailAnalysisTrigger />);

    await user.click(screen.getByRole("button", { name: /Analyser les emails non traités/i }));

    await waitFor(() => {
      expect(debugError).toHaveBeenCalledWith(
        "Error processing thread thread-2:",
        { message: "invoke failed" }
      );
    });

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(
        "Analyse terminée : 3 contacts créés sur 3 emails traités"
      );
    });

    expect(screen.getByText("Dernière analyse :")).toBeInTheDocument();

    const processedContainer = screen.getByText(/Emails traités :/i).closest("div");
    const contactsContainer = screen.getByText(/Contacts créés :/i).closest("div");

    expect(processedContainer).not.toBeNull();
    expect(contactsContainer).not.toBeNull();

    expect(within(processedContainer as HTMLElement).getByText("3")).toBeInTheDocument();
    expect(within(contactsContainer as HTMLElement).getByText("3")).toBeInTheDocument();
  });
});