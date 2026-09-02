import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { DocumentPreviewDialog } from "./DocumentPreviewDialog";

const {
  SIGNED_URL,
  IMAGE_DOCUMENT,
  PDF_DOCUMENT,
  OFFICE_DOCUMENT,
  OTHER_DOCUMENT,
  createSignedUrlMock,
  downloadMutateMock,
  logDocumentAuditMock,
  debugErrorMock,
  onOpenChangeMock,
  onEditMock,
} = vi.hoisted(() => ({
  SIGNED_URL: "https://example.test/signed-preview-url",
  IMAGE_DOCUMENT: {
    id: "doc-image-1",
    name: "photo.png",
    mime_type: "image/png",
    storage_bucket: "documents",
    storage_path: "folder/photo.png",
  },
  PDF_DOCUMENT: {
    id: "doc-pdf-1",
    name: "report.pdf",
    mime_type: "application/pdf",
    storage_bucket: "documents",
    storage_path: "folder/report.pdf",
  },
  OFFICE_DOCUMENT: {
    id: "doc-office-1",
    name: "sheet.xlsx",
    mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    storage_bucket: "documents",
    storage_path: "folder/sheet.xlsx",
  },
  OTHER_DOCUMENT: {
    id: "doc-other-1",
    name: "archive.zip",
    mime_type: "application/zip",
    storage_bucket: "documents",
    storage_path: "folder/archive.zip",
  },
  createSignedUrlMock: vi.fn(),
  downloadMutateMock: vi.fn(),
  logDocumentAuditMock: vi.fn(),
  debugErrorMock: vi.fn(),
  onOpenChangeMock: vi.fn(),
  onEditMock: vi.fn(),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    open,
    children,
  }: {
    open: boolean;
    children: React.ReactNode;
  }) => (open ? <div data-testid="dialog-root">{children}</div> : null),
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
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    title,
    "aria-label": ariaLabel,
    className,
    variant,
    size,
  }: {
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    disabled?: boolean;
    title?: string;
    "aria-label"?: string;
    className?: string;
    variant?: string;
    size?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      className={className}
      data-variant={variant}
      data-size={size}
    >
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/loader", () => ({
  Loader: () => <div data-testid="loader">loading</div>,
}));

vi.mock("./pdf/PDFViewer", () => ({
  PDFViewer: ({
    url,
    filename,
    onClose,
    onDownload,
  }: {
    url: string;
    filename: string;
    onClose: () => void;
    onDownload: () => void;
  }) => (
    <div data-testid="pdf-viewer">
      <div>{url}</div>
      <div>{filename}</div>
      <button type="button" onClick={onClose}>
        close-pdf
      </button>
      <button type="button" onClick={onDownload}>
        download-pdf
      </button>
    </div>
  ),
}));

vi.mock("@/hooks/documents/useDocumentUpload", () => ({
  useDocumentDownload: () => ({
    mutate: downloadMutateMock,
  }),
}));

vi.mock("@/hooks/documents/useDocumentAuditLog", () => ({
  logDocumentAudit: logDocumentAuditMock,
}));

vi.mock("@/lib/debug", () => ({
  debug: {
    error: debugErrorMock,
  },
}));

vi.mock("lucide-react", () => ({
  Download: () => <span>DownloadIcon</span>,
  X: () => <span>XIcon</span>,
  ZoomIn: () => <span>ZoomInIcon</span>,
  ZoomOut: () => <span>ZoomOutIcon</span>,
  RotateCw: () => <span>RotateIcon</span>,
  Edit: () => <span>EditIcon</span>,
  ExternalLink: () => <span>ExternalLinkIcon</span>,
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
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: (onFulfilled: (value: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).catch(onRejected),
  };

  return {
    supabase: {
      from: vi.fn(() => builder),
      storage: {
        from: vi.fn(() => ({
          createSignedUrl: createSignedUrlMock,
        })),
      },
    },
  };
});

describe("DocumentPreviewDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("charge et affiche une image, applique zoom/rotation et déclenche téléchargement + audit", async () => {
    createSignedUrlMock.mockResolvedValue({
      data: { signedUrl: SIGNED_URL },
      error: null,
    });

    render(
      <DocumentPreviewDialog
        document={IMAGE_DOCUMENT}
        open={true}
        onOpenChange={onOpenChangeMock}
      />,
    );

    expect(screen.getByTestId("loader")).toBeInTheDocument();

    const image = await screen.findByAltText("photo.png");
    expect(image).toHaveAttribute("src", SIGNED_URL);
    expect(image).toHaveStyle({
      transform: "scale(1) rotate(0deg)",
      objectFit: "contain",
    });

    expect(createSignedUrlMock).toHaveBeenCalledWith("folder/photo.png", 3600);
    expect(logDocumentAuditMock).toHaveBeenCalledWith("doc-image-1", "viewed", {
      mime_type: "image/png",
    });

    expect(screen.getByText("100%")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Zoomer"));
    await waitFor(() => {
      expect(screen.getByText("125%")).toBeInTheDocument();
    });
    expect(screen.getByAltText("photo.png")).toHaveStyle({
      transform: "scale(1.25) rotate(0deg)",
    });

    fireEvent.click(screen.getByLabelText("Actualiser"));
    expect(screen.getByAltText("photo.png")).toHaveStyle({
      transform: "scale(1.25) rotate(90deg)",
    });

    fireEvent.click(screen.getByLabelText("Télécharger"));
    expect(downloadMutateMock).toHaveBeenCalledWith({
      id: "doc-image-1",
      storage_path: "folder/photo.png",
      storage_bucket: "documents",
      name: "photo.png",
    });
    expect(logDocumentAuditMock).toHaveBeenCalledWith(
      "doc-image-1",
      "downloaded",
      { name: "photo.png" },
    );

    fireEvent.click(screen.getByLabelText("Fermer"));
    expect(onOpenChangeMock).toHaveBeenCalledWith(false);
  });

  it("affiche le viewer PDF après chargement et permet le téléchargement", async () => {
    createSignedUrlMock.mockResolvedValue({
      data: { signedUrl: SIGNED_URL },
      error: null,
    });

    render(
      <DocumentPreviewDialog
        document={PDF_DOCUMENT}
        open={true}
        onOpenChange={onOpenChangeMock}
      />,
    );

    expect(screen.getByTestId("loader")).toBeInTheDocument();

    const viewer = await screen.findByTestId("pdf-viewer");
    expect(viewer).toBeInTheDocument();
    expect(screen.getByText(SIGNED_URL)).toBeInTheDocument();
    expect(screen.getByText("report.pdf")).toBeInTheDocument();

    expect(logDocumentAuditMock).toHaveBeenCalledWith("doc-pdf-1", "viewed", {
      mime_type: "application/pdf",
    });

    fireEvent.click(screen.getByText("download-pdf"));
    expect(downloadMutateMock).toHaveBeenCalledWith({
      id: "doc-pdf-1",
      storage_path: "folder/report.pdf",
      storage_bucket: "documents",
      name: "report.pdf",
    });
    expect(logDocumentAuditMock).toHaveBeenCalledWith("doc-pdf-1", "downloaded", {
      name: "report.pdf",
    });

    fireEvent.click(screen.getByText("close-pdf"));
    expect(onOpenChangeMock).toHaveBeenCalledWith(false);
  });

  it("affiche l'UI Office et appelle onEdit puis ferme le dialog", async () => {
    createSignedUrlMock.mockResolvedValue({
      data: { signedUrl: SIGNED_URL },
      error: null,
    });

    render(
      <DocumentPreviewDialog
        document={OFFICE_DOCUMENT}
        open={true}
        onOpenChange={onOpenChangeMock}
        onEdit={onEditMock}
      />,
    );

    expect(await screen.findByText("Document Office")).toBeInTheDocument();
    expect(
      screen.getByText("Ce type de document peut être édité en ligne avec OnlyOffice."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("Éditer"));
    expect(onEditMock).toHaveBeenCalledWith(OFFICE_DOCUMENT);
    expect(onOpenChangeMock).toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByText("Ouvrir dans l'éditeur"));
    expect(onEditMock).toHaveBeenCalledWith(OFFICE_DOCUMENT);
  });

  it("affiche le fallback pour les types non prévisualisables et permet le téléchargement", async () => {
    createSignedUrlMock.mockResolvedValue({
      data: { signedUrl: SIGNED_URL },
      error: null,
    });

    render(
      <DocumentPreviewDialog
        document={OTHER_DOCUMENT}
        open={true}
        onOpenChange={onOpenChangeMock}
      />,
    );

    expect(
      await screen.findByText("Aucune prévisualisation disponible"),
    ).toBeInTheDocument();
    expect(screen.getByText("Type: application/zip")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Télécharger le fichier"));
    expect(downloadMutateMock).toHaveBeenCalledWith({
      id: "doc-other-1",
      storage_path: "folder/archive.zip",
      storage_bucket: "documents",
      name: "archive.zip",
    });
    expect(logDocumentAuditMock).toHaveBeenCalledWith(
      "doc-other-1",
      "downloaded",
      { name: "archive.zip" },
    );
  });

  it("affiche une erreur quand createSignedUrl renvoie une erreur", async () => {
    createSignedUrlMock.mockResolvedValue({
      data: null,
      error: { message: "x" },
    });

    render(
      <DocumentPreviewDialog
        document={IMAGE_DOCUMENT}
        open={true}
        onOpenChange={onOpenChangeMock}
      />,
    );

    expect(
      await screen.findByText("Erreur lors du chargement"),
    ).toBeInTheDocument();
    expect(debugErrorMock).toHaveBeenCalled();
    expect(screen.queryByAltText("photo.png")).not.toBeInTheDocument();
  });

  it("retourne null si aucun document n'est fourni", () => {
    const { container } = render(
      <DocumentPreviewDialog
        document={null}
        open={true}
        onOpenChange={onOpenChangeMock}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});