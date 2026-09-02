/* @vitest-environment jsdom */

import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { EmailThreadPreviewOverlay } from "./EmailThreadPreviewOverlay";

const { THREAD, onClose, onMouseEnterOverlay } = vi.hoisted(() => ({
  THREAD: {
    id: "thread-1",
    subject: "Sujet de test",
    snippet: "Contenu aperçu",
    messages: [],
  },
  onClose: vi.fn(),
  onMouseEnterOverlay: vi.fn(),
}));

vi.mock("lucide-react", () => ({
  X: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-x" {...props} />,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({
    children,
    className,
  }: {
    children?: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="scroll-area" className={className}>
      {children}
    </div>
  ),
}));

vi.mock("./EmailThreadHoverCard", () => ({
  EmailThreadHoverCardContent: ({ thread }: { thread: { id: string; subject?: string } }) => (
    <div data-testid="hover-card-content">
      {thread.id}::{thread.subject}
    </div>
  ),
}));

vi.mock("@/lib/utils", () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
}));

describe("EmailThreadPreviewOverlay", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("ne rend rien quand thread est null", () => {
    const { container } = render(
      <EmailThreadPreviewOverlay thread={null} onClose={onClose} onMouseEnterOverlay={onMouseEnterOverlay} />
    );

    expect(container.firstChild).toBeNull();
    expect(screen.queryByText("Aperçu rapide")).not.toBeInTheDocument();
  });

  it("rend l'overlay avec son titre, le contenu du thread et le bouton fermer", () => {
    render(
      <EmailThreadPreviewOverlay thread={THREAD} onClose={onClose} onMouseEnterOverlay={onMouseEnterOverlay} />
    );

    expect(screen.getByText("Aperçu rapide")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fermer" })).toBeInTheDocument();
    expect(screen.getByTestId("scroll-area")).toBeInTheDocument();
    expect(screen.getByTestId("hover-card-content")).toHaveTextContent("thread-1::Sujet de test");
  });

  it("appelle onClose au clic sur le bouton fermer", () => {
    render(
      <EmailThreadPreviewOverlay thread={THREAD} onClose={onClose} onMouseEnterOverlay={onMouseEnterOverlay} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("appelle onMouseEnterOverlay au survol de l'overlay", () => {
    render(
      <EmailThreadPreviewOverlay thread={THREAD} onClose={onClose} onMouseEnterOverlay={onMouseEnterOverlay} />
    );

    const title = screen.getByText("Aperçu rapide");
    const overlay = title.closest("div[class*='border-b']")?.parentElement;

    expect(overlay).toBeTruthy();

    if (overlay) {
      fireEvent.mouseEnter(overlay);
    }

    expect(onMouseEnterOverlay).toHaveBeenCalledTimes(1);
  });

  it("appelle onClose au mouseLeave de l'overlay", () => {
    render(
      <EmailThreadPreviewOverlay thread={THREAD} onClose={onClose} onMouseEnterOverlay={onMouseEnterOverlay} />
    );

    const title = screen.getByText("Aperçu rapide");
    const overlay = title.closest("div[class*='border-b']")?.parentElement;

    expect(overlay).toBeTruthy();

    if (overlay) {
      fireEvent.mouseLeave(overlay);
    }

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("appelle onClose quand la touche Escape est pressée si un thread est présent", () => {
    render(
      <EmailThreadPreviewOverlay thread={THREAD} onClose={onClose} onMouseEnterOverlay={onMouseEnterOverlay} />
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("n'appelle pas onClose pour une autre touche que Escape", () => {
    render(
      <EmailThreadPreviewOverlay thread={THREAD} onClose={onClose} onMouseEnterOverlay={onMouseEnterOverlay} />
    );

    fireEvent.keyDown(document, { key: "Enter" });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("retire le listener clavier après unmount", () => {
    const { unmount } = render(
      <EmailThreadPreviewOverlay thread={THREAD} onClose={onClose} onMouseEnterOverlay={onMouseEnterOverlay} />
    );

    unmount();
    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("n'échoue pas si onMouseEnterOverlay n'est pas fourni", () => {
    render(<EmailThreadPreviewOverlay thread={THREAD} onClose={onClose} />);

    const title = screen.getByText("Aperçu rapide");
    const overlay = title.closest("div[class*='border-b']")?.parentElement;

    expect(() => {
      if (overlay) {
        fireEvent.mouseEnter(overlay);
      }
    }).not.toThrow();

    expect(onClose).not.toHaveBeenCalled();
  });
});