import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GroupeEmailsTab } from "./GroupeEmailsTab";

const {
  authState,
  navigateMock,
  toastSuccess,
  toastError,
  inboxPropsSpy,
  threadPropsSpy,
} = vi.hoisted(() => ({
  authState: {
    user: { id: "u1", email: "t@t.co" },
    session: { user: { id: "u1" } },
    isLoading: false,
  },
  navigateMock: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  inboxPropsSpy: vi.fn(),
  threadPropsSpy: vi.fn(),
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
    then: (onFulfilled: (value: { data: null; error: null }) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).catch(onRejected),
  };
  return {
    supabase: {
      from: vi.fn(() => builder),
      auth: {
        getSession: vi.fn(async () => ({ data: { session: authState.session }, error: null })),
        getUser: vi.fn(async () => ({ data: { user: authState.user }, error: null })),
      },
    },
  };
});

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => authState,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => authState,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock("lucide-react", () => ({
  X: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-x" {...props} />,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({
    children,
    className,
  }: {
    children?: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="scroll-area" className={className}>
      {children}
    </div>
  ),
}));

vi.mock("@/components/ui/resizable", () => ({
  ResizablePanelGroup: ({
    children,
    direction,
    className,
  }: {
    children?: React.ReactNode;
    direction: string;
    className?: string;
  }) => (
    <div data-testid="resizable-group" data-direction={direction} className={className}>
      {children}
    </div>
  ),
  ResizablePanel: ({
    children,
    className,
    defaultSize,
    minSize,
    maxSize,
  }: {
    children?: React.ReactNode;
    className?: string;
    defaultSize?: number;
    minSize?: number;
    maxSize?: number;
  }) => (
    <div
      data-testid="resizable-panel"
      data-default-size={defaultSize}
      data-min-size={minSize}
      data-max-size={maxSize}
      className={className}
    >
      {children}
    </div>
  ),
  ResizableHandle: ({ withHandle }: { withHandle?: boolean }) => (
    <div data-testid="resizable-handle" data-with-handle={String(withHandle)} />
  ),
}));

vi.mock("@/contexts/EmailFiltersContext", () => ({
  EmailFiltersProvider: ({
    children,
    initialFilters,
  }: {
    children?: React.ReactNode;
    initialFilters: { groupeId: string };
  }) => (
    <div data-testid="email-filters-provider" data-groupe-id={initialFilters.groupeId}>
      {children}
    </div>
  ),
}));

vi.mock("@/components/email/EmailInbox", () => ({
  EmailInbox: ({
    onThreadSelect,
    accountId,
  }: {
    onThreadSelect: (threadId: string) => void;
    accountId: string;
  }) => {
    inboxPropsSpy({ accountId });
    return (
      <div data-testid="email-inbox">
        <div>Compte: {accountId}</div>
        <button onClick={() => onThreadSelect("thread-42")}>Ouvrir thread 42</button>
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
    return (
      <div data-testid="email-thread">
        <div>Thread: {threadId}</div>
        <div>Embedded: {String(embedded)}</div>
        <button onClick={onBack}>Retour</button>
      </div>
    );
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

describe("GroupeEmailsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rend la liste initiale avec le provider de filtres et transmet les props métier à EmailInbox", () => {
    const Wrapper = createWrapper();

    render(<GroupeEmailsTab groupeId="g-123" groupeNom="Groupe A" />, {
      wrapper: Wrapper,
    });

    expect(screen.getByTestId("email-filters-provider")).toHaveAttribute("data-groupe-id", "g-123");
    expect(screen.getByTestId("email-inbox")).toBeInTheDocument();
    expect(screen.queryByTestId("email-thread")).not.toBeInTheDocument();
    expect(inboxPropsSpy).toHaveBeenCalledWith({ accountId: "all" });
    expect(screen.getByText("Compte: all")).toBeInTheDocument();
    expect(screen.queryByLabelText("Fermer la conversation")).not.toBeInTheDocument();
  });

  it("ouvre une conversation dans le panneau détaillé avec les bonnes props", () => {
    const Wrapper = createWrapper();

    render(<GroupeEmailsTab groupeId="g-123" />, {
      wrapper: Wrapper,
    });

    fireEvent.click(screen.getByRole("button", { name: "Ouvrir thread 42" }));

    expect(screen.getByTestId("resizable-group")).toHaveAttribute("data-direction", "horizontal");
    expect(screen.getAllByTestId("resizable-panel")).toHaveLength(2);
    expect(screen.getByTestId("resizable-handle")).toBeInTheDocument();
    expect(screen.getByTestId("email-thread")).toBeInTheDocument();
    expect(screen.getByText("Thread: thread-42")).toBeInTheDocument();
    expect(screen.getByText("Embedded: true")).toBeInTheDocument();
    expect(threadPropsSpy).toHaveBeenCalledWith({ threadId: "thread-42", embedded: true });
    expect(screen.getByLabelText("Fermer la conversation")).toBeInTheDocument();
  });

  it("ferme la conversation via le bouton de fermeture et revient à la liste seule", () => {
    const Wrapper = createWrapper();

    render(<GroupeEmailsTab groupeId="g-123" />, {
      wrapper: Wrapper,
    });

    fireEvent.click(screen.getByRole("button", { name: "Ouvrir thread 42" }));
    expect(screen.getByTestId("email-thread")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Fermer la conversation"));

    expect(screen.queryByTestId("email-thread")).not.toBeInTheDocument();
    expect(screen.queryByTestId("resizable-group")).not.toBeInTheDocument();
    expect(screen.getByTestId("email-inbox")).toBeInTheDocument();
  });

  it("ferme aussi la conversation via le callback onBack du thread", () => {
    const Wrapper = createWrapper();

    render(<GroupeEmailsTab groupeId="g-123" />, {
      wrapper: Wrapper,
    });

    fireEvent.click(screen.getByRole("button", { name: "Ouvrir thread 42" }));
    expect(screen.getByText("Thread: thread-42")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retour" }));

    expect(screen.queryByText("Thread: thread-42")).not.toBeInTheDocument();
    expect(screen.getByTestId("email-inbox")).toBeInTheDocument();
  });
});