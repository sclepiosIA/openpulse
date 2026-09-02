// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { InlineDocumentPreview } from "./InlineDocumentPreview";

const {
  documentLoadMode,
  fetchMock,
  onOpenFullPreview,
} = vi.hoisted(() => ({
  documentLoadMode: { current: "success" as "success" | "error" },
  fetchMock: vi.fn(),
  onOpenFullPreview: vi.fn(),
}));

vi.mock("@/lib/utils", () => ({
  cn: (...classes: Array<string | undefined | null | false>) => classes.filter(Boolean).join(" "),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    ariaLabel,
    "aria-label": ariaLabelProp,
    title,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    ariaLabel?: string;
    "aria-label"?: string;
    title?: string;
    className?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabelProp ?? ariaLabel}
      title={title}
      className={className}
    >
      {children}
    </button>
  ),
}));

vi.mock("lucide-react", () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />;
  return {
    Loader2: Icon,
    ZoomIn: Icon,
    ZoomOut: Icon,
    RotateCw: Icon,
    ChevronLeft: Icon,
    ChevronRight: Icon,
    Maximize2: Icon,
    FileText: Icon,
    FileImage: Icon,
    File: Icon,
    FileSpreadsheet: Icon,
    Presentation: Icon,
  };
});

vi.mock("react-pdf", () => ({
  Document: ({
    children,
    onLoadSuccess,
    onLoadError,
    file,
  }: {
    children: React.ReactNode;
    onLoadSuccess?: (v: { numPages: number }) => void;
    onLoadError?: () => void;
    file: string;
  }) => {
    React.useEffect(() => {
      if (documentLoadMode.current === "success") {
        onLoadSuccess?.({ numPages: 3 });
      } else {
        onLoadError?.();
      }
    }, [onLoadSuccess, onLoadError, file]);
    return <div data-testid="pdf-document">{children}</div>;
  },
  Page: ({ pageNumber, width }: { pageNumber: number; width: number }) => (
    <div data-testid="pdf-page">
      page:{pageNumber}-width:{width}
    </div>
  ),
}));

vi.mock("react-pdf/dist/Page/AnnotationLayer.css", () => ({}));
vi.mock("react-pdf/dist/Page/TextLayer.css", () => ({}));
vi.mock("@/lib/pdfjs", () => ({}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("InlineDocumentPreview", () => {
  beforeEach(() => {
    documentLoadMode.current = "success";
    onOpenFullPreview.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("affiche un loader quand loading=true", () => {
    const Wrapper = createWrapper();

    const { container } = render(
      <Wrapper>
        <InlineDocumentPreview
          url="https://local.test/file.pdf"
          mimeType="application/pdf"
          fileName="doc.pdf"
          loading
        />
      </Wrapper>
    );

    expect(container.querySelector(".animate-spin")).toBeTruthy();
    expect(screen.queryByTestId("pdf-document")).toBeNull();
  });

  it("affiche une icône de fallback quand url est null", () => {
    const Wrapper = createWrapper();

    render(
      <Wrapper>
        <InlineDocumentPreview
          url={null}
          mimeType="application/pdf"
          fileName="doc.pdf"
        />
      </Wrapper>
    );

    expect(screen.getByTestId("icon")).toBeInTheDocument();
    expect(screen.queryByTestId("pdf-document")).toBeNull();
  });

  it("rend un aperçu PDF, charge les pages et permet la navigation", async () => {
    const Wrapper = createWrapper();

    render(
      <Wrapper>
        <InlineDocumentPreview
          url="https://local.test/file.pdf"
          mimeType="application/pdf"
          fileName="doc.pdf"
          maxWidth={340}
          onOpenFullPreview={onOpenFullPreview}
        />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByText("1 / 3")).toBeInTheDocument();
    });

    expect(screen.getByTestId("pdf-page")).toHaveTextContent("page:1-width:324");

    const prevButton = screen.getByRole("button", { name: "Précédent" });
    const nextButton = screen.getByRole("button", { name: "Suivant" });
    const expandButton = screen.getByRole("button", { name: "Agrandir" });

    expect(prevButton).toBeDisabled();
    expect(nextButton).not.toBeDisabled();

    fireEvent.click(nextButton);
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    expect(screen.getByTestId("pdf-page")).toHaveTextContent("page:2-width:324");

    fireEvent.click(nextButton);
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
    expect(nextButton).toBeDisabled();

    fireEvent.click(prevButton);
    expect(screen.getByText("2 / 3")).toBeInTheDocument();

    fireEvent.click(expandButton);
    expect(onOpenFullPreview).toHaveBeenCalledTimes(1);
  });

  it("affiche une erreur quand le PDF ne peut pas être chargé", async () => {
    documentLoadMode.current = "error";
    const Wrapper = createWrapper();

    render(
      <Wrapper>
        <InlineDocumentPreview
          url="https://local.test/broken.pdf"
          mimeType="application/pdf"
          fileName="broken.pdf"
        />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByText("Impossible de charger le PDF")).toBeInTheDocument();
    });

    expect(screen.queryByText("1 / 3")).toBeNull();
  });

  it("rend un aperçu image, gère le chargement, le zoom, la rotation et l'ouverture plein écran", async () => {
    const Wrapper = createWrapper();

    const { container } = render(
      <Wrapper>
        <InlineDocumentPreview
          url="https://local.test/image.png"
          mimeType="image/png"
          fileName="preview.png"
          onOpenFullPreview={onOpenFullPreview}
        />
      </Wrapper>
    );

    const image = screen.getByAltText("preview.png");
    expect(container.querySelector(".animate-spin")).toBeTruthy();

    fireEvent.load(image);

    await waitFor(() => {
      expect(screen.getByText("100%")).toBeInTheDocument();
    });

    const zoomIn = screen.getByRole("button", { name: "Zoomer" });
    const zoomOut = screen.getByRole("button", { name: "Dézoomer" });
    const rotate = screen.getByRole("button", { name: "Actualiser" });
    const expand = screen.getByRole("button", { name: "Agrandir" });

    expect(image).toHaveStyle({ transform: "scale(1) rotate(0deg)" });

    fireEvent.click(zoomIn);
    expect(screen.getByText("125%")).toBeInTheDocument();
    expect(image).toHaveStyle({ transform: "scale(1.25) rotate(0deg)" });

    fireEvent.click(zoomOut);
    expect(screen.getByText("100%")).toBeInTheDocument();

    fireEvent.click(rotate);
    expect(image).toHaveStyle({ transform: "scale(1) rotate(90deg)" });

    fireEvent.click(image);
    fireEvent.click(expand);
    expect(onOpenFullPreview).toHaveBeenCalledTimes(2);
  });

  it("affiche une erreur quand l'image ne peut pas être chargée", async () => {
    const Wrapper = createWrapper();

    render(
      <Wrapper>
        <InlineDocumentPreview
          url="https://local.test/broken-image.png"
          mimeType="image/png"
          fileName="broken-image.png"
        />
      </Wrapper>
    );

    fireEvent.error(screen.getByAltText("broken-image.png"));

    await waitFor(() => {
      expect(screen.getByText("Impossible de charger l'image")).toBeInTheDocument();
    });
  });

  it("rend une vidéo avec controls pour un mime vidéo", () => {
    const Wrapper = createWrapper();

    const { container } = render(
      <Wrapper>
        <InlineDocumentPreview
          url="https://local.test/video.mp4"
          mimeType="video/mp4"
          fileName="video.mp4"
        />
      </Wrapper>
    );

    const video = container.querySelector("video");
    expect(video).toBeTruthy();
    expect(video?.getAttribute("src")).toBe("https://local.test/video.mp4");
    expect(video?.getAttribute("preload")).toBe("metadata");
  });

  it("rend un lecteur audio pour un mime audio", () => {
    const Wrapper = createWrapper();

    const { container } = render(
      <Wrapper>
        <InlineDocumentPreview
          url="https://local.test/audio.mp3"
          mimeType="audio/mpeg"
          fileName="audio.mp3"
        />
      </Wrapper>
    );

    const audio = container.querySelector("audio");
    expect(audio).toBeTruthy();
    expect(audio?.getAttribute("src")).toBe("https://local.test/audio.mp3");
    expect(audio?.getAttribute("preload")).toBe("metadata");
  });

  it("charge et affiche un aperçu texte avec contenu tronqué à 3000 caractères", async () => {
    const Wrapper = createWrapper();
    const longText = "a".repeat(3001);

    fetchMock.mockResolvedValue({
      text: () => Promise.resolve(longText),
    });

    render(
      <Wrapper>
        <InlineDocumentPreview
          url="https://local.test/file.txt"
          mimeType="text/plain"
          fileName="file.txt"
        />
      </Wrapper>
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("https://local.test/file.txt");
    });

    const pre = await screen.findByText(/… \(tronqué\)/);
    expect(pre.tagName).toBe("PRE");
    expect(pre.textContent).toBe(`${"a".repeat(3000)}\n\n… (tronqué)`);
    expect(pre.textContent?.startsWith("a".repeat(3000))).toBe(true);
    expect(pre.textContent?.endsWith("… (tronqué)")).toBe(true);
  });

  it("affiche une erreur quand le texte ne peut pas être chargé", async () => {
    const Wrapper = createWrapper();

    fetchMock.mockRejectedValue(new Error("network fail"));

    render(
      <Wrapper>
        <InlineDocumentPreview
          url="https://local.test/file.json"
          mimeType="application/json"
          fileName="file.json"
        />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByText("Impossible de charger le fichier")).toBeInTheDocument();
    });
  });

  it("affiche le message pour un document office et appelle onOpenFullPreview", () => {
    const Wrapper = createWrapper();

    render(
      <Wrapper>
        <InlineDocumentPreview
          url="https://local.test/sheet.xlsx"
          mimeType="application/vnd.ms-excel"
          fileName="sheet.xlsx"
          onOpenFullPreview={onOpenFullPreview}
        />
      </Wrapper>
    );

    expect(screen.getByText("Aperçu non disponible pour ce format")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ouvrir" }));
    expect(onOpenFullPreview).toHaveBeenCalledTimes(1);
  });

  it("affiche le type mime en fallback pour un format inconnu", () => {
    const Wrapper = createWrapper();

    render(
      <Wrapper>
        <InlineDocumentPreview
          url="https://local.test/archive.bin"
          mimeType="application/x-custom"
          fileName="archive.bin"
        />
      </Wrapper>
    );

    expect(screen.getByText("application/x-custom")).toBeInTheDocument();
  });
});