// @vitest-environment jsdom
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent, renderHook } from "@testing-library/react";
import { DocumentBrowser } from "./DocumentBrowser";

const {
  DOCS,
  EMPTY_DOCS,
  ERROR_DOCS,
  MIME_TYPE_CATEGORIES_MOCK,
  useDocumentsMock,
  documentCardSpy,
  documentUploadSpy,
} = vi.hoisted(() => ({
  DOCS: [
    { id: "doc-1", name: "Contrat.pdf", mime_type: "application/pdf", file_size_bytes: 1200, created_at: "2024-01-01", updated_at: "2024-01-02" },
    { id: "doc-2", name: "Photo.png", mime_type: "image/png", file_size_bytes: 3400, created_at: "2024-01-03", updated_at: "2024-01-04" },
  ],
  EMPTY_DOCS: [],
  ERROR_DOCS: [],
  MIME_TYPE_CATEGORIES_MOCK: {
    pdf: ["application/pdf"],
    image: ["image/png", "image/jpeg"],
    word: ["application/msword"],
    excel: ["application/vnd.ms-excel"],
    powerpoint: ["application/vnd.ms-powerpoint"],
    text: ["text/plain"],
    video: ["video/mp4"],
    audio: ["audio/mpeg"],
  },
  useDocumentsMock: vi.fn(),
  documentCardSpy: vi.fn(),
  documentUploadSpy: vi.fn(),
}));

vi.mock("lucide-react", () => {
  const Icon = ({ className }: { className?: string }) => React.createElement("svg", { "data-testid": "icon", className });
  return {
    Search: Icon,
    Filter: Icon,
    LayoutGrid: Icon,
    List: Icon,
    SortAsc: Icon,
    FolderOpen: Icon,
    Loader2: Icon,
    FileX: Icon,
  };
});

vi.mock("@/lib/utils", () => ({
  cn: (...args: Array<string | false | null | undefined>) => args.filter(Boolean).join(" "),
}));

vi.mock("@/hooks/documents/useDocuments", () => ({
  useDocuments: useDocumentsMock,
}));

vi.mock("@/types/documents", () => ({
  MIME_TYPE_CATEGORIES: MIME_TYPE_CATEGORIES_MOCK,
}));

vi.mock("./DocumentCard", () => ({
  DocumentCard: ({
    document,
    viewMode,
    onPreview,
  }: {
    document: { id: string; name: string };
    viewMode: "grid" | "list";
    onPreview?: (document: { id: string; name: string }) => void;
  }) => {
    documentCardSpy({ document, viewMode, onPreview });
    return (
      <button
        data-testid={`document-card-${document.id}`}
        data-viewmode={viewMode}
        onClick={() => onPreview?.(document)}
      >
        {document.name}
      </button>
    );
  },
}));

vi.mock("./DocumentUpload", () => ({
  DocumentUpload: ({ options }: { options: Record<string, string | undefined> }) => {
    documentUploadSpy(options);
    return <div data-testid="document-upload">upload</div>;
  },
}));

vi.mock("@/components/ui/input", () => ({
  Input: ({
    value,
    onChange,
    placeholder,
    className,
  }: {
    value?: string;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    placeholder?: string;
    className?: string;
  }) => (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
    />
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    className,
    variant,
    size,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: string;
    size?: string;
  }) => (
    <button onClick={onClick} className={className} data-variant={variant} data-size={size} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({
    children,
    className,
  }: {
    children?: React.ReactNode;
    className?: string;
    variant?: string;
  }) => <span className={className}>{children}</span>,
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    value,
    onValueChange,
  }: {
    children?: React.ReactNode;
    value?: string;
    onValueChange?: (value: string) => void;
  }) => (
    <div data-testid="select-root" data-value={value} data-onchange={String(Boolean(onValueChange))}>
      {children}
    </div>
  ),
  SelectTrigger: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <button className={className}>{children}</button>
  ),
  SelectValue: () => <span>select-value</span>,
  SelectContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({
    children,
    value,
  }: {
    children?: React.ReactNode;
    value: string;
  }) => <div data-testid={`select-item-${value}`}>{children}</div>,
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children?: React.ReactNode; asChild?: boolean }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children?: React.ReactNode; align?: string; className?: string }) => <div>{children}</div>,
  DropdownMenuLabel: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuCheckboxItem: ({
    children,
    checked,
    onCheckedChange,
  }: {
    children?: React.ReactNode;
    checked?: boolean;
    onCheckedChange?: () => void;
  }) => (
    <button type="button" aria-pressed={checked} onClick={onCheckedChange}>
      {children}
    </button>
  ),
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

describe("DocumentBrowser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("crée correctement le wrapper QueryClientProvider pour les hooks", () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => 42, { wrapper });
    expect(result.current).toBe(42);
  });

  it("affiche le loader pendant le chargement", () => {
    useDocumentsMock.mockReturnValue({
      data: EMPTY_DOCS,
      isLoading: true,
      error: null,
    });

    render(<DocumentBrowser />, { wrapper: createWrapper() });

    expect(screen.getByPlaceholderText("Rechercher des documents...")).toBeInTheDocument();
    expect(screen.getByTestId("document-upload")).toBeInTheDocument();
    expect(screen.queryByText("Erreur lors du chargement des documents")).not.toBeInTheDocument();
    expect(screen.queryByText("Aucun document")).not.toBeInTheDocument();
    expect(screen.queryByTestId("document-card-doc-1")).not.toBeInTheDocument();
  });

  it("affiche les documents, transmet les filtres métier et permet la sélection d'un document", () => {
    useDocumentsMock.mockReturnValue({
      data: DOCS,
      isLoading: false,
      error: null,
    });

    const onDocumentSelect = vi.fn();

    render(
      <DocumentBrowser
        relatedEtablissementId="eta-1"
        relatedTacheId="task-1"
        relatedProfileId="profile-1"
        onDocumentSelect={onDocumentSelect}
      />,
      { wrapper: createWrapper() }
    );

    expect(documentUploadSpy).toHaveBeenCalledWith({
      relatedEtablissementId: "eta-1",
      relatedTacheId: "task-1",
      relatedProfileId: "profile-1",
    });

    expect(useDocumentsMock).toHaveBeenCalledWith(
      {
        relatedEtablissementId: "eta-1",
        relatedTacheId: "task-1",
        relatedProfileId: "profile-1",
      },
      { field: "created_at", order: "desc" }
    );

    expect(screen.getByTestId("document-card-doc-1")).toHaveTextContent("Contrat.pdf");
    expect(screen.getByTestId("document-card-doc-2")).toHaveTextContent("Photo.png");
    expect(screen.getByText("2 documents")).toBeInTheDocument();

    const firstCall = documentCardSpy.mock.calls[0]?.[0] as { viewMode: string };
    const secondCall = documentCardSpy.mock.calls[1]?.[0] as { viewMode: string };
    expect(firstCall.viewMode).toBe("grid");
    expect(secondCall.viewMode).toBe("grid");

    fireEvent.click(screen.getByTestId("document-card-doc-1"));
    expect(onDocumentSelect).toHaveBeenCalledWith(DOCS[0]);
  });

  it("applique la recherche à partir de 2 caractères, filtre MIME, efface les filtres et bascule en vue liste", () => {
    useDocumentsMock.mockReturnValue({
      data: DOCS,
      isLoading: false,
      error: null,
    });

    render(<DocumentBrowser />, { wrapper: createWrapper() });

    const search = screen.getByPlaceholderText("Rechercher des documents...");
    fireEvent.change(search, { target: { value: "a" } });

    let lastCall = useDocumentsMock.mock.calls.at(-1);
    expect(lastCall?.[0]).toEqual({});

    fireEvent.change(search, { target: { value: "ab" } });
    lastCall = useDocumentsMock.mock.calls.at(-1);
    expect(lastCall?.[0]).toEqual({ search: "ab" });

    fireEvent.click(screen.getByRole("button", { name: "PDF" }));
    lastCall = useDocumentsMock.mock.calls.at(-1);
    expect(lastCall?.[0]).toEqual({
      search: "ab",
      mimeTypes: ["application/pdf"],
    });

    expect(screen.getByText("Effacer les filtres")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Liste" }));
    const listModeCalls = documentCardSpy.mock.calls
      .map((call) => call[0] as { viewMode: string })
      .filter((call) => call.viewMode === "list");
    expect(listModeCalls.length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText("Effacer les filtres"));
    lastCall = useDocumentsMock.mock.calls.at(-1);
    expect(lastCall?.[0]).toEqual({});
  });

  it("affiche l'état d'erreur avec le message retourné par le hook", () => {
    useDocumentsMock.mockReturnValue({
      data: ERROR_DOCS,
      isLoading: false,
      error: { message: "x" },
    });

    render(<DocumentBrowser />, { wrapper: createWrapper() });

    expect(screen.getByText("Erreur lors du chargement des documents")).toBeInTheDocument();
    expect(screen.getByText("x")).toBeInTheDocument();
    expect(screen.queryByText("Aucun document")).not.toBeInTheDocument();
    expect(screen.queryByText("0 document")).not.toBeInTheDocument();
  });

  it("affiche l'état vide et masque l'upload en mode compact ou si showUpload=false", () => {
    useDocumentsMock.mockReturnValue({
      data: EMPTY_DOCS,
      isLoading: false,
      error: null,
    });

    const { rerender } = render(<DocumentBrowser compact />, { wrapper: createWrapper() });

    expect(screen.getByText("Aucun document")).toBeInTheDocument();
    expect(screen.getByText("Uploadez votre premier document")).toBeInTheDocument();
    expect(screen.queryByTestId("document-upload")).not.toBeInTheDocument();

    rerender(<DocumentBrowser showUpload={false} />);
    expect(screen.queryByTestId("document-upload")).not.toBeInTheDocument();
  });
});