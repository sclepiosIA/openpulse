import React from "react";
import { render, screen } from "@testing-library/react";
import { ClassificationLegend } from "./classification-legend";

const { MockPartenaireBadge, MockGroupeBadge, MockEmailEtablissementBadge } = vi.hoisted(() => {
  const MockPartenaireBadge = vi.fn(
    ({
      type,
      nom,
      size,
      showLink,
    }: {
      type: string;
      nom: string;
      size?: string;
      showLink?: boolean;
    }) => <div data-testid={`partenaire-${type}`}>{nom}</div>
  );

  const MockGroupeBadge = vi.fn(
    ({
      type,
      nom,
      showIcon,
    }: {
      type: string;
      nom: string;
      showIcon?: boolean;
    }) => <div data-testid={`groupe-${type}`}>{nom}</div>
  );

  const MockEmailEtablissementBadge = vi.fn(
    ({
      etablissementId,
      etablissementNom,
      size,
      showLink,
    }: {
      etablissementId: string;
      etablissementNom: string;
      size?: string;
      showLink?: boolean;
    }) => <div data-testid="etablissement-badge">{etablissementNom}</div>
  );

  return { MockPartenaireBadge, MockGroupeBadge, MockEmailEtablissementBadge };
});

vi.mock("@/components/ui/card", () => {
  const Card = ({ children, ...props }: { children: React.ReactNode }) => (
    <div data-testid="card" {...props}>
      {children}
    </div>
  );
  const CardHeader = ({ children, ...props }: { children: React.ReactNode }) => (
    <div data-testid="card-header" {...props}>
      {children}
    </div>
  );
  const CardTitle = ({ children, ...props }: { children: React.ReactNode }) => (
    <h2 data-testid="card-title" {...props}>
      {children}
    </h2>
  );
  const CardDescription = ({ children, ...props }: { children: React.ReactNode }) => (
    <p data-testid="card-description" {...props}>
      {children}
    </p>
  );
  const CardContent = ({ children, ...props }: { children: React.ReactNode }) => (
    <div data-testid="card-content" {...props}>
      {children}
    </div>
  );
  return { Card, CardHeader, CardTitle, CardDescription, CardContent };
});

vi.mock("./partenaire-badge", () => ({
  PartenaireBadge: (props: {
    type: string;
    nom: string;
    size?: string;
    showLink?: boolean;
  }) => MockPartenaireBadge(props),
}));

vi.mock("./groupe-badge", () => ({
  GroupeBadge: (props: { type: string; nom: string; showIcon?: boolean }) =>
    MockGroupeBadge(props),
}));

vi.mock("@/components/email/EmailEtablissementBadge", () => ({
  EmailEtablissementBadge: (props: {
    etablissementId: string;
    etablissementNom: string;
    size?: string;
    showLink?: boolean;
  }) => MockEmailEtablissementBadge(props),
}));

describe("ClassificationLegend", () => {
  beforeEach(() => {
    MockPartenaireBadge.mockClear();
    MockGroupeBadge.mockClear();
    MockEmailEtablissementBadge.mockClear();
  });

  it("rend le titre et la description de la légende", () => {
    render(<ClassificationLegend />);

    expect(
      screen.getByText("Code couleur des classifications")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Chaque type d'entité a une couleur dédiée pour faciliter l'identification"
      )
    ).toBeInTheDocument();
  });

  it("affiche le badge établissement avec le bon libellé et le texte associé", () => {
    render(<ClassificationLegend />);

    expect(MockEmailEtablissementBadge).toHaveBeenCalledTimes(1);
    expect(MockEmailEtablissementBadge).toHaveBeenCalledWith(
      expect.objectContaining({
        etablissementId: "demo",
        etablissementNom: "Établissement",
        size: "sm",
        showLink: false,
      })
    );

    expect(
      screen.getByTestId("etablissement-badge")
    ).toHaveTextContent("Établissement");
    expect(
      screen.getByText(/Vert :/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Établissement de santé/i)
    ).toBeInTheDocument();
  });

  it("affiche les badges de groupes avec les bons types et textes", () => {
    render(<ClassificationLegend />);

    expect(MockGroupeBadge).toHaveBeenCalledTimes(2);
    expect(MockGroupeBadge).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "GHT",
        nom: "Groupe GHT",
        showIcon: true,
      })
    );
    expect(MockGroupeBadge).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "Groupe Cliniques",
        nom: "Groupe Cliniques",
        showIcon: true,
      })
    );

    expect(
      screen.getByTestId("groupe-GHT")
    ).toHaveTextContent("Groupe GHT");
    expect(
      screen.getByTestId("groupe-Groupe Cliniques")
    ).toHaveTextContent("Groupe Cliniques");

    expect(
      screen.getByText(/Bleu :/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Groupe public \(GHT\)/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Violet :/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Groupe privé \(Cliniques\)/i)
    ).toBeInTheDocument();
  });

  it("affiche les badges de partenaires avec les bons types et textes", () => {
    render(<ClassificationLegend />);

    expect(MockPartenaireBadge).toHaveBeenCalledTimes(3);
    expect(MockPartenaireBadge).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        type: "institutionnel",
        nom: "ARS",
        size: "sm",
        showLink: false,
      })
    );
    expect(MockPartenaireBadge).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        type: "industriel",
        nom: "Fournisseur",
        size: "sm",
        showLink: false,
      })
    );
    expect(MockPartenaireBadge).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        type: "prestataire",
        nom: "Consultant",
        size: "sm",
        showLink: false,
      })
    );

    expect(
      screen.getByTestId("partenaire-institutionnel")
    ).toHaveTextContent("ARS");
    expect(
      screen.getByTestId("partenaire-industriel")
    ).toHaveTextContent("Fournisseur");
    expect(
      screen.getByTestId("partenaire-prestataire")
    ).toHaveTextContent("Consultant");

    expect(
      screen.getByText(/Indigo :/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Partenaire institutionnel/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Orange :/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Partenaire industriel/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Ambre :/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Partenaire prestataire/i)
    ).toBeInTheDocument();
  });
});