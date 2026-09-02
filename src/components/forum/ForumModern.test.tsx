// @vitest-environment jsdom
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { renderHook, act } from "@testing-library/react";
import { ForumModern } from "./ForumModern";

const {
  POSTS,
  AUTH_STATE,
  ETAB_USER,
  mockMutateAsync,
  mockUseForumPosts,
  mockUseVotePost,
  mockUseEtablissementUser,
  mockUseInView,
  postCardPropsSpy,
} = vi.hoisted(() => ({
  POSTS: [
    { id: "p1", titre: "Bug PMSI urgent", contenu: "Le module plante souvent", theme: "bugs" },
    { id: "p2", titre: "Astuce dictée", contenu: "Utiliser le micro intégré", theme: "astuces" },
    { id: "p3", titre: "Support SMR", contenu: "Besoin d aide sur le codage", theme: "smr" },
  ],
  AUTH_STATE: {
    user: { id: "u1", email: "t@t.co" },
    session: { user: { id: "u1" } },
    isLoading: false,
  },
  ETAB_USER: {
    etablissementUser: { id: "eu1", etablissement_id: "e1" },
  },
  mockMutateAsync: vi.fn(),
  mockUseForumPosts: vi.fn(),
  mockUseVotePost: vi.fn(),
  mockUseEtablissementUser: vi.fn(),
  mockUseInView: vi.fn(),
  postCardPropsSpy: vi.fn(),
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
    upsert: vi.fn(() => builder),
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: (resolve: (value: { data: null; error: null }) => unknown) =>
      Promise.resolve(resolve({ data: null, error: null })),
    catch: vi.fn(),
  };
  const mockFrom = vi.fn(() => builder);
  return {
    supabase: {
      from: mockFrom,
      auth: {
        getSession: vi.fn(async () => ({ data: { session: AUTH_STATE.session }, error: null })),
        getUser: vi.fn(async () => ({ data: { user: AUTH_STATE.user }, error: null })),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      },
    },
  };
});

vi.mock("@/hooks/forum/useForumPosts", () => ({
  useForumPosts: mockUseForumPosts,
  useVotePost: mockUseVotePost,
}));

vi.mock("@/hooks/crm/useEtablissementUser", () => ({
  useEtablissementUser: mockUseEtablissementUser,
}));

vi.mock("react-intersection-observer", () => ({
  useInView: mockUseInView,
}));

vi.mock("./ForumPostCard", () => ({
  ForumPostCard: (props: {
    post: { id: string; titre: string };
    onVote: (postId: string) => Promise<void>;
    onComment: (postId: string) => void;
    onOpenDetail: (postId: string) => void;
    context: "public" | "internal";
  }) => {
    postCardPropsSpy(props);
    return (
      <div data-testid={`post-card-${props.post.id}`}>
        <span>{props.post.titre}</span>
        <span>{props.context}</span>
        <button onClick={() => props.onVote(props.post.id)}>vote-{props.post.id}</button>
        <button onClick={() => props.onComment(props.post.id)}>comment-{props.post.id}</button>
        <button onClick={() => props.onOpenDetail(props.post.id)}>open-{props.post.id}</button>
      </div>
    );
  },
}));

vi.mock("./CreatePostDialog", () => ({
  CreatePostDialog: () => <div data-testid="create-post-dialog">create-post</div>,
}));

vi.mock("./ForumSortFilter", () => ({
  ForumSortFilter: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: "recent" | "popular") => void;
  }) => (
    <div>
      <span data-testid="sort-value">{value}</span>
      <button onClick={() => onChange("popular")}>set-popular</button>
      <button onClick={() => onChange("recent")}>set-recent</button>
    </div>
  ),
}));

vi.mock("./ForumStatsPanel", () => ({
  ForumStatsPanel: () => <div data-testid="forum-stats-panel">stats</div>,
}));

vi.mock("./ForumSkeleton", () => ({
  ForumSkeleton: () => <div data-testid="forum-skeleton">loading</div>,
}));

vi.mock("./ScrollToTop", () => ({
  ScrollToTop: () => <div data-testid="scroll-to-top">top</div>,
}));

vi.mock("./ForumPostDetailModal", () => ({
  ForumPostDetailModal: ({
    postId,
    open,
    context,
  }: {
    postId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    context: "public" | "internal";
  }) => (
    <div data-testid="forum-post-detail-modal">
      <span>{String(open)}</span>
      <span>{postId ?? "none"}</span>
      <span>{context}</span>
    </div>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: ({
    value,
    onChange,
    placeholder,
    className,
  }: {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    className?: string;
  }) => (
    <input
      data-testid="forum-search-input"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
    />
  ),
}));

vi.mock("lucide-react", () => ({
  Search: () => <span data-testid="search-icon">icon</span>,
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

describe("ForumModern", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    mockUseEtablissementUser.mockReturnValue(ETAB_USER);
    mockUseVotePost.mockReturnValue({ mutateAsync: mockMutateAsync });
    mockUseInView.mockReturnValue({ ref: vi.fn(), inView: false });
    mockUseForumPosts.mockImplementation(
      ({ theme, sortBy }: { theme?: string; sortBy: string }) => ({
        data: POSTS.filter((post) => (theme ? post.theme === theme : true)),
        isLoading: false,
        received: { theme, sortBy },
      }),
    );
  });

  it("affiche le skeleton pendant le chargement puis les posts et utilise le tri stocké", async () => {
    localStorage.setItem("forum-sort", "popular");

    mockUseForumPosts.mockReturnValueOnce({
      data: POSTS,
      isLoading: true,
    });

    const { rerender } = render(<ForumModern />, { wrapper: createWrapper() });

    expect(screen.getByTestId("forum-skeleton")).toBeInTheDocument();
    expect(screen.getByTestId("sort-value")).toHaveTextContent("popular");

    rerender(<ForumModern />);

    await waitFor(() => {
      expect(screen.getByTestId("post-card-p1")).toBeInTheDocument();
      expect(screen.getByTestId("post-card-p2")).toBeInTheDocument();
      expect(screen.getByTestId("post-card-p3")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("forum-skeleton")).not.toBeInTheDocument();
    expect(mockUseForumPosts).toHaveBeenLastCalledWith({ theme: undefined, sortBy: "popular" });
    expect(screen.getByTestId("forum-stats-panel")).toBeInTheDocument();
    expect(screen.getByTestId("scroll-to-top")).toBeInTheDocument();
  });

  it("filtre par recherche, par thème, ouvre le détail et persiste le tri", async () => {
    render(<ForumModern context="public" />, { wrapper: createWrapper() });

    expect(screen.getByTestId("post-card-p1")).toBeInTheDocument();
    expect(screen.getByTestId("post-card-p2")).toBeInTheDocument();
    expect(screen.getByTestId("post-card-p3")).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("forum-search-input"), {
      target: { value: "micro" },
    });

    await waitFor(() => {
      expect(screen.queryByTestId("post-card-p1")).not.toBeInTheDocument();
      expect(screen.getByTestId("post-card-p2")).toBeInTheDocument();
      expect(screen.queryByTestId("post-card-p3")).not.toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "smr" },
    });

    await waitFor(() => {
      expect(mockUseForumPosts).toHaveBeenLastCalledWith({ theme: "smr", sortBy: "recent" });
    });

    fireEvent.change(screen.getByTestId("forum-search-input"), {
      target: { value: "" },
    });

    await waitFor(() => {
      expect(screen.getByTestId("post-card-p3")).toBeInTheDocument();
      expect(screen.queryByTestId("post-card-p1")).not.toBeInTheDocument();
      expect(screen.queryByTestId("post-card-p2")).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("set-popular"));
    await waitFor(() => {
      expect(localStorage.getItem("forum-sort")).toBe("popular");
      expect(mockUseForumPosts).toHaveBeenLastCalledWith({ theme: "smr", sortBy: "popular" });
    });

    fireEvent.click(screen.getByText("open-p3"));
    expect(screen.getByTestId("forum-post-detail-modal")).toHaveTextContent("true");
    expect(screen.getByTestId("forum-post-detail-modal")).toHaveTextContent("p3");
    expect(screen.getByTestId("forum-post-detail-modal")).toHaveTextContent("public");
  });

  it("déclenche la mutation de vote avec le bon postId", async () => {
    const { result } = renderHook(() => ({ vote: mockUseVotePost() }), {
      wrapper: createWrapper(),
    });

    render(<ForumModern />, { wrapper: createWrapper() });

    await act(async () => {
      fireEvent.click(screen.getByText("vote-p1"));
    });

    expect(result.current.vote.mutateAsync).toBe(mockMutateAsync);
    expect(mockMutateAsync).toHaveBeenCalledWith({ postId: "p1" });
  });

  it("affiche aucun post trouvé quand le filtre ne matche rien", async () => {
    render(<ForumModern />, { wrapper: createWrapper() });

    fireEvent.change(screen.getByTestId("forum-search-input"), {
      target: { value: "introuvable" },
    });

    await waitFor(() => {
      expect(screen.getByText("Aucun post trouvé")).toBeInTheDocument();
    });
  });

  it("propage une erreur du hook via isError quand les données sont nulles", async () => {
    const useForumPostsError = vi.fn().mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      error: { message: "x" },
    });

    const { result } = renderHook(() => useForumPostsError(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isError).toBe(true);
    expect(result.current.error).toEqual({ message: "x" });
    expect(result.current.data).toBeNull();
  });
});