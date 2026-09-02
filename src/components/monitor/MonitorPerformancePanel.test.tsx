/* @vitest-environment jsdom */
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within, renderHook } from "@testing-library/react";
import { format } from "date-fns";
import { MonitorPerformancePanel } from "./MonitorPerformancePanel";

const {
  SLOW_ROUTES,
  TOP_USERS,
  AUTH_STATE,
  mockUseTopSlowRoutes,
  mockUseTopUsersWithErrors,
  mockFrom,
} = vi.hoisted(() => ({
  SLOW_ROUTES: [
    { route: "/checkout", p75: 4200, p95: 6100, avg_value: 3500, samples: 120 },
    { route: "/dashboard", p75: 2300, p95: 3200, avg_value: 1800, samples: 85 },
  ],
  TOP_USERS: [
    {
      user_id: "user-abcdef",
      user_email: "alice@example.test",
      distinct_types: 3,
      error_count: 9,
      last_error_at: "2024-01-15T10:30:00.000Z",
    },
    {
      user_id: "user-12345678",
      user_email: null,
      distinct_types: 1,
      error_count: 4,
      last_error_at: "2024-01-14T08:00:00.000Z",
    },
  ],
  AUTH_STATE: {
    user: { id: "u1", email: "tester@example.test" },
    session: { user: { id: "u1" } },
    isLoading: false,
  },
  mockUseTopSlowRoutes: vi.fn(),
  mockUseTopUsersWithErrors: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => {
  const createBuilder = () => {
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
      single: vi.fn(async () => ({ data: null, error: null })),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
      then: (
        onFulfilled: (value: { data: null; error: null }) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) => Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected),
      catch: (onRejected: (reason: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).catch(onRejected),
    };
    return builder;
  };

  mockFrom.mockImplementation(() => createBuilder());

  return {
    supabase: {
      from: mockFrom,
      auth: {
        getSession: vi.fn(async () => ({ data: { session: AUTH_STATE.session }, error: null })),
        getUser: vi.fn(async () => ({ data: { user: AUTH_STATE.user }, error: null })),
      },
    },
  };
});

vi.mock("@/hooks/monitoring/useMonitorPerformance", () => ({
  useTopSlowRoutes: mockUseTopSlowRoutes,
  useTopUsersWithErrors: mockUseTopUsersWithErrors,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => AUTH_STATE,
  AuthProvider: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => <h2 className={className}>{children}</h2>,
  CardDescription: ({ children, className }: { children: React.ReactNode; className?: string }) => <p className={className}>{children}</p>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => <span className={className}>{children}</span>,
}));

vi.mock("@/components/ui/progress", () => ({
  Progress: ({ value, className }: { value: number; className?: string }) => (
    <div role="progressbar" aria-valuenow={value} className={className} />
  ),
}));

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: ({ className }: { className?: string }) => <div data-testid="skeleton" className={className} />,
}));

vi.mock("lucide-react", () => ({
  Gauge: () => <svg data-testid="gauge-icon" />,
  AlertCircle: () => <svg data-testid="alert-icon" />,
  User: () => <svg data-testid="user-icon" />,
}));

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("MonitorPerformancePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche les états de chargement pour les deux panneaux", () => {
    mockUseTopSlowRoutes.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });
    mockUseTopUsersWithErrors.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    render(<MonitorPerformancePanel />, { wrapper: createWrapper() });

    expect(screen.getAllByTestId("skeleton")).toHaveLength(10);
    expect(screen.getByText("Top 10 routes lentes (P75 LCP — 24h)")).toBeInTheDocument();
    expect(screen.getByText("Top 10 utilisateurs en erreur (7j)")).toBeInTheDocument();
  });

  it("affiche les données métier et les indicateurs calculés", () => {
    mockUseTopSlowRoutes.mockReturnValue({
      data: SLOW_ROUTES,
      isLoading: false,
      error: null,
    });
    mockUseTopUsersWithErrors.mockReturnValue({
      data: TOP_USERS,
      isLoading: false,
      error: null,
    });

    render(<MonitorPerformancePanel />, { wrapper: createWrapper() });

    expect(mockUseTopSlowRoutes).toHaveBeenCalledWith(24, "LCP");
    expect(mockUseTopUsersWithErrors).toHaveBeenCalledWith(7);

    expect(screen.getByText("/checkout")).toBeInTheDocument();
    expect(screen.getByText("/dashboard")).toBeInTheDocument();
    expect(screen.getByText("Mauvais")).toBeInTheDocument();
    expect(screen.getByText("Bon")).toBeInTheDocument();
    expect(screen.getByText("4200 ms")).toBeInTheDocument();
    expect(screen.getByText("2300 ms")).toBeInTheDocument();
    expect(screen.getByText("120 échantillons")).toBeInTheDocument();
    expect(screen.getByText("85 échantillons")).toBeInTheDocument();
    expect(screen.getByText("P95 6100 ms")).toBeInTheDocument();
    expect(screen.getByText("P95 3200 ms")).toBeInTheDocument();
    expect(screen.getByText("Moy. 3500 ms")).toBeInTheDocument();
    expect(screen.getByText("Moy. 1800 ms")).toBeInTheDocument();

    expect(screen.getByText("alice@example.test")).toBeInTheDocument();
    expect(screen.getByText("user-123…")).toBeInTheDocument();
    expect(screen.getByText("3 types")).toBeInTheDocument();
    expect(screen.getByText("1 types")).toBeInTheDocument();

    const firstUserRow = screen.getByText("alice@example.test").closest("div");
    const secondUserRow = screen.getByText("user-123…").closest("div");

    expect(firstUserRow).not.toBeNull();
    expect(secondUserRow).not.toBeNull();

    expect(within(firstUserRow as HTMLElement).getByText("9")).toBeInTheDocument();
    expect(within(secondUserRow as HTMLElement).getByText("4")).toBeInTheDocument();

    expect(screen.getByText(new RegExp(format(new Date(TOP_USERS[0].last_error_at), "dd/MM HH:mm")))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(format(new Date(TOP_USERS[1].last_error_at), "dd/MM HH:mm")))).toBeInTheDocument();

    const progressbars = screen.getAllByRole("progressbar");
    expect(progressbars).toHaveLength(4);
    expect(progressbars[0]).toHaveAttribute("aria-valuenow", "100");
    expect(progressbars[1]).toHaveAttribute("aria-valuenow", String((2300 / 4200) * 100));
    expect(progressbars[2]).toHaveAttribute("aria-valuenow", "100");
    expect(progressbars[3]).toHaveAttribute("aria-valuenow", String((4 / 9) * 100));
  });

  it("affiche les états vides quand aucune donnée n'est disponible", () => {
    mockUseTopSlowRoutes.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });
    mockUseTopUsersWithErrors.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    render(<MonitorPerformancePanel />, { wrapper: createWrapper() });

    expect(
      screen.getByText("Pas encore assez d'échantillons Web Vitals sur 24 h (sampling 10 %).")
    ).toBeInTheDocument();
    expect(screen.getByText("Aucune erreur utilisateur sur 7 jours.")).toBeInTheDocument();
  });

  it("affiche les erreurs de chargement quand les hooks retournent une erreur", () => {
    mockUseTopSlowRoutes.mockReturnValue({
      data: null,
      isLoading: false,
      error: { message: "x" },
    });
    mockUseTopUsersWithErrors.mockReturnValue({
      data: null,
      isLoading: false,
      error: { message: "x" },
    });

    render(<MonitorPerformancePanel />, { wrapper: createWrapper() });

    expect(screen.getAllByText("Erreur de chargement")).toHaveLength(2);
    expect(screen.getAllByTestId("alert-icon")).toHaveLength(2);
  });

  it("permet de vérifier les retours de hooks dans un wrapper QueryClientProvider", () => {
    mockUseTopSlowRoutes.mockReturnValue({
      data: SLOW_ROUTES,
      isLoading: false,
      error: null,
    });
    mockUseTopUsersWithErrors.mockReturnValue({
      data: TOP_USERS,
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(
      () => ({
        routes: mockUseTopSlowRoutes(24, "LCP"),
        users: mockUseTopUsersWithErrors(7),
      }),
      { wrapper: createWrapper() }
    );

    expect(result.current.routes.data).toBe(SLOW_ROUTES);
    expect(result.current.routes.isLoading).toBe(false);
    expect(result.current.routes.error).toBeNull();
    expect(result.current.users.data).toBe(TOP_USERS);
    expect(result.current.users.isLoading).toBe(false);
    expect(result.current.users.error).toBeNull();
    expect(mockUseTopSlowRoutes).toHaveBeenCalledWith(24, "LCP");
    expect(mockUseTopUsersWithErrors).toHaveBeenCalledWith(7);
  });
});