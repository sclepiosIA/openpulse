/* @vitest-environment jsdom */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { CatalogueProduitCard } from "./CatalogueProduitCard";

const { LABELS, RECURRENCES, PRODUIT, INACTIVE_PRODUIT, STAT } = vi.hoisted(() => ({
  LABELS: {
    service: "Service",
    produit: "Produit",
  },
  RECURRENCES: {
    monthly: "Mensuel",
    yearly: "Annuel",
    none: "Aucune",
  },
  PRODUIT: {
    id: "prod-1",
    code: "REF-001",
    nom: "Audit comptable",
    description: "Analyse complète des comptes annuels",
    type: "service",
    categorie: "Conseil",
    recurrence: "monthly",
    prix_unitaire_ht: 1200.5,
    unite: "heure",
    taux_tva: 20,
    est_actif: true,
  },
  INACTIVE_PRODUIT: {
    id: "prod-2",
    code: "REF-002",
    nom: "Maintenance",
    description: "",
    type: "produit",
    categorie: "",
    recurrence: "none",
    prix_unitaire_ht: 99,
    unite: "mois",
    taux_tva: 10,
    est_actif: false,
  },
  STAT: {
    nb_devis: 2,
    nb_factures: 3,
  },
}));

vi.mock("@/types/facturation", () => ({
  PRODUIT_TYPE_LABELS: LABELS,
  RECURRENCE_LABELS: RECURRENCES,
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>
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
    variant,
    className,
  }: {
    children: React.ReactNode;
    variant?: string;
    className?: string;
  }) => (
    <span data-testid={`badge-${variant ?? "default"}`} className={className}>
      {children}
    </span>
  ),
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
  }) => (
    <button type="button" onClick={onClick} aria-label={ariaLabel} className={className}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode; align?: string }) => <div>{children}</div>,
  DropdownMenuItem: ({
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
  DropdownMenuSeparator: () => <hr />,
}));

vi.mock("lucide-react", () => ({
  MoreHorizontal: ({ className }: { className?: string }) => <svg data-testid="icon-more" className={className} />,
  Pencil: ({ className }: { className?: string }) => <svg data-testid="icon-pencil" className={className} />,
  Copy: ({ className }: { className?: string }) => <svg data-testid="icon-copy" className={className} />,
  Archive: ({ className }: { className?: string }) => <svg data-testid="icon-archive" className={className} />,
  ArchiveRestore: ({ className }: { className?: string }) => <svg data-testid="icon-archive-restore" className={className} />,
  Trash2: ({ className }: { className?: string }) => <svg data-testid="icon-trash" className={className} />,
}));

describe("CatalogueProduitCard", () => {
  it("affiche les informations métier du produit actif avec stats d'utilisation", () => {
    render(
      <CatalogueProduitCard
        produit={PRODUIT}
        stat={STAT}
        onEdit={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("REF-001")).toBeInTheDocument();
    expect(screen.getByText("Audit comptable")).toBeInTheDocument();
    expect(screen.getByText("Analyse complète des comptes annuels")).toBeInTheDocument();

    expect(screen.getByText("Service")).toBeInTheDocument();
    expect(screen.getByText("Conseil")).toBeInTheDocument();
    expect(screen.getByText((_, node) => node?.textContent === "Mensuel")).toBeInTheDocument();

    expect(screen.getByText((_, node) => node?.textContent === "1 200,50 €")).toBeInTheDocument();
    expect(screen.getByText((_, node) => node?.textContent === "/ heure · TVA 20%")).toBeInTheDocument();
    expect(screen.getByText((_, node) => node?.textContent === "5 util.")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Plus d'options" })).toBeInTheDocument();
    expect(screen.getByText("Modifier")).toBeInTheDocument();
    expect(screen.getByText("Dupliquer")).toBeInTheDocument();
    expect(screen.getByText("Archiver")).toBeInTheDocument();
    expect(screen.getByText("Supprimer")).toBeInTheDocument();

    expect(screen.getByTestId("card")).not.toHaveClass("opacity-60");
  });

  it("adapte le rendu pour un produit inactif sans description, sans catégorie, sans récurrence ni utilisation", () => {
    render(
      <CatalogueProduitCard
        produit={INACTIVE_PRODUIT}
        onEdit={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("REF-002")).toBeInTheDocument();
    expect(screen.getByText("Maintenance")).toBeInTheDocument();
    expect(screen.getByText("Produit")).toBeInTheDocument();
    expect(screen.getByText((_, node) => node?.textContent === "99,00 €")).toBeInTheDocument();
    expect(screen.getByText((_, node) => node?.textContent === "/ mois · TVA 10%")).toBeInTheDocument();

    expect(screen.queryByText((_, node) => node?.textContent === "Mensuel")).not.toBeInTheDocument();
    expect(screen.queryByText("Conseil")).not.toBeInTheDocument();
    expect(screen.queryByText(/util\./)).not.toBeInTheDocument();
    expect(screen.queryByText("Archiver")).not.toBeInTheDocument();
    expect(screen.getByText("Réactiver")).toBeInTheDocument();

    expect(screen.getByTestId("card")).toHaveClass("opacity-60");
  });

  it("déclenche les callbacks d'action avec les bonnes valeurs", () => {
    const onEdit = vi.fn();
    const onDuplicate = vi.fn();
    const onArchive = vi.fn();
    const onDelete = vi.fn();

    render(
      <CatalogueProduitCard
        produit={PRODUIT}
        stat={STAT}
        onEdit={onEdit}
        onDuplicate={onDuplicate}
        onArchive={onArchive}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByText("Modifier"));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith(PRODUIT);

    fireEvent.click(screen.getByText("Dupliquer"));
    expect(onDuplicate).toHaveBeenCalledTimes(1);
    expect(onDuplicate).toHaveBeenCalledWith("prod-1");

    fireEvent.click(screen.getByText("Archiver"));
    expect(onArchive).toHaveBeenCalledTimes(1);
    expect(onArchive).toHaveBeenCalledWith("prod-1", true);

    fireEvent.click(screen.getByText("Supprimer"));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith(PRODUIT);
  });
});