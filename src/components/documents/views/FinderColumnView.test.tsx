import { render, screen, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const {
  FOLDER_CONTENTS,
  NC_CONTENTS,
  NC_STATUS,
  DELETE_DOC_RESULT,
  FOLDERS_HOOK,
  TOGGLE_TAG_HOOK,
  TOGGLE_FOLDER_TAG_HOOK,
  UPLOAD_HOOK,
  BATCH_HOOK,
  mockUseFolderContents,
  mockUseNextcloudStatus,
  mockUseNextcloudFolderContents,
  mockUseDeleteDocument,
  mockUseFolders,
  mockUseToggleColorTag,
  mockUseToggleFolderColorTag,
  mockUseDocumentUpload,
  mockUseBatchDownload,
  mockUseFinderKeyboardNav,
  mockGetNextcloudDownloadUrl,
  mockFrom,
  mockStorageFrom,
  mockCreateSignedUrl,
  mockDownload,
  mockToastSuccess,
  mockToastError,
} = vi.hoisted(() => {
  const FOLDER_CONTENTS = {
    folders: [{ id: "f1", name: "Dossier A", parent_id: null }],
    documents: [
      {
        id: "d1",
        title: "Rapport 2024",
        storage_path: null,
        storage_bucket: null,
      },
    ],
  };
  const NC_CONTENTS = { data: { folders: [], files: [] } };
  const NC_STATUS = { data: { connected: true } };
  const DELETE_DOC_RESULT = { mutate: vi.fn(), isPending: false };
  const FOLDERS_HOOK = { deleteFolder: vi.fn(), isDeleting: false };
  const TOGGLE_TAG_HOOK = { toggleTag: vi.fn(), isPending: false };
  const TOGGLE_FOLDER_TAG_HOOK = { toggleTag: vi.fn(), isPending: false };
  const UPLOAD_HOOK = { uploadFiles: vi.fn(), isUploading: false, uploads: [] };
  const BATCH_HOOK = {
    downloadBatch: vi.fn(),
    isDownloading: false,
    progress: 0,
  };
  const mockCreateSignedUrl = vi
    .fn()
    .mockResolvedValue({ data: { signedUrl: "blob:preview" }, error: null });
  const mockDownload = vi
    .fn()
    .mockResolvedValue({ data: new Blob(["x"]), error: null });
  const mockStorageFrom = vi.fn(() => ({
    createSignedUrl: mockCreateSignedUrl,
    download: mockDownload,
  }));
  const makeBuilder = () => {
    const builder: Record<string, unknown> = {};
    const chain = [
      "select",
      "eq",
      "gte",
      "lte",
      "in",
      "order",
      "limit",
      "insert",
      "update",
      "delete",
      "is",
      "neq",
    ];
    for (const m of chain) {
      builder[m] = vi.fn(() => builder);
    }
    builder.single = vi.fn(() => Promise.resolve({ data: null, error: null }));
    builder.maybeSingle = vi.fn(() =>
      Promise.resolve({ data: null, error: null }),
    );
    builder.then = (
      resolve: (v: { data: unknown[]; error: null }) => unknown,
    ) => Promise.resolve({ data: [], error: null }).then(resolve);
    builder.catch = () => builder;
    return builder;
  };
  const mockFrom = vi.fn(() => makeBuilder());
  return {
    FOLDER_CONTENTS,
    NC_CONTENTS,
    NC_STATUS,
    DELETE_DOC_RESULT,
    FOLDERS_HOOK,
    TOGGLE_TAG_HOOK,
    TOGGLE_FOLDER_TAG_HOOK,
    UPLOAD_HOOK,
    BATCH_HOOK,
    mockUseFolderContents: vi.fn(() => FOLDER_CONTENTS),
    mockUseNextcloudStatus: vi.fn(() => NC_STATUS),
    mockUseNextcloudFolderContents: vi.fn(() => NC_CONTENTS),
    mockUseDeleteDocument: vi.fn(() => DELETE_DOC_RESULT),
    mockUseFolders: vi.fn(() => FOLDERS_HOOK),
    mockUseToggleColorTag: vi.fn(() => TOGGLE_TAG_HOOK),
    mockUseToggleFolderColorTag: vi.fn(() => TOGGLE_FOLDER_TAG_HOOK),
    mockUseDocumentUpload: vi.fn(() => UPLOAD_HOOK),
    mockUseBatchDownload: vi.fn(() => BATCH_HOOK),
    mockUseFinderKeyboardNav: vi.fn(),
    mockGetNextcloudDownloadUrl: vi.fn().mockResolvedValue("blob:nc"),
    mockFrom,
    mockStorageFrom,
    mockCreateSignedUrl,
    mockDownload,
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
    storage: { from: mockStorageFrom },
  },
}));

vi.mock("@/lib/debug", () => ({
  debug: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/utils", () => ({
  cn: (...args: Array<string | false | null | undefined>) =>
    args.filter(Boolean).join(" "),
}));

vi.mock("sonner", () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children?: ReactNode }) => (
    <div data-testid="scroll-area">{children}</div>
  ),
  ScrollBar: () => null,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
  }: {
    children?: ReactNode;
    onClick?: () => void;
  }) => <button onClick={onClick}>{children}</button>,
}));

vi.mock("./FinderColumn", () => ({
  FinderColumn: () => <div data-testid="finder-column" />,
}));

vi.mock("./NextcloudFinderColumn", () => ({
  NextcloudFinderColumn: () => <div data-testid="nextcloud-finder-column" />,
}));

vi.mock("./SourcesColumn", () => ({
  SourcesColumn: () => <div data-testid="sources-column" />,
}));

vi.mock("@/hooks/documents/useFolderTree", () => ({
  useFolderContents: mockUseFolderContents,
}));

vi.mock("@/hooks/documents/useFolders", () => ({
  useFolders: mockUseFolders,
}));

vi.mock("@/hooks/documents/useNextcloudFiles", () => ({
  useNextcloudStatus: mockUseNextcloudStatus,
}));

vi.mock("@/hooks/documents/useNextcloudStorage", () => ({
  getNextcloudDownloadUrl: mockGetNextcloudDownloadUrl,
}));

vi.mock("@/hooks/documents/useNextcloudFolderTree", () => ({
  useNextcloudFolderContents: mockUseNextcloudFolderContents,
}));

vi.mock("@/hooks/documents/useDocuments", () => ({
  useDeleteDocument: mockUseDeleteDocument,
}));

vi.mock("@/hooks/documents/useDocumentColorTags", () => ({
  useToggleColorTag: mockUseToggleColorTag,
}));

vi.mock("@/hooks/documents/useFolderColorTags", () => ({
  useToggleFolderColorTag: mockUseToggleFolderColorTag,
}));

vi.mock("@/hooks/documents/useDocumentUpload", () => ({
  useDocumentUpload: mockUseDocumentUpload,
}));

vi.mock("@/hooks/documents/useBatchDownload", () => ({
  useBatchDownload: mockUseBatchDownload,
}));

vi.mock("@/components/documents/finder/FinderDropZone", () => ({
  FinderDropZone: ({ children }: { children?: ReactNode }) => (
    <div data-testid="finder-drop-zone">{children}</div>
  ),
}));

vi.mock("@/components/documents/finder/BatchSelectionBar", () => ({
  BatchSelectionBar: () => null,
}));

vi.mock("@/components/documents/dialogs/RenameDocumentDialog", () => ({
  RenameDocumentDialog: () => null,
}));

vi.mock("@/components/documents/folders/RenameFolderDialog", () => ({
  RenameFolderDialog: () => null,
}));

vi.mock("./useFinderKeyboardNav", () => ({
  useFinderKeyboardNav: mockUseFinderKeyboardNav,
}));

vi.mock("./FinderPreviewPanels", () => ({
  LocalDocumentPreviewPanel: () => null,
  LocalFolderPreviewPanel: () => null,
  NextcloudPreviewPanel: () => null,
}));

import { FinderColumnView } from "./FinderColumnView";

function renderView(
  props: Partial<{
    onDocumentSelect: (d: unknown) => void;
    onDocumentPreview: (d: unknown) => void;
    className: string;
  }> = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <FinderColumnView {...props} />
    </QueryClientProvider>,
  );
}

describe("FinderColumnView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("rend la vue avec la colonne des sources et au moins une colonne locale (source par défaut: local)", () => {
    renderView();

    expect(screen.getByTestId("sources-column")).toBeTruthy();
    expect(
      screen.getAllByTestId("finder-column").length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("charge le contenu du dossier racine (parentId null) et interroge le statut Nextcloud", () => {
    renderView();

    expect(mockUseFolderContents).toHaveBeenCalledWith(null);
    expect(mockUseNextcloudStatus).toHaveBeenCalled();
    expect(mockUseNextcloudFolderContents).toHaveBeenCalledWith("/");
  });

  it("active la navigation clavier via useFinderKeyboardNav au montage", () => {
    renderView();

    expect(mockUseFinderKeyboardNav).toHaveBeenCalled();
  });

  it("n'appelle pas onDocumentSelect ni onDocumentPreview au montage", () => {
    const onDocumentSelect = vi.fn();
    const onDocumentPreview = vi.fn();

    renderView({ onDocumentSelect, onDocumentPreview });

    expect(onDocumentSelect).not.toHaveBeenCalled();
    expect(onDocumentPreview).not.toHaveBeenCalled();
  });

  it("ne déclenche pas de requête de preview signée quand aucun document n'est sélectionné", () => {
    renderView();

    expect(mockCreateSignedUrl).not.toHaveBeenCalled();
    expect(mockGetNextcloudDownloadUrl).not.toHaveBeenCalled();
  });
});