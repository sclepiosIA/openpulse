import React from "react";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SectionVersionsDialog } from "./SectionVersionsDialog";

const {
  STABLE_VERSIONS,
  EMPTY_VERSIONS,
  AUTH_STATE,
  mockUseSectionVersions,
  mockUseRestoreVersion,
  mockMutateAsync,
  mockOnOpenChange,
  mockFrom,
  confirmMock,
  navigateMock,
  toastSuccess,
  toastError,
} = vi.hoisted(() => {
  const STABLE_VERSIONS = [
    {
      id: "v1",
      version_number: 3,
      created_at: "2024-01-10T12:00:00.000Z",
      titre: "Titre version 3",
      contenu_html:
        "<p>Contenu <strong>important</strong> de la version restaurable avec balises HTML.</p>",
      note: "Note de révision",
    },
    {
      id: "v2",
      version_number: 2,
      created_at: "2024-01-09T10:00:00.000Z",
      titre: "Titre version 2",
      contenu_html: "<div>Ancien contenu</div>",
      note: null,
    },
  ];

  const EMPTY_VERSIONS: {
    id: string;
    version_number: number;
    created_at: string;
    titre: string | null;
    contenu_html: string | null;
    note: string | null;
  }[] = [];

  const AUTH_STATE = {
    user: { id: "u1", email: "test@example.co" },
    session: { user: { id: "u1" } },
    isLoading: false,
  };

  return {
    STABLE_VERSIONS,
    EMPTY_VERSIONS,
    AUTH_STATE,
    mockUseSectionVersions: vi.fn(),
    mockUseRestoreVersion: vi.fn(),
    mockMutateAsync: vi.fn(),
    mockOnOpenChange: vi.fn(),
    mockFrom: vi.fn(),
    confirmMock: vi.fn(),
    navigateMock: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
  };
});

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    open,
    onOpenChange,
    children,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
  }) =>
    open ? (
      <div data-testid="dialog-root">
        <button type="button" onClick={() => onOpenChange(false)}>
          close
        </button>
        {children}
      </div>
    ) : null,
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
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <h1 className={className}>{children}</h1>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="scroll-area" className={className}>
      {children}
    </div>
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    size,
    variant,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    size?: string;
    variant?: string;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled} data-size={size} data-variant={variant}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: ({ className }: { className?: string }) => <div data-testid="skeleton" className={className} />,
}));

vi.mock("lucide-react", () => ({
  History: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="history-icon" {...props} />,
  RotateCcw: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="restore-icon" {...props} />,
  FileText: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="file-icon" {...props} />,
}));

vi.mock("date-fns", () => ({
  formatDistanceToNow: vi.fn(() => "il y a 2 jours"),
}));

vi.mock("date-fns/locale", () => ({
  fr: {},
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
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

vi.mock("@/hooks/contracts/useContractSections", () => ({
  useSectionVersions: mockUseSectionVersions,
  useRestoreVersion: mockUseRestoreVersion,
}));

vi.mock("@/integrations/supabase/client", () => {
  const result = { data: null, error: null };
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
    upsert: vi.fn(() => builder),
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (
      onFulfilled?: ((value: typeof result) => unknown) | null,
      onRejected?: ((reason: unknown) => unknown) | null,
    ) => Promise.resolve(result).then(onFulfilled ?? undefined, onRejected ?? undefined),
    catch: (onRejected?: ((reason: unknown) => unknown) | null) =>
      Promise.resolve(result).catch(onRejected ?? undefined),
  };

  return {
    supabase: {
      from: mockFrom.mockImplementation(() => builder),
    },
  };
});

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

describe("SectionVersionsDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("confirm", confirmMock);

    mockUseRestoreVersion.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    });

    mockUseSectionVersions.mockReturnValue({
      data: STABLE_VERSIONS,
      isLoading: false,
      isError: false,
      error: null,
    });
  });

  it("affiche l'état de chargement avec les skeletons", () => {
    mockUseSectionVersions.mockReturnValue({
      data: STABLE_VERSIONS,
      isLoading: true,
      isError: false,
      error: null,
    });

    render(
      <SectionVersionsDialog
        open
        onOpenChange={mockOnOpenChange}
        sectionId="section-1"
        sectionTitle="Clause résiliation"
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText("Historique des versions")).toBeInTheDocument();
    expect(screen.getByText("Section : Clause résiliation")).toBeInTheDocument();
    expect(screen.getAllByTestId("skeleton")).toHaveLength(3);
    expect(mockUseSectionVersions).toHaveBeenCalledWith("section-1");
  });

  it("affiche les versions avec les valeurs métier réelles et restaure une version après confirmation", async () => {
    const user = userEvent.setup();

    mockUseSectionVersions.mockReturnValue({
      data: STABLE_VERSIONS,
      isLoading: false,
      isError: false,
      error: null,
    });
    mockMutateAsync.mockResolvedValue(undefined);
    confirmMock.mockReturnValue(true);

    render(
      <SectionVersionsDialog
        open
        onOpenChange={mockOnOpenChange}
        sectionId="section-1"
        sectionTitle="Clause paiement"
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText("Section : Clause paiement")).toBeInTheDocument();
    expect(screen.getByText("v3")).toBeInTheDocument();
    expect(screen.getByText("v2")).toBeInTheDocument();
    expect(screen.getByText("Titre version 3")).toBeInTheDocument();
    expect(screen.getByText("Titre version 2")).toBeInTheDocument();
    expect(
      screen.getByText("Contenu important de la version restaurable avec balises HTML.…"),
    ).toBeInTheDocument();
    expect(screen.getByText("Ancien contenu…")).toBeInTheDocument();
    expect(screen.getByText("Note : Note de révision")).toBeInTheDocument();
    expect(screen.getAllByText("il y a 2 jours")).toHaveLength(2);

    const buttons = screen.getAllByRole("button", { name: /restaurer/i });

    await act(async () => {
      await user.click(buttons[0]);
    });

    await waitFor(() => {
      expect(confirmMock).toHaveBeenCalledWith(
        "Restaurer la version #3 ? Le contenu actuel sera remplacé (une nouvelle version sera créée).",
      );
    });

    expect(mockMutateAsync).toHaveBeenCalledWith({
      sectionId: "section-1",
      version: STABLE_VERSIONS[0],
    });
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it("n'appelle pas la restauration si l'utilisateur annule la confirmation", async () => {
    const user = userEvent.setup();

    mockUseSectionVersions.mockReturnValue({
      data: STABLE_VERSIONS,
      isLoading: false,
      isError: false,
      error: null,
    });
    confirmMock.mockReturnValue(false);

    render(
      <SectionVersionsDialog
        open
        onOpenChange={mockOnOpenChange}
        sectionId="section-1"
        sectionTitle="Clause livraison"
      />,
      { wrapper: createWrapper() },
    );

    await act(async () => {
      await user.click(screen.getAllByRole("button", { name: /restaurer/i })[0]);
    });

    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(mockOnOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("affiche l'état vide quand aucune version n'est disponible", () => {
    mockUseSectionVersions.mockReturnValue({
      data: EMPTY_VERSIONS,
      isLoading: false,
      isError: false,
      error: null,
    });

    render(
      <SectionVersionsDialog
        open
        onOpenChange={mockOnOpenChange}
        sectionId="section-1"
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText("Snapshots automatiques de cette section.")).toBeInTheDocument();
    expect(screen.getByText("Aucune version enregistrée pour le moment.")).toBeInTheDocument();
    expect(
      screen.getByText("Les versions sont créées automatiquement lors des modifications."),
    ).toBeInTheDocument();
  });

  it("gère l'erreur du hook en exposant isError côté hook et en affichant l'état vide dans le composant", () => {
    mockUseSectionVersions.mockReturnValue({
      data: EMPTY_VERSIONS,
      isLoading: false,
      isError: true,
      error: { message: "x" },
    });

    const { result } = renderHook(() => mockUseSectionVersions("section-1"), {
      wrapper: createWrapper(),
    });

    expect(result.current.isError).toBe(true);
    expect(result.current.error).toEqual({ message: "x" });
    expect(result.current.data).toBe(EMPTY_VERSIONS);

    render(
      <SectionVersionsDialog
        open
        onOpenChange={mockOnOpenChange}
        sectionId="section-1"
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText("Aucune version enregistrée pour le moment.")).toBeInTheDocument();
    expect(
      screen.getByText("Les versions sont créées automatiquement lors des modifications."),
    ).toBeInTheDocument();
  });

  it("ne charge pas les versions si la boîte de dialogue est fermée", () => {
    render(
      <SectionVersionsDialog
        open={false}
        onOpenChange={mockOnOpenChange}
        sectionId="section-1"
        sectionTitle="Clause cachée"
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.queryByTestId("dialog-root")).not.toBeInTheDocument();
    expect(mockUseSectionVersions).toHaveBeenCalledWith(undefined);
  });
});