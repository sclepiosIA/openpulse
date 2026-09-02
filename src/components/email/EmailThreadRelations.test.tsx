/* @vitest-environment jsdom */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { EmailThreadRelations } from "./EmailThreadRelations";

const {
  mockNavigate,
  mockQuickClassify,
  mockWindowOpen,
  statusColor,
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockQuickClassify: vi.fn(),
  mockWindowOpen: vi.fn(),
  statusColor: "bg-status text-status-fg",
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("@/config/emailStatusColors", () => ({
  getEtablissementStatusColor: vi.fn(() => statusColor),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, className, variant }: { children?: React.ReactNode; className?: string; variant?: string }) => (
    <span data-testid="badge" data-variant={variant ?? ""} className={className}>
      {children}
    </span>
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    className,
    variant,
    size,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    className?: string;
    variant?: string;
    size?: string;
  }) => (
    <button data-variant={variant ?? ""} data-size={size ?? ""} className={className} onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/progress", () => ({
  Progress: ({ value, className }: { value?: number; className?: string }) => (
    <div data-testid="progress" data-value={String(value ?? "")} className={className} />
  ),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
}));

vi.mock("@/components/ui/avatar", () => ({
  Avatar: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div data-testid="avatar" className={className}>
      {children}
    </div>
  ),
  AvatarFallback: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div data-testid="avatar-fallback" className={className}>
      {children}
    </div>
  ),
  AvatarImage: ({ src, alt }: { src?: string; alt?: string }) => <img data-testid="avatar-image" src={src} alt={alt} />,
}));

vi.mock("./EmailEtablissementBadge", () => ({
  EmailEtablissementBadge: ({
    etablissementId,
    etablissementNom,
    etablissementVille,
  }: {
    etablissementId: string;
    etablissementNom: string;
    etablissementVille: string;
  }) => (
    <div data-testid="email-etablissement-badge">
      {etablissementId}:{etablissementNom}:{etablissementVille}
    </div>
  ),
}));

vi.mock("@/components/ui/partenaire-badge", () => ({
  PartenaireBadge: ({
    type,
    nom,
    ville,
    partenaireId,
  }: {
    type: string;
    nom: string;
    ville: string;
    partenaireId: string;
  }) => (
    <div data-testid="partenaire-badge">
      {type}|{nom}|{ville}|{partenaireId}
    </div>
  ),
}));

vi.mock("./TaskQuickAddDialog", () => ({
  TaskQuickAddDialog: ({
    etablissementId,
    etablissementNom,
  }: {
    etablissementId: string;
    etablissementNom: string;
  }) => (
    <div data-testid="task-quick-add-dialog">
      {etablissementId}|{etablissementNom}
    </div>
  ),
}));

vi.mock("lucide-react", () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />;
  return {
    TrendingUp: Icon,
    Target: Icon,
    Calendar: Icon,
    Building2: Icon,
    Users: Icon,
    UserCheck: Icon,
    ExternalLink: Icon,
    MapPin: Icon,
    Phone: Icon,
    Mail: Icon,
  };
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("EmailThreadRelations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "open", {
      value: mockWindowOpen,
      writable: true,
    });
  });

  it("renders the etablissement card with metrics, next task, group info and handles actions", () => {
    const Wrapper = createWrapper();

    const pastDate = "2020-01-01T00:00:00.000Z";
    const thread = {
      etablissement: {
        id: "etab-1",
        nom: "Alpha Beta",
        ville: "Paris",
        statut: "Actif",
        logo_url: "",
        progression: 75,
        engagement_score: 82,
        telephone: "0102030405",
        taches: [
          { titre: "Tâche terminée", statut: "Terminé", echeance: "2020-01-02T00:00:00.000Z", priorite: "low" },
          { titre: "Relancer direction", statut: "En cours", echeance: pastDate, priorite: "Haute" },
          { titre: "Préparer dossier", statut: "En cours", echeance: "2030-01-10T00:00:00.000Z", priorite: "medium" },
        ],
      },
    };

    const groupeInfo = { hasMultipleEtablissementsInGroupe: true };
    const etablissementsGroupe = [
      { id: "g1", nom: "Campus Nord", ville: "Lille" },
      { id: "g2", nom: "Campus Sud", ville: "Lyon" },
    ];

    const { container } = render(
      <Wrapper>
        <EmailThreadRelations
          thread={thread}
          groupeInfo={groupeInfo}
          etablissementsGroupe={etablissementsGroupe}
          onQuickClassify={mockQuickClassify}
        />
      </Wrapper>
    );

    expect(screen.getByText("Alpha Beta")).toBeInTheDocument();
    expect(screen.getByText("Paris")).toBeInTheDocument();
    expect(screen.getByText("Actif")).toBeInTheDocument();
    expect(screen.getByTestId("avatar-fallback")).toHaveTextContent("AB");
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("82/100")).toBeInTheDocument();
    expect(screen.getByTestId("progress")).toHaveAttribute("data-value", "75");
    expect(screen.getByText("En retard")).toBeInTheDocument();
    expect(screen.getByText("Relancer direction")).toBeInTheDocument();
    expect(screen.getByText("Retard")).toBeInTheDocument();
    expect(screen.getByText("Autres tâches en cours")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByTestId("task-quick-add-dialog")).toHaveTextContent("etab-1|Alpha Beta");
    expect(screen.getByText("Groupe détecté")).toBeInTheDocument();
    expect(screen.getByText("Établissements concernés :")).toBeInTheDocument();

    const badges = screen.getAllByTestId("email-etablissement-badge");
    expect(badges).toHaveLength(2);
    expect(badges[0]).toHaveTextContent("g1:Campus Nord:Lille");
    expect(badges[1]).toHaveTextContent("g2:Campus Sud:Lyon");

    fireEvent.click(screen.getByText("Fiche complète"));
    expect(mockNavigate).toHaveBeenCalledWith("/etablissement/etab-1");

    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[2]);
    expect(mockWindowOpen).toHaveBeenCalledWith("tel:0102030405", "_self");

    expect(container.textContent).toContain("Plusieurs établissements d'un même groupe participent à cette conversation");
  });

  it("renders partenaire branch and navigates to partner page", () => {
    const Wrapper = createWrapper();

    render(
      <Wrapper>
        <EmailThreadRelations
          thread={{
            partenaire: {
              id: "p1",
              type_partenaire: "Revendeur",
              nom: "Partenaire Plus",
              ville: "Marseille",
            },
          }}
          groupeInfo={null}
          etablissementsGroupe={[]}
          onQuickClassify={mockQuickClassify}
        />
      </Wrapper>
    );

    expect(screen.getByText("Partenaire")).toBeInTheDocument();
    expect(screen.getByTestId("partenaire-badge")).toHaveTextContent("Revendeur|Partenaire Plus|Marseille|p1");

    fireEvent.click(screen.getByText("Voir la fiche"));
    expect(mockNavigate).toHaveBeenCalledWith("/partenaires/p1");
  });

  it("renders empty state and triggers quick classify callbacks", () => {
    const Wrapper = createWrapper();

    render(
      <Wrapper>
        <EmailThreadRelations
          thread={{}}
          groupeInfo={null}
          etablissementsGroupe={[]}
          onQuickClassify={mockQuickClassify}
        />
      </Wrapper>
    );

    expect(screen.getByText("Aucune association")).toBeInTheDocument();
    expect(
      screen.getByText("Cet email n'est pas encore associé à un établissement, groupe ou partenaire.")
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("Associer à un établissement"));
    fireEvent.click(screen.getByText("Associer à un partenaire"));
    fireEvent.click(screen.getByText("Associer à un groupe"));

    expect(mockQuickClassify).toHaveBeenNthCalledWith(1, "etablissement");
    expect(mockQuickClassify).toHaveBeenNthCalledWith(2, "partenaire");
    expect(mockQuickClassify).toHaveBeenNthCalledWith(3, "groupe");
  });

  it("can render through a QueryClientProvider wrapper using renderHook setup required by the suite", () => {
    const Wrapper = createWrapper();

    const { result } = renderHook(() => "ok", { wrapper: Wrapper });

    expect(result.current).toBe("ok");
  });
});