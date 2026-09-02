// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ForumPostDetailModal } from "./ForumPostDetailModal";

const {
  POST,
  AUTH_STATE,
  mockRpc,
  mockFrom,
  mockUseForumPost,
  mockOnOpenChange,
  mockNavigate,
  toastSuccess,
  toastError,
} = vi.hoisted(() => {
  const POST = {
    id: "post-1",
    titre: "Titre du post de test",
    contenu: "Contenu",
  };

  const AUTH_STATE = {
    user: { id: "u1", email: "user@test.local" },
    session: { user: { id: "u1" } },
    isLoading: false,
  };

  const createBuilder = () => {
    const result = { data: null, error: null };
    const builder = {
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
      rpc: vi.fn(),
      single: vi.fn(),
      maybeSingle: vi.fn(),
      then: (onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve(result).then(onFulfilled, onRejected),
      catch: (onRejected?: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
    };

    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.gte.mockReturnValue(builder);
    builder.lte.mockReturnValue(builder);
    builder.in.mockReturnValue(builder);
    builder.order.mockReturnValue(builder);
    builder.limit.mockReturnValue(builder);
    builder.insert.mockReturnValue(builder);
    builder.update.mockReturnValue(builder);
    builder.delete.mockReturnValue(builder);
    builder.upsert.mockReturnValue(builder);
    builder.rpc.mockReturnValue(builder);
    builder.single.mockResolvedValue(result);
    builder.maybeSingle.mockResolvedValue(result);

    return builder;
  };

  return {
    POST,
    AUTH_STATE,
    mockRpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    mockFrom: vi.fn(() => createBuilder()),
    mockUseForumPost: vi.fn(),
    mockOnOpenChange: vi.fn(),
    mockNavigate: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
  },
}));

vi.mock("@/hooks/forum/useForumPosts", () => ({
  useForumPost: mockUseForumPost,
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    open,
    children,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
  }) => (
    <div data-testid="dialog-root" data-open={String(open)}>
      {children}
    </div>
  ),
  DialogContent: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  ),
  DialogHeader: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
  DialogTitle: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <h2 className={className}>{children}</h2>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    "aria-label": ariaLabel,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    "aria-label"?: string;
    className?: string;
  }) => (
    <button type="button" onClick={onClick} aria-label={ariaLabel} className={className}>
      {children}
    </button>
  ),
}));

vi.mock("./ForumPostCard", () => ({
  ForumPostCard: ({
    post,
    context,
  }: {
    post: { id: string; titre: string };
    context: string;
  }) => (
    <div data-testid="forum-post-card">
      <span>{post.id}</span>
      <span>{post.titre}</span>
      <span>{context}</span>
    </div>
  ),
}));

vi.mock("./CommentSection", () => ({
  CommentSection: ({ postId }: { postId: string }) => <div data-testid="comment-section">{postId}</div>,
}));

vi.mock("lucide-react", () => ({
  X: () => <svg data-testid="icon-x" />,
  Loader2: () => <svg data-testid="icon-loader" />,
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => AUTH_STATE,
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

describe("ForumPostDetailModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche l'état de chargement et incrémente les vues quand la modal est ouverte", async () => {
    mockUseForumPost.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    });

    const Wrapper = createWrapper();

    render(
      <Wrapper>
        <ForumPostDetailModal postId="post-1" open={true} onOpenChange={mockOnOpenChange} />
      </Wrapper>,
    );

    expect(screen.getByRole("heading", { name: "Chargement..." })).toBeInTheDocument();
    expect(screen.getByTestId("icon-loader")).toBeInTheDocument();
    expect(screen.queryByTestId("forum-post-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("comment-section")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith("increment_view_count", { post_id: "post-1" });
    });
  });

  it("affiche le post, le contexte transmis, la section commentaires et permet de fermer", () => {
    mockUseForumPost.mockReturnValue({
      data: POST,
      isLoading: false,
      error: null,
    });

    const Wrapper = createWrapper();

    render(
      <Wrapper>
        <ForumPostDetailModal
          postId="post-1"
          open={true}
          onOpenChange={mockOnOpenChange}
          context="public"
        />
      </Wrapper>,
    );

    expect(screen.getByRole("heading", { name: "Titre du post de test" })).toBeInTheDocument();
    expect(screen.getByTestId("forum-post-card")).toHaveTextContent("post-1");
    expect(screen.getByTestId("forum-post-card")).toHaveTextContent("Titre du post de test");
    expect(screen.getByTestId("forum-post-card")).toHaveTextContent("public");
    expect(screen.getByTestId("comment-section")).toHaveTextContent("post-1");
    expect(screen.queryByText("Post introuvable ou erreur de chargement")).not.toBeInTheDocument();
    expect(mockRpc).toHaveBeenCalledWith("increment_view_count", { post_id: "post-1" });

    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it("affiche un message d'erreur quand le hook retourne une erreur", () => {
    mockUseForumPost.mockReturnValue({
      data: null,
      isLoading: false,
      error: { message: "x" },
    });

    const Wrapper = createWrapper();

    render(
      <Wrapper>
        <ForumPostDetailModal postId="post-1" open={true} onOpenChange={mockOnOpenChange} />
      </Wrapper>,
    );

    expect(screen.getByText("Post introuvable ou erreur de chargement")).toBeInTheDocument();
    expect(screen.queryByTestId("forum-post-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("comment-section")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Chargement..." })).toBeInTheDocument();
  });

  it("affiche un message d'erreur quand aucun post n'est trouvé après chargement", () => {
    mockUseForumPost.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });

    const Wrapper = createWrapper();

    render(
      <Wrapper>
        <ForumPostDetailModal postId="post-missing" open={true} onOpenChange={mockOnOpenChange} />
      </Wrapper>,
    );

    expect(screen.getByText("Post introuvable ou erreur de chargement")).toBeInTheDocument();
    expect(screen.queryByTestId("forum-post-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("comment-section")).not.toBeInTheDocument();
    expect(mockRpc).toHaveBeenCalledWith("increment_view_count", { post_id: "post-missing" });
  });

  it("n'incrémente pas les vues si la modal est fermée", async () => {
    mockUseForumPost.mockReturnValue({
      data: POST,
      isLoading: false,
      error: null,
    });

    const Wrapper = createWrapper();

    render(
      <Wrapper>
        <ForumPostDetailModal postId="post-1" open={false} onOpenChange={mockOnOpenChange} />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(mockRpc).not.toHaveBeenCalled();
    });

    expect(screen.getByTestId("forum-post-card")).toHaveTextContent("Titre du post de test");
  });
});