/* @vitest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import { NonMedicalDeviceBanner } from "./NonMedicalDeviceBanner";

vi.mock("lucide-react", () => ({
  Info: ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="info-icon" className={className} {...props} />
  ),
}));

vi.mock("@/lib/utils", () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
}));

describe("NonMedicalDeviceBanner", () => {
  it("renders the regulatory note with default variant content and classes", () => {
    render(<NonMedicalDeviceBanner />);

    const note = screen.getByRole("note", {
      name: "Statut réglementaire OpenPulse",
    });

    expect(note).toBeInTheDocument();
    expect(note).toHaveClass(
      "rounded-xl",
      "border",
      "border-blue-200",
      "bg-blue-50/80",
      "flex",
      "gap-3",
      "items-start",
      "p-4",
      "md:p-5",
      "text-sm",
    );

    expect(
      screen.getByText("OpenPulse n'est pas un dispositif médical", { exact: false }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(/au sens du Règlement \(UE\) 2017\/745 \(MDR\)\./),
    ).toBeInTheDocument();

    expect(
      screen.getByText(/documentaire, administrative et de valorisation/i),
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Le professionnel de santé conserve l'entière responsabilité de ses décisions cliniques\./),
    ).toBeInTheDocument();

    const icon = screen.getByTestId("info-icon");
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon).toHaveClass(
      "shrink-0",
      "text-blue-600",
      "dark:text-blue-400",
      "mt-0.5",
      "h-5",
      "w-5",
    );
  });

  it("renders compact variant with compact spacing and icon size", () => {
    render(<NonMedicalDeviceBanner variant="compact" />);

    const note = screen.getByRole("note", {
      name: "Statut réglementaire OpenPulse",
    });

    expect(note).toHaveClass("p-3", "text-xs");
    expect(note).not.toHaveClass("p-4");
    expect(note).not.toHaveClass("text-sm");

    const icon = screen.getByTestId("info-icon");
    expect(icon).toHaveClass("h-4", "w-4");
    expect(icon).not.toHaveClass("h-5");
    expect(icon).not.toHaveClass("w-5");
  });

  it("merges the provided className with base classes", () => {
    render(<NonMedicalDeviceBanner className="custom-banner ring-1" />);

    const note = screen.getByRole("note", {
      name: "Statut réglementaire OpenPulse",
    });

    expect(note).toHaveClass("custom-banner", "ring-1");
    expect(note).toHaveClass("rounded-xl", "border-blue-200", "bg-blue-50/80");
  });

  it("exports default component consistent with named export behavior", async () => {
    const mod = await import("./NonMedicalDeviceBanner");
    const DefaultComponent = mod.default;

    render(<DefaultComponent variant="compact" className="from-default" />);

    const note = screen.getByRole("note", {
      name: "Statut réglementaire OpenPulse",
    });

    expect(note).toHaveClass("from-default", "p-3", "text-xs");
    expect(
      screen.getByText(/n'établit, ne modifie ni n'influence aucun diagnostic, traitement ou surveillance/i),
    ).toBeInTheDocument();
  });
});