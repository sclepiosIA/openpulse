import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DayDetailTooltip, type DailyDetailItem } from "./DayDetailTooltip";

const {
  AUTH_STATE,
  mockFrom,
  mockNavigate,
  toastSuccess,
  toastError,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    user: { id: "u1", email: "test@local.dev" },
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
      neq: vi.fn(() => builder),
      gt: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lt: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      like: vi.fn(() => builder),
      ilike: vi.fn(() => builder),
      is: vi.fn(() => builder),
      in: vi.fn(() => builder),
      contains: vi.fn(() => builder),
      containedBy: vi.fn(() => builder),
      rangeGt: vi.fn(() => builder),
      rangeGte: vi.fn(() => builder),
      rangeLt: vi.fn(() => builder),
      rangeLte: vi.fn(() => builder),
      overlaps: vi.fn(() => builder),
      textSearch: vi.fn(() => builder),
      filter: vi.fn(() => builder),
      match: vi.fn(() => builder),
      not: vi.fn(() => builder),
      or: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      range: vi.fn(() => builder),
      abortSignal: vi.fn(() => builder),
      maybeSingle: vi.fn(async () => result),
      single: vi.fn(async () => result),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      upsert: vi.fn(() => builder),
      delete: vi.fn(() => builder),
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
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        })),
      },
    },
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

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock("@/components/ui/hover-card", () => ({
  HoverCard: ({ children }: { children: React.ReactNode }) => <div data-testid="hover-card-root">{children}</div>,
  HoverCardTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <div>{children}</div>,
  HoverCardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="hover-card-content" className={className}>
      {children}
    </div>
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({
    children,
    className,
    variant,
  }: {
    children: React.ReactNode;
    className?: string;
    variant?: string;
  }) => (
    <span data-testid="badge" data-variant={variant} className={className}>
      {children}
    </span>
  ),
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="scroll-area" className={className}>
      {children}
    </div>
  ),
}));

vi.mock("@/lib/formatters", () => ({
  formatCurrency: (value: number) => `${value.toFixed(2)} €`,
}));

vi.mock("@/lib/utils", () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
}));

vi.mock("lucide-react", () => ({
  ChevronRight: ({ className }: { className?: string }) => <svg data-testid="chevron-right" className={className} />,
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

describe("DayDetailTooltip", () => {
  it("affiche les détails métier, les badges, les totaux et le solde positif, et déclenche onItemClick uniquement pour les éléments prévisionnels", () => {
    const Wrapper = createWrapper();
    const onItemClick = vi.fn();

    const recettesOverflow: DailyDetailItem[] = Array.from({ length: 9 }, (_, index) => ({
      id: `r-${index + 1}`,
      libelle: `Recette ${index + 1}`,
      montant: 10 + index,
      type: "recette",
      source: index === 0 ? "previsionnel" : "qonto",
    }));

    const depensesOverflow: DailyDetailItem[] = Array.from({ length: 9 }, (_, index) => ({
      id: `d-${index + 1}`,
      libelle: `Dépense ${index + 1}`,
      montant: 5 + index,
      type: "depense",
      source: index === 0 ? "salaire_previsionnel" : "qonto",
    }));

    const detailItems: DailyDetailItem[] = [...recettesOverflow, ...depensesOverflow];

    render(
      <DayDetailTooltip
        date={new Date(2024, 0, 15)}
        totalRecettes={1000}
        totalDepenses={400}
        solde={2500}
        detailItems={detailItems}
        isPrevisionnel
        onItemClick={onItemClick}
      >
        <button type="button">Ouvrir</button>
      </DayDetailTooltip>,
      { wrapper: Wrapper }
    );

    expect(screen.getByText("Ouvrir")).toBeInTheDocument();
    expect(screen.getByText(/15 janvier 2024/i)).toBeInTheDocument();
    expect(screen.getByText("Prévisionnel")).toBeInTheDocument();
    expect(screen.getByText("Recettes")).toBeInTheDocument();
    expect(screen.getByText("Dépenses")).toBeInTheDocument();

    const recette1 = screen.getByTitle("Recette 1");
    const recette8 = screen.getByTitle("Recette 8");
    const depense1 = screen.getByTitle("Dépense 1");
    const depense8 = screen.getByTitle("Dépense 8");

    expect(recette1).toBeInTheDocument();
    expect(recette8).toBeInTheDocument();
    expect(screen.queryByTitle("Recette 9")).not.toBeInTheDocument();

    expect(depense1).toBeInTheDocument();
    expect(depense8).toBeInTheDocument();
    expect(screen.queryByTitle("Dépense 9")).not.toBeInTheDocument();

    const overflowLabels = screen.getAllByText("+1 autre");
    expect(overflowLabels).toHaveLength(2);

    expect(screen.getByText("Salaire")).toBeInTheDocument();

    const recettesSection = screen.getByText("Recettes").closest("div");
    const depensesSection = screen.getByText("Dépenses").closest("div");

    expect(recettesSection).not.toBeNull();
    expect(depensesSection).not.toBeNull();

    const content = screen.getByTestId("hover-card-content");
    expect(within(content).getByText("+1000.00 €")).toBeInTheDocument();
    expect(within(content).getByText("-400.00 €")).toBeInTheDocument();
    expect(within(content).getByText("+600.00 €")).toBeInTheDocument();
    expect(within(content).getByText("2500.00 €")).toBeInTheDocument();

    fireEvent.click(recette1);
    expect(onItemClick).toHaveBeenCalledTimes(1);
    expect(onItemClick).toHaveBeenCalledWith({
      id: "r-1",
      libelle: "Recette 1",
      montant: 10,
      source: "previsionnel",
      type: "recette",
    });

    fireEvent.click(depense1);
    expect(onItemClick).toHaveBeenCalledTimes(2);
    expect(onItemClick).toHaveBeenLastCalledWith({
      id: "d-1",
      libelle: "Dépense 1",
      montant: 5,
      source: "salaire_previsionnel",
      type: "depense",
    });

    fireEvent.click(screen.getByTitle("Recette 2"));
    expect(onItemClick).toHaveBeenCalledTimes(2);

    expect(screen.getAllByTestId("chevron-right")).toHaveLength(2);
  });

  it("affiche les états sans détail, les messages d'absence de détail et le solde négatif", () => {
    const Wrapper = createWrapper();

    render(
      <DayDetailTooltip
        date={new Date(2024, 5, 3)}
        totalRecettes={120}
        totalDepenses={300}
        solde={-50}
        detailItems={[]}
        isPrevisionnel={false}
      >
        <span>Jour</span>
      </DayDetailTooltip>,
      { wrapper: Wrapper }
    );

    expect(screen.getByText(/3 juin 2024/i)).toBeInTheDocument();
    expect(screen.queryByText("Prévisionnel")).not.toBeInTheDocument();

    const noDetailMessages = screen.getAllByText("Aucun détail disponible");
    expect(noDetailMessages).toHaveLength(2);

    expect(screen.getByText("+120.00 €")).toBeInTheDocument();
    expect(screen.getByText("-300.00 €")).toBeInTheDocument();
    expect(screen.getByText("-180.00 €")).toBeInTheDocument();
    expect(screen.getByText("-50.00 €")).toBeInTheDocument();
  });

  it("affiche le message d'absence totale de transactions lorsque recettes et dépenses sont nulles", () => {
    const Wrapper = createWrapper();

    render(
      <DayDetailTooltip
        date={new Date(2024, 8, 1)}
        totalRecettes={0}
        totalDepenses={0}
        solde={0}
        detailItems={[]}
        isPrevisionnel={false}
      >
        <span>Vide</span>
      </DayDetailTooltip>,
      { wrapper: Wrapper }
    );

    expect(screen.getByText("Aucune transaction ce jour")).toBeInTheDocument();
    expect(screen.getByText("0.00 €")).toBeInTheDocument();
  });
});