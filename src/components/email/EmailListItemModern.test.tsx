// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EmailListItemModern } from "./EmailListItemModern";

const {
  THREAD_BASE,
  ENRICHED_EXTERNAL,
  ENRICHED_INTERNAL,
  mockUpdateThreadPriority,
  mockToastError,
  mockOnArchive,
  mockOnDeleteThread,
  mockOnMarkAsRead,
  mockOnMarkAsProcessed,
  mockOnMarkAsSpam,
  mockOnUpdateTags,
  mockOnDelete,
  mockOnArchiveProp,
  mockOnClick,
  mockOnSelect,
} = vi.hoisted(() => ({
  THREAD_BASE: {
    id: "thread-1",
    unread_count: 2,
    is_processed: false,
    hasReply: true,
    priority: "high",
    subject: "Sujet brut",
    ai_generated_title: "Sujet IA",
    last_message_date: "2024-01-01T10:00:00.000Z",
    message_count: 3,
    category: "Commercial",
    tags: ["urgent", "vip"],
    account: { email_address: "account@test.local" },
    groupe: { type: "GHT", nom: "Groupe Santé" },
    etablissement: { nom: "Clinique Bleu" },
    partenaire: { nom: "Partenaire Nord" },
    from: [{ name: "Jean Dupont", email: "jean@example.com", isCurrentUser: false }],
  },
  ENRICHED_EXTERNAL: {
    hasReply: true,
    imageCount: 2,
    entityLogoUrl: "logo.png",
    internalProfileAvatarUrl: "avatar.png",
    contactRole: "directeur",
    groupeFromDomain: { type: "Consortium", nom: "Consortium Mail" },
    isInternalTeam: false,
  },
  ENRICHED_INTERNAL: {
    hasReply: false,
    imageCount: 1,
    isInternalTeam: true,
    internalRole: { title: "Support" },
    externalEntityForInternal: { type: "groupe", nom: "Groupe Externe" },
    contactRole: null,
  },
  mockUpdateThreadPriority: vi.fn(),
  mockToastError: vi.fn(),
  mockOnArchive: vi.fn(),
  mockOnDeleteThread: vi.fn(),
  mockOnMarkAsRead: vi.fn(),
  mockOnMarkAsProcessed: vi.fn(),
  mockOnMarkAsSpam: vi.fn(),
  mockOnUpdateTags: vi.fn(),
  mockOnDelete: vi.fn(),
  mockOnArchiveProp: vi.fn(),
  mockOnClick: vi.fn(),
  mockOnSelect: vi.fn(),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  ),
}));

vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
    ...props
  }: {
    checked?: boolean;
    onCheckedChange?: (value: boolean) => void;
  }) => (
    <button
      type="button"
      aria-label="select-thread"
      data-checked={String(Boolean(checked))}
      onClick={() => onCheckedChange?.(!checked)}
      {...props}
    />
  ),
}));

vi.mock("@/components/ui/hover-card", () => ({
  HoverCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  HoverCardTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  HoverCardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/context-menu", () => ({
  ContextMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ContextMenuTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <>{children}</>,
  ContextMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("date-fns", () => ({
  formatDistanceToNow: vi.fn(() => "il y a 2 jours"),
}));

vi.mock("date-fns/locale", () => ({
  fr: {},
}));

vi.mock("lucide-react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("lucide-react")>();
  return {
    ...actual,
    Paperclip: (props: React.SVGProps<SVGSVGElement>) => <svg aria-label="Pièces jointes" {...props} />,
    Building2: (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />,
    Users: (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />,
    Handshake: (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />,
    CheckCircle2: (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />,
    Reply: (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />,
    UserCircle: (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />,
  };
});

vi.mock("@/lib/utils", () => ({
  cn: (...args: Array<string | false | null | undefined>) => args.filter(Boolean).join(" "),
}));

vi.mock("@/lib/emailUtils", () => ({
  sanitizeEmailSubject: vi.fn((value: string) => `sanitized:${value}`),
  sanitizeDisplayName: vi.fn((value: string | null | undefined) => (value ? `display:${value}` : "")),
  getThreadMainSender: vi.fn((thread: typeof THREAD_BASE) => thread.from[0]),
  formatContactRole: vi.fn((role: string | null) => (role ? `Rôle:${role}` : null)),
}));

vi.mock("@/lib/internalEmailConfig", () => ({
  isMarqueEmail: vi.fn((email: string) => email.endsWith("@marque.local")),
}));

vi.mock("@/components/ui/EntityAvatar", () => ({
  EntityAvatar: ({ name, email, isUnread }: { name: string; email?: string; isUnread?: boolean }) => (
    <div data-testid="entity-avatar" data-email={email} data-unread={String(Boolean(isUnread))}>
      {name}
    </div>
  ),
}));

vi.mock("@/components/ui/groupe-badge", () => ({
  GroupeBadge: ({ nom }: { nom: string }) => <div>{nom}</div>,
}));

vi.mock("./folders/ThreadFolderBadges", () => ({
  ThreadFolderBadges: () => null,
}));

vi.mock("./EmailQuickActions", () => ({
  EmailQuickActions: ({
    onArchive,
    onToggleRead,
    onToggleStar,
    onDelete,
    onAssignInterlocutor,
  }: {
    onArchive: () => void;
    onToggleRead: () => void;
    onToggleStar: () => Promise<void> | void;
    onDelete: () => void;
    onAssignInterlocutor: () => void;
  }) => (
    <div>
      <button type="button" onClick={onArchive}>quick-archive</button>
      <button type="button" onClick={onToggleRead}>quick-read</button>
      <button type="button" onClick={() => void onToggleStar()}>quick-star</button>
      <button type="button" onClick={onDelete}>quick-delete</button>
      <button type="button" onClick={onAssignInterlocutor}>quick-assign</button>
    </div>
  ),
}));

vi.mock("./EmailThreadHoverCard", () => ({
  EmailThreadHoverCardContent: () => <div>hover-card-content</div>,
}));

vi.mock("./AssignInterlocutorDialog", () => ({
  AssignInterlocutorDialog: ({ open }: { open?: boolean }) => (
    <div>{open ? "assign-dialog-open" : "assign-dialog-closed"}</div>
  ),
}));

vi.mock("./EmailContextMenu", () => ({
  EmailContextMenuItems: () => <div>context-menu-items</div>,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: mockToastError,
  },
}));

vi.mock("@/services/email/emailThreadMutations", () => ({
  updateThreadPriority: mockUpdateThreadPriority,
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

describe("EmailListItemModern", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche les informations métier d'un thread externe non lu avec badges, sujet sanitizé et pièces jointes", () => {
    const Wrapper = createWrapper();

    render(
      <Wrapper>
        <EmailListItemModern
          thread={THREAD_BASE}
          selected={true}
          isNew={true}
          enrichedData={ENRICHED_EXTERNAL}
          actionHandlers={{
            onArchive: mockOnArchive,
            onDeleteThread: mockOnDeleteThread,
            onMarkAsProcessed: mockOnMarkAsProcessed,
            onMarkAsRead: mockOnMarkAsRead,
            onMarkAsSpam: mockOnMarkAsSpam,
            onUpdateTags: mockOnUpdateTags,
          }}
          onClick={mockOnClick}
          onSelect={mockOnSelect}
          onArchive={mockOnArchiveProp}
          onDelete={mockOnDelete}
        />
      </Wrapper>
    );

    const article = screen.getByRole("article");
    expect(article).toHaveAttribute("data-selected", "true");
    expect(article).toHaveAttribute("aria-label", "Email de Jean Dupont, sujet: Sujet brut");

    expect(screen.getByText("display:Jean Dupont")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("sanitized:Sujet IA")).toBeInTheDocument();
    expect(screen.getByText("il y a 2 jours")).toBeInTheDocument();

    expect(screen.getByText("Groupe Santé")).toBeInTheDocument();
    expect(screen.getByText("Clinique Bleu")).toBeInTheDocument();
    expect(screen.getByText("Partenaire Nord")).toBeInTheDocument();
    expect(screen.getByText("Rôle:directeur")).toBeInTheDocument();
    expect(screen.getByText("Commercial")).toBeInTheDocument();

    expect(screen.getByLabelText("Répondu")).toBeInTheDocument();
    expect(screen.getByLabelText("Pièces jointes")).toBeInTheDocument();

    const avatar = screen.getByTestId("entity-avatar");
    expect(avatar).toHaveTextContent("Jean Dupont");
    expect(avatar).toHaveAttribute("data-email", "jean@example.com");
    expect(avatar).toHaveAttribute("data-unread", "true");
  });

  it("affiche la variante interne avec badge OpenPulse et entité externe concernée", () => {
    const Wrapper = createWrapper();
    const internalThread = {
      ...THREAD_BASE,
      unread_count: 0,
      is_processed: true,
      category: "Interne - Support",
      from: [{ name: "Alice", email: "alice@marque.local", isCurrentUser: true }],
      etablissement: null,
      partenaire: null,
      groupe: null,
      priority: null,
    };

    render(
      <Wrapper>
        <EmailListItemModern thread={internalThread} enrichedData={ENRICHED_INTERNAL} />
      </Wrapper>
    );

    expect(screen.getByText(/OpenPulse/)).toBeInTheDocument();
    expect(screen.getByText(/Support/)).toBeInTheDocument();
    expect(screen.getByText("Groupe Externe")).toBeInTheDocument();
    expect(screen.getByText("Vous → display:Alice")).toBeInTheDocument();
    expect(screen.queryByText("Commercial")).not.toBeInTheDocument();
  });

  it("déclenche les handlers de sélection, ouverture, archive, lecture et suppression", () => {
    const Wrapper = createWrapper();

    render(
      <Wrapper>
        <EmailListItemModern
          thread={THREAD_BASE}
          actionHandlers={{
            onArchive: mockOnArchive,
            onDeleteThread: mockOnDeleteThread,
            onMarkAsProcessed: mockOnMarkAsProcessed,
            onMarkAsRead: mockOnMarkAsRead,
            onMarkAsSpam: mockOnMarkAsSpam,
            onUpdateTags: mockOnUpdateTags,
          }}
          onClick={mockOnClick}
          onSelect={mockOnSelect}
          onArchive={mockOnArchiveProp}
          onDelete={mockOnDelete}
        />
      </Wrapper>
    );

    fireEvent.click(screen.getByLabelText("select-thread"));
    expect(mockOnSelect).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByRole("article"));
    expect(mockOnClick).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(screen.getByRole("article"), { key: "Enter" });
    expect(mockOnClick).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByText("quick-archive"));
    expect(mockOnArchive).toHaveBeenCalledWith("thread-1");
    expect(mockOnArchiveProp).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("quick-read"));
    expect(mockOnMarkAsRead).toHaveBeenCalledWith("thread-1", true);

    fireEvent.click(screen.getByText("quick-delete"));
    expect(mockOnDeleteThread).toHaveBeenCalledWith("thread-1");
    expect(mockOnDelete).toHaveBeenCalledTimes(1);
  });

  it("met à jour la priorité en favori quand le thread n'est pas déjà étoilé", async () => {
    const Wrapper = createWrapper();
    const thread = { ...THREAD_BASE, priority: null };

    mockUpdateThreadPriority.mockResolvedValueOnce({ data: { ok: true }, error: null });

    render(
      <Wrapper>
        <EmailListItemModern thread={thread} />
      </Wrapper>
    );

    fireEvent.click(screen.getByText("quick-star"));

    await waitFor(() => {
      expect(mockUpdateThreadPriority).toHaveBeenCalledWith("thread-1", "high");
    });
  });

  it("retire la priorité haute quand le thread est déjà étoilé", async () => {
    const Wrapper = createWrapper();

    mockUpdateThreadPriority.mockResolvedValueOnce({ data: { ok: true }, error: null });

    render(
      <Wrapper>
        <EmailListItemModern thread={THREAD_BASE} />
      </Wrapper>
    );

    fireEvent.click(screen.getByText("quick-star"));

    await waitFor(() => {
      expect(mockUpdateThreadPriority).toHaveBeenCalledWith("thread-1", null);
    });
  });

  it("affiche une erreur toast si la mise à jour de priorité échoue", async () => {
    const Wrapper = createWrapper();

    mockUpdateThreadPriority.mockRejectedValueOnce(new Error("x"));

    render(
      <Wrapper>
        <EmailListItemModern thread={THREAD_BASE} />
      </Wrapper>
    );

    fireEvent.click(screen.getByText("quick-star"));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Erreur");
    });
  });
});
