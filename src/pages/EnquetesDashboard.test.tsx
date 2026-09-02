import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactNode,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";
import EnquetesDashboard from "./EnquetesDashboard";

type Row = Record<string, unknown>;
type QueryResponse = { data: readonly Row[] | null; error: { message: string } | null };
type ThenMethod = <TResult1 = QueryResponse, TResult2 = never>(
  onfulfilled?: ((value: QueryResponse) => TResult1 | PromiseLike<TResult1>) | null,
  onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
) => Promise<TResult1 | TResult2>;
type CatchMethod = <TResult = never>(
  onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null,
) => Promise<QueryResponse | TResult>;
type QueryBuilderMock = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  then: ThenMethod;
  catch: CatchMethod;
};
type PassthroughProps = HTMLAttributes<HTMLElement> & { children?: ReactNode };
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { children?: ReactNode; variant?: string; size?: string };
type TabsProps = HTMLAttributes<HTMLDivElement> & { children?: ReactNode; defaultValue?: string; value?: string };
type TabsTriggerProps = ButtonHTMLAttributes<HTMLButtonElement> & { children?: ReactNode; value?: string };
type BadgeProps = HTMLAttributes<HTMLSpanElement> & { children?: ReactNode; variant?: string };
type TableProps = TableHTMLAttributes<HTMLTableElement> & { children?: ReactNode };
type CellProps = TdHTMLAttributes<HTMLTableCellElement> & { children?: ReactNode };
type HeadProps = ThHTMLAttributes<HTMLTableCellElement> & { children?: ReactNode };

const {
  mockFrom,
  state,
  mockCreateObjectURL,
  mockRevokeObjectURL,
  mockAnchorClick,
} = vi.hoisted(() => {
  const formationRows: readonly Row[] = [
    {
      id: "f1",
      date_reponse: "2024-01-02T09:00:00.000Z",
      etablissements: { nom: "Clinique Alpha" },
      nom_prenom: "Alice Martin",
      fonction: "Cadre santé",
      dpi: "DPI One",
      note_globale: 8,
    },
    {
      id: "f2",
      date_reponse: "2024-01-01T09:00:00.000Z",
      etablissements: { nom: "Clinique Beta" },
      nom_prenom: "Bruno Petit",
      fonction: "IDE",
      dpi: "DPI Two",
      note_globale: 6,
    },
  ];

  const cesRows: readonly Row[] = [
    {
      id: "e1",
      date_reponse: "2024-01-03T09:00:00.000Z",
      etablissements: { nom: "Hôpital Nord" },
      nom_prenom: "Claire Durand",
      fonction: "Médecin",
      dpi: "DPI Three",
      effort_score: 3,
    },
    {
      id: "e2",
      date_reponse: "2024-01-04T09:00:00.000Z",
      etablissements: { nom: "Hôpital Sud" },
      nom_prenom: "David Leroy",
      fonction: "Secrétaire",
      dpi: "DPI Four",
      effort_score: 7,
    },
  ];

  const solutionRows: readonly Row[] = [
    {
      id: "s1",
      date_reponse: "2024-01-05T09:00:00.000Z",
      etablissements: { nom: "Centre Gamma" },
      nom_prenom: "Emma Bernard",
      fonction: "Directrice",
      dpi: "DPI Five",
      satisfaction_globale: 9,
      nps_score: 10,
      gain_temps_estime: "10_15min",
    },
    {
      id: "s2",
      date_reponse: "2024-01-06T09:00:00.000Z",
      etablissements: { nom: "Centre Delta" },
      nom_prenom: "Farid Durand",
      fonction: "Manip radio",
      dpi: "DPI Six",
      satisfaction_globale: 5,
      nps_score: 4,
      gain_temps_estime: "none",
    },
    {
      id: "s3",
      date_reponse: "2024-01-07T09:00:00.000Z",
      etablissements: { nom: "Centre Epsilon" },
      nom_prenom: "Gaëlle Simon",
      fonction: "Accueil",
      dpi: "DPI Seven",
      satisfaction_globale: 8,
      nps_score: 8,
      gain_temps_estime: "5_10min",
    },
  ];

  const csmRows: readonly Row[] = [
    {
      id: "c1",
      date_reponse: "2024-01-08T09:00:00.000Z",
      etablissements: { nom: "Maison Zeta" },
      profiles: { full_name: "CSM Test" },
      nom_prenom: "Hugo Robert",
      fonction: "Responsable",
      dpi: "DPI Eight",
      note_globale: 9,
    },
  ];

  const campagneRows: readonly Row[] = [
    {
      id: "p1",
      type: "formation",
      canal: "email",
      status: "responded",
      scheduled_at: "2024-01-09T08:00:00.000Z",
      sent_at: "2024-01-09T08:05:00.000Z",
      responded_at: "2024-01-09T10:00:00.000Z",
      expires_at: "2024-01-16T08:00:00.000Z",
      created_at: "2024-01-09T07:00:00.000Z",
    },
    {
      id: "p2",
      type: "ces",
      canal: "sms",
      status: "sent",
      scheduled_at: "2024-01-10T08:00:00.000Z",
      sent_at: "2024-01-10T08:05:00.000Z",
      responded_at: null,
      expires_at: "2024-01-17T08:00:00.000Z",
      created_at: "2024-01-10T07:00:00.000Z",
    },
    {
      id: "p3",
      type: "solution",
      canal: "email",
      status: "responded",
      scheduled_at: "2024-01-11T08:00:00.000Z",
      sent_at: "2024-01-11T08:05:00.000Z",
      responded_at: "2024-01-11T12:00:00.000Z",
      expires_at: "2024-01-18T08:00:00.000Z",
      created_at: "2024-01-11T07:00:00.000Z",
    },
  ];

  const successResponses: Record<string, QueryResponse> = {
    enquetes_satisfaction_formation: { data: formationRows, error: null },
    enquetes_ces: { data: cesRows, error: null },
    enquetes_satisfaction_solution: { data: solutionRows, error: null },
    enquetes_suivi_csm: { data: csmRows, error: null },
    enquetes_campagnes: { data: campagneRows, error: null },
    satisfaction_v3_responses: { data: [
      { source: 'v3-dpi', satisfaction: 10, recommendation: 10, created_at: '2024-01-12T00:00:00Z' },
      { source: 'public-form', satisfaction: 4, recommendation: 4, created_at: '2024-01-13T00:00:00Z' },
    ], error: null },
  };

  const errorResponse: QueryResponse = { data: null, error: { message: "x" } };
  const pendingResponse: QueryResponse = { data: [], error: null };

  let pendingResolver: ((value: QueryResponse) => void) | undefined;
  let pendingPromise: Promise<QueryResponse> = new Promise<QueryResponse>((resolve) => {
    pendingResolver = resolve;
  });

  const control = {
    mode: "success",
    resetPending: () => {
      pendingPromise = new Promise<QueryResponse>((resolve) => {
        pendingResolver = resolve;
      });
    },
    resolvePending: () => {
      const resolver = pendingResolver;
      if (resolver) {
        resolver(pendingResponse);
      }
    },
  };

  const getPromise = (table: string): Promise<QueryResponse> => {
    if (control.mode === "pending") {
      return pendingPromise;
    }

    if (control.mode === "error") {
      return Promise.resolve(errorResponse);
    }

    const response = successResponses[table] ?? { data: [], error: null };
    return Promise.resolve(response);
  };

  const createBuilder = (table: string): QueryBuilderMock => {
    const builder = {} as QueryBuilderMock;
    const chain = () => builder;

    builder.select = vi.fn(chain);
    builder.eq = vi.fn(chain);
    builder.gte = vi.fn(chain);
    builder.lte = vi.fn(chain);
    builder.in = vi.fn(chain);
    builder.order = vi.fn(chain);
    builder.limit = vi.fn(chain);
    builder.insert = vi.fn(chain);
    builder.update = vi.fn(chain);
    builder.delete = vi.fn(chain);
    builder.single = vi.fn(() => getPromise(table));
    builder.maybeSingle = vi.fn(() => getPromise(table));
    builder.then = <TResult1 = QueryResponse, TResult2 = never>(
      onfulfilled?: ((value: QueryResponse) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) => getPromise(table).then(onfulfilled, onrejected);
    builder.catch = <TResult = never>(
      onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null,
    ) => getPromise(table).catch(onrejected);

    return builder;
  };

  return {
    mockFrom: vi.fn((table: string) => createBuilder(table)),
    state: control,
    mockCreateObjectURL: vi.fn(() => "blob:test-url"),
    mockRevokeObjectURL: vi.fn(),
    mockAnchorClick: vi.fn(),
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock("./AdminSatisfaction", () => ({ default: () => null }));
vi.mock("./AdminSatisfactionCampagnes", () => ({ default: () => null }));

vi.mock("@/components/ui/card", async () => {
  const React = await import("react");
  const Passthrough = ({ children, ...props }: PassthroughProps) => React.createElement("div", props, children);

  return {
    Card: Passthrough,
    CardHeader: Passthrough,
    CardFooter: Passthrough,
    CardTitle: ({ children, ...props }: PassthroughProps) => React.createElement("h2", props, children),
    CardDescription: Passthrough,
    CardContent: Passthrough,
  };
});

vi.mock("@/components/ui/tabs", async () => {
  const React = await import("react");

  return {
    Tabs: ({ children, defaultValue, value, ...props }: TabsProps) =>
      React.createElement("div", { ...props, "data-default-value": defaultValue, "data-value": value }, children),
    TabsList: ({ children, ...props }: PassthroughProps) => React.createElement("div", props, children),
    TabsTrigger: ({ children, value, ...props }: TabsTriggerProps) =>
      React.createElement("button", { ...props, type: "button", "data-value": value }, children),
    TabsContent: ({ children, value, ...props }: TabsProps) =>
      React.createElement("section", { ...props, "data-value": value }, children),
  };
});

vi.mock("@/components/ui/skeleton", async () => {
  const React = await import("react");

  return {
    Skeleton: (props: HTMLAttributes<HTMLDivElement>) => React.createElement("div", { ...props, "data-testid": "skeleton" }),
  };
});

vi.mock("@/components/ui/table", async () => {
  const React = await import("react");

  return {
    Table: ({ children, ...props }: TableProps) => React.createElement("table", props, children),
    TableHeader: ({ children, ...props }: HTMLAttributes<HTMLTableSectionElement>) => React.createElement("thead", props, children),
    TableBody: ({ children, ...props }: HTMLAttributes<HTMLTableSectionElement>) => React.createElement("tbody", props, children),
    TableFooter: ({ children, ...props }: HTMLAttributes<HTMLTableSectionElement>) => React.createElement("tfoot", props, children),
    TableRow: ({ children, ...props }: HTMLAttributes<HTMLTableRowElement>) => React.createElement("tr", props, children),
    TableHead: ({ children, ...props }: HeadProps) => React.createElement("th", props, children),
    TableCell: ({ children, ...props }: CellProps) => React.createElement("td", props, children),
    TableCaption: ({ children, ...props }: HTMLAttributes<HTMLTableCaptionElement>) => React.createElement("caption", props, children),
  };
});

vi.mock("@/components/ui/badge", async () => {
  const React = await import("react");

  return {
    Badge: ({ children, variant, ...props }: BadgeProps) =>
      React.createElement("span", { ...props, "data-variant": variant }, children),
    badgeVariants: vi.fn(() => ""),
  };
});

vi.mock("@/components/ui/button", async () => {
  const React = await import("react");

  return {
    Button: ({ children, variant, size, ...props }: ButtonProps) =>
      React.createElement("button", { ...props, type: "button", "data-variant": variant, "data-size": size }, children),
  };
});

vi.mock("lucide-react", async () => {
  const React = await import("react");
  const Icon = ({ className }: { className?: string }) => React.createElement("svg", { className, "data-testid": "icon" });

  return {
    ClipboardCheck: Icon,
    Download: Icon,
    TrendingUp: Icon,
    Users: Icon,
    Sparkles: Icon,
    Heart: Icon,
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

function renderDashboard() {
  const queryClient = createQueryClient();
  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <EnquetesDashboard />
    </QueryClientProvider>,
  );

  return { queryClient, ...rendered };
}

function expectKpi(label: string, expectedValue: string) {
  const labelElement = screen.getByText(label);
  const parent = labelElement.parentElement;
  expect(parent).toBeTruthy();
  expect(within(parent as HTMLElement).getByText(expectedValue)).toBeTruthy();
}

beforeEach(() => {
  state.mode = "success";
  state.resetPending();
  mockFrom.mockClear();
  mockCreateObjectURL.mockClear();
  mockRevokeObjectURL.mockClear();
  mockAnchorClick.mockClear();

  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: mockCreateObjectURL,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: mockRevokeObjectURL,
  });
  Object.defineProperty(HTMLAnchorElement.prototype, "click", {
    configurable: true,
    value: mockAnchorClick,
  });
});

afterEach(() => {
  state.resolvePending();
  cleanup();
});

describe("EnquetesDashboard", () => {
  it("affiche les skeletons pendant le chargement", () => {
    state.mode = "pending";
    const { unmount, queryClient } = renderDashboard();

    expect(screen.getAllByTestId("skeleton")).toHaveLength(6);
    expect(screen.queryByText("Enquêtes de suivi clients")).toBeNull();

    state.resolvePending();
    unmount();
    queryClient.clear();
  });

  it("affiche les KPI consolidés, les onglets et les réponses récentes", async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("Enquêtes de suivi clients")).toBeTruthy();
    });

    expect(screen.getByText("Analyse consolidée des 4 questionnaires de satisfaction.")).toBeTruthy();

    expectKpi("CSAT Formation", "7.0/10");
    expectKpi("CSAT Solution", "7.3/10");
    expectKpi("CSAT OpenPulse V3", "4.5/5");
    expectKpi("CES moyen", "5.0/10");
    expectKpi("Note CSM", "9.0/10");
    expectKpi("NPS", "0");
    expectKpi("Taux de réponse", "67%");
    expectKpi("% gain >5min/patient", "67%");
    expectKpi("Total réponses", "10");

    expect(screen.getByText("Formation (2)")).toBeTruthy();
    expect(screen.getByText("CES (2)")).toBeTruthy();
    expect(screen.getByText("Satisfaction/NPS (3)")).toBeTruthy();
    expect(screen.getByText("Suivi CSM (1)")).toBeTruthy();
    expect(screen.getByText("Campagnes (3)")).toBeTruthy();

    expect(screen.getByText("Clinique Alpha")).toBeTruthy();
    expect(screen.getByText("Alice Martin")).toBeTruthy();
    expect(screen.getByText("DPI One")).toBeTruthy();
    expect(screen.getByText("Centre Gamma")).toBeTruthy();
    expect(screen.getByText("Emma Bernard")).toBeTruthy();
    expect(screen.getByText("Maison Zeta")).toBeTruthy();
    expect(screen.getByText("Hugo Robert")).toBeTruthy();
    expect(screen.getByText("formation")).toBeTruthy();
    expect(screen.getByText("sms")).toBeTruthy();
    expect(screen.getAllByText("responded")).toHaveLength(2);

    expect(mockFrom).toHaveBeenCalledWith("enquetes_satisfaction_formation");
    expect(mockFrom).toHaveBeenCalledWith("enquetes_ces");
    expect(mockFrom).toHaveBeenCalledWith("enquetes_satisfaction_solution");
    expect(mockFrom).toHaveBeenCalledWith("enquetes_suivi_csm");
    expect(mockFrom).toHaveBeenCalledWith("enquetes_campagnes");
  });

  it("exporte les lignes visibles en CSV depuis le bouton de l'onglet formation", async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("Enquêtes de suivi clients")).toBeTruthy();
    });

    const buttons = screen.getAllByRole("button", { name: /Exporter CSV/i });
    expect(buttons).toHaveLength(4);

    fireEvent.click(buttons[0] as HTMLElement);

    expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);
    expect(mockAnchorClick).toHaveBeenCalledTimes(1);
    expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:test-url");
  });

  it("affiche une erreur et permet de réessayer quand Supabase échoue", async () => {
    state.mode = "error";
    renderDashboard();

    expect(await screen.findByText("Impossible de charger les enquêtes")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeTruthy();
  });
});