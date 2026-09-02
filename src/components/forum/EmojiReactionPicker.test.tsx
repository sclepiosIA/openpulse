// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EmojiReactionPicker } from "./EmojiReactionPicker";

const {
  AUTH_STATE,
  ETAB_STATE,
  REACTION_COUNTS_STATE,
  TOGGLE_MUTATION_STATE,
  TOAST_ERROR,
  TOAST_SUCCESS,
  DEBUG_ERROR,
  mockFrom,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: "user-1", email: "t@t.co" },
    session: { user: { id: "user-1" } },
    isLoading: false,
  };

  const ETAB_STATE: { etablissementUser: { id: string } | null } = {
    etablissementUser: { id: "etab-1" },
  };

  const REACTION_COUNTS_STATE: {
    data: Record<string, number> | undefined;
    isLoading?: boolean;
    isError?: boolean;
    error?: { message: string } | null;
  } = {
    data: { "👍": 2, "❤️": 1, "😄": 0, "🎉": 3, "🚀": 0 },
    isLoading: false,
    isError: false,
    error: null,
  };

  const TOGGLE_MUTATION_STATE = {
    mutateAsync: vi.fn(),
  };

  const TOAST_ERROR = vi.fn();
  const TOAST_SUCCESS = vi.fn();
  const DEBUG_ERROR = vi.fn();

  const createBuilder = () => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      neq: vi.fn(() => builder),
      gt: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lt: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      like: vi.fn(() => builder),
      ilike: vi.fn(() => builder),
      in: vi.fn(() => builder),
      contains: vi.fn(() => builder),
      containedBy: vi.fn(() => builder),
      overlap: vi.fn(() => builder),
      is: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      range: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      upsert: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
      then: (onFulfilled: (value: { data: null; error: null }) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(onFulfilled),
      catch: (onRejected: (reason: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).catch(onRejected),
    };
    return builder;
  };

  const mockFrom = vi.fn(() => createBuilder());

  return {
    AUTH_STATE,
    ETAB_STATE,
    REACTION_COUNTS_STATE,
    TOGGLE_MUTATION_STATE,
    TOAST_ERROR,
    TOAST_SUCCESS,
    DEBUG_ERROR,
    mockFrom,
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock("@/lib/debug", () => ({
  debug: {
    error: DEBUG_ERROR,
  },
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    className,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" onClick={onClick} className={className} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/popover", async () => {
  const ReactModule = await import("react");
  return {
    Popover: ({
      children,
      open,
      onOpenChange,
    }: {
      children: React.ReactNode;
      open: boolean;
      onOpenChange: (open: boolean) => void;
    }) => <div data-open={open ? "true" : "false"} data-testid="popover-root">{ReactModule.Children.map(children, (child) => {
      if (!ReactModule.isValidElement(child)) return child;
      return ReactModule.cloneElement(child, { open, onOpenChange } as Record<string, unknown>);
    })}</div>,
    PopoverTrigger: ({
      children,
      onOpenChange,
    }: {
      children: React.ReactElement<{ onClick?: React.MouseEventHandler<HTMLElement> }>;
      asChild?: boolean;
      onOpenChange?: (open: boolean) => void;
    }) =>
      ReactModule.cloneElement(children, {
        onClick: () => onOpenChange?.(true),
      }),
    PopoverContent: ({
      children,
      open,
    }: {
      children: React.ReactNode;
      open?: boolean;
      className?: string;
    }) => (open ? <div>{children}</div> : null),
  };
});

vi.mock("lucide-react", () => ({
  Smile: (props: React.SVGProps<SVGSVGElement>) => <svg aria-label="smile-icon" {...props} />,
}));

vi.mock("@/hooks/forum/useForumReactions", () => ({
  useReactionCounts: vi.fn(() => REACTION_COUNTS_STATE),
  useToggleReaction: vi.fn(() => TOGGLE_MUTATION_STATE),
}));

vi.mock("@/hooks/crm/useEtablissementUser", () => ({
  useEtablissementUser: vi.fn(() => ETAB_STATE),
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: vi.fn(() => AUTH_STATE),
}));

vi.mock("sonner", () => ({
  toast: {
    error: TOAST_ERROR,
    success: TOAST_SUCCESS,
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

describe("EmojiReactionPicker", () => {
  beforeEach(() => {
    AUTH_STATE.user = { id: "user-1", email: "t@t.co" };
    AUTH_STATE.session = { user: { id: "user-1" } };
    AUTH_STATE.isLoading = false;

    ETAB_STATE.etablissementUser = { id: "etab-1" };

    REACTION_COUNTS_STATE.data = { "👍": 2, "❤️": 1, "😄": 0, "🎉": 3, "🚀": 0 };
    REACTION_COUNTS_STATE.isLoading = false;
    REACTION_COUNTS_STATE.isError = false;
    REACTION_COUNTS_STATE.error = null;

    TOGGLE_MUTATION_STATE.mutateAsync.mockReset();
    TOGGLE_MUTATION_STATE.mutateAsync.mockResolvedValue({ data: null, error: null });

    TOAST_ERROR.mockReset();
    TOAST_SUCCESS.mockReset();
    DEBUG_ERROR.mockReset();
    mockFrom.mockClear();
  });

  it("affiche les réactions existantes avec leurs compteurs et le bouton Réagir", () => {
    const Wrapper = createWrapper();

    render(<EmojiReactionPicker targetId="post-1" targetType="post" />, {
      wrapper: Wrapper,
    });

    expect(screen.getByText("👍")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();

    expect(screen.getByText("❤️")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();

    expect(screen.getByText("🎉")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();

    expect(screen.queryByText("😄")).not.toBeInTheDocument();
    expect(screen.queryByText("🚀")).not.toBeInTheDocument();

    expect(screen.getByText("Réagir")).toBeInTheDocument();
  });

  it("ouvre le picker et envoie la mutation avec etablissementUser.id en priorité", async () => {
    const Wrapper = createWrapper();

    render(<EmojiReactionPicker targetId="post-42" targetType="post" />, {
      wrapper: Wrapper,
    });

    fireEvent.click(screen.getByText("Réagir"));
    fireEvent.click(screen.getAllByText("🚀")[0]);

    await waitFor(() => {
      expect(TOGGLE_MUTATION_STATE.mutateAsync).toHaveBeenCalledWith({
        targetId: "post-42",
        targetType: "post",
        emoji: "🚀",
        userId: "etab-1",
      });
    });

    await waitFor(() => {
      expect(screen.queryByText("😄")).not.toBeInTheDocument();
    });
  });

  it("utilise user.id si etablissementUser est absent", async () => {
    ETAB_STATE.etablissementUser = null;
    const Wrapper = createWrapper();

    render(<EmojiReactionPicker targetId="comment-7" targetType="comment" />, {
      wrapper: Wrapper,
    });

    fireEvent.click(screen.getByText("Réagir"));
    fireEvent.click(screen.getAllByText("👍")[0]);

    await waitFor(() => {
      expect(TOGGLE_MUTATION_STATE.mutateAsync).toHaveBeenCalledWith({
        targetId: "comment-7",
        targetType: "comment",
        emoji: "👍",
        userId: "user-1",
      });
    });
  });

  it("affiche une erreur si aucun utilisateur n'est connecté", async () => {
    AUTH_STATE.user = null as unknown as { id: string; email: string };
    AUTH_STATE.session = null as unknown as { user: { id: string } };
    ETAB_STATE.etablissementUser = null;

    const Wrapper = createWrapper();

    render(<EmojiReactionPicker targetId="post-3" targetType="post" />, {
      wrapper: Wrapper,
    });

    fireEvent.click(screen.getByText("Réagir"));
    fireEvent.click(screen.getAllByText("❤️")[0]);

    await waitFor(() => {
      expect(TOAST_ERROR).toHaveBeenCalledWith("Vous devez être connecté pour réagir");
    });

    expect(TOGGLE_MUTATION_STATE.mutateAsync).not.toHaveBeenCalled();
  });

  it("gère l'erreur de mutation avec debug et toast.error", async () => {
    TOGGLE_MUTATION_STATE.mutateAsync.mockRejectedValueOnce(new Error("x"));
    const Wrapper = createWrapper();

    render(<EmojiReactionPicker targetId="post-9" targetType="post" />, {
      wrapper: Wrapper,
    });

    fireEvent.click(screen.getByText("Réagir"));
    fireEvent.click(screen.getAllByText("🎉")[0]);

    await waitFor(() => {
      expect(DEBUG_ERROR).toHaveBeenCalled();
      expect(TOAST_ERROR).toHaveBeenCalledWith("Erreur lors de la réaction");
    });
  });

  it("rend en mode compact sans le libellé Réagir", () => {
    const Wrapper = createWrapper();

    render(<EmojiReactionPicker targetId="post-1" targetType="post" compact />, {
      wrapper: Wrapper,
    });

    expect(screen.queryByText("Réagir")).not.toBeInTheDocument();
    expect(screen.getByLabelText("smile-icon")).toBeInTheDocument();
  });
});