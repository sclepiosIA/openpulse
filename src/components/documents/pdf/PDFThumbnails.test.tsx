import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PDFThumbnails } from "./PDFThumbnails";

const { mockCn, mockScrollArea, mockDocument, mockPage } = vi.hoisted(() => {
  return {
    mockCn: vi.fn((...classes: unknown[]) => classes.filter(Boolean).join(" ")),
    mockScrollArea: vi.fn(({ children }: { children: React.ReactNode }) => (
      <div data-testid="scroll-area">{children}</div>
    )),
    mockDocument: vi.fn(({ children }: { children: React.ReactNode; file: string; loading: unknown; error: unknown }) => (
      <div data-testid="pdf-document">{children}</div>
    )),
    mockPage: vi.fn(
      ({
        pageNumber,
        loading,
      }: {
        pageNumber: number;
        loading?: React.ReactNode;
      }) => (
        <div data-testid={`pdf-page-${pageNumber}`}>
          <div data-testid={`pdf-page-loading-${pageNumber}`}>{loading}</div>
        </div>
      )
    ),
  };
});

vi.mock("@/lib/utils", () => ({
  cn: (...classes: unknown[]) => mockCn(...classes),
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: (props: { children: React.ReactNode; className?: string }) =>
    mockScrollArea(props),
}));

vi.mock("react-pdf", () => ({
  Document: (props: { children: React.ReactNode; file: string; loading: unknown; error: unknown }) =>
    mockDocument(props),
  Page: (props: {
    pageNumber: number;
    width?: number;
    renderTextLayer?: boolean;
    renderAnnotationLayer?: boolean;
    loading?: React.ReactNode;
  }) => mockPage(props),
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function renderWithClient(ui: React.ReactElement) {
  const client = createQueryClient();
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>
  );
}

describe("PDFThumbnails", () => {
  it("renders the correct number of thumbnail pages and marks the current page as active", () => {
    const handlePageClick = vi.fn();
    renderWithClient(
      <PDFThumbnails
        fileUrl="test-file.pdf"
        numPages={3}
        currentPage={2}
        onPageClick={handlePageClick}
        className="custom-class"
      />
    );

    expect(screen.getByText("Pages")).toBeInTheDocument();
    expect(screen.getByTestId("pdf-document")).toBeInTheDocument();

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(3);

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();

    const secondButton = buttons[1];
    expect(secondButton.className).toContain("bg-primary/10");
    expect(secondButton.className).toContain("ring-2");
    expect(secondButton.className).toContain("ring-primary");

    expect(mockCn).toHaveBeenCalled();
    const firstCallArgs = mockCn.mock.calls[0];
    expect(firstCallArgs[0]).toContain("w-[120px] border-r bg-muted/30");
    expect(firstCallArgs).toContain("custom-class");
  });

  it("calls onPageClick with the correct page number when a thumbnail is clicked", () => {
    const handlePageClick = vi.fn();
    renderWithClient(
      <PDFThumbnails
        fileUrl="test-file.pdf"
        numPages={4}
        currentPage={1}
        onPageClick={handlePageClick}
      />
    );

    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[2]);

    expect(handlePageClick).toHaveBeenCalledTimes(1);
    expect(handlePageClick).toHaveBeenCalledWith(3);
  });

  it("renders loading placeholder for each Page via the loading prop", () => {
    const handlePageClick = vi.fn();
    renderWithClient(
      <PDFThumbnails
        fileUrl="test-file.pdf"
        numPages={2}
        currentPage={1}
        onPageClick={handlePageClick}
      />
    );

    expect(screen.getByTestId("pdf-page-loading-1")).toBeInTheDocument();
    expect(screen.getByTestId("pdf-page-loading-2")).toBeInTheDocument();
  });

  it("passes the fileUrl to Document component (at least one call)", () => {
    const handlePageClick = vi.fn();
    renderWithClient(
      <PDFThumbnails
        fileUrl="another-file.pdf"
        numPages={1}
        currentPage={1}
        onPageClick={handlePageClick}
      />
    );

    expect(mockDocument).toHaveBeenCalled();
    const foundCall = mockDocument.mock.calls.find(
      (call) => call[0]?.file === "another-file.pdf"
    );
    expect(foundCall).toBeDefined();
    expect(foundCall?.[0].file).toBe("another-file.pdf");
  });

  it("renders no pages when numPages is zero", () => {
    const handlePageClick = vi.fn();
    renderWithClient(
      <PDFThumbnails
        fileUrl="empty.pdf"
        numPages={0}
        currentPage={1}
        onPageClick={handlePageClick}
      />
    );

    const buttons = screen.queryAllByRole("button");
    expect(buttons).toHaveLength(0);
  });
});