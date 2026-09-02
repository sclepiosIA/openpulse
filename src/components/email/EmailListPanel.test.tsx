/* @vitest-environment jsdom */

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { EmailListPanel } from "./EmailListPanel";

const {
  THREADS,
  ENRICHED_MAP,
  AUTH_STATE,
  ACCOUNT_IDS,
  FILTERS,
  mockFrom,
  mockRpc,
  mockHandleError,
  mockUpdateFilter,
  mockActionHandlersHook,
  mockOnThreadSelect,
  mockOnComposeNew,
  mockOnSyncNow,
  mockOnThreadHover,
  toastSuccess,
  toastError,
  stableQueryResult,
  stableRpcResult,
} = vi.hoisted(() => {
  const THREADS = [
    {
      id: "t1",
      thread_id: "thr-1",
      user_email_account_id: "acc-1",
      subject: "Sujet alpha",
      participants: [],
      last_message_date: "2024-05-10T10:00:00.000Z",
      message_count: 2,
      unread_count: 1,
      last_message_from_email: "alpha@example.test",
      last_message_from_name: "Alpha",
      last_message_is_sent: false,
      last_inbound_from_email: "alpha@example.test",
      last_inbound_from_name: "Alpha",
      last_inbound_date: "2024-05-10T10:00:00.000Z",
      is_archived: false,
      is_spam: false,
      is_deleted: false,
      is_hors_etablissement: false,
      is_processed: false,
      has_sent_messages: false,
      category: "general",
      priority: "normal",
      tags: [],
      etablissement_id: null,
      groupe_id: null,
      partenaire_id: null,
      ai_summary: "Résumé alpha",
      ai_generated_title: "Titre alpha",
      ai_confidence_score: 0.9,
      needs_manual_review: false,
      created_at: "2024-05-10T09:00:00.000Z",
      updated_at: "2024-05-10T10:00:00.000Z",
      account: { email_address: "team@example.test" },
    },
    {
      id: "t2",
      thread_id: "thr-2",
      user_email_account_id: "acc-1",
      subject: "Sujet beta",
      participants: [],
      last_message_date: "2024-05-09T08:00:00.000Z",
      message_count: 1,
      unread_count: 0,
      last_message_from_email: "beta@example.test",
      last_message_from_name: "Beta",
      last_message_is_sent: true,
      last_inbound_from_email: "beta@example.test",
      last_inbound_from_name: "Beta",
      last_inbound_date: "2024-05-09T08:00:00.000Z",
      is_archived: false,
      is_spam: false,
      is_deleted: false,
      is_hors_etablissement: false,
      is_processed: true,
      has_sent_messages: true,
      category: "sales",
      priority: "high",
      tags: ["vip"],
      etablissement_id: null,
      groupe_id: null,
      partenaire_id: null,
      ai_summary: "Résumé beta",
      ai_generated_title: "Titre beta",
      ai_confidence_score: 0.7,
      needs_manual_review: false,
      created_at: "2024-05-09T07:00:00.000Z",
      updated_at: "2024-05-09T08:00:00.000Z",
      account: { email_address: "team@example.test" },
    },
  ];

  const ENRICHED_MAP = new Map<string, { contactName: string }>([
    ["t1", { contactName: "Alpha enrichi" }],
    ["t2", { contactName: "Beta enrichi" }],
  ]);

  const AUTH_STATE = {
    user: { id: "u1", email: "user@example.test" },
    session: { user: { id: "u1" } },
    isLoading: false,
  };

  const ACCOUNT_IDS = ["acc-1", "acc-2"];

  const FILTERS = {
    search: "",
    category: null,
    unreadOnly: false,
    unprocessedOnly: false,
    mailbox: "inbox",
    etablissementId: null,
    groupeId: null,
    partenaireId: null,
  };

  const mockFrom = vi.fn();
  const mockRpc = vi.fn();
  const mockHandleError = vi.fn();
  const mockUpdateFilter = vi.fn();
  const mockActionHandlersHook = vi.fn();
  const mockOnThreadSelect = vi.fn();
  const mockOnComposeNew = vi.fn();
  const mockOnSyncNow = vi.fn();
  const mockOnThreadHover = vi.fn();
  const toastSuccess = vi.fn();
  const toastError = vi.fn();

  const stableQueryResult = { data: THREADS, error: null };
  const stableRpcResult = { data: [], error: null };

  return {
    THREADS,
    ENRICHED_MAP,
    AUTH_STATE,
    ACCOUNT_IDS,
    FILTERS,
    mockFrom,
    mockRpc,
    mockHandleError,
    mockUpdateFilter,
    mockActionHandlersHook,
    mockOnThreadSelect,
    mockOnComposeNew,
    mockOnSyncNow,
    mockOnThreadHover,
    toastSuccess,
    toastError,
    stableQueryResult,
    stableRpcResult,
  };
});

class MockIntersectionObserver {
  observe() {}
  disconnect() {}
  unobserve() {}
  takeRecords() {
    return [];
  }
}

vi.mock("@/integrations/supabase/client", () => {
  const createBuilder = (result: { data: unknown; error: unknown }) => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      gt: vi.fn(() => builder),
      lt: vi.fn(() => builder),
      in: vi.fn(() => builder),
      or: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      range: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      upsert: vi.fn(() => builder),
      single: vi.fn(() => Promise.resolve(result)),
      maybeSingle: vi.fn(() => Promise.resolve(result)),
      then: (resolve: (value: typeof result) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve(result).then(resolve, reject),
      catch: (reject: (reason: unknown) => unknown) => Promise.resolve(result).catch(reject),
    };
    return builder;
  };

  mockFrom.mockImplementation(() => createBuilder(stableQueryResult));
  mockRpc.mockResolvedValue(stableRpcResult);

  return {
    supabase: {
      from: mockFrom,
      rpc: mockRpc,
      channel: vi.fn(() => ({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      })),
      removeChannel: vi.fn(),
    },
  };
});

vi.mock("@/lib/safeStorage", () => ({
  safeStorage: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock("@/lib/debug", () => ({
  debug: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("./EmailListItemCompact", () => ({
  EmailListItemCompact: (props: {
    thread: { id: string; subject: string };
    enrichedData?: { contactName?: string };
  }) => (
    <div data-testid={`thread-item-${props.thread.id}`}>
      <span>{props.thread.subject}</span>
      <span>{props.enrichedData?.contactName ?? "sans-enrichissement"}</span>
    </div>
  ),
}));

vi.mock("./BulkActionsBar", () => ({
  BulkActionsBar: () => <div data-testid="bulk-actions-bar" />,
}));

vi.mock("./EmailListPanelHeader", () => ({
  EmailListPanelHeader: () => <div data-testid="email-list-panel-header">Header</div>,
}));

vi.mock("@/hooks/email/useEmailFilters", () => ({
  useEmailFilters: () => ({
    filters: FILTERS,
    updateFilter: mockUpdateFilter,
  }),
}));

vi.mock("@/hooks/shared/useDebouncedValue", () => ({
  useDebouncedValue: (value: string) => value,
}));

vi.mock("@/hooks/email/useThreadsEnrichedData", () => ({
  useThreadsEnrichedData: () => ({
    data: ENRICHED_MAP,
  }),
}));

vi.mock("@/hooks/shared/useErrorHandler", () => ({
  useErrorHandler: () => ({
    handleError: mockHandleError,
  }),
}));

vi.mock("./inbox/useEmailListPanelActionHandlers", () => ({
  useEmailListPanelActionHandlers: () => {
    mockActionHandlersHook();
    return {
      actionHandlers: {},
      optimisticUpdateThread: vi.fn(),
      optimisticRemoveThread: vi.fn(),
    };
  },
}));

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock("@/hooks/shared/useAuth", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/hooks/shared/useUserEmailAccountIds", () => ({
  useUserEmailAccountIds: () => ({
    accountIds: ACCOUNT_IDS,
  }),
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />,
  },
}));

vi.mock("lucide-react", () => ({
  RefreshCw: () => <svg data-testid="icon-refresh" />,
  Mail: () => <svg data-testid="icon-mail" />,
}));

function createClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function renderPanel(props?: Partial<React.ComponentProps<typeof EmailListPanel>>) {
  const client = createClient();
  return render(
    <QueryClientProvider client={client}>
      <EmailListPanel
        accountId="acc-1"
        selectedThreadId={null}
        onThreadSelect={mockOnThreadSelect}
        onComposeNew={mockOnComposeNew}
        onSyncNow={mockOnSyncNow}
        isSyncing={false}
        lastSyncAt={null}
        onThreadHover={mockOnThreadHover}
        {...props}
      />
    </QueryClientProvider>
  );
}

describe("EmailListPanel", () => {
  beforeAll(() => {
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
  });

  it("affiche le header puis charge et rend les sujets réels des threads avec données enrichies", async () => {
    renderPanel();

    expect(screen.getByTestId("email-list-panel-header")).toHaveTextContent("Header");

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith("email_threads");
    });

    await waitFor(() => {
      expect(screen.getByTestId("thread-item-t1")).toHaveTextContent("Sujet alpha");
      expect(screen.getByTestId("thread-item-t1")).toHaveTextContent("Alpha enrichi");
      expect(screen.getByTestId("thread-item-t2")).toHaveTextContent("Sujet beta");
      expect(screen.getByTestId("thread-item-t2")).toHaveTextContent("Beta enrichi");
    });
  });

  it("utilise le compte fourni et initialise les hooks internes attendus", async () => {
    renderPanel({ accountId: "acc-1" });

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledTimes(1);
    });

    expect(mockActionHandlersHook).toHaveBeenCalled();
    expect(mockHandleError).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("gère une erreur de récupération sans réseau réel", async () => {
    const error = new Error("x");

    mockFrom.mockImplementationOnce(() => {
      const failingResult = Promise.reject(error);
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        gte: vi.fn(() => builder),
        lte: vi.fn(() => builder),
        gt: vi.fn(() => builder),
        lt: vi.fn(() => builder),
        in: vi.fn(() => builder),
        or: vi.fn(() => builder),
        order: vi.fn(() => builder),
        limit: vi.fn(() => builder),
        range: vi.fn(() => builder),
        insert: vi.fn(() => builder),
        update: vi.fn(() => builder),
        delete: vi.fn(() => builder),
        upsert: vi.fn(() => builder),
        single: vi.fn(() => failingResult),
        maybeSingle: vi.fn(() => failingResult),
        then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
          failingResult.then(resolve, reject),
        catch: (reject: (reason: unknown) => unknown) => failingResult.catch(reject),
      };
      return builder;
    });

    renderPanel();

    await waitFor(() => {
      expect(mockHandleError).toHaveBeenCalledWith(error, "EmailListPanel.fetchThreads");
    });

    expect(screen.getByTestId("email-list-panel-header")).toBeInTheDocument();
  });
});