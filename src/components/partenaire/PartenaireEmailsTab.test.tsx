import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const {
  authState,
  toast,
  navigateMock,
  emailInboxState,
  emailThreadState,
  inboxPropsCalls,
  threadPropsCalls,
  lastEmailFiltersProviderProps,
  resizableCalls,
} = vi.hoisted(() => {
  const authState = {
    user: { id: "u1", email: "t@t.co" },
    session: { user: { id: "u1" } },
    isLoading: false,
  };

  const toast = {
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  };

  const navigateMock = vi.fn();

  const emailInboxState: { mode: "loading" | "success" | "error" } = { mode: "success" };
  const emailThreadState: { mode: "loading" | "success" | "error" } = { mode: "success" };

  const inboxPropsCalls: Array<{ onThreadSelect: (id: string) => void; accountId: string }> = [];
  const threadPropsCalls: Array<{ threadId: string; onBack: () => void; embedded?: boolean }> = [];

  const lastEmailFiltersProviderProps: {
    initialFilters?: { partenaireId?: string };
  } = {};

  const resizableCalls: {
    groups: Array<{ direction: string; className?: string }>;
    panels: Array<{ defaultSize?: number; minSize?: number; maxSize?: number; className?: string }>;
    handles: Array<{ withHandle?: boolean }>;
  } = { groups: [], panels: [], handles: [] };

  return {
    authState,
    toast,
    navigateMock,
    emailInboxState,
    emailThreadState,
    inboxPropsCalls,
    threadPropsCalls,
    lastEmailFiltersProviderProps,
    resizableCalls,
  };
});

vi.mock("lucide-react", () => ({
  X: () => React.createElement("svg", { "data-testid": "icon-x" }),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement>>) =>
    React.createElement("button", props, children),
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement("div", { ...props, "data-testid": "scroll-area" }, children),
}));

vi.mock("@/components/ui/resizable", () => ({
  ResizablePanelGroup: ({ children, direction, className }: React.PropsWithChildren<{ direction: string; className?: string }>) => {
    resizableCalls.groups.push({ direction, className });
    return React.createElement("div", { "data-testid": "resizable-group", "data-direction": direction, className }, children);
  },
  ResizablePanel: ({
    children,
    defaultSize,
    minSize,
    maxSize,
    className,
  }: React.PropsWithChildren<{ defaultSize?: number; minSize?: number; maxSize?: number; className?: string }>) => {
    resizableCalls.panels.push({ defaultSize, minSize, maxSize, className });
    return React.createElement(
      "div",
      {
        "data-testid": "resizable-panel",
        "data-default-size": defaultSize == null ? "" : String(defaultSize),
        "data-min-size": minSize == null ? "" : String(minSize),
        "data-max-size": maxSize == null ? "" : String(maxSize),
        className,
      },
      children
    );
  },
  ResizableHandle: ({ withHandle }: { withHandle?: boolean }) => {
    resizableCalls.handles.push({ withHandle });
    return React.createElement("div", { "data-testid": "resizable-handle", "data-with-handle": withHandle ? "1" : "0" });
  },
}));

vi.mock("@/contexts/EmailFiltersContext", () => ({
  EmailFiltersProvider: ({
    children,
    initialFilters,
  }: React.PropsWithChildren<{
    initialFilters?: { partenaireId?: string };
  }>) => {
    lastEmailFiltersProviderProps.initialFilters = initialFilters;
    return React.createElement(React.Fragment, null, children);
  },
}));

vi.mock("@/components/email/EmailInbox", () => ({
  EmailInbox: (props: { onThreadSelect: (id: string) => void; accountId: string }) => {
    inboxPropsCalls.push(props);

    if (emailInboxState.mode === "loading") {
      return React.createElement("div", { "data-testid": "email-inbox-loading" }, "Chargement…");
    }

    if (emailInboxState.mode === "error") {
      return React.createElement("div", { "data-testid": "email-inbox-error" }, "Erreur inbox");
    }

    return React.createElement(
      "div",
      { "data-testid": "email-inbox" },
      React.createElement("div", { "data-testid": "email-inbox-account" }, props.accountId),
      React.createElement(
        "button",
        {
          type: "button",
          onClick: () => props.onThreadSelect("th_1"),
        },
        "Ouvrir thread th_1"
      )
    );
  },
}));

vi.mock("@/components/email/EmailThread", () => ({
  EmailThread: (props: { threadId: string; onBack: () => void; embedded?: boolean }) => {
    threadPropsCalls.push(props);

    if (emailThreadState.mode === "loading") {
      return React.createElement("div", { "data-testid": "email-thread-loading" }, "Chargement thread…");
    }

    if (emailThreadState.mode === "error") {
      return React.createElement("div", { "data-testid": "email-thread-error" }, "Erreur thread");
    }

    return React.createElement(
      "div",
      { "data-testid": "email-thread" },
      React.createElement("div", { "data-testid": "email-thread-id" }, props.threadId),
      React.createElement(
        "button",
        { type: "button", onClick: props.onBack },
        "Retour"
      )
    );
  },
}));

vi.mock("sonner", () => ({
  toast,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
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

vi.mock("@/hooks/useAdminRole", () => ({
  useAdminRole: () => ({ isAdmin: true, isLoading: false }),
}));

const { supabaseMockFrom } = vi.hoisted(() => {
  type SupabaseError = { message: string };
  type SupabaseResult<T> = { data: T | null; error: SupabaseError | null };

  const makeThenableBuilder = () => {
    let resolved: SupabaseResult<unknown> = { data: null, error: null };

    const builder: Record<string, unknown> = {
      _setResolved: (r: SupabaseResult<unknown>) => {
        resolved = r;
        return builder;
      },
      select: () => builder,
      eq: () => builder,
      neq: () => builder,
      gt: () => builder,
      gte: () => builder,
      lt: () => builder,
      lte: () => builder,
      like: () => builder,
      ilike: () => builder,
      in: () => builder,
      contains: () => builder,
      containedBy: () => builder,
      is: () => builder,
      order: () => builder,
      range: () => builder,
      limit: () => builder,
      insert: () => builder,
      upsert: () => builder,
      update: () => builder,
      delete: () => builder,
      throwOnError: () => builder,
      single: () => Promise.resolve(resolved),
      maybeSingle: () => Promise.resolve(resolved),
      then: (onFulfilled: (v: SupabaseResult<unknown>) => unknown, onRejected?: (e: unknown) => unknown) =>
        Promise.resolve(resolved).then(onFulfilled, onRejected),
      catch: (onRejected: (e: unknown) => unknown) => Promise.resolve(resolved).catch(onRejected),
      finally: (onFinally: () => void) => Promise.resolve(resolved).finally(onFinally),
    };

    return builder as unknown as {
      _setResolved: (r: SupabaseResult<unknown>) => unknown;
      select: (...args: unknown[]) => unknown;
      eq: (...args: unknown[]) => unknown;
      gte: (...args: unknown[]) => unknown;
      lte: (...args: unknown[]) => unknown;
      in: (...args: unknown[]) => unknown;
      order: (...args: unknown[]) => unknown;
      limit: (...args: unknown[]) => unknown;
      insert: (...args: unknown[]) => unknown;
      update: (...args: unknown[]) => unknown;
      delete: (...args: unknown[]) => unknown;
      single: () => Promise<SupabaseResult<unknown>>;
      maybeSingle: () => Promise<SupabaseResult<unknown>>;
      then: (onFulfilled: (v: SupabaseResult<unknown>) => unknown, onRejected?: (e: unknown) => unknown) => Promise<unknown>;
      catch: (onRejected: (e: unknown) => unknown) => Promise<unknown>;
      finally: (onFinally: () => void) => Promise<unknown>;
    };
  };

  const supabaseMockFrom = vi.fn(() => makeThenableBuilder());

  return { supabaseMockFrom };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: supabaseMockFrom,
    auth: {
      getSession: vi.fn(async () => ({ data: { session: { user: { id: "u1" } } }, error: null })),
      getUser: vi.fn(async () => ({ data: { user: { id: "u1", email: "t@t.co" } }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn(async () => ({ error: null })),
    },
  },
}));

import { PartenaireEmailsTab } from "./PartenaireEmailsTab";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function renderWithClient(ui: React.ReactElement) {
  const client = createQueryClient();
  return render(React.createElement(QueryClientProvider, { client }, ui));
}

describe("PartenaireEmailsTab", () => {
  it("affiche l'inbox en mode initial et passe en vue thread puis referme (succès)", async () => {
    inboxPropsCalls.length = 0;
    threadPropsCalls.length = 0;
    resizableCalls.groups.length = 0;
    resizableCalls.panels.length = 0;
    resizableCalls.handles.length = 0;

    emailInboxState.mode = "success";
    emailThreadState.mode = "success";

    renderWithClient(React.createElement(PartenaireEmailsTab, { partenaireId: "p_1", partenaireNom: "Partenaire A" }));

    expect(lastEmailFiltersProviderProps.initialFilters).toEqual({ partenaireId: "p_1" });

    expect(await screen.findByTestId("email-inbox")).toBeTruthy();
    expect(screen.getByTestId("email-inbox-account").textContent).toBe("all");
    expect(screen.queryByTestId("email-thread")).toBeNull();

    expect(inboxPropsCalls.length).toBeGreaterThanOrEqual(1);
    expect(inboxPropsCalls[0]?.accountId).toBe("all");
    expect(typeof inboxPropsCalls[0]?.onThreadSelect).toBe("function");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Ouvrir thread th_1" }));

    expect(await screen.findByTestId("email-thread")).toBeTruthy();
    expect(screen.getByTestId("email-thread-id").textContent).toBe("th_1");

    expect(resizableCalls.groups.length).toBe(1);
    expect(resizableCalls.groups[0]?.direction).toBe("horizontal");
    expect(resizableCalls.panels.length).toBe(2);
    expect(resizableCalls.panels[0]?.defaultSize).toBe(40);
    expect(resizableCalls.panels[1]?.defaultSize).toBe(60);
    expect(resizableCalls.handles.length).toBe(1);
    expect(resizableCalls.handles[0]?.withHandle).toBe(true);

    const closeBtn = screen.getByRole("button", { name: "Fermer la conversation" });
    await user.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByTestId("email-thread")).toBeNull();
    });

    expect(screen.getByTestId("email-inbox")).toBeTruthy();

    expect(threadPropsCalls.length).toBeGreaterThanOrEqual(1);
    const lastThreadCall = threadPropsCalls[threadPropsCalls.length - 1];
    expect(lastThreadCall?.threadId).toBe("th_1");
    expect(lastThreadCall?.embedded).toBe(true);
  });

  it("affiche un état de chargement (inbox)", async () => {
    inboxPropsCalls.length = 0;
    threadPropsCalls.length = 0;

    emailInboxState.mode = "loading";
    emailThreadState.mode = "success";

    renderWithClient(React.createElement(PartenaireEmailsTab, { partenaireId: "p_2" }));

    expect(await screen.findByTestId("email-inbox-loading")).toBeTruthy();
    expect(screen.queryByTestId("email-thread")).toBeNull();

    expect(inboxPropsCalls.length).toBeGreaterThanOrEqual(1);
    expect(inboxPropsCalls[0]?.accountId).toBe("all");
  });

  it("affiche une erreur (inbox)", async () => {
    inboxPropsCalls.length = 0;
    threadPropsCalls.length = 0;

    emailInboxState.mode = "error";
    emailThreadState.mode = "success";

    renderWithClient(React.createElement(PartenaireEmailsTab, { partenaireId: "p_3" }));

    expect(await screen.findByTestId("email-inbox-error")).toBeTruthy();
    expect(screen.queryByTestId("email-thread")).toBeNull();
  });

  it("déclenche onBack du thread (mutation UI: fermeture) via le bouton Retour du thread", async () => {
    inboxPropsCalls.length = 0;
    threadPropsCalls.length = 0;

    emailInboxState.mode = "success";
    emailThreadState.mode = "success";

    renderWithClient(React.createElement(PartenaireEmailsTab, { partenaireId: "p_4" }));

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Ouvrir thread th_1" }));
    expect(await screen.findByTestId("email-thread")).toBeTruthy();

    const lastThreadCall = threadPropsCalls[threadPropsCalls.length - 1];
    const onBackSpy = vi.fn(() => {
      lastThreadCall.onBack();
    });

    await act(async () => {
      onBackSpy();
    });

    expect(onBackSpy).toHaveBeenCalledWith();

    await waitFor(() => {
      expect(screen.queryByTestId("email-thread")).toBeNull();
    });
  });
});