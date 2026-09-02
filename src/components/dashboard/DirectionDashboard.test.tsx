import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DirectionDashboard } from "./DirectionDashboard";

const {
  AUTH_STATE,
  CORE_LOADING,
  CORE_SUCCESS,
  CORE_ERROR,
  PROFILES_DATA,
  USER_ROLE_STATE,
  MOBILE_STATE,
  LAYOUT_STATE,
  INVALIDATE_QUERIES,
  NAVIGATE_MOCK,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    user: { id: "u1", email: "user@test.co" },
    session: { user: { id: "u1" } },
    isLoading: false,
  },
  CORE_LOADING: {
    overview: null,
    etablissements: null,
    taches: null,
    isLoadingOverview: true,
    errors: [],
  },
  CORE_SUCCESS: {
    overview: {
      total_etablissements: 12,
      total_prospects: 4,
      total_contractuel: 3,
      total_production: 2,
      valeur_totale: 98765,
    },
    etablissements: [
      { id: "e1", statut: "Prospect" },
      { id: "e2", statut: "Contractuel" },
      { id: "e3", statut: "Production" },
    ],
    taches: [
      { id: "t1", statut: "À faire", echeance: "2099-01-03T00:00:00.000Z" },
      { id: "t2", statut: "Terminé", echeance: "2099-01-04T00:00:00.000Z" },
    ],
    isLoadingOverview: false,
    errors: [],
  },
  CORE_ERROR: {
    overview: null,
    etablissements: null,
    taches: null,
    isLoadingOverview: false,
    errors: [new Error("x")],
  },
  PROFILES_DATA: [{ id: "p1", first_name: "Ada" }],
  USER_ROLE_STATE: {
    isCopil: false,
    role: "direction",
  },
  MOBILE_STATE: {
    isMobile: false,
    isCompact: false,
    mode: "desktop",
    toggleMode: vi.fn(),
    carousel1Index: 0,
    setCarousel1Index: vi.fn(),
    carousel2Index: 0,
    setCarousel2Index: vi.fn(),
  },
  LAYOUT_STATE: {
    isEditMode: false,
    isSaving: false,
    startEdit: vi.fn(),
    cancelEdit: vi.fn(),
    saveLayout: vi.fn(),
    resetToDefault: vi.fn(),
    openWidgetSelector: vi.fn(),
    applyTemplate: vi.fn(),
    visibleWidgets: [
      { id: "agenda_widget" },
      { id: "pulse_widget" },
      { id: "email_inbox_widget" },
      { id: "notes_widget" },
      { id: "rh_ai" },
      { id: "tresorerie_ai" },
      { id: "pipeline" },
      { id: "tasks_panel" },
      { id: "follow_up_relances" },
    ],
  },
  INVALIDATE_QUERIES: vi.fn(),
  NAVIGATE_MOCK: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => NAVIGATE_MOCK,
}));

vi.mock("@/lib/lazyWithRetry", () => ({
  lazyWithRetry: (loader: () => Promise<unknown>) => {
    const Lazy = React.lazy(loader as never);
    return Lazy;
  },
}));

vi.mock("@/hooks/dashboard/useDashboardCoreData", () => ({
  useDashboardCoreData: vi.fn(() => CORE_SUCCESS),
}));

vi.mock("@/hooks/profile/useProfiles", () => ({
  useProfiles: vi.fn(() => ({ data: PROFILES_DATA })),
}));

vi.mock("@/hooks/shared/useUserRole", () => ({
  useUserRole: vi.fn(() => USER_ROLE_STATE),
}));

vi.mock("@/hooks/analytics/useMobileDashboard", () => ({
  useMobileDashboard: vi.fn(() => MOBILE_STATE),
}));

vi.mock("@/hooks/dashboard/useDashboardLayout", () => ({
  useDashboardLayout: vi.fn(() => LAYOUT_STATE),
  DASHBOARD_TEMPLATES: {
    default: { name: "Défaut", description: "Template par défaut" },
    compact: { name: "Compact", description: "Template compact" },
  },
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    title,
    "aria-label": ariaLabel,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    title?: string;
    "aria-label"?: string;
  }) => (
    <button onClick={onClick} title={title} aria-label={ariaLabel}>
      {children}
    </button>
  ),
}));

vi.mock("lucide-react", () => {
  const Icon = () => <span data-testid="icon" />;
  return {
    RefreshCw: Icon,
    Target: Icon,
    Calendar: Icon,
    MessageCircle: Icon,
    Mail: Icon,
    StickyNote: Icon,
    TrendingUp: Icon,
    Wallet: Icon,
    Users: Icon,
    BarChart3: Icon,
    Briefcase: Icon,
    Sparkles: Icon,
  };
});

vi.mock("@/components/dashboard/DashboardHero", () => ({
  DashboardHero: (props: { toolbarActions?: React.ReactNode }) => (
    <div data-testid="dashboard-hero">
      <div>DashboardHero</div>
      <div>{props.toolbarActions}</div>
    </div>
  ),
}));

vi.mock("@/components/dashboard/PipelinePremium", () => ({
  PipelinePremium: () => <div>PipelinePremium</div>,
}));

vi.mock("@/components/dashboard/EmailIntelligenceHub", () => ({
  default: () => <div>EmailIntelligenceHub</div>,
}));

vi.mock("@/components/dashboard/TasksActionPanel", () => ({
  TasksActionPanel: ({
    urgentTasks,
    allTasks,
    globalProgress,
  }: {
    urgentTasks: Array<{ id: string }>;
    allTasks: Array<{ id: string }>;
    globalProgress: number;
  }) => (
    <div data-testid="tasks-panel">
      urgent:{urgentTasks.length}|all:{allTasks.length}|progress:{globalProgress}
    </div>
  ),
}));

vi.mock("@/components/debug/DashboardErrorBoundary", () => ({
  DashboardErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/email/EmailUnreadBadge", () => ({
  EmailUnreadBadge: () => <div>EmailUnreadBadge</div>,
}));

vi.mock("@/components/layout/NotificationBadge", () => ({
  NotificationBadge: () => <div>NotificationBadge</div>,
}));

vi.mock("@/components/etablissement/BlockedEtablissementsSection", () => ({
  BlockedEtablissementsSection: () => <div>BlockedEtablissementsSection</div>,
}));

vi.mock("@/lib/valueCalculations", () => ({
  calculateEtablissementValue: vi.fn(() => 1000),
}));

vi.mock("@/components/direction/DirectionTresorerieWidget", () => ({
  DirectionTresorerieWidget: () => <div>DirectionTresorerieWidget</div>,
}));

vi.mock("@/components/direction/DirectionRHWidget", () => ({
  DirectionRHWidget: () => <div>DirectionRHWidget</div>,
}));

vi.mock("@/components/dashboard/DashboardWidgetGrid", () => ({
  DashboardWidgetGrid: () => <div>DashboardWidgetGrid</div>,
}));

vi.mock("@/components/dashboard/DashboardCustomizeButton", () => ({
  DashboardCustomizeButton: (props: {
    isEditMode: boolean;
    isSaving: boolean;
    templates: Array<{ id: string; name: string }>;
  }) => (
    <div data-testid="customize-button">
      edit:{String(props.isEditMode)} save:{String(props.isSaving)} templates:{props.templates.map(t => t.name).join(",")}
    </div>
  ),
}));

vi.mock("@/components/dashboard/AgendaWidget", () => ({
  AgendaWidget: () => <div>AgendaWidget</div>,
}));

vi.mock("@/components/dashboard/PulseWidget", () => ({
  PulseWidget: () => <div>PulseWidget</div>,
}));

vi.mock("@/components/dashboard/EmailInboxWidget", () => ({
  EmailInboxWidget: () => <div>EmailInboxWidget</div>,
}));

vi.mock("@/components/dashboard/NotesWidget", () => ({
  NotesWidget: () => <div>NotesWidget</div>,
}));

vi.mock("@/components/jarvis/JarvisDashboardWidget", () => ({
  JarvisDashboardWidget: () => <div>JarvisDashboardWidget</div>,
}));

vi.mock("@/components/dashboard/FollowUpWidget", () => ({
  FollowUpWidget: () => <div>FollowUpWidget</div>,
}));

vi.mock("@/components/dashboard/MobileDualCarousel", () => ({
  MobileDualCarousel: () => <div>MobileDualCarousel</div>,
}));

vi.mock("@/lib/utils", () => ({
  cn: (...args: Array<string | false | null | undefined>) => args.filter(Boolean).join(" "),
}));

vi.mock("@/components/shared/DashboardSkeleton", () => ({
  DashboardSkeleton: ({ variant }: { variant: string }) => <div>DashboardSkeleton:{variant}</div>,
}));

vi.mock("@/components/shared/FullDashboardSkeleton", () => ({
  FullDashboardSkeleton: () => <div data-testid="full-skeleton">FullDashboardSkeleton</div>,
}));

vi.mock("@/components/dashboard/widgets/RecentActivityWidget", () => ({
  RecentActivityWidget: () => <div>RecentActivityWidget</div>,
}));

vi.mock("@/components/pipeline/ProspectStatsDashboard", () => ({
  ProspectStatsDashboard: () => <div>ProspectStatsDashboard</div>,
}));

vi.mock("@/components/dashboard/ActivityFeed", () => ({
  ActivityFeed: () => <div>ActivityFeed</div>,
}));

vi.mock("@/components/dashboard/MRRDashboard", () => ({
  default: () => <div>MRRDashboard</div>,
}));

function TestWrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  vi.spyOn(client, "invalidateQueries").mockImplementation(INVALIDATE_QUERIES);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("DirectionDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche le skeleton pendant le chargement initial", async () => {
    const { useDashboardCoreData } = await import("@/hooks/dashboard/useDashboardCoreData");
    vi.mocked(useDashboardCoreData).mockReturnValue(CORE_LOADING);

    render(
      <TestWrapper>
        <DirectionDashboard />
      </TestWrapper>
    );

    expect(screen.getByTestId("full-skeleton")).toBeInTheDocument();
  });

  it("affiche l'état d'erreur fatal et permet de réessayer", async () => {
    const { useDashboardCoreData } = await import("@/hooks/dashboard/useDashboardCoreData");
    const { useUserRole } = await import("@/hooks/shared/useUserRole");
    vi.mocked(useDashboardCoreData).mockReturnValue(CORE_ERROR);
    vi.mocked(useUserRole).mockReturnValue({ isCopil: true, role: "copil" });

    render(
      <TestWrapper>
        <DirectionDashboard />
      </TestWrapper>
    );

    expect(screen.getByText("Impossible de charger le tableau de bord")).toBeInTheDocument();
    expect(screen.getByText(/Votre rôle « copil »/)).toBeInTheDocument();
    expect(screen.getByText("x")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(INVALIDATE_QUERIES).toHaveBeenCalled();
  });

  it("affiche la vue chargée avec les actions de toolbar et déclenche navigation/refresh", async () => {
    const { useDashboardCoreData } = await import("@/hooks/dashboard/useDashboardCoreData");
    const { useUserRole } = await import("@/hooks/shared/useUserRole");
    vi.mocked(useDashboardCoreData).mockReturnValue(CORE_SUCCESS);
    vi.mocked(useUserRole).mockReturnValue(USER_ROLE_STATE);

    render(
      <TestWrapper>
        <DirectionDashboard />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId("customize-button")).toBeInTheDocument();
    });

    expect(screen.getByText("EmailUnreadBadge")).toBeInTheDocument();
    expect(screen.getByText("NotificationBadge")).toBeInTheDocument();
    expect(screen.getByTestId("customize-button")).toHaveTextContent("templates:Défaut,Compact");

    fireEvent.click(screen.getByTitle("Rapports personnalisés"));
    expect(NAVIGATE_MOCK).toHaveBeenCalledWith("/rapports-custom");

    fireEvent.click(screen.getByRole("button", { name: "Actualiser" }));
    expect(INVALIDATE_QUERIES).toHaveBeenCalledWith({ queryKey: ["dashboard"] });
  });
});