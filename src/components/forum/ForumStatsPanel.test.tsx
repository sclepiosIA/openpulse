import React from "react";
import { render, screen, act } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const {
  POSTS,
  TOP_CONTRIBS,
  POSTS_LOADING,
  POSTS_SUCCESS,
  POSTS_ERROR,
  TOP_LOADING,
  TOP_SUCCESS,
  TOP_EMPTY,
  useForumPostsMock,
  useTopContributorsMock,
  ForumAvatarMock,
  SUPABASE_BUILDER,
  mockFrom
} = vi.hoisted(() => {
  const POSTS = [
    { id: "p1", nombre_commentaires: 2, nombre_vues: 10, theme: "pmsi" },
    { id: "p2", nombre_commentaires: 0, nombre_vues: 5, theme: "pmsi" },
    { id: "p3", nombre_commentaires: 1, nombre_vues: 0, theme: "smr" }
  ];
  const TOP_CONTRIBS = [
    {
      id: "c1",
      etablissement_users: { nom: "Doe", prenom: "John" },
      posts_count: 5,
      reputation_score: 100,
      badges: [{ name: "Gold", icon: "🏆" }]
    }
  ];

  const POSTS_LOADING = { data: undefined, isLoading: true, isError: false };
  const POSTS_SUCCESS = { data: POSTS, isLoading: false, isError: false };
  const POSTS_ERROR = { data: null, error: { message: "simulated failure" }, isError: true, isLoading: false };

  const TOP_LOADING = { data: undefined, isLoading: true, isError: false };
  const TOP_SUCCESS = { data: TOP_CONTRIBS, isLoading: false, isError: false };
  const TOP_EMPTY = { data: null, isLoading: false, isError: false };

  const useForumPostsMock = vi.fn(() => POSTS_LOADING);
  const useTopContributorsMock = vi.fn(() => TOP_LOADING);

  const ForumAvatarMock = vi.fn((props: any) => {
    const { prenom, nom, className } = props;
    return React.createElement("div", { "data-testid": "forum-avatar", className }, `${prenom} ${nom}`);
  });

  function makeBuilder() {
    const builder: any = {
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
      single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
      then: vi.fn((onFulfilled: any) => Promise.resolve(onFulfilled({ data: null, error: null }))),
      catch: vi.fn((onRejected: any) => Promise.resolve(onRejected && onRejected(null)))
    };
    return builder;
  }

  const SUPABASE_BUILDER = makeBuilder();
  const mockFrom = vi.fn(() => SUPABASE_BUILDER);

  return {
    POSTS,
    TOP_CONTRIBS,
    POSTS_LOADING,
    POSTS_SUCCESS,
    POSTS_ERROR,
    TOP_LOADING,
    TOP_SUCCESS,
    TOP_EMPTY,
    useForumPostsMock,
    useTopContributorsMock,
    ForumAvatarMock,
    SUPABASE_BUILDER,
    mockFrom
  };
});

// Mocks for internal imports
vi.mock("@/hooks/forum/useForumPosts", () => ({ useForumPosts: useForumPostsMock }));
vi.mock("@/hooks/forum/useForumBookmarks", () => ({ useTopContributors: useTopContributorsMock }));
vi.mock("./ForumAvatar", () => ({ ForumAvatar: ForumAvatarMock }));

vi.mock("@/components/ui/card", () => {
  const Card = (props: any) => React.createElement("div", { "data-testid": "card", ...props }, props.children);
  const CardContent = (props: any) => React.createElement("div", { "data-testid": "card-content" }, props.children);
  const CardHeader = (props: any) => React.createElement("div", { "data-testid": "card-header" }, props.children);
  const CardTitle = (props: any) => React.createElement("h3", { "data-testid": "card-title" }, props.children);
  return { Card, CardContent, CardHeader, CardTitle };
});

vi.mock("@/components/ui/badge", () => {
  return { Badge: (props: any) => React.createElement("span", { "data-testid": "badge" }, props.children) };
});

vi.mock("lucide-react", () => ({
  TrendingUp: () => React.createElement("span", { "data-testid": "icon-trending" }, "T"),
  Trophy: () => React.createElement("span", { "data-testid": "icon-trophy" }, "Tr"),
  MessageSquare: () => React.createElement("span", { "data-testid": "icon-message" }, "M"),
  FileText: () => React.createElement("span", { "data-testid": "icon-file" }, "F")
}));

// Supabase client mock as requested by rules (stable builder)
vi.mock("@/integrations/supabase/client", () => {
  return { supabase: { from: mockFrom, auth: { user: vi.fn() } } };
});

// Common external module mocks
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("react-router", () => ({ useNavigate: () => vi.fn() }));

import { ForumStatsPanel } from "./ForumStatsPanel";

const createQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } } });

const renderWithClient = (ui: React.ReactElement) => {
  const client = createQueryClient();
  return render(React.createElement(QueryClientProvider, { client }, ui));
};

function findStatValueForLabel(labelText: string) {
  const labelEl = screen.getByText(labelText);
  let el: HTMLElement | null = labelEl as HTMLElement | null;
  while (el && el.parentElement) {
    const siblings = Array.from(el.parentElement.children);
    const numeric = siblings.find((s) => {
      if (s === el) return false;
      const txt = s.textContent?.trim() ?? "";
      return /^\d+$/.test(txt);
    }) as HTMLElement | undefined;
    if (numeric) return numeric;
    el = el.parentElement;
  }
  throw new Error(`Numeric stat for label "${labelText}" not found`);
}

describe("ForumStatsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // default to loading states
    useForumPostsMock.mockReturnValue(POSTS_LOADING);
    useTopContributorsMock.mockReturnValue(TOP_LOADING);
  });

  it("renders loading state and shows zeros when posts are loading", async () => {
    // Ensure hooks return loading (stable objects from hoisted)
    useForumPostsMock.mockReturnValue(POSTS_LOADING);
    useTopContributorsMock.mockReturnValue(TOP_LOADING);

    const queryClient = createQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useForumPostsMock(), { wrapper });
    expect(result.current.isLoading).toBe(true);
    expect(useForumPostsMock).toHaveBeenCalled();

    renderWithClient(React.createElement(ForumStatsPanel, null));

    expect(screen.getByText("Posts")).toBeTruthy();
    expect(screen.getByText("Commentaires")).toBeTruthy();

    const postsValue = findStatValueForLabel("Posts");
    const commentsValue = findStatValueForLabel("Commentaires");
    expect(postsValue.textContent?.trim()).toBe("0");
    expect(commentsValue.textContent?.trim()).toBe("0");

    expect(screen.queryByTestId("icon-trophy")).toBeNull();
  });

  it("renders statistics, top contributors and trending themes on success", async () => {
    useForumPostsMock.mockReturnValue(POSTS_SUCCESS);
    useTopContributorsMock.mockReturnValue(TOP_SUCCESS);

    renderWithClient(React.createElement(ForumStatsPanel, null));

    const postsValue = findStatValueForLabel("Posts");
    expect(postsValue.textContent?.trim()).toBe(String(POSTS.length));

    const expectedComments = POSTS.reduce((s, p) => s + (p.nombre_commentaires || 0), 0);
    const commentsValue = findStatValueForLabel("Commentaires");
    expect(commentsValue.textContent?.trim()).toBe(String(expectedComments));

    const avatars = screen.getAllByTestId("forum-avatar");
    expect(avatars.length).toBeGreaterThanOrEqual(1);
    expect(avatars.some((a) => a.textContent?.includes("John") && a.textContent?.includes("Doe"))).toBe(true);

    expect(screen.getAllByText("John Doe").length).toBeGreaterThanOrEqual(1);

    expect(screen.getByText(`${TOP_CONTRIBS[0].posts_count} posts`)).toBeTruthy();
    expect(screen.getByText(String(TOP_CONTRIBS[0].reputation_score))).toBeTruthy();

    // contributor badge icon rendered as text inside span
    expect(screen.getByText("🏆")).toBeTruthy();

    // Trending themes: PMSI count 2, SMR count 1
    expect(screen.getByText("PMSI")).toBeTruthy();
    const badges = screen.getAllByTestId("badge");
    expect(badges.some((b) => b.textContent?.trim() === "2")).toBe(true);
    expect(badges.some((b) => b.textContent?.trim() === "1")).toBe(true);
  });

  it("handles error state from posts hook by showing zeros and not rendering trends/top contributors", async () => {
    useForumPostsMock.mockReturnValue(POSTS_ERROR);
    useTopContributorsMock.mockReturnValue(TOP_EMPTY);

    renderWithClient(React.createElement(ForumStatsPanel, null));

    expect(useForumPostsMock).toHaveBeenCalled();

    const postsValue = findStatValueForLabel("Posts");
    const commentsValue = findStatValueForLabel("Commentaires");
    expect(postsValue.textContent?.trim()).toBe("0");
    expect(commentsValue.textContent?.trim()).toBe("0");

    expect(screen.queryByText("🔥 Tendances")).toBeNull();
    expect(screen.queryByTestId("icon-trophy")).toBeNull();
  });
});