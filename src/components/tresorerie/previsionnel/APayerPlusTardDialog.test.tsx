// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { APayerPlusTardDialog } from "./APayerPlusTardDialog";

type Depense = {
  id: string;
  nom: string;
  montant: number;
  categorie_code?: string | null;
  date_prevue?: string | null;
  statut?: string | null;
};

const {
  DEPENSES,
  mockToast,
  mockUpdateDepense,
  mockDeleteDepense,
  mockUseTresorerieDepenses,
  mockOnOpenChange,
  mockOnEdit,
} = vi.hoisted(() => ({
  DEPENSES: [
    {
      id: "dep-1",
      nom: "Facture électricité",
      montant: 123.45,
      categorie_code: "UTIL",
      statut: "suspendue",
      date_prevue: null,
    },
    {
      id: "dep-2",
      nom: "Loyer bureau",
      montant: 980,
      categorie_code: "LOYER",
      statut: "suspendue",
      date_prevue: null,
    },
  ] as Depense[],
  mockToast: vi.fn(),
  mockUpdateDepense: vi.fn(),
  mockDeleteDepense: vi.fn(),
  mockUseTresorerieDepenses: vi.fn(),
  mockOnOpenChange: vi.fn(),
  mockOnEdit: vi.fn(),
}));

vi.mock("@/hooks/shared/use-toast", () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

vi.mock("@/lib/formatters", () => ({
  formatCurrency: (value: number) => `${value.toFixed(2)} €`,
}));

vi.mock("@/lib/utils", () => ({
  cn: (...args: Array<string | false | null | undefined>) => args.filter(Boolean).join(" "),
}));

vi.mock("@/hooks/tresorerie/useTresorerieDepenses", () => ({
  useTresorerieDepenses: () => mockUseTresorerieDepenses(),
}));

vi.mock("lucide-react", () => {
  const Icon = ({ className }: { className?: string }) => React.createElement("span", { className, "data-icon": "icon" });
  return {
    Pencil: Icon,
    CalendarIcon: Icon,
    Trash2: Icon,
    Clock: Icon,
    Loader2: Icon,
  };
});

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? React.createElement("div", { "data-testid": "dialog-root" }, children) : null,
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) =>
    React.createElement("div", { className }, children),
  DialogHeader: ({ children }: { children: React.ReactNode }) => React.createElement("div", {}, children),
  DialogTitle: ({ children, className }: { children: React.ReactNode; className?: string }) =>
    React.createElement("h2", { className }, children),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
    type,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
    type?: "button" | "submit" | "reset";
  }) =>
    React.createElement(
      "button",
      { type: type ?? "button", onClick, disabled, className },
      children,
    ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) =>
    React.createElement("span", { className }, children),
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) =>
    React.createElement("div", { className }, children),
}));

vi.mock("@/components/ui/popover", () => ({
  Popover: ({
    open,
    onOpenChange,
    children,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
  }) => {
    const items = React.Children.toArray(children);
    const trigger = items[0];
    const content = items[1];
    return React.createElement(
      "div",
      { "data-testid": "popover-root" },
      React.createElement(
        "div",
        {
          onClick: () => onOpenChange(!open),
          "data-testid": "popover-trigger-wrapper",
        },
        trigger,
      ),
      open ? content : null,
    );
  },
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, {}, children),
  PopoverContent: ({ children, className }: { children: React.ReactNode; className?: string }) =>
    React.createElement("div", { className }, children),
}));

vi.mock("@/components/ui/calendar", () => ({
  Calendar: ({
    onSelect,
  }: {
    onSelect: (date: Date) => void;
    selected?: Date;
    mode?: string;
    disabled?: (date: Date) => boolean;
    initialFocus?: boolean;
    className?: string;
    locale?: unknown;
  }) =>
    React.createElement(
      "button",
      {
        type: "button",
        onClick: () => onSelect(new Date("2026-01-15T12:00:00.000Z")),
      },
      "Choisir le 15 janvier 2026",
    ),
}));

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({
    open,
    children,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
  }) => (open ? React.createElement("div", { "data-testid": "alert-dialog" }, children) : null),
  AlertDialogAction: ({
    children,
    onClick,
    disabled,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
  }) => React.createElement("button", { type: "button", onClick, disabled, className }, children),
  AlertDialogCancel: ({
    children,
    disabled,
  }: {
    children: React.ReactNode;
    disabled?: boolean;
  }) => React.createElement("button", { type: "button", disabled }, children),
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => React.createElement("div", {}, children),
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => React.createElement("p", {}, children),
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => React.createElement("div", {}, children),
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => React.createElement("div", {}, children),
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => React.createElement("h3", {}, children),
}));

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

function renderDialog(overrides?: { depenses?: Depense[]; open?: boolean }) {
  const Wrapper = createWrapper();
  return render(
    <APayerPlusTardDialog
      open={overrides?.open ?? true}
      onOpenChange={mockOnOpenChange}
      depenses={overrides?.depenses ?? DEPENSES}
      onEdit={mockOnEdit}
    />,
    { wrapper: Wrapper },
  );
}

describe("APayerPlusTardDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTresorerieDepenses.mockReturnValue({
      updateDepense: mockUpdateDepense,
      deleteDepense: mockDeleteDepense,
      isUpdating: false,
      isDeleting: false,
    });
  });

  it("affiche l'état vide quand aucune dépense n'est fournie", () => {
    renderDialog({ depenses: [] });

    expect(screen.getByText("À payer plus tard")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("Aucune dépense en attente")).toBeInTheDocument();
    expect(screen.getByText("Les dépenses suspendues apparaîtront ici.")).toBeInTheDocument();
  });

  it("affiche les dépenses et permet de modifier une dépense", () => {
    renderDialog();

    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Facture électricité")).toBeInTheDocument();
    expect(screen.getByText("Loyer bureau")).toBeInTheDocument();
    expect(screen.getByText("UTIL")).toBeInTheDocument();
    expect(screen.getByText("LOYER")).toBeInTheDocument();
    expect(screen.getByText("123.45 €")).toBeInTheDocument();
    expect(screen.getByText("980.00 €")).toBeInTheDocument();

    const editButtons = screen.getAllByRole("button", { name: /modifier/i });
    fireEvent.click(editButtons[0]);

    expect(mockOnEdit).toHaveBeenCalledTimes(1);
    expect(mockOnEdit).toHaveBeenCalledWith(DEPENSES[0]);
  });

  it("réactive une dépense avec une date sélectionnée et affiche un toast de succès", () => {
    renderDialog();

    const reactivateButtons = screen.getAllByRole("button", { name: /réactiver/i });
    fireEvent.click(reactivateButtons[0]);

    fireEvent.click(screen.getByRole("button", { name: "Choisir le 15 janvier 2026" }));
    fireEvent.click(screen.getByRole("button", { name: /confirmer/i }));

    expect(mockUpdateDepense).toHaveBeenCalledTimes(1);
    expect(mockUpdateDepense).toHaveBeenCalledWith({
      id: "dep-1",
      updates: {
        date_prevue: "2026-01-15",
        statut: "en_attente",
      },
    });

    expect(mockToast).toHaveBeenCalledWith({
      title: "Dépense réactivée",
      description: "Prévue pour le 15 janvier 2026",
    });
  });

  it("supprime une dépense après confirmation", () => {
    renderDialog();

    const deleteButtons = screen.getAllByRole("button", { name: /supprimer/i });
    fireEvent.click(deleteButtons[0]);

    const alertDialog = screen.getByTestId("alert-dialog");
    expect(within(alertDialog).getByText("Supprimer cette dépense ?")).toBeInTheDocument();
    expect(
      within(alertDialog).getByText("Cette action est irréversible. La dépense sera définitivement supprimée."),
    ).toBeInTheDocument();

    const confirmDeleteButton = within(alertDialog).getAllByRole("button", { name: /supprimer/i })[0];
    fireEvent.click(confirmDeleteButton);

    expect(mockDeleteDepense).toHaveBeenCalledTimes(1);
    expect(mockDeleteDepense).toHaveBeenCalledWith("dep-1");
  });

  it("désactive les actions pendant le chargement de mise à jour", () => {
    mockUseTresorerieDepenses.mockReturnValue({
      updateDepense: mockUpdateDepense,
      deleteDepense: mockDeleteDepense,
      isUpdating: true,
      isDeleting: false,
    });

    renderDialog();

    const editButtons = screen.getAllByRole("button", { name: /modifier/i });
    const reactivateButtons = screen.getAllByRole("button", { name: /réactiver/i });
    const deleteButtons = screen.getAllByRole("button", { name: /supprimer/i });

    expect(editButtons[0]).toBeDisabled();
    expect(reactivateButtons[0]).toBeDisabled();
    expect(deleteButtons[0]).toBeDisabled();
  });

  it("désactive les contrôles de suppression pendant le chargement de suppression", () => {
    mockUseTresorerieDepenses.mockReturnValue({
      updateDepense: mockUpdateDepense,
      deleteDepense: mockDeleteDepense,
      isUpdating: false,
      isDeleting: true,
    });

    renderDialog();

    const deleteButtons = screen.getAllByRole("button", { name: /supprimer/i });
    expect(deleteButtons[0]).toBeDisabled();
  });
});