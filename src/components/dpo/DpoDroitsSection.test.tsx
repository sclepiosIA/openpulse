/* @vitest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import { DpoDroitsSection } from "./DpoDroitsSection";

const { droits } = vi.hoisted(() => {
  const MockIconA = ({ className }: { className?: string }) => (
    <svg data-testid="icon-a" className={className} />
  );
  const MockIconB = ({ className }: { className?: string }) => (
    <svg data-testid="icon-b" className={className} />
  );
  const MockIconC = ({ className }: { className?: string }) => (
    <svg data-testid="icon-c" className={className} />
  );

  return {
    droits: [
      {
        title: "Droit d'accès",
        description: "Vous pouvez demander l'accès à vos données personnelles.",
        icon: MockIconA,
      },
      {
        title: "Droit de rectification",
        description: "Vous pouvez corriger des informations inexactes.",
        icon: MockIconB,
      },
      {
        title: "Droit à l'effacement",
        description: "Vous pouvez demander la suppression de certaines données.",
        icon: MockIconC,
      },
    ],
  };
});

vi.mock("@/components/ui/card", () => ({
  Card: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
  CardContent: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
}));

vi.mock("@/components/formations/CharterSectionHeader", () => ({
  CharterSectionHeader: ({
    title,
    subtitle,
    icon: Icon,
  }: {
    title: string;
    subtitle: string;
    icon: React.ComponentType<{ className?: string }>;
  }) => (
    <div data-testid="charter-header">
      <span>{title}</span>
      <span>{subtitle}</span>
      <Icon className="header-icon" />
    </div>
  ),
}));

vi.mock("lucide-react", () => ({
  UserCog: ({ className }: { className?: string }) => (
    <svg data-testid="user-cog-icon" className={className} />
  ),
}));

describe("DpoDroitsSection", () => {
  it("affiche l'en-tête de section avec le titre, le sous-titre et l'icône", () => {
    render(<DpoDroitsSection droits={droits} />);

    expect(screen.getByTestId("charter-header")).toBeInTheDocument();
    expect(screen.getByText("Vos droits")).toBeInTheDocument();
    expect(
      screen.getByText(
        "En tant que patient ou professionnel de santé, vous disposez de droits sur vos données personnelles",
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId("user-cog-icon")).toBeInTheDocument();
  });

  it("rend une carte par droit avec son titre, sa description et son icône", () => {
    render(<DpoDroitsSection droits={droits} />);

    const cards = screen.getAllByTestId("card");
    const cardContents = screen.getAllByTestId("card-content");

    expect(cards).toHaveLength(3);
    expect(cardContents).toHaveLength(3);

    expect(screen.getByText("Droit d'accès")).toBeInTheDocument();
    expect(
      screen.getByText("Vous pouvez demander l'accès à vos données personnelles."),
    ).toBeInTheDocument();

    expect(screen.getByText("Droit de rectification")).toBeInTheDocument();
    expect(
      screen.getByText("Vous pouvez corriger des informations inexactes."),
    ).toBeInTheDocument();

    expect(screen.getByText("Droit à l'effacement")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Vous pouvez demander la suppression de certaines données.",
      ),
    ).toBeInTheDocument();

    expect(screen.getByTestId("icon-a")).toBeInTheDocument();
    expect(screen.getByTestId("icon-b")).toBeInTheDocument();
    expect(screen.getByTestId("icon-c")).toBeInTheDocument();
  });

  it("applique les classes métier attendues sur les cartes et contenus", () => {
    render(<DpoDroitsSection droits={droits} />);

    const cards = screen.getAllByTestId("card");
    const contents = screen.getAllByTestId("card-content");

    expect(cards[0]?.className).toContain("group");
    expect(cards[0]?.className).toContain("hover:shadow-lg");
    expect(cards[0]?.className).toContain("hover:border-marque-blue/30");
    expect(cards[0]?.className).toContain("transition-all");
    expect(cards[0]?.className).toContain("duration-300");

    expect(contents[0]?.className).toContain("p-6");
    expect(contents[0]?.className).toContain("flex");
    expect(contents[0]?.className).toContain("flex-col");
    expect(contents[0]?.className).toContain("items-center");
    expect(contents[0]?.className).toContain("text-center");
    expect(contents[0]?.className).toContain("gap-4");
  });

  it("ne rend aucune carte lorsque la liste des droits est vide", () => {
    render(<DpoDroitsSection droits={[]} />);

    expect(screen.getByTestId("charter-header")).toBeInTheDocument();
    expect(screen.queryAllByTestId("card")).toHaveLength(0);
    expect(screen.queryByTestId("icon-a")).not.toBeInTheDocument();
    expect(screen.queryByTestId("icon-b")).not.toBeInTheDocument();
    expect(screen.queryByTestId("icon-c")).not.toBeInTheDocument();
  });
});