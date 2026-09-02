import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { EmailThreadGroupeCard } from "./EmailThreadGroupeCard";

const { mockNavigate, ETABS, SINGLE_ETAB_NO_DETAILS } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  ETABS: [
    {
      id: "etab-1",
      nom: "Clinique Alpha",
      ville: "Lyon",
      progression: 50,
      taches: [
        { statut: "A faire", titre: "Envoyer devis", echeance: "2025-01-10" },
        { statut: "Terminé", titre: "Premier contact", echeance: "2025-01-05" },
        { statut: "A faire", titre: "Relancer direction", echeance: "2025-01-20" },
      ],
    },
    {
      id: "etab-2",
      nom: "Hôpital Beta",
      ville: "Paris",
      progression: 100,
      taches: [
        { statut: "Terminé", titre: "Validation", echeance: "2025-01-01" },
        { statut: "En cours", titre: "Signature", echeance: "2025-01-15" },
      ],
    },
    {
      id: "etab-3",
      nom: "Centre Gamma",
      ville: null,
      progression: 0,
      taches: [],
    },
  ],
  SINGLE_ETAB_NO_DETAILS: [
    {
      id: "etab-x",
      nom: "Site sans détails",
      ville: null,
      progression: null,
      taches: [{ statut: "Terminé", titre: "Clôturé", echeance: "2025-02-01" }],
    },
  ],
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
  }) => (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <span className={className}>{children}</span>,
}));

vi.mock("@/components/ui/progress", () => ({
  Progress: ({ value, className }: { value: number; className?: string }) => (
    <div role="progressbar" aria-valuenow={value} className={className}>
      {value}
    </div>
  ),
}));

vi.mock("@/components/ui/accordion", () => ({
  Accordion: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
  AccordionItem: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: string;
  }) => <div data-testid={`accordion-item-${value}`}>{children}</div>,
  AccordionTrigger: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <button type="button" className={className}>
      {children}
    </button>
  ),
  AccordionContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("lucide-react", () => ({
  Building2: ({ className }: { className?: string }) => (
    <svg data-testid="building-icon" className={className} />
  ),
}));

describe("EmailThreadGroupeCard", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
  });

  it("affiche les informations agrégées du groupe et des établissements", () => {
    render(
      <EmailThreadGroupeCard
        groupeNom="GHT Test"
        groupeId="g-1"
        etablissementsGroupe={ETABS}
      />,
    );

    expect(screen.getByTestId("building-icon")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "GHT Test (3 étab.)" })).toBeInTheDocument();
    expect(screen.getByText("Progression: 50%")).toBeInTheDocument();
    expect(screen.getByText("3 tâches")).toBeInTheDocument();

    expect(screen.getByText("Clinique Alpha")).toBeInTheDocument();
    expect(screen.getByText("(Lyon)")).toBeInTheDocument();
    expect(screen.getByText("Hôpital Beta")).toBeInTheDocument();
    expect(screen.getByText("(Paris)")).toBeInTheDocument();
    expect(screen.getByText("Centre Gamma")).toBeInTheDocument();

    expect(screen.getByText("📌 Envoyer devis")).toBeInTheDocument();
    expect(screen.queryByText("📌 Relancer direction")).not.toBeInTheDocument();
    expect(screen.queryByText("📌 Signature")).not.toBeInTheDocument();

    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();

    const progressbars = screen.getAllByRole("progressbar");
    expect(progressbars).toHaveLength(3);
    expect(progressbars[0]).toHaveAttribute("aria-valuenow", "50");
    expect(progressbars[1]).toHaveAttribute("aria-valuenow", "100");
    expect(progressbars[2]).toHaveAttribute("aria-valuenow", "0");
  });

  it("navigue vers la page du groupe au clic sur le bouton principal", () => {
    render(
      <EmailThreadGroupeCard
        groupeNom="GHT Test"
        groupeId="g-1"
        etablissementsGroupe={ETABS}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Voir le groupe" }));

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/groupes/g-1");
  });

  it("navigue vers la fiche établissement correspondante", () => {
    render(
      <EmailThreadGroupeCard
        groupeNom="GHT Test"
        groupeId="g-1"
        etablissementsGroupe={ETABS}
      />,
    );

    const etabButtons = screen.getAllByRole("button", { name: "Voir la fiche →" });
    fireEvent.click(etabButtons[1]);

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/etablissements/etab-2");
  });

  it("gère un nom de groupe null et une liste vide", () => {
    render(
      <EmailThreadGroupeCard
        groupeNom={null}
        groupeId={null}
        etablissementsGroupe={[]}
      />,
    );

    expect(screen.getByRole("heading", { name: "(0 étab.)" })).toBeInTheDocument();
    expect(screen.getByText("Progression: NaN%")).toBeInTheDocument();
    expect(screen.getByText("0 tâches")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Voir le groupe" }));
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/groupes/null");
  });

  it("n'affiche pas la ville ni la prochaine tâche quand absentes", () => {
    render(
      <EmailThreadGroupeCard
        groupeNom="GHT Test"
        groupeId="g-1"
        etablissementsGroupe={SINGLE_ETAB_NO_DETAILS}
      />,
    );

    expect(screen.getByText("Site sans détails")).toBeInTheDocument();
    expect(screen.queryByText("(null)")).not.toBeInTheDocument();
    expect(screen.queryByText(/📌/)).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});