/* @vitest-environment jsdom */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { PartenairesListView } from "./PartenairesListView";

const { navigateMock, onSelectOneMock, partenaires, emptyPartenaires, formatDistanceToNowMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  onSelectOneMock: vi.fn(),
  formatDistanceToNowMock: vi.fn(() => "il y a 3 jours"),
  partenaires: [
    {
      id: "p1",
      nom: "Alpha Conseil",
      logo_url: null,
      type_partenaire: "association",
      statut_relation: "actif",
      ville: "Paris",
      responsable: { prenom: "Jean", nom: "Dupont" },
      dernier_contact: "2024-01-10T00:00:00.000Z",
      engagement_score: 75,
      email: "alpha@test.fr",
      prochaine_action: "2020-01-01T00:00:00.000Z",
    },
    {
      id: "p2",
      nom: "Beta Group",
      logo_url: null,
      type_partenaire: "entreprise",
      statut_relation: "prospect",
      ville: null,
      responsable: null,
      dernier_contact: null,
      engagement_score: 0,
      email: null,
      prochaine_action: null,
    },
  ],
  emptyPartenaires: [],
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("@/lib/utils", () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
}));

vi.mock("date-fns", () => ({
  formatDistanceToNow: formatDistanceToNowMock,
}));

vi.mock("date-fns/locale", () => ({
  fr: {},
}));

vi.mock("lucide-react", () => {
  const Icon = ({ className }: { className?: string }) => React.createElement("svg", { "data-testid": "icon", className });
  return {
    MoreHorizontal: Icon,
    Eye: Icon,
    Mail: Icon,
    MapPin: Icon,
    Calendar: Icon,
  };
});

vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
    "aria-label": ariaLabel,
  }: {
    checked?: boolean;
    onCheckedChange?: () => void;
    "aria-label"?: string;
  }) =>
    React.createElement("button", {
      type: "button",
      role: "checkbox",
      "aria-checked": checked ? "true" : "false",
      "aria-label": ariaLabel,
      onClick: onCheckedChange,
    }),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({
    children,
    variant,
    className,
  }: {
    children: React.ReactNode;
    variant?: string;
    className?: string;
  }) => React.createElement("span", { "data-variant": variant, className }, children),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    "aria-label": ariaLabel,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    "aria-label"?: string;
    className?: string;
  }) => React.createElement("button", { type: "button", onClick, "aria-label": ariaLabel, className }, children),
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children),
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children),
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => React.createElement("button", { type: "button", onClick }, children),
}));

vi.mock("@/components/ui/partenaire-badge", () => ({
  PartenaireBadge: ({
    type,
    partenaireId,
  }: {
    type: string;
    partenaireId: string;
  }) => React.createElement("span", { "data-testid": `partenaire-badge-${partenaireId}` }, type),
}));

vi.mock("@/components/ui/avatar", () => ({
  Avatar: ({ children, className }: { children: React.ReactNode; className?: string }) =>
    React.createElement("div", { className }, children),
  AvatarFallback: ({ children, className }: { children: React.ReactNode; className?: string }) =>
    React.createElement("span", { className }, children),
}));

vi.mock("@/components/ui/EntityAvatar", () => ({
  EntityAvatar: ({ name }: { name: string }) => React.createElement("div", { "data-testid": `entity-avatar-${name}` }, name.slice(0, 1)),
}));

describe("PartenairesListView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche les informations métier principales de chaque partenaire", () => {
    render(
      <PartenairesListView
        partenaires={partenaires}
        selectedIds={["p1"]}
        onSelectOne={onSelectOneMock}
      />
    );

    expect(screen.getByText("Alpha Conseil")).toBeInTheDocument();
    expect(screen.getByText("Beta Group")).toBeInTheDocument();
    expect(screen.getByText("Paris")).toBeInTheDocument();
    expect(screen.getByText("Jean Dupont")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("actif")).toHaveAttribute("data-variant", "default");
    expect(screen.getByText("prospect")).toHaveAttribute("data-variant", "secondary");
    expect(screen.getByTestId("partenaire-badge-p1")).toHaveTextContent("association");
    expect(screen.getByTestId("partenaire-badge-p2")).toHaveTextContent("entreprise");
    expect(formatDistanceToNowMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText("il y a 3 jours")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Sélectionner Alpha Conseil" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("checkbox", { name: "Sélectionner Beta Group" })).toHaveAttribute("aria-checked", "false");
  });

  it("navigue au clic sur une ligne et au clavier avec Entrée", () => {
    render(
      <PartenairesListView
        partenaires={partenaires}
        selectedIds={[]}
        onSelectOne={onSelectOneMock}
      />
    );

    const alphaRow = screen.getByRole("button", { name: "Ouvrir la fiche partenaire Alpha Conseil" });
    fireEvent.click(alphaRow);
    fireEvent.keyDown(alphaRow, { key: "Enter" });

    expect(navigateMock).toHaveBeenNthCalledWith(1, "/partenaires/p1");
    expect(navigateMock).toHaveBeenNthCalledWith(2, "/partenaires/p1");
  });

  it("déclenche la sélection sans naviguer quand on clique sur la checkbox", () => {
    render(
      <PartenairesListView
        partenaires={partenaires}
        selectedIds={[]}
        onSelectOne={onSelectOneMock}
      />
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Sélectionner Alpha Conseil" }));

    expect(onSelectOneMock).toHaveBeenCalledWith("p1");
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("permet les actions Voir et Email depuis le menu", () => {
    const hrefSetter = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...originalLocation,
        set href(value: string) {
          hrefSetter(value);
        },
        get href() {
          return "";
        },
      },
    });

    render(
      <PartenairesListView
        partenaires={partenaires}
        selectedIds={[]}
        onSelectOne={onSelectOneMock}
      />
    );

    fireEvent.click(screen.getAllByText("Voir")[0]);
    fireEvent.click(screen.getByText("Email"));

    expect(navigateMock).toHaveBeenCalledWith("/partenaires/p1");
    expect(hrefSetter).toHaveBeenCalledWith("mailto:alpha@test.fr");

    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("affiche un état vide quand aucun partenaire n'est fourni", () => {
    render(
      <PartenairesListView
        partenaires={emptyPartenaires}
        selectedIds={[]}
        onSelectOne={onSelectOneMock}
      />
    );

    expect(screen.getByText("Aucun partenaire à afficher")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ouvrir la fiche partenaire/i })).not.toBeInTheDocument();
  });
});