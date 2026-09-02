import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RHEntretienDetail } from "./RHEntretienDetail";

const {
  AUTH_STATE,
  PROFILES_ROWS,
  ENTRETIENS_ROWS,
  ENTRETIENS_PROFILE_ROWS,
  IA_SUCCESS,
  mockFrom,
  mockInvoke,
  mockMutate,
  mockToastSuccess,
  mockToastError,
  mockDebugError,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    user: { id: "u1", email: "rh@test.local" },
    session: { user: { id: "u1" } },
    isLoading: false,
  },
  PROFILES_ROWS: [
    { id: "p1", prenom: "Alice", nom: "Martin" },
    { id: "p2", prenom: "Bob", nom: "Durand" },
  ],
  ENTRETIENS_ROWS: [
    {
      id: "e-future",
      profile_id: "p1",
      manager_id: "u1",
      type: "annuel",
      date_entretien: "2099-06-15",
      statut: "planifie",
      synthese_manager: null,
      synthese_employe: null,
      points_forts: null,
      axes_amelioration: null,
      augmentation_proposee: null,
      created_at: "2099-01-01",
    },
    {
      id: "e-past",
      profile_id: "p2",
      manager_id: "u1",
      type: "professionnel",
      date_entretien: "2020-03-10",
      statut: "termine",
      synthese_manager: "Bonne année",
      synthese_employe: "Merci",
      points_forts: ["Autonomie"],
      axes_amelioration: ["Communication"],
      augmentation_proposee: 100,
      created_at: "2020-01-01",
    },
  ],
  ENTRETIENS_PROFILE_ROWS: [
    { id: "p1", prenom: "Alice", nom: "Martin" },
    { id: "p2", prenom: "Bob", nom: "Durand" },
  ],
  IA_SUCCESS: {
    resume: "Synthèse IA du collaborateur",
    points_forts: ["Rigueur", "Esprit d'équipe"],
    axes_amelioration: ["Priorisation"],
    questions_suggerees: ["Quels objectifs pour le prochain semestre ?"],
  },
  mockFrom: vi.fn(),
  mockInvoke: vi.fn(),
  mockMutate: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockDebugError: vi.fn(),
}));

vi.mock("@/hooks/shared/useAuth", () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock("@/hooks/hr/useRHEntretienMutation", () => ({
  useRHEntretienMutation: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock("@/lib/debug", () => ({
  debug: {
    error: mockDebugError,
  },
}));

vi.mock("lucide-react", () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon" {...props} />;
  return {
    Calendar: Icon,
    Loader2: Icon,
    Users: Icon,
    FileText: Icon,
    Sparkles: Icon,
    Plus: Icon,
    ClipboardList: Icon,
  };
});

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    type = "button",
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    type?: "button" | "submit" | "reset";
    disabled?: boolean;
  }) => (
    <button type={type} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: ({
    value,
    onChange,
    id,
    type,
    required,
  }: {
    value?: string;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    id?: string;
    type?: string;
    required?: boolean;
  }) => <input id={id} type={type} value={value} onChange={onChange} required={required} />,
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/components/ui/tabs", () => {
  const TabsContext = React.createContext<{
    value: string;
    onValueChange: (value: string) => void;
  }>({
    value: "planification",
    onValueChange: () => {},
  });

  return {
    Tabs: ({
      value,
      onValueChange,
      children,
    }: {
      value: string;
      onValueChange: (value: string) => void;
      children: React.ReactNode;
    }) => <TabsContext.Provider value={{ value, onValueChange }}>{children}</TabsContext.Provider>,
    TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    TabsTrigger: ({
      value,
      children,
    }: {
      value: string;
      children: React.ReactNode;
    }) => {
      const ctx = React.useContext(TabsContext);
      return (
        <button onClick={() => ctx.onValueChange(value)} type="button">
          {children}
        </button>
      );
    },
    TabsContent: ({
      value,
      children,
    }: {
      value: string;
      children: React.ReactNode;
    }) => {
      const ctx = React.useContext(TabsContext);
      return ctx.value === value ? <div>{children}</div> : null;
    },
  };
});

vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    children: React.ReactNode;
  }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <div data-select-item={value}>{children}</div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
    functions: {
      invoke: mockInvoke,
    },
  },
}));

function createBuilder(result: { data: unknown; error: { message: string } | null }) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => Promise.resolve(result)),
    or: vi.fn(() => builder),
    order: vi.fn(() => Promise.resolve(result)),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (onFulfilled: (value: { data: unknown; error: { message: string } | null }) => unknown) =>
      Promise.resolve(result).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
  };
  return builder;
}

function setupSupabaseSuccess() {
  let profilesCall = 0;

  mockFrom.mockImplementation((table: string) => {
    if (table === "profiles") {
      profilesCall += 1;
      if (profilesCall === 1) {
        return createBuilder({ data: PROFILES_ROWS, error: null });
      }
      return {
        ...createBuilder({ data: ENTRETIENS_PROFILE_ROWS, error: null }),
        in: vi.fn(() => Promise.resolve({ data: ENTRETIENS_PROFILE_ROWS, error: null })),
      };
    }

    if (table === "rh_entretiens") {
      const builder = createBuilder({ data: ENTRETIENS_ROWS, error: null });
      return {
        ...builder,
        or: vi.fn(() => ({
          ...builder,
          order: vi.fn(() => Promise.resolve({ data: ENTRETIENS_ROWS, error: null })),
        })),
      };
    }

    return createBuilder({ data: [], error: null });
  });
}

function setupSupabaseEntretienError() {
  mockFrom.mockImplementation((table: string) => {
    if (table === "profiles") {
      return createBuilder({ data: PROFILES_ROWS, error: null });
    }

    if (table === "rh_entretiens") {
      const builder = createBuilder({ data: null, error: { message: "x" } });
      return {
        ...builder,
        or: vi.fn(() => ({
          ...builder,
          order: vi.fn(() => Promise.resolve({ data: null, error: { message: "x" } })),
        })),
      };
    }

    return createBuilder({ data: [], error: null });
  });
}

function renderComponent() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return render(
    <QueryClientProvider client={client}>
      <RHEntretienDetail />
    </QueryClientProvider>
  );
}

describe("RHEntretienDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche la planification puis les entretiens à venir avec le bon compteur, le collaborateur et le type", async () => {
    setupSupabaseSuccess();
    mockInvoke.mockResolvedValue({ data: IA_SUCCESS, error: null });

    renderComponent();

    expect(screen.getByText("Planifier un entretien")).toBeInTheDocument();
    expect(screen.getByText("Planifiez un entretien annuel, professionnel ou de recadrage")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("À venir (1)")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("À venir (1)"));

    expect(await screen.findByText("Entretiens à venir")).toBeInTheDocument();
    expect(screen.getByText("Alice Martin", { selector: "h4" })).toBeInTheDocument();
    expect(screen.getByText("Annuel")).toBeInTheDocument();
    expect(screen.getByText("Préparer (IA)")).toBeInTheDocument();
    expect(screen.getByText(/15 juin 2099/i)).toBeInTheDocument();
  });

  it("appelle l'IA et affiche la préparation générée", async () => {
    setupSupabaseSuccess();
    mockInvoke.mockResolvedValue({ data: IA_SUCCESS, error: null });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("À venir (1)")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("À venir (1)"));
    fireEvent.click(await screen.findByText("Préparer (IA)"));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("prepare-annual-review", {
        body: { profileId: "p1" },
      });
    });

    expect(await screen.findByText("Préparation IA")).toBeInTheDocument();
    expect(screen.getByText("Synthèse IA du collaborateur")).toBeInTheDocument();
    expect(screen.getByText("Rigueur")).toBeInTheDocument();
    expect(screen.getByText("Esprit d'équipe")).toBeInTheDocument();
    expect(screen.getByText("Priorisation")).toBeInTheDocument();
    expect(screen.getByText("Quels objectifs pour le prochain semestre ?")).toBeInTheDocument();
    expect(mockToastSuccess).toHaveBeenCalledWith("Préparation IA générée");
  });

  it("gère l'erreur de chargement des entretiens et ne dépend d'aucun réseau réel", async () => {
    setupSupabaseEntretienError();

    renderComponent();

    expect(screen.getByText("Planifier un entretien")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("À venir (0)")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("À venir (0)"));

    expect(await screen.findByText("Entretiens à venir")).toBeInTheDocument();
    expect(screen.getByText("Aucun entretien planifié")).toBeInTheDocument();
  });
});