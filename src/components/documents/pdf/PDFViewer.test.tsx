// @vitest-environment jsdom

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { PDFViewer } from "./PDFViewer";

const {
  mockUsePDFViewer,
  mockDocumentProps,
  mockDebugLog,
  mockDebugError,
  mockCn,
  singleViewer,
  loadingViewer,
  continuousViewer,
} = vi.hoisted(() => {
  const mockUsePDFViewer = vi.fn();

  const mockDocumentProps: {
    current?: {
      file: string;
      onLoadSuccess?: ({ numPages }: { numPages: number }) => void;
      onLoadError?: (error: Error) => void;
    };
  } = {};

  const createViewer = (overrides?: Partial<{
    currentPage: number;
    numPages: number;
    scale: number;
    viewMode: "single" | "continuous";
    fitMode: "width" | "page";
    showThumbnails: boolean;
    isFullscreen: boolean;
    isLoading: boolean;
  }>) => ({
    containerRef: { current: null as HTMLDivElement | null },
    currentPage: overrides?.currentPage ?? 1,
    numPages: overrides?.numPages ?? 0,
    scale: overrides?.scale ?? 1.25,
    viewMode: overrides?.viewMode ?? "single",
    fitMode: overrides?.fitMode ?? "width",
    showThumbnails: overrides?.showThumbnails ?? false,
    isFullscreen: overrides?.isFullscreen ?? false,
    isLoading: overrides?.isLoading ?? false,
    setLoading: vi.fn(),
    setError: vi.fn(),
    setNumPages: vi.fn(),
    setCurrentPage: vi.fn(),
    fitToWidth: vi.fn(),
    fitToPage: vi.fn(),
    goToPage: vi.fn(),
    prevPage: vi.fn(),
    nextPage: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    toggleFullscreen: vi.fn(),
    toggleViewMode: vi.fn(),
    toggleThumbnails: vi.fn(),
  });

  const loadingViewer = createViewer({ isLoading: true, viewMode: "single", numPages: 0, currentPage: 1 });
  const singleViewer = createViewer({ isLoading: false, viewMode: "single", numPages: 4, currentPage: 1 });
  const continuousViewer = createViewer({
    isLoading: false,
    viewMode: "continuous",
    numPages: 3,
    currentPage: 2,
    showThumbnails: true,
    isFullscreen: true,
    scale: 1.1,
  });

  return {
    mockUsePDFViewer,
    mockDocumentProps,
    mockDebugLog: vi.fn(),
    mockDebugError: vi.fn(),
    mockCn: vi.fn((...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ")),
    loadingViewer,
    singleViewer,
    continuousViewer,
  };
});

vi.mock("./usePDFViewer", () => ({
  usePDFViewer: mockUsePDFViewer,
}));

vi.mock("@/lib/debug", () => ({
  debug: {
    log: mockDebugLog,
    error: mockDebugError,
  },
}));

vi.mock("@/lib/utils", () => ({
  cn: mockCn,
}));

vi.mock("@/lib/pdfjs", () => ({}));

vi.mock("./PDFToolbar", () => ({
  PDFToolbar: (props: {
    filename: string;
    currentPage: number;
    numPages: number;
    isFullscreen: boolean;
    onClose: () => void;
    onDownload: () => void;
  }) => (
    <div data-testid="pdf-toolbar">
      <span>{props.filename}</span>
      <span data-testid="toolbar-page">{props.currentPage}/{props.numPages}</span>
      <span data-testid="toolbar-fullscreen">{props.isFullscreen ? "fullscreen" : "windowed"}</span>
      <button onClick={props.onClose}>close-from-toolbar</button>
      <button onClick={props.onDownload}>download-from-toolbar</button>
    </div>
  ),
}));

vi.mock("./PDFThumbnails", () => ({
  PDFThumbnails: (props: {
    fileUrl: string;
    numPages: number;
    currentPage: number;
  }) => (
    <div data-testid="pdf-thumbnails">
      {props.fileUrl}|{props.numPages}|{props.currentPage}
    </div>
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{props.children}</button>
  ),
}));

vi.mock("lucide-react", () => ({
  Loader2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="loader-icon" {...props} />,
  AlertCircle: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="alert-icon" {...props} />,
  RefreshCw: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="refresh-icon" {...props} />,
}));

vi.mock("react-pdf", () => ({
  Document: (props: {
    file: string;
    onLoadSuccess?: ({ numPages }: { numPages: number }) => void;
    onLoadError?: (error: Error) => void;
    children: React.ReactNode;
    className?: string;
  }) => {
    mockDocumentProps.current = {
      file: props.file,
      onLoadSuccess: props.onLoadSuccess,
      onLoadError: props.onLoadError,
    };
    return (
      <div data-testid="pdf-document" data-file={props.file} className={props.className}>
        {props.children}
      </div>
    );
  },
  Page: (props: {
    pageNumber: number;
    scale: number;
    className?: string;
  }) => (
    <div
      data-testid={`pdf-page-${props.pageNumber}`}
      data-scale={String(props.scale)}
      className={props.className}
    >
      Page {props.pageNumber}
    </div>
  ),
}));

describe("PDFViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDocumentProps.current = undefined;
    vi.useRealTimers();
  });

  it("affiche le chargement initial, rend le document avec les bonnes props puis traite le succès", () => {
    mockUsePDFViewer.mockReturnValue(loadingViewer);
    const onClose = vi.fn();
    const onDownload = vi.fn();

    render(
      <PDFViewer
        url="https://app.local/file.pdf"
        filename="contrat.pdf"
        onClose={onClose}
        onDownload={onDownload}
        className="custom-class"
      />
    );

    expect(screen.getByText("Chargement du PDF...")).toBeInTheDocument();
    expect(screen.getByTestId("pdf-toolbar")).toBeInTheDocument();
    expect(screen.getByText("contrat.pdf")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar-page")).toHaveTextContent("1/0");
    expect(screen.getByTestId("pdf-document")).toHaveAttribute("data-file", "https://app.local/file.pdf");
    expect(screen.getByTestId("pdf-page-1")).toHaveAttribute("data-scale", "1.25");

    expect(loadingViewer.setLoading).toHaveBeenCalledWith(true);
    expect(loadingViewer.setError).toHaveBeenCalledWith(null);
    expect(loadingViewer.setNumPages).toHaveBeenCalledWith(0);
    expect(loadingViewer.setCurrentPage).toHaveBeenCalledWith(1);

    vi.useFakeTimers();

    act(() => {
      mockDocumentProps.current?.onLoadSuccess?.({ numPages: 4 });
    });

    expect(mockDebugLog).toHaveBeenCalledWith("PDF loaded successfully:", 4, "pages");
    expect(loadingViewer.setNumPages).toHaveBeenCalledWith(4);
    expect(loadingViewer.setLoading).toHaveBeenCalledWith(false);

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(loadingViewer.fitToWidth).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "+" });
    fireEvent.keyDown(window, { key: "Escape" });

    expect(loadingViewer.nextPage).toHaveBeenCalledTimes(1);
    expect(loadingViewer.zoomIn).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("download-from-toolbar"));
    expect(onDownload).toHaveBeenCalledTimes(1);
  });

  it("affiche l'état d'erreur métier et permet de réessayer", () => {
    mockUsePDFViewer.mockReturnValue(singleViewer);

    render(
      <PDFViewer
        url="https://app.local/file.pdf"
        filename="erreur.pdf"
        onClose={vi.fn()}
        onDownload={vi.fn()}
      />
    );

    const error = new Error("fetch failed: 403");

    act(() => {
      mockDocumentProps.current?.onLoadError?.(error);
    });

    expect(mockDebugError).toHaveBeenCalledWith("Error loading PDF:", error);
    expect(screen.getByText("Impossible de charger le PDF")).toBeInTheDocument();
    expect(screen.getByText("fetch failed: 403")).toBeInTheDocument();
    expect(screen.getByText("L'URL d'accès a peut-être expiré. Fermez et rouvrez le document.")).toBeInTheDocument();
    expect(singleViewer.setError).toHaveBeenCalledWith("fetch failed: 403");
    expect(singleViewer.setLoading).toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));

    expect(singleViewer.setError).toHaveBeenLastCalledWith(null);
    expect(singleViewer.setLoading).toHaveBeenLastCalledWith(true);
  });

  it("rend le mode continu avec miniatures et gère les raccourcis fullscreen", () => {
    mockUsePDFViewer.mockReturnValue(continuousViewer);
    const onClose = vi.fn();

    render(
      <PDFViewer
        url="https://app.local/guide.pdf"
        filename="guide.pdf"
        onClose={onClose}
        onDownload={vi.fn()}
      />
    );

    expect(screen.getByTestId("pdf-thumbnails")).toHaveTextContent("https://app.local/guide.pdf|3|2");
    expect(screen.getByTestId("toolbar-fullscreen")).toHaveTextContent("fullscreen");
    expect(screen.getByText("Page 1")).toBeInTheDocument();
    expect(screen.getByText("Page 2")).toBeInTheDocument();
    expect(screen.getByText("Page 3")).toBeInTheDocument();
    expect(screen.getAllByText("Page 1")).toHaveLength(1);
    expect(screen.getAllByText("Page 2")).toHaveLength(1);
    expect(screen.getAllByText("Page 3")).toHaveLength(1);
    expect(screen.getByTestId("pdf-page-1")).toHaveAttribute("data-scale", "1.1");
    expect(screen.getByTestId("pdf-page-2")).toHaveAttribute("data-scale", "1.1");
    expect(screen.getByTestId("pdf-page-3")).toHaveAttribute("data-scale", "1.1");

    fireEvent.keyDown(window, { key: "ArrowLeft" });
    fireEvent.keyDown(window, { key: "-" });
    fireEvent.keyDown(window, { key: "f" });
    fireEvent.keyDown(window, { key: "Escape" });

    expect(continuousViewer.prevPage).toHaveBeenCalledTimes(1);
    expect(continuousViewer.zoomOut).toHaveBeenCalledTimes(1);
    expect(continuousViewer.toggleFullscreen).toHaveBeenCalledTimes(2);
    expect(onClose).not.toHaveBeenCalled();
  });
});