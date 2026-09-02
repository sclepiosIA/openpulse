import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { EtablissementDocumentListItem } from "./EtablissementDocumentListItem";

const { badgeCalls, entityAvatarProps } = vi.hoisted(() => ({
  badgeCalls: [] as Array<{ variant?: string; className?: string; children?: React.ReactNode }>,
  entityAvatarProps: [] as Array<{ name: string; logoUrl: string | null; size: string }>,
}));

vi.mock("lucide-react", () => ({
  FolderOpen: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="folder-open-icon" {...props} />,
  ChevronRight: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="chevron-right-icon" {...props} />,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({
    variant,
    className,
    children,
  }: {
    variant?: string;
    className?: string;
    children?: React.ReactNode;
  }) => {
    badgeCalls.push({ variant, className, children });
    return (
      <span data-testid="badge" data-variant={variant} className={className}>
        {children}
      </span>
    );
  },
}));

vi.mock("@/components/ui/EntityAvatar", () => ({
  EntityAvatar: ({
    name,
    logoUrl,
    size,
  }: {
    name: string;
    logoUrl: string | null;
    size: string;
  }) => {
    entityAvatarProps.push({ name, logoUrl, size });
    return (
      <div
        data-testid="entity-avatar"
        data-name={name}
        data-logo-url={logoUrl ?? ""}
        data-size={size}
      />
    );
  },
}));

vi.mock("@/lib/utils", () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
}));

describe("EtablissementDocumentListItem", () => {
  beforeEach(() => {
    badgeCalls.length = 0;
    entityAvatarProps.length = 0;
  });

  it("affiche les informations métier principales et déclenche onClick", () => {
    const onClick = vi.fn();
    const etablissement = {
      id: "eta-1",
      nom: "Clinique du Lac",
      ville: "Lyon",
      logo_url: "logo-clinique.png",
      etablissement_logo_url: null,
      groupe_logo_url: null,
      groupe_nom: "Groupe Santé Plus",
      statut: "production",
      document_count: 12,
    };

    const { container } = render(
      <EtablissementDocumentListItem etablissement={etablissement} onClick={onClick} />
    );

    expect(screen.getByText("Clinique du Lac")).toBeInTheDocument();
    expect(screen.getByText("Lyon")).toBeInTheDocument();
    expect(screen.getByText("Groupe Santé Plus")).toBeInTheDocument();
    expect(screen.getByText("•")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();

    expect(screen.getByTestId("folder-open-icon")).toBeInTheDocument();
    expect(screen.getByTestId("chevron-right-icon")).toBeInTheDocument();

    expect(screen.getByTestId("badge")).toHaveTextContent("Production");
    expect(screen.getByTestId("badge")).toHaveAttribute("data-variant", "default");
    expect(badgeCalls[0]?.className).toContain("bg-green-500/10");
    expect(badgeCalls[0]?.className).toContain("text-green-600");

    expect(screen.getByTestId("entity-avatar")).toHaveAttribute("data-name", "Clinique du Lac");
    expect(screen.getByTestId("entity-avatar")).toHaveAttribute("data-logo-url", "logo-clinique.png");
    expect(screen.getByTestId("entity-avatar")).toHaveAttribute("data-size", "md");
    expect(entityAvatarProps[0]).toEqual({
      name: "Clinique du Lac",
      logoUrl: "logo-clinique.png",
      size: "md",
    });

    const clickableRoot = container.firstElementChild;
    expect(clickableRoot).not.toBeNull();
    if (clickableRoot) {
      fireEvent.click(clickableRoot);
    }
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("applique le style sélectionné quand isSelected vaut true", () => {
    const etablissement = {
      id: "eta-2",
      nom: "Hôpital Central",
      ville: "Paris",
      logo_url: null,
      etablissement_logo_url: null,
      groupe_logo_url: null,
      groupe_nom: null,
      statut: "deploiement",
      document_count: 3,
    };

    const { container } = render(
      <EtablissementDocumentListItem
        etablissement={etablissement}
        onClick={vi.fn()}
        isSelected={true}
      />
    );

    const root = container.firstElementChild;
    expect(root).not.toBeNull();
    expect(root?.className).toContain("bg-primary/5");
    expect(root?.className).toContain("border-primary/30");

    expect(screen.getByTestId("badge")).toHaveTextContent("Déploiement");
    expect(screen.getByTestId("badge")).toHaveAttribute("data-variant", "default");
    expect(badgeCalls[0]?.className).toContain("bg-blue-500/10");
    expect(badgeCalls[0]?.className).toContain("text-blue-600");
  });

  it("affiche le badge contractuel avec les classes attendues", () => {
    const etablissement = {
      id: "eta-3",
      nom: "Cabinet Horizon",
      ville: "Nantes",
      logo_url: null,
      etablissement_logo_url: null,
      groupe_logo_url: null,
      groupe_nom: "Réseau Ouest",
      statut: "contractuel",
      document_count: 7,
    };

    render(<EtablissementDocumentListItem etablissement={etablissement} onClick={vi.fn()} />);

    expect(screen.getByTestId("badge")).toHaveTextContent("Contractuel");
    expect(screen.getByTestId("badge")).toHaveAttribute("data-variant", "default");
    expect(badgeCalls[0]?.className).toContain("bg-amber-500/10");
    expect(badgeCalls[0]?.className).toContain("text-amber-600");
    expect(badgeCalls[0]?.className).toContain("border-amber-200");
  });

  it("affiche le badge prospect en variant secondary", () => {
    const etablissement = {
      id: "eta-4",
      nom: "Centre Nova",
      ville: null,
      logo_url: null,
      etablissement_logo_url: null,
      groupe_logo_url: null,
      groupe_nom: null,
      statut: "prospect",
      document_count: 0,
    };

    render(<EtablissementDocumentListItem etablissement={etablissement} onClick={vi.fn()} />);

    expect(screen.getByTestId("badge")).toHaveTextContent("Prospect");
    expect(screen.getByTestId("badge")).toHaveAttribute("data-variant", "secondary");
    expect(screen.queryByText("•")).not.toBeInTheDocument();
  });

  it("n'affiche ni badge ni séparateur si le statut est inconnu et les champs optionnels absents", () => {
    const etablissement = {
      id: "eta-5",
      nom: "Maison Médicale Sud",
      ville: null,
      logo_url: null,
      etablissement_logo_url: null,
      groupe_logo_url: null,
      groupe_nom: null,
      statut: "archive",
      document_count: 21,
    };

    render(<EtablissementDocumentListItem etablissement={etablissement} onClick={vi.fn()} />);

    expect(screen.getByText("Maison Médicale Sud")).toBeInTheDocument();
    expect(screen.getByText("21")).toBeInTheDocument();
    expect(screen.queryByTestId("badge")).not.toBeInTheDocument();
    expect(screen.queryByText("•")).not.toBeInTheDocument();
  });

  it("affiche seulement la ville quand le groupe est absent", () => {
    const etablissement = {
      id: "eta-6",
      nom: "Clinique Rive Gauche",
      ville: "Bordeaux",
      logo_url: null,
      etablissement_logo_url: null,
      groupe_logo_url: null,
      groupe_nom: null,
      statut: null,
      document_count: 5,
    };

    render(<EtablissementDocumentListItem etablissement={etablissement} onClick={vi.fn()} />);

    expect(screen.getByText("Bordeaux")).toBeInTheDocument();
    expect(screen.queryByText("•")).not.toBeInTheDocument();
    expect(screen.queryByTestId("badge")).not.toBeInTheDocument();
  });

  it("affiche seulement le groupe quand la ville est absente", () => {
    const etablissement = {
      id: "eta-7",
      nom: "Pôle Santé Nord",
      ville: null,
      logo_url: null,
      etablissement_logo_url: null,
      groupe_logo_url: null,
      groupe_nom: "Alliance Care",
      statut: null,
      document_count: 9,
    };

    render(<EtablissementDocumentListItem etablissement={etablissement} onClick={vi.fn()} />);

    expect(screen.getByText("Alliance Care")).toBeInTheDocument();
    expect(screen.queryByText("•")).not.toBeInTheDocument();
    expect(screen.queryByTestId("badge")).not.toBeInTheDocument();
  });
});