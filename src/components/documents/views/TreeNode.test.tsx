import React from "react";
import { render, fireEvent, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/utils", () => ({
  cn: (...args: Array<unknown>) => args.filter(Boolean).join(" "),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({
    children,
    ...props
  }: React.PropsWithChildren<{ className?: string; variant?: string }>) => (
    <span data-testid="badge" {...props}>
      {children}
    </span>
  ),
}));

const { shareIndicatorProps } = vi.hoisted(() => ({
  shareIndicatorProps: vi.fn<
    [
      {
        isRestricted: boolean;
        folderType?: string;
        sharedWith: Array<unknown>;
        variant?: string;
      },
    ]
  >(),
}));

vi.mock("@/components/documents/folders/FolderShareIndicator", () => ({
  FolderShareIndicator: (props: {
    isRestricted: boolean;
    folderType?: string;
    sharedWith: Array<unknown>;
    variant?: string;
  }) => {
    shareIndicatorProps(props);
    return <span data-testid="share-indicator" />;
  },
}));

vi.mock("lucide-react", () => ({
  ChevronRight: (props: Record<string, unknown>) => (
    <svg data-testid="chevron-right" {...props} />
  ),
  ChevronDown: (props: Record<string, unknown>) => (
    <svg data-testid="chevron-down" {...props} />
  ),
  Folder: (props: Record<string, unknown>) => (
    <svg data-testid="folder-icon" {...props} />
  ),
  FolderOpen: (props: Record<string, unknown>) => (
    <svg data-testid="folder-open-icon" {...props} />
  ),
}));

import { TreeNode } from "./TreeNode";

type FolderTreeNodeLike = {
  id: string;
  name: string;
  color?: string | null;
  isExpanded: boolean;
  isRestricted?: boolean | null;
  folderType?: string | null;
  sharedWith?: Array<unknown> | null;
  documentsCount: number;
  children: FolderTreeNodeLike[];
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  return Wrapper;
}

describe("TreeNode", () => {
  it("rend le noeud, gère la sélection, le toggle, le compteur et l'indicateur de partage (succès)", () => {
    const node: FolderTreeNodeLike = {
      id: "f_root",
      name: "Racine",
      color: "rgb(1, 2, 3)",
      isExpanded: false,
      isRestricted: true,
      folderType: "shared",
      sharedWith: [{ userId: "u_1" }],
      documentsCount: 3,
      children: [
        {
          id: "f_child",
          name: "Enfant",
          color: null,
          isExpanded: false,
          isRestricted: false,
          folderType: "private",
          sharedWith: [],
          documentsCount: 0,
          children: [],
        },
      ],
    };

    const onSelect = vi.fn<(folderId: string | null) => void>();
    const onToggle = vi.fn<(folderId: string) => void>();

    const Wrapper = createWrapper();

    const { container } = render(
      <TreeNode
        node={node}
        level={2}
        selectedId={null}
        onSelect={onSelect}
        onToggle={onToggle}
      />,
      { wrapper: Wrapper }
    );

    expect(screen.getByText("Racine")).toBeTruthy();
    expect(screen.getByTestId("badge").textContent).toBe("3");
    expect(screen.getByTestId("chevron-right")).toBeTruthy();
    expect(screen.getByTestId("folder-icon")).toBeTruthy();

    const row = screen.getByText("Racine").closest("div");
    expect(row).toBeTruthy();
    expect((row as HTMLDivElement).style.paddingLeft).toBe("40px");

    expect(screen.getByTestId("share-indicator")).toBeTruthy();
    expect(shareIndicatorProps).toHaveBeenCalledTimes(1);
    expect(shareIndicatorProps).toHaveBeenCalledWith(
      expect.objectContaining({
        isRestricted: true,
        folderType: "shared",
        sharedWith: [{ userId: "u_1" }],
        variant: "mini",
      })
    );

    fireEvent.click(screen.getByText("Racine"));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("f_root");

    const toggleButton = container.querySelector("button");
    expect(toggleButton).toBeTruthy();
    fireEvent.click(toggleButton as HTMLButtonElement);
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith("f_root");
  });

  it("double-clic toggle uniquement si le noeud a des enfants", () => {
    const onSelect = vi.fn<(folderId: string | null) => void>();
    const onToggle = vi.fn<(folderId: string) => void>();
    const Wrapper = createWrapper();

    const withChildren: FolderTreeNodeLike = {
      id: "p1",
      name: "Parent",
      isExpanded: false,
      documentsCount: 0,
      children: [
        {
          id: "c1",
          name: "Child",
          isExpanded: false,
          documentsCount: 0,
          children: [],
        },
      ],
    };

    render(
      <TreeNode
        node={withChildren}
        level={0}
        selectedId={null}
        onSelect={onSelect}
        onToggle={onToggle}
      />,
      { wrapper: Wrapper }
    );

    fireEvent.doubleClick(screen.getByText("Parent"));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith("p1");
    expect(onSelect).toHaveBeenCalledTimes(0);
  });

  it("rend les enfants quand isExpanded=true et applique la classe de sélection", () => {
    const node: FolderTreeNodeLike = {
      id: "root2",
      name: "Root2",
      isExpanded: true,
      documentsCount: 0,
      folderType: "private",
      isRestricted: false,
      children: [
        {
          id: "child2",
          name: "Child2",
          isExpanded: false,
          documentsCount: 1,
          folderType: "private",
          isRestricted: false,
          children: [],
        },
      ],
    };

    const onSelect = vi.fn<(folderId: string | null) => void>();
    const onToggle = vi.fn<(folderId: string) => void>();
    const Wrapper = createWrapper();

    render(
      <TreeNode
        node={node}
        level={0}
        selectedId={"child2"}
        onSelect={onSelect}
        onToggle={onToggle}
      />,
      { wrapper: Wrapper }
    );

    expect(screen.getByTestId("chevron-down")).toBeTruthy();
    expect(screen.getByTestId("folder-open-icon")).toBeTruthy();

    expect(screen.getByText("Child2")).toBeTruthy();
    const childRow = screen.getByText("Child2").closest("div");
    expect(childRow).toBeTruthy();
    expect((childRow as HTMLDivElement).className).toContain("bg-accent");

    const badges = screen.getAllByTestId("badge");
    expect(badges.map((b) => b.textContent)).toEqual(["1"]);
  });

  it("n'affiche pas le badge si documentsCount=0 et n'affiche pas l'indicateur si non partagé/non restreint", () => {
    shareIndicatorProps.mockClear();

    const node: FolderTreeNodeLike = {
      id: "n1",
      name: "NoDocs",
      isExpanded: false,
      documentsCount: 0,
      folderType: "private",
      isRestricted: false,
      sharedWith: [],
      children: [],
    };

    const onSelect = vi.fn<(folderId: string | null) => void>();
    const onToggle = vi.fn<(folderId: string) => void>();
    const Wrapper = createWrapper();

    render(
      <TreeNode
        node={node}
        level={1}
        selectedId={null}
        onSelect={onSelect}
        onToggle={onToggle}
      />,
      { wrapper: Wrapper }
    );

    expect(screen.queryByTestId("badge")).toBeNull();
    expect(screen.queryByTestId("share-indicator")).toBeNull();
    expect(shareIndicatorProps).toHaveBeenCalledTimes(0);
  });
});