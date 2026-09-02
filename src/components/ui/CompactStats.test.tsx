import React from "react";
import { render, screen } from "@testing-library/react";
import { CompactStats } from "./CompactStats";

const { cnMock } = vi.hoisted(() => ({
  cnMock: vi.fn((...inputs: Array<string | undefined | false | null>) =>
    inputs.filter(Boolean).join(" ")
  ),
}));

vi.mock("@/lib/utils", () => ({
  cn: cnMock,
}));

describe("CompactStats", () => {
  beforeEach(() => {
    cnMock.mockClear();
  });

  it("renders labels, values, icons and separators correctly", () => {
    render(
      <CompactStats
        items={[
          {
            label: "Views",
            value: 12,
            icon: <svg data-testid="icon-views" />,
            color: "text-blue-500",
          },
          {
            label: "Sales",
            value: "34",
            icon: <svg data-testid="icon-sales" />,
            color: "text-green-500",
          },
          {
            label: "Rate",
            value: "89%",
          },
        ]}
        className="custom-class"
      />
    );

    expect(screen.getByText("Views:")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Sales:")).toBeInTheDocument();
    expect(screen.getByText("34")).toBeInTheDocument();
    expect(screen.getByText("Rate:")).toBeInTheDocument();
    expect(screen.getByText("89%")).toBeInTheDocument();

    expect(screen.getByTestId("icon-views")).toBeInTheDocument();
    expect(screen.getByTestId("icon-sales")).toBeInTheDocument();

    const separators = screen.getAllByText("|");
    expect(separators).toHaveLength(2);

    expect(cnMock).toHaveBeenCalledWith(
      "flex flex-wrap items-center gap-4 text-sm",
      "custom-class"
    );
    expect(cnMock).toHaveBeenCalledWith("flex-shrink-0", "text-blue-500");
    expect(cnMock).toHaveBeenCalledWith("font-semibold", "text-blue-500");
    expect(cnMock).toHaveBeenCalledWith("flex-shrink-0", "text-green-500");
    expect(cnMock).toHaveBeenCalledWith("font-semibold", "text-green-500");
    expect(cnMock).toHaveBeenCalledWith("font-semibold", undefined);
  });

  it("does not render separators for the last or only item and omits icon container when icon is absent", () => {
    const { container } = render(
      <CompactStats
        items={[
          {
            label: "Users",
            value: 7,
          },
        ]}
      />
    );

    expect(screen.getByText("Users:")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.queryByText("|")).not.toBeInTheDocument();
    expect(container.querySelector("svg")).toBeNull();
  });

  it("uses fallback key path safely when label is empty and still renders values", () => {
    render(
      <CompactStats
        items={[
          { label: "", value: "N/A" },
          { label: "Other", value: 5 },
        ]}
      />
    );

    expect(screen.getByText(":")).toBeInTheDocument();
    expect(screen.getByText("N/A")).toBeInTheDocument();
    expect(screen.getByText("Other:")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getAllByText("|")).toHaveLength(1);
  });
});