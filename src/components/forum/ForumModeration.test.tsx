import React from "react";
import { render, screen, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const {
  POSTS,
  hookState,
  maskMutateAsync,
  deleteMutateAsync,
  approveMutateAsync,
  archiveMutateAsync,
  debugError,
  mockFrom,
  mockNavigate,
} = vi.hoisted(() => {
  const POSTS = [
    {
      id: "p1",
      titre: "Post actif",
      contenu: "<p>Contenu actif</p>",
      theme: "Général",
      visibilite: "public",
      modere: false,
      archive: false,
      created_at: "2024-01-02T10:11:00.000Z",
      author_prenom: "Alice",
      author_nom: "Martin",
      author_role: "Formateur",
      author_service: "Service A",
      author_etablissement_nom: "Etab 1",
      raison_moderation: null,
    },
    {
      id: "p2",
      titre: "Post modéré",
      contenu: "<p>Contenu modéré</p>",
      theme: "Sécurité",
      visibilite: "interne",
      modere: true,
      archive: false,
      created_at: "2024-02-03T12:00:00.000Z",
      author_prenom: "Bob",
      author_nom: "Durand",
      author_role: null,
      author_service: null,
      author_etablissement_nom: null,
      raison_moderation: "Spam",
    },
    {
      id: "p3",
      titre: "Post archivé",
      contenu: "<p>Contenu archivé</p>",
      theme: "Process",
      visibilite: "public",
      modere: false,
      archive: true,
      created_at: "2024-03-04T09:30:00.000Z",
      author_prenom: "Chloé",
      author_nom: "Leroy",
      author_role: "Admin",
      author_service: "Service B",
      author_etablissement_nom: "Etab 2",
      raison_moderation: null,
    },
  ];

  const hookState:
    | { mode: "loading" }
    | { mode: "success"; data: typeof POSTS }
    | { mode: "error"; message: string } = { mode: "success", data: POSTS };

  const maskMutateAsync = vi.fn<[{ postId: string; reason: string }], Promise<void>>().mockResolvedValue(undefined);
  const deleteMutateAsync = vi.fn<[string], Promise<void>>().mockResolvedValue(undefined);
  const approveMutateAsync = vi.fn<[string], Promise<void>>().mockResolvedValue(undefined);
  const archiveMutateAsync = vi.fn<[string], Promise<void>>().mockResolvedValue(undefined);

  const debugError = vi.fn();

  const mockFrom = vi.fn();

  const mockNavigate = vi.fn();

  return {
    POSTS,
    hookState,
    maskMutateAsync,
    deleteMutateAsync,
    approveMutateAsync,
    archiveMutateAsync,
    debugError,
    mockFrom,
    mockNavigate,
  };
});

vi.mock("@/lib/debug", () => ({
  debug: {
    error: debugError,
    log: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <div data-testid="card" {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <h2 {...props}>{children}</h2>,
  CardDescription: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <p {...props}>{children}</p>,
  CardContent: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <div {...props}>{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, ...props }: React.PropsWithChildren<{ onClick?: React.MouseEventHandler<HTMLButtonElement> }>) => (
    <button type="button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <span {...props}>{children}</span>,
}));

vi.mock("@/components/ui/tabs", () => {
  const React = require("react") as typeof import("react");
  type Ctx = { value: string; setValue: (v: string) => void };
  const TabsContext = React.createContext<Ctx | null>(null);

  return {
    Tabs: ({ defaultValue, children }: React.PropsWithChildren<{ defaultValue: string }>) => {
      const [value, setValue] = React.useState(defaultValue);
      return <TabsContext.Provider value={{ value, setValue }}>{children}</TabsContext.Provider>;
    },
    TabsList: ({ children }: React.PropsWithChildren) => <div role="tablist">{children}</div>,
    TabsTrigger: ({ value, children }: React.PropsWithChildren<{ value: string }>) => {
      const ctx = React.useContext(TabsContext);
      if (!ctx) return <button type="button">{children}</button>;
      return (
        <button type="button" role="tab" aria-selected={ctx.value === value} onClick={() => ctx.setValue(value)}>
          {children}
        </button>
      );
    },
    TabsContent: ({ value, children }: React.PropsWithChildren<{ value: string }>) => {
      const ctx = React.useContext(TabsContext);
      if (!ctx) return null;
      if (ctx.value !== value) return null;
      return <div data-tabs-content={value}>{children}</div>;
    },
  };
});

vi.mock("@/components/ui/alert-dialog", () => {
  const React = require("react") as typeof import("react");
  return {
    AlertDialog: ({ open, children }: React.PropsWithChildren<{ open: boolean; onOpenChange?: (open: boolean) => void }>) =>
      open ? <div role="dialog">{children}</div> : null,
    AlertDialogContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
    AlertDialogHeader: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
    AlertDialogTitle: ({ children }: React.PropsWithChildren) => <h2>{children}</h2>,
    AlertDialogDescription: ({ children }: React.PropsWithChildren) => <p>{children}</p>,
    AlertDialogFooter: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
    AlertDialogCancel: ({ children }: React.PropsWithChildren) => <button type="button">{children}</button>,
    AlertDialogAction: ({ children, onClick }: React.PropsWithChildren<{ onClick?: React.MouseEventHandler<HTMLButtonElement> }>) => (
      <button type="button" onClick={onClick}>
        {children}
      </button>
    ),
  };
});

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, htmlFor }: React.PropsWithChildren<{ htmlFor?: string }>) => <label htmlFor={htmlFor}>{children}</label>,
}));

vi.mock("@/components/ui/textarea", () => ({
  Textarea: ({
    value,
    onChange,
    id,
    placeholder,
    rows,
  }: {
    value?: string;
    onChange?: React.ChangeEventHandler<HTMLTextAreaElement>;
    id?: string;
    placeholder?: string;
    rows?: number;
  }) => <textarea id={id} placeholder={placeholder} rows={rows} value={value} onChange={onChange} />,
}));

vi.mock("lucide-react", () => ({
  Shield: () => <span aria-hidden="true" />,
  Trash2: () => <span aria-hidden="true" />,
  CheckCircle: () => <span aria-hidden="true" />,
  Archive: () => <span aria-hidden="true" />,
  AlertCircle: () => <span aria-hidden="true" />,
  Eye: () => <span aria-hidden="true" />,
}));

vi.mock("@/hooks/forum/useForumModeration", () => ({
  useForumPostsForModeration: () => {
    if (hookState.mode === "loading") return { data: undefined, isLoading: true, isError: false, error: null };
    if (hookState.mode === "error") return { data: null, isLoading: false, isError: true, error: { message: hookState.message } };
    return { data: hookState.data, isLoading: false, isError: false, error: null };
  },
  useMaskForumPost: () => ({ mutateAsync: maskMutateAsync }),
  useDeleteForumPost: () => ({ mutateAsync: deleteMutateAsync }),
  useApproveForumPost: () => ({ mutateAsync: approveMutateAsync }),
  useArchiveForumPost: () => ({ mutateAsync: archiveMutateAsync }),
}));

vi.mock("./SafeHtmlContent", () => ({
  SafeHtmlContent: ({ html, className }: { html: string; className?: string }) => (
    <div className={className} data-testid="safe-html">
      {html}
    </div>
  ),
}));

function createThenableBuilder() {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  const chainMethods = [
    "select",
    "eq",
    "neq",
    "gt",
    "gte",
    "lt",
    "lte",
    "in",
    "order",
    "limit",
    "range",
    "insert",
    "update",
    "delete",
    "upsert",
  ];
  for (const m of chainMethods) builder[m] = vi.fn(chain);

  builder.single = vi.fn(async () => ({ data: null, error: null }));
  builder.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
  builder.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected);
  builder.catch = (onRejected?: (e: unknown) => unknown) => Promise.resolve({ data: null, error: null }).catch(onRejected);

  return builder;
}

vi.mock("@/integrations/supabase/client", () => {
  const builder = createThenableBuilder();
  mockFrom.mockReturnValue(builder);
  return {
    supabase: {
      from: mockFrom,
      auth: {
        getSession: vi.fn(async () => ({ data: { session: { user: { id: "u1" } } }, error: null })),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      },
    },
  };
});

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

import { ForumModeration } from "./ForumModeration";

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function renderWithClient(ui: React.ReactElement) {
  const client = createTestQueryClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("ForumModeration", () => {
  it("affiche l'état de chargement", async () => {
    hookState.mode = "loading";
    renderWithClient(<ForumModeration />);
    expect(screen.getByText("Chargement...")).toBeInTheDocument();
  });

  it("affiche les compteurs par onglet et les posts filtrés", async () => {
    hookState.mode = "success";
    hookState.data = POSTS;

    renderWithClient(<ForumModeration />);

    expect(screen.getByText(/Actifs \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/Modérés \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/Archivés \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/Tous \(3\)/)).toBeInTheDocument();

    expect(screen.getByText("Post actif")).toBeInTheDocument();
    expect(screen.queryByText("Post modéré")).not.toBeInTheDocument();
    expect(screen.queryByText("Post archivé")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: /Modérés/ }));
    expect(screen.getByText("Post modéré")).toBeInTheDocument();
    expect(screen.getByText("Raison de la modération :")).toBeInTheDocument();
    expect(screen.getByText("Spam")).toBeInTheDocument();
    expect(screen.queryByText("Post actif")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: /Archivés/ }));
    expect(screen.getByText("Post archivé")).toBeInTheDocument();
    expect(screen.queryByText("Post modéré")).not.toBeInTheDocument();
  });

  it("déclenche une mutation (mask) avec les bons paramètres puis ferme le dialogue", async () => {
    hookState.mode = "success";
    hookState.data = POSTS;
    maskMutateAsync.mockClear();

    renderWithClient(<ForumModeration />);

    const postCard = screen.getByText("Post actif").closest('[data-testid="card"]');
    if (!postCard) throw new Error("Card introuvable");
    const maskButton = within(postCard).getByRole("button", { name: /Masquer/ });

    await userEvent.click(maskButton);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Masquer ce post ?")).toBeInTheDocument();
    expect(screen.getByText(/Le post sera masqué/)).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText("Ex: Contenu inapproprié, spam, etc.");
    await userEvent.type(textarea, "Contenu inapproprié");

    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Confirmer" }));
    });

    expect(maskMutateAsync).toHaveBeenCalledTimes(1);
    expect(maskMutateAsync).toHaveBeenCalledWith({ postId: "p1", reason: "Contenu inapproprié" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("en cas d'erreur de mutation, log l'erreur et garde le dialogue ouvert", async () => {
    hookState.mode = "success";
    hookState.data = POSTS;
    debugError.mockClear();

    maskMutateAsync.mockRejectedValueOnce(new Error("Mutation failed"));

    renderWithClient(<ForumModeration />);

    const postCard = screen.getByText("Post actif").closest('[data-testid="card"]');
    if (!postCard) throw new Error("Card introuvable");
    await userEvent.click(within(postCard).getByRole("button", { name: /Masquer/ }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Confirmer" }));
    });

    expect(debugError).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("couvre le cas erreur côté query (isError) sans afficher Chargement", async () => {
    hookState.mode = "error";
    hookState.message = "Erreur fetch";

    renderWithClient(<ForumModeration />);

    expect(screen.queryByText("Chargement...")).not.toBeInTheDocument();
    expect(screen.getByText("Modération du Forum")).toBeInTheDocument();
    expect(screen.getByText(/Tous \(0\)/)).toBeInTheDocument();
    expect(screen.getByText("Aucun post dans cette catégorie")).toBeInTheDocument();
  });
});