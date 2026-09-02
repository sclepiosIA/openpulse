// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EtablissementEmailsTab } from "./EtablissementEmailsTab";

const {
  AUTH_STATE,
  mockNavigate,
  mockToastSuccess,
  mockToastError,
  inboxRenderState,
  timelineRenderState,
  threadRenderState,
  providerPropsSpy,
  inboxPropsSpy,
  timelinePropsSpy,
  threadPropsSpy,
  buttonPropsSpy,
  scrollAreaPropsSpy,
  resizableGroupPropsSpy,
  resizablePanelPropsSpy,
  resizableHandlePropsSpy,
  mockFrom,
  builder,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: "u1", email: "user@test.dev" },
    session: { user: { id: "u1" } },
    isLoading: false,
  };

  const mockNavigate = vi.fn();
  const mockToastSuccess = vi.fn();
  const mockToastError = vi.fn();

  const inboxRenderState = {
    mode: "success" as "loading" | "success" | "error",
    selectThreadId: "thread-42",
    title: "Inbox prête",
    errorMessage: "inbox error",
  };

  const timelineRenderState = {
    mode: "success" as "loading" | "success" | "error",
    selectThreadId: "timeline-9",
    title: "Timeline prête",
    errorMessage: "timeline error",
  };

  const threadRenderState = {
    mode: "success" as "loading" | "success" | "error",
    title: "Conversation ouverte",
    errorMessage: "thread error",
  };

  const providerPropsSpy = vi.fn();
  const inboxPropsSpy = vi.fn();
  const timelinePropsSpy = vi.fn();
  const threadPropsSpy = vi.fn();
  const buttonPropsSpy = vi.fn();
  const scrollAreaPropsSpy = vi.fn();
  const resizableGroupPropsSpy = vi.fn();
  const resizablePanelPropsSpy = vi.fn();
  const resizableHandlePropsSpy = vi.fn();

  const builderBase = {
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    upsert: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    then: vi.fn(),
    catch: vi.fn(),
  };

  const builder = builderBase as unknown as Record<string, ReturnType<typeof vi.fn>>;
  Object.values(builder).forEach((fn) => {
    fn.mockImplementation(() => builder);
  });
  builder.single.mockResolvedValue({ data: null, error: null });
  builder.maybeSingle.mockResolvedValue({ data: null, error: null });
  builder.then.mockImplementation((resolve: (v: { data: null; error: null }) => void) => Promise.resolve(resolve({ data: null, error: null })));
  builder.catch.mockImplementation(() => Promise.resolve({ data: null, error: null }));

  const mockFrom = vi.fn(() => builder);

  return {
    AUTH_STATE,
    mockNavigate,
    mockToastSuccess,
    mockToastError,
    inboxRenderState,
    timelineRenderState,
    threadRenderState,
    providerPropsSpy,
    inboxPropsSpy,
    timelinePropsSpy,
    threadPropsSpy,
    buttonPropsSpy,
    scrollAreaPropsSpy,
    resizableGroupPropsSpy,
    resizablePanelPropsSpy,
    resizableHandlePropsSpy,
    mockFrom,
    builder,
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
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

vi.mock("@/lib/utils", () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => {
    buttonPropsSpy(props);
    return <button {...props}>{children}</button>;
  },
}));

vi.mock("@/contexts/EmailFiltersContext", () => ({
  EmailFiltersProvider: ({
    children,
    initialFilters,
  }: {
    children: React.ReactNode;
    initialFilters: { etablissementId: string };
  }) => {
    providerPropsSpy(initialFilters);
    return <div data-testid="email-filters-provider">{children}</div>;
  },
}));

vi.mock("@/components/email/EmailInbox", () => ({
  EmailInbox: ({
    onThreadSelect,
    accountId,
    toolbarPrefixSlot,
  }: {
    onThreadSelect: (id: string) => void;
    accountId: string;
    toolbarPrefixSlot?: React.ReactNode;
  }) => {
    inboxPropsSpy({ accountId });
    if (inboxRenderState.mode === "loading") {
      return (
        <div>
          <div data-testid="inbox-loading">Chargement des emails</div>
          {toolbarPrefixSlot}
        </div>
      );
    }
    if (inboxRenderState.mode === "error") {
      return (
        <div>
          <div data-testid="inbox-error">Erreur: {inboxRenderState.errorMessage}</div>
          {toolbarPrefixSlot}
        </div>
      );
    }
    return (
      <div>
        <div data-testid="inbox-success">{inboxRenderState.title}</div>
        {toolbarPrefixSlot}
        <button onClick={() => onThreadSelect(inboxRenderState.selectThreadId)}>Ouvrir le thread inbox</button>
      </div>
    );
  },
}));

vi.mock("@/components/email/EmailTimeline", () => ({
  EmailTimeline: ({
    etablissementId,
    etablissementNom,
    onThreadSelect,
  }: {
    etablissementId: string;
    etablissementNom: string;
    onThreadSelect: (id: string) => void;
  }) => {
    timelinePropsSpy({ etablissementId, etablissementNom });
    if (timelineRenderState.mode === "loading") {
      return <div data-testid="timeline-loading">Chargement timeline</div>;
    }
    if (timelineRenderState.mode === "error") {
      return <div data-testid="timeline-error">Erreur: {timelineRenderState.errorMessage}</div>;
    }
    return (
      <div>
        <div data-testid="timeline-success">{timelineRenderState.title}</div>
        <button onClick={() => onThreadSelect(timelineRenderState.selectThreadId)}>Ouvrir le thread timeline</button>
      </div>
    );
  },
}));

vi.mock("@/components/email/EmailThread", () => ({
  EmailThread: ({
    threadId,
    onBack,
    embedded,
  }: {
    threadId: string;
    onBack: () => void;
    embedded?: boolean;
  }) => {
    threadPropsSpy({ threadId, embedded });
    if (threadRenderState.mode === "loading") {
      return <div data-testid="thread-loading">Chargement conversation</div>;
    }
    if (threadRenderState.mode === "error") {
      return (
        <div>
          <div data-testid="thread-error">Erreur: {threadRenderState.errorMessage}</div>
          <button onClick={onBack}>Retour thread</button>
        </div>
      );
    }
    return (
      <div>
        <div data-testid="thread-success">
          {threadRenderState.title} - {threadId} - {embedded ? "embedded" : "not-embedded"}
        </div>
        <button onClick={onBack}>Retour thread</button>
      </div>
    );
  },
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) => {
    scrollAreaPropsSpy({ className });
    return <div data-testid="scroll-area">{children}</div>;
  },
}));

vi.mock("@/components/ui/resizable", () => ({
  ResizablePanelGroup: ({
    children,
    direction,
    className,
  }: {
    children: React.ReactNode;
    direction: string;
    className?: string;
  }) => {
    resizableGroupPropsSpy({ direction, className });
    return <div data-testid="resizable-group">{children}</div>;
  },
  ResizablePanel: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    defaultSize?: number;
    minSize?: number;
    maxSize?: number;
    className?: string;
  }) => {
    resizablePanelPropsSpy(props);
    return <div data-testid="resizable-panel">{children}</div>;
  },
  ResizableHandle: (props: { withHandle?: boolean }) => {
    resizableHandlePropsSpy(props);
    return <div data-testid="resizable-handle" />;
  },
}));

vi.mock("lucide-react", () => ({
  List: () => <svg data-testid="icon-list" />,
  Clock: () => <svg data-testid="icon-clock" />,
  X: () => <svg data-testid="icon-x" />,
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

describe("EtablissementEmailsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    inboxRenderState.mode = "success";
    inboxRenderState.selectThreadId = "thread-42";
    inboxRenderState.title = "Inbox prête";
    inboxRenderState.errorMessage = "inbox error";

    timelineRenderState.mode = "success";
    timelineRenderState.selectThreadId = "timeline-9";
    timelineRenderState.title = "Timeline prête";
    timelineRenderState.errorMessage = "timeline error";

    threadRenderState.mode = "success";
    threadRenderState.title = "Conversation ouverte";
    threadRenderState.errorMessage = "thread error";
  });

  it("affiche la vue liste par défaut et fournit le filtre d'établissement", () => {
    const Wrapper = createWrapper();

    render(<EtablissementEmailsTab etablissementId="eta-1" etablissementNom="Clinique des Fleurs" />, {
      wrapper: Wrapper,
    });

    expect(providerPropsSpy).toHaveBeenCalledWith({ etablissementId: "eta-1" });
    expect(screen.getByTestId("inbox-success")).toHaveTextContent("Inbox prête");
    expect(inboxPropsSpy).toHaveBeenCalledWith({ accountId: "all" });
    expect(screen.getByRole("button", { name: "Liste" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Timeline" })).toBeInTheDocument();
    expect(screen.queryByTestId("timeline-success")).not.toBeInTheDocument();
  });

  it("affiche un état de chargement via EmailInbox puis le contenu attendu", () => {
    const Wrapper = createWrapper();
    inboxRenderState.mode = "loading";

    const { rerender } = render(
      <EtablissementEmailsTab etablissementId="eta-2" etablissementNom="Centre Atlas" />,
      { wrapper: Wrapper }
    );

    expect(screen.getByTestId("inbox-loading")).toHaveTextContent("Chargement des emails");

    inboxRenderState.mode = "success";
    rerender(<EtablissementEmailsTab etablissementId="eta-2" etablissementNom="Centre Atlas" />);

    expect(screen.getByTestId("inbox-success")).toHaveTextContent("Inbox prête");
    expect(screen.getByRole("button", { name: "Ouvrir le thread inbox" })).toBeInTheDocument();
  });

  it("affiche un état d'erreur de la liste", () => {
    const Wrapper = createWrapper();
    inboxRenderState.mode = "error";
    inboxRenderState.errorMessage = "x";

    render(<EtablissementEmailsTab etablissementId="eta-3" etablissementNom="Maison Bleue" />, {
      wrapper: Wrapper,
    });

    expect(screen.getByTestId("inbox-error")).toHaveTextContent("Erreur: x");
  });

  it("bascule vers la timeline et transmet l'identité de l'établissement", () => {
    const Wrapper = createWrapper();

    render(<EtablissementEmailsTab etablissementId="eta-4" etablissementNom="Hôpital Nord" />, {
      wrapper: Wrapper,
    });

    fireEvent.click(screen.getByRole("button", { name: "Timeline" }));

    expect(screen.getByTestId("timeline-success")).toHaveTextContent("Timeline prête");
    expect(timelinePropsSpy).toHaveBeenCalledWith({
      etablissementId: "eta-4",
      etablissementNom: "Hôpital Nord",
    });
  });

  it("utilise le nom par défaut dans la timeline si etablissementNom est absent", () => {
    const Wrapper = createWrapper();

    render(<EtablissementEmailsTab etablissementId="eta-5" />, {
      wrapper: Wrapper,
    });

    fireEvent.click(screen.getByRole("button", { name: "Timeline" }));

    expect(timelinePropsSpy).toHaveBeenCalledWith({
      etablissementId: "eta-5",
      etablissementNom: "Établissement",
    });
  });

  it("ouvre un thread depuis la liste puis permet de le fermer", () => {
    const Wrapper = createWrapper();

    render(<EtablissementEmailsTab etablissementId="eta-6" etablissementNom="Clinique Ouest" />, {
      wrapper: Wrapper,
    });

    fireEvent.click(screen.getByRole("button", { name: "Ouvrir le thread inbox" }));

    expect(screen.getByTestId("resizable-group")).toBeInTheDocument();
    expect(screen.getByTestId("resizable-handle")).toBeInTheDocument();
    expect(threadPropsSpy).toHaveBeenCalledWith({ threadId: "thread-42", embedded: true });
    expect(screen.getByTestId("thread-success")).toHaveTextContent("Conversation ouverte - thread-42 - embedded");
    expect(resizableGroupPropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({ direction: "horizontal" })
    );

    fireEvent.click(screen.getByRole("button", { name: "Fermer la conversation" }));

    expect(screen.queryByTestId("thread-success")).not.toBeInTheDocument();
    expect(screen.queryByTestId("resizable-group")).not.toBeInTheDocument();
    expect(screen.getByTestId("inbox-success")).toBeInTheDocument();
  });

  it("ouvre un thread depuis la timeline", () => {
    const Wrapper = createWrapper();

    render(<EtablissementEmailsTab etablissementId="eta-7" etablissementNom="Polyclinique Sud" />, {
      wrapper: Wrapper,
    });

    fireEvent.click(screen.getByRole("button", { name: "Timeline" }));
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir le thread timeline" }));

    expect(threadPropsSpy).toHaveBeenCalledWith({ threadId: "timeline-9", embedded: true });
    expect(screen.getByTestId("thread-success")).toHaveTextContent("Conversation ouverte - timeline-9 - embedded");
    expect(screen.getByTestId("timeline-success")).toBeInTheDocument();
  });

  it("affiche un état d'erreur de timeline", () => {
    const Wrapper = createWrapper();
    timelineRenderState.mode = "error";
    timelineRenderState.errorMessage = "x";

    render(<EtablissementEmailsTab etablissementId="eta-8" etablissementNom="Maison Verte" />, {
      wrapper: Wrapper,
    });

    fireEvent.click(screen.getByRole("button", { name: "Timeline" }));

    expect(screen.getByTestId("timeline-error")).toHaveTextContent("Erreur: x");
  });
});