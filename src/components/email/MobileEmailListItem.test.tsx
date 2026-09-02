// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MobileEmailListItem } from "./MobileEmailListItem";

const {
  THREAD,
  THREAD_FROM_USER,
  ENRICHED_REPLY,
  mockSanitizeEmailSubject,
  mockSanitizeDisplayName,
  mockGetThreadMainSender,
  mockUseLongPress,
} = vi.hoisted(() => ({
  THREAD: {
    id: "thread-1",
    unread_count: 2,
    is_processed: false,
    priority: "high",
    subject: "Sujet brut",
    ai_generated_title: "Titre IA",
    ai_summary: "Résumé IA",
    last_message_date: "2024-01-01T12:00:00.000Z",
    message_count: 3,
    category: "Support",
    account: { email_address: "me@example.com" },
    etablissement: { nom: "Clinique Paris" },
    groupe: null,
    partenaire: null,
  },
  THREAD_FROM_USER: {
    id: "thread-1",
    unread_count: 0,
    is_processed: true,
    priority: "normal",
    subject: "Sujet brut",
    ai_generated_title: null,
    ai_summary: "",
    last_message_date: "2024-01-01T12:00:00.000Z",
    message_count: 1,
    category: "Facturation",
    account: { email_address: "me@example.com" },
    etablissement: null,
    groupe: null,
    partenaire: null,
  },
  ENRICHED_REPLY: { hasReply: true, isInternalTeam: true },
  mockSanitizeEmailSubject: vi.fn((value: string | null | undefined) => `sanitized:${value ?? ""}`),
  mockSanitizeDisplayName: vi.fn((value: string | null | undefined) => value ?? ""),
  mockGetThreadMainSender: vi.fn(),
  mockUseLongPress: vi.fn(),
}));

vi.mock("date-fns", () => ({
  formatDistanceToNow: vi.fn(() => "il y a 2 jours"),
}));

vi.mock("date-fns/locale", () => ({
  fr: {},
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
}));

vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
    ...props
  }: {
    checked?: boolean;
    onCheckedChange?: (value: boolean) => void;
  } & React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      {...props}
    />
  ),
}));

vi.mock("@/lib/utils", () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
}));

vi.mock("@/lib/emailUtils", () => ({
  sanitizeEmailSubject: mockSanitizeEmailSubject,
  sanitizeDisplayName: mockSanitizeDisplayName,
  getThreadMainSender: mockGetThreadMainSender,
}));

vi.mock("./EmailAvatar", () => ({
  EmailAvatar: ({ name, email }: { name?: string; email?: string }) => (
    <div data-testid="email-avatar">{`${name ?? ""}|${email ?? ""}`}</div>
  ),
}));

vi.mock("@/components/mobile/SwipeableListItem", () => ({
  SwipeableListItem: ({
    children,
    leftActions,
    rightActions,
  }: {
    children: React.ReactNode;
    leftActions?: Array<{ id: string; label: string; onAction: () => void }>;
    rightActions?: Array<{ id: string; label: string; onAction: () => void }>;
  }) => (
    <div>
      <div data-testid="swipe-left-actions">
        {leftActions?.map((action) => (
          <button key={action.id} type="button" onClick={action.onAction}>
            {action.label}
          </button>
        ))}
      </div>
      <div data-testid="swipe-right-actions">
        {rightActions?.map((action) => (
          <button key={action.id} type="button" onClick={action.onAction}>
            {action.label}
          </button>
        ))}
      </div>
      {children}
    </div>
  ),
}));

vi.mock("@/hooks/shared/useLongPress", () => ({
  useLongPress: mockUseLongPress,
}));

vi.mock("./AssignInterlocutorDialog", () => ({
  AssignInterlocutorDialog: ({
    open,
    threadId,
    senderEmail,
    senderName,
    onOpenChange,
  }: {
    open: boolean;
    threadId: string;
    senderEmail: string;
    senderName: string | null;
    onOpenChange: (value: boolean) => void;
  }) =>
    open ? (
      <div data-testid="assign-dialog">
        <div>{threadId}</div>
        <div>{senderEmail}</div>
        <div>{senderName ?? ""}</div>
        <button type="button" onClick={() => onOpenChange(false)}>
          close-dialog
        </button>
      </div>
    ) : null,
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <>{children}</>,
  DropdownMenuContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  DropdownMenuItem: ({
    children,
    onSelect,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { onSelect?: () => void }) => (
    <button type="button" onClick={() => onSelect?.()} {...props}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr />,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock("lucide-react", () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />;
  return {
    Archive: Icon,
    ChevronRight: Icon,
    Mail: Icon,
    MailOpen: Icon,
    Trash2: Icon,
    UserPlus: Icon,
    MoreVertical: Icon,
    CheckCircle2: Icon,
    Circle: Icon,
    Star: Icon,
    StarOff: Icon,
    Ban: Icon,
    Reply: Icon,
  };
});

describe("MobileEmailListItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetThreadMainSender.mockReturnValue({
      name: "Alice Martin",
      email: "alice@example.com",
      isCurrentUser: false,
    });
    mockUseLongPress.mockImplementation(({ onLongPress }: { onLongPress: () => void }) => ({
      handlers: {
        onContextMenu: (e: React.MouseEvent) => {
          e.preventDefault();
          onLongPress();
        },
      },
    }));
  });

  it("affiche les informations métier principales et déclenche les actions de swipe", () => {
    const onClick = vi.fn();
    const onToggleRead = vi.fn();
    const onArchive = vi.fn();
    const onDelete = vi.fn();

    render(
      <MobileEmailListItem
        thread={THREAD}
        enrichedData={ENRICHED_REPLY}
        isNew
        onClick={onClick}
        onToggleRead={onToggleRead}
        onArchive={onArchive}
        onDelete={onDelete}
      />
    );

    expect(screen.getByLabelText("Email de Alice Martin: sanitized:Sujet brut")).toBeInTheDocument();
    expect(screen.getByText("Alice Martin")).toBeInTheDocument();
    expect(screen.getByText("sanitized:Titre IA")).toBeInTheDocument();
    expect(screen.getByText("Résumé IA")).toBeInTheDocument();
    expect(screen.getByText("Urgent")).toBeInTheDocument();
    expect(screen.getByText("Clinique Paris")).toBeInTheDocument();
    expect(screen.getByText("(3)")).toBeInTheDocument();
    expect(screen.getByText("il y a 2 jours")).toBeInTheDocument();
    expect(screen.getByTestId("email-avatar")).toHaveTextContent("Alice Martin|alice@example.com");

    fireEvent.click(screen.getByTestId("swipe-left-actions").querySelectorAll("button")[0]);
    expect(onToggleRead).toHaveBeenCalledWith("thread-1");

    fireEvent.click(screen.getByTestId("swipe-right-actions").querySelectorAll("button")[0]);
    expect(onArchive).toHaveBeenCalledWith("thread-1");

    fireEvent.click(screen.getByTestId("swipe-right-actions").querySelectorAll("button")[1]);
    expect(onDelete).toHaveBeenCalledWith("thread-1");

    fireEvent.click(screen.getByRole("article"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("gère la sélection, le clavier, le long press et les options du menu contextuel", () => {
    const onSelect = vi.fn();
    const onEnterMultiSelect = vi.fn();
    const onMarkAsProcessed = vi.fn();
    const onToggleRead = vi.fn();
    const onToggleStar = vi.fn();
    const onArchive = vi.fn();
    const onDelete = vi.fn();
    const onMarkAsSpam = vi.fn();
    const onClick = vi.fn();

    render(
      <MobileEmailListItem
        thread={THREAD}
        selected
        onSelect={onSelect}
        onEnterMultiSelect={onEnterMultiSelect}
        onMarkAsProcessed={onMarkAsProcessed}
        onToggleRead={onToggleRead}
        onToggleStar={onToggleStar}
        onArchive={onArchive}
        onDelete={onDelete}
        onMarkAsSpam={onMarkAsSpam}
        onClick={onClick}
      />
    );

    fireEvent.click(screen.getByLabelText("Sélectionner cet email"));
    expect(onSelect).toHaveBeenCalledWith(false);

    fireEvent.contextMenu(screen.getByRole("article"));
    expect(onEnterMultiSelect).toHaveBeenCalledWith("thread-1");

    fireEvent.keyDown(screen.getByRole("article"), { key: "Enter" });
    expect(onClick).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /Marquer traité/i }));
    expect(onMarkAsProcessed).toHaveBeenCalledWith("thread-1", true);

    fireEvent.click(screen.getByRole("button", { name: /^Retirer des favoris$/i }));
    expect(onToggleStar).toHaveBeenCalledWith("thread-1", true);

    fireEvent.click(screen.getByRole("button", { name: /^Signaler spam$/i }));
    expect(onMarkAsSpam).toHaveBeenCalledWith("thread-1");

    fireEvent.click(screen.getAllByRole("button", { name: /^Archiver$/i })[1]);
    expect(onArchive).toHaveBeenCalledWith("thread-1");

    fireEvent.click(screen.getAllByRole("button", { name: /^Supprimer$/i })[1]);
    expect(onDelete).toHaveBeenCalledWith("thread-1");

    fireEvent.click(screen.getAllByRole("button", { name: /^Marquer lu$/i })[1]);
    expect(onToggleRead).toHaveBeenCalledWith("thread-1");
  });

  it("affiche 'Vous → prénom' quand le dernier message vient de l'utilisateur et ouvre la boîte d'attribution", () => {
    mockGetThreadMainSender.mockReturnValue({
      name: "Jean Dupont",
      email: "jean@example.com",
      isCurrentUser: true,
    });

    render(<MobileEmailListItem thread={THREAD_FROM_USER} />);

    expect(screen.getByLabelText("Email de Vous → Jean: sanitized:Sujet brut")).toBeInTheDocument();
    expect(screen.getByText("Vous → Jean")).toBeInTheDocument();
    expect(screen.getByText("sanitized:Sujet brut")).toBeInTheDocument();
    expect(screen.getByText("Aucun aperçu disponible")).toBeInTheDocument();
    expect(screen.getByText("Facturation")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Attribuer/i }));
    expect(screen.getByTestId("assign-dialog")).toBeInTheDocument();
    expect(screen.getByText("thread-1")).toBeInTheDocument();
    expect(screen.getByText("jean@example.com")).toBeInTheDocument();
    expect(screen.getByText("Jean Dupont")).toBeInTheDocument();
  });
});