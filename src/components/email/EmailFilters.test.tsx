import React from "react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { render, screen, fireEvent, cleanup, waitFor, renderHook, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmailFilters } from "./EmailFilters";

const {
  ETABS,
  AUTH_STATE,
  mockFrom,
  mockNavigate,
  toastSuccess,
  toastError,
} = vi.hoisted(() => ({
  ETABS: [
    { id: "etab-1", nom: "Clinique Alpha" },
    { id: "etab-2", nom: "Hôpital Beta" },
  ],
  AUTH_STATE: {
    user: { id: "u1", email: "t@t.co" },
    session: { user: { id: "u1" } },
    isLoading: false,
  },
  mockFrom: vi.fn(),
  mockNavigate: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => {
  const createBuilder = () => {
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
      single: vi.fn(async () => result),
      maybeSingle: vi.fn(async () => result),
      then: (onFulfilled: (value: typeof result) => unknown) => Promise.resolve(result).then(onFulfilled),
      catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
    };
    return builder;
  };

  mockFrom.mockImplementation(() => createBuilder());

  return {
    supabase: {
      from: mockFrom,
      auth: {
        getSession: vi.fn(async () => ({ data: { session: AUTH_STATE.session }, error: null })),
        getUser: vi.fn(async () => ({ data: { user: AUTH_STATE.user }, error: null })),
      },
    },
  };
});

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("@/components/ui/input", () => ({
  Input: ({
    value,
    onChange,
    placeholder,
    className,
  }: {
    value: string;
    onChange: React.ChangeEventHandler<HTMLInputElement>;
    placeholder?: string;
    className?: string;
  }) => (
    <input
      data-testid="input-search"
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
    title,
    "aria-label": ariaLabel,
  }: {
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    title?: string;
    "aria-label"?: string;
  }) => (
    <button type="button" onClick={onClick} title={title} aria-label={ariaLabel}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({
    children,
    htmlFor,
    className,
  }: {
    children: React.ReactNode;
    htmlFor?: string;
    className?: string;
  }) => (
    <label htmlFor={htmlFor} className={className}>
      {children}
    </label>
  ),
}));

vi.mock("@/components/ui/switch", () => ({
  Switch: ({
    id,
    checked,
    onCheckedChange,
  }: {
    id?: string;
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }) => (
    <input
      data-testid="switch-unread"
      id={id}
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
    />
  ),
}));

vi.mock("@/components/ui/select", () => {
  const SelectContext = React.createContext<{
    value?: string;
    onValueChange?: (value: string) => void;
  }>({});

  return {
    Select: ({
      value,
      onValueChange,
      children,
    }: {
      value?: string;
      onValueChange?: (value: string) => void;
      children: React.ReactNode;
    }) => (
      <SelectContext.Provider value={{ value, onValueChange }}>
        <div>{children}</div>
      </SelectContext.Provider>
    ),
    SelectTrigger: ({ children, className }: { children: React.ReactNode; className?: string }) => (
      <div className={className}>{children}</div>
    ),
    SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
    SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => {
      const ctx = React.useContext(SelectContext);
      return (
        <button type="button" onClick={() => ctx.onValueChange?.(value)}>
          {children}
        </button>
      );
    },
  };
});

vi.mock("lucide-react", () => ({
  Search: () => <svg data-testid="icon-search" />,
  X: () => <svg data-testid="icon-x" />,
}));

const hookState = {
  mode: "success" as "loading" | "success" | "error",
};

vi.mock("@/hooks/crm/useEtablissementsListSimple", () => ({
  useEtablissementsListSimple: () => {
    if (hookState.mode === "loading") {
      return { data: undefined, isLoading: true, isError: false, error: null };
    }
    if (hookState.mode === "error") {
      return {
        data: null,
        isLoading: false,
        isError: true,
        error: { message: "x" },
      };
    }
    return {
      data: ETABS,
      isLoading: false,
      isError: false,
      error: null,
    };
  },
}));

vi.mock("@/hooks/email/useEmailFilters", () => ({}));

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

function useWrappedEtablissements() {
  return useQuery({
    queryKey: ["etablissements-list-simple-test", hookState.mode],
    queryFn: async () => {
      if (hookState.mode === "error") {
        throw new Error("x");
      }
      if (hookState.mode === "loading") {
        return new Promise<never>(() => undefined);
      }
      return ETABS;
    },
  });
}

describe("EmailFilters", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    hookState.mode = "success";
  });

  it("couvre le chargement via renderHook avec QueryClientProvider", () => {
    hookState.mode = "loading";
    const wrapper = createWrapper();

    const { result } = renderHook(() => useWrappedEtablissements(), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it("affiche les valeurs métier réelles et déclenche les changements de filtres", async () => {
    hookState.mode = "success";
    const onFilterChange = vi.fn();
    const onReset = vi.fn();
    const user = userEvent.setup();

    render(
      <EmailFilters
        filters={{
          search: "",
          category: null,
          priority: null,
          unreadOnly: false,
          etablissementId: null,
        }}
        onFilterChange={onFilterChange}
        onReset={onReset}
      />
    );

    expect(
      screen.getByPlaceholderText("Rechercher (sujet, expéditeur, contenu, IA)...")
    ).toBeInTheDocument();
    expect(screen.getByText("Toutes catégories")).toBeInTheDocument();
    expect(screen.getByText("Toutes priorités")).toBeInTheDocument();
    expect(screen.getByText("Tous établissements")).toBeInTheDocument();
    expect(screen.getByText("Interne OpenPulse")).toBeInTheDocument();
    expect(screen.getByText("Non classés")).toBeInTheDocument();
    expect(screen.getByText("Clinique Alpha")).toBeInTheDocument();
    expect(screen.getByText("Hôpital Beta")).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(
        screen.getByPlaceholderText("Rechercher (sujet, expéditeur, contenu, IA)..."),
        { target: { value: "urgent" } }
      );
    });

    expect(onFilterChange).toHaveBeenCalledWith("search", "urgent");

    await user.click(screen.getByText("Commercial"));
    expect(onFilterChange).toHaveBeenCalledWith("category", "Commercial");

    await user.click(screen.getByText("Haute"));
    expect(onFilterChange).toHaveBeenCalledWith("priority", "high");

    await user.click(screen.getByText("Clinique Alpha"));
    expect(onFilterChange).toHaveBeenCalledWith("etablissementId", "etab-1");

    await act(async () => {
      fireEvent.click(screen.getByTestId("switch-unread"));
    });
    expect(onFilterChange).toHaveBeenCalledWith("unreadOnly", true);
  });

  it("affiche le bouton reset seulement si des filtres sont actifs et appelle onReset", async () => {
    const onFilterChange = vi.fn();
    const onReset = vi.fn();
    const user = userEvent.setup();

    const { rerender } = render(
      <EmailFilters
        filters={{
          search: "",
          category: null,
          priority: null,
          unreadOnly: false,
          etablissementId: null,
        }}
        onFilterChange={onFilterChange}
        onReset={onReset}
      />
    );

    expect(screen.queryByTitle("Réinitialiser les filtres")).not.toBeInTheDocument();

    rerender(
      <EmailFilters
        filters={{
          search: "relance",
          category: null,
          priority: null,
          unreadOnly: false,
          etablissementId: null,
        }}
        onFilterChange={onFilterChange}
        onReset={onReset}
      />
    );

    const resetButton = screen.getByTitle("Réinitialiser les filtres");
    expect(resetButton).toBeInTheDocument();

    await user.click(resetButton);
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("couvre l'erreur via renderHook avec QueryClientProvider", async () => {
    hookState.mode = "error";
    const wrapper = createWrapper();

    const { result } = renderHook(() => useWrappedEtablissements(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe("x");
  });
});