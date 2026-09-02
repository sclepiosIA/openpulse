import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const {
  POST_BASE,
  mockFrom,
  supabaseMaybeSingleResolve,
  maskMutateAsync,
  deleteMutateAsync,
  deleteOwnMutateAsync,
  toggleResolvedMutateAsync,
  toastSuccess,
  toastError,
  useIsForumModeratorMock,
  useIsTeamMemberMock,
  useEtablissementUserMock,
} = vi.hoisted(() => {
  const POST_BASE = {
    id: "p1",
    user_id: "u1",
    titre: "Titre du post",
    contenu: "Contenu du post",
    theme: "support",
    author_nom: "Dupont",
    author_prenom: "Jean",
    author_role: "Médecin",
    author_service: "Urgences",
    author_etablissement_nom: "Hôpital A",
    upvotes: 3,
    nombre_commentaires: 2,
    nombre_vues: 10,
    visibilite: "global",
    etablissement_id: "e1",
    resolu: false,
    modere: false,
    raison_moderation: null,
    created_at: "2024-01-15T10:00:00.000Z",
  } as const;

  const supabaseMaybeSingleResolve = vi.fn<
    [],
    Promise<{ data: { role: string } | null; error: { message: string } | null }>
  >();

  type Builder = {
    select: (...args: unknown[]) => Builder;
    eq: (...args: unknown[]) => Builder;
    in: (...args: unknown[]) => Builder;
    maybeSingle: () => ReturnType<typeof supabaseMaybeSingleResolve>;
    single: () => ReturnType<typeof supabaseMaybeSingleResolve>;
    then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => Promise<unknown>;
    catch: (onRejected: (e: unknown) => unknown) => Promise<unknown>;
  };

  const makeBuilder = (): Builder => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      in: vi.fn(() => builder),
      maybeSingle: vi.fn(() => supabaseMaybeSingleResolve()),
      single: vi.fn(() => supabaseMaybeSingleResolve()),
      then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected),
      catch: (onRejected: (e: unknown) => unknown) => Promise.resolve({ data: null, error: null }).catch(onRejected),
    } satisfies Builder;
    return builder;
  };

  const mockFrom = vi.fn(() => makeBuilder());

  const maskMutateAsync = vi.fn<[{ postId: string; reason: string }], Promise<void>>();
  const deleteMutateAsync = vi.fn<[string], Promise<void>>();
  const deleteOwnMutateAsync = vi.fn<[{ postId: string; isTeamMember: boolean; context: "public" | "internal" }], Promise<void>>();
  const toggleResolvedMutateAsync = vi.fn<[{ postId: string; resolu: boolean }], Promise<void>>();

  const toastSuccess = vi.fn<[string], void>();
  const toastError = vi.fn<[string], void>();

  const useIsForumModeratorMock = vi.fn(() => ({ data: true, isLoading: false, isError: false } as const));
  const useIsTeamMemberMock = vi.fn(() => ({ data: false, isLoading: false, isError: false } as const));
  const useEtablissementUserMock = vi.fn(() => ({ etablissementUser: { id: "u1" } as const }));

  return {
    POST_BASE,
    mockFrom,
    supabaseMaybeSingleResolve,
    maskMutateAsync,
    deleteMutateAsync,
    deleteOwnMutateAsync,
    toggleResolvedMutateAsync,
    toastSuccess,
    toastError,
    useIsForumModeratorMock,
    useIsTeamMemberMock,
    useEtablissementUserMock,
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock("@/hooks/forum/useForumModeration", () => ({
  useIsForumModerator: () => useIsForumModeratorMock(),
  useMaskForumPost: () => ({
    mutateAsync: maskMutateAsync,
    isPending: false,
  }),
  useDeleteForumPost: () => ({
    mutateAsync: deleteMutateAsync,
    isPending: false,
  }),
}));

vi.mock("@/hooks/forum/useForumPosts", () => ({
  useDeleteOwnPost: () => ({
    mutateAsync: deleteOwnMutateAsync,
    isPending: false,
  }),
  useToggleResolved: () => ({
    mutateAsync: toggleResolvedMutateAsync,
    isPending: false,
  }),
}));

vi.mock("@/hooks/crm/useEtablissementUser", () => ({
  useEtablissementUser: () => useEtablissementUserMock(),
}));

vi.mock("@/hooks/hr/useTeamMember", () => ({
  useIsTeamMember: () => useIsTeamMemberMock(),
}));

vi.mock("./EditPostDialog", () => ({
  EditPostDialog: () => <div data-testid="edit-post-dialog" />,
}));

vi.mock("./ForumAvatar", () => ({
  ForumAvatar: ({ nom, prenom }: { nom?: string; prenom?: string }) => (
    <div data-testid="forum-avatar">
      {prenom ?? ""} {nom ?? ""}
    </div>
  ),
}));

vi.mock("./PostBadges", () => ({
  PostBadges: ({ upvotes, commentsCount, views }: { upvotes: number; commentsCount: number; views: number }) => (
    <div data-testid="post-badges">
      {upvotes}/{commentsCount}/{views}
    </div>
  ),
}));

vi.mock("./PostPreview", () => ({
  PostPreview: ({ content }: { content: string }) => <div data-testid="post-preview">{content}</div>,
}));

vi.mock("./EmojiReactionPicker", () => ({
  EmojiReactionPicker: ({ targetId, targetType }: { targetId: string; targetType: string }) => (
    <div data-testid="emoji-reaction-picker">
      {targetType}:{targetId}
    </div>
  ),
}));

vi.mock("./UserProfileHoverCard", () => ({
  UserProfileHoverCard: ({ children }: { children: React.ReactNode }) => <div data-testid="user-hover">{children}</div>,
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div data-testid="card-content">{children}</div>,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, disabled, ...rest }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) => (
    <button type="button" onClick={onClick} disabled={disabled} {...rest}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/alert-dialog", () => {
  const ReactMod = React;
  return {
    AlertDialog: ({ children }: { children: React.ReactNode }) => <div data-testid="alert-dialog">{children}</div>,
    AlertDialogTrigger: ({ asChild, children }: { asChild?: boolean; children: React.ReactElement }) =>
      asChild ? children : <button type="button">{children}</button>,
    AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    AlertDialogCancel: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
    AlertDialogAction: ({
      children,
      onClick,
      className,
    }: {
      children: React.ReactNode;
      onClick?: () => void;
      className?: string;
    }) => (
      <button type="button" onClick={onClick} data-classname={className ?? ""}>
        {children}
      </button>
    ),
  };
});

vi.mock("@/components/ui/textarea", () => ({
  Textarea: ({
    value,
    onChange,
    ...rest
  }: {
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  }) => <textarea value={value} onChange={onChange} {...rest} />,
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => <label htmlFor={htmlFor}>{children}</label>,
}));

vi.mock("lucide-react", () => {
  const Icon = ({ "data-testid": dataTestId }: { "data-testid"?: string }) => <span data-testid={dataTestId ?? "icon"} />;
  return {
    ThumbsUp: (p: Record<string, unknown>) => <Icon data-testid="thumbs-up" {...p} />,
    MessageCircle: (p: Record<string, unknown>) => <Icon data-testid="message-circle" {...p} />,
    Eye: (p: Record<string, unknown>) => <Icon data-testid="eye" {...p} />,
    AlertCircle: (p: Record<string, unknown>) => <Icon data-testid="alert-circle" {...p} />,
    Trash2: (p: Record<string, unknown>) => <Icon data-testid="trash" {...p} />,
    Shield: (p: Record<string, unknown>) => <Icon data-testid="shield" {...p} />,
    Pencil: (p: Record<string, unknown>) => <Icon data-testid="pencil" {...p} />,
    CheckCircle: (p: Record<string, unknown>) => <Icon data-testid="check-circle" {...p} />,
    Star: (p: Record<string, unknown>) => <Icon data-testid="star" {...p} />,
  };
});

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function renderWithClient(ui: React.ReactElement) {
  const client = makeQueryClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("ForumPostCard", () => {
  it("affiche les infos du post et l'insigne équipe après chargement supabase", async () => {
    supabaseMaybeSingleResolve.mockResolvedValueOnce({ data: { role: "admin" }, error: null });

    const { ForumPostCard } = await import("./ForumPostCard");

    renderWithClient(<ForumPostCard post={{ ...POST_BASE }} context="internal" />);

    expect(screen.getByText("Titre du post")).toBeInTheDocument();
    expect(screen.getByTestId("post-preview")).toHaveTextContent("Contenu du post");
    expect(screen.getByText("Support")).toBeInTheDocument();
    expect(screen.getByText("Public")).toBeInTheDocument();

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith("user_roles");
    });

    await waitFor(() => {
      expect(screen.getByText("OpenPulse")).toBeInTheDocument();
    });

    expect(screen.getByTestId("post-badges")).toHaveTextContent("3/2/10");
  });

  it("déclenche la mutation de masquage (succès) et passe la raison", async () => {
    supabaseMaybeSingleResolve.mockResolvedValueOnce({ data: null, error: null });
    maskMutateAsync.mockResolvedValueOnce();

    const { ForumPostCard } = await import("./ForumPostCard");

    const user = userEvent.setup();

    renderWithClient(<ForumPostCard post={{ ...POST_BASE, user_id: "u2" }} context="internal" />);

    const masquerButton = await screen.findByRole("button", { name: "Masquer" });
    await user.click(masquerButton);

    const textarea = screen.getByPlaceholderText("Ex: Contenu inapproprié, spam, etc.");
    await user.type(textarea, "Spam");

    const confirmer = screen.getByRole("button", { name: "Confirmer" });
    await act(async () => {
      await user.click(confirmer);
    });

    expect(maskMutateAsync).toHaveBeenCalledTimes(1);
    expect(maskMutateAsync).toHaveBeenCalledWith({ postId: "p1", reason: "Spam" });
    expect(toastSuccess).toHaveBeenCalledWith("Post masqué avec succès");
  });

  it("gère une erreur supabase (maybeSingle) sans afficher l'insigne équipe", async () => {
    supabaseMaybeSingleResolve.mockResolvedValueOnce({ data: null, error: { message: "x" } });

    const { ForumPostCard } = await import("./ForumPostCard");

    renderWithClient(<ForumPostCard post={{ ...POST_BASE, user_id: "u3" }} context="internal" />);

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith("user_roles");
    });

    await waitFor(() => {
      expect(screen.queryByText("OpenPulse")).not.toBeInTheDocument();
    });

    expect(screen.getByText("• Médecin")).toBeInTheDocument();
  });
});

describe("useIsForumModerator hook (via renderHook) - loading/success/error", () => {
  function makeWrapper() {
    const client = makeQueryClient();
    return ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }

  it("loading -> success", async () => {
    useIsForumModeratorMock.mockReturnValueOnce({ data: undefined, isLoading: true, isError: false } as const);
    useIsForumModeratorMock.mockReturnValueOnce({ data: true, isLoading: false, isError: false } as const);

    const { renderHook } = await import("@testing-library/react");
    const { useIsForumModerator } = await import("@/hooks/forum/useForumModeration");

    const { result, rerender } = renderHook(() => useIsForumModerator(), { wrapper: makeWrapper() });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();

    rerender();

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.data).toBe(true);
  });

  it("error state", async () => {
    useIsForumModeratorMock.mockReturnValueOnce({
      data: null,
      isLoading: false,
      isError: true,
      error: { message: "x" },
    } as const);

    const { renderHook } = await import("@testing-library/react");
    const { useIsForumModerator } = await import("@/hooks/forum/useForumModeration");

    const { result } = renderHook(() => useIsForumModerator(), { wrapper: makeWrapper() });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(true);
    expect(result.current.data).toBeNull();
  });
});