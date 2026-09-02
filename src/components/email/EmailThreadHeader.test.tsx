import React from "react";
import { render, screen, act } from "@testing-library/react";

const stable = vi.hoisted(() => {
  const stableThreadBase = {
    id: "th_1",
    subject: " Re:   Hello   ",
    ai_generated_title: null as string | null,
    category: "Support",
    priority: "high" as const,
    is_archived: true,
    is_spam: true,
    tags: ["tag1", "tag2", "tag3", "tag4"],
    account: { email_address: "acct@example.test" },
    etablissement: null as null | { id: string },
    partenaire: null as null | { id: string },
  };

  const stableMessages = [
    { from_name: "Alice", from_address: "Alice@Example.Test" },
    { from_name: "Bob", from_address: "bob@example.test" },
    { from_name: null, from_address: "bob@example.test" },
    { from_name: "Carol", from_address: "carol@example.test" },
    { from_name: "Dan", from_address: "dan@example.test" },
    { from_name: "Erin", from_address: "erin@example.test" },
  ] as const;

  const mockOnUpdateTags = vi.fn<(tags: string[]) => void>();

  return { stableThreadBase, stableMessages, mockOnUpdateTags };
});

vi.mock("@/components/ui/badge", () => {
  return {
    Badge: (props: { children?: React.ReactNode; variant?: string; className?: string }) => {
      const variant = props.variant ?? "default";
      return (
        <span data-testid="badge" data-variant={variant} className={props.className}>
          {props.children}
        </span>
      );
    },
  };
});

vi.mock("@/lib/emailUtils", () => {
  return {
    sanitizeEmailSubject: (s: string) => `sanitized:${String(s).trim().replace(/\s+/g, " ")}`,
  };
});

vi.mock("./EmailThreadTags", () => {
  return {
    EmailThreadTags: (props: {
      tags: string[];
      onUpdateTags: (tags: string[]) => void;
      disabled: boolean;
      maxVisible: number;
    }) => {
      return (
        <div
          data-testid="email-thread-tags"
          data-disabled={String(props.disabled)}
          data-max-visible={String(props.maxVisible)}
        >
          <span data-testid="tags-text">{props.tags.join("|")}</span>
          <button type="button" onClick={() => props.onUpdateTags(["new", "tags"])}>
            update-tags
          </button>
        </div>
      );
    },
  };
});

vi.mock("./EmailAvatar", () => {
  return {
    EmailAvatar: (props: { name: string; email: string; size?: string; className?: string }) => {
      return (
        <div
          data-testid="email-avatar"
          data-name={props.name}
          data-email={props.email}
          data-size={props.size ?? ""}
          data-class={props.className ?? ""}
        />
      );
    },
  };
});

import { EmailThreadHeader } from "./EmailThreadHeader";

describe("EmailThreadHeader", () => {
  it("affiche le sujet sanitizé, les badges, les tags et les participants (avatars + résumé) quand pas d'etablissement/partenaire", () => {
    const thread = { ...stable.stableThreadBase, ai_generated_title: null, subject: "  Re:   Hello   " };

    render(
      <EmailThreadHeader
        thread={thread}
        isUpdatingTags={false}
        onUpdateTags={stable.mockOnUpdateTags}
        messages={[...stable.stableMessages]}
      />
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("sanitized:Re: Hello");

    const badges = screen.getAllByTestId("badge");
    const badgeTexts = badges.map((b) => b.textContent ?? "");

    expect(badgeTexts).toContain("Support");
    expect(badgeTexts).toContain("Priorité haute");
    expect(badgeTexts).toContain("Archivé");
    expect(badgeTexts).toContain("Spam");
    expect(badgeTexts).toContain("acct@example.test");

    expect(screen.getByTestId("email-thread-tags")).toHaveAttribute("data-disabled", "false");
    expect(screen.getByTestId("email-thread-tags")).toHaveAttribute("data-max-visible", "3");
    expect(screen.getByTestId("tags-text")).toHaveTextContent("tag1|tag2|tag3|tag4");

    const avatars = screen.getAllByTestId("email-avatar");
    expect(avatars).toHaveLength(4);
    const emails = avatars.map((a) => a.getAttribute("data-email"));
    expect(emails).toEqual(["alice@example.test", "bob@example.test", "carol@example.test", "dan@example.test"]);

    expect(screen.getByText("Alice, Bob +3 autres")).toBeInTheDocument();
  });

  it("utilise ai_generated_title s'il est présent (prioritaire sur subject)", () => {
    const thread = {
      ...stable.stableThreadBase,
      subject: "Subject original",
      ai_generated_title: "  AI   title  ",
    };

    render(
      <EmailThreadHeader thread={thread} isUpdatingTags={false} onUpdateTags={stable.mockOnUpdateTags} messages={[]} />
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("sanitized:AI title");
  });

  it("désactive la mise à jour des tags quand isUpdatingTags=true et appelle onUpdateTags avec les valeurs fournies par le composant de tags", async () => {
    stable.mockOnUpdateTags.mockClear();
    const thread = { ...stable.stableThreadBase };

    const userEventMod = await import("@testing-library/user-event");
    const user = userEventMod.default.setup();

    render(<EmailThreadHeader thread={thread} isUpdatingTags={true} onUpdateTags={stable.mockOnUpdateTags} messages={[]} />);

    expect(screen.getByTestId("email-thread-tags")).toHaveAttribute("data-disabled", "true");

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "update-tags" }));
    });

    expect(stable.mockOnUpdateTags).toHaveBeenCalledTimes(1);
    expect(stable.mockOnUpdateTags).toHaveBeenCalledWith(["new", "tags"]);
  });

  it("n'affiche pas les participants si thread.etablissement ou thread.partenaire est présent", () => {
    const threadWithEtablissement = { ...stable.stableThreadBase, etablissement: { id: "e_1" } };
    const threadWithPartenaire = { ...stable.stableThreadBase, partenaire: { id: "p_1" } };

    const { rerender } = render(
      <EmailThreadHeader
        thread={threadWithEtablissement}
        isUpdatingTags={false}
        onUpdateTags={stable.mockOnUpdateTags}
        messages={[...stable.stableMessages]}
      />
    );

    expect(screen.queryAllByTestId("email-avatar")).toHaveLength(0);
    expect(screen.queryByText(/Alice, Bob/)).toBeNull();

    rerender(
      <EmailThreadHeader
        thread={threadWithPartenaire}
        isUpdatingTags={false}
        onUpdateTags={stable.mockOnUpdateTags}
        messages={[...stable.stableMessages]}
      />
    );

    expect(screen.queryAllByTestId("email-avatar")).toHaveLength(0);
    expect(screen.queryByText(/Alice, Bob/)).toBeNull();
  });

  it("ne rend pas la section participants si messages est absent ou vide", () => {
    const thread = { ...stable.stableThreadBase };

    const { rerender } = render(
      <EmailThreadHeader thread={thread} isUpdatingTags={false} onUpdateTags={stable.mockOnUpdateTags} />
    );

    expect(screen.queryAllByTestId("email-avatar")).toHaveLength(0);

    rerender(
      <EmailThreadHeader thread={thread} isUpdatingTags={false} onUpdateTags={stable.mockOnUpdateTags} messages={[]} />
    );

    expect(screen.queryAllByTestId("email-avatar")).toHaveLength(0);
  });
});