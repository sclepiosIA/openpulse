// @vitest-environment jsdom
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent } from "@testing-library/react";
import { renderHook, waitFor, act } from "@testing-library/react";
import { EmailSuggestionsPendingWidget } from "./EmailSuggestionsPendingWidget";

const {
  SUGGESTIONS,
  EMPTY_SUGGESTIONS,
  AUTH_STATE,
  acceptSuggestionMock,
  rejectSuggestionMock,
  mockUseEmailSuggestionsPending,
  mockUseEtablissementEmailSuggestions,
  mockFrom,
} = vi.hoisted(() => ({
  SUGGESTIONS: [
    { id: "c1", suggestion_type: "create_new", label: "Clinique Alpha" },
    { id: "c2", suggestion_type: "create_new", label: "Centre Beta" },
    { id: "c3", suggestion_type: "create_new", label: "Maison Gamma" },
    { id: "c4", suggestion_type: "create_new", label: "Hopital Delta" },
    { id: "l1", suggestion_type: "link_existing", label: "Lien A" },
    { id: "l2", suggestion_type: "link_existing", label: "Lien B" },
    { id: "d1", suggestion_type: "domain_match", label: "Domaine A" },
    { id: "m1", suggestion_type: "multi_entity", label: "Multi A" },
    { id: "r1", suggestion_type: "needs_review", label: "Review A" },
    { id: "o1", suggestion_type: "other_type", label: "Autre A" },
  ],
  EMPTY_SUGGESTIONS: [],
  AUTH_STATE: {
    user: { id: "u1", email: "test@example.com" },
    session: { user: { id: "u1" } },
    isLoading: false,
  },
  acceptSuggestionMock: vi.fn(),
  rejectSuggestionMock: vi.fn(),
  mockUseEmailSuggestionsPending: vi.fn(),
  mockUseEtablissementEmailSuggestions: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => {
  const createBuilder = () => {
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
      upsert: vi.fn(() => builder),
      single: vi.fn(async () => result),
      maybeSingle: vi.fn(async () => result),
      then: (onFulfilled: (value: typeof result) => unknown) => Promise.resolve(result).then(onFulfilled),
      catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
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
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        })),
      },
    },
  };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(() => AUTH_STATE),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(() => AUTH_STATE),
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: vi.fn(() => AUTH_STATE),
}));

vi.mock("@/hooks/email/useEmailSuggestionsPending", () => ({
  useEmailSuggestionsPending: mockUseEmailSuggestionsPending,
}));

vi.mock("@/hooks/crm/useEtablissementEmailSuggestions", () => ({
  useEtablissementEmailSuggestions: mockUseEtablissementEmailSuggestions,
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
}));

vi.mock("@/components/ui/collapsible", () => ({
  Collapsible: ({
    open,
    onOpenChange,
    children,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
  }) => <div data-testid="collapsible" data-open={String(open)} data-onopenchange={String(Boolean(onOpenChange))}>{children}</div>,
  CollapsibleTrigger: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <button type="button" className={className}>{children}</button>,
  CollapsibleContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <div>{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("lucide-react", () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />;
  return {
    AlertCircle: Icon,
    Loader2: Icon,
    ChevronDown: Icon,
    PlusCircle: Icon,
    Link: Icon,
    Mail: Icon,
    GitBranch: Icon,
  };
});

vi.mock("./EmailSuggestionCard", () => ({
  EmailSuggestionCard: ({
    suggestion,
    onAccept,
    onReject,
    isAccepting,
    isRejecting,
  }: {
    suggestion: { id: string; label: string };
    onAccept: (id: string) => void | Promise<void>;
    onReject: (id: string) => void | Promise<void>;
    isAccepting: boolean;
    isRejecting: boolean;
  }) => (
    <div data-testid="email-suggestion-card">
      <span>{suggestion.label}</span>
      <span>{suggestion.id}</span>
      <span>{String(isAccepting)}</span>
      <span>{String(isRejecting)}</span>
      <button type="button" onClick={() => onAccept(suggestion.id)}>accept-{suggestion.id}</button>
      <button type="button" onClick={() => onReject(suggestion.id)}>reject-{suggestion.id}</button>
    </div>
  ),
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

describe("EmailSuggestionsPendingWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    mockUseEtablissementEmailSuggestions.mockReturnValue({
      acceptSuggestion: acceptSuggestionMock,
      rejectSuggestion: rejectSuggestionMock,
      isAccepting: false,
      isRejecting: false,
    });
  });

  it("affiche un état de chargement puis les groupes de suggestions avec les bons compteurs métier", async () => {
    mockUseEmailSuggestionsPending
      .mockReturnValueOnce({
        data: EMPTY_SUGGESTIONS,
        isLoading: true,
        isError: false,
      })
      .mockReturnValue({
        data: SUGGESTIONS,
        isLoading: false,
        isError: false,
      });

    const { rerender } = render(<EmailSuggestionsPendingWidget />);

    expect(screen.getByTestId("card")).toBeInTheDocument();
    expect(screen.getAllByTestId("icon").length).toBeGreaterThan(0);
    expect(screen.queryByText("Suggestions d'établissements")).toBeNull();
    expect(screen.queryByText("10 suggestions en attente")).toBeNull();

    rerender(<EmailSuggestionsPendingWidget />);

    expect(screen.getByText("Suggestions d'établissements")).toBeInTheDocument();
    expect(screen.getByText("10 suggestions en attente")).toBeInTheDocument();
    expect(screen.getByText("Nouveaux établissements à créer (4)")).toBeInTheDocument();
    expect(screen.getByText("Emails à lier (2)")).toBeInTheDocument();
    expect(screen.getByText("Correspondances de domaine (1)")).toBeInTheDocument();
    expect(screen.getByText("Plusieurs entités détectées (1)")).toBeInTheDocument();
    expect(screen.getByText("À réviser manuellement (1)")).toBeInTheDocument();
    expect(screen.getByText("Autres suggestions (1)")).toBeInTheDocument();

    expect(screen.getByText("+1 autre")).toBeInTheDocument();
    expect(screen.getAllByTestId("email-suggestion-card")).toHaveLength(9);
    expect(screen.queryByText("Hopital Delta")).toBeNull();
    expect(screen.getByText("Clinique Alpha")).toBeInTheDocument();
    expect(screen.getByText("Centre Beta")).toBeInTheDocument();
    expect(screen.getByText("Maison Gamma")).toBeInTheDocument();
  });

  it("persiste l'état ouvert dans localStorage et déclenche les actions accepter/refuser", async () => {
    localStorage.setItem("ai-suggestions-widget-open", "true");

    mockUseEmailSuggestionsPending.mockReturnValue({
      data: SUGGESTIONS,
      isLoading: false,
      isError: false,
    });

    render(<EmailSuggestionsPendingWidget />);

    expect(screen.getByTestId("collapsible")).toHaveAttribute("data-open", "true");
    expect(screen.getByText("10 suggestions en attente")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "accept-c1" }));
      fireEvent.click(screen.getByRole("button", { name: "reject-l1" }));
    });

    expect(acceptSuggestionMock).toHaveBeenCalledWith("c1");
    expect(rejectSuggestionMock).toHaveBeenCalledWith("l1");
  });

  it("ne rend rien quand il n'y a aucune suggestion", () => {
    mockUseEmailSuggestionsPending.mockReturnValue({
      data: EMPTY_SUGGESTIONS,
      isLoading: false,
      isError: false,
    });

    const { container } = render(<EmailSuggestionsPendingWidget />);
    expect(container.firstChild).toBeNull();
  });

  it("couvre le hook mocké en chargement, succès et erreur avec renderHook dans QueryClientProvider", async () => {
    const wrapper = createWrapper();

    mockUseEmailSuggestionsPending
      .mockReturnValueOnce({
        data: EMPTY_SUGGESTIONS,
        isLoading: true,
        isError: false,
      })
      .mockReturnValueOnce({
        data: SUGGESTIONS,
        isLoading: false,
        isError: false,
      })
      .mockReturnValueOnce({
        data: null,
        isLoading: false,
        isError: true,
        error: { message: "x" },
      });

    const loadingHook = renderHook(() => mockUseEmailSuggestionsPending(), { wrapper });
    expect(loadingHook.result.current.isLoading).toBe(true);
    expect(loadingHook.result.current.data).toEqual(EMPTY_SUGGESTIONS);

    const successHook = renderHook(() => mockUseEmailSuggestionsPending(), { wrapper });
    await waitFor(() => {
      expect(successHook.result.current.isLoading).toBe(false);
    });
    expect(successHook.result.current.isError).toBe(false);
    expect(successHook.result.current.data).toEqual(SUGGESTIONS);
    expect(successHook.result.current.data[0].suggestion_type).toBe("create_new");

    const errorHook = renderHook(() => mockUseEmailSuggestionsPending(), { wrapper });
    await waitFor(() => {
      expect(errorHook.result.current.isError).toBe(true);
    });
    expect(errorHook.result.current.data).toBeNull();
    expect(errorHook.result.current.error).toEqual({ message: "x" });
  });
});