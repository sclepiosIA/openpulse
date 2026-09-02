import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MobileEmailMessage } from "./MobileEmailMessage";

const {
  sanitizeDisplayNameMock,
  formatDistanceToNowMock,
  swipeablePropsSpy,
  emailContentPropsSpy,
  emailAvatarPropsSpy,
  messageBase,
  attachmentA,
  attachmentB,
} = vi.hoisted(() => {
  const attachmentA = {
    id: "att-1",
    filename: "facture.pdf",
    size_bytes: 500,
  };

  const attachmentB = {
    id: "att-2",
    filename: "archive.zip",
    size_bytes: 1536,
  };

  const messageBase = {
    id: "msg-1",
    from_name: "Jean Dupont",
    from_address: "jean@example.test",
    sent_date: "2024-01-01T10:00:00.000Z",
    to_addresses: ["alice@example.test", "bob@example.test"],
    body_html: "<p>Bonjour</p>",
    body_text: "Bonjour en texte",
    has_attachments: true,
    attachments: [attachmentA, attachmentB],
  };

  return {
    sanitizeDisplayNameMock: vi.fn(() => "Jean nettoyé"),
    formatDistanceToNowMock: vi.fn(() => "il y a 2 heures"),
    swipeablePropsSpy: vi.fn(),
    emailContentPropsSpy: vi.fn(),
    emailAvatarPropsSpy: vi.fn(),
    messageBase,
    attachmentA,
    attachmentB,
  };
});

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    className,
    "aria-label": ariaLabel,
    type,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
    "aria-label"?: string;
    type?: "button" | "submit" | "reset";
  }) => (
    <button type={type ?? "button"} onClick={onClick} className={className} aria-label={ariaLabel}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/mobile/SwipeableListItem", () => ({
  SwipeableListItem: ({
    children,
    leftActions,
    rightActions,
  }: {
    children: React.ReactNode;
    leftActions: unknown[];
    rightActions: unknown[];
  }) => {
    swipeablePropsSpy({ leftActions, rightActions });
    return <div data-testid="swipeable">{children}</div>;
  },
}));

vi.mock("./EmailContentWithImages", () => ({
  EmailContentWithImages: ({
    htmlContent,
    messageId,
  }: {
    htmlContent: string;
    messageId: string;
  }) => {
    emailContentPropsSpy({ htmlContent, messageId });
    return (
      <div data-testid="email-content">
        {messageId}:{htmlContent}
      </div>
    );
  },
}));

vi.mock("./EmailAvatar", () => ({
  EmailAvatar: ({
    name,
    email,
    size,
  }: {
    name?: string;
    email: string;
    size: string;
  }) => {
    emailAvatarPropsSpy({ name, email, size });
    return <div data-testid="email-avatar">{name ?? email}</div>;
  },
}));

vi.mock("lucide-react", () => ({
  Reply: () => <svg data-testid="icon-reply" />,
  Forward: () => <svg data-testid="icon-forward" />,
  ChevronDown: () => <svg data-testid="icon-chevron-down" />,
  ChevronUp: () => <svg data-testid="icon-chevron-up" />,
  Paperclip: () => <svg data-testid="icon-paperclip" />,
  Download: () => <svg data-testid="icon-download" />,
}));

vi.mock("date-fns", () => ({
  formatDistanceToNow: formatDistanceToNowMock,
}));

vi.mock("date-fns/locale", () => ({
  fr: { code: "fr" },
}));

vi.mock("@/lib/emailUtils", () => ({
  sanitizeDisplayName: sanitizeDisplayNameMock,
}));

describe("MobileEmailMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sanitizeDisplayNameMock.mockReturnValue("Jean nettoyé");
    formatDistanceToNowMock.mockReturnValue("il y a 2 heures");
  });

  it("rend l'entête compact, formate le nom/date et configure les actions swipe", () => {
    const onToggleExpand = vi.fn();
    const onReply = vi.fn();
    const onForward = vi.fn();

    render(
      <MobileEmailMessage
        message={messageBase}
        isExpanded={false}
        onToggleExpand={onToggleExpand}
        onReply={onReply}
        onForward={onForward}
      />,
    );

    expect(screen.getByText("Jean nettoyé")).toBeInTheDocument();
    expect(screen.getByText("il y a 2 heures")).toBeInTheDocument();
    expect(screen.getByTestId("icon-chevron-down")).toBeInTheDocument();
    expect(screen.queryByTestId("icon-chevron-up")).not.toBeInTheDocument();

    expect(sanitizeDisplayNameMock).toHaveBeenCalledWith("Jean Dupont");
    expect(formatDistanceToNowMock).toHaveBeenCalledTimes(1);

    expect(emailAvatarPropsSpy).toHaveBeenCalledWith({
      name: "Jean Dupont",
      email: "jean@example.test",
      size: "sm",
    });

    expect(swipeablePropsSpy).toHaveBeenCalledTimes(1);
    const swipeableArgs = swipeablePropsSpy.mock.calls[0][0] as {
      leftActions: [{ id: string; label: string; color: string; onAction: () => void }];
      rightActions: [{ id: string; label: string; color: string; onAction: () => void }];
    };

    expect(swipeableArgs.leftActions[0].id).toBe("reply");
    expect(swipeableArgs.leftActions[0].label).toBe("Répondre");
    expect(swipeableArgs.leftActions[0].color).toBe("primary");
    expect(swipeableArgs.leftActions[0].onAction).toBe(onReply);

    expect(swipeableArgs.rightActions[0].id).toBe("forward");
    expect(swipeableArgs.rightActions[0].label).toBe("Transférer");
    expect(swipeableArgs.rightActions[0].color).toBe("success");
    expect(swipeableArgs.rightActions[0].onAction).toBe(onForward);

    fireEvent.click(screen.getByText("Jean nettoyé"));
    expect(onToggleExpand).toHaveBeenCalledTimes(1);
  });

  it("affiche le contenu HTML, les destinataires, les pièces jointes et déclenche le téléchargement", () => {
    const onDownloadAttachment = vi.fn();

    render(
      <MobileEmailMessage
        message={messageBase}
        isExpanded={true}
        onToggleExpand={vi.fn()}
        onReply={vi.fn()}
        onForward={vi.fn()}
        onDownloadAttachment={onDownloadAttachment}
      />,
    );

    expect(screen.getByTestId("icon-chevron-up")).toBeInTheDocument();
    expect(screen.getByText(/À:/)).toBeInTheDocument();
    expect(screen.getByText("alice@example.test, bob@example.test")).toBeInTheDocument();

    expect(screen.getByTestId("email-content")).toHaveTextContent("msg-1:<p>Bonjour</p>");
    expect(emailContentPropsSpy).toHaveBeenCalledWith({
      htmlContent: "<p>Bonjour</p>",
      messageId: "msg-1",
    });

    expect(screen.getByText("2 pièces jointes")).toBeInTheDocument();
    expect(screen.getByText("facture.pdf")).toBeInTheDocument();
    expect(screen.getByText("500 B")).toBeInTheDocument();
    expect(screen.getByText("archive.zip")).toBeInTheDocument();
    expect(screen.getByText("1.5 KB")).toBeInTheDocument();

    fireEvent.click(screen.getByText("facture.pdf"));
    expect(onDownloadAttachment).toHaveBeenCalledTimes(1);
    expect(onDownloadAttachment).toHaveBeenCalledWith(attachmentA);
  });

  it("affiche le body_text en fallback et gère les tailles en MB ainsi que l'absence de callback téléchargement", () => {
    const message = {
      ...messageBase,
      body_html: "",
      body_text: "Contenu texte brut",
      attachments: [
        {
          id: "att-3",
          filename: "video.mov",
          size_bytes: 3 * 1024 * 1024,
        },
      ],
    };

    render(
      <MobileEmailMessage
        message={message}
        isExpanded={true}
        onToggleExpand={vi.fn()}
        onReply={vi.fn()}
        onForward={vi.fn()}
      />,
    );

    expect(screen.getByText("Contenu texte brut")).toBeInTheDocument();
    expect(screen.queryByTestId("email-content")).not.toBeInTheDocument();
    expect(screen.getByText("1 pièce jointe")).toBeInTheDocument();
    expect(screen.getByText("3.0 MB")).toBeInTheDocument();

    fireEvent.click(screen.getByText("video.mov"));
  });

  it("masque les sections optionnelles quand il n'y a ni destinataires ni pièces jointes", () => {
    const message = {
      ...messageBase,
      to_addresses: [],
      has_attachments: false,
      attachments: [],
      body_html: "",
      body_text: "Sans html",
    };

    render(
      <MobileEmailMessage
        message={message}
        isExpanded={true}
        onToggleExpand={vi.fn()}
        onReply={vi.fn()}
        onForward={vi.fn()}
      />,
    );

    expect(screen.queryByText(/À:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/pièce jointe/)).not.toBeInTheDocument();
    expect(screen.getByText("Sans html")).toBeInTheDocument();
  });
});