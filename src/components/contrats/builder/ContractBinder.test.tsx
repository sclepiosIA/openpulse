// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ContractBinder } from "./ContractBinder";

const {
  sectionsData,
  updateMutate,
  deleteMutate,
  createMutateAsync,
  toastSuccess,
  confirmMock,
} = vi.hoisted(() => {
  const sectionsData = [
    {
      id: "root-1",
      contrat_id: "contract-1",
      parent_id: null,
      titre: "Chapitre 1",
      contenu_html: "<p>Contenu</p>",
      ordre: 1,
      type: "section",
      variables_values: {},
      metadata: {},
      is_locked: false,
      children: [
        {
          id: "child-1",
          contrat_id: "contract-1",
          parent_id: "root-1",
          titre: "Article A",
          contenu_html: "",
          ordre: 1,
          type: "article",
          variables_values: {},
          metadata: {},
          is_locked: true,
          children: [],
        },
      ],
    },
    {
      id: "root-2",
      contrat_id: "contract-1",
      parent_id: null,
      titre: "Annexe",
      contenu_html: "",
      ordre: 2,
      type: "annexe",
      variables_values: {},
      metadata: {},
      is_locked: false,
      children: [],
    },
  ];

  return {
    sectionsData,
    updateMutate: vi.fn(),
    deleteMutate: vi.fn(),
    createMutateAsync: vi.fn(),
    toastSuccess: vi.fn(),
    confirmMock: vi.fn(),
  };
});

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: ({
    value,
    onChange,
    onBlur,
    onKeyDown,
    autoFocus,
    className,
    onClick,
  }: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      autoFocus={autoFocus}
      className={className}
      onClick={onClick}
    />
  ),
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({
    children,
    asChild,
    onClick,
  }: {
    children: React.ReactNode;
    asChild?: boolean;
    onClick?: React.MouseEventHandler<HTMLElement>;
  }) =>
    asChild ? (
      React.cloneElement(children as React.ReactElement<{ onClick?: React.MouseEventHandler<HTMLElement> }>, {
        onClick,
      })
    ) : (
      <button onClick={onClick}>{children}</button>
    ),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onClick,
    className,
  }: {
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    className?: string;
  }) => (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr />,
}));

vi.mock("@/lib/utils", () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
}));

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: ({ className }: { className?: string }) => <div data-testid="skeleton" className={className} />,
}));

vi.mock("lucide-react", () => {
  const Icon =
    (name: string) =>
    ({ className }: { className?: string }) =>
      <svg data-testid={name} className={className} />;
  return {
    ChevronRight: Icon("chevron-right"),
    ChevronDown: Icon("chevron-down"),
    FileText: Icon("file-text"),
    Folder: Icon("folder"),
    FolderOpen: Icon("folder-open"),
    Plus: Icon("plus"),
    MoreHorizontal: Icon("more-horizontal"),
    Trash2: Icon("trash"),
    Copy: Icon("copy"),
    Edit2: Icon("edit"),
    Lock: Icon("lock"),
    Unlock: Icon("unlock"),
    GripVertical: Icon("grip"),
  };
});

vi.mock("@/hooks/contracts/useContractSections", () => ({
  useDeleteSection: () => ({
    mutate: deleteMutate,
  }),
  useUpdateSection: () => ({
    mutate: updateMutate,
  }),
  useCreateSection: () => ({
    mutateAsync: createMutateAsync,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccess,
    error: vi.fn(),
  },
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

describe("ContractBinder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    confirmMock.mockReturnValue(true);
    vi.stubGlobal("confirm", confirmMock);
  });

  it("affiche les skeletons pendant le chargement", () => {
    const Wrapper = createWrapper();

    render(
      <ContractBinder
        sections={[]}
        selectedId={null}
        onSelect={vi.fn()}
        onAddSection={vi.fn()}
        onReorder={vi.fn()}
        isLoading
      />,
      { wrapper: Wrapper }
    );

    expect(screen.getAllByTestId("skeleton")).toHaveLength(5);
    expect(screen.queryByText("Structure")).not.toBeInTheDocument();
  });

  it("affiche la structure, permet de sélectionner, développer, ajouter et renommer une section", async () => {
    const Wrapper = createWrapper();
    const onSelect = vi.fn();
    const onAddSection = vi.fn();

    render(
      <ContractBinder
        sections={sectionsData}
        selectedId={"root-2"}
        onSelect={onSelect}
        onAddSection={onAddSection}
        onReorder={vi.fn()}
      />,
      { wrapper: Wrapper }
    );

    expect(screen.getByText("Structure")).toBeInTheDocument();
    expect(screen.getByText("Chapitre 1")).toBeInTheDocument();
    expect(screen.getByText("Annexe")).toBeInTheDocument();
    expect(screen.queryByText("Article A")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Chapitre 1"));
    expect(onSelect).toHaveBeenCalledWith("root-1");

    fireEvent.click(screen.getByTestId("chevron-right"));
    expect(await screen.findByText("Article A")).toBeInTheDocument();

    const addButtons = screen.getAllByTestId("plus");
    fireEvent.click(addButtons[0].closest("button") as HTMLButtonElement);
    expect(onAddSection).toHaveBeenCalledWith();

    fireEvent.click(screen.getAllByText("Renommer")[0]);

    const input = screen.getByDisplayValue("Chapitre 1");
    fireEvent.change(input, { target: { value: "Chapitre principal" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(updateMutate).toHaveBeenCalledWith({
        id: "root-1",
        contrat_id: "contract-1",
        titre: "Chapitre principal",
      });
    });
  });

  it("verrouille/déverrouille, duplique et supprime une section avec les bonnes données métier", async () => {
    const Wrapper = createWrapper();

    createMutateAsync.mockResolvedValue({ data: { id: "new-1" }, error: null });

    render(
      <ContractBinder
        sections={sectionsData}
        selectedId={null}
        onSelect={vi.fn()}
        onAddSection={vi.fn()}
        onReorder={vi.fn()}
      />,
      { wrapper: Wrapper }
    );

    fireEvent.click(screen.getAllByText("Verrouiller")[0]);

    expect(updateMutate).toHaveBeenCalledWith({
      id: "root-1",
      contrat_id: "contract-1",
      is_locked: true,
    });

    fireEvent.click(screen.getAllByText("Dupliquer")[0]);

    await waitFor(() => {
      expect(createMutateAsync).toHaveBeenCalledWith({
        contrat_id: "contract-1",
        parent_id: null,
        titre: "Chapitre 1 (copie)",
        contenu_html: "<p>Contenu</p>",
        ordre: 3,
        type: "section",
        variables_values: {},
        metadata: {},
        is_locked: false,
      });
    });

    expect(toastSuccess).toHaveBeenCalledWith("Section dupliquée");

    fireEvent.click(screen.getAllByText("Supprimer")[0]);

    expect(confirmMock).toHaveBeenCalledWith('Supprimer "Chapitre 1" et tous ses sous-éléments ?');
    expect(deleteMutate).toHaveBeenCalledWith({
      id: "root-1",
      contrat_id: "contract-1",
    });
  });

  it("gère l'erreur de duplication sans toast de succès", async () => {
    const Wrapper = createWrapper();

    createMutateAsync.mockRejectedValue(new Error("x"));

    render(
      <ContractBinder
        sections={sectionsData}
        selectedId={null}
        onSelect={vi.fn()}
        onAddSection={vi.fn()}
        onReorder={vi.fn()}
      />,
      { wrapper: Wrapper }
    );

    fireEvent.click(screen.getAllByText("Dupliquer")[0]);

    await waitFor(() => {
      expect(createMutateAsync).toHaveBeenCalledTimes(1);
    });

    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("affiche l'état vide et permet d'ajouter une section", () => {
    const Wrapper = createWrapper();
    const onAddSection = vi.fn();

    render(
      <ContractBinder
        sections={[]}
        selectedId={null}
        onSelect={vi.fn()}
        onAddSection={onAddSection}
        onReorder={vi.fn()}
      />,
      { wrapper: Wrapper }
    );

    expect(screen.getByText("Aucune section")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Ajouter une section"));
    expect(onAddSection).toHaveBeenCalledWith();
  });
});