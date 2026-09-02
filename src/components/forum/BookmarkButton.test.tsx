/* @vitest-environment jsdom */
import React from "react";
import { act, fireEvent, render, screen, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BookmarkButton } from "./BookmarkButton";

const {
  AUTH_STATE,
  BOOKMARKS_EMPTY,
  BOOKMARKS_WITH_POST,
  mutateSpy,
  toastErrorSpy,
  toastSuccessSpy,
  useEtablissementUserMock,
  useForumBookmarksMock,
  useToggleBookmarkMock,
  mockFrom,
  supabaseBuilder,
} = vi.hoisted(() => {
  const builder: {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    gte: ReturnType<typeof vi.fn>;
    lte: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    then: ReturnType<typeof vi.fn>;
    catch: ReturnType<typeof vi.fn>;
  } = {
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
    single: vi.fn(),
    maybeSingle: vi.fn(),
    then: vi.fn(),
    catch: vi.fn(),
  };

  builder.select.mockImplementation(() => builder);
  builder.eq.mockImplementation(() => builder);
  builder.gte.mockImplementation(() => builder);
  builder.lte.mockImplementation(() => builder);
  builder.in.mockImplementation(() => builder);
  builder.order.mockImplementation(() => builder);
  builder.limit.mockImplementation(() => builder);
  builder.insert.mockImplementation(() => builder);
  builder.update.mockImplementation(() => builder);
  builder.delete.mockImplementation(() => builder);
  builder.upsert.mockImplementation(() => builder);
  builder.single.mockResolvedValue({ data: null, error: null });
  builder.maybeSingle.mockResolvedValue({ data: null, error: null });
  builder.then.mockImplementation((onFulfilled?: (value: { data: null; error: null }) => unknown) =>
    Promise.resolve({ data: null, error: null }).then(onFulfilled),
  );
  builder.catch.mockImplementation((onRejected?: (reason: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null }).catch(onRejected),
  );

  return {
    AUTH_STATE: {
      user: { id: "u1", email: "t@t.co" },
      session: { user: { id: "u1" } },
      etablissementUser: { id: "u1", email: "t@t.co" },
      isLoading: false,
    },
    BOOKMARKS_EMPTY: [] as string[],
    BOOKMARKS_WITH_POST: ["post-1"] as string[],
    mutateSpy: vi.fn(),
    toastErrorSpy: vi.fn(),
    toastSuccessSpy: vi.fn(),
    useEtablissementUserMock: vi.fn(),
    useForumBookmarksMock: vi.fn(),
    useToggleBookmarkMock: vi.fn(),
    mockFrom: vi.fn(() => builder),
    supabaseBuilder: builder,
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
    variant,
    size,
  }: {
    children: React.ReactNode;
    onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
    disabled?: boolean;
    className?: string;
    variant?: string;
    size?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={className}
      data-variant={variant}
      data-size={size}
    >
      {children}
    </button>
  ),
}));

vi.mock("lucide-react", () => ({
  Star: ({ className }: { className?: string }) => (
    <svg data-testid="star-icon" className={className} />
  ),
}));

vi.mock("@/hooks/forum/useForumBookmarks", () => ({
  useToggleBookmark: useToggleBookmarkMock,
  useForumBookmarks: useForumBookmarksMock,
}));

vi.mock("@/hooks/crm/useEtablissementUser", () => ({
  useEtablissementUser: useEtablissementUserMock,
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastErrorSpy,
    success: toastSuccessSpy,
  },
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

describe("BookmarkButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockFrom.mockReturnValue(supabaseBuilder);

    useEtablissementUserMock.mockReturnValue({
      etablissementUser: AUTH_STATE.etablissementUser,
    });

    useForumBookmarksMock.mockReturnValue({
      data: BOOKMARKS_EMPTY,
      isLoading: false,
      isError: false,
      error: null,
    });

    useToggleBookmarkMock.mockReturnValue({
      mutate: mutateSpy,
      isPending: false,
      isError: false,
      error: null,
    });
  });

  it("utilise un wrapper QueryClientProvider compatible avec renderHook", () => {
    const wrapper = createWrapper();

    const { result } = renderHook(
      () => ({
        auth: useEtablissementUserMock(),
        bookmarks: useForumBookmarksMock(),
        toggle: useToggleBookmarkMock(),
      }),
      { wrapper },
    );

    expect(result.current.auth.etablissementUser).toEqual(AUTH_STATE.etablissementUser);
    expect(result.current.bookmarks.data).toBe(BOOKMARKS_EMPTY);
    expect(result.current.toggle.mutate).toBe(mutateSpy);
  });

  it("affiche l'état par défaut non favori avec le bon texte et les props transmises", () => {
    render(<BookmarkButton postId="post-1" variant="outline" size="sm" />, {
      wrapper: createWrapper(),
    });

    const button = screen.getByRole("button", { name: "Favoris" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("data-variant", "outline");
    expect(button).toHaveAttribute("data-size", "sm");
    expect(button).not.toBeDisabled();
    expect(button.className).not.toContain("text-yellow-500");
    expect(button.className).toContain("gap-2");

    const star = screen.getByTestId("star-icon");
    expect(String(star.getAttribute("class"))).not.toContain("fill-current");
    expect(String(star.getAttribute("class"))).toContain("h-4");
  });

  it("affiche l'état favori quand le post est déjà bookmarké", () => {
    useForumBookmarksMock.mockReturnValue({
      data: BOOKMARKS_WITH_POST,
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<BookmarkButton postId="post-1" />, {
      wrapper: createWrapper(),
    });

    const button = screen.getByRole("button", { name: "Favori" });
    expect(button).toBeInTheDocument();
    expect(button.className).toContain("text-yellow-500");
    expect(button.className).toContain("hover:text-yellow-600");

    const star = screen.getByTestId("star-icon");
    expect(String(star.getAttribute("class"))).toContain("fill-current");
  });

  it("masque le texte quand size vaut icon", () => {
    render(<BookmarkButton postId="post-1" size="icon" />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByRole("button")).toBeInTheDocument();
    expect(screen.queryByText("Favoris")).not.toBeInTheDocument();
    expect(screen.queryByText("Favori")).not.toBeInTheDocument();
  });

  it("déclenche la mutation avec isBookmarked=false pour un post non bookmarké", async () => {
    render(<BookmarkButton postId="post-1" />, {
      wrapper: createWrapper(),
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Favoris" }));
    });

    expect(mutateSpy).toHaveBeenCalledTimes(1);
    expect(mutateSpy).toHaveBeenCalledWith({
      postId: "post-1",
      isBookmarked: false,
    });
    expect(toastErrorSpy).not.toHaveBeenCalled();
  });

  it("déclenche la mutation avec isBookmarked=true pour retirer un favori existant", async () => {
    useForumBookmarksMock.mockReturnValue({
      data: BOOKMARKS_WITH_POST,
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<BookmarkButton postId="post-1" />, {
      wrapper: createWrapper(),
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Favori" }));
    });

    expect(mutateSpy).toHaveBeenCalledTimes(1);
    expect(mutateSpy).toHaveBeenCalledWith({
      postId: "post-1",
      isBookmarked: true,
    });
  });

  it("affiche une erreur toast et ne mutate pas si l'utilisateur n'est pas connecté", async () => {
    useEtablissementUserMock.mockReturnValue({
      etablissementUser: null,
    });

    render(<BookmarkButton postId="post-1" />, {
      wrapper: createWrapper(),
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Favoris" }));
    });

    expect(toastErrorSpy).toHaveBeenCalledTimes(1);
    expect(toastErrorSpy).toHaveBeenCalledWith("Vous devez être connecté pour ajouter aux favoris");
    expect(mutateSpy).not.toHaveBeenCalled();
  });

  it("désactive le bouton pendant une mutation en cours", () => {
    useToggleBookmarkMock.mockReturnValue({
      mutate: mutateSpy,
      isPending: true,
      isError: false,
      error: null,
    });

    render(<BookmarkButton postId="post-1" />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByRole("button", { name: "Favoris" })).toBeDisabled();
  });

  it("gère le chargement des bookmarks en utilisant la valeur par défaut vide puis le succès", () => {
    useForumBookmarksMock.mockReturnValueOnce({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    });

    const { rerender } = render(<BookmarkButton postId="post-1" />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByRole("button", { name: "Favoris" })).toBeInTheDocument();
    expect(String(screen.getByTestId("star-icon").getAttribute("class"))).not.toContain("fill-current");

    useForumBookmarksMock.mockReturnValue({
      data: BOOKMARKS_WITH_POST,
      isLoading: false,
      isError: false,
      error: null,
    });

    rerender(<BookmarkButton postId="post-1" />);

    expect(screen.getByRole("button", { name: "Favori" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Favori" }).className).toContain("text-yellow-500");
    expect(String(screen.getByTestId("star-icon").getAttribute("class"))).toContain("fill-current");
  });

  it("passe en état d'erreur du hook bookmarks avec data undefined sans casser le rendu", () => {
    useForumBookmarksMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: { message: "x" },
    });

    render(<BookmarkButton postId="post-1" />, {
      wrapper: createWrapper(),
    });

    const button = screen.getByRole("button", { name: "Favoris" });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
    expect(button.className).not.toContain("text-yellow-500");
    expect(String(screen.getByTestId("star-icon").getAttribute("class"))).not.toContain("fill-current");
  });
});