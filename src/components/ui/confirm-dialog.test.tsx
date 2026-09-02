// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConfirmDialog } from "./confirm-dialog";

const {
  mockAlertDialog,
  mockAlertDialogContent,
  mockAlertDialogHeader,
  mockAlertDialogTitle,
  mockAlertDialogDescription,
  mockAlertDialogFooter,
  mockAlertDialogCancel,
  mockAlertDialogAction,
  mockLoader2,
} = vi.hoisted(() => ({
  mockAlertDialog: vi.fn(),
  mockAlertDialogContent: vi.fn(),
  mockAlertDialogHeader: vi.fn(),
  mockAlertDialogTitle: vi.fn(),
  mockAlertDialogDescription: vi.fn(),
  mockAlertDialogFooter: vi.fn(),
  mockAlertDialogCancel: vi.fn(),
  mockAlertDialogAction: vi.fn(),
  mockLoader2: vi.fn(),
}));

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode }) => {
    mockAlertDialog({ open, onOpenChange });
    return (
      <div data-testid="alert-dialog" data-open={String(open)}>
        {children}
      </div>
    );
  },
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => {
    mockAlertDialogContent();
    return <div data-testid="alert-dialog-content">{children}</div>;
  },
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => {
    mockAlertDialogHeader();
    return <div data-testid="alert-dialog-header">{children}</div>;
  },
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => {
    mockAlertDialogTitle();
    return <h1>{children}</h1>;
  },
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => {
    mockAlertDialogDescription();
    return <p>{children}</p>;
  },
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => {
    mockAlertDialogFooter();
    return <div data-testid="alert-dialog-footer">{children}</div>;
  },
  AlertDialogCancel: ({
    children,
    disabled,
  }: {
    children: React.ReactNode;
    disabled?: boolean;
  }) => {
    mockAlertDialogCancel({ disabled });
    return (
      <button type="button" data-testid="cancel-button" disabled={disabled}>
        {children}
      </button>
    );
  },
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
  }) => {
    mockAlertDialogAction({ disabled, className, onClick });
    return (
      <button
        type="button"
        data-testid="confirm-button"
        disabled={disabled}
        className={className}
        onClick={onClick}
      >
        {children}
      </button>
    );
  },
}));

vi.mock("lucide-react", () => ({
  Loader2: (props: { className?: string }) => {
    mockLoader2(props);
    return <svg data-testid="loader-icon" className={props.className} />;
  },
}));

describe("ConfirmDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rend le titre, la description et les libellés par défaut", () => {
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();

    render(
      <ConfirmDialog
        open={true}
        onOpenChange={onOpenChange}
        title="Supprimer l'élément"
        description="Cette action est irréversible."
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByTestId("alert-dialog")).toHaveAttribute("data-open", "true");
    expect(screen.getByText("Supprimer l'élément")).toBeInTheDocument();
    expect(screen.getByText("Cette action est irréversible.")).toBeInTheDocument();
    expect(screen.getByTestId("cancel-button")).toHaveTextContent("Annuler");
    expect(screen.getByTestId("confirm-button")).toHaveTextContent("Confirmer");
    expect(mockAlertDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        open: true,
        onOpenChange,
      }),
    );
  });

  it("appelle onConfirm au clic sur le bouton de confirmation", () => {
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();

    render(
      <ConfirmDialog
        open={true}
        onOpenChange={onOpenChange}
        title="Archiver"
        description="Confirmez l'archivage."
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByTestId("confirm-button"));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(mockAlertDialogAction).toHaveBeenCalledWith(
      expect.objectContaining({
        disabled: false,
        className: "",
        onClick: onConfirm,
      }),
    );
  });

  it("utilise les textes personnalisés et applique la variante destructive", () => {
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();

    render(
      <ConfirmDialog
        open={true}
        onOpenChange={onOpenChange}
        title="Supprimer"
        description="Confirmez la suppression."
        confirmText="Oui, supprimer"
        cancelText="Non, garder"
        variant="destructive"
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByTestId("cancel-button")).toHaveTextContent("Non, garder");
    expect(screen.getByTestId("confirm-button")).toHaveTextContent("Oui, supprimer");
    expect(screen.getByTestId("confirm-button")).toHaveClass(
      "bg-destructive",
      "text-destructive-foreground",
      "hover:bg-destructive/90",
    );
    expect(mockAlertDialogAction).toHaveBeenCalledWith(
      expect.objectContaining({
        className: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      }),
    );
  });

  it("désactive les actions et affiche le loader pendant le chargement", () => {
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();

    render(
      <ConfirmDialog
        open={true}
        onOpenChange={onOpenChange}
        title="Traitement"
        description="Veuillez patienter."
        onConfirm={onConfirm}
        loading={true}
      />,
    );

    expect(screen.getByTestId("cancel-button")).toBeDisabled();
    expect(screen.getByTestId("confirm-button")).toBeDisabled();
    expect(screen.getByTestId("loader-icon")).toBeInTheDocument();
    expect(mockLoader2).toHaveBeenCalledWith({
      className: "h-4 w-4 mr-2 animate-spin",
    });

    fireEvent.click(screen.getByTestId("confirm-button"));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("rend correctement quand open est false", () => {
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();

    render(
      <ConfirmDialog
        open={false}
        onOpenChange={onOpenChange}
        title="Fermer"
        description="Dialogue fermé."
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByTestId("alert-dialog")).toHaveAttribute("data-open", "false");
    expect(screen.getByText("Fermer")).toBeInTheDocument();
    expect(screen.getByText("Dialogue fermé.")).toBeInTheDocument();
  });
});