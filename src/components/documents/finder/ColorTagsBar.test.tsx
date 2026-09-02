import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ColorTagsBar, FINDER_COLOR_TAGS } from "./ColorTagsBar";

const { cnUtilsMock, CheckMock, TooltipMock, TooltipTriggerMock, TooltipContentMock, TooltipProviderMock, onTagToggleMockFactory } =
  vi.hoisted(() => ({
    cnUtilsMock: (...classes: string[]) => classes.filter(Boolean).join(" "),
    CheckMock: ({ className }: { className?: string }) => (
      <svg data-testid="check-icon" className={className} />
    ),
    TooltipMock: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="tooltip">{children}</div>
    ),
    TooltipTriggerMock: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="tooltip-trigger">{children}</div>
    ),
    TooltipContentMock: ({
      children,
    }: {
      children: React.ReactNode;
      side?: string;
      className?: string;
    }) => <div data-testid="tooltip-content">{children}</div>,
    TooltipProviderMock: ({
      children,
    }: {
      children: React.ReactNode;
      delayDuration?: number;
    }) => <div data-testid="tooltip-provider">{children}</div>,
    onTagToggleMockFactory: () => vi.fn(),
  }));

vi.mock("@/lib/utils", () => ({
  cn: cnUtilsMock,
}));

vi.mock("lucide-react", () => ({
  Check: CheckMock,
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: TooltipMock,
  TooltipTrigger: TooltipTriggerMock,
  TooltipContent: TooltipContentMock,
  TooltipProvider: TooltipProviderMock,
}));

describe("ColorTagsBar", () => {
  it("affiche tous les tags de couleur avec les bons labels et aria-label", () => {
    const onTagToggleMock = onTagToggleMockFactory();

    render(
      <ColorTagsBar
        selectedTags={[]}
        onTagToggle={onTagToggleMock}
        disabled={false}
        className="extra-class"
      />
    );

    FINDER_COLOR_TAGS.forEach((tag) => {
      const button = screen.getByRole("button", {
        name: `Tag ${tag.label}`,
      });
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute("aria-pressed", "false");
    });

    expect(screen.getAllByTestId("tooltip-provider").length).toBe(1);
    expect(screen.getAllByTestId("tooltip").length).toBe(FINDER_COLOR_TAGS.length);
  });

  it("appelle onTagToggle avec le bon id lorsqu'on clique sur un tag", () => {
    const onTagToggleMock = onTagToggleMockFactory();

    render(
      <ColorTagsBar
        selectedTags={[]}
        onTagToggle={onTagToggleMock}
      />
    );

    const firstTag = FINDER_COLOR_TAGS[0];
    const button = screen.getByRole("button", {
      name: `Tag ${firstTag.label}`,
    });

    fireEvent.click(button);

    expect(onTagToggleMock).toHaveBeenCalledTimes(1);
    expect(onTagToggleMock).toHaveBeenCalledWith(firstTag.id);
  });

  it("affiche l'icône Check uniquement pour les tags sélectionnés", () => {
    const onTagToggleMock = onTagToggleMockFactory();

    const selectedId = FINDER_COLOR_TAGS[1].id;

    render(
      <ColorTagsBar
        selectedTags={[selectedId]}
        onTagToggle={onTagToggleMock}
      />
    );

    const buttons = FINDER_COLOR_TAGS.map((tag) =>
      screen.getByRole("button", { name: `Tag ${tag.label}` })
    );

    const checkIcons = screen.getAllByTestId("check-icon");
    expect(checkIcons.length).toBe(1);

    const selectedButton = buttons[FINDER_COLOR_TAGS.findIndex((tag) => tag.id === selectedId)];
    expect(selectedButton).toHaveAttribute("aria-pressed", "true");

    const unselectedButtons = buttons.filter((btn) => btn !== selectedButton);
    unselectedButtons.forEach((btn) => {
      expect(btn).toHaveAttribute("aria-pressed", "false");
    });
  });

  it("désactive les boutons et n'appelle pas onTagToggle quand disabled est true", () => {
    const onTagToggleMock = onTagToggleMockFactory();

    render(
      <ColorTagsBar
        selectedTags={[]}
        onTagToggle={onTagToggleMock}
        disabled
      />
    );

    const firstTag = FINDER_COLOR_TAGS[0];
    const button = screen.getByRole("button", {
      name: `Tag ${firstTag.label}`,
    });

    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(onTagToggleMock).not.toHaveBeenCalled();
  });

  it("applique la className supplémentaire sur le conteneur principal", () => {
    const onTagToggleMock = onTagToggleMockFactory();

    const { container } = render(
      <ColorTagsBar
        selectedTags={[]}
        onTagToggle={onTagToggleMock}
        className="test-extra-class"
      />
    );

    const rootDiv = container.querySelector("div.test-extra-class");
    expect(rootDiv).not.toBeNull();
  });

  it("rend un tooltip content pour chaque tag avec le label correct", () => {
    const onTagToggleMock = onTagToggleMockFactory();

    render(
      <ColorTagsBar
        selectedTags={[]}
        onTagToggle={onTagToggleMock}
      />
    );

    const tooltipContents = screen.getAllByTestId("tooltip-content");
    expect(tooltipContents.length).toBe(FINDER_COLOR_TAGS.length);

    FINDER_COLOR_TAGS.forEach((tag) => {
      const content = tooltipContents.find((node) => node.textContent === tag.label);
      expect(content).toBeDefined();
    });
  });
});