import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("@/components/ui/card", () => {
  const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" data-class={className ?? ""}>
      {children}
    </div>
  );

  const CardContent = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" data-class={className ?? ""}>
      {children}
    </div>
  );

  return { Card, CardContent };
});

vi.mock("@/components/formations/CharterSectionHeader", () => {
  const CharterSectionHeader = ({
    title,
    subtitle,
    icon: Icon,
  }: {
    title: string;
    subtitle: string;
    icon: React.ComponentType<{ className?: string }>;
  }) => (
    <header data-testid="charter-header">
      <h2>{title}</h2>
      <p>{subtitle}</p>
      <Icon className="header-icon" />
    </header>
  );

  return { CharterSectionHeader };
});

vi.mock("lucide-react", () => {
  const Shield = ({ className }: { className?: string }) => <svg data-testid="lucide-shield" className={className ?? ""} />;
  return { Shield };
});

import { DpoEngagementsSection } from "./DpoEngagementsSection";

describe("DpoEngagementsSection", () => {
  it("affiche l'en-tête et rend une carte par engagement avec icône, titre et description", () => {
    const IconOne = ({ className }: { className?: string }) => <svg data-testid="icon-one" className={className ?? ""} />;
    const IconTwo = ({ className }: { className?: string }) => <svg data-testid="icon-two" className={className ?? ""} />;

    const engagements = [
      { title: "Sécurité renforcée", description: "Chiffrement et contrôle d'accès stricts.", icon: IconOne },
      { title: "Transparence", description: "Traçabilité et information claire des traitements.", icon: IconTwo },
    ];

    render(<DpoEngagementsSection engagements={engagements} />);

    expect(screen.getByTestId("charter-header")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Nos engagements RGPD" })).toBeInTheDocument();
    expect(
      screen.getByText("OpenPulse s'engage à respecter les plus hauts standards de protection des données de santé")
    ).toBeInTheDocument();
    expect(screen.getByTestId("lucide-shield")).toBeInTheDocument();

    const cards = screen.getAllByTestId("card");
    expect(cards).toHaveLength(2);

    expect(screen.getByTestId("icon-one")).toBeInTheDocument();
    expect(screen.getByTestId("icon-two")).toBeInTheDocument();

    expect(screen.getByRole("heading", { level: 3, name: "Sécurité renforcée" })).toBeInTheDocument();
    expect(screen.getByText("Chiffrement et contrôle d'accès stricts.")).toBeInTheDocument();

    expect(screen.getByRole("heading", { level: 3, name: "Transparence" })).toBeInTheDocument();
    expect(screen.getByText("Traçabilité et information claire des traitements.")).toBeInTheDocument();
  });

  it("rend correctement une liste vide (affiche uniquement l'en-tête, aucune carte)", () => {
    render(<DpoEngagementsSection engagements={[]} />);

    expect(screen.getByRole("heading", { level: 2, name: "Nos engagements RGPD" })).toBeInTheDocument();
    expect(screen.queryAllByTestId("card")).toHaveLength(0);
  });
});