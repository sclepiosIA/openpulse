// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import { DpoSecuriteSection } from "./DpoSecuriteSection";

const { ITEMS } = vi.hoisted(() => {
  const IconShield = (props: React.SVGProps<SVGSVGElement>) =>
    React.createElement("svg", { ...props, "data-testid": "item-icon-shield" });
  const IconServer = (props: React.SVGProps<SVGSVGElement>) =>
    React.createElement("svg", { ...props, "data-testid": "item-icon-server" });
  const IconEye = (props: React.SVGProps<SVGSVGElement>) =>
    React.createElement("svg", { ...props, "data-testid": "item-icon-eye" });

  return {
    ITEMS: [
      {
        title: "Chiffrement des données",
        description: "Protection des informations sensibles en transit et au repos.",
        icon: IconShield,
      },
      {
        title: "Contrôle d'accès",
        description: "Gestion stricte des habilitations et authentification renforcée.",
        icon: IconServer,
      },
      {
        title: "Supervision continue",
        description: "Surveillance proactive des incidents et détection des anomalies.",
        icon: IconEye,
      },
    ],
  };
});

vi.mock("@/components/ui/card", () => ({
  Card: ({
    children,
    className,
    ...props
  }: React.HTMLAttributes<HTMLDivElement>) =>
    React.createElement(
      "div",
      { "data-testid": "card", className, ...props },
      children,
    ),
  CardContent: ({
    children,
    className,
    ...props
  }: React.HTMLAttributes<HTMLDivElement>) =>
    React.createElement(
      "div",
      { "data-testid": "card-content", className, ...props },
      children,
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
    icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  }) =>
    React.createElement(
      "section",
      { "data-testid": "section-header" },
      React.createElement("h2", {}, title),
      React.createElement("p", {}, subtitle),
      Icon ? React.createElement(Icon, { "data-testid": "header-icon" }) : null,
    ),
}));

vi.mock("lucide-react", () => ({
  Lock: (props: React.SVGProps<SVGSVGElement>) =>
    React.createElement("svg", { ...props, "data-testid": "lock-icon" }),
}));

describe("DpoSecuriteSection", () => {
  it("affiche l'en-tête métier avec le titre, le sous-titre et l'icône Lock", () => {
    render(<DpoSecuriteSection items={ITEMS} />);

    expect(screen.getByTestId("section-header")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Mesures de sécurité" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Des mesures techniques et organisationnelles de pointe pour protéger vos données",
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId("lock-icon")).toBeInTheDocument();
  });

  it("rend une carte par item avec les valeurs métier réelles", () => {
    render(<DpoSecuriteSection items={ITEMS} />);

    const cards = screen.getAllByTestId("card");
    const contents = screen.getAllByTestId("card-content");

    expect(cards).toHaveLength(3);
    expect(contents).toHaveLength(3);

    expect(screen.getByText("Chiffrement des données")).toBeInTheDocument();
    expect(
      screen.getByText("Protection des informations sensibles en transit et au repos."),
    ).toBeInTheDocument();

    expect(screen.getByText("Contrôle d'accès")).toBeInTheDocument();
    expect(
      screen.getByText("Gestion stricte des habilitations et authentification renforcée."),
    ).toBeInTheDocument();

    expect(screen.getByText("Supervision continue")).toBeInTheDocument();
    expect(
      screen.getByText("Surveillance proactive des incidents et détection des anomalies."),
    ).toBeInTheDocument();

    expect(screen.getByTestId("item-icon-shield")).toBeInTheDocument();
    expect(screen.getByTestId("item-icon-server")).toBeInTheDocument();
    expect(screen.getByTestId("item-icon-eye")).toBeInTheDocument();
  });

  it("utilise la structure et les classes attendues pour les cartes", () => {
    render(<DpoSecuriteSection items={ITEMS} />);

    const cards = screen.getAllByTestId("card");
    expect(cards[0]?.className).toContain("group");
    expect(cards[0]?.className).toContain("hover:shadow-lg");
    expect(cards[0]?.className).toContain("hover:border-marque-blue/30");

    const contents = screen.getAllByTestId("card-content");
    expect(contents[0]?.className).toContain("p-6");
    expect(contents[0]?.className).toContain("flex");
    expect(contents[0]?.className).toContain("gap-4");
  });

  it("ne rend aucune carte quand la liste est vide mais conserve l'en-tête", () => {
    render(<DpoSecuriteSection items={[]} />);

    expect(screen.getByRole("heading", { name: "Mesures de sécurité" })).toBeInTheDocument();
    expect(screen.queryAllByTestId("card")).toHaveLength(0);
    expect(screen.queryByText("Chiffrement des données")).not.toBeInTheDocument();
  });
});