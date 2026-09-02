// @vitest-environment jsdom
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { RoadmapAIRefreshButton } from "./RoadmapAIRefreshButton";

const {
  AUTH_STATE,
  LAST_SUMMARY,
  invokeEdgeMock,
  toastMock,
  invalidateQueriesMock,
  formatDistanceToNowMock,
} = vi.hoisted(() => ({
  AUTH_STATE: { isAdmin: true, isDirection: false },
  LAST_SUMMARY: { generated_at: "2024-01-01T10:00:00.000Z" },
  invokeEdgeMock: vi.fn(),
  toastMock: vi.fn(),
  invalidateQueriesMock: vi.fn(),
  formatDistanceToNowMock: vi.fn(),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
    "aria-label": ariaLabel,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
    "aria-label"?: string;
  }) => (
    <button onClick={onClick} disabled={disabled} className={className} aria-label={ariaLabel}>
      {children}
    </button>
  ),
}));

vi.mock("lucide-react", () => ({
  Sparkles: ({ className }: { className?: string }) => <svg data-testid="sparkles-icon" className={className} />,
  Loader2: ({ className }: { className?: string }) => <svg data-testid="loader-icon" className={className} />,
}));

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode; delayDuration?: number }) => <div>{children}</div>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode; side?: string; className?: string }) => (
    <div>{children}</div>
  ),
}));

vi.mock("@/services/edgeFunctions", () => ({
  invokeEdge: invokeEdgeMock,
}));

vi.mock("@/hooks/rd/useRoadmapAISummary", () => ({
  useLatestRoadmapSummary: () => ({ data: LAST_SUMMARY }),
}));

vi.mock("@/hooks/shared/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/hooks/shared/useUserRole", () => ({
  useUserRole: () => AUTH_STATE,
}));

vi.mock("date-fns", () => ({
  formatDistanceToNow: formatDistanceToNowMock,
}));

vi.mock("date-fns/locale", () => ({
  fr: { code: "fr" },
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return {
    ...actual,
    useQueryClient: vi.fn(),
  };
});

function createClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function renderWithClient(ui: React.ReactElement) {
  const client = createClient();
  vi.mocked(useQueryClient).mockReturnValue({
    invalidateQueries: invalidateQueriesMock,
  } as unknown as ReturnType<typeof useQueryClient>);

  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("RoadmapAIRefreshButton", () => {
  beforeEach(() => {
    AUTH_STATE.isAdmin = true;
    AUTH_STATE.isDirection = false;
    Object.assign(LAST_SUMMARY, { generated_at: "2024-01-01T10:00:00.000Z" });
    invokeEdgeMock.mockReset();
    toastMock.mockReset();
    invalidateQueriesMock.mockReset();
    formatDistanceToNowMock.mockReset();
    formatDistanceToNowMock.mockReturnValue("il y a 2 jours");
  });

  it("n'affiche rien si l'utilisateur n'est ni admin ni direction", () => {
    AUTH_STATE.isAdmin = false;
    AUTH_STATE.isDirection = false;

    const { container } = renderWithClient(<RoadmapAIRefreshButton />);

    expect(container).toBeEmptyDOMElement();
  });

  it("affiche le bouton avec la dernière date de génération formatée", () => {
    renderWithClient(<RoadmapAIRefreshButton />);

    const button = screen.getByRole("button", {
      name: "Régénérer résumé IA roadmap. Dernière MAJ il y a 2 jours",
    });

    expect(button).toBeInTheDocument();
    expect(screen.getByText("Résumé IA")).toBeInTheDocument();
    expect(screen.getByText("Régénérer le résumé IA roadmap")).toBeInTheDocument();
    expect(screen.getByText("Dernière MAJ il y a 2 jours")).toBeInTheDocument();
    expect(formatDistanceToNowMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("sparkles-icon")).toBeInTheDocument();
  });

  it("affiche le libellé d'absence de résumé quand aucune génération n'existe", () => {
    Object.assign(LAST_SUMMARY, { generated_at: undefined });

    renderWithClient(<RoadmapAIRefreshButton />);

    expect(
      screen.getByRole("button", {
        name: "Régénérer résumé IA roadmap. Aucun résumé généré pour l'instant",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Aucun résumé généré pour l'instant")).toBeInTheDocument();
    expect(formatDistanceToNowMock).not.toHaveBeenCalled();
  });

  it("déclenche la régénération, affiche le loader, toast de succès et invalide la query", async () => {
    const user = userEvent.setup();
    let resolveInvoke: ((value: { results: Array<{ success: boolean }> }) => void) | undefined;
    invokeEdgeMock.mockImplementation(
      () =>
        new Promise<{ results: Array<{ success: boolean }> }>((resolve) => {
          resolveInvoke = resolve;
        }),
    );

    renderWithClient(<RoadmapAIRefreshButton />);

    const button = screen.getByRole("button", {
      name: "Régénérer résumé IA roadmap. Dernière MAJ il y a 2 jours",
    });

    await user.click(button);

    expect(invokeEdgeMock).toHaveBeenCalledWith("generate-roadmap-summary");
    expect(button).toBeDisabled();
    expect(screen.getByTestId("loader-icon")).toBeInTheDocument();

    resolveInvoke?.({
      results: [{ success: true }, { success: true }, { success: false }],
    });

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith({
        title: "Résumé IA roadmap régénéré",
        description: "2 DPI mis à jour, 1 en échec.",
      });
    });

    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["roadmap_ai_summaries"],
    });

    await waitFor(() => {
      expect(button).not.toBeDisabled();
    });

    expect(screen.getByTestId("sparkles-icon")).toBeInTheDocument();
  });

  it("affiche un toast de succès sans échec quand tous les résultats réussissent", async () => {
    const user = userEvent.setup();
    invokeEdgeMock.mockResolvedValue({
      results: [{ success: true }, { success: true }],
    });

    renderWithClient(<RoadmapAIRefreshButton />);

    await user.click(
      screen.getByRole("button", {
        name: "Régénérer résumé IA roadmap. Dernière MAJ il y a 2 jours",
      }),
    );

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith({
        title: "Résumé IA roadmap régénéré",
        description: "2 DPI mis à jour.",
      });
    });

    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["roadmap_ai_summaries"],
    });
  });

  it("gère les erreurs et affiche un toast destructif avec le message", async () => {
    const user = userEvent.setup();
    invokeEdgeMock.mockRejectedValue(new Error("échec edge"));

    renderWithClient(<RoadmapAIRefreshButton />);

    const button = screen.getByRole("button", {
      name: "Régénérer résumé IA roadmap. Dernière MAJ il y a 2 jours",
    });

    await user.click(button);

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith({
        title: "Échec de la régénération",
        description: "échec edge",
        variant: "destructive",
      });
    });

    expect(invalidateQueriesMock).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(button).not.toBeDisabled();
    });
  });
});