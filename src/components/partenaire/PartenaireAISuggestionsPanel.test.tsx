import { ReactElement } from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PartenaireAISuggestionsPanel } from "./PartenaireAISuggestionsPanel";

const { MOCK_SUGGESTIONS, mockUsePartenaireAISuggestions } = vi.hoisted(() => {
  const MOCK_SUGGESTIONS = [
    {
      id: "s1",
      action_type: "send_email_response",
      action_data: {
        subject: "Sujet important pour le partenaire",
      },
      confidence_score: 0.87,
      reason: "Basé sur les dernières interactions email",
      created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    },
    {
      id: "s2",
      action_type: "update_engagement_score",
      action_data: {
        new_score: 78,
      },
      confidence_score: 0.65,
      reason: "Baisse d'activité récente",
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
  ];

  const mockUsePartenaireAISuggestions = vi.fn();

  return { MOCK_SUGGESTIONS, mockUsePartenaireAISuggestions };
});

vi.mock("@/hooks/crm/usePartenaireAISuggestions", () => ({
  usePartenaireAISuggestions: mockUsePartenaireAISuggestions,
}));

vi.mock("@/components/ui/card", () => {
  const Card = ({ children, ...props }: { children: ReactElement | ReactElement[] }) => (
    <div data-testid="card" {...props}>
      {children}
    </div>
  );
  const CardHeader = ({ children, ...props }: { children: ReactElement | ReactElement[] }) => (
    <div data-testid="card-header" {...props}>
      {children}
    </div>
  );
  const CardTitle = ({ children, ...props }: { children: ReactElement | ReactElement[] }) => (
    <h2 data-testid="card-title" {...props}>
      {children}
    </h2>
  );
  const CardContent = ({ children, ...props }: { children: ReactElement | ReactElement[] }) => (
    <div data-testid="card-content" {...props}>
      {children}
    </div>
  );
  return { Card, CardHeader, CardTitle, CardContent };
});

vi.mock("@/components/ui/badge", () => {
  const Badge = ({ children, ...props }: { children: ReactElement | ReactElement[] }) => (
    <span data-testid="badge" {...props}>
      {children}
    </span>
  );
  return { Badge };
});

vi.mock("@/components/ui/button", () => {
  const Button = ({ children, ...props }: { children: ReactElement | ReactElement[] }) => (
    <button {...props}>{children}</button>
  );
  return { Button };
});

vi.mock("@/components/ui/collapsible", () => {
  const Collapsible = ({
    children,
    open,
    onOpenChange,
  }: {
    children: ReactElement | ReactElement[];
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => (
    <div
      data-testid="collapsible"
      data-open={open ? "true" : "false"}
      onClick={() => {
        if (onOpenChange) onOpenChange(!open);
      }}
    >
      {children}
    </div>
  );

  const CollapsibleTrigger = ({
    children,
    ...props
  }: {
    children: ReactElement | ReactElement[];
  }) => (
    <button data-testid="collapsible-trigger" {...props}>
      {children}
    </button>
  );

  const CollapsibleContent = ({
    children,
    ...props
  }: {
    children: ReactElement | ReactElement[];
  }) => (
    <div data-testid="collapsible-content" {...props}>
      {children}
    </div>
  );

  return { Collapsible, CollapsibleTrigger, CollapsibleContent };
});

vi.mock("lucide-react", () => {
  const Icon = (props: unknown) => <span data-testid="icon" {...props} />;
  return {
    CheckCircle: Icon,
    XCircle: Icon,
    Sparkles: Icon,
    FileText: Icon,
    TrendingUp: Icon,
    ChevronDown: Icon,
    Mail: Icon,
    Clock: Icon,
    BarChart: Icon,
    Users: Icon,
    DollarSign: Icon,
  };
});

vi.mock("date-fns", async (origImport) => {
  const actual = (await origImport()) as typeof import("date-fns");
  return {
    ...actual,
    formatDistanceToNow: (date: Date) => {
      const diff = Date.now() - date.getTime();
      const hours = Math.round(diff / (60 * 60 * 1000));
      return `${hours} heures`;
    },
  };
});

vi.mock("date-fns/locale", () => ({
  fr: {},
}));

function createWrapper(children: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("PartenaireAISuggestionsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const store = new Map<string, string | null>();
    vi.spyOn(window, "localStorage", "get").mockReturnValue({
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
      key: (index: number) => Array.from(store.keys())[index] ?? null,
      length: store.size,
    } as unknown as Storage);
  });

  it("affiche l'état de chargement quand isLoading est true", () => {
    mockUsePartenaireAISuggestions.mockReturnValue({
      suggestions: [],
      isLoading: true,
      isApproving: false,
      isRejecting: false,
      approveSuggestion: vi.fn(),
      rejectSuggestion: vi.fn(),
    });

    render(createWrapper(<PartenaireAISuggestionsPanel partenaireId="p1" />));

    expect(
      screen.getByText("Suggestions IA CRM")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Chargement...")
    ).toBeInTheDocument();
  });

  it("ne rend rien quand il n'y a aucune suggestion", () => {
    mockUsePartenaireAISuggestions.mockReturnValue({
      suggestions: [],
      isLoading: false,
      isApproving: false,
      isRejecting: false,
      approveSuggestion: vi.fn(),
      rejectSuggestion: vi.fn(),
    });

    const { container } = render(
      createWrapper(<PartenaireAISuggestionsPanel partenaireId="p1" />)
    );

    expect(container.firstChild).toBeNull();
  });

  it("affiche les suggestions avec les informations métier et permet de les approuver ou rejeter", () => {
    const approveSuggestion = vi.fn();
    const rejectSuggestion = vi.fn();

    mockUsePartenaireAISuggestions.mockReturnValue({
      suggestions: MOCK_SUGGESTIONS,
      isLoading: false,
      isApproving: false,
      isRejecting: false,
      approveSuggestion,
      rejectSuggestion,
    });

    render(createWrapper(<PartenaireAISuggestionsPanel partenaireId="p1" />));

    expect(
      screen.getByText("2 Suggestions IA CRM en attente")
    ).toBeInTheDocument();

    const subjectSnippet = `${MOCK_SUGGESTIONS[0].action_data.subject.substring(
      0,
      60
    )}...`;
    expect(
      screen.getByText(`Envoyer : "${subjectSnippet}"`)
    ).toBeInTheDocument();

    expect(
      screen.getByText("Score : 78/100")
    ).toBeInTheDocument();

    expect(
      screen.getByText("87% confiance")
    ).toBeInTheDocument();
    expect(
      screen.getByText("65% confiance")
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Basé sur les dernières interactions email/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Baisse d'activité récente/)
    ).toBeInTheDocument();

    expect(
      screen.getAllByText(/Suggéré \d+ heures/).length
    ).toBeGreaterThanOrEqual(2);

    const applyButtons = screen.getAllByRole("button", { name: /Appliquer/ });
    const ignoreButtons = screen.getAllByRole("button", { name: /Ignorer/ });

    expect(applyButtons.length).toBe(2);
    expect(ignoreButtons.length).toBe(2);

    fireEvent.click(applyButtons[0]);
    fireEvent.click(ignoreButtons[1]);

    expect(approveSuggestion).toHaveBeenCalledWith("s1");
    expect(rejectSuggestion).toHaveBeenCalledWith("s2");
  });

  it("désactive les boutons lorsque isApproving ou isRejecting est true", () => {
    mockUsePartenaireAISuggestions.mockReturnValue({
      suggestions: MOCK_SUGGESTIONS,
      isLoading: false,
      isApproving: true,
      isRejecting: false,
      approveSuggestion: vi.fn(),
      rejectSuggestion: vi.fn(),
    });

    render(createWrapper(<PartenaireAISuggestionsPanel partenaireId="p1" />));

    const buttons = screen.getAllByRole("button");
    buttons.forEach((btn) => {
      if (btn.textContent?.includes("Appliquer") || btn.textContent?.includes("Ignorer")) {
        expect(btn).toBeDisabled();
      }
    });
  });

  it("persiste l'état ouvert/fermé dans le localStorage", () => {
    mockUsePartenaireAISuggestions.mockReturnValue({
      suggestions: MOCK_SUGGESTIONS.slice(0, 1),
      isLoading: false,
      isApproving: false,
      isRejecting: false,
      approveSuggestion: vi.fn(),
      rejectSuggestion: vi.fn(),
    });

    render(createWrapper(<PartenaireAISuggestionsPanel partenaireId="p1" />));

    const trigger = screen.getByTestId("collapsible-trigger");

    act(() => {
      fireEvent.click(trigger);
    });

    const stored = window.localStorage.getItem(
      "partenaire-ai-suggestions-panel-open"
    );
    expect(stored).toBe("true");

    act(() => {
      fireEvent.click(trigger);
    });

    const storedAfter = window.localStorage.getItem(
      "partenaire-ai-suggestions-panel-open"
    );
    expect(storedAfter).toBe("false");
  });
});