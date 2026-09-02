import type { CSSProperties, MouseEventHandler, ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { EtablissementProgressionStatus } from "./EtablissementProgressionStatus";

const { PHASE_GROUPS_MOCK, mockGetPhaseByStatus } = vi.hoisted(() => {
  const PHASE_GROUPS_MOCK = {
    commercial: {
      label: "Commercial",
      icon: "span",
      statuts: ["Prospect"],
      color: "rgb(202, 138, 4)",
      borderColor: "border-yellow-500",
      bgColor: "bg-yellow-50",
    },
    deploiement: {
      label: "Déploiement",
      icon: "span",
      statuts: ["Contractuel", "Conformité", "Déploiement", "Formation", "Go-Live"],
      color: "rgb(37, 99, 235)",
      borderColor: "border-blue-500",
      bgColor: "bg-blue-50",
    },
    production: {
      label: "Production",
      icon: "span",
      statuts: ["Production"],
      color: "rgb(22, 163, 74)",
      borderColor: "border-green-500",
      bgColor: "bg-green-50",
    },
  } as const;

  const mockGetPhaseByStatus = vi.fn((statut: string) => {
    if (statut === "Prospect") return "commercial";
    if (statut === "Production") return "production";
    return "deploiement";
  });

  return { PHASE_GROUPS_MOCK, mockGetPhaseByStatus };
});

vi.mock("@/config/phases", () => ({
  PHASE_GROUPS: PHASE_GROUPS_MOCK,
  PhaseKey: undefined,
  getPhaseByStatus: mockGetPhaseByStatus,
}));

vi.mock("@/lib/utils", () => ({
  cn: (...classes: unknown[]) =>
    classes
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .join(" "),
}));

vi.mock("@/components/ui/card", () => {
  type ContainerProps = {
    children?: ReactNode;
    className?: string;
    onClick?: MouseEventHandler<HTMLElement>;
  };

  return {
    Card: ({ children, className, onClick }: ContainerProps) => (
      <section
        className={className}
        data-testid="card"
        onClick={onClick}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
      >
        {children}
      </section>
    ),
    CardContent: ({ children, className }: ContainerProps) => (
      <div className={className} data-testid="card-content">
        {children}
      </div>
    ),
    CardHeader: ({ children, className }: ContainerProps) => (
      <div className={className} data-testid="card-header">
        {children}
      </div>
    ),
    CardTitle: ({ children, className }: ContainerProps) => (
      <h3 className={className} data-testid="card-title">
        {children}
      </h3>
    ),
  };
});

vi.mock("@/components/ui/progress", () => {
  type ProgressProps = {
    value?: number;
    className?: string;
  };

  return {
    Progress: ({ value = 0, className }: ProgressProps) => (
      <div
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={value}
        className={className}
        data-testid="progress"
        role="progressbar"
      />
    ),
  };
});

vi.mock("@/components/ui/badge", () => {
  type BadgeProps = {
    children?: ReactNode;
    className?: string;
    variant?: string;
  };

  return {
    Badge: ({ children, className, variant }: BadgeProps) => (
      <span className={className} data-testid="badge" data-variant={variant}>
        {children}
      </span>
    ),
  };
});

vi.mock("lucide-react", () => {
  type IconProps = {
    className?: string;
    style?: CSSProperties;
  };

  return {
    Check: ({ className, style }: IconProps) => (
      <svg aria-hidden="true" className={className} data-testid="icon-check" style={style} />
    ),
    Circle: ({ className, style }: IconProps) => (
      <svg aria-hidden="true" className={className} data-testid="icon-circle" style={style} />
    ),
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("EtablissementProgressionStatus", () => {
  it("affiche la progression globale et agrège les tâches par phase métier", () => {
    render(
      <EtablissementProgressionStatus
        etablissementId="etab-1"
        progression={42.6}
        statut="Conformité"
        tasksBreakdown={{
          commercial: { completed: 1, total: 2 },
          contractuel: { completed: 2, total: 3 },
          conformite: { completed: 1, total: 2 },
          deploiement: { completed: 3, total: 5 },
          formation: { completed: 0, total: 1 },
          golive: { completed: 0, total: 0 },
          production: { completed: 0, total: 4 },
        }}
      />,
    );

    expect(screen.getByText("Progression globale")).toBeTruthy();
    expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.getByText("Commercial")).toBeTruthy();
    expect(screen.getAllByText("Déploiement")).toHaveLength(2);
    expect(screen.getAllByText("Production")).toHaveLength(2);

    expect(screen.getByText("1/2")).toBeTruthy();
    expect(screen.getByText("6/11")).toBeTruthy();
    expect(screen.getByText("0/4")).toBeTruthy();

    expect(screen.getByText("50% complété")).toBeTruthy();
    expect(screen.getByText("55% complété")).toBeTruthy();
    expect(screen.getByText("0% complété")).toBeTruthy();

    const progressValues = screen
      .getAllByRole("progressbar")
      .map((progressbar) => progressbar.getAttribute("aria-valuenow"));
    expect(progressValues).toEqual(["42.6", "50", "55", "0"]);

    expect(mockGetPhaseByStatus).toHaveBeenCalledTimes(1);
    expect(mockGetPhaseByStatus).toHaveBeenCalledWith("Conformité");
  });

  it("marque correctement les phases terminées, en cours et à venir selon le statut courant", () => {
    render(
      <EtablissementProgressionStatus
        etablissementId="etab-1"
        progression={60}
        statut="Conformité"
        tasksBreakdown={{
          commercial: { completed: 2, total: 2 },
          contractuel: { completed: 1, total: 1 },
          conformite: { completed: 0, total: 1 },
          production: { completed: 0, total: 3 },
        }}
      />,
    );

    const commercialCard = screen.getByRole("button", { name: /Commercial/ });
    const deploiementCard = screen.getByRole("button", { name: /Déploiement/ });
    const productionCard = screen.getByRole("button", { name: /Production/ });

    expect(commercialCard.className).toContain("opacity-75");
    expect(deploiementCard.className).toContain("ring-2");
    expect(deploiementCard.className).toContain("ring-primary");
    expect(productionCard.className).not.toContain("ring-2");
    expect(productionCard.className).not.toContain("opacity-75");

    expect(screen.getByText("Terminé")).toBeTruthy();
    expect(screen.getByText("En cours")).toBeTruthy();
    expect(screen.getByText("Prospect").className).toContain("line-through");
    expect(screen.getByText("Conformité").parentElement?.className).toContain("bg-primary/10");
  });

  it("déclenche onPhaseClick avec la clé de phase sélectionnée", () => {
    const onPhaseClick = vi.fn();

    render(
      <EtablissementProgressionStatus
        etablissementId="etab-1"
        onPhaseClick={onPhaseClick}
        progression={10}
        statut="Prospect"
        tasksBreakdown={{
          commercial: { completed: 0, total: 2 },
          production: { completed: 0, total: 1 },
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Production/ }));

    expect(onPhaseClick).toHaveBeenCalledTimes(1);
    expect(onPhaseClick).toHaveBeenCalledWith("production");
  });

  it("affiche zéro tâche et zéro pourcent quand aucun breakdown n'est fourni", () => {
    render(
      <EtablissementProgressionStatus
        etablissementId="etab-1"
        progression={12.4}
        statut="Prospect"
      />,
    );

    expect(screen.getByText("12%")).toBeTruthy();
    expect(screen.getAllByText("0/0")).toHaveLength(3);
    expect(screen.getAllByText("0% complété")).toHaveLength(3);
    expect(screen.getByText("En cours")).toBeTruthy();
    expect(screen.queryByText("Terminé")).toBeNull();

    const progressValues = screen
      .getAllByRole("progressbar")
      .map((progressbar) => progressbar.getAttribute("aria-valuenow"));
    expect(progressValues).toEqual(["12.4", "0", "0", "0"]);
  });
});