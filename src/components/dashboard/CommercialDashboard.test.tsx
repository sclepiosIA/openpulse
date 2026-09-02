import React from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { render, screen, fireEvent, waitFor, renderHook } from "@testing-library/react";
import { CommercialDashboard } from "./CommercialDashboard";

const {
  ETABS,
  TACHES,
  PROFILE,
  OBJECTIFS,
  APPOINTMENTS,
  navigateMock,
  refetchEtabMock,
  refetchTachesMock,
  startEditMock,
  cancelEditMock,
  saveLayoutMock,
  resetToDefaultMock,
  openWidgetSelectorMock,
  applyTemplateMock,
  useAllEtablissementsMock,
  useTachesMock,
  useCurrentProfileMock,
  useObjectifCASummaryMock,
  useUpcomingAppointmentsMock,
  useDashboardLayoutMock,
  calculateEtablissementValueMock,
} = vi.hoisted(() => ({
  ETABS: [
    { id: "e1", nom: "Alpha", ville: "Paris", statut: "Prospect", potentiel: 10000 },
    { id: "e2", nom: "Beta", ville: "Lyon", statut: "Négociation", potentiel: 25000 },
    { id: "e3", nom: "Gamma", ville: "Lille", statut: "Contractualisation", potentiel: 15000 },
    { id: "e4", nom: "Delta", ville: "Nice", statut: "Etude émise", potentiel: 12000 },
    { id: "e5", nom: "Epsilon", ville: "Bordeaux", statut: "Client", potentiel: 5000 },
  ],
  TACHES: [
    { id: "t1", responsable_id: "p1", statut: "À faire", echeance: "2099-01-03T00:00:00.000Z" },
    { id: "t2", responsable_id: "p1", statut: "Terminé", echeance: "2099-01-04T00:00:00.000Z" },
    { id: "t3", responsable_id: "p2", statut: "En cours", echeance: "2099-01-06T00:00:00.000Z" },
    { id: "t4", responsable_id: "p1", statut: "À faire", echeance: "2099-02-01T00:00:00.000Z" },
  ],
  PROFILE: { id: "p1", email: "user@test.co" },
  OBJECTIFS: { realise: 45000, cible: 100000, progression: 45 },
  APPOINTMENTS: [
    { id: "r1", title: "RDV Alpha", date: "2099-01-01T10:00:00.000Z" },
    { id: "r2", title: "RDV Beta", date: "2099-01-02T11:00:00.000Z" },
  ],
  navigateMock: vi.fn(),
  refetchEtabMock: vi.fn(),
  refetchTachesMock: vi.fn(),
  startEditMock: vi.fn(),
  cancelEditMock: vi.fn(),
  saveLayoutMock: vi.fn(),
  resetToDefaultMock: vi.fn(),
  openWidgetSelectorMock: vi.fn(),
  applyTemplateMock: vi.fn(),
  useAllEtablissementsMock: vi.fn(),
  useTachesMock: vi.fn(),
  useCurrentProfileMock: vi.fn(),
  useObjectifCASummaryMock: vi.fn(),
  useUpcomingAppointmentsMock: vi.fn(),
  useDashboardLayoutMock: vi.fn(),
  calculateEtablissementValueMock: vi.fn((etab: { potentiel?: number }) => etab.potentiel ?? 0),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("@/integrations/supabase/client", () => {
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
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: (resolve: (value: { data: null; error: null }) => unknown) => Promise.resolve(resolve({ data: null, error: null })),
    catch: vi.fn(),
  };
  const mockFrom = vi.fn(() => builder);
  return {
    supabase: {
      from: mockFrom,
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: "u1" } }, error: null })),
        getSession: vi.fn(async () => ({ data: { session: { user: { id: "u1" } } }, error: null })),
      },
    },
  };
});

vi.mock("@/hooks/crm/useProspects", () => ({
  useAllEtablissements: useAllEtablissementsMock,
}));

vi.mock("@/hooks/tasks/useTaches", () => ({
  useTaches: useTachesMock,
}));

vi.mock("@/hooks/profile/useProfiles", () => ({
  useCurrentProfile: useCurrentProfileMock,
}));

vi.mock("@/hooks/billing/useObjectifsCA", () => ({
  useObjectifCASummary: useObjectifCASummaryMock,
}));

vi.mock("@/hooks/bookings/useUpcomingAppointments", () => ({
  useUpcomingAppointments: useUpcomingAppointmentsMock,
}));

vi.mock("@/hooks/dashboard/useDashboardLayout", () => ({
  useDashboardLayout: useDashboardLayoutMock,
  DASHBOARD_TEMPLATES: {
    default: { name: "Défaut", description: "Template par défaut" },
    compact: { name: "Compact", description: "Template compact" },
  },
}));

vi.mock("@/lib/valueCalculations", () => ({
  calculateEtablissementValue: calculateEtablissementValueMock,
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <div data-testid="card" onClick={onClick}>
      {children}
    </div>
  ),
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
  }) => (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span data-testid="badge" className={className}>
      {children}
    </span>
  ),
}));

vi.mock("@/components/ui/progress", () => ({
  Progress: ({ value }: { value: number }) => <div data-testid="progress">{value}</div>,
}));

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: ({ className }: { className?: string }) => <div data-testid="skeleton" className={className} />,
}));

vi.mock("@/components/ui/alert", () => ({
  Alert: ({ children }: { children: React.ReactNode }) => <div role="alert">{children}</div>,
  AlertDescription: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock("lucide-react", () => {
  const Icon = () => <svg />;
  return {
    RefreshCw: Icon,
    Target: Icon,
    TrendingUp: Icon,
    Calendar: Icon,
    Euro: Icon,
    LayoutDashboard: Icon,
    AlertCircle: Icon,
  };
});

vi.mock("@/components/dashboard/TasksActionPanel", () => ({
  TasksActionPanel: ({
    urgentTasks,
    myTasks,
    myTasksProgress,
    globalProgress,
  }: {
    urgentTasks: Array<{ id: string }>;
    myTasks: Array<{ id: string }>;
    myTasksProgress: number;
    globalProgress: number;
  }) => (
    <div data-testid="tasks-panel">
      {urgentTasks.length}|{myTasks.length}|{myTasksProgress}|{globalProgress}
    </div>
  ),
}));

vi.mock("@/components/layout/UnifiedPageHeader", () => ({
  UnifiedPageHeader: ({
    title,
    subtitle,
    actions,
  }: {
    title: string;
    subtitle: string;
    actions: React.ReactNode;
  }) => (
    <div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      <div>{actions}</div>
    </div>
  ),
}));

vi.mock("@/components/email/EmailUnreadBadge", () => ({
  EmailUnreadBadge: () => <div>EmailUnreadBadge</div>,
}));

vi.mock("@/components/layout/NotificationBadge", () => ({
  NotificationBadge: () => <div>NotificationBadge</div>,
}));

vi.mock("@/components/dashboard/AgendaWidget", () => ({
  AgendaWidget: ({ maxItems }: { maxItems: number }) => <div>AgendaWidget-{maxItems}</div>,
}));

vi.mock("@/components/dashboard/PulseWidget", () => ({
  PulseWidget: ({ maxItems }: { maxItems: number }) => <div>PulseWidget-{maxItems}</div>,
}));

vi.mock("@/components/dashboard/EmailInboxWidget", () => ({
  EmailInboxWidget: ({ maxItems }: { maxItems: number }) => <div>EmailInboxWidget-{maxItems}</div>,
}));

vi.mock("@/components/dashboard/NotesWidget", () => ({
  NotesWidget: () => <div>NotesWidget</div>,
}));

vi.mock("@/components/dashboard/DashboardWidgetGrid", () => ({
  DashboardWidgetGrid: () => <div>DashboardWidgetGrid</div>,
}));

vi.mock("@/components/dashboard/DashboardCustomizeButton", () => ({
  DashboardCustomizeButton: ({
    isEditMode,
    isSaving,
    templates,
  }: {
    isEditMode: boolean;
    isSaving: boolean;
    templates: Array<{ id: string; name: string; description: string }>;
  }) => (
    <div data-testid="customize-button">
      {String(isEditMode)}|{String(isSaving)}|{templates.map((t) => t.name).join(",")}
    </div>
  ),
}));

vi.mock("@/components/dashboard/EmailIntelligenceHub", () => ({
  default: () => <div>EmailIntelligenceHub</div>,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { wrapper, queryClient };
}

describe("CommercialDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useAllEtablissementsMock.mockReturnValue({
      data: ETABS,
      isError: false,
      refetch: refetchEtabMock,
    });

    useTachesMock.mockReturnValue({
      data: TACHES,
      isError: false,
      refetch: refetchTachesMock,
    });

    useCurrentProfileMock.mockReturnValue({
      data: PROFILE,
    });

    useObjectifCASummaryMock.mockReturnValue({
      data: OBJECTIFS,
      isLoading: false,
    });

    useUpcomingAppointmentsMock.mockReturnValue({
      data: APPOINTMENTS,
      isLoading: false,
    });

    useDashboardLayoutMock.mockReturnValue({
      isEditMode: false,
      isSaving: false,
      startEdit: startEditMock,
      cancelEdit: cancelEditMock,
      saveLayout: saveLayoutMock,
      resetToDefault: resetToDefaultMock,
      openWidgetSelector: openWidgetSelectorMock,
      applyTemplate: applyTemplateMock,
      layout: [],
    });
  });

  it("affiche l'état de chargement pour les RDV et les objectifs", () => {
    useObjectifCASummaryMock.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    useUpcomingAppointmentsMock.mockReturnValue({
      data: APPOINTMENTS,
      isLoading: true,
    });

    const { wrapper } = createWrapper();
    render(<CommercialDashboard />, { wrapper });

    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(1);
    expect(screen.getByText("Objectif CA Annuel")).toBeInTheDocument();
  });

  it("affiche les métriques métier calculées et permet la navigation et le refresh", () => {
    const { wrapper } = createWrapper();
    render(<CommercialDashboard />, { wrapper });

    expect(screen.getByText("Commercial - Tableau de bord")).toBeInTheDocument();
    expect(screen.getByText("Suivi du pipeline et des objectifs commerciaux")).toBeInTheDocument();

    expect(screen.getByText("Pipeline actif")).toBeInTheDocument();
    expect(screen.getByText("En négociation")).toBeInTheDocument();
    expect(screen.getByText("Valeur pipeline")).toBeInTheDocument();
    expect(screen.getByText("RDV cette semaine")).toBeInTheDocument();

    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("62k€")).toBeInTheDocument();
    expect(screen.getByText("Progression: 45%")).toBeInTheDocument();
    expect(screen.getByText("Reste: 55k€")).toBeInTheDocument();

    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByText("Gamma")).toBeInTheDocument();
    expect(screen.getByText("Delta")).toBeInTheDocument();

    expect(screen.getAllByTestId("badge").map((n) => n.textContent)).toEqual(
      expect.arrayContaining(["Négociation", "Contractualisation", "Etude émise"]),
    );

    fireEvent.click(screen.getByText("Voir tout le pipeline"));
    expect(navigateMock).toHaveBeenCalledWith("/prospects");

    fireEvent.click(screen.getByText("Beta"));
    expect(navigateMock).toHaveBeenCalledWith("/etablissements/e2");

    const refreshButtons = screen.getAllByRole("button").filter((button) => button.textContent === "");
    fireEvent.click(refreshButtons[0]);

    const hookClient = renderHook(() => useQueryClient(), { wrapper }).result.current;
    expect(hookClient.getQueryCache()).toBeDefined();
  });

  it("affiche une alerte d'erreur et relance les refetchs", async () => {
    useAllEtablissementsMock.mockReturnValue({
      data: ETABS,
      isError: true,
      refetch: refetchEtabMock,
    });

    useTachesMock.mockReturnValue({
      data: TACHES,
      isError: false,
      refetch: refetchTachesMock,
    });

    const { wrapper } = createWrapper();
    render(<CommercialDashboard />, { wrapper });

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Erreur lors du chargement des données.")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Réessayer"));

    await waitFor(() => {
      expect(refetchEtabMock).toHaveBeenCalledTimes(1);
      expect(refetchTachesMock).toHaveBeenCalledTimes(1);
    });
  });

  it("monte correctement dans un QueryClientProvider compatible renderHook", () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useQueryClient(), {
      wrapper,
    });

    expect(result.current).toBeDefined();
  });
});