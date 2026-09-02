/* @vitest-environment jsdom */
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, act } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommentSection } from "./CommentSection";

const {
  COMMENTS,
  AUTH_STATE,
  TEAM_PROFILE,
  ETABLISSEMENT_USER,
  EMPTY_ERROR,
  CREATE_MUTATE_ASYNC,
  VOTE_MUTATE_ASYNC,
  toastSuccess,
  toastError,
  debugError,
  mockUseForumComments,
  mockUseCreateForumComment,
  mockUseVoteComment,
  mockUseAuth,
  mockUseIsTeamMember,
  mockUseTeamMemberProfile,
  mockUseEtablissementUser,
  nestedCommentCalls,
  mockFrom,
} = vi.hoisted(() => ({
  COMMENTS: [
    {
      id: "c1",
      contenu: "<p>Premier commentaire</p>",
      author_prenom: "Alice",
      author_nom: "Martin",
      author_role: "Médecin",
    },
    {
      id: "c2",
      contenu: "<p>Deuxième commentaire</p>",
      author_prenom: "Bob",
      author_nom: "Durand",
      author_role: "Infirmier(ère)",
    },
  ],
  AUTH_STATE: {
    user: { id: "u1", email: "user@test.local" },
    session: { user: { id: "u1" } },
    isLoading: false,
  },
  TEAM_PROFILE: {
    prenom: "Team",
    nom: "Member",
    fonction: "Équipe Produit",
  },
  ETABLISSEMENT_USER: {
    prenom: "Jean",
    nom: "Dupont",
    fonction: "Médecin",
  },
  EMPTY_ERROR: { message: "x" },
  CREATE_MUTATE_ASYNC: vi.fn(),
  VOTE_MUTATE_ASYNC: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  debugError: vi.fn(),
  mockUseForumComments: vi.fn(),
  mockUseCreateForumComment: vi.fn(),
  mockUseVoteComment: vi.fn(),
  mockUseAuth: vi.fn(),
  mockUseIsTeamMember: vi.fn(),
  mockUseTeamMemberProfile: vi.fn(),
  mockUseEtablissementUser: vi.fn(),
  nestedCommentCalls: [] as Array<{
    comment: { id: string; contenu: string };
    postId: string;
    onVote: (commentId: string) => Promise<void>;
    onReply: (
      parentId: string,
      content: string,
      authorData: { prenom: string; nom: string; role: string }
    ) => Promise<void>;
  }>,
  mockFrom: vi.fn(),
}));

vi.mock("@/lib/debug", () => ({
  debug: {
    error: debugError,
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock("@/integrations/supabase/client", () => {
  const result = { data: null, error: null };
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
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
    catch: (reject: (reason: unknown) => unknown) => Promise.resolve(result).catch(reject),
  };
  mockFrom.mockImplementation(() => builder);
  return {
    supabase: {
      from: mockFrom,
    },
  };
});

vi.mock("@/hooks/forum/useForumComments", () => ({
  useForumComments: mockUseForumComments,
  useCreateForumComment: mockUseCreateForumComment,
  useVoteComment: mockUseVoteComment,
}));

vi.mock("@/hooks/shared/useAuth", () => ({
  useAuth: mockUseAuth,
}));

vi.mock("@/hooks/hr/useTeamMember", () => ({
  useIsTeamMember: mockUseIsTeamMember,
  useTeamMemberProfile: mockUseTeamMemberProfile,
}));

vi.mock("@/hooks/crm/useEtablissementUser", () => ({
  useEtablissementUser: mockUseEtablissementUser,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    type,
    disabled,
    onClick,
    variant,
    className,
  }: {
    children: React.ReactNode;
    type?: "button" | "submit" | "reset";
    disabled?: boolean;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    variant?: string;
    className?: string;
  }) => (
    <button type={type} disabled={disabled} onClick={onClick} data-variant={variant} className={className}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: ({
    id,
    value,
    onChange,
    placeholder,
    disabled,
    required,
    className,
  }: {
    id?: string;
    value?: string;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
    className?: string;
  }) => (
    <input
      id={id}
      aria-label={id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      className={className}
    />
  ),
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({
    htmlFor,
    children,
    className,
  }: {
    htmlFor?: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <label htmlFor={htmlFor} className={className}>
      {children}
    </label>
  ),
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    children: React.ReactNode;
  }) => (
    <select aria-label="Fonction" value={value} onChange={(e) => onValueChange?.(e.target.value)}>
      <option value="">Sélectionnez votre fonction</option>
      <option value="Médecin">Médecin</option>
      <option value="Infirmier(ère)">Infirmier(ère)</option>
      <option value="Aide-soignant(e)">Aide-soignant(e)</option>
      <option value="Autre">Autre</option>
      {children}
    </select>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <>{placeholder}</>,
}));

vi.mock("@/components/email/RichTextEditor", () => ({
  RichTextEditor: ({
    content,
    onChange,
    placeholder,
    disabled,
  }: {
    content: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
  }) => (
    <textarea
      aria-label="Votre commentaire *"
      value={content}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
    />
  ),
}));

vi.mock("./ForumSkeleton", () => ({
  ForumSkeleton: () => <div data-testid="forum-skeleton">Chargement...</div>,
}));

vi.mock("./NestedComment", () => ({
  NestedComment: ({
    comment,
    postId,
    onVote,
    onReply,
  }: {
    comment: { id: string; contenu: string };
    postId: string;
    onVote: (commentId: string) => Promise<void>;
    onReply: (
      parentId: string,
      content: string,
      authorData: { prenom: string; nom: string; role: string }
    ) => Promise<void>;
  }) => {
    nestedCommentCalls.push({ comment, postId, onVote, onReply });
    return (
      <div data-testid={`nested-comment-${comment.id}`}>
        <span>{comment.contenu}</span>
        <button type="button" onClick={() => onVote(comment.id)}>
          vote-{comment.id}
        </button>
        <button
          type="button"
          onClick={() =>
            onReply(comment.id, "<p>Réponse</p>", {
              prenom: "Reply",
              nom: "User",
              role: "Médecin",
            })
          }
        >
          reply-{comment.id}
        </button>
      </div>
    );
  },
}));

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

function renderComponent(postId: string) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <CommentSection postId={postId} />
    </QueryClientProvider>
  );
}

describe("CommentSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nestedCommentCalls.length = 0;

    mockUseAuth.mockReturnValue(AUTH_STATE);
    mockUseForumComments.mockReturnValue({
      data: COMMENTS,
      isLoading: false,
      isError: false,
      error: null,
    });
    mockUseCreateForumComment.mockReturnValue({
      mutateAsync: CREATE_MUTATE_ASYNC,
      isPending: false,
      isError: false,
      error: null,
    });
    mockUseVoteComment.mockReturnValue({
      mutateAsync: VOTE_MUTATE_ASYNC,
      isPending: false,
      isError: false,
      error: null,
    });
    mockUseIsTeamMember.mockReturnValue({
      data: false,
      isLoading: false,
      isError: false,
      error: null,
    });
    mockUseTeamMemberProfile.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      error: null,
    });
    mockUseEtablissementUser.mockReturnValue({
      etablissementUser: ETABLISSEMENT_USER,
      isLoading: false,
      isError: false,
      error: null,
    });

    CREATE_MUTATE_ASYNC.mockResolvedValue({ data: { id: "new-comment" }, error: null });
    VOTE_MUTATE_ASYNC.mockResolvedValue({ data: { success: true }, error: null });
  });

  it("couvre chargement puis succès via hook et affiche les valeurs métier réelles", async () => {
    const states = [
      { data: null, isLoading: true, isError: false, error: null },
      { data: COMMENTS, isLoading: false, isError: false, error: null },
    ];
    let index = 0;
    mockUseForumComments.mockImplementation(() => states[Math.min(index, 1)]);

    const { result, rerender } = renderHook(() => mockUseForumComments("post-1"), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    index = 1;
    rerender();

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBe(COMMENTS);

    renderComponent("post-1");

    expect(screen.getByText("Commentaires (2)")).toBeInTheDocument();
    expect(screen.getByTestId("nested-comment-c1")).toBeInTheDocument();
    expect(screen.getByTestId("nested-comment-c2")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Jean")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Dupont")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Fonction" })).toHaveValue("Médecin");
    expect(screen.getByRole("button", { name: "Publier" })).toBeDisabled();
  });

  it("affiche le skeleton pendant le chargement", () => {
    mockUseForumComments.mockReturnValue({
      data: null,
      isLoading: true,
      isError: false,
      error: null,
    });

    renderComponent("post-loading");

    expect(screen.getByTestId("forum-skeleton")).toBeInTheDocument();
    expect(screen.queryByText(/Commentaires/)).not.toBeInTheDocument();
  });

  it("soumet un commentaire avec les bonnes valeurs et réinitialise les champs", async () => {
    const user = userEvent.setup();

    renderComponent("post-42");

    const editor = screen.getByLabelText("Votre commentaire *");
    await user.type(editor, "<p>Mon nouveau commentaire</p>");

    expect(screen.getByRole("button", { name: "Publier" })).toBeEnabled();

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Publier" }));
    });

    expect(CREATE_MUTATE_ASYNC).toHaveBeenCalledWith({
      post_id: "post-42",
      user_id: null,
      contenu: "<p>Mon nouveau commentaire</p>",
      author_nom: "Dupont",
      author_prenom: "Jean",
      author_role: "Médecin",
    });
    expect(toastSuccess).toHaveBeenCalledWith("Commentaire publié avec succès !");

    await waitFor(() => {
      expect(screen.getByLabelText("Votre commentaire *")).toHaveValue("");
      expect(screen.getByLabelText("prenom")).toHaveValue("");
      expect(screen.getByLabelText("nom")).toHaveValue("");
      expect(screen.getByRole("combobox", { name: "Fonction" })).toHaveValue("");
    });
  });

  it("refuse un commentaire vide même si les autres champs sont remplis", async () => {
    const user = userEvent.setup();

    mockUseEtablissementUser.mockReturnValue({
      etablissementUser: {
        prenom: "Jean",
        nom: "Dupont",
        fonction: "",
      },
      isLoading: false,
      isError: false,
      error: null,
    });

    renderComponent("post-empty");

    await user.selectOptions(screen.getByRole("combobox", { name: "Fonction" }), "Médecin");
    await user.type(screen.getByLabelText("Votre commentaire *"), "<p></p>");

    expect(screen.getByRole("button", { name: "Publier" })).toBeEnabled();

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Publier" }));
    });

    expect(toastError).toHaveBeenCalledWith("Le commentaire ne peut pas être vide");
    expect(CREATE_MUTATE_ASYNC).not.toHaveBeenCalled();
  });

  it("auto-remplit et verrouille les champs pour un membre d'équipe", () => {
    mockUseIsTeamMember.mockReturnValue({
      data: true,
      isLoading: false,
      isError: false,
      error: null,
    });
    mockUseTeamMemberProfile.mockReturnValue({
      data: TEAM_PROFILE,
      isLoading: false,
      isError: false,
      error: null,
    });
    mockUseEtablissementUser.mockReturnValue({
      etablissementUser: null,
      isLoading: false,
      isError: false,
      error: null,
    });

    renderComponent("post-team");

    expect(screen.getByLabelText("prenom")).toHaveValue("Team");
    expect(screen.getByLabelText("nom")).toHaveValue("Member");
    expect(screen.getByDisplayValue("Équipe Produit")).toBeDisabled();
    expect(screen.getByLabelText("prenom")).toBeDisabled();
    expect(screen.getByLabelText("nom")).toBeDisabled();
    expect(screen.queryByRole("combobox", { name: "Fonction" })).not.toBeInTheDocument();
  });

  it("déclenche un vote via NestedComment", async () => {
    const user = userEvent.setup();

    renderComponent("post-vote");

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "vote-c1" }));
    });

    expect(VOTE_MUTATE_ASYNC).toHaveBeenCalledWith({ commentId: "c1" });
  });

  it("déclenche une réponse imbriquée avec le bon parent et les données auteur", async () => {
    const user = userEvent.setup();

    renderComponent("post-reply");

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "reply-c2" }));
    });

    expect(CREATE_MUTATE_ASYNC).toHaveBeenCalledWith({
      post_id: "post-reply",
      user_id: null,
      contenu: "<p>Réponse</p>",
      parent_comment_id: "c2",
      author_nom: "User",
      author_prenom: "Reply",
      author_role: "Médecin",
    });
  });

  it("couvre l'état isError du hook et gère l'erreur de création", async () => {
    mockUseForumComments.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      error: EMPTY_ERROR,
    });

    const { result } = renderHook(() => mockUseForumComments("post-error"), {
      wrapper: createWrapper(),
    });

    expect(result.current.isError).toBe(true);
    expect(result.current.error).toEqual(EMPTY_ERROR);

    mockUseForumComments.mockReturnValue({
      data: COMMENTS,
      isLoading: false,
      isError: false,
      error: null,
    });
    CREATE_MUTATE_ASYNC.mockRejectedValueOnce(new Error("create failed"));

    const user = userEvent.setup();
    renderComponent("post-create-error");

    await user.type(screen.getByLabelText("Votre commentaire *"), "<p>Erreur test</p>");

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Publier" }));
    });

    expect(CREATE_MUTATE_ASYNC).toHaveBeenCalledWith({
      post_id: "post-create-error",
      user_id: null,
      contenu: "<p>Erreur test</p>",
      author_nom: "Dupont",
      author_prenom: "Jean",
      author_role: "Médecin",
    });

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Erreur lors de la publication du commentaire");
      expect(debugError).toHaveBeenCalled();
    });
  });
});