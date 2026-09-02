/* @vitest-environment jsdom */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MoveToFolderDialog } from "./MoveToFolderDialog";

const {
  ROOT_FOLDERS,
  CHILD_FOLDERS,
  BREADCRUMB_CHILD,
  mockUseFolders,
  mockUseFolderBreadcrumb,
  mockUseMoveToFolder,
  mutateSpy,
} = vi.hoisted(() => {
  const ROOT_FOLDERS = [
    { id: "f1", name: "Projets", color: "blue" },
    { id: "f2", name: "Archives", color: null },
  ];
  const CHILD_FOLDERS = [
    { id: "f3", name: "2024", color: "green" },
  ];
  const BREADCRUMB_CHILD = [{ id: "f1", name: "Projets" }];

  return {
    ROOT_FOLDERS,
    CHILD_FOLDERS,
    BREADCRUMB_CHILD,
    mockUseFolders: vi.fn(),
    mockUseFolderBreadcrumb: vi.fn(),
    mockUseMoveToFolder: vi.fn(),
    mutateSpy: vi.fn(),
  };
});

vi.mock("lucide-react", () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon" {...props} />;
  return {
    FolderInput: Icon,
    FolderOpen: Icon,
    ChevronRight: Icon,
    Home: Icon,
    Loader2: Icon,
  };
});

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="dialog-root">{children}</div> : null,
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 className={className}>{children}</h2>
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    type,
    variant,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    type?: "button" | "submit" | "reset";
    variant?: string;
  }) => (
    <button type={type} data-variant={variant} onClick={onClick} disabled={disabled}>
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

vi.mock("@/lib/utils", () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
}));

vi.mock("@/hooks/documents/useFolders", () => ({
  useFolders: (folderId: string | null) => mockUseFolders(folderId),
  useMoveToFolder: () => mockUseMoveToFolder(),
  useFolderBreadcrumb: (folderId: string | null) => mockUseFolderBreadcrumb(folderId),
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

describe("MoveToFolderDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseFolders.mockImplementation((folderId: string | null) => {
      if (folderId === "f1") {
        return { folders: CHILD_FOLDERS, isLoading: false };
      }
      return { folders: ROOT_FOLDERS, isLoading: false };
    });

    mockUseFolderBreadcrumb.mockImplementation((folderId: string | null) => {
      if (folderId === "f1") {
        return { data: BREADCRUMB_CHILD };
      }
      return { data: [] };
    });

    mockUseMoveToFolder.mockReturnValue({
      mutate: mutateSpy,
      isPending: false,
    });
  });

  it("affiche le chargement puis la liste des dossiers et les textes métier", () => {
    mockUseFolders.mockReturnValueOnce({ folders: ROOT_FOLDERS, isLoading: true });

    const Wrapper = createWrapper();

    const { rerender } = render(
      <MoveToFolderDialog
        open
        onOpenChange={vi.fn()}
        documentId="doc1"
        documentName="Contrat"
        currentFolderId={null}
      />,
      { wrapper: Wrapper }
    );

    expect(screen.getByText("Déplacer le document")).toBeInTheDocument();
    expect(screen.getByText('Sélectionnez le dossier de destination pour "Contrat"')).toBeInTheDocument();
    expect(screen.getByText("Racine")).toBeInTheDocument();
    expect(screen.getByText("Destination :")).toBeInTheDocument();
    expect(screen.getByText("Déplacer ici")).toBeInTheDocument();

    rerender(
      <MoveToFolderDialog
        open
        onOpenChange={vi.fn()}
        documentId="doc1"
        documentName="Contrat"
        currentFolderId={null}
      />
    );

    expect(screen.getByText("Projets")).toBeInTheDocument();
    expect(screen.getByText("Archives")).toBeInTheDocument();
    expect(screen.getByText("Racine (Mes documents)")).toBeInTheDocument();
  });

  it("permet de sélectionner un dossier puis de déclencher la mutation avec les vraies valeurs", () => {
    const onOpenChange = vi.fn();
    const Wrapper = createWrapper();

    render(
      <MoveToFolderDialog
        open
        onOpenChange={onOpenChange}
        documentId="doc42"
        documentName="Facture"
        currentFolderId={null}
      />,
      { wrapper: Wrapper }
    );

    fireEvent.click(screen.getByText("Projets"));

    expect(screen.getByText("Destination :")).toBeInTheDocument();
    expect(screen.getAllByText("Projets").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText("Déplacer ici"));

    expect(mutateSpy).toHaveBeenCalledTimes(1);
    expect(mutateSpy).toHaveBeenCalledWith(
      { documentId: "doc42", folderId: "f1" },
      expect.objectContaining({
        onSuccess: expect.any(Function),
      })
    );

    const secondArg = mutateSpy.mock.calls[0][1];
    if (secondArg && "onSuccess" in secondArg && typeof secondArg.onSuccess === "function") {
      secondArg.onSuccess();
    }

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("désactive le bouton si le dossier sélectionné est le dossier courant", () => {
    const Wrapper = createWrapper();

    render(
      <MoveToFolderDialog
        open
        onOpenChange={vi.fn()}
        documentId="doc9"
        documentName="Note"
        currentFolderId="f1"
      />,
      { wrapper: Wrapper }
    );

    fireEvent.click(screen.getByText("Projets"));

    expect(screen.getByRole("button", { name: "Déplacer ici" })).toBeDisabled();
  });

  it("navigue par double-clic dans un sous-dossier et met à jour le breadcrumb et la destination", () => {
    const Wrapper = createWrapper();

    render(
      <MoveToFolderDialog
        open
        onOpenChange={vi.fn()}
        documentId="doc7"
        documentName="Rapport"
        currentFolderId={null}
      />,
      { wrapper: Wrapper }
    );

    fireEvent.doubleClick(screen.getByText("Projets"));

    expect(mockUseFolders).toHaveBeenLastCalledWith("f1");
    expect(screen.getByText("2024")).toBeInTheDocument();
    expect(screen.getAllByText("Projets").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText("Projets"));

    expect(screen.getByText("Destination :")).toBeInTheDocument();
    expect(screen.getAllByText("Projets").length).toBeGreaterThan(0);
  });

  it("affiche l'état vide pour un dossier sans sous-dossiers", () => {
    mockUseFolders.mockImplementation((folderId: string | null) => {
      if (folderId === "f1") {
        return { folders: [], isLoading: false };
      }
      return { folders: ROOT_FOLDERS, isLoading: false };
    });
    mockUseFolderBreadcrumb.mockImplementation((folderId: string | null) => {
      if (folderId === "f1") {
        return { data: BREADCRUMB_CHILD };
      }
      return { data: [] };
    });

    const Wrapper = createWrapper();

    render(
      <MoveToFolderDialog
        open
        onOpenChange={vi.fn()}
        documentId="doc10"
        documentName="Plan"
        currentFolderId={null}
      />,
      { wrapper: Wrapper }
    );

    fireEvent.doubleClick(screen.getByText("Projets"));

    expect(screen.getByText("Aucun sous-dossier")).toBeInTheDocument();
    expect(screen.getByText("Ce dossier ne contient pas de sous-dossiers")).toBeInTheDocument();
  });
});