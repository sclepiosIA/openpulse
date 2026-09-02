import React from "react";
import { render, screen, waitFor, act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";

const { THREADS, MESSAGES_SUCCESS, ERROR_OBJ, CONTACTS, mockFrom, setMode, PARTENAIRE } = vi.hoisted(() => {
  const THREADS = [{ id: "t1" }];
  const now = new Date();
  const withinMonth = new Date(now.getFullYear(), now.getMonth(), Math.max(1, now.getDate() - 2)).toISOString();
  const older = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString();
  const MESSAGES_SUCCESS = [
    { id: "m1", subject: "Hello this month", received_date: withinMonth, from_address: "a@b.co", thread_id: "t1" },
    { id: "m2", subject: "Older mail", received_date: older, from_address: "old@b.co", thread_id: "t1" },
    { id: "m3", subject: "No date", received_date: null, from_address: "nodate@b.co", thread_id: "t1" },
  ];
  const ERROR_OBJ = { message: "boom" };
  const CONTACTS = [{ id: "c1" }, { id: "c2" }, { id: "c3" }];

  const MODE = { current: "success" as "success" | "error" };

  const mockFrom = vi.fn((table: string) => {
    const builder: any = {
      _table: table,
      select(..._args: any[]) {
        return builder;
      },
      eq(..._args: any[]) {
        return builder;
      },
      in(..._args: any[]) {
        return builder;
      },
      order(..._args: any[]) {
        return builder;
      },
      limit(..._args: any[]) {
        return builder;
      },
      insert(..._args: any[]) {
        return builder;
      },
      update(..._args: any[]) {
        return builder;
      },
      delete(..._args: any[]) {
        return builder;
      },
      single() {
        return builder;
      },
      maybeSingle() {
        return builder;
      },
      then(resolve: (v: any) => void, _reject?: (e: any) => void) {
        if (builder._table === "email_threads") {
          Promise.resolve().then(() => resolve({ data: THREADS, error: null }));
        } else if (builder._table === "email_messages") {
          if (MODE.current === "success") {
            Promise.resolve().then(() => resolve({ data: MESSAGES_SUCCESS, error: null }));
          } else {
            Promise.resolve().then(() => resolve({ data: null, error: ERROR_OBJ }));
          }
        } else {
          Promise.resolve().then(() => resolve({ data: [], error: null }));
        }
        return builder;
      },
      catch() {
        return builder;
      },
    };
    return builder;
  });

  const PARTENAIRE = {
    id: "p1",
    engagement_score: 42,
    prochaine_action: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
  };

  return {
    THREADS,
    MESSAGES_SUCCESS,
    ERROR_OBJ,
    CONTACTS,
    mockFrom,
    setMode: (m: "success" | "error") => {
      MODE.current = m;
    },
    PARTENAIRE,
  };
});

// Mock supabase client
vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      from: mockFrom,
    },
  };
});

// Mock the contacts hook
vi.mock("@/hooks/crm/useContactsGroupe", () => {
  return {
    useContactsGroupe: (id: string) => {
      return { data: CONTACTS };
    },
  };
});

// Mock UI components used by the module
vi.mock("@/components/ui/card", () => {
  return {
    Card: (props: any) => React.createElement("div", { "data-testid": "card" }, props.children),
    CardContent: (props: any) => React.createElement("div", { "data-testid": "card-content" }, props.children),
    CardHeader: (props: any) => React.createElement("div", { "data-testid": "card-header" }, props.children),
    CardTitle: (props: any) => React.createElement("div", { "data-testid": "card-title" }, props.children),
    CardDescription: (props: any) => React.createElement("div", { "data-testid": "card-desc" }, props.children),
  };
});

vi.mock("@/components/ui/badge", () => {
  return {
    Badge: (props: any) =>
      React.createElement("span", { "data-testid": "badge", className: props.className }, props.children),
  };
});

vi.mock("@/components/ui/chart", () => {
  return {
    ChartContainer: (props: any) =>
      React.createElement("div", { "data-testid": "chart", className: props.className }, props.children),
  };
});

// Mock icons so rendering doesn't rely on lucide-react implementation
vi.mock("lucide-react", () => {
  return {
    Mail: (props: any) => React.createElement("svg", { "data-testid": "icon-mail" }),
    Users: (props: any) => React.createElement("svg", { "data-testid": "icon-users" }),
    Activity: (props: any) => React.createElement("svg", { "data-testid": "icon-activity" }),
    TrendingUp: (props: any) => React.createElement("svg", { "data-testid": "icon-trending" }),
  };
});

// Import the mocked supabase and the component under test AFTER mocks are defined
import { supabase } from "@/integrations/supabase/client";
import { useContactsGroupe } from "@/hooks/crm/useContactsGroupe";
import { PartenaireConsolidatedView } from "./PartenaireConsolidatedView";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function Wrapper({ children }: { children?: React.ReactNode }) {
  const qc = createQueryClient();
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

describe("PartenaireConsolidatedView - queries and rendering", () => {
  it("useQuery starts loading then resolves successfully with filtered messages (no null dates)", async () => {
    setMode("success");

    const wrapper = ({ children }: { children?: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: createQueryClient() }, children);

    const queryFn = async () => {
      const { data: threads } = await supabase.from("email_threads").select("id").eq("partenaire_id", PARTENAIRE.id);
      if (!threads?.length) return [];
      const { data, error } = await supabase
        .from("email_messages")
        .select("id, subject, received_date, from_address, thread_id")
        .in("thread_id", threads.map((t: any) => t.id))
        .order("received_date", { ascending: false });
      if (error) throw error;
      return (data || []).filter((msg: any) => msg.received_date);
    };

    const { result } = renderHook(() => useQuery({ queryKey: ["partenaire-email-messages", PARTENAIRE.id], queryFn }), {
      wrapper,
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data = result.current.data as any[];
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(2);
    const ids = data.map((d) => d.id);
    expect(ids).toContain("m1");
    expect(ids).toContain("m2");
  });

  it("component renders KPIs, timeline entries and prochaine action badge correctly", async () => {
    setMode("success");

    render(
      React.createElement(
        QueryClientProvider,
        { client: createQueryClient() },
        React.createElement(PartenaireConsolidatedView, { partenaire: PARTENAIRE })
      )
    );

    await waitFor(() => {
      const contactCount = screen.getByText(String(CONTACTS.length));
      expect(contactCount).toBeDefined();
    });

    await waitFor(() => {
      const emailCount = screen.getByText("2");
      expect(emailCount).toBeDefined();
    });

    await waitFor(() => {
      expect(screen.getByText("Hello this month")).toBeDefined();
      expect(screen.getByText("a@b.co")).toBeDefined();
      expect(screen.getByText("Older mail")).toBeDefined();
      expect(screen.getByText("old@b.co")).toBeDefined();
    });

    await waitFor(() => {
      const badges = screen.getAllByTestId("badge");
      const coming = badges.find((el) => el.textContent?.includes("À venir"));
      expect(coming).toBeDefined();
    });
  });

  it("useQuery transitions to error when supabase returns an error object", async () => {
    setMode("error");

    const wrapper = ({ children }: { children?: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: createQueryClient() }, children);

    const queryFn = async () => {
      const { data: threads } = await supabase.from("email_threads").select("id").eq("partenaire_id", PARTENAIRE.id);
      if (!threads?.length) return [];
      const { data, error } = await supabase
        .from("email_messages")
        .select("id, subject, received_date, from_address, thread_id")
        .in("thread_id", threads.map((t: any) => t.id))
        .order("received_date", { ascending: false });
      if (error) throw error;
      return (data || []).filter((msg: any) => msg.received_date);
    };

    const { result } = renderHook(() => useQuery({ queryKey: ["partenaire-email-messages", PARTENAIRE.id], queryFn }), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect((result.current.error as any)?.message).toBe(ERROR_OBJ.message);
  });

  it("useContactsGroupe hook (mock) returns stable contacts array", async () => {
    setMode("success");

    const wrapper = ({ children }: { children?: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: createQueryClient() }, children);

    const { result } = renderHook(() => useContactsGroupe(PARTENAIRE.id), { wrapper });

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    expect(Array.isArray(result.current.data)).toBe(true);
    expect(result.current.data.length).toBe(CONTACTS.length);
    expect(result.current.data[0].id).toBe("c1");
  });
});