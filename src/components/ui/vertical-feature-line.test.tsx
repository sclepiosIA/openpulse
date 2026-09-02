import React from "react";
import { render } from "@testing-library/react";

const { mockCn } = vi.hoisted(() => ({
  mockCn: (...args: Array<string | false | null | undefined>) =>
    args.filter(Boolean).join(" "),
}));

vi.mock("framer-motion", () => {
  const MotionDiv = (props: any) => React.createElement("div", props, props.children);
  return { motion: { div: MotionDiv } };
});

vi.mock("@/lib/utils", () => ({
  cn: mockCn,
}));

import { VerticalFeatureLine, TimelineDot, TimelineBranch } from "./vertical-feature-line";

describe("VerticalFeatureLine", () => {
  it("renders default layout with top dot, gradient line, glow and children", () => {
    const { container, getByText } = render(
      <VerticalFeatureLine>
        <div>Content</div>
      </VerticalFeatureLine>
    );

    // Children with left padding wrapper
    const content = getByText("Content");
    const paddedWrapper = content.parentElement;
    expect(paddedWrapper).toBeTruthy();
    expect(paddedWrapper?.classList.contains("pl-6")).toBe(true);

    // Main vertical line element (w-1 with gradient and glow)
    const line = container.querySelector(".w-1");
    expect(line).toBeTruthy();
    expect(line?.className).toContain("bg-gradient-to-b");
    expect(line?.className).toContain("from-primary");
    expect(line?.className).toContain("via-primary/60");
    expect(line?.className).toContain("shadow-[0_0_15px_hsl(var(--primary)/0.3)]"); // medium glow by default

    // Top dot present by default with ring and ping
    const topDot = container.querySelector(".ring-background");
    expect(topDot).toBeTruthy();
    expect(topDot?.classList.contains("w-3")).toBe(true);
    expect(topDot?.classList.contains("h-3")).toBe(true);
    const ping = container.querySelector(".animate-ping");
    expect(ping).toBeTruthy();
  });

  it("does not render top dot when showTopDot is false", () => {
    const { container } = render(
      <VerticalFeatureLine showTopDot={false}>
        <div>HiddenDot</div>
      </VerticalFeatureLine>
    );

    expect(container.querySelector(".ring-background")).toBeNull();
    expect(container.querySelector(".animate-ping")).toBeNull();
  });

  it("applies custom dotColor, lineGradient and strong glow intensity", () => {
    const { container } = render(
      <VerticalFeatureLine
        dotColor="bg-red-500"
        lineGradient="from-green-500 to-blue-500"
        glowIntensity="strong"
      >
        <div>Custom</div>
      </VerticalFeatureLine>
    );

    const line = container.querySelector(".w-1");
    expect(line).toBeTruthy();
    expect(line?.className).toContain("bg-gradient-to-b");
    expect(line?.className).toContain("from-green-500");
    expect(line?.className).toContain("to-blue-500");
    expect(line?.className).toContain("shadow-[0_0_25px_hsl(var(--primary)/0.4)]"); // strong glow

    const topDot = container.querySelector(".ring-background");
    expect(topDot).toBeTruthy();
    expect(topDot?.classList.contains("bg-red-500")).toBe(true);
  });

  it("merges provided className with base classes", () => {
    const { container } = render(
      <VerticalFeatureLine className="test-class">
        <div>Merge</div>
      </VerticalFeatureLine>
    );

    const root = container.firstElementChild;
    expect(root).toBeTruthy();
    expect(root?.classList.contains("relative")).toBe(true);
    expect(root?.classList.contains("test-class")).toBe(true);
  });
});

describe("TimelineDot", () => {
  it("renders default inactive dot with muted color and md size", () => {
    const { container } = render(<TimelineDot />);

    const dot = container.querySelector(".border-background");
    expect(dot).toBeTruthy();

    // default size md: w-2.5 h-2.5
    expect(dot?.classList.contains("w-2.5")).toBe(true);
    expect(dot?.classList.contains("h-2.5")).toBe(true);

    // inactive and no unread -> uses color (bg-muted)
    expect(dot?.classList.contains("bg-muted")).toBe(true);

    // no active ring, no ping
    expect(dot?.classList.contains("ring-2")).toBe(false);
    expect(container.querySelector(".animate-ping")).toBeNull();
  });

  it("renders active dot with primary background and ring", () => {
    const { container } = render(<TimelineDot active />);

    const dot = container.querySelector(".border-background");
    expect(dot).toBeTruthy();

    expect(dot?.classList.contains("bg-primary")).toBe(true);
    expect(dot?.classList.contains("ring-2")).toBe(true);
    expect(dot?.className).toContain("ring-primary/30");
    expect(container.querySelector(".animate-ping")).toBeNull();
  });

  it("renders unread dot with ping effect when not active", () => {
    const { container } = render(<TimelineDot hasUnread />);

    const dot = container.querySelector(".border-background");
    expect(dot).toBeTruthy();

    expect(dot?.classList.contains("bg-primary")).toBe(true);
    const ping = container.querySelector(".animate-ping");
    expect(ping).toBeTruthy();
  });

  it("applies size variant correctly (lg)", () => {
    const { container } = render(<TimelineDot size="lg" />);

    const dot = container.querySelector(".border-background");
    expect(dot).toBeTruthy();
    expect(dot?.classList.contains("w-3")).toBe(true);
    expect(dot?.classList.contains("h-3")).toBe(true);
  });
});

describe("TimelineBranch", () => {
  it("renders with base classes and merges className", () => {
    const { container } = render(<TimelineBranch className="extra-branch" />);

    const branch = container.firstElementChild as HTMLElement | null;
    expect(branch).toBeTruthy();

    expect(branch?.classList.contains("absolute")).toBe(true);
    expect(branch?.classList.contains("left-0")).toBe(true);
    expect(branch?.classList.contains("top-1/2")).toBe(true);
    expect(branch?.classList.contains("w-4")).toBe(true);
    expect(branch?.classList.contains("h-0.5")).toBe(true);
    expect(branch?.className).toContain("bg-primary/30");
    expect(branch?.classList.contains("rounded")).toBe(true);

    expect(branch?.classList.contains("extra-branch")).toBe(true);
  });
});