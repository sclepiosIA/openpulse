/* @vitest-environment jsdom */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { EmailDetailPanel } from "./EmailDetailPanel";

const { emailThreadSpy, buttonClickSpy } = vi.hoisted(() => ({
  emailThreadSpy: vi.fn(),
  buttonClickSpy: vi.fn(),
}));

vi.mock("lucide-react", () => ({
  Mail: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="mail-icon" {...props} />,
  Plus: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="plus-icon" {...props} />,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
  }) => (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="scroll-area" className={className}>
      {children}
    </div>
  ),
}));

vi.mock("./EmailThread", () => ({
  EmailThread: (props: { threadId: string; onBack: () => void; embedded?: boolean }) => {
    emailThreadSpy(props);
    return (
      <div
        data-testid="email-thread"
        data-thread-id={props.threadId}
        data-embedded={String(Boolean(props.embedded))}
      >
        Thread {props.threadId}
      </div>
    );
  },
}));

describe("EmailDetailPanel", () => {
  beforeEach(() => {
    emailThreadSpy.mockClear();
    buttonClickSpy.mockClear();
  });

  it("affiche l'état vide avec les textes métier quand aucun thread n'est sélectionné", () => {
    render(<EmailDetailPanel threadId={null} />);

    expect(screen.getByText("Sélectionnez un email")).toBeInTheDocument();
    expect(
      screen.getByText("Cliquez sur un email dans la liste pour afficher son contenu ici"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("mail-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("scroll-area")).not.toBeInTheDocument();
    expect(screen.queryByTestId("email-thread")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /nouveau message/i })).not.toBeInTheDocument();
    expect(emailThreadSpy).not.toHaveBeenCalled();
  });

  it("affiche le bouton de composition et déclenche onComposeNew", () => {
    render(<EmailDetailPanel threadId={null} onComposeNew={buttonClickSpy} />);

    const button = screen.getByRole("button", { name: /nouveau message/i });
    expect(button).toBeInTheDocument();
    expect(screen.getByTestId("plus-icon")).toBeInTheDocument();

    fireEvent.click(button);

    expect(buttonClickSpy).toHaveBeenCalledTimes(1);
    expect(emailThreadSpy).not.toHaveBeenCalled();
  });

  it("affiche le thread email dans une ScrollArea quand un threadId est fourni", () => {
    render(<EmailDetailPanel threadId="thread-42" onComposeNew={buttonClickSpy} />);

    expect(screen.getByTestId("scroll-area")).toBeInTheDocument();
    expect(screen.getByTestId("email-thread")).toBeInTheDocument();
    expect(screen.getByTestId("email-thread")).toHaveAttribute("data-thread-id", "thread-42");
    expect(screen.getByTestId("email-thread")).toHaveAttribute("data-embedded", "true");
    expect(screen.queryByText("Sélectionnez un email")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /nouveau message/i })).not.toBeInTheDocument();

    expect(emailThreadSpy).toHaveBeenCalledTimes(1);
    expect(emailThreadSpy).toHaveBeenCalledWith({
      threadId: "thread-42",
      onBack: expect.any(Function),
      embedded: true,
    });
  });

  it("passe une fonction onBack no-op au composant EmailThread", () => {
    render(<EmailDetailPanel threadId="thread-back-test" />);

    expect(emailThreadSpy).toHaveBeenCalledTimes(1);
    const firstCall = emailThreadSpy.mock.calls[0];
    const props = firstCall[0] as { threadId: string; onBack: () => void; embedded?: boolean };

    expect(props.threadId).toBe("thread-back-test");
    expect(typeof props.onBack).toBe("function");
    expect(() => props.onBack()).not.toThrow();
    expect(props.embedded).toBe(true);
  });
});