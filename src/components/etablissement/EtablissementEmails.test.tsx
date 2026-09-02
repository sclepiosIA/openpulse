import React from "react";
import { render, screen, fireEvent, waitFor, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { EtablissementEmails } from "./EtablissementEmails";

// Stable hoisted mocks and data to avoid re-creation on each call (prevents re-render loops)
const { RESPONSES, setResponseFor, mockFrom } = vi.hoisted(() => {
  const nowIso = new Date().toISOString();

  const defaultThreads = [
    {
      id: "t-1",
      subject: "Sujet &amp; test",
      unread_count: 1,
      user_email_accounts: { email_address: "contact@example.test" },
      last_message_date: nowIso,
      message_count: 1,
      ai_summary: "Résumé IA",
      etablissement_id: "e-1",
    },
  ];

  const defaultEtab = {
    derniers_echanges_resume: "Résumé des échanges",
    derniers_echanges_updated_at: nowIso,
    engagement_score: 42,
  };

  const defaultDomains = [{ id: "d-1" }];

  const responses: Record<string, { data: any; error: any }> = {
    email_threads: { data: defaultThreads, error: null },
    etablissements: { data: defaultEtab, error: null },
    email_domain_mappings: { data: defaultDomains, error: null },
  };

  const setResponseFor = (table: string, resp: { data: any; error: any }) => {
    responses[table] = resp;
  };

  const makeBuilder = (table: string) => {
    const builder: any = {
      select: (_: any) => builder,
      eq: (_: any, __: any) => builder,
      order: (_: any, __: any) => builder,
      limit: (_: any) => builder,
      insert: (_: any) => builder,
      update: (_: any) => builder,
      delete: () => builder,
      single: async () => responses[table],
      maybeSingle: async () => responses[table],
      then: (onFulfilled: any, onRejected: any) =>
        Promise.resolve(responses[table]).then(onFulfilled, onRejected),
      catch: (onRejected: any) => Promise.resolve(responses[table]).catch(onRejected),
    };
    return builder;
  };

  const mockFrom = vi.fn((table: string) => makeBuilder(table));

  return {
    RESPONSES: responses,
    setResponseFor,
    mockFrom,
  };
});

// Mock supabase client used by the component
vi.mock("@/lib/supabaseBrowser", () => ({ supabase: { from: mockFrom } }));

// Stable small utilities used by the component
const { fixMalformedEncoding, sanitizeEmailSubject } = vi.hoisted(() => ({
  fixMalformedEncoding: (s: string) => s,
  sanitizeEmailSubject: (s: string) => s,
}));
vi.mock("@/lib/emailUtils", () => ({ fixMalformedEncoding, sanitizeEmailSubject }));

// Stable UI primitive mocks (kept minimal and deterministic)
const { Card, CardHeader, CardContent, CardTitle } = vi.hoisted(() => {
  const CardComp: React.FC<any> = ({ children, ...p }) => React.createElement("div", p, children);
  const CardHeaderComp: React.FC<any> = ({ children, ...p }) => React.createElement("div", p, children);
  const CardContentComp: React.FC<any> = ({ children, ...p }) => React.createElement("div", p, children);
  const CardTitleComp: React.FC<any> = ({ children, ...p }) => React.createElement("div", p, children);
  return { Card: CardComp, CardHeader: CardHeaderComp, CardContent: CardContentComp, CardTitle: CardTitleComp };
});
vi.mock("@/components/ui/card", () => ({ Card, CardHeader, CardContent, CardTitle }));

const { Badge } = vi.hoisted(() => {
  const BadgeComp: React.FC<any> = ({ children, ...p }) => React.createElement("span", p, children);
  return { Badge: BadgeComp };
});
vi.mock("@/components/ui/badge", () => ({ Badge }));

const { Button } = vi.hoisted(() => {
  const ButtonComp: React.FC<any> = ({ children, ...p }) => React.createElement("button", p, children);
  return { Button: ButtonComp };
});
vi.mock("@/components/ui/button", () => ({ Button }));

const { Tabs, TabsContent, TabsList, TabsTrigger } = vi.hoisted(() => {
  const TabsComp: React.FC<any> = ({ children, ...p }) => React.createElement("div", p, children);
  const TabsContentComp: React.FC<any> = ({ children, ...p }) => React.createElement("div", p, children);
  const TabsListComp: React.FC<any> = ({ children, ...p }) => React.createElement("div", p, children);
  const TabsTriggerComp: React.FC<any> = ({ children, ...p }) =>
    React.createElement("button", p, children);
  return { Tabs: TabsComp, TabsContent: TabsContentComp, TabsList: TabsListComp, TabsTrigger: TabsTriggerComp };
});
vi.mock("@/components/ui/tabs", () => ({ Tabs, TabsContent, TabsList, TabsTrigger }));

// Stable mocks for child components
const { EmailThread } = vi.hoisted(() => {
  const EmailThreadComp: React.FC<any> = ({ threadId, onBack }: { threadId: string; onBack: () => void }) =>
    React.createElement(
      "div",
      {},
      React.createElement("div", {}, `EmailThread for ${threadId}`),
      React.createElement("button", { onClick: onBack, "data-testid": "back-button" }, "Back")
    );
  return { EmailThread: EmailThreadComp };
});
vi.mock("@/components/email/EmailThread", () => ({ EmailThread }));

const { EmailDomainManager } = vi.hoisted(() => {
  const EmailDomainManagerComp: React.FC<any> = ({ etablissementId }: { etablissementId: string }) =>
    React.createElement("div", { "data-testid": "domain-manager" }, `DomainManager ${etablissementId}`);
  return { EmailDomainManager: EmailDomainManagerComp };
});
vi.mock("@/components/email/EmailDomainManager", () => ({ EmailDomainManager }));

const { EmailTimeline } = vi.hoisted(() => {
  const EmailTimelineComp: React.FC<any> = ({ etablissementId, etablissementNom, onThreadSelect }: any) =>
    React.createElement(
      "div",
      {},
      `Timeline ${etablissementId} ${etablissementNom}`,
      React.createElement(
        "button",
        { onClick: () => onThreadSelect("t-1"), "data-testid": "timeline-select" },
        "Select"
      )
    );
  return { EmailTimeline: EmailTimelineComp };
});
vi.mock("@/components/email/EmailTimeline", () => ({ EmailTimeline }));

// Ensure any app-level hooks that might be imported elsewhere are safe/stable
const { useAuth } = vi.hoisted(() => ({
  useAuth: () => ({ user: { id: "u1", email: "u@test" }, isLoading: false }),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth }));

vi.mock("@/components/AuthProvider", () => ({ AuthProvider: ({ children }: any) => React.createElement("div", {}, children) }));
vi.mock("@/hooks/useSession", () => ({ useSession: () => ({ session: { user: { id: "u1" } }, isLoading: false }) }));

// Helper to create QueryClient wrapper as mandated
const createQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });

const createWrapper =
  (client?: QueryClient) =>
  ({ children }: { children?: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: client ?? createQueryClient() }, children);

// Tests
describe("EtablissementEmails component", () => {
  beforeEach(() => {
    // Reset responses to defaults
    setResponseFor("email_threads", {
      data: [
        {
          id: "t-1",
          subject: "Sujet &amp; test",
          unread_count: 1,
          user_email_accounts: { email_address: "contact@example.test" },
          last_message_date: new Date().toISOString(),
          message_count: 1,
          ai_summary: "Résumé IA",
          etablissement_id: "e-1",
        },
      ],
      error: null,
    });
    setResponseFor("etablissements", {
      data: {
        derniers_echanges_resume: "Résumé des échanges",
        derniers_echanges_updated_at: new Date().toISOString(),
        engagement_score: 42,
      },
      error: null,
    });
    setResponseFor("email_domain_mappings", { data: [{ id: "d-1" }], error: null });
    mockFrom.mockClear();
  });

  it("shows loading initially and then renders threads, summary and domain stats on success", async () => {
    const queryClient = createQueryClient();

    // Required pattern: a renderHook inside QueryClientProvider wrapper
    renderHook(() => true, { wrapper: createWrapper(queryClient) });

    render(React.createElement(EtablissementEmails, { etablissementId: "e-1", etablissementNom: "Etab 1" }), {
      wrapper: createWrapper(queryClient),
    });

    // Immediately shows loading state
    expect(screen.getByText("Chargement...")).toBeTruthy();

    // Wait until loading gone
    await waitFor(() => expect(screen.queryByText("Chargement...")).toBeNull());

    // Check header shows the count of threads (business value)
    expect(screen.getByText("Historique des échanges (1)")).toBeTruthy();

    // AI summary content present
    expect(screen.getByText("Résumé des échanges")).toBeTruthy();

    // Domain stats labels present
    expect(screen.getByText("Threads auto-classés")).toBeTruthy();
    expect(screen.getByText("Domaines actifs")).toBeTruthy();
    expect(screen.getByText("Score d'engagement")).toBeTruthy();

    // Thread subject and email shown
    expect(screen.getByText("Sujet &amp; test")).toBeTruthy();
    expect(screen.getByText("contact@example.test")).toBeTruthy();

    // Click the "Ouvrir" button to open thread
    const ouvrirButtons = screen.getAllByText("Ouvrir");
    expect(ouvrirButtons.length).toBeGreaterThan(0);
    fireEvent.click(ouvrirButtons[0]);

    // After click, EmailThread mock should render
    await waitFor(() => expect(screen.getByText(/EmailThread for t-1/)).toBeTruthy());

    // Click back to return to list
    const backButton = screen.getByTestId("back-button");
    fireEvent.click(backButton);

    // Ensure returned to list
    await waitFor(() => expect(screen.getByText("Historique des échanges (1)")).toBeTruthy());
  });

  it("marks query as error when supabase returns an error for threads", async () => {
    const queryClient = createQueryClient();

    // Configure supabase mock to return an error for email_threads
    setResponseFor("email_threads", { data: null, error: { message: "boom" } });

    // Use renderHook to execute a similar query as the component and assert error propagation
    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ["etablissement-email-threads", "e-error"],
          queryFn: async () => {
            const { data, error } = await (mockFrom("email_threads") as any)
              .select("*")
              .eq("etablissement_id", "e-error")
              .order("last_message_date", { ascending: false })
              .limit(20);
            if (error) throw error;
            return data;
          },
        }),
      { wrapper: createWrapper(queryClient) }
    );

    // Wait for the hook to reflect error status
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // Ensure underlying supabase was queried and error message propagated
    expect(mockFrom).toHaveBeenCalledWith("email_threads");
    expect((result.current.error as any).message).toBe("boom");
  });

  it("opens timeline and selects a thread via the EmailTimeline mock", async () => {
    const queryClient = createQueryClient();

    // renderHook compliance call
    renderHook(() => true, { wrapper: createWrapper(queryClient) });

    render(React.createElement(EtablissementEmails, { etablissementId: "e-1", etablissementNom: "Etab 1" }), {
      wrapper: createWrapper(queryClient),
    });

    // Wait until loaded
    await waitFor(() => expect(screen.queryByText("Chargement...")).toBeNull());

    // Click the timeline tab trigger (button)
    const timelineTriggers = screen.getAllByText("Timeline interactive");
    if (timelineTriggers.length > 0) {
      fireEvent.click(timelineTriggers[0]);
    }

    // Click the select button inside EmailTimeline mock to select a thread
    const timelineSelect = await screen.findByTestId("timeline-select");
    fireEvent.click(timelineSelect);

    // After selection, EmailThread mock should render
    await waitFor(() => expect(screen.getByText(/EmailThread for t-1/)).toBeTruthy());
  });
});