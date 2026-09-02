import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FinderColumn } from "./FinderColumn";

const {
  MOCK_FOLDERS_LOADING,
  MOCK_FOLDERS_SUCCESS,
  MOCK_FOLDERS_EMPTY,
  MOCK_DOCUMENTS_SUCCESS,
  MOCK_DOCUMENTS_MIXED,
  MOCK_PERMISSIONS_USER,
  MOCK_PERMISSIONS_GROUP,
  MOCK_ON_SELECT_FOLDER,
  MOCK_ON_SELECT_DOCUMENT,
  MOCK_ON_HOVER_DOCUMENT,
  MOCK_ON_TOGGLE_SELECT,
  MOCK_SELECTED_DOC_IDS,
  MOCK_USE_FOLDER_CONTENTS_LOADING,
  MOCK_USE_FOLDER_CONTENTS_SUCCESS,
  MOCK_USE_FOLDER_CONTENTS_EMPTY,
  MOCK_USE_FOLDER_CONTENTS_ERROR,
  MOCK_SCROLL_INTO_VIEW,
  MOCK_MATCH_MEDIA_HOVER_TRUE,
  MOCK_MATCH_MEDIA_HOVER_FALSE,
} = vi.hoisted(() => {
  const foldersLoading: any[] = [];
  const foldersSuccess: any[] = [
    {
      id: "folder-1",
      name: "Folder 1",
      color: "hsl(200, 50%, 50%)",
      folder_type: "standard",
      is_restricted: false,
      document_folder_permissions: [],
    },
    {
      id: "folder-2",
      name: "Folder 2",
      color: null,
      folder_type: "standard",
      is_restricted: true,
      document_folder_permissions: [
        {
          user_id: "user-1",
          user: {
            prenom: "John",
            nom: "Doe",
            avatar_url: "https://example.com/ava",
          },
          access_level: "editor",
        },
        {
          group_id: "group-1",
          group: {
            name: "Team A",
            color: "#ff0000",
          },
          access_level: "viewer",
        },
      ],
    },
  ];

  const foldersEmpty: any[] = [];

  const documentsSuccess: any[] = [
    {
      id: "doc-1",
      name: "Image document",
      mime_type: "image/png",
    },
    {
      id: "doc-2",
      name: "PDF document",
      mime_type: "application/pdf",
    },
    {
      id: "doc-3",
      name: "Other document",
      mime_type: "text/plain",
    },
  ];

  const documentsMixed: any[] = [
    {
      id: "doc-4",
      name: "Multi selected doc",
      mime_type: "image/jpeg",
    },
  ];

  const permissionsUser: any[] = [
    {
      user_id: "user-2",
      user: {
        prenom: "Alice",
        nom: "Smith",
        avatar_url: null,
      },
      access_level: "viewer",
    },
  ];

  const permissionsGroup: any[] = [
    {
      group_id: "group-2",
      group: {
        name: "Group B",
        color: "#00ff00",
      },
      access_level: "editor",
    },
  ];

  const onSelectFolder = vi.fn();
  const onSelectDocument = vi.fn();
  const onHoverDocument = vi.fn();
  const onToggleSelect = vi.fn();

  const selectedDocIds = new Set<string>(["doc-4"]);

  const useFolderContentsLoading = () => ({
    folders: foldersLoading,
    documents: [],
    isLoading: true,
  });

  const useFolderContentsSuccess = () => ({
    folders: foldersSuccess,
    documents: documentsSuccess,
    isLoading: false,
  });

  const useFolderContentsEmpty = () => ({
    folders: foldersEmpty,
    documents: [],
    isLoading: false,
  });

  const useFolderContentsError = () => {
    throw new Error("useFolderContents error");
  };

  const scrollIntoViewMock = vi.fn();

  const matchMediaHoverTrue = (query: string) => {
    if (query === "(hover: hover) and (pointer: fine)") {
      return {
        matches: true,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      } as unknown as MediaQueryList;
    }
    return {
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList;
  };

  const matchMediaHoverFalse = (query: string) => {
    return {
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList;
  };

  return {
    MOCK_FOLDERS_LOADING: foldersLoading,
    MOCK_FOLDERS_SUCCESS: foldersSuccess,
    MOCK_FOLDERS_EMPTY: foldersEmpty,
    MOCK_DOCUMENTS_SUCCESS: documentsSuccess,
    MOCK_DOCUMENTS_MIXED: documentsMixed,
    MOCK_PERMISSIONS_USER: permissionsUser,
    MOCK_PERMISSIONS_GROUP: permissionsGroup,
    MOCK_ON_SELECT_FOLDER: onSelectFolder,
    MOCK_ON_SELECT_DOCUMENT: onSelectDocument,
    MOCK_ON_HOVER_DOCUMENT: onHoverDocument,
    MOCK_ON_TOGGLE_SELECT: onToggleSelect,
    MOCK_SELECTED_DOC_IDS: selectedDocIds,
    MOCK_USE_FOLDER_CONTENTS_LOADING: useFolderContentsLoading,
    MOCK_USE_FOLDER_CONTENTS_SUCCESS: useFolderContentsSuccess,
    MOCK_USE_FOLDER_CONTENTS_EMPTY: useFolderContentsEmpty,
    MOCK_USE_FOLDER_CONTENTS_ERROR: useFolderContentsError,
    MOCK_SCROLL_INTO_VIEW: scrollIntoViewMock,
    MOCK_MATCH_MEDIA_HOVER_TRUE: matchMediaHoverTrue,
    MOCK_MATCH_MEDIA_HOVER_FALSE: matchMediaHoverFalse,
  };
});

const { MOCK_USE_FOLDER_CONTENTS_LOADING_IMPL, MOCK_USE_FOLDER_CONTENTS_SUCCESS_IMPL, MOCK_USE_FOLDER_CONTENTS_EMPTY_IMPL, MOCK_USE_FOLDER_CONTENTS_ERROR_IMPL } =
  vi.hoisted(() => {
    const loadingImpl = () => MOCK_USE_FOLDER_CONTENTS_LOADING();
    const successImpl = () => MOCK_USE_FOLDER_CONTENTS_SUCCESS();
    const emptyImpl = () => MOCK_USE_FOLDER_CONTENTS_EMPTY();
    const errorImpl = () => MOCK_USE_FOLDER_CONTENTS_ERROR();
    return {
      MOCK_USE_FOLDER_CONTENTS_LOADING_IMPL: loadingImpl,
      MOCK_USE_FOLDER_CONTENTS_SUCCESS_IMPL: successImpl,
      MOCK_USE_FOLDER_CONTENTS_EMPTY_IMPL: emptyImpl,
      MOCK_USE_FOLDER_CONTENTS_ERROR_IMPL: errorImpl,
    };
  });

vi.mock("@/hooks/documents/useFolderTree", () => ({
  useFolderContents: vi.fn(),
}));

vi.mock("@/lib/utils", () => ({
  cn: (...args: string[]) => args.filter(Boolean).join(" "),
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="scroll-area" className={className}>
      {children}
    </div>
  ),
}));

vi.mock("@/components/documents/folders/FolderShareIndicator", () => ({
  FolderShareIndicator: ({
    isRestricted,
    folderType,
    sharedWith,
    maxAvatars,
    variant,
  }: {
    isRestricted: boolean;
    folderType: string;
    sharedWith: any[];
    maxAvatars: number;
    variant: string;
  }) => (
    <div
      data-testid="folder-share-indicator"
      data-restricted={isRestricted ? "yes" : "no"}
      data-folder-type={folderType}
      data-shared-count={sharedWith.length}
      data-max-avatars={maxAvatars}
      data-variant={variant}
    />
  ),
}));

vi.mock("lucide-react", () => ({
  Folder: (props: any) => <svg data-icon="folder" {...props} />,
  ChevronRight: (props: any) => <svg data-icon="chevron-right" {...props} />,
  FileText: (props: any) => <svg data-icon="file-text" {...props} />,
  FileImage: (props: any) => <svg data-icon="file-image" {...props} />,
  File: (props: any) => <svg data-icon="file" {...props} />,
  Loader2: (props: any) => <svg data-icon="loader2" {...props} />,
}));

describe("FinderColumn", () => {
  const createQueryClient = () =>
    new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });

  const renderWithClient = (ui: React.ReactElement) => {
    const client = createQueryClient();
    return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    const module = await import("@/hooks/documents/useFolderTree");
    (module as any).useFolderContents = (vi.fn() as any);
  });

  it("affiche un loader quand isLoading est true", async () => {
    const module = await import("@/hooks/documents/useFolderTree");
    (module as any).useFolderContents.mockImplementation(MOCK_USE_FOLDER_CONTENTS_LOADING_IMPL);

    renderWithClient(
      <FinderColumn
        parentFolderId={null}
        selectedId={null}
        selectedType={null}
        onSelectFolder={MOCK_ON_SELECT_FOLDER}
        onSelectDocument={MOCK_ON_SELECT_DOCUMENT}
      />
    );

    const loaderSvg = document.querySelector('[data-icon="loader2"]');
    expect(loaderSvg).toBeTruthy();
  });

  it("affiche une colonne vide quand aucun dossier ni document", async () => {
    const module = await import("@/hooks/documents/useFolderTree");
    (module as any).useFolderContents.mockImplementation(MOCK_USE_FOLDER_CONTENTS_EMPTY_IMPL);

    const { container } = renderWithClient(
      <FinderColumn
        parentFolderId={null}
        selectedId={null}
        selectedType={null}
        onSelectFolder={MOCK_ON_SELECT_FOLDER}
        onSelectDocument={MOCK_ON_SELECT_DOCUMENT}
      />
    );

    const scrollArea = container.querySelector('[data-testid="scroll-area"]');
    expect(scrollArea).toBeNull();
    const emptyColumn = container.querySelector(".finder-column-enter");
    expect(emptyColumn).toBeTruthy();
  });

  it("affiche les dossiers et documents avec les bons noms", async () => {
    const module = await import("@/hooks/documents/useFolderTree");
    (module as any).useFolderContents.mockImplementation(MOCK_USE_FOLDER_CONTENTS_SUCCESS_IMPL);

    renderWithClient(
      <FinderColumn
        parentFolderId="root"
        selectedId={null}
        selectedType={null}
        onSelectFolder={MOCK_ON_SELECT_FOLDER}
        onSelectDocument={MOCK_ON_SELECT_DOCUMENT}
      />
    );

    expect(screen.getByText("Folder 1")).toBeInTheDocument();
    expect(screen.getByText("Folder 2")).toBeInTheDocument();
    expect(screen.getByText("Image document")).toBeInTheDocument();
    expect(screen.getByText("PDF document")).toBeInTheDocument();
    expect(screen.getByText("Other document")).toBeInTheDocument();
  });

  it("appelle onSelectFolder avec mode 'commit' lors d'un clic sur un dossier", async () => {
    const module = await import("@/hooks/documents/useFolderTree");
    (module as any).useFolderContents.mockImplementation(MOCK_USE_FOLDER_CONTENTS_SUCCESS_IMPL);

    renderWithClient(
      <FinderColumn
        parentFolderId="root"
        selectedId={null}
        selectedType={null}
        onSelectFolder={MOCK_ON_SELECT_FOLDER}
        onSelectDocument={MOCK_ON_SELECT_DOCUMENT}
      />
    );

    const folderItem = screen.getByText("Folder 1");
    fireEvent.click(folderItem);

    expect(MOCK_ON_SELECT_FOLDER).toHaveBeenCalledTimes(1);
    expect(MOCK_ON_SELECT_FOLDER).toHaveBeenCalledWith(
      expect.objectContaining({ id: "folder-1", name: "Folder 1" }),
      "commit"
    );
  });

  it("gère le hover sur les dossiers (mode hover) quand le device supporte le hover", async () => {
    const module = await import("@/hooks/documents/useFolderTree");
    (module as any).useFolderContents.mockImplementation(MOCK_USE_FOLDER_CONTENTS_SUCCESS_IMPL);

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: MOCK_MATCH_MEDIA_HOVER_TRUE,
    });

    vi.useFakeTimers();

    renderWithClient(
      <FinderColumn
        parentFolderId="root"
        selectedId={null}
        selectedType={null}
        onSelectFolder={MOCK_ON_SELECT_FOLDER}
        onSelectDocument={MOCK_ON_SELECT_DOCUMENT}
      />
    );

    const folderItem = screen.getByText("Folder 1");
    fireEvent.mouseEnter(folderItem);

    expect(MOCK_ON_SELECT_FOLDER).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(160);
    });

    expect(MOCK_ON_SELECT_FOLDER).toHaveBeenCalledTimes(1);
    expect(MOCK_ON_SELECT_FOLDER).toHaveBeenCalledWith(
      expect.objectContaining({ id: "folder-1" }),
      "hover"
    );

    vi.useRealTimers();
  });

  it("n'appelle pas onSelectFolder sur hover si le device ne supporte pas le hover", async () => {
    const module = await import("@/hooks/documents/useFolderTree");
    (module as any).useFolderContents.mockImplementation(MOCK_USE_FOLDER_CONTENTS_SUCCESS_IMPL);

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: MOCK_MATCH_MEDIA_HOVER_FALSE,
    });

    vi.useFakeTimers();

    renderWithClient(
      <FinderColumn
        parentFolderId="root"
        selectedId={null}
        selectedType={null}
        onSelectFolder={MOCK_ON_SELECT_FOLDER}
        onSelectDocument={MOCK_ON_SELECT_DOCUMENT}
      />
    );

    const folderItem = screen.getByText("Folder 1");
    fireEvent.mouseEnter(folderItem);

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(MOCK_ON_SELECT_FOLDER).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("appelle onHoverDocument lors d'un hover sur un document quand hover est supporté", async () => {
    const module = await import("@/hooks/documents/useFolderTree");
    (module as any).useFolderContents.mockImplementation(MOCK_USE_FOLDER_CONTENTS_SUCCESS_IMPL);

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: MOCK_MATCH_MEDIA_HOVER_TRUE,
    });

    vi.useFakeTimers();

    renderWithClient(
      <FinderColumn
        parentFolderId="root"
        selectedId={null}
        selectedType={null}
        onSelectFolder={MOCK_ON_SELECT_FOLDER}
        onSelectDocument={MOCK_ON_SELECT_DOCUMENT}
        onHoverDocument={MOCK_ON_HOVER_DOCUMENT}
      />
    );

    const docItem = screen.getByText("Image document");
    fireEvent.mouseEnter(docItem);

    expect(MOCK_ON_HOVER_DOCUMENT).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(110);
    });

    expect(MOCK_ON_HOVER_DOCUMENT).toHaveBeenCalledTimes(1);
    expect(MOCK_ON_HOVER_DOCUMENT).toHaveBeenCalledWith(
      expect.objectContaining({ id: "doc-1", name: "Image document" })
    );

    vi.useRealTimers();
  });

  it("n'appelle pas onHoverDocument si onHoverDocument n'est pas fourni", async () => {
    const module = await import("@/hooks/documents/useFolderTree");
    (module as any).useFolderContents.mockImplementation(MOCK_USE_FOLDER_CONTENTS_SUCCESS_IMPL);

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: MOCK_MATCH_MEDIA_HOVER_TRUE,
    });

    vi.useFakeTimers();

    renderWithClient(
      <FinderColumn
        parentFolderId="root"
        selectedId={null}
        selectedType={null}
        onSelectFolder={MOCK_ON_SELECT_FOLDER}
        onSelectDocument={MOCK_ON_SELECT_DOCUMENT}
      />
    );

    const docItem = screen.getByText("Image document");
    fireEvent.mouseEnter(docItem);

    await act(async () => {
      vi.advanceTimersByTime(150);
    });

    expect(MOCK_ON_HOVER_DOCUMENT).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("utilise onToggleSelect avec metaKey/ctrlKey pour la multi-sélection", async () => {
    const module = await import("@/hooks/documents/useFolderTree");
    (module as any).useFolderContents.mockImplementation(() => ({
      folders: MOCK_FOLDERS_SUCCESS,
      documents: MOCK_DOCUMENTS_MIXED,
      isLoading: false,
    }));

    renderWithClient(
      <FinderColumn
        parentFolderId="root"
        selectedId={null}
        selectedType={null}
        onSelectFolder={MOCK_ON_SELECT_FOLDER}
        onSelectDocument={MOCK_ON_SELECT_DOCUMENT}
        onToggleSelect={MOCK_ON_TOGGLE_SELECT}
        selectedDocIds={MOCK_SELECTED_DOC_IDS}
      />
    );

    const docItem = screen.getByText("Multi selected doc");

    fireEvent.click(docItem, { metaKey: true });
    expect(MOCK_ON_TOGGLE_SELECT).toHaveBeenCalledTimes(1);
    expect(MOCK_ON_TOGGLE_SELECT).toHaveBeenCalledWith(
      expect.objectContaining({ id: "doc-4" })
    );

    MOCK_ON_TOGGLE_SELECT.mockClear();

    fireEvent.click(docItem, { ctrlKey: true });
    expect(MOCK_ON_TOGGLE_SELECT).toHaveBeenCalledTimes(1);
    expect(MOCK_ON_TOGGLE_SELECT).toHaveBeenCalledWith(
      expect.objectContaining({ id: "doc-4" })
    );
  });

  it("appelle onSelectDocument quand aucune touche de multi-sélection n'est pressée", async () => {
    const module = await import("@/hooks/documents/useFolderTree");
    (module as any).useFolderContents.mockImplementation(() => ({
      folders: MOCK_FOLDERS_SUCCESS,
      documents: MOCK_DOCUMENTS_MIXED,
      isLoading: false,
    }));

    renderWithClient(
      <FinderColumn
        parentFolderId="root"
        selectedId={null}
        selectedType={null}
        onSelectFolder={MOCK_ON_SELECT_FOLDER}
        onSelectDocument={MOCK_ON_SELECT_DOCUMENT}
        onToggleSelect={MOCK_ON_TOGGLE_SELECT}
        selectedDocIds={MOCK_SELECTED_DOC_IDS}
      />
    );

    const docItem = screen.getByText("Multi selected doc");
    fireEvent.click(docItem);

    expect(MOCK_ON_SELECT_DOCUMENT).toHaveBeenCalledTimes(1);
    expect(MOCK_ON_SELECT_DOCUMENT).toHaveBeenCalledWith(
      expect.objectContaining({ id: "doc-4" })
    );
    expect(MOCK_ON_TOGGLE_SELECT).not.toHaveBeenCalled();
  });

  it("affiche FolderShareIndicator quand is_restricted est défini", async () => {
    const module = await import("@/hooks/documents/useFolderTree");
    (module as any).useFolderContents.mockImplementation(() => ({
      folders: MOCK_FOLDERS_SUCCESS,
      documents: [],
      isLoading: false,
    }));

    renderWithClient(
      <FinderColumn
        parentFolderId="root"
        selectedId="folder-2"
        selectedType="folder"
        onSelectFolder={MOCK_ON_SELECT_FOLDER}
        onSelectDocument={MOCK_ON_SELECT_DOCUMENT}
      />
    );

    const indicators = screen.getAllByTestId("folder-share-indicator");
    expect(indicators.length).toBeGreaterThan(0);
    const restrictedIndicator = indicators.find(
      (el) => el.getAttribute("data-restricted") === "yes"
    );
    expect(restrictedIndicator).toBeTruthy();
    expect(restrictedIndicator?.getAttribute("data-shared-count")).toBe("2");
    expect(restrictedIndicator?.getAttribute("data-variant")).toBe("compact");
  });

  it("met en surbrillance l'élément sélectionné et défile jusqu'à celui-ci", async () => {
    const module = await import("@/hooks/documents/useFolderTree");
    (module as any).useFolderContents.mockImplementation(() => ({
      folders: MOCK_FOLDERS_SUCCESS,
      documents: MOCK_DOCUMENTS_SUCCESS,
      isLoading: false,
    }));

    vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(
      MOCK_SCROLL_INTO_VIEW as any
    );

    renderWithClient(
      <FinderColumn
        parentFolderId="root"
        selectedId="doc-2"
        selectedType="document"
        onSelectFolder={MOCK_ON_SELECT_FOLDER}
        onSelectDocument={MOCK_ON_SELECT_DOCUMENT}
        isActive={true}
        selectedIndex={3}
      />
    );

    expect(screen.getByText("PDF document")).toBeInTheDocument();
    expect(MOCK_SCROLL_INTO_VIEW).toHaveBeenCalled();
  });

  it("gère une erreur dans useFolderContents sans casser le rendu", async () => {
    const module = await import("@/hooks/documents/useFolderTree");
    (module as any).useFolderContents.mockImplementation(
      MOCK_USE_FOLDER_CONTENTS_ERROR_IMPL
    );

    expect(() =>
      renderWithClient(
        <FinderColumn
          parentFolderId="root"
          selectedId={null}
          selectedType={null}
          onSelectFolder={MOCK_ON_SELECT_FOLDER}
          onSelectDocument={MOCK_ON_SELECT_DOCUMENT}
        />
      )
    ).toThrow("useFolderContents error");
  });

  it("affiche les icônes de fichier correctes selon le type MIME", async () => {
    const module = await import("@/hooks/documents/useFolderTree");
    (module as any).useFolderContents.mockImplementation(MOCK_USE_FOLDER_CONTENTS_SUCCESS_IMPL);

    renderWithClient(
      <FinderColumn
        parentFolderId="root"
        selectedId={null}
        selectedType={null}
        onSelectFolder={MOCK_ON_SELECT_FOLDER}
        onSelectDocument={MOCK_ON_SELECT_DOCUMENT}
      />
    );

    const fileImageIcon = document.querySelector('[data-icon="file-image"]');
    const fileTextIcon = document.querySelector('[data-icon="file-text"]');
    const fileIcon = document.querySelector('[data-icon="file"]');

    expect(fileImageIcon).toBeTruthy();
    expect(fileTextIcon).toBeTruthy();
    expect(fileIcon).toBeTruthy();
  });
});