/* @vitest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PartenaireQuickActions } from "./PartenaireQuickActions";

const {
  ACTIVITIES_ROWS,
  EMPTY_ROWS,
  AUTH_STATE,
  mockUsePartenaireActivities,
  mockToastSuccess,
  mockToastError,
  mockInvalidateQueries,
  mockFormatDistanceToNow,
  mockFrom,
  mockEq,
  mockUpdate,
  supabaseState,
} = vi.hoisted(() => {
  const ACTIVITIES_ROWS = [
    {
      id: "a1",
      type: "email",
      title: "Premier contact",
      description: "Mail envoyé",
      date: "2024-01-10T10:00:00.000Z",
    },
    {
      id: "a2",
      type: "appel",
      title: "Relance téléphonique",
      description: "Discussion de suivi",
      date: "2024-01-11T10:00:00.000Z",
    },
    {
      id: "a3",
      type: "meeting",
      title: "Rendez-vous",
      description: "Présentation de l'offre",
      date: "2024-01-12T10:00:00.000Z",
    },
    {
      id: "a4",
      type: "note",
      title: "Interne",
      description: "Ne doit pas apparaître",
      date: "2024-01-13T10:00:00.000Z",
    },
  ];
  const EMPTY_ROWS: Array<{
    id: string;
    type: string;
    title: string;
    description?: string;
    date?: string;
  }> = [];

  const AUTH_STATE = {
    user: { id: "u1", email: "t@t.co" },
    session: { user: { id: "u1" } },
    isLoading: false,
  };

  const mockUsePartenaireActivities = vi.fn();
  const mockToastSuccess = vi.fn();
  const mockToastError = vi.fn();
  const mockInvalidateQueries = vi.fn();
  const mockFormatDistanceToNow = vi.fn(() => "il y a 2 jours");
  const mockFrom = vi.fn();
  const mockEq = vi.fn();
  const mockUpdate = vi.fn();

  const supabaseState: {
    updateResult: { data: null; error: null | { message: string } };
  } = {
    updateResult: { data: null, error: null },
  };

  return {
    ACTIVITIES_ROWS,
    EMPTY_ROWS,
    AUTH_STATE,
    mockUsePartenaireActivities,
    mockToastSuccess,
    mockToastError,
    mockInvalidateQueries,
    mockFormatDistanceToNow,
    mockFrom,
    mockEq,
    mockUpdate,
    supabaseState,
  };
});

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/components/ui/button", () => ({
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => {
    const ariaLabel = props["aria-label"];
    return (
      <button {...props} aria-label={ariaLabel}>
        {props.children}
      </button>
    );
  },
}));

vi.mock("@/components/ui/textarea", () => ({
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/popover", async () => {
  const ReactModule = await import("react");

  const Ctx = ReactModule.createContext<{
    open: boolean;
    setOpen: (v: boolean) => void;
  }>({
    open: false,
    setOpen: () => {},
  });

  function Popover({
    children,
    open,
    onOpenChange,
  }: {
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (v: boolean) => void;
  }) {
    const [internalOpen, setInternalOpen] = ReactModule.useState(false);
    const controlled = typeof open === "boolean";
    const currentOpen = controlled ? open : internalOpen;

    const setOpen = (value: boolean) => {
      if (!controlled) setInternalOpen(value);
      onOpenChange?.(value);
    };

    return <Ctx.Provider value={{ open: currentOpen, setOpen }}>{children}</Ctx.Provider>;
  }

  function PopoverTrigger({
    children,
  }: {
    children: React.ReactElement<{ onClick?: React.MouseEventHandler<HTMLElement> }>;
    asChild?: boolean;
  }) {
    const { setOpen } = ReactModule.useContext(Ctx);
    return ReactModule.cloneElement(children, {
      onClick: (event: React.MouseEvent<HTMLElement>) => {
        children.props.onClick?.(event);
        setOpen(true);
      },
    });
  }

  function PopoverContent({ children }: { children: React.ReactNode; align?: string; className?: string }) {
    const { open } = ReactModule.useContext(Ctx);
    if (!open) return null;
    return <div>{children}</div>;
  }

  return { Popover, PopoverTrigger, PopoverContent };
});

vi.mock("lucide-react", () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon" {...props} />;
  return {
    StickyNote: Icon,
    ListTodo: Icon,
    Activity: Icon,
    Plus: Icon,
    Loader2: Icon,
  };
});

vi.mock("@/hooks/crm/usePartenaireActivities", () => ({
  usePartenaireActivities: mockUsePartenaireActivities,
}));

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock("date-fns", () => ({
  formatDistanceToNow: mockFormatDistanceToNow,
}));

vi.mock("date-fns/locale", () => ({
  fr: {},
}));

vi.mock("@/integrations/supabase/client", () => {
  const builder = {
    select: vi.fn(() => builder),
    eq: mockEq,
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: mockUpdate,
    delete: vi.fn(() => builder),
    single: vi.fn(async () => supabaseState.updateResult),
    maybeSingle: vi.fn(async () => supabaseState.updateResult),
    then: (
      onFulfilled?: (value: { data: null; error: null | { message: string } }) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(supabaseState.updateResult).then(onFulfilled, onRejected),
    catch: (onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(supabaseState.updateResult).catch(onRejected),
  };

  mockUpdate.mockImplementation(() => builder);
  mockEq.mockImplementation(() => Promise.resolve(supabaseState.updateResult));
  mockFrom.mockImplementation(() => builder);

  return {
    supabase: {
      from: mockFrom,
    },
  };
});

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: mockInvalidateQueries,
    }),
  };
});

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function renderComponent() {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <PartenaireQuickActions partenaireId="p1" partenaireName="Partenaire Test" />
    </QueryClientProvider>,
  );
}

describe("PartenaireQuickActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseState.updateResult = { data: null, error: null };
    mockUsePartenaireActivities.mockReturnValue({
      data: ACTIVITIES_ROWS,
      isLoading: false,
    });
    mockFormatDistanceToNow.mockReturnValue("il y a 2 jours");
  });

  it("affiche les actions, limite les activités à 3 et rend le compteur réel", () => {
    renderComponent();

    expect(screen.getByLabelText("Note")).toBeInTheDocument();
    expect(screen.getByLabelText("Tâches")).toBeInTheDocument();
    expect(screen.getByLabelText("Activités récentes")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Activités récentes"));

    expect(screen.getAllByText("Activités récentes")[0]).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();

    expect(screen.getByText("Premier contact")).toBeInTheDocument();
    expect(screen.getByText("Relance téléphonique")).toBeInTheDocument();
    expect(screen.getByText("Rendez-vous")).toBeInTheDocument();
    expect(screen.queryByText("Interne")).not.toBeInTheDocument();

    expect(screen.getByText("email")).toBeInTheDocument();
    expect(screen.getByText("appel")).toBeInTheDocument();
    expect(screen.getByText("meeting")).toBeInTheDocument();

    expect(screen.getAllByText("il y a 2 jours")).toHaveLength(3);
    expect(mockFormatDistanceToNow).toHaveBeenCalledTimes(3);
  });

  it("affiche le chargement puis le message vide quand il n'y a aucune activité", () => {
    mockUsePartenaireActivities.mockReturnValue({
      data: EMPTY_ROWS,
      isLoading: true,
    });

    const queryClient = createQueryClient();
    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <PartenaireQuickActions partenaireId="p1" partenaireName="Partenaire Test" />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByLabelText("Activités récentes"));

    expect(screen.getAllByText("Activités récentes")[0]).toBeInTheDocument();
    expect(screen.queryByText("Aucune activité récente")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("icon").length).toBeGreaterThan(0);

    mockUsePartenaireActivities.mockReturnValue({
      data: EMPTY_ROWS,
      isLoading: false,
    });

    rerender(
      <QueryClientProvider client={queryClient}>
        <PartenaireQuickActions partenaireId="p1" partenaireName="Partenaire Test" />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByLabelText("Activités récentes"));

    expect(screen.getByText("Aucune activité récente")).toBeInTheDocument();
  });

  it("enregistre une note, ferme le popover et invalide les partenaires", async () => {
    renderComponent();

    fireEvent.click(screen.getByLabelText("Note"));

    expect(screen.getByText("Note rapide - Partenaire Test")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Ajouter une note..."), {
      target: { value: "Nouvelle note partenaire" },
    });

    const saveButton = screen.getByText("Enregistrer");
    expect(saveButton).not.toBeDisabled();

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith("partenaires");
    });

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const payload = mockUpdate.mock.calls[0][0] as {
      notes: string;
      dernier_contact: string;
    };

    expect(payload.notes).toBe("Nouvelle note partenaire");
    expect(Number.isNaN(Date.parse(payload.dernier_contact))).toBe(false);
    expect(mockEq).toHaveBeenCalledWith("id", "p1");
    expect(mockToastSuccess).toHaveBeenCalledWith("Note enregistrée");
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["partenaires"] });

    await waitFor(() => {
      expect(screen.queryByText("Note rapide - Partenaire Test")).not.toBeInTheDocument();
    });
  });

  it("n'appelle pas supabase si la note est vide ou seulement composée d'espaces", () => {
    renderComponent();

    fireEvent.click(screen.getByLabelText("Note"));

    expect(screen.getByText("Enregistrer")).toBeDisabled();
    expect(mockFrom).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText("Ajouter une note..."), {
      target: { value: "   " },
    });

    expect(screen.getByText("Enregistrer")).toBeDisabled();
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockEq).not.toHaveBeenCalled();
  });

  it("affiche une erreur si l'enregistrement échoue", async () => {
    supabaseState.updateResult = { data: null, error: { message: "x" } };

    renderComponent();

    fireEvent.click(screen.getByLabelText("Note"));
    fireEvent.change(screen.getByPlaceholderText("Ajouter une note..."), {
      target: { value: "Note en erreur" },
    });

    fireEvent.click(screen.getByText("Enregistrer"));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Erreur lors de l'enregistrement");
    });

    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(mockInvalidateQueries).not.toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalledWith("partenaires");
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockEq).toHaveBeenCalledWith("id", "p1");
  });
});