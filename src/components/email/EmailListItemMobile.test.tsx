// @vitest-environment jsdom

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EmailListItemMobile } from "./EmailListItemMobile";

const {
  SANITIZE_SUBJECT,
  SANITIZE_NAME,
  MAIN_SENDER_EXTERNAL,
  MAIN_SENDER_CURRENT_USER,
  formatDistanceToNowMock,
} = vi.hoisted(() => ({
  SANITIZE_SUBJECT: vi.fn((value: string) => `Sujet nettoyé: ${value}`),
  SANITIZE_NAME: vi.fn((value?: string | null) => (value ? `Nom nettoyé: ${value}` : "")),
  MAIN_SENDER_EXTERNAL: {
    name: "Alice Martin",
    email: "alice@example.test",
    isCurrentUser: false,
  },
  MAIN_SENDER_CURRENT_USER: {
    name: "Moi",
    email: "moi@example.test",
    isCurrentUser: true,
  },
  formatDistanceToNowMock: vi.fn(() => "il y a 2 heures"),
}));

vi.mock("lucide-react", () => ({
  Mail: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-mail" {...props} />,
  MailOpen: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-mail-open" {...props} />,
  Paperclip: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-paperclip" {...props} />,
  Star: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-star" {...props} />,
  Users: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-users" {...props} />,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({
    children,
    className,
    variant,
  }: {
    children: React.ReactNode;
    className?: string;
    variant?: string;
  }) => (
    <span data-testid="badge" data-variant={variant} className={className}>
      {children}
    </span>
  ),
}));

vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
    className,
  }: {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    className?: string;
  }) => (
    <button
      type="button"
      data-testid="checkbox"
      aria-pressed={checked}
      className={className}
      onClick={() => onCheckedChange?.(!checked)}
    >
      checkbox
    </button>
  ),
}));

vi.mock("date-fns", () => ({
  formatDistanceToNow: formatDistanceToNowMock,
}));

vi.mock("date-fns/locale", () => ({
  fr: { code: "fr" },
}));

vi.mock("@/lib/emailUtils", () => ({
  sanitizeEmailSubject: SANITIZE_SUBJECT,
  sanitizeDisplayName: SANITIZE_NAME,
  getThreadMainSender: vi.fn(),
}));

vi.mock("@/lib/utils", () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
}));

import { getThreadMainSender } from "@/lib/emailUtils";

type ThreadLike = {
  unread_count: number;
  account?: { email_address?: string | null } | null;
  last_message_date: string;
  ai_generated_title?: string | null;
  subject: string;
  priority?: string | null;
  message_count: number;
  category?: string | null;
  etablissement?: { nom?: string | null } | null;
  groupe?: { nom?: string | null } | null;
  ai_summary?: string | null;
  messages?: Array<{
    has_attachments?: boolean | null;
    cc_addresses?: string[] | null;
  }> | null;
};

const createThread = (overrides: Partial<ThreadLike> = {}): ThreadLike => ({
  unread_count: 2,
  account: { email_address: "user@acme.test" },
  last_message_date: "2024-03-01T10:00:00.000Z",
  ai_generated_title: "Titre IA",
  subject: "Sujet original",
  priority: "high",
  message_count: 3,
  category: "Support",
  etablissement: { nom: "Clinique du Lac" },
  groupe: { nom: "Groupe Santé" },
  ai_summary: "Résumé IA du fil",
  messages: [
    {
      has_attachments: true,
      cc_addresses: ["cc@example.test"],
    },
  ],
  ...overrides,
});

describe("EmailListItemMobile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getThreadMainSender).mockReturnValue(MAIN_SENDER_EXTERNAL);
    formatDistanceToNowMock.mockReturnValue("il y a 2 heures");
  });

  it("affiche les informations métier d'un email non lu enrichi et gère les interactions", () => {
    const onClick = vi.fn();
    const onSelect = vi.fn();
    const thread = createThread();
    const enrichedData = {
      contact: {
        type_contact: "Prospect",
      },
    };

    render(
      <EmailListItemMobile
        thread={thread}
        selected={true}
        isNew={true}
        enrichedData={enrichedData}
        onClick={onClick}
        onSelect={onSelect}
      />
    );

    const article = screen.getByRole("article", {
      name: "Email de Alice Martin, non lu",
    });

    expect(article).toHaveAttribute("data-selected", "true");
    expect(article.className).toContain("bg-accent");
    expect(article.className).toContain("bg-blue-50");
    expect(article.className).toContain("animate-in");

    expect(screen.getByTestId("icon-mail")).toBeInTheDocument();
    expect(screen.queryByTestId("icon-mail-open")).not.toBeInTheDocument();

    expect(screen.getByText("Nom nettoyé: Alice Martin")).toBeInTheDocument();
    expect(screen.getByText("il y a 2 heures")).toBeInTheDocument();
    expect(screen.getByText("Sujet nettoyé: Titre IA")).toBeInTheDocument();
    expect(screen.getByText("Résumé IA du fil")).toBeInTheDocument();

    expect(screen.getByTestId("icon-star")).toBeInTheDocument();
    expect(screen.getByTestId("icon-paperclip")).toBeInTheDocument();
    expect(screen.getByTestId("icon-users")).toBeInTheDocument();

    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Support")).toBeInTheDocument();
    expect(screen.getByText("Clinique du Lac")).toBeInTheDocument();
    expect(screen.getByText("Prospect")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("checkbox"));
    expect(onSelect).toHaveBeenCalledWith(false);
    expect(onClick).not.toHaveBeenCalled();

    fireEvent.click(article);
    expect(onClick).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(article, { key: "Enter" });
    fireEvent.keyDown(article, { key: " " });
    expect(onClick).toHaveBeenCalledTimes(3);

    expect(SANITIZE_NAME).toHaveBeenCalledWith("Alice Martin");
    expect(SANITIZE_SUBJECT).toHaveBeenCalledWith("Titre IA");
    expect(getThreadMainSender).toHaveBeenCalledWith(thread, "user@acme.test");
    expect(formatDistanceToNowMock).toHaveBeenCalledWith(new Date("2024-03-01T10:00:00.000Z"), {
      addSuffix: false,
      locale: { code: "fr" },
    });
  });

  it("affiche un email lu envoyé par l'utilisateur avec fallback groupe et sans badges optionnels absents", () => {
    vi.mocked(getThreadMainSender).mockReturnValue(MAIN_SENDER_CURRENT_USER);

    const thread = createThread({
      unread_count: 0,
      priority: "normal",
      message_count: 1,
      category: null,
      etablissement: null,
      groupe: { nom: "Groupe Santé" },
      ai_summary: null,
      ai_generated_title: null,
      subject: "Demande de devis",
      messages: [
        {
          has_attachments: false,
          cc_addresses: [],
        },
      ],
    });

    render(<EmailListItemMobile thread={thread} />);

    const article = screen.getByRole("article", {
      name: "Email de Moi, lu",
    });

    expect(article).not.toHaveAttribute("data-selected");
    expect(article.className).toContain("border-l-transparent");
    expect(article.className).not.toContain("bg-blue-50");

    expect(screen.getByTestId("icon-mail-open")).toBeInTheDocument();
    expect(screen.queryByTestId("icon-mail")).not.toBeInTheDocument();

    expect(screen.getByText("Vous → Nom nettoyé: Moi")).toBeInTheDocument();
    expect(screen.getByText("Sujet nettoyé: Demande de devis")).toBeInTheDocument();
    expect(screen.getByText("Groupe Santé")).toBeInTheDocument();

    expect(screen.queryByTestId("icon-star")).not.toBeInTheDocument();
    expect(screen.queryByTestId("icon-paperclip")).not.toBeInTheDocument();
    expect(screen.queryByTestId("icon-users")).not.toBeInTheDocument();
    expect(screen.queryByText("Support")).not.toBeInTheDocument();
    expect(screen.queryByText("Résumé IA du fil")).not.toBeInTheDocument();
    expect(screen.queryByText("1")).not.toBeInTheDocument();

    expect(SANITIZE_SUBJECT).toHaveBeenCalledWith("Demande de devis");
  });

  it("utilise les fallbacks de nom et sujet quand les données expéditeur sont incomplètes", () => {
    vi.mocked(getThreadMainSender).mockReturnValue({
      name: "",
      email: "fallback@example.test",
      isCurrentUser: false,
    });
    SANITIZE_NAME.mockReturnValueOnce("");

    const thread = createThread({
      ai_generated_title: null,
      subject: "Objet brut",
    });

    render(<EmailListItemMobile thread={thread} />);

    expect(screen.getByRole("article", { name: "Email de fallback@example.test, non lu" })).toBeInTheDocument();
    expect(screen.getByText("fallback")).toBeInTheDocument();
    expect(screen.getByText("Sujet nettoyé: Objet brut")).toBeInTheDocument();
  });
});