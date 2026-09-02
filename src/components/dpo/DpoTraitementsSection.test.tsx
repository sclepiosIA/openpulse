// @vitest-environment jsdom

import React from "react";
import { render, screen, within } from "@testing-library/react";
import { DpoTraitementsSection } from "./DpoTraitementsSection";

const { HEADER_PROPS, traitements } = vi.hoisted(() => ({
  HEADER_PROPS: vi.fn(),
  traitements: [
    {
      finalite: "Gestion des rendez-vous",
      baseLegale: "Exécution du contrat",
      categories: "Identité, coordonnées, agenda",
      conservation: "3 ans après le dernier contact",
    },
    {
      finalite: "Facturation",
      baseLegale: "Obligation légale",
      categories: "Identité, données de paiement",
      conservation: "10 ans",
    },
  ],
}));

vi.mock("@/components/formations/CharterSectionHeader", () => ({
  CharterSectionHeader: (props: {
    title: string;
    subtitle: string;
    icon: React.ComponentType;
  }) => {
    HEADER_PROPS(props);
    return (
      <div data-testid="charter-header">
        <span>{props.title}</span>
        <span>{props.subtitle}</span>
        <span data-testid="header-icon">{props.icon?.name ?? "icon"}</span>
      </div>
    );
  },
}));

vi.mock("lucide-react", () => ({
  ScrollText: function ScrollText() {
    return <svg data-testid="scroll-text-icon" />;
  },
}));

describe("DpoTraitementsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rend l'en-tête avec le titre, le sous-titre et l'icône attendus", () => {
    render(<DpoTraitementsSection traitements={traitements} />);

    expect(screen.getByTestId("charter-header")).toBeInTheDocument();
    expect(screen.getByText("Registre des traitements")).toBeInTheDocument();
    expect(
      screen.getByText("Transparence complète sur les finalités et les bases légales de nos traitements"),
    ).toBeInTheDocument();

    expect(HEADER_PROPS).toHaveBeenCalledTimes(1);
    const firstCall = HEADER_PROPS.mock.calls[0];
    expect(firstCall).toBeDefined();
    const props = firstCall[0];
    expect(props.title).toBe("Registre des traitements");
    expect(props.subtitle).toBe("Transparence complète sur les finalités et les bases légales de nos traitements");
    expect(typeof props.icon).toBe("function");
    expect(props.icon.name).toBe("ScrollText");
  });

  it("rend le tableau desktop avec les colonnes et les valeurs métier réelles", () => {
    const { container } = render(<DpoTraitementsSection traitements={traitements} />);

    const table = container.querySelector("table");
    expect(table).not.toBeNull();
    if (!table) {
      throw new Error("table non trouvée");
    }

    const tableScope = within(table);

    expect(tableScope.getByText("Finalité")).toBeInTheDocument();
    expect(tableScope.getByText("Base légale")).toBeInTheDocument();
    expect(tableScope.getByText("Catégories de données")).toBeInTheDocument();
    expect(tableScope.getByText("Durée de conservation")).toBeInTheDocument();

    const rows = table.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(2);

    expect(tableScope.getByText("Gestion des rendez-vous")).toBeInTheDocument();
    expect(tableScope.getByText("Exécution du contrat")).toBeInTheDocument();
    expect(tableScope.getByText("Identité, coordonnées, agenda")).toBeInTheDocument();
    expect(tableScope.getByText("3 ans après le dernier contact")).toBeInTheDocument();

    expect(tableScope.getByText("Facturation")).toBeInTheDocument();
    expect(tableScope.getByText("Obligation légale")).toBeInTheDocument();
    expect(tableScope.getByText("Identité, données de paiement")).toBeInTheDocument();
    expect(tableScope.getByText("10 ans")).toBeInTheDocument();

    expect(rows[0]?.className).toContain("bg-background");
    expect(rows[1]?.className).toContain("bg-muted/30");
  });

  it("rend les cartes mobile avec les libellés contextualisés pour chaque traitement", () => {
    const { container } = render(<DpoTraitementsSection traitements={traitements} />);

    const mobileContainer = container.querySelector(".md\\:hidden");
    expect(mobileContainer).not.toBeNull();
    if (!mobileContainer) {
      throw new Error("conteneur mobile non trouvé");
    }

    const cards = mobileContainer.querySelectorAll("div.rounded-xl.border.border-border.bg-card.p-4.space-y-2");
    expect(cards).toHaveLength(2);

    const firstCard = within(cards[0] as HTMLElement);
    expect(firstCard.getByRole("heading", { level: 4, name: "Gestion des rendez-vous" })).toBeInTheDocument();
    expect(firstCard.getByText("Exécution du contrat")).toBeInTheDocument();
    expect(firstCard.getByText("Identité, coordonnées, agenda")).toBeInTheDocument();
    expect(firstCard.getByText("3 ans après le dernier contact")).toBeInTheDocument();
    expect(firstCard.getByText((_, element) => element?.textContent === "Base légale : Exécution du contrat")).toBeInTheDocument();
    expect(firstCard.getByText((_, element) => element?.textContent === "Données : Identité, coordonnées, agenda")).toBeInTheDocument();
    expect(firstCard.getByText((_, element) => element?.textContent === "Conservation : 3 ans après le dernier contact")).toBeInTheDocument();

    const secondCard = within(cards[1] as HTMLElement);
    expect(secondCard.getByRole("heading", { level: 4, name: "Facturation" })).toBeInTheDocument();
    expect(secondCard.getByText("Obligation légale")).toBeInTheDocument();
    expect(secondCard.getByText("Identité, données de paiement")).toBeInTheDocument();
    expect(secondCard.getByText("10 ans")).toBeInTheDocument();
    expect(secondCard.getByText((_, element) => element?.textContent === "Base légale : Obligation légale")).toBeInTheDocument();
    expect(secondCard.getByText((_, element) => element?.textContent === "Données : Identité, données de paiement")).toBeInTheDocument();
    expect(secondCard.getByText((_, element) => element?.textContent === "Conservation : 10 ans")).toBeInTheDocument();
  });

  it("ne rend aucune ligne ni carte de traitement quand la liste est vide, tout en gardant l'en-tête et la structure", () => {
    const { container } = render(<DpoTraitementsSection traitements={[]} />);

    expect(screen.getByTestId("charter-header")).toBeInTheDocument();

    const table = container.querySelector("table");
    expect(table).not.toBeNull();
    if (!table) {
      throw new Error("table non trouvée");
    }

    const bodyRows = table.querySelectorAll("tbody tr");
    expect(bodyRows).toHaveLength(0);

    const mobileContainer = container.querySelector(".md\\:hidden");
    expect(mobileContainer).not.toBeNull();
    if (!mobileContainer) {
      throw new Error("conteneur mobile non trouvé");
    }

    const cards = mobileContainer.querySelectorAll("div.rounded-xl.border.border-border.bg-card.p-4.space-y-2");
    expect(cards).toHaveLength(0);
    expect(within(mobileContainer).queryByRole("heading", { level: 4 })).not.toBeInTheDocument();
    expect(screen.queryByText("Gestion des rendez-vous")).not.toBeInTheDocument();
    expect(screen.queryByText("Facturation")).not.toBeInTheDocument();
  });
});