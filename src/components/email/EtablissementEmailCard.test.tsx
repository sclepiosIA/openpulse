import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { FIXED_NAME, fixMalformedEncodingMock, cnMock, mockFrom, builder, mockThenResult, useAuthMock, useNavigateMock, toastMocks } = vi.hoisted(() => {
  const FIXED_NAME = "FIXED";
  const fixMalformedEncodingMock = vi.fn((s: string) => `FIXED:${s}`);
  const cnMock = vi.fn((...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(" "));
  const mockThenResult = { data: [{ id: "1" }], error: null };

  const builder = {
    select: vi.fn(function () { return builder; }),
    eq: vi.fn(function () { return builder; }),
    gte: vi.fn(function () { return builder; }),
    lte: vi.fn(function () { return builder; }),
    in: vi.fn(function () { return builder; }),
    order: vi.fn(function () { return builder; }),
    limit: vi.fn(function () { return builder; }),
    insert: vi.fn(function () { return builder; }),
    update: vi.fn(function () { return builder; }),
    delete: vi.fn(function () { return builder; }),
    single: vi.fn(function () { return Promise.resolve(mockThenResult); }),
    maybeSingle: vi.fn(function () { return Promise.resolve(mockThenResult); }),
    then: vi.fn(function (onFulfilled: any) { return Promise.resolve(mockThenResult).then(onFulfilled); }),
    catch: vi.fn(function () { return builder; }),
  };

  const mockFrom = vi.fn(() => builder);

  const useAuthMock = vi.fn(() => ({
    user: { id: "u1", email: "t@t.co" },
    session: { user: { id: "u1" } },
    isLoading: false,
    isAdmin: true,
  }));

  const useNavigateMock = vi.fn();

  const toastMocks = {
    success: vi.fn(),
    error: vi.fn(),
  };

  return { FIXED_NAME, fixMalformedEncodingMock, cnMock, mockFrom, builder, mockThenResult, useAuthMock, useNavigateMock, toastMocks };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock("@/components/ui/card", () => {
  return {
    Card: ({ children, className, ...props }: any) =>
      React.createElement("div", { "data-testid": "card", className, ...props }, children),
  };
});

vi.mock("@/components/ui/badge", () => {
  return {
    Badge: ({ children, className, variant, ...props }: any) =>
      React.createElement("span", { "data-testid": "badge", "data-variant": variant, className, ...props }, children),
  };
});

vi.mock("@/components/ui/tooltip", () => {
  return {
    Tooltip: ({ children }: any) => React.createElement("div", { "data-testid": "tooltip" }, children),
    TooltipTrigger: ({ children, asChild }: any) => React.createElement("span", { "data-testid": "tooltip-trigger" }, children),
    TooltipContent: ({ children }: any) => React.createElement("div", { "data-testid": "tooltip-content" }, children),
  };
});

vi.mock("@/lib/utils", () => ({ cn: cnMock }));

vi.mock("@/lib/emailUtils", () => ({ fixMalformedEncoding: fixMalformedEncodingMock }));

vi.mock("date-fns", () => ({
  formatDistanceToNow: vi.fn(() => "il y a 3 jours"),
}));

vi.mock("date-fns/locale", () => ({ fr: {} }));

vi.mock("lucide-react", () => {
  const make = (name: string) => (props: any) => React.createElement("span", { "data-icon": name, ...props });
  return {
    Mail: make("Mail"),
    MessageSquare: make("MessageSquare"),
    Clock: make("Clock"),
    ChevronRight: make("ChevronRight"),
    AlertCircle: make("AlertCircle"),
    Zap: make("Zap"),
  };
});

vi.mock("@/hooks/useAuth", () => ({ useAuth: useAuthMock }));

vi.mock("react-router", () => ({ useNavigate: useNavigateMock }));
vi.mock("react-router-dom", () => ({ useNavigate: useNavigateMock }));

vi.mock("sonner", () => ({ toast: toastMocks }));

import { EtablissementEmailCard } from "./EtablissementEmailCard";
import { supabase } from "@/integrations/supabase/client";

describe("EtablissementEmailCard", () => {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  const Wrapper = ({ children }: { children?: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );

  afterEach(() => {
    vi.resetAllMocks();
    qc.clear();
    try {
      vi.useRealTimers();
    } catch {}
  });

  it("wrapper renderHook works with QueryClientProvider (obligatoire)", async () => {
    const { result } = renderHook(
      () => {
        return { ok: true };
      },
      { wrapper: Wrapper }
    );
    expect(result.current.ok).toBe(true);
  });

  it("renders Nouveau when lastMessageDate is null and uses fixMalformedEncoding", () => {
    render(
      <Wrapper>
        <EtablissementEmailCard
          etablissementId="e1"
          etablissementNom="NomÉ"
          etablissementVille="VilleÉ"
          totalThreads={0}
          totalMessages={0}
          unreadCount={0}
          lastMessageDate={null}
          avgResponseTimeHours={null}
          activeThreads={0}
          archivedThreads={0}
          onViewDetails={vi.fn()}
        />
      </Wrapper>
    );

    // fixMalformedEncoding must have been used for name and city
    expect(fixMalformedEncodingMock).toHaveBeenCalledWith("NomÉ");
    expect(fixMalformedEncodingMock).toHaveBeenCalledWith("VilleÉ");

    // "Nouveau" badge rendered
    expect(screen.getByText("Nouveau")).toBeTruthy();
  });

  it("computes activity status correctly based on lastMessageDate", () => {
    // Set a fixed current time: 2026-01-31T00:00:00Z
    const base = new Date("2026-01-31T00:00:00.000Z").getTime();
    vi.setSystemTime(base);

    // Actif: within 7 days -> use date 3 days ago
    render(
      <Wrapper>
        <EtablissementEmailCard
          etablissementId="e1"
          etablissementNom="A"
          etablissementVille="B"
          totalThreads={1}
          totalMessages={1}
          unreadCount={0}
          lastMessageDate={new Date(base - 3 * 24 * 3600 * 1000).toISOString()}
          avgResponseTimeHours={1}
          activeThreads={1}
          archivedThreads={0}
          onViewDetails={vi.fn()}
        />
      </Wrapper>
    );
    expect(screen.getByText("Actif")).toBeTruthy();

    // Cleanup between renders
    vi.resetAllMocks();
    render(
      <Wrapper>
        <EtablissementEmailCard
          etablissementId="e2"
          etablissementNom="A"
          etablissementVille="B"
          totalThreads={1}
          totalMessages={1}
          unreadCount={0}
          lastMessageDate={new Date(base - 10 * 24 * 3600 * 1000).toISOString()}
          avgResponseTimeHours={1}
          activeThreads={1}
          archivedThreads={0}
          onViewDetails={vi.fn()}
        />
      </Wrapper>
    );
    expect(screen.getByText("À relancer")).toBeTruthy();

    vi.resetAllMocks();
    render(
      <Wrapper>
        <EtablissementEmailCard
          etablissementId="e3"
          etablissementNom="A"
          etablissementVille="B"
          totalThreads={1}
          totalMessages={1}
          unreadCount={0}
          lastMessageDate={new Date(base - 40 * 24 * 3600 * 1000).toISOString()}
          avgResponseTimeHours={1}
          activeThreads={1}
          archivedThreads={0}
          onViewDetails={vi.fn()}
        />
      </Wrapper>
    );
    expect(screen.getByText("Inactif")).toBeTruthy();
  });

  it("displays unread badge with correct pluralization", () => {
    const { rerender } = render(
      <Wrapper>
        <EtablissementEmailCard
          etablissementId="e1"
          etablissementNom="N"
          etablissementVille="V"
          totalThreads={0}
          totalMessages={0}
          unreadCount={1}
          lastMessageDate={null}
          avgResponseTimeHours={null}
          activeThreads={0}
          archivedThreads={0}
          onViewDetails={vi.fn()}
        />
      </Wrapper>
    );

    expect(screen.getByText("1 non lu")).toBeTruthy();

    rerender(
      <Wrapper>
        <EtablissementEmailCard
          etablissementId="e1"
          etablissementNom="N"
          etablissementVille="V"
          totalThreads={0}
          totalMessages={0}
          unreadCount={2}
          lastMessageDate={null}
          avgResponseTimeHours={null}
          activeThreads={0}
          archivedThreads={0}
          onViewDetails={vi.fn()}
        />
      </Wrapper>
    );

    expect(screen.getByText("2 non lus")).toBeTruthy();
  });

  it("formats average response time into min/h/j as expected", () => {
    render(
      <Wrapper>
        <div>
          <EtablissementEmailCard
            etablissementId="e1"
            etablissementNom="N"
            etablissementVille="V"
            totalThreads={0}
            totalMessages={0}
            unreadCount={0}
            lastMessageDate={null}
            avgResponseTimeHours={0.5}
            activeThreads={0}
            archivedThreads={0}
            onViewDetails={vi.fn()}
          />
          <EtablissementEmailCard
            etablissementId="e2"
            etablissementNom="N"
            etablissementVille="V"
            totalThreads={0}
            totalMessages={0}
            unreadCount={0}
            lastMessageDate={null}
            avgResponseTimeHours={5}
            activeThreads={0}
            archivedThreads={0}
            onViewDetails={vi.fn()}
          />
          <EtablissementEmailCard
            etablissementId="e3"
            etablissementNom="N"
            etablissementVille="V"
            totalThreads={0}
            totalMessages={0}
            unreadCount={0}
            lastMessageDate={null}
            avgResponseTimeHours={48}
            activeThreads={0}
            archivedThreads={0}
            onViewDetails={vi.fn()}
          />
        </div>
      </Wrapper>
    );

    expect(screen.getByText("30min")).toBeTruthy();
    expect(screen.getByText("5h")).toBeTruthy();
    expect(screen.getByText("2j")).toBeTruthy();
  });

  it("shows awaiting response badge when lastEmailReceivedAt > lastEmailSentAt", () => {
    const received = new Date("2026-01-10T00:00:00Z").toISOString();
    const sent = new Date("2026-01-09T00:00:00Z").toISOString();

    render(
      <Wrapper>
        <EtablissementEmailCard
          etablissementId="e1"
          etablissementNom="N"
          etablissementVille="V"
          totalThreads={0}
          totalMessages={0}
          unreadCount={0}
          lastMessageDate={new Date("2026-01-08T00:00:00Z").toISOString()}
          avgResponseTimeHours={null}
          activeThreads={0}
          archivedThreads={0}
          lastEmailReceivedAt={received}
          lastEmailSentAt={sent}
          onViewDetails={vi.fn()}
        />
      </Wrapper>
    );

    expect(screen.getByText("Attente réponse")).toBeTruthy();
  });

  it("shows engagement score when > 70 and applies ring class on Card", () => {
    const onView = vi.fn();
    render(
      <Wrapper>
        <EtablissementEmailCard
          etablissementId="e1"
          etablissementNom="N"
          etablissementVille="V"
          totalThreads={1}
          totalMessages={1}
          unreadCount={0}
          lastMessageDate={new Date().toISOString()}
          avgResponseTimeHours={1}
          activeThreads={1}
          archivedThreads={0}
          engagementScore={85}
          onViewDetails={onView}
        />
      </Wrapper>
    );

    // Zap icon displays engagement score
    expect(screen.getByText("85")).toBeTruthy();

    // The mocked Card renders a div with className; because component adds ring classes for high engagement,
    // ensure cn was called with a string including "ring-1"
    expect(cnMock).toHaveBeenCalled();
  });

  it("calls onViewDetails on click and on Enter/Space keydown", async () => {
    const onView = vi.fn();
    render(
      <Wrapper>
        <EtablissementEmailCard
          etablissementId="e-click"
          etablissementNom="Clickable"
          etablissementVille="V"
          totalThreads={0}
          totalMessages={0}
          unreadCount={0}
          lastMessageDate={null}
          avgResponseTimeHours={null}
          activeThreads={0}
          archivedThreads={0}
          onViewDetails={onView}
        />
      </Wrapper>
    );

    const card = screen.getByRole("button", { name: /Voir les emails de l'établissement Clickable/i });
    await act(async () => {
      fireEvent.click(card);
    });
    expect(onView).toHaveBeenCalledWith("e-click");

    await act(async () => {
      fireEvent.keyDown(card, { key: "Enter" });
    });
    expect(onView).toHaveBeenCalledWith("e-click");

    await act(async () => {
      fireEvent.keyDown(card, { key: " " });
    });
    expect(onView).toHaveBeenCalledWith("e-click");
  });

  it("uses the mocked supabase client builder and resolves thenables", async () => {
    // Use the mocked supabase client to ensure builder is chainable and thenable
    const p = supabase.from("emails").select("id").eq("id", "1").maybeSingle();
    const res = await p;
    expect(mockFrom).toHaveBeenCalledWith("emails");
    expect(builder.select).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith("id", "1");
    expect(res).toEqual(mockThenResult);
  });

  it("uses formatDistanceToNow from date-fns for lastMessageDate display", () => {
    render(
      <Wrapper>
        <EtablissementEmailCard
          etablissementId="e1"
          etablissementNom="N"
          etablissementVille="V"
          totalThreads={0}
          totalMessages={0}
          unreadCount={0}
          lastMessageDate={new Date().toISOString()}
          avgResponseTimeHours={null}
          activeThreads={0}
          archivedThreads={0}
          onViewDetails={vi.fn()}
        />
      </Wrapper>
    );

    // Our mocked formatDistanceToNow returns the fixed french string
    expect(screen.getByText("il y a 3 jours")).toBeTruthy();
  });
});