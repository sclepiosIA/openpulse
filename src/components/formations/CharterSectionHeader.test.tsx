// @vitest-environment jsdom

import React from "react";
import { render, screen } from "@testing-library/react";
import { CharterSectionHeader } from "./CharterSectionHeader";

vi.mock("@/lib/utils", () => ({
  cn: (...classes: Array<string | undefined | null | false>) => classes.filter(Boolean).join(" "),
}));

describe("CharterSectionHeader", () => {
  it("renders the primary variant by default with title and subtitle", () => {
    render(<CharterSectionHeader title="Engagements" subtitle="Nos principes directeurs" />);

    const title = screen.getByRole("heading", { level: 2, name: "Engagements" });
    expect(title).toBeInTheDocument();
    expect(title.className).toContain("font-sofia");
    expect(title.className).toContain("font-bold");
    expect(title.className).toContain("uppercase");
    expect(title.className).toContain("text-xl");
    expect(title.className).toContain("md:text-2xl");
    expect(title.className).toContain("lg:text-3xl");

    const subtitle = screen.getByText("Nos principes directeurs");
    expect(subtitle).toBeInTheDocument();
    expect(subtitle.tagName).toBe("P");
    expect(subtitle.className).toContain("font-titillium");
    expect(subtitle.className).toContain("text-lg");
    expect(subtitle.className).toContain("text-marque-blue");
    expect(subtitle.className).toContain("text-center");

    const headerBar = title.parentElement;
    expect(headerBar).not.toBeNull();
    expect(headerBar?.className).toContain("bg-marque-orange");
    expect(headerBar?.className).toContain("text-white");
    expect(headerBar?.className).toContain("w-full");

    const root = headerBar?.parentElement;
    expect(root).not.toBeNull();
    expect(root?.className).toContain("space-y-3");
    expect(root?.className).toContain("mb-8");
    expect(root?.className).toContain("flex");
    expect(root?.className).toContain("flex-col");
    expect(root?.className).toContain("items-center");
  });

  it("renders the sub variant with its specific styling", () => {
    render(<CharterSectionHeader title="Sous-section" variant="sub" />);

    const title = screen.getByRole("heading", { level: 2, name: "Sous-section" });
    expect(title).toBeInTheDocument();
    expect(title.className).toContain("text-lg");
    expect(title.className).toContain("md:text-xl");
    expect(title.className).toContain("lg:text-2xl");
    expect(title.className).not.toContain("text-xl md:text-2xl lg:text-3xl");

    const headerBar = title.parentElement;
    expect(headerBar).not.toBeNull();
    expect(headerBar?.className).toContain("bg-marque-blue/10");
    expect(headerBar?.className).toContain("text-marque-blue");
    expect(headerBar?.className).toContain("border");
    expect(headerBar?.className).toContain("border-marque-blue/20");

    expect(screen.queryByText(/Nos principes directeurs/)).not.toBeInTheDocument();
  });

  it("renders the optional icon with primary variant classes", () => {
    const TestIcon = ({ className }: { className?: string }) => (
      <svg data-testid="header-icon" className={className} aria-hidden="true" />
    );

    render(<CharterSectionHeader title="Vision" icon={TestIcon} />);

    const icon = screen.getByTestId("header-icon");
    expect(icon).toBeInTheDocument();
    expect(icon.className.baseVal).toContain("h-6");
    expect(icon.className.baseVal).toContain("w-6");
    expect(icon.className.baseVal).toContain("shrink-0");
    expect(icon.className.baseVal).toContain("text-white/90");
  });

  it("renders the optional icon with sub variant classes", () => {
    const TestIcon = ({ className }: { className?: string }) => (
      <svg data-testid="header-icon-sub" className={className} aria-hidden="true" />
    );

    render(<CharterSectionHeader title="Mission" icon={TestIcon} variant="sub" />);

    const icon = screen.getByTestId("header-icon-sub");
    expect(icon).toBeInTheDocument();
    expect(icon.className.baseVal).toContain("h-6");
    expect(icon.className.baseVal).toContain("w-6");
    expect(icon.className.baseVal).toContain("shrink-0");
    expect(icon.className.baseVal).toContain("text-marque-blue");
  });

  it("merges the custom className onto the root container", () => {
    render(<CharterSectionHeader title="Valeurs" className="custom-root-class print:mb-4" />);

    const title = screen.getByRole("heading", { level: 2, name: "Valeurs" });
    const root = title.parentElement?.parentElement;

    expect(root).not.toBeNull();
    expect(root?.className).toContain("custom-root-class");
    expect(root?.className).toContain("print:mb-4");
    expect(root?.className).toContain("space-y-3");
    expect(root?.className).toContain("items-center");
  });

  it("does not render a subtitle paragraph when subtitle is not provided", () => {
    render(<CharterSectionHeader title="Organisation" />);

    expect(screen.getByRole("heading", { level: 2, name: "Organisation" })).toBeInTheDocument();
    expect(screen.queryByText((_, element) => element?.tagName === "P")).not.toBeInTheDocument();
  });
});