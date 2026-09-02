// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { CatalogueProduitTable } from "./CatalogueProduitTable";

const { DATA } = vi.hoisted(() => ({
  DATA: {
    produits: [
      {
        id: "p1",
        code: "PRD-001",
        nom: "Abonnement Mensuel",
        description: "Accès premium",
        type: "service",
        categorie: "SaaS",
        prix_unitaire_ht: 49.9,
        taux_tva: 20,
        recurrence: "monthly",
        est_actif: true,
      },
      {
        id: "p2",
        code: "PRD-002",
        nom: "Audit Initial",
        description: "",
        type: "product",
        categorie: "",
        prix_unitaire_ht: 150,
        taux_tva: 10,
        recurrence: "none",
        est_actif: false,
      },
    ],
    statsMap: new Map([
      ["p1", { nb_devis: 2, nb_factures: 1 }],
      ["p2", { nb_devis: 0, nb_factures: 0 }],
    ]),
  },
}));

vi.mock("@/components/ui/table", () => {
  const TableRow = React.forwardRef<
    HTMLTableRowElement,
    React.HTMLAttributes<HTMLTableRowElement> & { children?: React.ReactNode }
  >(({ children, ...props }, ref) => <tr ref={ref} {...props}>{children}</tr>);
  TableRow.displayName = "TableRow";

  return {
    Table: ({ children }: { children?: React.ReactNode }) => <table>{children}</table>,
    TableHeader: ({ children }: { children?: React.ReactNode }) => <thead>{children}</thead>,
    TableBody: ({ children }: { children?: React.ReactNode }) => <tbody>{children}</tbody>,
    TableRow,
    TableHead: ({ children, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => <th {...props}>{children}</th>,
    TableCell: ({ children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => <td {...props}>{children}</td>,
  };
});

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children?: React.ReactNode; asChild?: boolean }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children?: React.ReactNode; align?: string }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onClick,
    className,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    className?: string;
  }) => (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr />,
}));

vi.mock("lucide-react", () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon" {...props} />;
  return {
    Check: Icon,
    X: Icon,
    Pencil: Icon,
    Copy: Icon,
    Archive: Icon,
    ArchiveRestore: Icon,
    Trash2: Icon,
    GripVertical: Icon,
    MoreHorizontal: Icon,
  };
});

vi.mock("@/types/facturation", () => ({
  PRODUIT_TYPE_LABELS: {
    service: "Service",
    product: "Produit",
  },
  RECURRENCE_LABELS: {
    none: "Aucune",
    monthly: "Mensuelle",
  },
}));

vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  closestCenter: vi.fn(),
  KeyboardSensor: function KeyboardSensor() {},
  PointerSensor: function PointerSensor() {},
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn(() => []),
}));

vi.mock("@dnd-kit/sortable", () => ({
  arrayMove: <T,>(arr: T[], from: number, to: number) => {
    const next = [...arr];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  },
  SortableContext: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  sortableKeyboardCoordinates: vi.fn(),
  useSortable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  })),
  verticalListSortingStrategy: vi.fn(),
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: {
    Transform: {
      toString: () => undefined,
    },
  },
}));

vi.mock("@dnd-kit/modifiers", () => ({
  restrictToVerticalAxis: vi.fn(),
}));

describe("CatalogueProduitTable", () => {
  it("affiche les en-têtes et les valeurs métier des produits", () => {
    render(
      <CatalogueProduitTable
        produits={DATA.produits}
        statsMap={DATA.statsMap}
        onEdit={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText("Code")).toBeInTheDocument();
    expect(screen.getByText("Nom")).toBeInTheDocument();
    expect(screen.getByText("Prix HT")).toBeInTheDocument();
    expect(screen.getByText("TVA")).toBeInTheDocument();
    expect(screen.getByText("Récurrence")).toBeInTheDocument();
    expect(screen.getByText("Utilisé")).toBeInTheDocument();
    expect(screen.getByText("Actif")).toBeInTheDocument();

    const row1 = screen.getByText("PRD-001").closest("tr");
    const row2 = screen.getByText("PRD-002").closest("tr");

    expect(row1).not.toBeNull();
    expect(row2).not.toBeNull();

    const row1Scope = within(row1 as HTMLElement);
    const row2Scope = within(row2 as HTMLElement);

    expect(row1Scope.getByText("Abonnement Mensuel")).toBeInTheDocument();
    expect(row1Scope.getByText("Accès premium")).toBeInTheDocument();
    expect(row1Scope.getByText("Service")).toBeInTheDocument();
    expect(row1Scope.getByText("SaaS")).toBeInTheDocument();
    expect(row1Scope.getByText("49,90 €")).toBeInTheDocument();
    expect(row1Scope.getByText("20%")).toBeInTheDocument();
    expect(row1Scope.getByText("Mensuelle")).toBeInTheDocument();
    expect(row1Scope.getByText("3×")).toBeInTheDocument();

    expect(row2Scope.getByText("Audit Initial")).toBeInTheDocument();
    expect(row2Scope.getByText("Produit")).toBeInTheDocument();
    expect(row2Scope.getByText("150,00 €")).toBeInTheDocument();
    expect(row2Scope.getByText("10%")).toBeInTheDocument();
    expect(row2Scope.getByText("Aucune")).toBeInTheDocument();
    expect(row2Scope.getAllByText("—")).toHaveLength(2);
  });

  it("affiche le message vide quand aucun produit n'est fourni", () => {
    render(
      <CatalogueProduitTable
        produits={[]}
        onEdit={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText("Aucun produit")).toBeInTheDocument();
  });

  it("déclenche les callbacks d'actions avec les bonnes données", () => {
    const onEdit = vi.fn();
    const onDuplicate = vi.fn();
    const onArchive = vi.fn();
    const onDelete = vi.fn();

    render(
      <CatalogueProduitTable
        produits={DATA.produits}
        statsMap={DATA.statsMap}
        onEdit={onEdit}
        onDuplicate={onDuplicate}
        onArchive={onArchive}
        onDelete={onDelete}
      />
    );

    const row1 = screen.getByText("PRD-001").closest("tr");
    const row2 = screen.getByText("PRD-002").closest("tr");

    expect(row1).not.toBeNull();
    expect(row2).not.toBeNull();

    const row1Scope = within(row1 as HTMLElement);
    const row2Scope = within(row2 as HTMLElement);

    fireEvent.click(row1Scope.getByText("Modifier"));
    expect(onEdit).toHaveBeenCalledWith(DATA.produits[0]);

    fireEvent.click(row1Scope.getByText("Dupliquer"));
    expect(onDuplicate).toHaveBeenCalledWith("p1");

    fireEvent.click(row1Scope.getByText("Archiver"));
    expect(onArchive).toHaveBeenCalledWith("p1", true);

    fireEvent.click(row2Scope.getByText("Réactiver"));
    expect(onArchive).toHaveBeenCalledWith("p2", false);

    fireEvent.click(row1Scope.getByText("Supprimer"));
    expect(onDelete).toHaveBeenCalledWith(DATA.produits[0]);
  });

  it("affiche le bouton de réorganisation seulement si activé", () => {
    const { rerender } = render(
      <CatalogueProduitTable
        produits={DATA.produits}
        onEdit={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onDelete={vi.fn()}
        reorderEnabled={false}
      />
    );

    expect(screen.queryByLabelText("Réorganiser")).not.toBeInTheDocument();

    rerender(
      <CatalogueProduitTable
        produits={DATA.produits}
        onEdit={vi.fn()}
        onDuplicate={vi.fn()}
        onArchive={vi.fn()}
        onDelete={vi.fn()}
        reorderEnabled
      />
    );

    expect(screen.getAllByLabelText("Réorganiser")).toHaveLength(2);
  });
});