import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const {
  ETABS,
  mockUseEtablissementsWithDocuments,
  mockDocumentBrowser,
  mockFolder,
  mockListItem,
  mockInput,
  mockButton,
  mockToggleGroup,
  mockToggleGroupItem,
  mockBreadcrumb,
  mockBreadcrumbList,
  mockBreadcrumbItem,
  mockBreadcrumbLink,
  mockBreadcrumbPage,
  mockBreadcrumbSeparator,
  mockCn,
  mockFrom,
} = vi.hoisted(() => {
  const ETABS = [
    { id: "e1", nom: "Clinique Alpha", ville: "Lyon", groupe_nom: "Groupe Nord", document_count: 2 },
    { id: "e2", nom: "Hôpital Beta", ville: "Paris", groupe_nom: "Groupe Sud", document_count: 3 },
  ];

  const mockUseEtablissementsWithDocuments = vi.fn<
    [],
    [{ data?: typeof ETABS; isLoading: boolean; error: unknown }]
  >();

  const mockDocumentBrowser = vi.fn<
    [props: { relatedEtablissementId: string; showUpload: boolean }],
    React.JSX.Element
  >(({ relatedEtablissementId, showUpload }) => (
    <div data-testid="document-browser">
      <div data-testid="document-browser-related">{relatedEtablissementId}</div>
      <div data-testid="document-browser-upload">{String(showUpload)}</div>
    </div>
  ));

  const mockFolder = vi.fn<
    [props: { etablissement: (typeof ETABS)[number]; onClick: () => void }],
    React.JSX.Element
  >(({ etablissement, onClick }) => (
    <button type="button" data-testid={`folder-${etablissement.id}`} onClick={onClick}>
      {etablissement.nom}
    </button>
  ));

  const mockListItem = vi.fn<
    [props: { etablissement: (typeof ETABS)[number]; onClick: () => void }],
    React.JSX.Element
  >(({ etablissement, onClick }) => (
    <button type="button" data-testid={`listitem-${etablissement.id}`} onClick={onClick}>
      {etablissement.nom}
    </button>
  ));

  const mockInput = vi.fn<
    [props: React.InputHTMLAttributes<HTMLInputElement> & { className?: string }],
    React.JSX.Element
  >((props) => <input data-testid="search-input" {...props} />);

  const mockButton = vi.fn<
    [
      props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
        variant?: string;
        size?: string;
        className?: string;
      },
    ],
    React.JSX.Element
  >(({ children, ...props }) => (
    <button type="button" {...props}>
      {children}
    </button>
  ));

  const mockToggleGroup = vi.fn<
    [
      props: {
        type: "single" | "multiple";
        value?: string;
        onValueChange?: (v: string) => void;
        className?: string;
        children?: React.ReactNode;
      },
    ],
    React.JSX.Element
  >(({ children, ...props }) => (
    <div data-testid="toggle-group" data-value={props.value ?? ""}>
      {children}
    </div>
  ));

  const mockToggleGroupItem = vi.fn<
    [
      props: {
        value: string;
        "aria-label"?: string;
        className?: string;
        children?: React.ReactNode;
      },
    ],
    React.JSX.Element
  >(({ value, children, ...props }) => (
    <button
      type="button"
      data-testid={`toggle-${value}`}
      aria-label={props["aria-label"]}
      onClick={() => {
        const tg = document.querySelector('[data-testid="toggle-group"]') as HTMLElement | null;
        const current = tg?.getAttribute("data-value") ?? "";
        if (current === value) return;
        tg?.setAttribute("data-value", value);
        const evt = new CustomEvent("toggle", { detail: value });
        tg?.dispatchEvent(evt);
      }}
    >
      {children}
    </button>
  ));

  const wrap =
    (testId: string) =>
    ({ children }: { children?: React.ReactNode }) =>
      <div data-testid={testId}>{children}</div>;

  const mockBreadcrumb = vi.fn<[props: { children?: React.ReactNode }], React.JSX.Element>(wrap("breadcrumb"));
  const mockBreadcrumbList = vi.fn<[props: { children?: React.ReactNode }], React.JSX.Element>(wrap("breadcrumb-list"));
  const mockBreadcrumbItem = vi.fn<[props: { children?: React.ReactNode }], React.JSX.Element>(wrap("breadcrumb-item"));
  const mockBreadcrumbLink = vi.fn<
    [props: { children?: React.ReactNode; onClick?: () => void; className?: string }],
    React.JSX.Element
  >(({ children, onClick, className }) => (
    <button type="button" data-testid="breadcrumb-link" className={className} onClick={onClick}>
      {children}
    </button>
  ));
  const mockBreadcrumbPage = vi.fn<
    [props: { children?: React.ReactNode; className?: string }],
    React.JSX.Element
  >(({ children, className }) => (
    <span data-testid="breadcrumb-page" className={className}>
      {children}
    </span>
  ));
  const mockBreadcrumbSeparator = vi.fn<[props: { children?: React.ReactNode }], React.JSX.Element>(
    wrap("breadcrumb-separator")
  );

  const mockCn = vi.fn<[...classes: Array<string | false | null | undefined>], string>((...classes) =>
    classes.filter(Boolean).join(" ")
  );

  const createBuilder = () => {
    const builder: Record<string, unknown> = {};
    const chain = (name: string) =>
      vi.fn((...args: unknown[]) => {
        builder[`__last_${name}`] = args;
        return builder;
      });

    builder.select = chain("select");
    builder.eq = chain("eq");
    builder.gte = chain("gte");
    builder.lte = chain("lte");
    builder.in = chain("in");
    builder.order = chain("order");
    builder.limit = chain("limit");
    builder.insert = chain("insert");
    builder.update = chain("update");
    builder.delete = chain("delete");
    builder.upsert = chain("upsert");

    builder.single = vi.fn(async () => ({ data: null, error: null }));
    builder.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
    builder.then = (
      onFulfilled?: ((v: unknown) => unknown) | null,
      onRejected?: ((e: unknown) => unknown) | null
    ) => Promise.resolve({ data: null, error: null }).then(onFulfilled as never, onRejected as never);
    builder.catch = (onRejected?: ((e: unknown) => unknown) | null) =>
      Promise.resolve({ data: null, error: null }).catch(onRejected as never);

    return builder;
  };

  const mockFrom = vi.fn((_table: string) => createBuilder() as never);

  return {
    ETABS,
    mockUseEtablissementsWithDocuments,
    mockDocumentBrowser,
    mockFolder,
    mockListItem,
    mockInput,
    mockButton,
    mockToggleGroup,
    mockToggleGroupItem,
    mockBreadcrumb,
    mockBreadcrumbList,
    mockBreadcrumbItem,
    mockBreadcrumbLink,
    mockBreadcrumbPage,
    mockBreadcrumbSeparator,
    mockCn,
    mockFrom,
  };
});

vi.mock("lucide-react", async () => {
  const ReactMod = await import("react");
  const mk = (name: string) => (props: Record<string, unknown>) => ReactMod.createElement("svg", { "data-icon": name, ...props });
  return {
    Search: mk("Search"),
    ChevronRight: mk("ChevronRight"),
    Building2: mk("Building2"),
    Loader2: mk("Loader2"),
    FolderOpen: mk("FolderOpen"),
    ArrowLeft: mk("ArrowLeft"),
    LayoutGrid: mk("LayoutGrid"),
    List: mk("List"),
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getSession: vi.fn(async () => ({ data: { session: { user: { id: "u1" } } }, error: null })),
    },
  },
}));

vi.mock("@/lib/utils", () => ({ cn: mockCn }));

vi.mock("@/hooks/documents/useEtablissementsWithDocuments", () => ({
  useEtablissementsWithDocuments: () => mockUseEtablissementsWithDocuments(),
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.ComponentProps<"input">) => mockInput(props),
}));

vi.mock("@/components/ui/button", () => ({
  Button: (
    props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
      variant?: string;
      size?: string;
      className?: string;
    }
  ) => mockButton(props),
}));

vi.mock("@/components/ui/toggle-group", () => ({
  ToggleGroup: (props: {
    type: "single" | "multiple";
    value?: string;
    onValueChange?: (v: string) => void;
    className?: string;
    children?: React.ReactNode;
  }) => {
    React.useEffect(() => {
      const el = document.querySelector('[data-testid="toggle-group"]');
      if (!el) return;
      const handler = (e: Event) => {
        const ce = e as CustomEvent<string>;
        props.onValueChange?.(ce.detail);
      };
      el.addEventListener("toggle", handler as EventListener);
      return () => el.removeEventListener("toggle", handler as EventListener);
    }, [props.onValueChange]);
    return mockToggleGroup(props);
  },
  ToggleGroupItem: (props: { value: string; "aria-label"?: string; className?: string; children?: React.ReactNode }) =>
    mockToggleGroupItem(props),
}));

vi.mock("@/components/ui/breadcrumb", () => ({
  Breadcrumb: (p: { children?: React.ReactNode }) => mockBreadcrumb(p),
  BreadcrumbList: (p: { children?: React.ReactNode }) => mockBreadcrumbList(p),
  BreadcrumbItem: (p: { children?: React.ReactNode }) => mockBreadcrumbItem(p),
  BreadcrumbLink: (p: { children?: React.ReactNode; onClick?: () => void; className?: string }) => mockBreadcrumbLink(p),
  BreadcrumbPage: (p: { children?: React.ReactNode; className?: string }) => mockBreadcrumbPage(p),
  BreadcrumbSeparator: (p: { children?: React.ReactNode }) => mockBreadcrumbSeparator(p),
}));

vi.mock("./EtablissementDocumentFolder", () => ({
  EtablissementDocumentFolder: (props: { etablissement: (typeof ETABS)[number]; onClick: () => void }) =>
    mockFolder(props),
}));

vi.mock("./EtablissementDocumentListItem", () => ({
  EtablissementDocumentListItem: (props: { etablissement: (typeof ETABS)[number]; onClick: () => void }) =>
    mockListItem(props),
}));

vi.mock("./DocumentBrowser", () => ({
  DocumentBrowser: (props: { relatedEtablissementId: string; showUpload: boolean }) => mockDocumentBrowser(props),
}));

import { DocumentFolderBrowser } from "./DocumentFolderBrowser";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("DocumentFolderBrowser", () => {
  it("affiche le loader en chargement, puis succès avec stats et filtrage multi-mots", () => {
    mockUseEtablissementsWithDocuments.mockReturnValue({ data: undefined, isLoading: true, error: null });

    const Wrapper = createWrapper();
    const { rerender } = render(<DocumentFolderBrowser />, { wrapper: Wrapper });

    expect(document.querySelector(".animate-spin")).not.toBeNull();

    mockUseEtablissementsWithDocuments.mockReturnValue({ data: ETABS, isLoading: false, error: null });
    rerender(<DocumentFolderBrowser />);

    const stats = document.querySelector(".text-sm.text-muted-foreground");
    expect(stats?.textContent?.includes("2")).toBe(true);
    expect(stats?.textContent?.includes("5")).toBe(true);

    expect(screen.getByTestId("folder-e1")).toBeTruthy();
    expect(screen.getByTestId("folder-e2")).toBeTruthy();

    const input = screen.getByTestId("search-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "paris sud" } });

    expect(screen.queryByTestId("folder-e1")).toBeNull();
    expect(screen.getByTestId("folder-e2")).toBeTruthy();
  });

  it("bascule en vue liste, navigue vers un établissement puis retour racine", async () => {
    mockUseEtablissementsWithDocuments.mockReturnValue({ data: ETABS, isLoading: false, error: null });

    const Wrapper = createWrapper();
    render(<DocumentFolderBrowser />, { wrapper: Wrapper });

    expect(screen.getByTestId("folder-e1")).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByTestId("toggle-list"));
    });

    expect(screen.queryByTestId("folder-e1")).toBeNull();
    expect(screen.getByTestId("listitem-e1")).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByTestId("listitem-e2"));
    });

    expect(screen.getByTestId("document-browser")).toBeTruthy();
    expect(screen.getByTestId("document-browser-related").textContent).toBe("e2");
    expect(screen.getByTestId("document-browser-upload").textContent).toBe("true");
    expect(screen.getByTestId("breadcrumb-page").textContent?.includes("Hôpital Beta")).toBe(true);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Retour aux établissements/i }));
    });

    expect(screen.queryByTestId("document-browser")).toBeNull();
    expect(screen.getByTestId("search-input")).toBeTruthy();
  });

  it("affiche un état d'erreur quand le hook remonte une erreur", () => {
    mockUseEtablissementsWithDocuments.mockReturnValue({
      data: [],
      isLoading: false,
      error: { message: "x" },
    });

    const Wrapper = createWrapper();
    render(<DocumentFolderBrowser />, { wrapper: Wrapper });

    expect(screen.getByText("Erreur lors du chargement")).toBeTruthy();
  });
});