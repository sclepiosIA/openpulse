/* @vitest-environment jsdom */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextcloudImportDialog } from "./NextcloudImportDialog";

const {
  invokeEdgeMock,
  toastSuccessMock,
  toastErrorMock,
  onOpenChangeMock,
} = vi.hoisted(() => ({
  invokeEdgeMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
  onOpenChangeMock: vi.fn(),
}));

vi.mock("@/services/edgeFunctions", () => ({
  invokeEdge: invokeEdgeMock,
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    open,
    children,
    onOpenChange,
  }: {
    open: boolean;
    children: React.ReactNode;
    onOpenChange: (open: boolean) => void;
  }) => (
    <div data-testid="dialog-root" data-open={String(open)}>
      <button type="button" onClick={() => onOpenChange(false)}>
        dialog-close
      </button>
      {open ? children : null}
    </div>
  ),
  DialogContent: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <h1 className={className}>{children}</h1>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    variant,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: string;
    className?: string;
  }) => (
    <button type="button" data-variant={variant} className={className} onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/progress", () => ({
  Progress: ({ value, className }: { value?: number; className?: string }) => (
    <div data-testid="progress" data-value={value === undefined ? "indeterminate" : String(value)} className={className} />
  ),
}));

vi.mock("lucide-react", () => ({
  Cloud: () => <svg data-testid="icon-cloud" />,
  CheckCircle2: () => <svg data-testid="icon-check" />,
  AlertCircle: () => <svg data-testid="icon-alert" />,
  Loader2: () => <svg data-testid="icon-loader" />,
  FolderDown: () => <svg data-testid="icon-folder-down" />,
}));

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function renderDialog() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

  const view = render(
    <NextcloudImportDialog open={true} onOpenChange={onOpenChangeMock} />,
    { wrapper: createWrapper(queryClient) }
  );

  return { ...view, queryClient, invalidateSpy };
}

describe("NextcloudImportDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche l'état initial puis lance un import et montre le succès avec les valeurs métier réelles", async () => {
    const user = userEvent.setup();

    invokeEdgeMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              foldersCreated: 3,
              documentsCreated: 12,
              skipped: 2,
              errors: ["Fichier ignoré", "Dossier inaccessible"],
            });
          }, 20);
        })
    );

    const { invalidateSpy } = renderDialog();

    expect(screen.getByText("Importer depuis Nextcloud")).toBeInTheDocument();
    expect(screen.getByText("Cette action va :")).toBeInTheDocument();
    expect(screen.getByText("Lancer l'import")).toBeInTheDocument();

    await user.click(screen.getByText("Lancer l'import"));

    expect(screen.getByText("Import en cours…")).toBeInTheDocument();
    expect(screen.getByText("Parcours de l'arborescence Nextcloud")).toBeInTheDocument();
    expect(screen.getByTestId("progress")).toHaveAttribute("data-value", "indeterminate");

    await waitFor(() => {
      expect(screen.getByText("Import terminé avec succès")).toBeInTheDocument();
    });

    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Dossiers créés")).toBeInTheDocument();
    expect(screen.getByText("Documents importés")).toBeInTheDocument();
    expect(screen.getByText("Ignorés")).toBeInTheDocument();
    expect(screen.getByText("2 erreur(s)")).toBeInTheDocument();
    expect(screen.getByText("• Fichier ignoré")).toBeInTheDocument();
    expect(screen.getByText("• Dossier inaccessible")).toBeInTheDocument();

    expect(invokeEdgeMock).toHaveBeenCalledWith("nextcloud-import");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["documents"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["folders"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["folder-tree"] });
    expect(toastSuccessMock).toHaveBeenCalledWith("Import terminé : 12 documents, 3 dossiers");
    expect(toastErrorMock).not.toHaveBeenCalled();

    await user.click(screen.getByText("Fermer"));

    expect(onOpenChangeMock).toHaveBeenCalledWith(false);
  });

  it("passe en erreur si invokeEdge renvoie un objet avec error et permet de fermer", async () => {
    const user = userEvent.setup();

    invokeEdgeMock.mockResolvedValue({
      error: "Import impossible",
    });

    renderDialog();

    await user.click(screen.getByText("Lancer l'import"));

    await waitFor(() => {
      expect(screen.getByText("Erreur lors de l'import")).toBeInTheDocument();
    });

    expect(screen.getByText("Import impossible")).toBeInTheDocument();
    expect(toastErrorMock).toHaveBeenCalledWith("Erreur lors de l'import Nextcloud");
    expect(toastSuccessMock).not.toHaveBeenCalled();

    await user.click(screen.getByText("Fermer"));

    expect(onOpenChangeMock).toHaveBeenCalledWith(false);
  });

  it("réessaie après une erreur et réussit au second essai", async () => {
    const user = userEvent.setup();

    invokeEdgeMock
      .mockRejectedValueOnce(new Error("Panne réseau"))
      .mockResolvedValueOnce({
        foldersCreated: 1,
        documentsCreated: 4,
        skipped: 0,
        errors: [],
      });

    const { invalidateSpy } = renderDialog();

    await user.click(screen.getByText("Lancer l'import"));

    await waitFor(() => {
      expect(screen.getByText("Erreur lors de l'import")).toBeInTheDocument();
    });

    expect(screen.getByText("Panne réseau")).toBeInTheDocument();

    await user.click(screen.getByText("Réessayer"));

    await waitFor(() => {
      expect(screen.getByText("Import terminé avec succès")).toBeInTheDocument();
    });

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(invokeEdgeMock).toHaveBeenNthCalledWith(1, "nextcloud-import");
    expect(invokeEdgeMock).toHaveBeenNthCalledWith(2, "nextcloud-import");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["documents"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["folders"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["folder-tree"] });
    expect(toastSuccessMock).toHaveBeenCalledWith("Import terminé : 4 documents, 1 dossiers");
  });

  it("empêche la fermeture pendant l'import", async () => {
    const user = userEvent.setup();

    let resolveImport: ((value: unknown) => void) | undefined;
    invokeEdgeMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveImport = resolve;
        })
    );

    renderDialog();

    await user.click(screen.getByText("Lancer l'import"));

    expect(screen.getByText("Import en cours…")).toBeInTheDocument();

    await user.click(screen.getByText("dialog-close"));

    expect(onOpenChangeMock).not.toHaveBeenCalled();

    if (resolveImport) {
      resolveImport({
        foldersCreated: 2,
        documentsCreated: 5,
        skipped: 1,
        errors: [],
      });
    }

    await waitFor(() => {
      expect(screen.getByText("Import terminé avec succès")).toBeInTheDocument();
    });
  });
});