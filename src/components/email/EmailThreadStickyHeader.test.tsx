// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EmailThreadStickyHeader } from "./EmailThreadStickyHeader";

const { sanitizeEmailSubjectMock, mockFrom, THREAD } = vi.hoisted(() => ({
  sanitizeEmailSubjectMock: vi.fn((value: string) => `sanitized:${value}`),
  mockFrom: vi.fn(() => {
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
      single: vi.fn(async () => ({ data: null, error: null })),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
      then: (onFulfilled: (value: { data: null; error: null }) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(onFulfilled),
      catch: (onRejected: (reason: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).catch(onRejected),
    };
    return builder;
  }),
  THREAD: {
    id: "thread-1",
    subject: "Re: Bonjour",
    ai_generated_title: "Titre IA",
    is_archived: false,
    is_spam: false,
  },
}));

vi.mock("@/lib/emailUtils", () => ({
  sanitizeEmailSubject: sanitizeEmailSubjectMock,
}));

vi.mock("@/lib/utils", () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    asChild,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) => {
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, props);
    }
    return <button {...props}>{children}</button>;
  },
}));

vi.mock("@/components/ui/separator", () => ({
  Separator: ({ orientation, className }: { orientation?: string; className?: string }) => (
    <div data-orientation={orientation} className={className} data-testid="separator" />
  ),
}));

vi.mock("@/components/ui/dropdown-menu", async () => {
  const ReactModule = await import("react");
  const Ctx = ReactModule.createContext<{ open: boolean; setOpen: React.Dispatch<React.SetStateAction<boolean>> } | null>(null);

  function DropdownMenu({ children }: { children: React.ReactNode }) {
    const [open, setOpen] = ReactModule.useState(false);
    return <Ctx.Provider value={{ open, setOpen }}>{children}</Ctx.Provider>;
  }

  function DropdownMenuTrigger({
    children,
    asChild,
  }: {
    children: React.ReactElement;
    asChild?: boolean;
  }) {
    const ctx = ReactModule.useContext(Ctx);
    if (!ctx) return children;
    if (asChild) {
      return ReactModule.cloneElement(children, {
        onClick: (event: React.MouseEvent) => {
          const current = children.props as { onClick?: (e: React.MouseEvent) => void };
          current.onClick?.(event);
          ctx.setOpen((v) => !v);
        },
      });
    }
    return children;
  }

  function DropdownMenuContent({
    children,
  }: {
    children: React.ReactNode;
    align?: string;
  }) {
    const ctx = ReactModule.useContext(Ctx);
    if (!ctx?.open) return null;
    return <div data-testid="dropdown-content">{children}</div>;
  }

  function DropdownMenuItem({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) {
    return (
      <button type="button" disabled={disabled} onClick={onClick}>
        {children}
      </button>
    );
  }

  function DropdownMenuSeparator() {
    return <div data-testid="dropdown-separator" />;
  }

  return {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
  };
});

vi.mock("lucide-react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("lucide-react")>();
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />;
  return {
    ...actual,
    ArrowLeft: Icon,
    Reply: Icon,
    ReplyAll: Icon,
    Forward: Icon,
    Archive: Icon,
    ArchiveRestore: Icon,
    ChevronsDownUp: Icon,
    ChevronsUpDown: Icon,
    ChevronUp: Icon,
    ChevronDown: Icon,
    MoreVertical: Icon,
    Brain: Icon,
    AlertOctagon: Icon,
    Keyboard: Icon,
  };
});

vi.mock("./folders/MoveToFolderDialog", () => ({
  MoveToFolderDialog: () => null,
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

function renderComponent(
  overrides: Partial<React.ComponentProps<typeof EmailThreadStickyHeader>> = {},
) {
  const props: React.ComponentProps<typeof EmailThreadStickyHeader> = {
    thread: THREAD,
    sanitizedMessagesCount: 3,
    currentMessageIndex: 1,
    threadId: "thread-1",
    processing: false,
    isArchiving: false,
    onBack: vi.fn(),
    onPreviousMessage: vi.fn(),
    onNextMessage: vi.fn(),
    onExpandAll: vi.fn(),
    onCollapseAll: vi.fn(),
    onReply: vi.fn(),
    onReplyAll: vi.fn(),
    onForward: vi.fn(),
    onArchiveToggle: vi.fn(),
    onProcessAI: vi.fn(),
    onMarkSpam: vi.fn(),
    onShowShortcuts: vi.fn(),
    ...overrides,
  };

  const rendered = render(<EmailThreadStickyHeader {...props} />, { wrapper: createWrapper() });
  return { ...rendered, props };
}

describe("EmailThreadStickyHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche le sujet sanitizé, le fil d'ariane et le compteur de messages", () => {
    renderComponent();

    expect(sanitizeEmailSubjectMock).toHaveBeenCalledWith("Titre IA");
    expect(screen.getByText("Messagerie")).toBeInTheDocument();
    expect(screen.getByText("Conversation")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "sanitized:Titre IA" })).toBeInTheDocument();
    expect(screen.getByText("2/3")).toBeInTheDocument();
  });

  it("utilise le subject si ai_generated_title est absent", () => {
    renderComponent({
      thread: {
        ...THREAD,
        ai_generated_title: "",
        subject: "Sujet original",
      },
    });

    expect(sanitizeEmailSubjectMock).toHaveBeenCalledWith("Sujet original");
    expect(screen.getByRole("heading", { level: 2, name: "sanitized:Sujet original" })).toBeInTheDocument();
  });

  it("désactive la navigation en haut au premier message et en bas au dernier message", () => {
    const { rerender, props } = renderComponent({
      currentMessageIndex: 0,
      sanitizedMessagesCount: 2,
    });

    expect(screen.getByRole("button", { name: "Précédent" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Suivant" })).not.toBeDisabled();
    expect(screen.getByText("1/2")).toBeInTheDocument();

    rerender(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: {
              queries: { retry: 0, gcTime: 0 },
              mutations: { retry: 0 },
            },
          })
        }
      >
        <EmailThreadStickyHeader {...props} currentMessageIndex={1} />
      </QueryClientProvider>,
    );

    expect(screen.getByRole("button", { name: "Suivant" })).toBeDisabled();
  });

  it("masque la navigation de messages si un seul message sanitizé", () => {
    renderComponent({
      sanitizedMessagesCount: 1,
      currentMessageIndex: 0,
    });

    expect(screen.queryByRole("button", { name: "Précédent" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Suivant" })).not.toBeInTheDocument();
    expect(screen.queryByText("1/1")).not.toBeInTheDocument();
  });

  it("déclenche toutes les actions principales via les boutons", async () => {
    const user = userEvent.setup();
    const { props } = renderComponent();

    await user.click(screen.getByRole("button", { name: "Retour" }));
    await user.click(screen.getByRole("button", { name: "Précédent" }));
    await user.click(screen.getByRole("button", { name: "Suivant" }));
    await user.click(screen.getByRole("button", { name: "Replier" }));
    await user.click(screen.getByRole("button", { name: "Déplier" }));
    await user.click(screen.getByRole("button", { name: "Répondre" }));
    await user.click(screen.getByRole("button", { name: "Répondre à tous" }));
    await user.click(screen.getByRole("button", { name: "Transférer" }));
    await user.click(screen.getByRole("button", { name: "Archiver le fil de discussion" }));

    expect(props.onBack).toHaveBeenCalledTimes(1);
    expect(props.onPreviousMessage).toHaveBeenCalledTimes(1);
    expect(props.onNextMessage).toHaveBeenCalledTimes(1);
    expect(props.onExpandAll).toHaveBeenCalledTimes(1);
    expect(props.onCollapseAll).toHaveBeenCalledTimes(1);
    expect(props.onReply).toHaveBeenCalledTimes(1);
    expect(props.onReplyAll).toHaveBeenCalledTimes(1);
    expect(props.onForward).toHaveBeenCalledTimes(1);
    expect(props.onArchiveToggle).toHaveBeenCalledTimes(1);
  });

  it("affiche l'état archivé et désactive l'action pendant l'archivage", () => {
    renderComponent({
      thread: {
        ...THREAD,
        is_archived: true,
      },
      isArchiving: true,
    });

    const button = screen.getByRole("button", { name: "Restaurer le fil de discussion" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "Restaurer (a)");
  });

  it("ouvre le menu et déclenche les actions secondaires", async () => {
    const user = userEvent.setup();
    const { props } = renderComponent();

    await user.click(screen.getByRole("button", { name: "Plus d'options" }));

    expect(screen.getByTestId("dropdown-content")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Réanalyser avec l'IA" }));
    await user.click(screen.getByRole("button", { name: "Marquer comme spam" }));
    await user.click(screen.getByRole("button", { name: "Raccourcis clavier" }));

    expect(props.onProcessAI).toHaveBeenCalledTimes(1);
    expect(props.onMarkSpam).toHaveBeenCalledTimes(1);
    expect(props.onShowShortcuts).toHaveBeenCalledTimes(1);
  });

  it("désactive la réanalyse IA pendant le traitement et adapte le libellé spam", async () => {
    const user = userEvent.setup();
    const { props } = renderComponent({
      processing: true,
      thread: {
        ...THREAD,
        is_spam: true,
      },
    });

    await user.click(screen.getByRole("button", { name: "Plus d'options" }));

    expect(screen.getByRole("button", { name: "Réanalyser avec l'IA" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Retirer du spam" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retirer du spam" }));
    expect(props.onMarkSpam).toHaveBeenCalledTimes(1);
  });
});
