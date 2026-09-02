import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { PartenaireActivitiesTimeline } from "./PartenaireActivitiesTimeline";

const {
  STABLE_ACTIVITIES,
  EMPTY_ACTIVITIES,
  AUTH_STATE,
  mockUsePartenaireActivities,
  mockFrom,
  mockNavigate,
  mockToastSuccess,
  mockToastError,
} = vi.hoisted(() => ({
  STABLE_ACTIVITIES: [
    {
      id: "a1",
      type: "email",
      title: "Email envoyé",
      description: "Premier contact avec le partenaire",
      date: "2024-01-10T10:00:00.000Z",
    },
    {
      id: "a2",
      type: "meeting",
      title: "Réunion planifiée",
      description: "Présentation des services",
      date: "2024-01-11T15:30:00.000Z",
    },
    {
      id: "a3",
      type: "note",
      title: "Note interne",
      description: "",
      date: null,
    },
    {
      id: "a4",
      type: "status_change",
      title: "Statut mis à jour",
      description: "Passage à chaud",
      date: "2024-01-12T09:15:00.000Z",
    },
  ],
  EMPTY_ACTIVITIES: [],
  AUTH_STATE: {
    user: { id: "u1", email: "test@ex.co" },
    session: { user: { id: "u1" } },
    isLoading: false,
  },
  mockUsePartenaireActivities: vi.fn(),
  mockFrom: vi.fn(),
  mockNavigate: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock("@/hooks/crm/usePartenaireActivities", () => ({
  usePartenaireActivities: mockUsePartenaireActivities,
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 data-testid="card-title" className={className}>
      {children}
    </h2>
  ),
  CardContent: ({ children }: { children: React.ReactNode }) => <div data-testid="card-content">{children}</div>,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({
    children,
    className,
    variant,
  }: {
    children: React.ReactNode;
    className?: string;
    variant?: string;
  }) => (
    <span data-testid="badge" data-variant={variant} className={className}>
      {children}
    </span>
  ),
}));

vi.mock("lucide-react", () => ({
  Mail: ({ className }: { className?: string }) => <svg data-testid="icon-mail" className={className} />,
  UserPlus: ({ className }: { className?: string }) => <svg data-testid="icon-user-plus" className={className} />,
  TrendingUp: ({ className }: { className?: string }) => <svg data-testid="icon-trending-up" className={className} />,
  FileText: ({ className }: { className?: string }) => <svg data-testid="icon-file-text" className={className} />,
  Calendar: ({ className }: { className?: string }) => <svg data-testid="icon-calendar" className={className} />,
}));

vi.mock("date-fns", () => ({
  formatDistanceToNow: vi.fn((date: Date) => `il y a ${date.toISOString()}`),
}));

vi.mock("date-fns/locale", () => ({
  fr: { code: "fr" },
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
    then: (onFulfilled: (value: { data: null; error: null }) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve({ data: null, error: null }).catch(onRejected),
  };

  return {
    supabase: {
      from: mockFrom.mockImplementation(() => builder),
    },
  };
});

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

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

describe("PartenaireActivitiesTimeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche l'état de chargement", () => {
    mockUsePartenaireActivities.mockReturnValue({
      data: STABLE_ACTIVITIES,
      isLoading: true,
      isError: false,
      error: null,
    });

    render(<PartenaireActivitiesTimeline partenaireId="p1" />);

    expect(screen.getByText("Timeline des activités")).toBeInTheDocument();
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeTruthy();
    expect(screen.queryByText("Aucune activité récente")).not.toBeInTheDocument();
  });

  it("affiche les activités réelles, filtre celles sans date et rend les bons contenus métier", () => {
    mockUsePartenaireActivities.mockReturnValue({
      data: STABLE_ACTIVITIES,
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<PartenaireActivitiesTimeline partenaireId="partner-42" />);

    expect(mockUsePartenaireActivities).toHaveBeenCalledWith("partner-42");

    expect(screen.getByText("Email envoyé")).toBeInTheDocument();
    expect(screen.getByText("Premier contact avec le partenaire")).toBeInTheDocument();

    expect(screen.getByText("Réunion planifiée")).toBeInTheDocument();
    expect(screen.getByText("Présentation des services")).toBeInTheDocument();

    expect(screen.getByText("Statut mis à jour")).toBeInTheDocument();
    expect(screen.getByText("Passage à chaud")).toBeInTheDocument();

    expect(screen.queryByText("Note interne")).not.toBeInTheDocument();

    expect(screen.getByTestId("icon-mail")).toBeInTheDocument();
    expect(screen.getByTestId("icon-calendar")).toBeInTheDocument();
    expect(screen.getByTestId("icon-trending-up")).toBeInTheDocument();
    expect(screen.queryByTestId("icon-file-text")).not.toBeInTheDocument();

    const badges = screen.getAllByTestId("badge");
    expect(badges).toHaveLength(3);
    expect(badges[0]).toHaveTextContent("il y a 2024-01-10T10:00:00.000Z");
    expect(badges[1]).toHaveTextContent("il y a 2024-01-11T15:30:00.000Z");
    expect(badges[2]).toHaveTextContent("il y a 2024-01-12T09:15:00.000Z");
  });

  it("affiche le message vide quand aucune activité n'est disponible", () => {
    mockUsePartenaireActivities.mockReturnValue({
      data: EMPTY_ACTIVITIES,
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<PartenaireActivitiesTimeline partenaireId="p-empty" />);

    expect(screen.getByText("Aucune activité récente")).toBeInTheDocument();
    expect(screen.queryByTestId("badge")).not.toBeInTheDocument();
  });

  it("le hook mocké expose un état d'erreur via renderHook avec QueryClientProvider", () => {
    mockUsePartenaireActivities.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      error: { message: "x" },
    });

    const wrapper = createWrapper();

    const { result } = renderHook(() => mockUsePartenaireActivities("p-error"), { wrapper });

    expect(result.current.isError).toBe(true);
    expect(result.current.error).toEqual({ message: "x" });
    expect(result.current.data).toBeNull();
    expect(mockUsePartenaireActivities).toHaveBeenCalledWith("p-error");
  });
});