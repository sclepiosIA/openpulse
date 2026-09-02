import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Stable hoisted mocks and data
const {
  mockFrom,
  mockUseEtablissementTimeline,
  LOADING_RESULT,
  ERROR_RESULT,
  SUCCESS_RESULT,
} = vi.hoisted(() => {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: vi.fn(function (this: any, cb: any) {
      const res = { data: null, error: null };
      return cb ? Promise.resolve(cb(res)) : Promise.resolve(res);
    }),
    catch: vi.fn().mockImplementation((handler: any) => Promise.resolve(handler(null))),
  };
  const mockFrom = vi.fn().mockReturnValue(builder);

  const TIMELINE_ITEMS = [
    {
      id: "email-1",
      type: "email",
      title: "Email important",
      date: "2023-01-01T00:00:00.000Z",
      data: { id: "thread-1", message_count: 3, category: "CatA", priority: "high" },
      status: "unread",
    },
    {
      id: "task-1",
      type: "task",
      title: "Task urgent",
      date: "2023-01-02T00:00:00.000Z",
      data: {
        priorite: "high",
        categorie: { nom: "CatB", couleur: "#ff0000" },
        responsable: { prenom: "Paul", nom: "Dupont" },
        echeance: "2023-02-01T00:00:00.000Z",
      },
      status: "En cours",
    },
  ];

  const mockUseEtablissementTimeline = vi.fn();

  const LOADING_RESULT = { data: undefined, isLoading: true, error: null };
  const ERROR_RESULT = { data: null, isLoading: false, error: { message: "x" } };
  const SUCCESS_RESULT = { data: TIMELINE_ITEMS, isLoading: false, error: null };

  return { mockFrom, mockUseEtablissementTimeline, LOADING_RESULT, ERROR_RESULT, SUCCESS_RESULT };
});

// Virtual mocks for alias modules and external UI/Icons
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mockFrom } }), { virtual: true });

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, ...props }: any) => (
    <div data-testid="card" {...props}>
      {children}
    </div>
  ),
}), { virtual: true });

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}), { virtual: true });

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}), { virtual: true });

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children }: any) => <div>{children}</div>,
  TabsList: ({ children }: any) => <div>{children}</div>,
  TabsTrigger: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
}), { virtual: true });

vi.mock("lucide-react", () => ({
  Mail: () => <span />,
  CheckCircle2: () => <span />,
  Clock: () => <span />,
  AlertCircle: () => <span />,
  Archive: () => <span />,
  Calendar: () => <span />,
  User: () => <span />,
  Building2: () => <span />,
  Loader2: () => <span data-testid="loader" />,
  MessageSquare: () => <span />,
  ListChecks: () => <span />,
  ArrowLeft: () => <span />,
}), { virtual: true });

vi.mock("@/hooks/crm/useEtablissementTimeline", () => ({
  useEtablissementTimeline: mockUseEtablissementTimeline,
}), { virtual: true });

vi.mock("@/lib/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}), { virtual: true });

vi.mock("@/lib/emailUtils", () => ({
  fixMalformedEncoding: (s: string) => s,
}), { virtual: true });

vi.mock("date-fns", () => ({
  formatDistanceToNow: () => "il y a un moment",
  format: () => "01 janv. 2023",
}), { virtual: true });

vi.mock("date-fns/locale", () => ({
  fr: {},
}), { virtual: true });

vi.mock("./EmailThread", () => ({
  EmailThread: () => <div data-testid="email-thread" />,
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("EtablissementTimelineView", () => {
  beforeEach(() => {
    mockUseEtablissementTimeline.mockReset();
  });

  it("should render loading state", async () => {
    mockUseEtablissementTimeline.mockReturnValue(LOADING_RESULT);
    const { EtablissementTimelineView } = await import("./EtablissementTimelineView");

    const onBack = vi.fn();
    render(
      <Wrapper>
        <EtablissementTimelineView
          etablissementId="etab-1"
          etablissementNom="Nom Établissement"
          etablissementVille="Ville"
          onBack={onBack}
        />
      </Wrapper>
    );

    expect(screen.getByTestId("loader")).toBeTruthy();
  });

  it("should render success state with items and allow opening email thread", async () => {
    mockUseEtablissementTimeline.mockReturnValue(SUCCESS_RESULT);
    const { EtablissementTimelineView } = await import("./EtablissementTimelineView");

    const onBack = vi.fn();
    render(
      <Wrapper>
        <EtablissementTimelineView
          etablissementId="etab-1"
          etablissementNom="Nom Établissement"
          etablissementVille="Ville"
          onBack={onBack}
        />
      </Wrapper>
    );

    // Titles
    expect(screen.getByText("Email important")).toBeTruthy();
    expect(screen.getByText("Task urgent")).toBeTruthy();

    // Tabs counts
    expect(screen.getByText(/Tout \(2\)/)).toBeTruthy();
    expect(screen.getByText(/Emails \(1\)/)).toBeTruthy();
    expect(screen.getByText(/Tâches \(1\)/)).toBeTruthy();

    // Email metadata
    expect(screen.getByText("3 messages")).toBeTruthy();
    expect(screen.getByText("CatA")).toBeTruthy();

    // Priority badges (both email and task have high priority)
    const priorityBadges = screen.getAllByText("Priorité haute");
    expect(priorityBadges.length).toBeGreaterThanOrEqual(2);

    // Click on the email card should open EmailThread
    const cards = screen.getAllByTestId("card");
    const emailCard = cards.find((el) => el.textContent?.includes("Email important"));
    expect(emailCard).toBeTruthy();
    if (emailCard) {
      fireEvent.click(emailCard);
    }
    expect(screen.getByTestId("email-thread")).toBeTruthy();
  });

  it("should render error state when fetch fails", async () => {
    mockUseEtablissementTimeline.mockReturnValue(ERROR_RESULT);
    const { EtablissementTimelineView } = await import("./EtablissementTimelineView");

    const onBack = vi.fn();
    render(
      <Wrapper>
        <EtablissementTimelineView
          etablissementId="etab-1"
          etablissementNom="Nom Établissement"
          etablissementVille="Ville"
          onBack={onBack}
        />
      </Wrapper>
    );

    expect(screen.getByText("Erreur lors du chargement de la timeline")).toBeTruthy();
  });
})