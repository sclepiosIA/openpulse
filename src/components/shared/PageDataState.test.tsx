/* @vitest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PageDataState } from "./PageDataState";

const { sanitizeSupabaseErrorMock } = vi.hoisted(() => ({
  sanitizeSupabaseErrorMock: vi.fn(),
}));

vi.mock("@/lib/supabaseErrorSanitizer", () => ({
  sanitizeSupabaseError: sanitizeSupabaseErrorMock,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    className,
    variant,
    size,
  }: {
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    className?: string;
    variant?: string;
    size?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={className}
      data-variant={variant}
      data-size={size}
    >
      {children}
    </button>
  ),
}));

vi.mock("lucide-react", () => ({
  Loader2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-loader" {...props} />,
  AlertCircle: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-alert" {...props} />,
  RefreshCw: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-refresh" {...props} />,
  Inbox: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-inbox" {...props} />,
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

describe("PageDataState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sanitizeSupabaseErrorMock.mockReturnValue("Erreur nettoyée");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("crée un wrapper QueryClientProvider compatible via renderHook", () => {
    const wrapper = createWrapper();

    const { result } = renderHook(() => 42, { wrapper });

    expect(result.current).toBe(42);
  });

  it("affiche l'état de chargement avec le libellé fourni", () => {
    const Wrapper = createWrapper();

    render(
      <PageDataState isLoading loadingLabel="Chargement des éléments...">
        <div>Contenu succès</div>
      </PageDataState>,
      { wrapper: Wrapper },
    );

    expect(screen.getByText("Chargement des éléments...")).toBeInTheDocument();
    expect(screen.getByTestId("icon-loader")).toBeInTheDocument();
    expect(screen.queryByText("Contenu succès")).not.toBeInTheDocument();
    expect(screen.queryByTestId("icon-alert")).not.toBeInTheDocument();
  });

  it("affiche les enfants en cas de succès", () => {
    const Wrapper = createWrapper();

    render(
      <PageDataState>
        <div>Données chargées</div>
      </PageDataState>,
      { wrapper: Wrapper },
    );

    expect(screen.getByText("Données chargées")).toBeInTheDocument();
    expect(screen.queryByText("Chargement...")).not.toBeInTheDocument();
    expect(screen.queryByText("Aucune donnée")).not.toBeInTheDocument();
    expect(screen.queryByText("Impossible de charger les données")).not.toBeInTheDocument();
  });

  it("affiche l'état vide avec titre et description personnalisés", () => {
    const Wrapper = createWrapper();

    render(
      <PageDataState
        isEmpty
        emptyTitle="Aucun document"
        emptyDescription="Créez votre premier document pour commencer."
      >
        <div>Contenu succès</div>
      </PageDataState>,
      { wrapper: Wrapper },
    );

    expect(screen.getByTestId("icon-inbox")).toBeInTheDocument();
    expect(screen.getByText("Aucun document")).toBeInTheDocument();
    expect(screen.getByText("Créez votre premier document pour commencer.")).toBeInTheDocument();
    expect(screen.queryByText("Contenu succès")).not.toBeInTheDocument();
  });

  it("affiche l'état d'erreur et utilise sanitizeSupabaseError", () => {
    const Wrapper = createWrapper();
    const error = { message: "x" };

    render(
      <PageDataState isError error={error}>
        <div>Contenu succès</div>
      </PageDataState>,
      { wrapper: Wrapper },
    );

    expect(screen.getByTestId("icon-alert")).toBeInTheDocument();
    expect(screen.getByText("Impossible de charger les données")).toBeInTheDocument();
    expect(screen.getByText("Erreur nettoyée")).toBeInTheDocument();
    expect(sanitizeSupabaseErrorMock).toHaveBeenCalledTimes(1);
    expect(sanitizeSupabaseErrorMock).toHaveBeenCalledWith(error);
    expect(screen.queryByText("Contenu succès")).not.toBeInTheDocument();
  });

  it("affiche le bouton de retry et appelle onRetry au clic", () => {
    const Wrapper = createWrapper();
    const onRetry = vi.fn();

    render(
      <PageDataState isError error={{ message: "x" }} onRetry={onRetry}>
        <div>Contenu succès</div>
      </PageDataState>,
      { wrapper: Wrapper },
    );

    const button = screen.getByRole("button", { name: /réessayer/i });
    expect(button).toBeInTheDocument();
    expect(screen.getByTestId("icon-refresh")).toBeInTheDocument();

    fireEvent.click(button);

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("bascule vers l'état bloqué après timeout et affiche le message dédié", async () => {
    vi.useFakeTimers();
    const Wrapper = createWrapper();

    render(
      <PageDataState isLoading timeoutMs={50}>
        <div>Contenu succès</div>
      </PageDataState>,
      { wrapper: Wrapper },
    );

    expect(screen.getByText("Chargement...")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(60);
    });

    expect(screen.getByText("Le chargement prend trop de temps")).toBeInTheDocument();
    expect(
      screen.getByText("Vérifiez votre connexion ou vos permissions, puis réessayez."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Chargement...")).not.toBeInTheDocument();
    expect(sanitizeSupabaseErrorMock).not.toHaveBeenCalled();
  });

  it("n'active pas l'état bloqué si timeoutMs vaut 0", async () => {
    vi.useFakeTimers();
    const Wrapper = createWrapper();

    render(
      <PageDataState isLoading timeoutMs={0} loadingLabel="Veuillez patienter">
        <div>Contenu succès</div>
      </PageDataState>,
      { wrapper: Wrapper },
    );

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText("Veuillez patienter")).toBeInTheDocument();
    expect(screen.queryByText("Le chargement prend trop de temps")).not.toBeInTheDocument();
  });

  it("réinitialise l'état bloqué quand le chargement se termine", async () => {
    vi.useFakeTimers();
    const Wrapper = createWrapper();

    const { rerender } = render(
      <PageDataState isLoading timeoutMs={20}>
        <div>Contenu succès</div>
      </PageDataState>,
      { wrapper: Wrapper },
    );

    await act(async () => {
      vi.advanceTimersByTime(25);
    });

    expect(screen.getByText("Le chargement prend trop de temps")).toBeInTheDocument();

    rerender(
      <PageDataState isLoading={false} timeoutMs={20}>
        <div>Contenu succès</div>
      </PageDataState>,
    );

    expect(screen.getByText("Contenu succès")).toBeInTheDocument();
    expect(screen.queryByText("Le chargement prend trop de temps")).not.toBeInTheDocument();
  });

  it("priorise le message d'erreur explicite sur le message de chargement bloqué", async () => {
    vi.useFakeTimers();
    const Wrapper = createWrapper();
    const error = { message: "x" };
    sanitizeSupabaseErrorMock.mockReturnValue("Erreur métier lisible");

    render(
      <PageDataState isLoading isError error={error} timeoutMs={10}>
        <div>Contenu succès</div>
      </PageDataState>,
      { wrapper: Wrapper },
    );

    await act(async () => {
      vi.advanceTimersByTime(20);
    });

    expect(screen.getByText("Impossible de charger les données")).toBeInTheDocument();
    expect(screen.getByText("Erreur métier lisible")).toBeInTheDocument();
    expect(screen.queryByText("Le chargement prend trop de temps")).not.toBeInTheDocument();
    expect(sanitizeSupabaseErrorMock).toHaveBeenCalledWith(error);
  });
});