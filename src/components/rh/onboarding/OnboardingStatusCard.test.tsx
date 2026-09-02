/* @vitest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { OnboardingStatusCard } from "./OnboardingStatusCard";

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 data-testid="card-title" className={className}>
      {children}
    </h2>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span data-testid="badge" className={className}>
      {children}
    </span>
  ),
}));

vi.mock("@/components/ui/progress", () => ({
  Progress: ({ value, className }: { value: number; className?: string }) => (
    <div data-testid="progress" data-value={value} className={className}>
      {value}
    </div>
  ),
}));

vi.mock("lucide-react", () => ({
  Calendar: ({ className }: { className?: string }) => <svg data-testid="calendar-icon" className={className} />,
  User: ({ className }: { className?: string }) => <svg data-testid="user-icon" className={className} />,
}));

describe("OnboardingStatusCard", () => {
  it("affiche le profil, le statut actif, le taux de complétude et les dates formatées", () => {
    render(
      <OnboardingStatusCard
        profileName="Jean Dupont"
        completionRate={75}
        data={{
          statut: "actif",
          date_entree: "2024-01-15T00:00:00.000Z",
          date_sortie: "2024-12-20T00:00:00.000Z",
          motif_sortie: "Fin de mission",
        }}
      />,
    );

    expect(screen.getByTestId("card-title")).toHaveTextContent("Jean Dupont");
    expect(screen.getByTestId("badge")).toHaveTextContent("Actif");
    expect(screen.getByTestId("badge")).toHaveClass("bg-green-500");

    expect(screen.getByText("Complétude")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByTestId("progress")).toHaveAttribute("data-value", "75");

    expect(screen.getByText("Date d'entrée")).toBeInTheDocument();
    expect(screen.getByText("15 janvier 2024")).toBeInTheDocument();

    expect(screen.getByText("Date de sortie")).toBeInTheDocument();
    expect(screen.getByText("20 décembre 2024")).toBeInTheDocument();

    expect(screen.getByText("Motif de sortie")).toBeInTheDocument();
    expect(screen.getByText("Fin de mission")).toBeInTheDocument();

    expect(screen.getByTestId("user-icon")).toBeInTheDocument();
    expect(screen.getAllByTestId("calendar-icon")).toHaveLength(2);
  });

  it("affiche le bon libellé et la bonne classe pour le statut en_cours", () => {
    render(
      <OnboardingStatusCard
        profileName="Marie Martin"
        completionRate={40}
        data={{
          statut: "en_cours",
          date_entree: "2024-03-01T00:00:00.000Z",
          date_sortie: null,
          motif_sortie: null,
        }}
      />,
    );

    expect(screen.getByTestId("badge")).toHaveTextContent("En cours");
    expect(screen.getByTestId("badge")).toHaveClass("bg-orange-500");
    expect(screen.getByText("01 mars 2024")).toBeInTheDocument();
    expect(screen.queryByText("Date de sortie")).not.toBeInTheDocument();
    expect(screen.queryByText("Motif de sortie")).not.toBeInTheDocument();
  });

  it("affiche le bon libellé et la bonne classe pour le statut sortie_prevue", () => {
    render(
      <OnboardingStatusCard
        profileName="Paul Bernard"
        completionRate={90}
        data={{
          statut: "sortie_prevue",
          date_entree: "2023-09-10T00:00:00.000Z",
          date_sortie: "2024-08-31T00:00:00.000Z",
          motif_sortie: null,
        }}
      />,
    );

    expect(screen.getByTestId("badge")).toHaveTextContent("Sortie prévue");
    expect(screen.getByTestId("badge")).toHaveClass("bg-yellow-500");
    expect(screen.getByText("10 septembre 2023")).toBeInTheDocument();
    expect(screen.getByText("31 août 2024")).toBeInTheDocument();
  });

  it("affiche le bon libellé et la bonne classe pour le statut sorti", () => {
    render(
      <OnboardingStatusCard
        profileName="Claire Robert"
        completionRate={100}
        data={{
          statut: "sorti",
          date_entree: null,
          date_sortie: "2024-05-05T00:00:00.000Z",
          motif_sortie: "Démission",
        }}
      />,
    );

    expect(screen.getByTestId("badge")).toHaveTextContent("Sorti");
    expect(screen.getByTestId("badge")).toHaveClass("bg-gray-500");
    expect(screen.queryByText("Date d'entrée")).not.toBeInTheDocument();
    expect(screen.getByText("05 mai 2024")).toBeInTheDocument();
    expect(screen.getByText("Démission")).toBeInTheDocument();
  });

  it("n'affiche pas les sections optionnelles quand les données sont absentes", () => {
    render(
      <OnboardingStatusCard
        profileName="Alice Simon"
        completionRate={0}
        data={{
          statut: "en_cours",
          date_entree: null,
          date_sortie: null,
          motif_sortie: null,
        }}
      />,
    );

    expect(screen.getByText("Alice Simon")).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();
    expect(screen.queryByText("Date d'entrée")).not.toBeInTheDocument();
    expect(screen.queryByText("Date de sortie")).not.toBeInTheDocument();
    expect(screen.queryByText("Motif de sortie")).not.toBeInTheDocument();
    expect(screen.queryByTestId("calendar-icon")).not.toBeInTheDocument();
  });
});