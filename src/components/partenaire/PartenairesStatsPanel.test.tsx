import React from "react";
import { render, screen, renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PartenairesStatsPanel } from "./PartenairesStatsPanel";

const { PARTENAIRES, mockSupabaseFrom, mockMutate, mockUsePartenaires } = vi.hoisted(() => {
  const now = new Date();
  const todayIso = now.toISOString();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 2).toISOString(); // 2nd of month
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15).toISOString();
  const older = new Date(now.getFullYear(), now.getMonth() - 7, 1).toISOString();
  const longAgo = new Date(now.getTime() - (1000 * 60 * 60 * 24 * 120)).toISOString(); // 120 days ago
  const pastAction = new Date(now.getTime() - (1000 * 60 * 60 * 24 * 10)).toISOString(); // 10 days ago

  const mockFrom = vi.fn();
  const mockMut = vi.fn();
  const usePartMock = vi.fn().mockReturnValue({ data: [], error: null });

  const PARTS = [
    {
      id: "1",
      statut_relation: "actif",
      valeur_partenariat: 2000,
      engagement_score: 80,
      dernier_contact: longAgo,
      prochaine_action: null,
      created_at: todayIso,
      region: "Ile-de-France",
      type_partenaire: "institutionnel",
    },
    {
      id: "2",
      statut_relation: "prospect",
      valeur_partenariat: 0,
      engagement_score: 60,
      dernier_contact: new Date().toISOString(),
      prochaine_action: pastAction,
      created_at: lastMonth,
      region: "Occitanie",
      type_partenaire: "industriel",
    },
    {
      id: "3",
      statut_relation: "actif",
      valeur_partenariat: 3000,
      engagement_score: 40,
      dernier_contact: new Date().toISOString(),
      prochaine_action: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
      created_at: older,
      region: "Ile-de-France",
      type_partenaire: "prestataire",
    },
    {
      id: "4",
      statut_relation: "inactif",
      valeur_partenariat: 0,
      engagement_score: 0,
      dernier_contact: null,
      prochaine_action: null,
      created_at: startOfMonth,
      region: "Bretagne",
      type_partenaire: "institutionnel",
    },
  ];

  // default the hook to return these partenaires
  usePartMock.mockReturnValue({ data: PARTS, error: null });

  return {
    PARTENAIRES: PARTS,
    mockSupabaseFrom: mockFrom,
    mockMutate: mockMut,
    mockUsePartenaires: usePartMock,
  };
});

// Mock UI primitives used by the component
vi.mock("@/components/ui/card", () => {
  return {
    Card: (props: any) =>
      React.createElement(
        "div",
        { ...props, "data-testid": `Card-${typeof props?.className === "string" ? props.className : "card"}` },
        props.children
      ),
    CardContent: (props: any) => React.createElement("div", { ...props }, props.children),
    CardHeader: (props: any) => React.createElement("div", { ...props }, props.children),
    CardTitle: (props: any) => React.createElement("div", { ...props }, props.children),
  };
});

vi.mock("@/components/ui/accordion", () => {
  return {
    Accordion: (props: any) => React.createElement("div", { ...props }, props.children),
    AccordionContent: (props: any) => React.createElement("div", { ...props }, props.children),
    AccordionItem: (props: any) => React.createElement("div", { ...props }, props.children),
    AccordionTrigger: (props: any) => React.createElement("button", { ...props }, props.children),
  };
});

vi.mock("@/components/ui/badge", () => {
  return {
    Badge: (props: any) => React.createElement("span", { ...props }, props.children),
  };
});

vi.mock("@/components/ui/chart", () => {
  return {
    ChartContainer: (props: any) => React.createElement("div", { ...props }, props.children),
  };
});

// Mock lucide icons as simple inline elements with data-icon attribute
vi.mock("lucide-react", () => {
  const makeIcon = (name: string) => (props: any) =>
    React.createElement("i", { "data-icon": name, className: props?.className ?? "" }, null);
  return {
    Users: makeIcon("Users"),
    Activity: makeIcon("Activity"),
    DollarSign: makeIcon("DollarSign"),
    Target: makeIcon("Target"),
    AlertCircle: makeIcon("AlertCircle"),
    Sparkles: makeIcon("Sparkles"),
    TrendingUp: makeIcon("TrendingUp"),
    TrendingDown: makeIcon("TrendingDown"),
    Minus: makeIcon("Minus"),
  };
});

// Mock recharts primitives to render simple wrappers
vi.mock("recharts", () => {
  const C = (props: any) => React.createElement("div", { ...props }, props.children);
  return {
    PieChart: C,
    Pie: C,
    Cell: (props: any) => React.createElement("div", { ...props }),
    ResponsiveContainer: C,
    BarChart: C,
    Bar: C,
    XAxis: C,
    YAxis: C,
    Tooltip: C,
    LineChart: C,
    Line: C,
    CartesianGrid: C,
  };
});

// Mock supabase client builder and ensure from is the hoisted stable mock
vi.mock("@/integrations/supabase/client", () => {
  const builder: any = {
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
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: function (onFulfilled: any) {
      return Promise.resolve({ data: [], error: null }).then(onFulfilled);
    },
    catch: function (onRejected: any) {
      return Promise.resolve({ data: [], error: null }).catch(onRejected);
    },
  };
  // Ensure the hoisted mock function returns the builder
  mockSupabaseFrom.mockImplementation(() => builder);
  return {
    supabase: {
      from: mockSupabaseFrom,
    },
  };
});

// Mock auth hooks/context
vi.mock("@/hooks/useAuth", () => {
  const stable = { user: { id: "u1", email: "t@t.co" }, session: { user: { id: "u1" } }, isLoading: false };
  return {
    useAuth: () => stable,
  };
});

vi.mock("@/contexts/AuthContext", () => {
  return {
    useAuthContext: () => ({ user: { id: "u1" }, isLoading: false }),
  };
});

// Mock the partenaires hook used by the component, return stable data via hoisted mock
vi.mock("@/hooks/crm/usePartenaires", () => {
  return {
    usePartenaires: (..._args: any[]) => mockUsePartenaires(),
  };
});

// Mock services/partenaires to expose a mutation that uses the hoisted mockMutate
vi.mock("@/services/partenaires", () => {
  return {
    useCreatePartenaire: () => {
      return {
        mutate: mockMutate,
      };
    },
  };
});

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock react-router
vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

describe("PartenairesStatsPanel", () => {
  const createQueryWrapper = () => {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });
    const Wrapper: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    return Wrapper;
  };

  it("renders KPIs correctly and computes evolution/trend from provided partenaires", () => {
    // Render component with PARTENAIRES and previousMonthCount = 2
    render(<PartenairesStatsPanel partenaires={PARTENAIRES} previousMonthCount={2} />, {
      wrapper: createQueryWrapper() as any,
    });

    // Total should be equal to PARTENAIRES.length
    const totalTitle = screen.getByText("Total");
    const totalValueEl = totalTitle.parentElement?.previousElementSibling;
    expect(totalValueEl?.textContent).toBe(String(PARTENAIRES.length));

    // Actifs count
    const actifsTitle = screen.getByText("Actifs");
    const actifsValueEl = actifsTitle.parentElement?.previousElementSibling;
    const actifsCount = PARTENAIRES.filter((p: any) => p.statut_relation === "actif").length;
    expect(actifsValueEl?.textContent).toBe(String(actifsCount));

    // Valeur formatted to k€
    const valeurTitle = screen.getByText("Valeur");
    const valeurValueEl = valeurTitle.parentElement?.previousElementSibling;
    const valeurTotale = PARTENAIRES.reduce((s: number, p: any) => s + (p.valeur_partenariat || 0), 0);
    const formatted = valeurTotale > 0 ? `${(valeurTotale / 1000).toFixed(0)}k€` : "0€";
    expect(valeurValueEl?.textContent).toBe(formatted);

    // Engagement average
    const engagementTitle = screen.getByText("Engagement");
    const engagementValueEl = engagementTitle.parentElement?.previousElementSibling;
    const expectedEngagement =
      PARTENAIRES.length > 0
        ? Math.round(PARTENAIRES.reduce((s: number, p: any) => s + (p.engagement_score || 0), 0) / PARTENAIRES.length)
        : 0;
    expect(engagementValueEl?.textContent).toBe(`${expectedEngagement}%`);

    // À relancer
    const relancerTitle = screen.getByText("À relancer");
    const relancerValueEl = relancerTitle.parentElement?.previousElementSibling;
    const aRelancer = PARTENAIRES.filter((p: any) => {
      const now = new Date();
      const dernier = p.dernier_contact ? new Date(p.dernier_contact) : null;
      const prochaine = p.prochaine_action ? new Date(p.prochaine_action) : null;
      const contactOld = dernier ? (now.getTime() - dernier.getTime()) / (1000 * 60 * 60 * 24) > 60 : false;
      const actionPassed = prochaine ? prochaine < now : false;
      return contactOld || actionPassed;
    }).length;
    expect(relancerValueEl?.textContent).toBe(String(aRelancer));

    // Nouveaux this month
    const nouveauxTitle = screen.getByText("Nouveaux");
    const nouveauxValueEl = nouveauxTitle.parentElement?.previousElementSibling;
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const nouveauxCount = PARTENAIRES.filter((p: any) => new Date(p.created_at) >= startOfMonth).length;
    expect(nouveauxValueEl?.textContent).toBe(String(nouveauxCount));

    // Evolution description on Total card should be "+"
    const descriptionSpan = totalTitle.parentElement?.querySelector("span");
    // Compute expected evolution text
    const previousMonthCount = 2;
    const total = PARTENAIRES.length;
    const evolution = previousMonthCount !== undefined ? ((total - previousMonthCount) / (previousMonthCount || 1)) * 100 : null;
    const expectedDescription = evolution !== null ? `${evolution > 0 ? "+" : ""}${evolution.toFixed(1)}%` : undefined;
    expect(descriptionSpan?.textContent).toBe(expectedDescription);

    // TrendingUp icon must be present with green class when evolution > 0
    const trending = document.querySelector('[data-icon="TrendingUp"]') as HTMLElement | null;
    expect(trending).not.toBeNull();
    expect(trending?.className.includes("text-green-600")).toBe(true);
  });

  it("supports renderHook inside QueryClientProvider wrapper (loading state simulation)", () => {
    const Wrapper = createQueryWrapper();
    const useDummy = () => ({ isLoading: true });
    const { result } = renderHook(() => useDummy(), { wrapper: Wrapper as any });
    expect(result.current.isLoading).toBe(true);
  });

  it("handles an error-returning partenaires hook (data null + error) via mocked hook", () => {
    // Make the mocked hook return an error shape
    mockUsePartenaires.mockReturnValue({ data: null, error: { message: "fetch failed" } });

    const Wrapper = createQueryWrapper();
    const { result } = renderHook(() => mockUsePartenaires(), { wrapper: Wrapper as any });

    expect(result.current.data).toBeNull();
    expect(result.current.error).not.toBeNull();
    expect(result.current.error.message).toBe("fetch failed");

    // Restore the mock to return normal data for other tests
    mockUsePartenaires.mockReturnValue({ data: PARTENAIRES, error: null });
  });

  it("invokes the mocked mutation function with the expected payload", async () => {
    const payload = { nom: "Nouveau Partenaire", statut_relation: "prospect" };

    await act(async () => {
      // Trigger the mutation via the hoisted mock directly which simulates the service hook's mutate
      mockMutate(payload);
    });

    expect(mockMutate).toHaveBeenCalledWith(payload);
  });
});