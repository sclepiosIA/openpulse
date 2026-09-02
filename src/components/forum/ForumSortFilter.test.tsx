// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ForumSortFilter } from "./ForumSortFilter";

const { selectMockState, arrowPropsSpy } = vi.hoisted(() => ({
  selectMockState: {
    value: "recent",
    onValueChange: undefined as ((value: string) => void) | undefined,
  },
  arrowPropsSpy: vi.fn(),
}));

vi.mock("@/components/ui/select", () => {
  const ReactModule = require("react") as typeof React;

  function Select({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    children: React.ReactNode;
  }) {
    selectMockState.value = value;
    selectMockState.onValueChange = onValueChange;
    return ReactModule.createElement("div", { "data-testid": "select-root" }, children);
  }

  function SelectTrigger({
    className,
    children,
  }: {
    className?: string;
    children: React.ReactNode;
  }) {
    return ReactModule.createElement(
      "button",
      {
        type: "button",
        "data-testid": "select-trigger",
        className,
      },
      children,
    );
  }

  function SelectValue({ placeholder }: { placeholder?: string }) {
    const labels: Record<string, string> = {
      recent: "Plus récents",
      popular: "Plus populaires",
      mostCommented: "Plus commentés",
      unresolved: "Non résolus",
    };

    return ReactModule.createElement(
      "span",
      { "data-testid": "select-value" },
      labels[selectMockState.value] ?? placeholder ?? "",
    );
  }

  function SelectContent({ children }: { children: React.ReactNode }) {
    return ReactModule.createElement("div", { "data-testid": "select-content" }, children);
  }

  function SelectItem({
    value,
    children,
  }: {
    value: string;
    children: React.ReactNode;
  }) {
    return ReactModule.createElement(
      "button",
      {
        type: "button",
        "data-testid": `select-item-${value}`,
        onClick: () => selectMockState.onValueChange?.(value),
      },
      children,
    );
  }

  return {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
  };
});

vi.mock("lucide-react", () => {
  const ReactModule = require("react") as typeof React;

  return {
    ArrowUpDown: (props: { className?: string }) => {
      arrowPropsSpy(props);
      return ReactModule.createElement("svg", {
        "data-testid": "arrow-up-down",
        className: props.className,
      });
    },
  };
});

describe("ForumSortFilter", () => {
  it("affiche la valeur courante et toutes les options de tri", () => {
    const onChange = vi.fn();

    render(<ForumSortFilter value="recent" onChange={onChange} />);

    expect(screen.getByTestId("select-root")).toBeInTheDocument();
    expect(screen.getByTestId("select-trigger")).toHaveClass("w-[200px]", "gap-2");
    expect(screen.getByTestId("arrow-up-down")).toHaveClass("h-4", "w-4");
    expect(arrowPropsSpy).toHaveBeenCalledWith({ className: "h-4 w-4" });

    expect(screen.getByTestId("select-value")).toHaveTextContent("Plus récents");
    expect(screen.getByTestId("select-item-recent")).toHaveTextContent("Plus récents");
    expect(screen.getByTestId("select-item-popular")).toHaveTextContent("Plus populaires");
    expect(screen.getByTestId("select-item-mostCommented")).toHaveTextContent("Plus commentés");
    expect(screen.getByTestId("select-item-unresolved")).toHaveTextContent("Non résolus");

    expect(onChange).not.toHaveBeenCalled();
  });

  it("déclenche onChange avec la valeur métier correcte quand une option est sélectionnée", () => {
    const onChange = vi.fn();

    render(<ForumSortFilter value="recent" onChange={onChange} />);

    fireEvent.click(screen.getByTestId("select-item-popular"));
    fireEvent.click(screen.getByTestId("select-item-mostCommented"));
    fireEvent.click(screen.getByTestId("select-item-unresolved"));

    expect(onChange).toHaveBeenNthCalledWith(1, "popular");
    expect(onChange).toHaveBeenNthCalledWith(2, "mostCommented");
    expect(onChange).toHaveBeenNthCalledWith(3, "unresolved");
  });

  it("affiche le libellé correspondant à une valeur initiale différente", () => {
    const onChange = vi.fn();

    const { rerender } = render(<ForumSortFilter value="popular" onChange={onChange} />);
    expect(screen.getByTestId("select-value")).toHaveTextContent("Plus populaires");

    rerender(<ForumSortFilter value="mostCommented" onChange={onChange} />);
    expect(screen.getByTestId("select-value")).toHaveTextContent("Plus commentés");

    rerender(<ForumSortFilter value="unresolved" onChange={onChange} />);
    expect(screen.getByTestId("select-value")).toHaveTextContent("Non résolus");
  });
});