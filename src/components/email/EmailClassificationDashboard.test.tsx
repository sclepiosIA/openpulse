/* @vitest-environment jsdom */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { EmailClassificationDashboard } from "./EmailClassificationDashboard";

const {
  STATS,
  LOW_STATS,
  navigateMock,
  useEmailClassificationStatsMock,
  mutateMock,
  useManualEmailClassificationMock,
} = vi.hoisted(() => ({
  STATS: {
    autoMatchRate: 78,
    suggestionsPending: 12,
    avgConfidence: 91,
    totalThreadsCount: 350,
    autoMatchedCount: 273,
    manuallyClassifiedCount: 40,
    unclassifiedCount: 37,
    totalClassificationRate: 89,
    totalClassifiedCount: 313,
    horsEtablissementCount: 8,
    etablissementCount: 200,
    partenaireCount: 55,
    groupeCount: 30,
    interneCount: 20,
  },
  LOW_STATS: {
    autoMatchRate: 22,
    suggestionsPending: 3,
    avgConfidence: 67,
    totalThreadsCount: 120,
    autoMatchedCount: 26,
    manuallyClassifiedCount: 20,
    unclassifiedCount: 74,
    totalClassificationRate: 38,
    totalClassifiedCount: 46,
    horsEtablissementCount: 5,
    etablissementCount: 40,
    partenaireCount: 10,
    groupeCount: 8,
    interneCount: 3,
  },
  navigateMock: vi.fn(),
  useEmailClassificationStatsMock: vi.fn(),
  mutateMock: vi.fn(),
  useManualEmailClassificationMock: vi.fn(),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/accordion", () => ({
  Accordion: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AccordionItem: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
  AccordionTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AccordionContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => <button onClick={onClick}>{children}</button>,
  DropdownMenuSeparator: () => <hr />,
}));

vi.mock("@/components/ui/CompactStats", () => ({
  CompactStats: ({
    items,
  }: {
    items: Array<{ label: string; value: string | number }>;
  }) => (
    <div data-testid="compact-stats">
      {items.map((item) => (
        <div key={item.label} data-testid={`stat-${item.label}`}>
          <span>{item.label}</span>
          <span>{String(item.value)}</span>
        </div>
      ))}
    </div>
  ),
}));

vi.mock("@/hooks/email/useEmailClassificationStats", () => ({
  useEmailClassificationStats: () => useEmailClassificationStatsMock(),
}));

vi.mock("@/hooks/email/useManualEmailClassification", () => ({
  useManualEmailClassification: () => useManualEmailClassificationMock(),
}));

vi.mock("./DomainClassificationPanel", () => ({
  DomainClassificationPanel: () => <div data-testid="domain-panel">domain-panel</div>,
}));

vi.mock("./GenericDomainEmailsList", () => ({
  GenericDomainEmailsList: () => <div data-testid="generic-emails">generic-emails</div>,
}));

vi.mock("./EmailMaintenanceActions", () => ({
  EmailMaintenanceActions: () => <div data-testid="maintenance-actions">maintenance-actions</div>,
}));

vi.mock("./EmailClassificationChart", () => ({
  EmailClassificationChart: (props: Record<string, unknown>) => (
    <div data-testid="classification-chart">
      {String(props.autoMatchedCount)}|{String(props.unclassifiedCount)}|{String(props.totalThreadsCount)}|
      {String(props.totalClassificationRate)}
    </div>
  ),
}));

vi.mock("./EmailClassificationProgress", () => ({
  EmailClassificationProgress: ({
    total,
    processed,
    matched,
    suggested,
    hors,
    interne,
    isRunning,
  }: {
    total: number;
    processed: number;
    matched: number;
    suggested: number;
    hors: number;
    interne: number;
    isRunning: boolean;
  }) => (
    <div data-testid="classification-progress">
      {`${total}-${processed}-${matched}-${suggested}-${hors}-${interne}-${String(isRunning)}`}
    </div>
  ),
}));

vi.mock("./CompleteTeamMappingsButton", () => ({
  CompleteTeamMappingsButton: () => <button>Compléter les mappings</button>,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("lucide-react", () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />;
  return {
    CheckCircle: Icon,
    AlertCircle: Icon,
    TrendingUp: Icon,
    Mail: Icon,
    Shield: Icon,
    Play: Icon,
    Building2: Icon,
    AtSign: Icon,
    Loader2: Icon,
    Lightbulb: Icon,
    Settings: Icon,
    Zap: Icon,
    ChevronDown: Icon,
  };
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

describe("EmailClassificationDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useManualEmailClassificationMock.mockReturnValue({
      mutate: mutateMock,
      isPending: false,
      isError: false,
      error: null,
    });
  });

  it("affiche le loader pendant le chargement", () => {
    useEmailClassificationStatsMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    });

    const Wrapper = createWrapper();
    const { container } = render(<EmailClassificationDashboard />, { wrapper: Wrapper });

    expect(container.querySelector(".animate-spin")).toBeTruthy();
    expect(screen.queryByText("Classification des emails")).toBeNull();
  });

  it("retourne null si les stats sont absentes après chargement", () => {
    useEmailClassificationStatsMock.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      error: { message: "x" },
    });

    const Wrapper = createWrapper();
    const { container } = render(<EmailClassificationDashboard />, { wrapper: Wrapper });

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("Classification des emails")).toBeNull();
  });

  it("affiche les stats métier, le graphique et les sections principales", () => {
    useEmailClassificationStatsMock.mockReturnValue({
      data: STATS,
      isLoading: false,
      isError: false,
      error: null,
    });

    const Wrapper = createWrapper();
    render(<EmailClassificationDashboard />, { wrapper: Wrapper });

    expect(screen.getByRole("heading", { name: "Classification des emails" })).toBeInTheDocument();
    expect(screen.getByTestId("stat-Taux auto")).toHaveTextContent("78%");
    expect(screen.getByTestId("stat-En attente")).toHaveTextContent("12");
    expect(screen.getByTestId("stat-Confiance moy.")).toHaveTextContent("91%");
    expect(screen.getByTestId("stat-Emails traités")).toHaveTextContent("350");
    expect(screen.getByTestId("stat-Classés auto")).toHaveTextContent("273");

    expect(screen.getByTestId("classification-chart")).toHaveTextContent("273|37|350|89");
    expect(screen.getByText("Domaines d'organisations")).toBeInTheDocument();
    expect(screen.getByText("Emails personnels (Gmail, Outlook, etc.)")).toBeInTheDocument();
    expect(screen.getByText("Actions avancées")).toBeInTheDocument();
    expect(screen.getByTestId("domain-panel")).toBeInTheDocument();
    expect(screen.getByTestId("generic-emails")).toBeInTheDocument();
    expect(screen.getByTestId("maintenance-actions")).toBeInTheDocument();
    expect(screen.getByText("Compléter les mappings")).toBeInTheDocument();
    expect(screen.getByText("Classifier")).toBeInTheDocument();
    expect(screen.getByText("37 non classés")).toBeInTheDocument();
  });

  it("affiche l'alerte de faible taux et navigue vers la configuration", () => {
    useEmailClassificationStatsMock.mockReturnValue({
      data: LOW_STATS,
      isLoading: false,
      isError: false,
      error: null,
    });

    const Wrapper = createWrapper();
    render(<EmailClassificationDashboard />, { wrapper: Wrapper });

    expect(screen.getByText("Taux de classification automatique faible")).toBeInTheDocument();
    expect(
      screen.getByText("Configurez les domaines d'organisations pour améliorer la classification automatique.")
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Configurer" }));
    expect(navigateMock).toHaveBeenCalledWith("/gestion-email-domains");
  });

  it("déclenche la classification rapide avec les bons paramètres", async () => {
    useEmailClassificationStatsMock.mockReturnValue({
      data: STATS,
      isLoading: false,
      isError: false,
      error: null,
    });

    mutateMock.mockImplementation(() => {});

    const Wrapper = createWrapper();
    render(<EmailClassificationDashboard />, { wrapper: Wrapper });

    fireEvent.click(screen.getByText("Rapide (100 emails)"));

    await waitFor(() => {
      expect(mutateMock).toHaveBeenCalledTimes(1);
    });

    const firstCall = mutateMock.mock.calls[0];
    expect(firstCall[0]).toMatchObject({
      batchSize: 100,
      processAll: false,
    });
    expect(typeof firstCall[0].onProgress).toBe("function");
    expect(firstCall[1]).toMatchObject({
      onSuccess: expect.any(Function),
      onError: expect.any(Function),
    });
  });

  it("affiche la progression puis masque le suivi après succès", async () => {
    useEmailClassificationStatsMock.mockReturnValue({
      data: STATS,
      isLoading: false,
      isError: false,
      error: null,
    });

    mutateMock.mockImplementation(
      (
        variables: {
          batchSize: number;
          processAll: boolean;
          onProgress: (progressData: {
            total: number;
            current: number;
            matched: number;
            suggested: number;
            elapsed?: number;
          }) => void;
        },
        options?: {
          onSuccess?: (data: {
            total: number;
            matched: number;
            suggested: number;
            hors?: number;
            interne?: number;
          }) => void;
        }
      ) => {
        variables.onProgress({
          total: 37,
          current: 10,
          matched: 7,
          suggested: 2,
          elapsed: 5,
        });

        options?.onSuccess?.({
          total: 37,
          matched: 25,
          suggested: 8,
          hors: 3,
          interne: 1,
        });
      }
    );

    const Wrapper = createWrapper();
    render(<EmailClassificationDashboard />, { wrapper: Wrapper });

    fireEvent.click(screen.getByText("Standard (200 emails)"));

    await waitFor(() => {
      expect(mutateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          batchSize: 200,
          processAll: false,
        }),
        expect.objectContaining({
          onSuccess: expect.any(Function),
          onError: expect.any(Function),
        })
      );
    });

    await waitFor(() => {
      expect(screen.queryByTestId("classification-progress")).not.toBeInTheDocument();
    });
  });

  it("affiche l'état pending et déclenche la classification complète", async () => {
    useEmailClassificationStatsMock.mockReturnValue({
      data: STATS,
      isLoading: false,
      isError: false,
      error: null,
    });

    useManualEmailClassificationMock.mockReturnValue({
      mutate: mutateMock,
      isPending: true,
      isError: false,
      error: null,
    });

    const Wrapper = createWrapper();
    const { rerender } = render(<EmailClassificationDashboard />, { wrapper: Wrapper });

    expect(screen.getByText("Classification...")).toBeInTheDocument();

    useManualEmailClassificationMock.mockReturnValue({
      mutate: mutateMock,
      isPending: false,
      isError: false,
      error: null,
    });

    rerender(<EmailClassificationDashboard />);

    fireEvent.click(screen.getByText("Complète (max 10 000)"));

    await waitFor(() => {
      expect(mutateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          batchSize: 100,
          processAll: true,
        }),
        expect.objectContaining({
          onSuccess: expect.any(Function),
          onError: expect.any(Function),
        })
      );
    });
  });
});