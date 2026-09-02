import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ScrollToTop } from "./ScrollToTop";

const { buttonPropsSpy, arrowUpSpy } = vi.hoisted(() => ({
  buttonPropsSpy: vi.fn(),
  arrowUpSpy: vi.fn(),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    "aria-label": ariaLabel,
    size,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    "aria-label"?: string;
    size?: string;
    className?: string;
  }) => {
    buttonPropsSpy({ onClick, ariaLabel, size, className });
    return (
      <button onClick={onClick} aria-label={ariaLabel} data-size={size} className={className}>
        {children}
      </button>
    );
  },
}));

vi.mock("lucide-react", () => ({
  ArrowUp: ({ className }: { className?: string }) => {
    arrowUpSpy({ className });
    return <svg data-testid="arrow-up-icon" className={className} />;
  },
}));

describe("ScrollToTop", () => {
  const originalScrollY = window.scrollY;
  const addEventListenerSpy = vi.spyOn(window, "addEventListener");
  const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
  const scrollToSpy = vi.fn();

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();

    Object.defineProperty(window, "scrollY", {
      value: 0,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(window, "scrollTo", {
      value: scrollToSpy,
      writable: true,
      configurable: true,
    });
  });

  afterAll(() => {
    Object.defineProperty(window, "scrollY", {
      value: originalScrollY,
      writable: true,
      configurable: true,
    });
  });

  it("ne rend rien au chargement quand la position de scroll est inférieure ou égale à 500 et enregistre le listener", () => {
    const { container } = render(<ScrollToTop />);

    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole("button", { name: "Retour en haut" })).not.toBeInTheDocument();
    expect(addEventListenerSpy).toHaveBeenCalledWith("scroll", expect.any(Function));
    expect(buttonPropsSpy).not.toHaveBeenCalled();
    expect(arrowUpSpy).not.toHaveBeenCalled();
  });

  it("affiche le bouton quand on dépasse 500px de scroll puis le masque quand on repasse en dessous", () => {
    render(<ScrollToTop />);

    Object.defineProperty(window, "scrollY", {
      value: 501,
      writable: true,
      configurable: true,
    });
    fireEvent.scroll(window);

    const button = screen.getByRole("button", { name: "Retour en haut" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("data-size", "icon");
    expect(button).toHaveClass("fixed");
    expect(button).toHaveClass("bottom-24");
    expect(button).toHaveClass("right-8");
    expect(button).toHaveClass("rounded-full");
    expect(button).toHaveClass("animate-fade-in");

    expect(buttonPropsSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        ariaLabel: "Retour en haut",
        size: "icon",
        className: expect.stringContaining("fixed bottom-24 right-8"),
      }),
    );
    expect(arrowUpSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        className: "h-5 w-5",
      }),
    );
    expect(screen.getByTestId("arrow-up-icon")).toBeInTheDocument();

    Object.defineProperty(window, "scrollY", {
      value: 500,
      writable: true,
      configurable: true,
    });
    fireEvent.scroll(window);

    expect(screen.queryByRole("button", { name: "Retour en haut" })).not.toBeInTheDocument();
  });

  it("remonte en haut avec un scroll smooth au clic", () => {
    render(<ScrollToTop />);

    Object.defineProperty(window, "scrollY", {
      value: 700,
      writable: true,
      configurable: true,
    });
    fireEvent.scroll(window);

    fireEvent.click(screen.getByRole("button", { name: "Retour en haut" }));

    expect(scrollToSpy).toHaveBeenCalledTimes(1);
    expect(scrollToSpy).toHaveBeenCalledWith({
      top: 0,
      behavior: "smooth",
    });
  });

  it("retire le listener scroll au démontage avec la même callback", () => {
    const { unmount } = render(<ScrollToTop />);

    const scrollListenerCall = addEventListenerSpy.mock.calls.find((call) => call[0] === "scroll");
    expect(scrollListenerCall).toBeTruthy();

    const registeredListener = scrollListenerCall?.[1];
    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith("scroll", registeredListener);
  });
});