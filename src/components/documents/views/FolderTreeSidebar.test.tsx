// @vitest-environment jsdom

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FolderTreeSidebar } from "./FolderTreeSidebar";

const {
  SHARED_FOLDERS,
  PERSONAL_FOLDERS,
  NEXTCLOUD_FOLDERS,
  AUTH_STATE,
  mockFrom,
  mockUseFolderTree,
  mockUseNextcloudStatus,
  mockUseNextcloudFolderTree,
  mockUseAuth,
  mockNavigate,
  mockToastSuccess,
  mockToastError,
} = vi.hoisted(() => ({
  SHARED_FOLDERS: [
    { id: "shared-1", name: "Equipe", children: [] },
    { id: "shared-2", name: "Projet", children: [] },
  ],
  PERSONAL_FOLDERS: [
    { id: "personal-1", name: "Perso", children: [] },
  ],
  NEXTCLOUD_FOLDERS: [
    { id: "nc-1", name: "NC Docs", path: "/Docs", children: [] },
    { id: "nc-2", name: "NC Photos", path: "/Photos", children: [] },
  ],
  AUTH_STATE: {
    user: { id: "u1", email: "user@test.dev" },
    session: { user: { id: "u1" } },
    isLoading: false,
  },
  mockFrom: vi.fn(),
  mockUseFolderTree: vi.fn(),
  mockUseNextcloudStatus: vi.fn(),
  mockUseNextcloudFolderTree: vi.fn(),
  mockUseAuth: vi.fn(),
  mockNavigate: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

function createBuilder() {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    gt: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lt: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
    then: (onFulfilled: (value: { data: null; error: null }) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).catch(onRejected),
  };
  return builder;
}

mockFrom.mockImplementation(() => createBuilder());

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getSession: vi.fn(async () => ({ data: { session: AUTH_STATE.session }, error: null })),
      getUser: vi.fn(async () => ({ data: { user: AUTH_STATE.user }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: mockUseAuth,
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: mockUseAuth,
  AuthProvider: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: mockUseAuth,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock("@/lib/utils", () => ({
  cn: (...args: Array<string | false | null | undefined>) => args.filter(Boolean).join(" "),
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) =>
    React.createElement("div", { "data-testid": "scroll-area", className }, children),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    title,
    className,
    "aria-label": ariaLabel,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    title?: string;
    className?: string;
    "aria-label"?: string;
  }) =>
    React.createElement(
      "button",
      { type: "button", onClick, title, className, "aria-label": ariaLabel },
      children
    ),
}));

vi.mock("@/components/ui/collapsible", () => ({
  Collapsible: ({ children, className }: { children: React.ReactNode; className?: string }) =>
    React.createElement("div", { className }, children),
  CollapsibleTrigger: ({ children, className }: { children: React.ReactNode; className?: string }) =>
    React.createElement("button", { type: "button", className }, children),
  CollapsibleContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
}));

vi.mock("./TreeNode", () => ({
  TreeNode: ({
    node,
    selectedId,
    onSelect,
    onToggle,
  }: {
    node: { id: string; name: string };
    selectedId: string | null;
    onSelect: (folderId: string | null) => void;
    onToggle: (id: string) => void;
  }) =>
    React.createElement(
      "div",
      null,
      React.createElement(
        "button",
        {
          type: "button",
          "data-testid": `tree-node-${node.id}`,
          "data-selected": selectedId === node.id ? "true" : "false",
          onClick: () => onSelect(node.id),
        },
        node.name
      ),
      React.createElement(
        "button",
        {
          type: "button",
          "data-testid": `toggle-node-${node.id}`,
          onClick: () => onToggle(node.id),
        },
        `toggle-${node.name}`
      )
    ),
}));

vi.mock("./NextcloudTreeNode", () => ({
  NextcloudTreeNode: ({
    node,
    selectedId,
    onSelect,
  }: {
    node: { id: string; name: string };
    selectedId: string | null;
    onSelect: (folderId: string | null) => void;
  }) =>
    React.createElement(
      "button",
      {
        type: "button",
        "data-testid": `nextcloud-node-${node.id}`,
        "data-selected": selectedId === node.id ? "true" : "false",
        onClick: () => onSelect(node.id),
      },
      node.name
    ),
}));

vi.mock("@/hooks/documents/useFolderTree", () => ({
  useFolderTree: mockUseFolderTree,
}));

vi.mock("@/hooks/documents/useNextcloudFiles", () => ({
  useNextcloudStatus: mockUseNextcloudStatus,
}));

vi.mock("@/hooks/documents/useNextcloudFolderTree", () => ({
  useNextcloudFolderTree: mockUseNextcloudFolderTree,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("FolderTreeSidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue(AUTH_STATE);
    mockUseFolderTree.mockReturnValue({
      sharedFolders: SHARED_FOLDERS,
      personalFolders: PERSONAL_FOLDERS,
      isLoading: false,
      expandedIds: new Set<string>(["shared-1"]),
      toggleExpand: vi.fn(),
      expandAll: vi.fn(),
      collapseAll: vi.fn(),
    });
    mockUseNextcloudStatus.mockReturnValue({
      data: { connected: true },
      isLoading: false,
      isError: false,
      error: null,
    });
    mockUseNextcloudFolderTree.mockReturnValue({
      tree: NEXTCLOUD_FOLDERS,
      isLoading: false,
      isError: false,
      error: null,
    });
  });

  it("affiche un loader pendant le chargement principal", () => {
    mockUseFolderTree.mockReturnValue({
      sharedFolders: SHARED_FOLDERS,
      personalFolders: PERSONAL_FOLDERS,
      isLoading: true,
      expandedIds: new Set<string>(),
      toggleExpand: vi.fn(),
      expandAll: vi.fn(),
      collapseAll: vi.fn(),
    });

    render(
      <FolderTreeSidebar
        selectedFolderId={null}
        onFolderSelect={vi.fn()}
      />
    );

    expect(screen.queryByText("Dossiers")).not.toBeInTheDocument();
    expect(screen.queryByText("Mes documents")).not.toBeInTheDocument();
    expect(document.querySelector(".animate-spin")).toBeTruthy();
  });

  it("affiche les sections métier et permet la sélection des dossiers", () => {
    const onFolderSelect = vi.fn();

    render(
      <FolderTreeSidebar
        selectedFolderId={null}
        onFolderSelect={onFolderSelect}
        className="custom-sidebar"
      />
    );

    expect(screen.getByText("Dossiers")).toBeInTheDocument();
    expect(screen.getByText("Mes documents")).toBeInTheDocument();
    expect(screen.getByText("Espaces partagés")).toBeInTheDocument();
    expect(screen.getByText("Mes dossiers")).toBeInTheDocument();
    expect(screen.getByText("Serveur Nextcloud")).toBeInTheDocument();
    expect(screen.getByText("Racine Nextcloud")).toBeInTheDocument();
    expect(screen.getByTestId("tree-node-shared-1")).toHaveTextContent("Equipe");
    expect(screen.getByTestId("tree-node-personal-1")).toHaveTextContent("Perso");
    expect(screen.getByTestId("nextcloud-node-nc-1")).toHaveTextContent("NC Docs");

    fireEvent.click(screen.getByText("Mes documents"));
    expect(onFolderSelect).toHaveBeenCalledWith(null);

    fireEvent.click(screen.getByTestId("tree-node-shared-1"));
    expect(onFolderSelect).toHaveBeenCalledWith("shared-1");

    fireEvent.click(screen.getByText("Racine Nextcloud"));
    expect(onFolderSelect).toHaveBeenCalledWith("nextcloud:/");
  });

  it("déclenche collapseAll si des noeuds sont étendus, sinon expandAll", async () => {
    const collapseAll = vi.fn();
    const expandAll = vi.fn();

    mockUseFolderTree.mockReturnValue({
      sharedFolders: SHARED_FOLDERS,
      personalFolders: PERSONAL_FOLDERS,
      isLoading: false,
      expandedIds: new Set<string>(["shared-1"]),
      toggleExpand: vi.fn(),
      expandAll,
      collapseAll,
    });

    const { rerender } = render(
      <FolderTreeSidebar
        selectedFolderId={null}
        onFolderSelect={vi.fn()}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Déplier"));
    });

    expect(collapseAll).toHaveBeenCalledTimes(1);
    expect(expandAll).not.toHaveBeenCalled();

    mockUseFolderTree.mockReturnValue({
      sharedFolders: SHARED_FOLDERS,
      personalFolders: PERSONAL_FOLDERS,
      isLoading: false,
      expandedIds: new Set<string>(),
      toggleExpand: vi.fn(),
      expandAll,
      collapseAll,
    });

    rerender(
      <FolderTreeSidebar
        selectedFolderId={null}
        onFolderSelect={vi.fn()}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Déplier"));
    });

    expect(expandAll).toHaveBeenCalledTimes(1);
  });

  it("affiche le chargement Nextcloud puis les dossiers Nextcloud", async () => {
    mockUseNextcloudFolderTree.mockReturnValue({
      tree: NEXTCLOUD_FOLDERS,
      isLoading: true,
      isError: false,
      error: null,
    });

    const { rerender } = render(
      <FolderTreeSidebar
        selectedFolderId="nextcloud:/"
        onFolderSelect={vi.fn()}
      />
    );

    expect(screen.getByText("Racine Nextcloud")).toBeInTheDocument();
    expect(document.querySelectorAll(".animate-spin").length).toBeGreaterThan(0);
    expect(screen.queryByTestId("nextcloud-node-nc-1")).not.toBeInTheDocument();

    mockUseNextcloudFolderTree.mockReturnValue({
      tree: NEXTCLOUD_FOLDERS,
      isLoading: false,
      isError: false,
      error: null,
    });

    rerender(
      <FolderTreeSidebar
        selectedFolderId="nextcloud:/"
        onFolderSelect={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("nextcloud-node-nc-1")).toBeInTheDocument();
      expect(screen.getByTestId("nextcloud-node-nc-2")).toBeInTheDocument();
    });
  });

  it("affiche l'état vide si aucun dossier ni connexion Nextcloud", () => {
    mockUseFolderTree.mockReturnValue({
      sharedFolders: [],
      personalFolders: [],
      isLoading: false,
      expandedIds: new Set<string>(),
      toggleExpand: vi.fn(),
      expandAll: vi.fn(),
      collapseAll: vi.fn(),
    });
    mockUseNextcloudStatus.mockReturnValue({
      data: { connected: false },
      isLoading: false,
      isError: false,
      error: null,
    });
    mockUseNextcloudFolderTree.mockReturnValue({
      tree: [],
      isLoading: false,
      isError: false,
      error: null,
    });

    render(
      <FolderTreeSidebar
        selectedFolderId={null}
        onFolderSelect={vi.fn()}
      />
    );

    expect(screen.getByText("Aucun dossier")).toBeInTheDocument();
    expect(screen.queryByText("Serveur Nextcloud")).not.toBeInTheDocument();
    expect(screen.queryByText("Espaces partagés")).not.toBeInTheDocument();
    expect(screen.queryByText("Mes dossiers")).not.toBeInTheDocument();
  });

  it("expose un scénario d'erreur via renderHook avec QueryClientProvider", async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(
      () => mockUseNextcloudStatus(),
      { wrapper }
    );

    expect(result.current.isError).toBe(false);

    mockUseNextcloudStatus.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      error: { message: "x" },
    });

    const errored = renderHook(
      () => mockUseNextcloudStatus(),
      { wrapper }
    );

    await waitFor(() => {
      expect(errored.result.current.isError).toBe(true);
      expect(errored.result.current.error).toEqual({ message: "x" });
      expect(errored.result.current.data).toBeNull();
    });
  });
});