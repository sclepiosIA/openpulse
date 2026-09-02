/* @vitest-environment jsdom */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { PostPreview } from "./PostPreview";

const { safeHtmlMock, buttonMock } = vi.hoisted(() => ({
  safeHtmlMock: vi.fn(
    ({ html, className }: { html: string; className?: string }) => (
      <div data-testid="safe-html-content" data-classname={className ?? ""}>
        {html}
      </div>
    )
  ),
  buttonMock: vi.fn(
    ({
      children,
      onClick,
      className,
    }: {
      children: React.ReactNode;
      onClick?: React.MouseEventHandler<HTMLButtonElement>;
      className?: string;
    }) => (
      <button type="button" onClick={onClick} className={className}>
        {children}
      </button>
    )
  ),
}));

vi.mock("./SafeHtmlContent", () => ({
  SafeHtmlContent: safeHtmlMock,
}));

vi.mock("@/components/ui/button", () => ({
  Button: buttonMock,
}));

vi.mock("lucide-react", () => ({
  ChevronDown: ({ className }: { className?: string }) => (
    <svg data-testid="chevron-down" className={className} />
  ),
  ChevronUp: ({ className }: { className?: string }) => (
    <svg data-testid="chevron-up" className={className} />
  ),
}));

describe("PostPreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche directement le contenu HTML via SafeHtmlContent quand le texte nettoyé ne dépasse pas 200 caractères", () => {
    const content = "<p>Bonjour <strong>le monde</strong></p>";

    const { container } = render(<PostPreview content={content} />);

    expect(screen.getByTestId("safe-html-content")).toHaveTextContent(content);
    expect(screen.getByTestId("safe-html-content")).toHaveAttribute("data-classname", "prose-sm");
    expect(screen.queryByRole("button", { name: /lire la suite/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /voir moins/i })).not.toBeInTheDocument();
    expect(container.querySelector(".text-sm.text-muted-foreground.mt-2")).not.toBeNull();
    expect(safeHtmlMock).toHaveBeenCalledTimes(1);
    expect(safeHtmlMock.mock.calls[0]?.[0]).toMatchObject({
      html: content,
      className: "prose-sm",
    });
    expect(safeHtmlMock.mock.calls[0]?.[1]).toEqual({});
  });

  it("tronque le contenu long, affiche le texte nettoyé sans HTML et montre le bouton de dépliage", () => {
    const longText = "a".repeat(210);
    const content = `<p>${longText}</p>`;
    const expectedPreview = `${"a".repeat(200)}...`;

    const { container } = render(<PostPreview content={content} maxLines={5} />);

    expect(screen.getByText(expectedPreview)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /lire la suite/i })).toBeInTheDocument();
    expect(screen.getByTestId("chevron-down")).toBeInTheDocument();
    expect(screen.queryByTestId("safe-html-content")).not.toBeInTheDocument();
    expect(screen.queryByText(content)).not.toBeInTheDocument();
    expect(container.querySelector(".line-clamp-3")).not.toBeNull();
    expect(safeHtmlMock).not.toHaveBeenCalled();
    expect(buttonMock).toHaveBeenCalledTimes(1);
  });

  it("déplie puis replie le contenu long avec les libellés, classes et icônes corrects", () => {
    const content = `<p>${"Texte long ".repeat(30)}</p>`;

    const { container } = render(<PostPreview content={content} />);

    const collapsedText = `${"Texte long ".repeat(30).trim().slice(0, 200)}...`;
    expect(screen.getByText(collapsedText)).toBeInTheDocument();
    expect(container.querySelector(".line-clamp-3")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /lire la suite/i }));

    expect(screen.getByRole("button", { name: /voir moins/i })).toBeInTheDocument();
    expect(screen.getByTestId("chevron-up")).toBeInTheDocument();
    expect(screen.getByTestId("safe-html-content")).toHaveTextContent(content);
    expect(screen.queryByText(collapsedText)).not.toBeInTheDocument();
    expect(container.querySelector(".line-clamp-3")).toBeNull();
    expect(safeHtmlMock).toHaveBeenCalledTimes(1);
    expect(safeHtmlMock.mock.calls[0]?.[0]).toMatchObject({
      html: content,
      className: "prose-sm",
    });
    expect(safeHtmlMock.mock.calls[0]?.[1]).toEqual({});

    fireEvent.click(screen.getByRole("button", { name: /voir moins/i }));

    expect(screen.getByRole("button", { name: /lire la suite/i })).toBeInTheDocument();
    expect(screen.getByTestId("chevron-down")).toBeInTheDocument();
    expect(screen.queryByTestId("safe-html-content")).not.toBeInTheDocument();
    expect(screen.getByText(collapsedText)).toBeInTheDocument();
    expect(container.querySelector(".line-clamp-3")).not.toBeNull();
  });

  it("nettoie les balises HTML et compacte les espaces dans l'aperçu tronqué", () => {
    const content =
      "<div>Bonjour   <strong>à</strong>   tous</div><p>" +
      "x".repeat(205) +
      "</p>";

    render(<PostPreview content={content} />);

    const previewParagraph = screen.getByText((text) => {
      return text.startsWith("Bonjour à tous") && text.endsWith("...");
    });

    expect(previewParagraph).toBeInTheDocument();
    expect(previewParagraph).toHaveTextContent(/^Bonjour à tous x+/);
    expect(previewParagraph.textContent).not.toContain("<strong>");
    expect(previewParagraph.textContent?.length).toBe(203);
  });
});