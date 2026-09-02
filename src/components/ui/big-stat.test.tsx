import React from "react";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/utils", () => ({
  cn: (...args: Array<unknown>) =>
    args
      .flatMap((a) => {
        if (!a) return [];
        if (typeof a === "string") return [a];
        if (Array.isArray(a)) return a.filter((x) => typeof x === "string") as string[];
        if (typeof a === "object") {
          return Object.entries(a as Record<string, unknown>)
            .filter(([, v]) => Boolean(v))
            .map(([k]) => k);
        }
        return [];
      })
      .join(" "),
}));

const { iconCircleMock } = vi.hoisted(() => ({
  iconCircleMock: vi.fn(
    ({
      icon: Icon,
      variant,
      color,
      size,
      className,
    }: {
      icon?: React.ComponentType<{ "data-testid"?: string }>;
      variant?: string;
      color?: string;
      size?: string;
      className?: string;
    }) => (
      <div
        data-testid="icon-circle"
        data-variant={variant}
        data-color={color}
        data-size={size}
        className={className}
      >
        {Icon ? <Icon data-testid="provided-icon" /> : null}
      </div>
    )
  ),
}));

vi.mock("./icon-circle", () => ({
  IconCircle: (props: Parameters<typeof iconCircleMock>[0]) => iconCircleMock(props),
}));

import { BigStat } from "./big-stat";

describe("BigStat", () => {
  it("affiche value/label/sublabel et applique centered par défaut", () => {
    render(<BigStat value={123} label="Total" sublabel="Sur 30 jours" />);

    const valueEl = screen.getByText("123");
    expect(valueEl.tagName.toLowerCase()).toBe("span");
    expect(valueEl.className).toContain("font-bold");
    expect(valueEl.className).toContain("text-3xl");
    expect(valueEl.className).toContain("text-primary");

    const labelEl = screen.getByText("Total");
    expect(labelEl.tagName.toLowerCase()).toBe("p");
    expect(labelEl.className).toContain("text-muted-foreground");
    expect(labelEl.className).toContain("text-base");

    const subLabelEl = screen.getByText("Sur 30 jours");
    expect(subLabelEl.tagName.toLowerCase()).toBe("p");
    expect(subLabelEl.className).toContain("text-muted-foreground/70");
    expect(subLabelEl.className).toContain("text-sm");

    const root = labelEl.closest("div");
    expect(root).not.toBeNull();
    if (!root) throw new Error("root not found");
    expect(root.className).toContain("items-center");
    expect(root.className).toContain("text-center");
    expect(root.className).toContain("animate-fade-in");

    expect(screen.queryByTestId("icon-circle")).toBeNull();
  });

  it("rend l'icône, passe les props à IconCircle, gère la trend positive et la taille xl", () => {
    const DummyIcon: React.FC<{ "data-testid"?: string }> = (props) => <svg {...props} />;

    render(
      <BigStat
        value="1.2k"
        label="Vues"
        icon={DummyIcon}
        iconVariant="solid"
        color="success"
        size="xl"
        trend={{ value: 12.5, isPositive: true }}
        centered={false}
        className="custom-class"
      />
    );

    const iconCircle = screen.getByTestId("icon-circle");
    expect(iconCircle.getAttribute("data-variant")).toBe("solid");
    expect(iconCircle.getAttribute("data-color")).toBe("success");
    expect(iconCircle.getAttribute("data-size")).toBe("xl");
    expect(screen.getByTestId("provided-icon")).toBeInTheDocument();

    const valueEl = screen.getByText("1.2k");
    expect(valueEl.className).toContain("text-5xl");
    expect(valueEl.className).toContain("text-success");

    const trendEl = screen.getByText("+12.5%");
    expect(trendEl.className).toContain("text-success");

    const labelEl = screen.getByText("Vues");
    const root = labelEl.closest("div");
    expect(root).not.toBeNull();
    if (!root) throw new Error("root not found");
    expect(root.className).toContain("custom-class");
    expect(root.className).not.toContain("items-center");
    expect(root.className).not.toContain("text-center");
  });

  it("rend la trend négative et applique la classe destructive", () => {
    render(<BigStat value={42} label="Erreurs" trend={{ value: 3, isPositive: false }} color="destructive" size="sm" />);

    const valueEl = screen.getByText("42");
    expect(valueEl.className).toContain("text-2xl");
    expect(valueEl.className).toContain("text-destructive");

    const trendEl = screen.getByText("3%");
    expect(trendEl.className).toContain("text-destructive");
    expect(trendEl.textContent).toBe("3%");
  });

  it("mappe size lg vers IconCircle size 'lg' et md/sm vers 'md'", () => {
    const DummyIcon: React.FC<{ "data-testid"?: string }> = (props) => <svg {...props} />;

    const { rerender } = render(<BigStat value={1} label="A" icon={DummyIcon} size="lg" />);
    expect(screen.getByTestId("icon-circle").getAttribute("data-size")).toBe("lg");

    rerender(<BigStat value={1} label="A" icon={DummyIcon} size="md" />);
    expect(screen.getByTestId("icon-circle").getAttribute("data-size")).toBe("md");

    rerender(<BigStat value={1} label="A" icon={DummyIcon} size="sm" />);
    expect(screen.getByTestId("icon-circle").getAttribute("data-size")).toBe("md");
  });
});