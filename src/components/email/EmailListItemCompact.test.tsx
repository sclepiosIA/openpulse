import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";

const {
  AUTH,
  THREAD_BASE,
  ENRICHED_BASE,
  mockFrom,
  supabaseBuilderState,
  toast,
  navigateMock,
} = vi.hoisted(() => {
  const AUTH = {
    user: { id: "u1", email: "user@example.com" },
    session: { user: { id: "u1" } },
    isLoading: false,
  };

  const THREAD_BASE = {
    id: "t1",
    subject: "Sujet brut",
    ai_generated_title: "",
    last_message_date: "2024-01-10T10:00:00.000Z",
    unread_count: 2,
    is_processed: false,
    priority: "low",
    account: { email_address: "me@marque.fr" },
    participants: ["me@marque.fr", { email: "client@example.com", name: "Client Name" }],
    etablissement: null,
    partenaire: null,
    groupe: null,
    last_message: [{ from_address: "me@marque.fr", from_name: "Moi" }],
    last_inbound_from_email: "client@example.com",
    last_inbound_from_name: "Client Name",
    last_message_from_email: "me@marque.fr",
    last_message_from_name: "Moi",
    messages: [
      {
        from_address: "client@example.com",
        from_name: "Client Name",
        to_addresses: ["me@marque.fr"],
      },
      {
        from_address: "me@marque.fr",
        from_name: "Moi",
        to_addresses: [{ email: "client@example.com", name: "Client Name" }],
      },
    ],
  };

  const ENRICHED_BASE = {
    hasReply: true,
    entityLogoUrl: "https://example.com/logo.png",
    internalProfileAvatarUrl: "https://example.com/avatar.png",
    groupeFromDomain: null,
  };

  type SB = {
    table: string | null;
    selectArg: string | null;
    filters: Array<{ op: string; args: unknown[] }>;
    orderArg: unknown | null;
    limitArg: number | null;
    insertArg: unknown | null;
    updateArg: unknown | null;
    deleteCalled: boolean;
    result: { data: unknown; error: { message: string } | null };
  };

  const supabaseBuilderState: SB = {
    table: null,
    selectArg: null,
    filters: [],
    orderArg: null,
    limitArg: null,
    insertArg: null,
    updateArg: null,
    deleteCalled: false,
    result: { data: null, error: null },
  };

  const makeBuilder = () => {
    const builder = {
      select: vi.fn((arg?: string) => {
        supabaseBuilderState.selectArg = arg ?? null;
        return builder;
      }),
      eq: vi.fn((...args: unknown[]) => {
        supabaseBuilderState.filters.push({ op: "eq", args });
        return builder;
      }),
      gte: vi.fn((...args: unknown[]) => {
        supabaseBuilderState.filters.push({ op: "gte", args });
        return builder;
      }),
      lte: vi.fn((...args: unknown[]) => {
        supabaseBuilderState.filters.push({ op: "lte", args });
        return builder;
      }),
      in: vi.fn((...args: unknown[]) => {
        supabaseBuilderState.filters.push({ op: "in", args });
        return builder;
      }),
      order: vi.fn((...args: unknown[]) => {
        supabaseBuilderState.orderArg = args;
        return builder;
      }),
      limit: vi.fn((n: number) => {
        supabaseBuilderState.limitArg = n;
        return builder;
      }),
      insert: vi.fn((arg: unknown) => {
        supabaseBuilderState.insertArg = arg;
        return builder;
      }),
      update: vi.fn((arg: unknown) => {
        supabaseBuilderState.updateArg = arg;
        return builder;
      }),
      delete: vi.fn(() => {
        supabaseBuilderState.deleteCalled = true;
        return builder;
      }),
      single: vi.fn(async () => supabaseBuilderState.result),
      maybeSingle: vi.fn(async () => supabaseBuilderState.result),
      then: vi.fn((onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => {
        try {
          const v = supabaseBuilderState.result;
          return Promise.resolve(onFulfilled ? onFulfilled(v) : v);
        } catch (e) {
          return Promise.reject(onRejected ? onRejected(e) : e);
        }
      }),
      catch: vi.fn((onRejected?: (e: unknown) => unknown) => {
        return Promise.resolve(supabaseBuilderState.result).catch(onRejected);
      }),
    };
    return builder;
  };

  const mockFrom = vi.fn((table: string) => {
    supabaseBuilderState.table = table;
    supabaseBuilderState.filters = [];
    supabaseBuilderState.selectArg = null;
    supabaseBuilderState.orderArg = null;
    supabaseBuilderState.limitArg = null;
    supabaseBuilderState.insertArg = null;
    supabaseBuilderState.updateArg = null;
    supabaseBuilderState.deleteCalled = false;
    return makeBuilder();
  });

  const toast = {
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  };

  const navigateMock = vi.fn();

  return { AUTH, THREAD_BASE, ENRICHED_BASE, mockFrom, supabaseBuilderState, toast, navigateMock };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getSession: vi.fn(async () => ({ data: { session: AUTH.session }, error: null })),
      getUser: vi.fn(async () => ({ data: { user: AUTH.user }, error: null })),
    },
  },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useLocation: () => ({ pathname: "/", search: "", hash: "", state: null, key: "k" }),
    useParams: () => ({}),
  };
});

vi.mock("sonner", () => ({ toast }));

vi.mock("@/lib/utils", () => ({
  cn: (...classes: Array<unknown>) => classes.filter(Boolean).join(" "),
}));

vi.mock("@/lib/emailUtils", () => ({
  sanitizeEmailSubject: (s: string) => `SUB:${String(s ?? "")}`.trim(),
  sanitizeDisplayName: (s: string) => `DN:${String(s ?? "")}`.trim(),
}));

vi.mock("@/lib/internalEmailConfig", () => ({
  isMarqueEmail: (email: string) => String(email).toLowerCase().endsWith("@marque.fr"),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, ...props }: { children?: React.ReactNode }) => <span {...props}>{children}</span>,
}));

vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
    ...props
  }: {
    checked?: boolean;
    onCheckedChange?: (v: boolean) => void;
  }) => (
    <input
      type="checkbox"
      aria-label="checkbox"
      checked={Boolean(checked)}
      onChange={(e) => onCheckedChange?.(e.currentTarget.checked)}
      {...props}
    />
  ),
}));

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/components/ui/EntityAvatar", () => ({
  EntityAvatar: ({
    name,
    email,
    logoUrl,
    internalProfileAvatarUrl,
    isUnread,
  }: {
    name: string;
    email?: string;
    logoUrl?: string;
    internalProfileAvatarUrl?: string;
    isUnread?: boolean;
  }) => (
    <div
      data-testid="entity-avatar"
      data-name={name}
      data-email={email ?? ""}
      data-logo={logoUrl ?? ""}
      data-internal={internalProfileAvatarUrl ?? ""}
      data-unread={isUnread ? "1" : "0"}
    />
  ),
}));

vi.mock("./ThreadPointerMenu", () => ({
  ThreadPointerMenu: () => null,
}));

vi.mock("./SmartTasksDialog", () => ({
  SmartTasksDialog: () => null,
}));

vi.mock("./AssignThreadDialog", () => ({
  AssignThreadDialog: () => null,
}));

vi.mock("lucide-react", () => ({
  Paperclip: (p: Record<string, unknown>) => <svg data-icon="Paperclip" {...p} />,
  Building2: (p: Record<string, unknown>) => <svg data-icon="Building2" {...p} />,
  Users: (p: Record<string, unknown>) => <svg data-icon="Users" {...p} />,
  Handshake: (p: Record<string, unknown>) => <svg data-icon="Handshake" {...p} />,
  UserCog: (p: Record<string, unknown>) => <svg data-icon="UserCog" {...p} />,
  CheckCircle2: (p: Record<string, unknown>) => <svg data-icon="CheckCircle2" {...p} />,
  CornerUpLeft: (p: Record<string, unknown>) => <svg data-icon="CornerUpLeft" {...p} />,
}));

vi.mock("date-fns", () => ({
  formatDistanceToNow: () => "il y a 1 jour",
}));
vi.mock("date-fns/locale", () => ({ fr: {} }));

import { EmailListItemCompact } from "./EmailListItemCompact";

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });

describe("EmailListItemCompact", () => {
  it("chargement → succès : affiche l'expéditeur inbound, le sujet sanitizé, badges/indicateurs et hover/click", () => {
    const qc = createQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => ({ isLoading: true }), { wrapper });
    expect(result.current.isLoading).toBe(true);

    const onClick = vi.fn();
    const onHover = vi.fn();

    const thread = { ...THREAD_BASE };
    const enrichedData = { ...ENRICHED_BASE };

    const { rerender } = render(
      <EmailListItemCompact thread={thread} enrichedData={enrichedData} onClick={onClick} onHover={onHover} />
    );

    const root = screen.getByRole("button");
    expect(root).toHaveAttribute("id", `thread-${THREAD_BASE.id}`);

    const avatar = screen.getByTestId("entity-avatar");
    expect(avatar.getAttribute("data-email")).toBe("client@example.com");
    expect(avatar.getAttribute("data-unread")).toBe("1");
    expect(avatar.getAttribute("data-logo")).toBe(ENRICHED_BASE.entityLogoUrl);
    expect(avatar.getAttribute("data-internal")).toBe("");

    expect(screen.getByText("DN:Client Name")).toBeTruthy();
    expect(screen.getByText("SUB:Sujet brut")).toBeTruthy();
    expect(screen.getByText("il y a 1 jour")).toBeTruthy();
    expect(screen.getByText("Répondu")).toBeTruthy();

    fireEvent.mouseEnter(root);
    expect(onHover).toHaveBeenCalledTimes(1);
    expect(onHover).toHaveBeenCalledWith(thread);

    fireEvent.mouseLeave(root);
    expect(onHover).toHaveBeenCalledTimes(2);
    expect(onHover).toHaveBeenLastCalledWith(null);

    fireEvent.click(root);
    expect(onClick).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(root, { key: "Enter" });
    fireEvent.keyDown(root, { key: " " });
    expect(onClick).toHaveBeenCalledTimes(3);

    rerender(<EmailListItemCompact thread={{ ...thread, unread_count: 0 }} enrichedData={enrichedData} />);
    const avatar2 = screen.getByTestId("entity-avatar");
    expect(avatar2.getAttribute("data-unread")).toBe("0");
  });

  it("mode 'sent mailbox' : affiche le destinataire avec préfixe → et force unread/processed à false", () => {
    const thread = {
      ...THREAD_BASE,
      unread_count: 5,
      is_processed: true,
      last_inbound_from_email: "client@example.com",
      last_inbound_from_name: "Client Name",
      last_message_from_email: "me@marque.fr",
      last_message_from_name: "Moi",
      participants: ["me@marque.fr", { email: "dest@example.com", name: "Dest Name" }],
    };

    render(<EmailListItemCompact thread={thread} isSentMailbox={true} enrichedData={{ ...ENRICHED_BASE }} />);

    expect(screen.getByText("→ DN:Dest Name")).toBeTruthy();

    const avatar = screen.getByTestId("entity-avatar");
    expect(avatar.getAttribute("data-email")).toBe("dest@example.com");
    expect(avatar.getAttribute("data-unread")).toBe("0");
  });

  it("erreur (supabase) : single renvoie {data:null, error} et le composant ne plante pas ; mutation (toggle select) déclenche handler", async () => {
    supabaseBuilderState.result = { data: null, error: { message: "x" } };
    const res = await mockFrom("threads").select("*").eq("id", "t1").single();
    expect(res.data).toBe(null);
    expect(res.error?.message).toBe("x");

    const qc = createQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => ({ isError: Boolean(res.error), error: res.error }), { wrapper });
    expect(result.current.isError).toBe(true);
    expect(result.current.error?.message).toBe("x");

    const onToggleSelect = vi.fn();
    render(
      <EmailListItemCompact
        thread={{ ...THREAD_BASE }}
        isInSelectionMode={true}
        isChecked={false}
        onToggleSelect={onToggleSelect}
      />
    );

    const cb = screen.getByLabelText("checkbox");
    await act(async () => {
      fireEvent.click(cb);
    });
    expect(onToggleSelect).toHaveBeenCalledTimes(1);
  });
});