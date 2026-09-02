/* @vitest-environment jsdom */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useMutation, useQuery } from "@tanstack/react-query";
import { TechniqueDashboard } from "./TechniqueDashboard";

const {
  ETABS,
  TASKS,
  PROFILE,
  STATUTS_REF,
  AUTH_STATE,
  mockNavigate,
  mockInvalidateQueries,
  mockStartEdit,
  mockCancelEdit,
  mockSaveLayout,
  mockResetToDefault,
  mockOpenWidgetSelector,
  mockApplyTemplate,
  mockFrom,
} = vi.hoisted(() => {
  const today = new Date();
  const daysAgo = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - n);
    return d.toISOString();
  };
  const daysFromNow = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + n);
    return d.toISOString();
  };

  return {
    ETABS: [
      { id: "e1", nom: "Clinique Alpha", ville: "Paris", statut: "Installation", created_at: daysAgo(80) },
      { id: "e2", nom: "Centre Beta", ville: "Lyon", statut: "Déploiement", created_at: daysAgo(20) },
      { id: "e3", nom: "Maison Gamma", ville: "Marseille", statut: "Déploiement", created_at: daysAgo(10) },
      { id: "e4", nom: "Hopital Delta", ville: "Lille", statut: "Déploiement", created_at: daysAgo(5) },
      { id: "e5", nom: "EHPAD Epsilon", ville: "Nice", statut: "Déploiement", created_at: daysAgo(3) },
      { id: "e6", nom: "Clinique Zeta", ville: "Nantes", statut: "Déploiement", created_at: daysAgo(2) },
      { id: "e7", nom: "Cabinet Eta", ville: "Bordeaux", statut: "Prospect", created_at: daysAgo(1) },
    ],
    TASKS: [
      { id: "t1", statut: "À faire", echeance: daysFromNow(2), responsable_id: "p1" },
      { id: "t2", statut: "En cours", echeance: daysFromNow(7), responsable_id: "p1" },
      { id: "t3", statut: "Terminé", echeance: daysFromNow(1), responsable_id: "p1" },
      { id: "t4", statut: "À faire", echeance: daysFromNow(20), responsable_id: "p2" },
      { id: "t5", statut: "En cours", echeance: null, responsable_id: "p1" },
    ],
    PROFILE: { id: "p1", first_name: "Tech" },
    STATUTS_REF: [
      { label: "Installation", metadata: { phase: "deploiement" } },
      { label: "Déploiement", metadata: { phase: "deploiement" } },
      { label: "Prospect", metadata: { phase: "commercial" } },
    ],
    AUTH_STATE: {
      user: { id: "u1", email: "t@t.co" },
      session: { user: { id: "u1" } },
      isLoading: false,
    },
    mockNavigate: vi.fn(),
    mockInvalidateQueries: vi.fn(),
    mockStartEdit: vi.fn(),
    mockCancelEdit: vi.fn(),
    mockSaveLayout: vi.fn(),
    mockResetToDefault: vi.fn(),
    mockOpenWidgetSelector: vi.fn(),
    mockApplyTemplate: vi.fn(),
    mockFrom: vi.fn(),
  };
});

vi.mock("@/integrations/supabase/client", () => {
  const result = { data: null, error: null };
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
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (onFulfilled: (value: typeof result) => unknown) => Promise.resolve(result).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
  };
  mockFrom.mockImplementation(() => builder);
  return { supabase: { from: mockFrom } };
});

vi.mock("@/config/referenceDataDefaults", () => ({
  FALLBACK_DEPLOIEMENT_STATUTS: ["Installation", "Déploiement"],
}));

vi.mock("@/hooks/system/useReferenceData", () => ({
  useStatutsEtablissement: vi.fn(() => ({ data: STATUTS_REF })),
}));

vi.mock("@/hooks/crm/useProspects", () => ({
  useAllEtablissements: vi.fn(() => ({ data: ETABS })),
}));

vi.mock("@/hooks/tasks/useTaches", () => ({
  useTaches: vi.fn(() => ({ data: TASKS })),
}));

vi.mock("@/hooks/profile/useProfiles", () => ({
  useCurrentProfile: vi.fn(() => ({ data: PROFILE })),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(() => AUTH_STATE),
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: vi.fn(() => AUTH_STATE),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(() => AUTH_STATE),
  useSession: vi.fn(() => AUTH_STATE),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: vi.fn(() => mockNavigate),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, onClick, className }: { children: React.ReactNode; onClick?: () => void; className?: string }) => (
    <div data-testid="card" className={className} onClick={onClick}>
      {children}
    </div>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
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
    <button type="button" className={className} onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/components/ui/progress", () => ({
  Progress: ({ value }: { value: number; className?: string }) => <div data-testid="progress-value">{value}</div>,
}));

vi.mock("lucide-react", () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />;
  return {
    RefreshCw: Icon,
    Truck: Icon,
    FlaskConical: Icon,
    Headphones: Icon,
    AlertTriangle: Icon,
    Clock: Icon,
    CheckCircle2: Icon,
    LayoutDashboard: Icon,
  };
});

vi.mock("@/components/dashboard/TasksActionPanel", () => ({
  TasksActionPanel: ({
    urgentTasks,
    myTasks,
    allTasks,
    myTasksProgress,
    globalProgress,
  }: {
    urgentTasks: Array<{ id: string }>;
    myTasks: Array<{ id: string }>;
    allTasks: Array<{ id: string }>;
    myTasksProgress: number;
    globalProgress: number;
  }) => (
    <div data-testid="tasks-action-panel">
      urgent:{urgentTasks.map((t) => t.id).join(",")}|mine:{myTasks.map((t) => t.id).join(",")}|all:{allTasks.length}|myProgress:
      {myTasksProgress}|global:{globalProgress}
    </div>
  ),
}));

vi.mock("@/components/dashboard/EmailIntelligenceHub", () => ({
  default: () => <div data-testid="email-intelligence-hub">Email Hub</div>,
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
    icon?: React.ComponentType;
    sticky?: boolean;
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
  AgendaWidget: ({ maxItems }: { maxItems: number }) => <div>Agenda:{maxItems}</div>,
}));

vi.mock("@/components/dashboard/PulseWidget", () => ({
  PulseWidget: ({ maxItems }: { maxItems: number }) => <div>Pulse:{maxItems}</div>,
}));

vi.mock("@/components/dashboard/EmailInboxWidget", () => ({
  EmailInboxWidget: ({ maxItems }: { maxItems: number }) => <div>EmailInbox:{maxItems}</div>,
}));

vi.mock("@/components/dashboard/NotesWidget", () => ({
  NotesWidget: () => <div>Notes</div>,
}));

vi.mock("@/hooks/dashboard/useDashboardLayout", () => ({
  DASHBOARD_TEMPLATES: {
    compact: { name: "Compact", description: "Vue compacte" },
    focus: { name: "Focus", description: "Vue priorisée" },
  },
  useDashboardLayout: vi.fn(() => ({
    isEditMode: false,
    isSaving: false,
    startEdit: mockStartEdit,
    cancelEdit: mockCancelEdit,
    saveLayout: mockSaveLayout,
    resetToDefault: mockResetToDefault,
    openWidgetSelector: mockOpenWidgetSelector,
    applyTemplate: mockApplyTemplate,
  })),
}));

vi.mock("@/components/dashboard/DashboardCustomizeButton", () => ({
  DashboardCustomizeButton: ({
    templates,
    actions,
    isEditMode,
    isSaving,
  }: {
    templates: Array<{ id: string; name: string; description: string }>;
    actions: {
      startEdit: () => void;
      cancelEdit: () => void;
      saveLayout: () => void;
      resetToDefault: () => void;
      openWidgetSelector: () => void;
      applyTemplate: (id: string) => void;
    };
    isEditMode: boolean;
    isSaving: boolean;
  }) => (
    <div>
      <div data-testid="customize-state">
        {String(isEditMode)}|{String(isSaving)}|{templates.map((t) => `${t.id}:${t.name}`).join(",")}
      </div>
      <button type="button" onClick={actions.startEdit}>
        start-edit
      </button>
      <button type="button" onClick={() => actions.applyTemplate("compact")}>
        apply-compact
      </button>
    </div>
  ),
}));

vi.mock("@/components/dashboard/DashboardWidgetGrid", () => ({
  DashboardWidgetGrid: ({
    team,
    renderWidget,
    hideToolbar,
  }: {
    team: string;
    renderWidget: (id: "tasks_panel" | "email_intel" | "agenda_widget" | "pulse_widget" | "email_inbox_widget" | "notes_widget", size: "sm" | "md" | "lg") => React.ReactNode;
    hideToolbar: boolean;
    externalState?: unknown;
  }) => (
    <div data-testid="dashboard-grid">
      <div>{team}</div>
      <div>{String(hideToolbar)}</div>
      <div>{renderWidget("tasks_panel", "md")}</div>
      <div>{renderWidget("agenda_widget", "sm")}</div>
      <div>{renderWidget("pulse_widget", "sm")}</div>
      <div>{renderWidget("email_inbox_widget", "sm")}</div>
      <div>{renderWidget("notes_widget", "sm")}</div>
    </div>
  ),
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function createWrapper() {
  const queryClient = createTestQueryClient();
  queryClient.invalidateQueries = mockInvalidateQueries;
  return ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("TechniqueDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche les KPI métier, les déploiements en cours, les widgets et gère les navigations/actions", async () => {
    const wrapper = createWrapper();
    render(<TechniqueDashboard />, { wrapper });

    expect(screen.getByText("Technique - Tableau de bord")).toBeInTheDocument();
    expect(screen.getByText("Suivi des déploiements, R&D et support")).toBeInTheDocument();

    expect(screen.getByText("En déploiement")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText("R&D Actif")).toBeInTheDocument();
    expect(screen.getByText("Sprint 12")).toBeInTheDocument();
    expect(screen.getAllByText("Tickets ouverts")[0]).toBeInTheDocument();
    expect(screen.getAllByText("12")).toHaveLength(2);
    expect(screen.getByText("Alertes")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();

    expect(screen.getByText("Déploiements en cours")).toBeInTheDocument();
    expect(screen.getByText("Clinique Alpha")).toBeInTheDocument();
    expect(screen.getByText("Paris")).toBeInTheDocument();
    expect(screen.getByText("Centre Beta")).toBeInTheDocument();
    expect(screen.getByText("Voir tous les déploiements (6)")).toBeInTheDocument();

    expect(screen.getByText("Support Technique")).toBeInTheDocument();
    expect(screen.getByText("En attente")).toBeInTheDocument();
    expect(screen.getByText("En cours de traitement")).toBeInTheDocument();
    expect(screen.getByText("Résolus (7 jours)")).toBeInTheDocument();
    expect(screen.getByText("66%")).toBeInTheDocument();
    expect(screen.getByTestId("progress-value")).toHaveTextContent("66");

    expect(screen.getByTestId("tasks-action-panel")).toHaveTextContent("urgent:t1,t2");
    expect(screen.getByTestId("tasks-action-panel")).toHaveTextContent("mine:t1,t2,t5");
    expect(screen.getByTestId("tasks-action-panel")).toHaveTextContent("all:5");
    expect(screen.getByTestId("tasks-action-panel")).toHaveTextContent("myProgress:25");
    expect(screen.getByTestId("tasks-action-panel")).toHaveTextContent("global:20");

    expect(screen.getByText("Agenda:5")).toBeInTheDocument();
    expect(screen.getByText("Pulse:5")).toBeInTheDocument();
    expect(screen.getByText("EmailInbox:5")).toBeInTheDocument();
    expect(screen.getByText("Notes")).toBeInTheDocument();
    expect(screen.getByTestId("customize-state")).toHaveTextContent("false|false|compact:Compact,focus:Focus");
    expect(screen.getByTestId("dashboard-grid")).toHaveTextContent("technique");
    expect(screen.getByTestId("dashboard-grid")).toHaveTextContent("true");

    fireEvent.click(screen.getByText("start-edit"));
    expect(mockStartEdit).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("apply-compact"));
    expect(mockApplyTemplate).toHaveBeenCalledWith("compact");

    fireEvent.click(screen.getByText("Voir tous les déploiements (6)"));
    expect(mockNavigate).toHaveBeenCalledWith("/deploiement");

    fireEvent.click(screen.getByText("Accéder au support"));
    expect(mockNavigate).toHaveBeenCalledWith("/support");

    fireEvent.click(screen.getByText("Clinique Alpha"));
    expect(mockNavigate).toHaveBeenCalledWith("/etablissements/e1");

    const refreshButton = screen.getAllByRole("button")[0];
    await act(async () => {
      fireEvent.click(refreshButton);
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["dashboard"] });
  });

  it("couvre un hook react-query avec loading puis succès dans un wrapper QueryClientProvider", async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ["technique-dashboard-test-success"],
          queryFn: async () => ETABS,
        }),
      { wrapper }
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(ETABS);
    expect(result.current.data?.[0]?.nom).toBe("Clinique Alpha");
    expect(result.current.data?.filter((e) => e.statut === "Déploiement").length).toBe(5);
  });

  it("couvre un hook react-query en erreur avec isError", async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ["technique-dashboard-test-error"],
          queryFn: async () => {
            const response: { data: null; error: { message: string } } = { data: null, error: { message: "x" } };
            if (response.error) {
              throw new Error(response.error.message);
            }
            return response.data;
          },
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe("x");
  });

  it("couvre une mutation react-query et vérifie l'appel métier", async () => {
    const mutationSpy = vi.fn(async (payload: { section: string; team: string }) => payload);
    const wrapper = createWrapper();

    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: mutationSpy,
        }),
      { wrapper }
    );

    await act(async () => {
      await result.current.mutateAsync({ section: "dashboard", team: "technique" });
    });

    expect(mutationSpy).toHaveBeenCalledWith({ section: "dashboard", team: "technique" });
  });
});