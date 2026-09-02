import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { EmailsByEtablissementView } from "./EmailsByEtablissementView";

const {
  EMAILS_ROWS,
  AUTH_STATE,
  mockFrom,
  mockFixMalformedEncoding,
  mockCn,
  mockUseNavigate,
} = vi.hoisted(() => ({
  EMAILS_ROWS: [
    {
      etablissement_id: "e1",
      etablissement_nom: "Clinique Alpha",
      etablissement_ville: "Paris",
      total_threads: 5,
      total_messages: 12,
      unread_count: 2,
      last_message_date: "2025-01-03T10:00:00.000Z",
      avg_response_time_hours: 4,
      active_threads: 3,
      archived_threads: 2,
      relationship_status: "engagement_actif",
      engagement_score: 82,
      last_email_received_at: "2025-01-03T09:00:00.000Z",
      last_email_sent_at: "2025-01-03T08:00:00.000Z",
    },
    {
      etablissement_id: "e2",
      etablissement_nom: "Hopital Beta",
      etablissement_ville: "Lyon",
      total_threads: 2,
      total_messages: 5,
      unread_count: 0,
      last_message_date: "2025-01-01T10:00:00.000Z",
      avg_response_time_hours: 12,
      active_threads: 1,
      archived_threads: 1,
      relationship_status: "prospect",
      engagement_score: 40,
      last_email_received_at: "2025-01-01T09:00:00.000Z",
      last_email_sent_at: "2025-01-01T08:00:00.000Z",
    },
    {
      etablissement_id: "e3",
      etablissement_nom: "Maison Gamma",
      etablissement_ville: "Marseille",
      total_threads: 7,
      total_messages: 20,
      unread_count: 1,
      last_message_date: "2024-12-31T10:00:00.000Z",
      avg_response_time_hours: 8,
      active_threads: 4,
      archived_threads: 3,
      relationship_status: "inactif",
      engagement_score: 55,
      last_email_received_at: "2024-12-31T09:00:00.000Z",
      last_email_sent_at: "2024-12-31T08:00:00.000Z",
    },
  ],
  AUTH_STATE: {
    user: { id: "u1", email: "user@test.local" },
    session: { user: { id: "u1" } },
    isLoading: false,
  },
  mockFrom: vi.fn(),
  mockFixMalformedEncoding: vi.fn((v: string) => `fixed:${v}`),
  mockCn: vi.fn((...args: Array<string | false | undefined>) => args.filter(Boolean).join(" ")),
  mockUseNavigate: vi.fn(),
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
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: (resolve: (value: { data: null; error: null }) => unknown) =>
      Promise.resolve(resolve({ data: null, error: null })),
    catch: () => Promise.resolve({ data: null, error: null }),
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
    useNavigate: () => mockUseNavigate,
  };
});
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    [key: string]: unknown;
  }) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: ({
    value,
    onChange,
    placeholder,
    className,
  }: {
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    className?: string;
  }) => (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
    />
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: ({ className }: { className?: string }) => <div data-testid="skeleton" className={className} />,
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <div>{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    children: React.ReactNode;
  }) => {
    const items: Array<{ value: string; label: string }> = [];
    React.Children.forEach(children, (child) => {
      if (!React.isValidElement(child)) return;
      if (child.props.children) {
        React.Children.forEach(child.props.children, (nested) => {
          if (!React.isValidElement(nested)) return;
          if (typeof nested.props.value === "string") {
            const label =
              typeof nested.props.children === "string"
                ? nested.props.children
                : Array.isArray(nested.props.children)
                  ? nested.props.children.join("")
                  : String(nested.props.children);
            items.push({ value: nested.props.value, label });
          }
        });
      }
    });

    return (
      <select
        data-testid={`select-${value ?? "empty"}`}
        value={value}
        onChange={(e) => onValueChange?.(e.target.value)}
      >
        {items.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    );
  },
  SelectTrigger: ({ children }: { children: React.ReactNode; className?: string }) => <>{children}</>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children }: { value: string; children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("./EtablissementEmailCard", () => ({
  EtablissementEmailCard: ({
    etablissementId,
    etablissementNom,
    etablissementVille,
    totalThreads,
    totalMessages,
    unreadCount,
    relationshipStatus,
    engagementScore,
    onViewDetails,
  }: {
    etablissementId: string;
    etablissementNom: string;
    etablissementVille: string;
    totalThreads: number;
    totalMessages: number;
    unreadCount: number;
    relationshipStatus: string;
    engagementScore: number;
    onViewDetails: (id: string) => void;
  }) => (
    <button data-testid={`card-${etablissementId}`} onClick={() => onViewDetails(etablissementId)}>
      <span>{etablissementNom}</span>
      <span>{etablissementVille}</span>
      <span>{`threads:${totalThreads}`}</span>
      <span>{`messages:${totalMessages}`}</span>
      <span>{`unread:${unreadCount}`}</span>
      <span>{`status:${relationshipStatus}`}</span>
      <span>{`engagement:${engagementScore}`}</span>
    </button>
  ),
}));

vi.mock("./EmailThread", () => ({
  EmailThread: ({ threadId, onBack }: { threadId: string; onBack: () => void }) => (
    <div>
      <div>{`thread:${threadId}`}</div>
      <button onClick={onBack}>thread-back</button>
    </div>
  ),
}));

vi.mock("./EtablissementTimelineView", () => ({
  EtablissementTimelineView: ({
    etablissementId,
    etablissementNom,
    etablissementVille,
    onBack,
  }: {
    etablissementId: string;
    etablissementNom: string;
    etablissementVille: string;
    onBack: () => void;
  }) => (
    <div>
      <div>{`timeline:${etablissementId}`}</div>
      <div>{etablissementNom}</div>
      <div>{etablissementVille}</div>
      <button onClick={onBack}>timeline-back</button>
    </div>
  ),
}));

vi.mock("lucide-react", () => {
  const Icon = () => <svg />;
  return {
    ArrowLeft: Icon,
    Search: Icon,
    Mail: Icon,
    MessageSquare: Icon,
    Building2: Icon,
    AlertCircle: Icon,
    X: Icon,
    TrendingUp: Icon,
    Filter: Icon,
  };
});

vi.mock("@/lib/emailUtils", () => ({
  fixMalformedEncoding: mockFixMalformedEncoding,
}));

vi.mock("@/lib/utils", () => ({
  cn: mockCn,
}));

vi.mock("@/hooks/email/useEmailsByEtablissement", () => ({
  useEmailsByEtablissement: vi.fn(),
}));

import { useEmailsByEtablissement } from "@/hooks/email/useEmailsByEtablissement";

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

describe("EmailsByEtablissementView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche le chargement puis les données métier avec recherche, filtre, tri et navigation timeline", async () => {
    vi.mocked(useEmailsByEtablissement).mockReturnValue({
      data: EMAILS_ROWS,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useEmailsByEtablissement>);

    render(<EmailsByEtablissementView />);

    expect(screen.getByText("Par établissement")).toBeInTheDocument();
    expect(screen.getByText("3 sur 3 établissements")).toBeInTheDocument();
    expect(screen.getByText("14")).toBeInTheDocument();
    expect(screen.getByText("37")).toBeInTheDocument();
    expect(screen.getByText("3 email(s) non lu(s)")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();

    const cards = screen.getAllByTestId(/^card-/);
    expect(cards).toHaveLength(3);
    expect(cards[0]).toHaveTextContent("fixed:Clinique Alpha");
    expect(cards[1]).toHaveTextContent("fixed:Hopital Beta");
    expect(cards[2]).toHaveTextContent("fixed:Maison Gamma");

    fireEvent.change(screen.getByPlaceholderText("Rechercher..."), {
      target: { value: "lyon" },
    });

    expect(screen.getByText("1 sur 3 établissements")).toBeInTheDocument();
    expect(screen.getByTestId("card-e2")).toBeInTheDocument();
    expect(screen.queryByTestId("card-e1")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /effacer/i })).toBeInTheDocument();

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "prospect" } });
    expect(screen.getByTestId("card-e2")).toBeInTheDocument();

    fireEvent.change(selects[1], { target: { value: "engagement" } });
    expect(screen.getByTestId("card-e2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /effacer/i }));
    expect(screen.getByText("3 sur 3 établissements")).toBeInTheDocument();

    fireEvent.change(selects[0], { target: { value: "high_engagement" } });
    expect(screen.getByText("1 sur 3 établissements")).toBeInTheDocument();
    expect(screen.getByTestId("card-e1")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("card-e1"));
    expect(screen.getByText("timeline:e1")).toBeInTheDocument();
    expect(screen.getByText("fixed:Clinique Alpha")).toBeInTheDocument();
    expect(screen.getByText("fixed:Paris")).toBeInTheDocument();
    expect(mockFixMalformedEncoding).toHaveBeenCalledWith("Clinique Alpha");
    expect(mockFixMalformedEncoding).toHaveBeenCalledWith("Paris");
  });

  it("affiche les skeletons pendant le chargement", () => {
    vi.mocked(useEmailsByEtablissement).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as ReturnType<typeof useEmailsByEtablissement>);

    render(<EmailsByEtablissementView />);
    expect(screen.getAllByTestId("skeleton")).toHaveLength(36);
    expect(screen.queryByText("Erreur lors du chargement des données")).not.toBeInTheDocument();
  });

  it("affiche l'état d'erreur quand le hook remonte une erreur", () => {
    vi.mocked(useEmailsByEtablissement).mockReturnValue({
      data: null,
      isLoading: false,
      error: { message: "x" },
    } as ReturnType<typeof useEmailsByEtablissement>);

    render(<EmailsByEtablissementView />);
    expect(screen.getByText("Erreur lors du chargement des données")).toBeInTheDocument();
  });

  it("couvre un hook react-query avec succès puis erreur dans un wrapper QueryClientProvider", async () => {
    const wrapper = createWrapper();

    const successHook = renderHook(
      () =>
        useQuery({
          queryKey: ["emails-success"],
          queryFn: async () => {
            const result = { data: EMAILS_ROWS, error: null as null | { message: string } };
            if (result.error) {
              throw new Error(result.error.message);
            }
            return result.data;
          },
        }),
      { wrapper }
    );

    await waitFor(() => expect(successHook.result.current.isSuccess).toBe(true));
    expect(successHook.result.current.isLoading).toBe(false);
    expect(successHook.result.current.data).toEqual(EMAILS_ROWS);
    expect(successHook.result.current.data?.[0].etablissement_nom).toBe("Clinique Alpha");
    expect(successHook.result.current.data?.[0].engagement_score).toBe(82);

    const errorHook = renderHook(
      () =>
        useQuery({
          queryKey: ["emails-error"],
          queryFn: async () => {
            const result = { data: null, error: { message: "x" } };
            if (result.error) {
              throw new Error(result.error.message);
            }
            return result.data;
          },
        }),
      { wrapper }
    );

    await waitFor(() => expect(errorHook.result.current.isError).toBe(true));
    expect(errorHook.result.current.error?.message).toBe("x");
  });
});