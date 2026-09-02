/* @vitest-environment jsdom */
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent, renderHook, act } from "@testing-library/react";
import { EmailAttachmentViewer } from "./EmailAttachmentViewer";

const {
  ATTACHMENTS,
  AUTH_STATE,
  mockUseEmailAttachments,
  mockDownloadAttachment,
  mockGetAttachmentUrl,
  mockFrom,
  mockSelect,
  mockEq,
  mockGte,
  mockLte,
  mockIn,
  mockOrder,
  mockLimit,
  mockInsert,
  mockUpdate,
  mockDelete,
  mockSingle,
  mockMaybeSingle,
  mockThen,
  mockCatch,
  addToDocumentsDialogSpy,
  attachmentPreviewSpy,
  attachmentToTaskLinkDialogSpy,
} = vi.hoisted(() => {
  const ATTACHMENTS = [
    {
      id: "att-1",
      message_id: "msg-1",
      filename: "invoice.pdf",
      mime_type: "application/pdf",
      size_bytes: 2048,
      storage_path: "files/invoice.pdf",
      storage_bucket: "mail",
      downloaded: true,
      created_at: "2024-01-01T00:00:00Z",
      imap_part_id: "1",
    },
    {
      id: "att-2",
      message_id: "msg-1",
      filename: "photo.png",
      mime_type: "image/png",
      size_bytes: 1048576,
      storage_path: "files/photo.png",
      storage_bucket: "mail",
      downloaded: false,
      created_at: "2024-01-02T00:00:00Z",
      imap_part_id: "2",
    },
    {
      id: "att-3",
      message_id: "msg-1",
      filename: "notes.txt",
      mime_type: "text/plain",
      size_bytes: 512,
      storage_path: "files/notes.txt",
      storage_bucket: "mail",
      downloaded: false,
      created_at: "2024-01-03T00:00:00Z",
      imap_part_id: null,
    },
  ];

  const AUTH_STATE = {
    user: { id: "user-1", email: "user@test.local" },
    session: { user: { id: "user-1" } },
    isLoading: false,
  };

  const mockDownloadAttachment = vi.fn(async (_attachmentId: string) => undefined);
  const mockGetAttachmentUrl = vi.fn((attachmentId: string) => `url-for-${attachmentId}`);
  const mockUseEmailAttachments = vi.fn();

  const builder: {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    gte: ReturnType<typeof vi.fn>;
    lte: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    then: ReturnType<typeof vi.fn>;
    catch: ReturnType<typeof vi.fn>;
  } = {} as {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    gte: ReturnType<typeof vi.fn>;
    lte: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    then: ReturnType<typeof vi.fn>;
    catch: ReturnType<typeof vi.fn>;
  };

  const mockSelect = vi.fn(() => builder);
  const mockEq = vi.fn(() => builder);
  const mockGte = vi.fn(() => builder);
  const mockLte = vi.fn(() => builder);
  const mockIn = vi.fn(() => builder);
  const mockOrder = vi.fn(() => builder);
  const mockLimit = vi.fn(() => builder);
  const mockInsert = vi.fn(() => builder);
  const mockUpdate = vi.fn(() => builder);
  const mockDelete = vi.fn(() => builder);
  const mockSingle = vi.fn(async () => ({ data: null, error: null }));
  const mockMaybeSingle = vi.fn(async () => ({ data: null, error: null }));
  const mockThen = vi.fn((resolve: (value: { data: null; error: null }) => unknown) =>
    Promise.resolve(resolve({ data: null, error: null })),
  );
  const mockCatch = vi.fn(() => Promise.resolve({ data: null, error: null }));

  builder.select = mockSelect;
  builder.eq = mockEq;
  builder.gte = mockGte;
  builder.lte = mockLte;
  builder.in = mockIn;
  builder.order = mockOrder;
  builder.limit = mockLimit;
  builder.insert = mockInsert;
  builder.update = mockUpdate;
  builder.delete = mockDelete;
  builder.single = mockSingle;
  builder.maybeSingle = mockMaybeSingle;
  builder.then = mockThen;
  builder.catch = mockCatch;

  const mockFrom = vi.fn(() => builder);

  const addToDocumentsDialogSpy = vi.fn();
  const attachmentPreviewSpy = vi.fn();
  const attachmentToTaskLinkDialogSpy = vi.fn();

  return {
    ATTACHMENTS,
    AUTH_STATE,
    mockUseEmailAttachments,
    mockDownloadAttachment,
    mockGetAttachmentUrl,
    mockFrom,
    mockSelect,
    mockEq,
    mockGte,
    mockLte,
    mockIn,
    mockOrder,
    mockLimit,
    mockInsert,
    mockUpdate,
    mockDelete,
    mockSingle,
    mockMaybeSingle,
    mockThen,
    mockCatch,
    addToDocumentsDialogSpy,
    attachmentPreviewSpy,
    attachmentToTaskLinkDialogSpy,
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock("@/hooks/email/useEmailAttachments", () => ({
  useEmailAttachments: mockUseEmailAttachments,
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    title,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    title?: string;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" title={title} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span data-testid="badge" className={className}>
      {children}
    </span>
  ),
}));

vi.mock("lucide-react", () => ({
  Download: () => <svg data-testid="icon-download" />,
  FileText: () => <svg data-testid="icon-filetext" />,
  Image: () => <svg data-testid="icon-image" />,
  File: () => <svg data-testid="icon-file" />,
  FolderPlus: () => <svg data-testid="icon-folderplus" />,
  Loader2: () => <svg data-testid="icon-loader2" />,
  Eye: () => <svg data-testid="icon-eye" />,
}));

vi.mock("./AddToDocumentsDialog", () => ({
  AddToDocumentsDialog: (props: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    attachment: {
      id: string;
      filename: string;
      content_type: string;
      storage_path: string;
    };
    etablissementId: string;
  }) => {
    addToDocumentsDialogSpy(props);
    return (
      <div data-testid="add-to-documents-dialog">
        <span data-testid="add-dialog-filename">{props.attachment.filename}</span>
        <span data-testid="add-dialog-content-type">{props.attachment.content_type}</span>
        <span data-testid="add-dialog-etablissement">{props.etablissementId}</span>
      </div>
    );
  },
}));

vi.mock("./AttachmentPreview", () => ({
  AttachmentPreview: (props: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    attachment: {
      id: string;
      filename: string;
      mime_type: string;
    };
    onDownload: () => void;
    getAttachmentUrl: (attachmentId: string) => string;
  }) => {
    attachmentPreviewSpy(props);
    return (
      <div data-testid="attachment-preview">
        <span data-testid="preview-filename">{props.attachment.filename}</span>
        <button type="button" onClick={props.onDownload}>
          preview-download
        </button>
      </div>
    );
  },
}));

vi.mock("./AttachmentToTaskLinkDialog", () => ({
  AttachmentToTaskLinkDialog: (props: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    attachment: {
      id: string;
      filename: string;
    };
    etablissementId: string;
  }) => {
    attachmentToTaskLinkDialogSpy(props);
    return (
      <div data-testid="attachment-to-task-dialog">
        <span data-testid="task-dialog-filename">{props.attachment.filename}</span>
        <span data-testid="task-dialog-etablissement">{props.etablissementId}</span>
      </div>
    );
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

describe("EmailAttachmentViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseEmailAttachments.mockReturnValue({
      attachments: ATTACHMENTS,
      isLoading: false,
      downloadAttachment: mockDownloadAttachment,
      isDownloading: false,
      getAttachmentUrl: mockGetAttachmentUrl,
    });
  });

  it("utilise le wrapper QueryClientProvider avec renderHook sans erreur", () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => 42, { wrapper });
    expect(result.current).toBe(42);
  });

  it("affiche l'état de chargement", () => {
    mockUseEmailAttachments.mockReturnValue({
      attachments: ATTACHMENTS,
      isLoading: true,
      downloadAttachment: mockDownloadAttachment,
      isDownloading: false,
      getAttachmentUrl: mockGetAttachmentUrl,
    });

    render(<EmailAttachmentViewer messageId="msg-1" />, { wrapper: createWrapper() });

    expect(screen.getByText("Chargement des pièces jointes...")).toBeInTheDocument();
    expect(screen.queryByText(/Pièces jointes/)).not.toBeInTheDocument();
  });

  it("affiche les pièces jointes avec les valeurs métier formatées et les actions adaptées", () => {
    render(<EmailAttachmentViewer messageId="msg-1" etablissementId="eta-1" />, {
      wrapper: createWrapper(),
    });

    expect(mockUseEmailAttachments).toHaveBeenCalledWith("msg-1");
    expect(screen.getByText("Pièces jointes (3)")).toBeInTheDocument();

    expect(screen.getByText("invoice.pdf")).toBeInTheDocument();
    expect(screen.getByText("2.0 KB")).toBeInTheDocument();
    expect(screen.getByText("Téléchargé")).toBeInTheDocument();

    expect(screen.getByText("photo.png")).toBeInTheDocument();
    expect(screen.getByText("1.0 MB")).toBeInTheDocument();

    expect(screen.getByText("notes.txt")).toBeInTheDocument();
    expect(screen.getByText("512 B")).toBeInTheDocument();

    expect(screen.getAllByTitle("Télécharger")).toHaveLength(3);
    expect(screen.getAllByTitle("Prévisualiser")).toHaveLength(2);
    expect(screen.getAllByTitle("Associer à une tâche")).toHaveLength(3);
    expect(screen.getAllByTitle("Ajouter aux documents (ancien)")).toHaveLength(3);
  });

  it("déclenche le téléchargement avec le bon id", async () => {
    render(<EmailAttachmentViewer messageId="msg-1" />, { wrapper: createWrapper() });

    const downloadButtons = screen.getAllByTitle("Télécharger");

    await act(async () => {
      fireEvent.click(downloadButtons[1]);
    });

    expect(mockDownloadAttachment).toHaveBeenCalledTimes(1);
    expect(mockDownloadAttachment).toHaveBeenCalledWith("att-2");
  });

  it("désactive les boutons de téléchargement pendant un téléchargement", () => {
    mockUseEmailAttachments.mockReturnValue({
      attachments: ATTACHMENTS,
      isLoading: false,
      downloadAttachment: mockDownloadAttachment,
      isDownloading: true,
      getAttachmentUrl: mockGetAttachmentUrl,
    });

    render(<EmailAttachmentViewer messageId="msg-1" />, { wrapper: createWrapper() });

    const downloadButtons = screen.getAllByTitle("Télécharger");
    expect(downloadButtons).toHaveLength(3);
    for (const button of downloadButtons) {
      expect(button).toBeDisabled();
    }
    expect(screen.getAllByTestId("icon-loader2")).toHaveLength(3);
  });

  it("ouvre la prévisualisation et transmet la pièce jointe ainsi que l'action de téléchargement", async () => {
    render(<EmailAttachmentViewer messageId="msg-1" etablissementId="eta-1" />, {
      wrapper: createWrapper(),
    });

    const previewButtons = screen.getAllByTitle("Prévisualiser");

    await act(async () => {
      fireEvent.click(previewButtons[0]);
    });

    expect(screen.getByTestId("attachment-preview")).toBeInTheDocument();
    expect(screen.getByTestId("preview-filename")).toHaveTextContent("invoice.pdf");

    const previewProps = attachmentPreviewSpy.mock.calls.at(-1)?.[0] as {
      attachment: { id: string; filename: string; mime_type: string };
      getAttachmentUrl: (attachmentId: string) => string;
      onDownload: () => void;
      open: boolean;
    };

    expect(previewProps.open).toBe(true);
    expect(previewProps.attachment.id).toBe("att-1");
    expect(previewProps.attachment.filename).toBe("invoice.pdf");
    expect(previewProps.attachment.mime_type).toBe("application/pdf");
    expect(previewProps.getAttachmentUrl).toBe(mockGetAttachmentUrl);

    await act(async () => {
      fireEvent.click(screen.getByText("preview-download"));
    });

    expect(mockDownloadAttachment).toHaveBeenCalledWith("att-1");
  });

  it("ouvre le dialogue d'association à une tâche avec la bonne pièce jointe", async () => {
    render(<EmailAttachmentViewer messageId="msg-1" etablissementId="eta-42" />, {
      wrapper: createWrapper(),
    });

    const linkButtons = screen.getAllByTitle("Associer à une tâche");

    await act(async () => {
      fireEvent.click(linkButtons[2]);
    });

    expect(screen.getByTestId("attachment-to-task-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("task-dialog-filename")).toHaveTextContent("notes.txt");
    expect(screen.getByTestId("task-dialog-etablissement")).toHaveTextContent("eta-42");

    const props = attachmentToTaskLinkDialogSpy.mock.calls.at(-1)?.[0] as {
      open: boolean;
      attachment: { id: string; filename: string };
      etablissementId: string;
    };

    expect(props.open).toBe(true);
    expect(props.attachment.id).toBe("att-3");
    expect(props.attachment.filename).toBe("notes.txt");
    expect(props.etablissementId).toBe("eta-42");
  });

  it("ouvre le dialogue d'ajout aux documents avec le mapping métier attendu", async () => {
    render(<EmailAttachmentViewer messageId="msg-1" etablissementId="eta-99" />, {
      wrapper: createWrapper(),
    });

    const addButtons = screen.getAllByTitle("Ajouter aux documents (ancien)");

    await act(async () => {
      fireEvent.click(addButtons[1]);
    });

    expect(screen.getByTestId("add-to-documents-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("add-dialog-filename")).toHaveTextContent("photo.png");
    expect(screen.getByTestId("add-dialog-content-type")).toHaveTextContent("image/png");
    expect(screen.getByTestId("add-dialog-etablissement")).toHaveTextContent("eta-99");

    const props = addToDocumentsDialogSpy.mock.calls.at(-1)?.[0] as {
      open: boolean;
      attachment: {
        id: string;
        filename: string;
        content_type: string;
        storage_path: string;
      };
      etablissementId: string;
    };

    expect(props.open).toBe(true);
    expect(props.attachment).toEqual({
      id: "att-2",
      filename: "photo.png",
      content_type: "image/png",
      storage_path: "files/photo.png",
    });
    expect(props.etablissementId).toBe("eta-99");
  });

  it("n'affiche pas les actions établissement quand etablissementId est absent", () => {
    render(<EmailAttachmentViewer messageId="msg-1" />, {
      wrapper: createWrapper(),
    });

    expect(screen.queryByTitle("Associer à une tâche")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Ajouter aux documents (ancien)")).not.toBeInTheDocument();
    expect(screen.getAllByTitle("Télécharger")).toHaveLength(3);
    expect(screen.getAllByTitle("Prévisualiser")).toHaveLength(2);
  });

  it("ne rend rien quand il n'y a pas de pièces jointes", () => {
    mockUseEmailAttachments.mockReturnValue({
      attachments: [],
      isLoading: false,
      downloadAttachment: mockDownloadAttachment,
      isDownloading: false,
      getAttachmentUrl: mockGetAttachmentUrl,
    });

    const { container } = render(<EmailAttachmentViewer messageId="msg-1" />, {
      wrapper: createWrapper(),
    });

    expect(container).toBeEmptyDOMElement();
  });

  it("gère un état d'erreur du hook en n'affichant rien quand les données sont nulles", () => {
    mockUseEmailAttachments.mockReturnValue({
      attachments: null,
      isLoading: false,
      isError: true,
      error: { message: "x" },
      downloadAttachment: mockDownloadAttachment,
      isDownloading: false,
      getAttachmentUrl: mockGetAttachmentUrl,
    });

    const { container } = render(<EmailAttachmentViewer messageId="msg-1" />, {
      wrapper: createWrapper(),
    });

    expect(container).toBeEmptyDOMElement();
  });
});