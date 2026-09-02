/* @vitest-environment jsdom */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { PreviewThumbnail, formatFileSize, getFileTypeLabel } from "./FinderColumnView.helpers";

const { documentMock, pageMock } = vi.hoisted(() => ({
  documentMock: vi.fn(),
  pageMock: vi.fn(),
}));

vi.mock("@/lib/utils", () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
}));

vi.mock("@/lib/pdfjs", () => ({}));
vi.mock("react-pdf/dist/Page/AnnotationLayer.css", () => ({}));
vi.mock("react-pdf/dist/Page/TextLayer.css", () => ({}));

vi.mock("react-pdf", () => ({
  Document: (props: {
    file: string;
    loading?: React.ReactNode;
    error?: React.ReactNode;
    className?: string;
    children?: React.ReactNode;
  }) => {
    documentMock(props);
    if (props.file === "pdf-error") {
      return <div data-testid="pdf-error">{props.error}</div>;
    }
    if (props.file === "pdf-loading") {
      return <div data-testid="pdf-loading">{props.loading}</div>;
    }
    return (
      <div data-testid="pdf-document" className={props.className}>
        {props.children}
      </div>
    );
  },
  Page: (props: {
    pageNumber: number;
    width: number;
    renderTextLayer: boolean;
    renderAnnotationLayer: boolean;
  }) => {
    pageMock(props);
    return <div data-testid="pdf-page">page-{props.pageNumber}</div>;
  },
}));

describe("FinderColumnView.helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("formatFileSize", () => {
    it("formats bytes under 1 Ko", () => {
      expect(formatFileSize(0)).toBe("0 o");
      expect(formatFileSize(512)).toBe("512 o");
      expect(formatFileSize(1023)).toBe("1023 o");
    });

    it("formats kilobytes", () => {
      expect(formatFileSize(1024)).toBe("1.0 Ko");
      expect(formatFileSize(1536)).toBe("1.5 Ko");
      expect(formatFileSize(1048575)).toBe("1024.0 Ko");
    });

    it("formats megabytes", () => {
      expect(formatFileSize(1024 * 1024)).toBe("1.0 Mo");
      expect(formatFileSize(5 * 1024 * 1024 + 512 * 1024)).toBe("5.5 Mo");
    });

    it("formats gigabytes", () => {
      expect(formatFileSize(1024 * 1024 * 1024)).toBe("1.0 Go");
      expect(formatFileSize(2.5 * 1024 * 1024 * 1024)).toBe("2.5 Go");
    });
  });

  describe("getFileTypeLabel", () => {
    it("returns PDF label", () => {
      expect(getFileTypeLabel("application/pdf")).toBe("Document PDF");
      expect(getFileTypeLabel("application/x-pdf")).toBe("Document PDF");
    });

    it("returns image label", () => {
      expect(getFileTypeLabel("image/png")).toBe("Image");
      expect(getFileTypeLabel("image/jpeg")).toBe("Image");
    });

    it("returns Word label for word/document mime types", () => {
      expect(getFileTypeLabel("application/msword")).toBe("Document Word");
      expect(getFileTypeLabel("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe("Document Word");
      expect(getFileTypeLabel("application/document")).toBe("Document Word");
    });

    it("returns spreadsheet label for excel mime types that do not also match document", () => {
      expect(getFileTypeLabel("application/vnd.ms-excel")).toBe("Feuille de calcul");
      expect(getFileTypeLabel("application/sheet")).toBe("Feuille de calcul");
    });

    it("returns presentation label for powerpoint mime types that do not also match document", () => {
      expect(getFileTypeLabel("application/vnd.ms-powerpoint")).toBe("Présentation");
      expect(getFileTypeLabel("application/presentation")).toBe("Présentation");
    });

    it("prioritizes document match over spreadsheet and presentation in office openxml mime types", () => {
      expect(getFileTypeLabel("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe("Document Word");
      expect(getFileTypeLabel("application/vnd.openxmlformats-officedocument.presentationml.presentation")).toBe("Document Word");
    });

    it("returns generic document label for unknown or empty mime types", () => {
      expect(getFileTypeLabel("text/plain")).toBe("Document");
      expect(getFileTypeLabel("")).toBe("Document");
    });
  });

  describe("PreviewThumbnail", () => {
    it("renders pdf icon fallback when preview URL is absent for a pdf", () => {
      const { container } = render(
        <PreviewThumbnail document={{ mime_type: "application/pdf", name: "report.pdf" }} previewUrl={null} />
      );

      expect(screen.queryByRole("img")).not.toBeInTheDocument();
      expect(screen.queryByTestId("pdf-document")).not.toBeInTheDocument();
      expect(container.querySelector("svg")).not.toBeNull();
    });

    it("renders image icon fallback when preview URL is absent for an image", () => {
      const { container } = render(
        <PreviewThumbnail document={{ mime_type: "image/png", name: "photo.png" }} previewUrl={null} />
      );

      expect(screen.queryByRole("img")).not.toBeInTheDocument();
      expect(screen.queryByTestId("pdf-document")).not.toBeInTheDocument();
      expect(container.querySelector("svg")).not.toBeNull();
    });

    it("renders generic fallback when there is no preview URL and mime type is unknown", () => {
      const { container } = render(
        <PreviewThumbnail document={{ mime_type: "text/plain", name: "note.txt" }} previewUrl={null} />
      );

      expect(container.querySelector("img")).toBeNull();
      expect(screen.queryByTestId("pdf-document")).not.toBeInTheDocument();
      expect(container.querySelector("svg")).not.toBeNull();
    });

    it("renders image preview with loading state then loaded image", () => {
      const { container } = render(
        <PreviewThumbnail document={{ mime_type: "image/png", name: "photo.png" }} previewUrl="image-preview" />
      );

      const img = screen.getByRole("img", { name: "photo.png" });
      expect(img).toHaveAttribute("src", "image-preview");
      expect(img.className).toContain("opacity-0");
      expect(container.querySelector(".animate-spin")).not.toBeNull();

      fireEvent.load(img);

      expect(img.className).toContain("opacity-100");
      expect(container.querySelector(".animate-spin")).toBeNull();
    });

    it("renders image fallback icon when image loading fails", () => {
      const { container } = render(
        <PreviewThumbnail document={{ mime_type: "image/jpeg", name: "broken.jpg" }} previewUrl="broken-image" />
      );

      const img = screen.getByRole("img", { name: "broken.jpg" });
      fireEvent.error(img);

      expect(screen.queryByRole("img", { name: "broken.jpg" })).not.toBeInTheDocument();
      expect(container.querySelector(".animate-spin")).toBeNull();
      expect(container.querySelector("svg")).not.toBeNull();
    });

    it("renders PDF preview through react-pdf components", () => {
      render(
        <PreviewThumbnail document={{ mime_type: "application/pdf", name: "report.pdf" }} previewUrl="pdf-ok" />
      );

      expect(screen.getByTestId("pdf-document")).toBeInTheDocument();
      expect(screen.getByTestId("pdf-page")).toHaveTextContent("page-1");
      expect(documentMock).toHaveBeenCalledWith(
        expect.objectContaining({
          file: "pdf-ok",
          className: "flex items-center justify-center",
        })
      );
      expect(pageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          pageNumber: 1,
          width: 200,
          renderTextLayer: false,
          renderAnnotationLayer: false,
        })
      );
    });

    it("renders PDF loading fallback from Document component", () => {
      const { container } = render(
        <PreviewThumbnail document={{ mime_type: "application/pdf", name: "loading.pdf" }} previewUrl="pdf-loading" />
      );

      expect(screen.getByTestId("pdf-loading")).toBeInTheDocument();
      expect(container.querySelector(".animate-spin")).not.toBeNull();
    });

    it("renders PDF error fallback from Document component", () => {
      const { container } = render(
        <PreviewThumbnail document={{ mime_type: "application/pdf", name: "error.pdf" }} previewUrl="pdf-error" />
      );

      expect(screen.getByTestId("pdf-error")).toBeInTheDocument();
      expect(container.querySelector("svg")).not.toBeNull();
    });

    it("renders non-image non-pdf file icon even with a preview URL", () => {
      const { container } = render(
        <PreviewThumbnail
          document={{ mime_type: "application/octet-stream", name: "archive.bin" }}
          previewUrl="some-preview"
        />
      );

      expect(screen.queryByRole("img")).not.toBeInTheDocument();
      expect(screen.queryByTestId("pdf-document")).not.toBeInTheDocument();
      expect(container.querySelector("svg")).not.toBeNull();
    });
  });
});