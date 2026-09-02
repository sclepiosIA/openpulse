/* @vitest-environment jsdom */
import React from "react";
import { render, screen, cleanup, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PeopleOverview } from "./PeopleOverview";

const {
  RH_KPIS,
  TEAM_STATS,
  PERMS_ALL,
  PERMS_LIMITED,
  AUTH_STATE,
  RH_SUCCESS_RESULT,
  RH_LOADING_RESULT,
  RH_ERROR_RESULT,
  TEAM_SUCCESS_RESULT,
  TEAM_LOADING_RESULT,
  TEAM_ERROR_RESULT,
  mockUseRHKPIs,
  mockUseTeamOverviewStats,
  mockUseRolePermissions,
  mockFrom,
  mockNavigate,
  mockToastSuccess,
  mockToastError,
} = vi.hoisted(() => {
  const RH_KPIS = {
    effectif_actif: 42,
    effectif_total: 50,
    masse_salariale_nette_mensuelle: 123456,
    masse_salariale_nette_annuelle: 1481472,
    masse_salariale_brute_mensuelle: 160000,
    masse_salariale_brute_annuelle: 1920000,
    masse_salariale_mensuelle: 190000,
    masse_salariale_annuelle: 2280000,
    taux_absenteisme: 3.2,
  };

  const TEAM_STATS = {
    totalMembers: 9,
    activeMembers: 7,
    avgCompletionRate: 88,
    totalTasks: 120,
    tasksOverdueTotal: 6,
    totalProjects: 4,
  };

  const PERMS_ALL = {
    canViewSalaries: true,
    canViewAllAbsences: true,
    canViewAllTeamMembers: true,
    canViewTeamStats: true,
  };

  const PERMS_LIMITED = {
    canViewSalaries: false,
    canViewAllAbsences: false,
    canViewAllTeamMembers: true,
    canViewTeamStats: true,
  };

  const AUTH_STATE = {
    user: { id: "u1", email: "user@test.co" },
    session: { user: { id: "u1" } },
    isLoading: false,
  };

  const RH_SUCCESS_RESULT = {
    data: RH_KPIS,
    isLoading: false,
    isError: false,
    error: null,
  };

  const RH_LOADING_RESULT = {
    data: undefined,
    isLoading: true,
    isError: false,
    error: null,
  };

  const RH_ERROR_RESULT = {
    data: null,
    isLoading: false,
    isError: true,
    error: { message: "x" },
  };

  const TEAM_SUCCESS_RESULT = {
    data: TEAM_STATS,
    isLoading: false,
    isError: false,
    error: null,
  };

  const TEAM_LOADING_RESULT = {
    data: undefined,
    isLoading: true,
    isError: false,
    error: null,
  };

  const TEAM_ERROR_RESULT = {
    data: null,
    isLoading: false,
    isError: true,
    error: { message: "x" },
  };

  const mockUseRHKPIs = vi.fn();
  const mockUseTeamOverviewStats = vi.fn();
  const mockUseRolePermissions = vi.fn();
  const mockNavigate = vi.fn();
  const mockToastSuccess = vi.fn();
  const mockToastError = vi.fn();

  const createBuilder = () => {
    const resolved = { data: null, error: null };
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      neq: vi.fn(() => builder),
      gt: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lt: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      like: vi.fn(() => builder),
      ilike: vi.fn(() => builder),
      is: vi.fn(() => builder),
      in: vi.fn(() => builder),
      contains: vi.fn(() => builder),
      containedBy: vi.fn(() => builder),
      overlaps: vi.fn(() => builder),
      textSearch: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      range: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      upsert: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      single: vi.fn(async () => resolved),
      maybeSingle: vi.fn(async () => resolved),
      then: (onFulfilled: (value: typeof resolved) => unknown) => Promise.resolve(resolved).then(onFulfilled),
      catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(resolved).catch(onRejected),
    };
    return builder;
  };

  const mockFrom = vi.fn(() => createBuilder());

  return {
    RH_KPIS,
    TEAM_STATS,
    PERMS_ALL,
    PERMS_LIMITED,
    AUTH_STATE,
    RH_SUCCESS_RESULT,
    RH_LOADING_RESULT,
    RH_ERROR_RESULT,
    TEAM_SUCCESS_RESULT,
    TEAM_LOADING_RESULT,
    TEAM_ERROR_RESULT,
    mockUseRHKPIs,
    mockUseTeamOverviewStats,
    mockUseRolePermissions,
    mockFrom,
    mockNavigate,
    mockToastSuccess,
    mockToastError,
  };
});

vi.mock("@/hooks/hr/useRHKPIs", () => ({
  useRHKPIs: mockUseRHKPIs,
}));

vi.mock("@/hooks/hr/useTeamStats", () => ({
  useTeamOverviewStats: mockUseTeamOverviewStats,
}));

vi.mock("@/hooks/auth/useRolePermissions", () => ({
  useRolePermissions: mockUseRolePermissions,
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/components/shared/StatsCard", () => ({
  StatsCard: ({
    title,
    value,
    subtitle,
    permission,
  }: {
    title: string;
    value: string | number;
    subtitle?: string;
    permission?: string;
  }) => (
    <div data-testid="stats-card" data-permission={permission || ""}>
      <div>{title}</div>
      <div>{String(value)}</div>
      {subtitle ? <div>{subtitle}</div> : null}
    </div>
  ),
}));

vi.mock("@/components/shared/LoadingStates", () => ({
  StatsSkeleton: ({ count }: { count: number }) => <div data-testid="stats-skeleton">loading-{count}</div>,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getUser: vi.fn(async () => ({ data: { user: AUTH_STATE.user }, error: null })),
      getSession: vi.fn(async () => ({ data: { session: AUTH_STATE.session }, error: null })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signOut: vi.fn(async () => ({ error: null })),
    },
  },
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
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

describe("PeopleOverview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRolePermissions.mockReturnValue(PERMS_ALL);
    mockUseRHKPIs.mockReturnValue(RH_SUCCESS_RESULT);
    mockUseTeamOverviewStats.mockReturnValue(TEAM_SUCCESS_RESULT);
  });

  afterEach(() => {
    cleanup();
  });

  it("utilise un wrapper QueryClientProvider compatible renderHook", () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => "ok", { wrapper });
    expect(result.current).toBe("ok");
  });

  it("affiche le skeleton pendant le chargement", () => {
    mockUseRHKPIs.mockReturnValue(RH_LOADING_RESULT);
    mockUseTeamOverviewStats.mockReturnValue(TEAM_SUCCESS_RESULT);

    render(<PeopleOverview context="rh" />, { wrapper: createWrapper() });

    expect(screen.getByTestId("stats-skeleton")).toHaveTextContent("loading-4");
    expect(screen.queryByText("Effectif actif")).not.toBeInTheDocument();
    expect(screen.queryAllByTestId("stats-card")).toHaveLength(0);
  });

  it("affiche les KPI RH avec les valeurs métier formatées en contexte rh", () => {
    render(<PeopleOverview context="rh" />, { wrapper: createWrapper() });

    expect(screen.getByText("Effectif actif")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("Sur 50 employés")).toBeInTheDocument();

    expect(screen.getByText("Masse salariale nette")).toBeInTheDocument();
    expect(screen.getByText(/123\s?456\s?€/)).toBeInTheDocument();
    expect(screen.getByText(/1\s?481\s?472\s?€\s?\/an/)).toBeInTheDocument();

    expect(screen.getByText("Masse salariale brute")).toBeInTheDocument();
    expect(screen.getByText(/160\s?000\s?€/)).toBeInTheDocument();
    expect(screen.getByText(/1\s?920\s?000\s?€\s?\/an/)).toBeInTheDocument();

    expect(screen.getByText("Coût employeur")).toBeInTheDocument();
    expect(screen.getByText(/190\s?000\s?€/)).toBeInTheDocument();
    expect(screen.getByText(/2\s?280\s?000\s?€\s?\/an/)).toBeInTheDocument();

    expect(screen.getByText("Absentéisme")).toBeInTheDocument();
    expect(screen.getByText("3.2%")).toBeInTheDocument();
    expect(screen.getByText("Taux mensuel")).toBeInTheDocument();

    const cards = screen.getAllByTestId("stats-card");
    expect(cards).toHaveLength(5);
    expect(cards[1]).toHaveAttribute("data-permission", "canViewSalaries");
    expect(cards[2]).toHaveAttribute("data-permission", "canViewSalaries");
    expect(cards[3]).toHaveAttribute("data-permission", "canViewSalaries");
    expect(cards[4]).toHaveAttribute("data-permission", "canViewAllAbsences");
  });

  it("affiche la vue équipe quand le contexte est equipe et sans permission salaire", () => {
    mockUseRolePermissions.mockReturnValue(PERMS_LIMITED);

    render(<PeopleOverview context="equipe" />, { wrapper: createWrapper() });

    expect(screen.getByText("Total équipe")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.getByText("7 actifs")).toBeInTheDocument();

    expect(screen.getByText("Taux de complétion")).toBeInTheDocument();
    expect(screen.getByText("88%")).toBeInTheDocument();
    expect(screen.getByText("120 tâches")).toBeInTheDocument();

    expect(screen.getByText("Tâches en retard")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText("À traiter")).toBeInTheDocument();

    expect(screen.getByText("Projets actifs")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("En cours")).toBeInTheDocument();

    expect(screen.queryByText("Effectif actif")).not.toBeInTheDocument();
    expect(screen.queryByText("Masse salariale nette")).not.toBeInTheDocument();

    const cards = screen.getAllByTestId("stats-card");
    expect(cards).toHaveLength(4);
    expect(cards[0]).toHaveAttribute("data-permission", "canViewAllTeamMembers");
    expect(cards[1]).toHaveAttribute("data-permission", "canViewTeamStats");
    expect(cards[2]).toHaveAttribute("data-permission", "");
    expect(cards[3]).toHaveAttribute("data-permission", "");
  });

  it("affiche quand même la vue RH en contexte equipe si la permission salaire est accordée", () => {
    mockUseRolePermissions.mockReturnValue(PERMS_ALL);

    render(<PeopleOverview context="equipe" />, { wrapper: createWrapper() });

    expect(screen.getByText("Effectif actif")).toBeInTheDocument();
    expect(screen.getByText("Masse salariale nette")).toBeInTheDocument();
    expect(screen.queryByText("Total équipe")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("stats-card")).toHaveLength(5);
  });

  it("retombe sur les valeurs par défaut quand les données RH sont en erreur", () => {
    mockUseRHKPIs.mockReturnValue(RH_ERROR_RESULT);
    mockUseTeamOverviewStats.mockReturnValue(TEAM_SUCCESS_RESULT);

    render(<PeopleOverview context="rh" />, { wrapper: createWrapper() });

    expect(screen.getByText("Effectif actif")).toBeInTheDocument();
    expect(screen.getByText("Sur 0 employés")).toBeInTheDocument();
    expect(screen.getByText(/^0$/)).toBeInTheDocument();
    expect(screen.getByText("Absentéisme")).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();
    expect(screen.getAllByTestId("stats-card")).toHaveLength(5);
    expect(screen.getAllByText(/0\s?€(?:\s?\/an)?/).length).toBeGreaterThanOrEqual(6);
  });

  it("continue d'afficher la vue équipe avec des zéros quand les stats équipe sont en erreur", () => {
    mockUseRolePermissions.mockReturnValue(PERMS_LIMITED);
    mockUseRHKPIs.mockReturnValue(RH_SUCCESS_RESULT);
    mockUseTeamOverviewStats.mockReturnValue(TEAM_ERROR_RESULT);

    render(<PeopleOverview context="equipe" />, { wrapper: createWrapper() });

    expect(screen.getByText("Total équipe")).toBeInTheDocument();
    expect(screen.getByText("0 actifs")).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();
    expect(screen.getByText("0 tâches")).toBeInTheDocument();
    expect(screen.getByText("À traiter")).toBeInTheDocument();
    expect(screen.getByText("En cours")).toBeInTheDocument();
    expect(screen.getAllByTestId("stats-card")).toHaveLength(4);
  });

  it("reste en chargement si un seul des deux hooks charge encore", () => {
    mockUseRHKPIs.mockReturnValue(RH_SUCCESS_RESULT);
    mockUseTeamOverviewStats.mockReturnValue(TEAM_LOADING_RESULT);

    render(<PeopleOverview context="equipe" />, { wrapper: createWrapper() });

    expect(screen.getByTestId("stats-skeleton")).toHaveTextContent("loading-4");
    expect(screen.queryByText("Total équipe")).not.toBeInTheDocument();
    expect(screen.queryByText("Effectif actif")).not.toBeInTheDocument();
  });
});