// @vitest-environment jsdom
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent, waitFor, act, renderHook } from "@testing-library/react";
import { IncompleteProfilesAlert } from "./IncompleteProfilesAlert";

const {
  PROFILES_LOADING,
  PROFILES_SUCCESS,
  PROFILES_EMPTY,
  TOAST_FN,
  DEBUG_ERROR,
  AUTH_STATE,
  mockUsePeopleData,
  mockUseToast,
  mockInvalidateQueries,
  mockFrom,
  mockUpdate,
  mockEq,
  mockUseAuth,
  builder,
} = vi.hoisted(() => {
  const PROFILES_LOADING = undefined;

  const PROFILES_SUCCESS = [
    {
      id: "p1",
      prenom: "Alice",
      nom: "Martin",
      email: "alice@example.com",
      actif: true,
      fonction: "",
      telephone: "",
    },
    {
      id: "p2",
      prenom: "Bob",
      nom: "Durand",
      email: "bob@example.com",
      actif: true,
      fonction: "Développeur",
      telephone: "",
    },
    {
      id: "p3",
      prenom: "Chloé",
      nom: "Petit",
      email: "chloe@example.com",
      actif: true,
      fonction: "Designer",
      telephone: "0102030405",
    },
    {
      id: "p4",
      prenom: "David",
      nom: "Roux",
      email: "david@example.com",
      actif: false,
      fonction: "",
      telephone: "",
    },
  ];

  const PROFILES_EMPTY = [
    {
      id: "p5",
      prenom: "Eva",
      nom: "Leroy",
      email: "eva@example.com",
      actif: true,
      fonction: "CEO",
      telephone: "0600000000",
    },
  ];

  const TOAST_FN = vi.fn();
  const DEBUG_ERROR = vi.fn();
  const AUTH_STATE = {
    user: { id: "u1", email: "test@example.com" },
    session: { user: { id: "u1" } },
    isLoading: false,
  };

  const mockUsePeopleData = vi.fn();
  const mockUseToast = vi.fn();
  const mockInvalidateQueries = vi.fn().mockResolvedValue(undefined);
  const mockFrom = vi.fn();
  const mockUpdate = vi.fn();
  const mockEq = vi.fn();
  const mockUseAuth = vi.fn();

  const builder = {
    select: vi.fn(),
    eq: mockEq,
    gte: vi.fn(),
    lte: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    update: mockUpdate,
    delete: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    then: vi.fn(),
    catch: vi.fn(),
  };

  return {
    PROFILES_LOADING,
    PROFILES_SUCCESS,
    PROFILES_EMPTY,
    TOAST_FN,
    DEBUG_ERROR,
    AUTH_STATE,
    mockUsePeopleData,
    mockUseToast,
    mockInvalidateQueries,
    mockFrom,
    mockUpdate,
    mockEq,
    mockUseAuth,
    builder,
  };
});

vi.mock("@/lib/debug", () => ({
  debug: {
    error: DEBUG_ERROR,
  },
}));

vi.mock("@/hooks/hr/usePeopleData", () => ({
  usePeopleData: mockUsePeopleData,
}));

vi.mock("@/hooks/shared/use-toast", () => ({
  useToast: mockUseToast,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: mockUseAuth,
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: mockUseAuth,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: mockUseAuth,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/components/ui/alert", () => ({
  Alert: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="alert" className={className}>
      {children}
    </div>
  ),
  AlertTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  AlertDescription: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    type,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    type?: "button" | "submit" | "reset";
  }) => (
    <button type={type ?? "button"} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    open,
    children,
  }: {
    open: boolean;
    children: React.ReactNode;
    onOpenChange?: (open: boolean) => void;
  }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/input", () => ({
  Input: ({
    id,
    value,
    onChange,
    placeholder,
    type,
  }: {
    id?: string;
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    type?: string;
  }) => <input id={id} value={value} onChange={onChange} placeholder={placeholder} type={type} />,
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({
    children,
    htmlFor,
  }: {
    children: React.ReactNode;
    htmlFor?: string;
  }) => <label htmlFor={htmlFor}>{children}</label>,
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    children: React.ReactNode;
  }) => {
    const items = React.Children.toArray(children).filter(
      (child) => React.isValidElement(child) && (child.type as unknown as { name?: string })?.name === "SelectContentMock"
    );
    return (
      <select
        data-testid="fonction-select"
        aria-label="Fonction *"
        value={value}
        onChange={(e) => onValueChange?.(e.target.value)}
      >
        <option value="">Sélectionner une fonction</option>
        {items}
      </select>
    );
  },
  SelectContent: function SelectContentMock({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
  },
  SelectItem: ({
    value,
    children,
  }: {
    value: string;
    children: React.ReactNode;
  }) => <option value={value}>{children}</option>,
  SelectTrigger: ({ id }: { children?: React.ReactNode; id?: string }) => <>{id ? <span data-testid={`trigger-${id}`} /> : null}</>,
  SelectValue: () => null,
}));

vi.mock("lucide-react", () => ({
  AlertTriangle: () => <svg data-testid="icon-alert-triangle" />,
  UserX: () => <svg data-testid="icon-userx" />,
  Loader2: () => <svg data-testid="icon-loader" />,
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("IncompleteProfilesAlert", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    builder.select.mockReturnValue(builder);
    builder.eq.mockResolvedValue({ data: null, error: null });
    builder.gte.mockReturnValue(builder);
    builder.lte.mockReturnValue(builder);
    builder.in.mockReturnValue(builder);
    builder.order.mockReturnValue(builder);
    builder.limit.mockReturnValue(builder);
    builder.insert.mockReturnValue(builder);
    builder.update.mockReturnValue(builder);
    builder.delete.mockReturnValue(builder);
    builder.single.mockResolvedValue({ data: null, error: null });
    builder.maybeSingle.mockResolvedValue({ data: null, error: null });
    builder.then.mockImplementation((onFulfilled?: (value: { data: null; error: null }) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled)
    );
    builder.catch.mockImplementation((onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).catch(onRejected)
    );

    mockFrom.mockReturnValue(builder);
    mockUseToast.mockReturnValue({ toast: TOAST_FN });
    mockUsePeopleData.mockReturnValue({ profiles: PROFILES_SUCCESS });
    mockUseAuth.mockReturnValue(AUTH_STATE);
  });

  it("supporte renderHook avec QueryClientProvider", () => {
    const queryClient = createQueryClient();
    const wrapper = createWrapper(queryClient);

    const { result } = renderHook(() => "ok", { wrapper });

    expect(result.current).toBe("ok");
  });

  it("n'affiche rien pendant le chargement puis affiche l'alerte avec le bon nombre de profils incomplets", () => {
    const queryClient = createQueryClient();

    mockUsePeopleData
      .mockReturnValueOnce({ profiles: PROFILES_LOADING })
      .mockReturnValue({ profiles: PROFILES_SUCCESS });

    const { rerender, container } = render(
      <QueryClientProvider client={queryClient}>
        <IncompleteProfilesAlert />
      </QueryClientProvider>
    );

    expect(container).toBeEmptyDOMElement();

    rerender(
      <QueryClientProvider client={queryClient}>
        <IncompleteProfilesAlert />
      </QueryClientProvider>
    );

    expect(screen.getByText("Profils incomplets détectés")).toBeInTheDocument();
    expect(screen.getByText("2 employés avec des informations manquantes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Compléter les profils" })).toBeInTheDocument();
  });

  it("liste les champs métier réellement manquants pour chaque employé actif", () => {
    const queryClient = createQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <IncompleteProfilesAlert />
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Compléter les profils" }));

    expect(screen.getByText("Alice Martin")).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByText("Bob Durand")).toBeInTheDocument();
    expect(screen.getByText("bob@example.com")).toBeInTheDocument();

    expect(screen.getByText("Fonction manquant")).toBeInTheDocument();
    expect(screen.getAllByText("Téléphone manquant")).toHaveLength(2);

    expect(screen.queryByText("Chloé Petit")).toBeNull();
    expect(screen.queryByText("David Roux")).toBeNull();
  });

  it("ouvre l'édition, pré-remplit, met à jour le profil et invalide les queries", async () => {
    const queryClient = createQueryClient();
    vi.spyOn(queryClient, "invalidateQueries").mockImplementation(mockInvalidateQueries);

    render(
      <QueryClientProvider client={queryClient}>
        <IncompleteProfilesAlert />
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Compléter les profils" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Compléter" })[0]);

    expect(screen.getByText("Compléter le profil de Alice Martin")).toBeInTheDocument();

    const saveButton = screen.getByRole("button", { name: "Enregistrer" });
    expect(saveButton).toBeDisabled();

    fireEvent.change(screen.getByTestId("fonction-select"), { target: { value: "CEO" } });
    fireEvent.change(screen.getByLabelText("Téléphone *"), { target: { value: " 0611223344 " } });

    expect(screen.getByRole("button", { name: "Enregistrer" })).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    });

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith("profiles");
    });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        fonction: "CEO",
        telephone: "0611223344",
        updated_at: expect.any(String),
      })
    );
    expect(mockEq).toHaveBeenCalledWith("id", "p1");

    await waitFor(() => {
      expect(TOAST_FN).toHaveBeenCalledWith({
        title: "Profil mis à jour",
        description: "Les informations de Alice Martin ont été mises à jour.",
      });
    });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["people-data"] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["profiles"] });
  });

  it("gère l'erreur de mise à jour quand supabase renvoie { data:null, error:{ message:'x' } }", async () => {
    const queryClient = createQueryClient();

    builder.eq.mockResolvedValueOnce({ data: null, error: { message: "x" } });

    render(
      <QueryClientProvider client={queryClient}>
        <IncompleteProfilesAlert />
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Compléter les profils" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Compléter" })[1]);

    fireEvent.change(screen.getByLabelText("Téléphone *"), { target: { value: "0700000000" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    });

    await waitFor(() => {
      expect(DEBUG_ERROR).toHaveBeenCalled();
    });

    expect(TOAST_FN).toHaveBeenCalledWith({
      title: "Erreur",
      description: "Impossible de mettre à jour le profil.",
      variant: "destructive",
    });
  });

  it("ne rend rien quand aucun profil n'est incomplet", () => {
    const queryClient = createQueryClient();
    mockUsePeopleData.mockReturnValue({ profiles: PROFILES_EMPTY });

    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <IncompleteProfilesAlert />
      </QueryClientProvider>
    );

    expect(container).toBeEmptyDOMElement();
  });
});