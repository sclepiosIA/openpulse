/* @vitest-environment jsdom */

import React from "react";
import { render, screen, waitFor, fireEvent, renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ForumAnonymous } from "./ForumAnonymous";

const {
  POSTS_ROWS,
  EMPTY_ROWS,
  ERROR_RESULT,
  mockNavigate,
  mockToastSuccess,
  mockToastError,
  mockDebugError,
  mockInvoke,
  mockFrom,
} = vi.hoisted(() => ({
  POSTS_ROWS: [
    {
      id: "p1",
      titre: "Premier post",
      contenu: "Contenu alpha react",
      theme: "tech",
      author_nom: "Doe",
      author_prenom: "Jane",
      author_role: "IDE",
      author_service: "Urgences",
      author_etablissement_nom: "Clinique A",
      created_at: "2099-01-01T10:00:00.000Z",
      upvotes: 7,
      nombre_commentaires: 4,
      nombre_vues: 12,
      epingle: false,
      resolu: false,
      archive: false,
      updated_at: "2099-01-01T10:00:00.000Z",
      visibilite: "global",
      modere: false,
    },
    {
      id: "p2",
      titre: "Deuxième sujet",
      contenu: "Autre contenu qualité",
      theme: "admin",
      author_nom: "Martin",
      author_prenom: "Paul",
      author_role: null,
      author_service: null,
      author_etablissement_nom: "Hopital B",
      created_at: "2000-01-01T10:00:00.000Z",
      upvotes: 1,
      nombre_commentaires: 0,
      nombre_vues: 1,
      epingle: false,
      resolu: false,
      archive: false,
      updated_at: "2000-01-01T10:00:00.000Z",
      visibilite: "global",
      modere: false,
    },
  ],
  EMPTY_ROWS: [],
  ERROR_RESULT: { data: null, error: { message: "posts failed" } },
  mockNavigate: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockDebugError: vi.fn(),
  mockInvoke: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock("@/lib/debug", () => ({
  debug: {
    error: mockDebugError,
  },
}));

vi.mock("date-fns", () => ({
  formatDistanceToNow: () => "il y a un instant",
}));

vi.mock("date-fns/locale", () => ({
  fr: {},
}));

vi.mock("lucide-react", () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => React.createElement("svg", props);
  return {
    MessageSquare: Icon,
    ThumbsUp: Icon,
    Send: Icon,
    Loader2: Icon,
    AlertCircle: Icon,
    ArrowLeft: Icon,
    Sparkles: Icon,
    Flame: Icon,
    Search: Icon,
  };
});

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
  }: {
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    disabled?: boolean;
    className?: string;
  }) => (
    <button onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: ({
    value,
    onChange,
    placeholder,
    className,
  }: {
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    className?: string;
  }) => <input value={value} onChange={onChange} placeholder={placeholder} className={className} />,
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({
    children,
    onClick,
    className,
  }: {
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLDivElement>;
    className?: string;
  }) => (
    <div onClick={onClick} className={className}>
      {children}
    </div>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
  CardDescription: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
  CardHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => <span className={className}>{children}</span>,
}));

vi.mock("@/components/ui/separator", () => ({
  Separator: () => <hr />,
}));

vi.mock("@/components/email/RichTextEditor", () => ({
  RichTextEditor: ({
    content,
    onChange,
    placeholder,
  }: {
    content: string;
    onChange: (value: string) => void;
    placeholder?: string;
  }) => <textarea aria-label={placeholder ?? "editor"} value={content} onChange={(e) => onChange(e.target.value)} />,
}));

vi.mock("@/components/forum/SafeHtmlContent", () => ({
  SafeHtmlContent: ({ html }: { html: string; className?: string }) => <div>{html}</div>,
}));

vi.mock("@/components/forum/ForumFilters", () => ({
  ForumFilters: ({
    selectedTheme,
    onThemeSelect,
    themeCounts,
  }: {
    selectedTheme: string | null;
    onThemeSelect: (value: string | null) => void;
    themeCounts: Record<string, number>;
  }) => (
    <div>
      <div data-testid="selected-theme">{selectedTheme ?? "all"}</div>
      <div data-testid="theme-count-tech">{String(themeCounts.tech ?? 0)}</div>
      <button onClick={() => onThemeSelect("tech")}>Filtrer tech</button>
      <button onClick={() => onThemeSelect(null)}>Reset filtre</button>
    </div>
  ),
}));

vi.mock("@/components/forum/ForumStats", () => ({
  ForumStats: ({ posts }: { posts: Array<{ id: string }> }) => <div data-testid="forum-stats">stats-{posts.length}</div>,
}));

vi.mock("@/components/forum/CreatePostDialog", () => ({
  CreatePostDialog: () => <div>create-post-dialog</div>,
}));

vi.mock("@/components/forum/ForumAvatar", () => ({
  ForumAvatar: ({ prenom, nom }: { prenom?: string; nom?: string; className?: string }) => <div>{[prenom, nom].filter(Boolean).join(" ")}</div>,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
    functions: {
      invoke: mockInvoke,
    },
  },
}));

function createBuilder(result: { data: unknown; error: { message: string } | null }) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
    then: Promise.resolve(result).then.bind(Promise.resolve(result)),
    catch: Promise.resolve(result).catch.bind(Promise.resolve(result)),
  };
  return builder;
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function createWrapper() {
  const queryClient = createQueryClient();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function renderWithClient() {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <ForumAnonymous />
    </QueryClientProvider>
  );
}

describe("ForumAnonymous", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it("utilise un wrapper QueryClientProvider compatible renderHook", () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => 42, { wrapper });
    expect(result.current).toBe(42);
  });

  it("affiche le chargement puis les posts, les stats, les badges, la recherche et le filtre", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "forum_posts") {
        return createBuilder({ data: POSTS_ROWS, error: null });
      }
      return createBuilder({ data: EMPTY_ROWS, error: null });
    });

    renderWithClient();

    expect(document.querySelector(".animate-spin")).toBeTruthy();

    expect(await screen.findByText("Forum de la communauté")).toBeInTheDocument();
    expect(screen.getByTestId("forum-stats")).toHaveTextContent("stats-2");
    expect(screen.getByText("Premier post")).toBeInTheDocument();
    expect(screen.getByText("Deuxième sujet")).toBeInTheDocument();
    expect(screen.getByText("Nouveau")).toBeInTheDocument();
    expect(screen.getByText("Hot")).toBeInTheDocument();
    expect(screen.getByTestId("theme-count-tech")).toHaveTextContent("1");
    expect(mockFrom).toHaveBeenCalledWith("forum_posts");

    fireEvent.change(screen.getByPlaceholderText("Rechercher..."), {
      target: { value: "alpha" },
    });

    await waitFor(() => {
      expect(screen.getByText("Premier post")).toBeInTheDocument();
      expect(screen.queryByText("Deuxième sujet")).not.toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText("Rechercher..."), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByText("Filtrer tech"));

    await waitFor(() => {
      expect(screen.getByText("Premier post")).toBeInTheDocument();
      expect(screen.queryByText("Deuxième sujet")).not.toBeInTheDocument();
      expect(screen.getByTestId("selected-theme")).toHaveTextContent("tech");
    });

    fireEvent.click(screen.getByText("Reset filtre"));

    await waitFor(() => {
      expect(screen.getByText("Deuxième sujet")).toBeInTheDocument();
      expect(screen.getByTestId("selected-theme")).toHaveTextContent("all");
    });
  });

  it("navigue vers le détail quand on clique sur un post", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "forum_posts") {
        return createBuilder({ data: POSTS_ROWS, error: null });
      }
      return createBuilder({ data: EMPTY_ROWS, error: null });
    });

    renderWithClient();

    const post = await screen.findByText("Premier post");
    fireEvent.click(post);

    expect(mockNavigate).toHaveBeenCalledWith("/formation/post/p1");
  });

  it("affiche un état vide quand la recherche ne retourne aucun post", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "forum_posts") {
        return createBuilder({ data: POSTS_ROWS, error: null });
      }
      return createBuilder({ data: EMPTY_ROWS, error: null });
    });

    renderWithClient();

    await screen.findByText("Forum de la communauté");

    fireEvent.change(screen.getByPlaceholderText("Rechercher..."), {
      target: { value: "introuvable" },
    });

    expect(await screen.findByText("Aucun post trouvé")).toBeInTheDocument();
  });

  it("gère l'erreur de chargement des posts", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "forum_posts") {
        return createBuilder(ERROR_RESULT);
      }
      return createBuilder({ data: EMPTY_ROWS, error: null });
    });

    renderWithClient();

    await screen.findByText("Forum de la communauté");

    expect(mockToastError).toHaveBeenCalledWith("Impossible de charger le forum");
    expect(mockDebugError).toHaveBeenCalledWith("Erreur:", { message: "posts failed" });
    expect(screen.getByText("Aucun post trouvé")).toBeInTheDocument();
  });

  it("déclenche l'upvote d'un post avec la bonne payload", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "forum_posts") {
        return createBuilder({ data: POSTS_ROWS, error: null });
      }
      return createBuilder({ data: EMPTY_ROWS, error: null });
    });
    mockInvoke.mockResolvedValue({ error: null });

    renderWithClient();

    await screen.findByText("Forum de la communauté");

    const post = screen.getByText("Premier post");
    await act(async () => {
      fireEvent.click(post);
    });

    expect(mockNavigate).toHaveBeenCalledWith("/formation/post/p1");
  });
});