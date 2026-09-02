// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { FollowUpWidget } from "./FollowUpWidget";
import { useDashboardCoreData } from "@/hooks/dashboard/useDashboardCoreData";

const {
  mockNavigate,
  DAY,
  NOW,
  stableDashboardData,
  emptyDashboardData,
} = vi.hoisted(() => {
  const mockNavigate = vi.fn();
  const DAY = 24 * 60 * 60 * 1000;
  const NOW = new Date("2024-06-20T12:00:00.000Z").getTime();

  const isoDaysAgo = (days: number) => new Date(NOW - days * DAY).toISOString();

  const stableDashboardData = {
    etablissements: [
      {
        id: "neg-1",
        nom: "Negociation Critique",
        statut: "Négociation",
        created_at: isoDaysAgo(30),
        updated_at: isoDaysAgo(16),
        last_email_received_at: null,
        last_email_sent_at: null,
      },
      {
        id: "pros-1",
        nom: "Prospect Urgent",
        statut: "Prospect",
        created_at: isoDaysAgo(20),
        updated_at: isoDaysAgo(9),
        last_email_received_at: null,
        last_email_sent_at: null,
      },
      {
        id: "prod-1",
        nom: "Production Plan",
        statut: "Production",
        created_at: isoDaysAgo(15),
        updated_at: isoDaysAgo(6),
        last_email_received_at: null,
        last_email_sent_at: null,
      },
      {
        id: "rdv-1",
        nom: "RDV A Confirmer",
        statut: "RDV pris",
        created_at: isoDaysAgo(25),
        updated_at: isoDaysAgo(8),
        last_email_received_at: null,
        last_email_sent_at: null,
      },
      {
        id: "recent-1",
        nom: "Compte Récent",
        statut: "Contacté",
        created_at: isoDaysAgo(3),
        updated_at: isoDaysAgo(2),
        last_email_received_at: null,
        last_email_sent_at: null,
      },
      {
        id: "mail-1",
        nom: "Email Récent Ignore Relance",
        statut: "Prospect",
        created_at: isoDaysAgo(30),
        updated_at: isoDaysAgo(20),
        last_email_received_at: null,
        last_email_sent_at: null,
      },
      {
        id: "skip-1",
        nom: "Sans Dates",
        statut: "Prospect",
        created_at: null,
        updated_at: null,
        last_email_received_at: null,
        last_email_sent_at: null,
      },
    ],
    lastEmailByEtablissement: new Map<string, string>([["mail-1", isoDaysAgo(1)]]),
  };

  const emptyDashboardData = {
    etablissements: [
      {
        id: "ok-1",
        nom: "Compte Suivi",
        statut: "Contacté",
        created_at: isoDaysAgo(1),
        updated_at: isoDaysAgo(1),
        last_email_received_at: null,
        last_email_sent_at: null,
      },
    ],
    lastEmailByEtablissement: new Map<string, string>(),
  };

  return {
    mockNavigate,
    DAY,
    NOW,
    stableDashboardData,
    emptyDashboardData,
  };
});

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("@/hooks/dashboard/useDashboardCoreData", () => ({
  useDashboardCoreData: vi.fn(() => stableDashboardData),
}));

vi.mock("@/lib/utils", () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
  CardHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-header" className={className}>
      {children}
    </div>
  ),
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-title" className={className}>
      {children}
    </div>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
    variant?: string;
  }) => (
    <span data-testid="badge" className={className}>
      {children}
    </span>
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    className,
    onClick,
  }: {
    children: React.ReactNode;
    className?: string;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    variant?: string;
    size?: string;
  }) => (
    <button type="button" className={className} onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="scroll-area" className={className}>
      {children}
    </div>
  ),
}));

vi.mock("lucide-react", () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />;
  return {
    PhoneForwarded: Icon,
    ExternalLink: Icon,
    Mail: Icon,
    CalendarCheck: Icon,
    MessageSquare: Icon,
    HeartPulse: Icon,
    Building2: Icon,
  };
});

describe("FollowUpWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    vi.mocked(useDashboardCoreData).mockReturnValue(stableDashboardData);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("affiche les relances triées avec les bons compteurs, jours et actions métier", () => {
    render(<FollowUpWidget />);

    expect(screen.getByText("Relances à faire")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();

    expect(screen.getByText("1 critique")).toBeInTheDocument();
    expect(screen.getByText("2 urgents")).toBeInTheDocument();
    expect(screen.getByText("1 à planifier")).toBeInTheDocument();

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(4);

    expect(buttons[0]).toHaveTextContent("Negociation Critique");
    expect(buttons[0]).toHaveTextContent("Critique");
    expect(buttons[0]).toHaveTextContent("16j sans activité");
    expect(buttons[0]).toHaveTextContent("Relancer sur la proposition");

    expect(buttons[1]).toHaveTextContent("Prospect Urgent");
    expect(buttons[1]).toHaveTextContent("Urgent");
    expect(buttons[1]).toHaveTextContent("9j sans activité");
    expect(buttons[1]).toHaveTextContent("Envoyer email de relance");

    expect(buttons[2]).toHaveTextContent("RDV A Confirmer");
    expect(buttons[2]).toHaveTextContent("Urgent");
    expect(buttons[2]).toHaveTextContent("8j sans activité");
    expect(buttons[2]).toHaveTextContent("Confirmer le prochain RDV");

    expect(buttons[3]).toHaveTextContent("Production Plan");
    expect(buttons[3]).toHaveTextContent("À planifier");
    expect(buttons[3]).toHaveTextContent("6j sans activité");
    expect(buttons[3]).toHaveTextContent("Point de suivi trimestriel");

    expect(screen.queryByText("Compte Récent")).not.toBeInTheDocument();
    expect(screen.queryByText("Email Récent Ignore Relance")).not.toBeInTheDocument();
    expect(screen.queryByText("Sans Dates")).not.toBeInTheDocument();
    expect(screen.queryByText("Aucune relance nécessaire")).not.toBeInTheDocument();
  });

  it("navigue vers la fiche établissement au clic sur une relance", () => {
    render(<FollowUpWidget />);

    fireEvent.click(screen.getByRole("button", { name: /Prospect Urgent/i }));

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/etablissements/pros-1");
  });

  it("affiche l'état vide quand aucune relance n'est nécessaire", () => {
    vi.mocked(useDashboardCoreData).mockReturnValue(emptyDashboardData);

    render(<FollowUpWidget />);

    expect(screen.getByText("Aucune relance nécessaire")).toBeInTheDocument();
    expect(screen.getByText("Tous vos comptes sont à jour ✓")).toBeInTheDocument();
    expect(screen.queryByTestId("scroll-area")).not.toBeInTheDocument();
    expect(screen.queryByText("Critique")).not.toBeInTheDocument();
    expect(screen.queryByText("Urgent")).not.toBeInTheDocument();
    expect(screen.queryByText("À planifier")).not.toBeInTheDocument();
  });
});