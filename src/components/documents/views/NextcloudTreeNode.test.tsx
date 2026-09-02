// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextcloudTreeNode } from "./NextcloudTreeNode";

const {
  ROOT_NODE,
  ROOT_PATH,
  ROOT_CHILDREN_DATA,
  EMPTY_CHILDREN_DATA,
  LOADING_CHILDREN_DATA,
  ERROR_CHILDREN_DATA,
  CHILD_PATH,
  CHILD_ID,
  mockUseNextcloudFolderContents,
  mockCreateNextcloudFolderId,
  mockGetNextcloudPathFromId,
  mockCn,
  mockFrom,
} = vi.hoisted(() => {
  const ROOT_PATH = "/root";
  const CHILD_PATH = "/root/sub1";
  const CHILD_ID = "nc:/root/sub1";

  return {
    ROOT_NODE: {
      id: "nc:/root",
      name: "Root folder",
      parentId: null,
      folderType: "personal",
      icon: null,
      color: null,
      documentsCount: 0,
      subfoldersCount: 1,
      isExpanded: false,
      isLoading: false,
      children: [],
      nextcloudPath: ROOT_PATH,
      isNextcloud: true,
    },
    ROOT_PATH,
    ROOT_CHILDREN_DATA: {
      folders: [{ name: "Sub folder", path: CHILD_PATH }],
    },
    EMPTY_CHILDREN_DATA: {
      folders: [],
    },
    LOADING_CHILDREN_DATA: undefined,
    ERROR_CHILDREN_DATA: null,
    mockUseNextcloudFolderContents: vi.fn(),
    mockCreateNextcloudFolderId: vi.fn((path: string) => `nc:${path}`),
    mockGetNextcloudPathFromId: vi.fn((id: string) => {
      if (id === "nc:/root") return ROOT_PATH;
      if (id === CHILD_ID) return CHILD_PATH;
      return null;
    }),
    mockCn: vi.fn((...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ")),
    mockFrom: vi.fn(),
  };
});

vi.mock("@/lib/utils", () => ({
  cn: mockCn,
}));

vi.mock("@/hooks/documents/useNextcloudFolderTree", () => ({
  useNextcloudFolderContents: mockUseNextcloudFolderContents,
  createNextcloudFolderId: mockCreateNextcloudFolderId,
  getNextcloudPathFromId: mockGetNextcloudPathFromId,
}));

vi.mock("@/integrations/supabase/client", () => {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
    then: (onFulfilled: (value: { data: null; error: null }) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).catch(onRejected),
  };

  mockFrom.mockReturnValue(builder);

  return {
    supabase: {
      from: mockFrom,
    },
  };
});

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

describe("NextcloudTreeNode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCn.mockImplementation((...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "));
    mockGetNextcloudPathFromId.mockImplementation((id: string) => {
      if (id === "nc:/root") return ROOT_PATH;
      if (id === CHILD_ID) return CHILD_PATH;
      return null;
    });
    mockCreateNextcloudFolderId.mockImplementation((path: string) => `nc:${path}`);
  });

  it("affiche le dossier, applique la sélection et appelle onSelect au clic", () => {
    mockUseNextcloudFolderContents.mockReturnValue({
      data: EMPTY_CHILDREN_DATA,
      isLoading: false,
      isError: false,
      error: null,
    });

    const onSelect = vi.fn();

    render(
      <NextcloudTreeNode node={ROOT_NODE} level={2} selectedId={ROOT_NODE.id} onSelect={onSelect} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText("Root folder")).toBeInTheDocument();

    const row = screen.getByText("Root folder").closest("div");
    expect(row).not.toBeNull();
    expect(row?.className).toContain("bg-accent");
    expect(row?.getAttribute("style")).toContain("padding-left: 32px");

    fireEvent.click(screen.getByText("Root folder"));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("nc:/root");

    expect(mockGetNextcloudPathFromId).toHaveBeenCalledWith("nc:/root");
    expect(mockUseNextcloudFolderContents).toHaveBeenCalledWith("/root");
  });

  it("affiche un état de chargement puis rend les sous-dossiers après expansion", () => {
    mockUseNextcloudFolderContents.mockImplementation((path: string) => {
      if (path === ROOT_PATH) {
        return {
          data: ROOT_CHILDREN_DATA,
          isLoading: true,
          isError: false,
          error: null,
        };
      }

      if (path === CHILD_PATH) {
        return {
          data: EMPTY_CHILDREN_DATA,
          isLoading: false,
          isError: false,
          error: null,
        };
      }

      return {
        data: EMPTY_CHILDREN_DATA,
        isLoading: false,
        isError: false,
        error: null,
      };
    });

    const { rerender } = render(
      <NextcloudTreeNode node={ROOT_NODE} level={0} selectedId={null} onSelect={vi.fn()} />,
      { wrapper: createWrapper() }
    );

    const toggleButton = screen.getByRole("button");
    expect(toggleButton.querySelector("svg")).not.toBeNull();
    expect(toggleButton.querySelector(".animate-spin")).not.toBeNull();

    mockUseNextcloudFolderContents.mockImplementation((path: string) => {
      if (path === ROOT_PATH) {
        return {
          data: ROOT_CHILDREN_DATA,
          isLoading: false,
          isError: false,
          error: null,
        };
      }

      if (path === CHILD_PATH) {
        return {
          data: EMPTY_CHILDREN_DATA,
          isLoading: false,
          isError: false,
          error: null,
        };
      }

      return {
        data: EMPTY_CHILDREN_DATA,
        isLoading: false,
        isError: false,
        error: null,
      };
    });

    rerender(<NextcloudTreeNode node={ROOT_NODE} level={0} selectedId={null} onSelect={vi.fn()} />);

    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByText("Sub folder")).toBeInTheDocument();
    expect(mockCreateNextcloudFolderId).toHaveBeenCalledWith("/root/sub1");
    expect(mockUseNextcloudFolderContents).toHaveBeenCalledWith("/root/sub1");
  });

  it("utilise node.nextcloudPath quand getNextcloudPathFromId ne renvoie rien", () => {
    mockGetNextcloudPathFromId.mockReturnValue(null);
    mockUseNextcloudFolderContents.mockReturnValue({
      data: EMPTY_CHILDREN_DATA,
      isLoading: false,
      isError: false,
      error: null,
    });

    render(
      <NextcloudTreeNode node={ROOT_NODE} level={1} selectedId={null} onSelect={vi.fn()} />,
      { wrapper: createWrapper() }
    );

    expect(mockUseNextcloudFolderContents).toHaveBeenCalledWith("/root");
  });

  it("gère le cas d'erreur du hook en n'affichant pas d'enfants et en gardant le toggle visible", () => {
    mockUseNextcloudFolderContents.mockReturnValue({
      data: ERROR_CHILDREN_DATA,
      isLoading: false,
      isError: true,
      error: { message: "x" },
    });

    render(
      <NextcloudTreeNode node={ROOT_NODE} level={0} selectedId={null} onSelect={vi.fn()} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText("Root folder")).toBeInTheDocument();

    const toggleButton = screen.getByRole("button");
    expect(toggleButton.querySelector("svg")).not.toBeNull();

    fireEvent.click(toggleButton);

    expect(screen.queryByText("Sub folder")).not.toBeInTheDocument();
    expect(mockUseNextcloudFolderContents).toHaveBeenCalledWith("/root");
  });
});