import type { ButtonHTMLAttributes, ComponentProps, HTMLAttributes } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ProvisioningCard } from "./ProvisioningCard";

type SupabaseError = { message: string };
type QueryResolution = { data: unknown; error: SupabaseError | null };
type InvokeResolution = { data: unknown; error: SupabaseError | null };

interface ChainBuilder {
  select: (columns?: string) => ChainBuilder;
  eq: (column: string, value: unknown) => ChainBuilder;
  gte: (column: string, value: unknown) => ChainBuilder;
  lte: (column: string, value: unknown) => ChainBuilder;
  in: (column: string, values: readonly unknown[]) => ChainBuilder;
  order: (column: string, options?: Record<string, unknown>) => ChainBuilder;
  limit: (count: number) => ChainBuilder;
  insert: (values: unknown) => ChainBuilder;
  update: (values: unknown) => ChainBuilder;
  delete: () => ChainBuilder;
  upsert: (values: unknown) => ChainBuilder;
  match: (values: Record<string, unknown>) => ChainBuilder;
  range: (from: number, to: number) => ChainBuilder;
  single: () => Promise<QueryResolution>;
  maybeSingle: () => Promise<QueryResolution>;
  then: <TResult1 = QueryResolution, TResult2 = never>(
    onfulfilled?: ((value: QueryResolution) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) => Promise<TResult1 | TResult2>;
  catch: <TResult = never>(
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null,
  ) => Promise<QueryResolution | TResult>;
}

type MockButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: string;
  size?: string;
  asChild?: boolean;
};

type MockBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: string;
};

const hoisted = vi.hoisted(() => {
  const USER_ROLE = { isAdmin: true };

  const EXTERNAL_IDS_SUCCESS = [
    {
      system: "site_web",
      external_id: "portal-1",
      provisioned_at: "2024-01-01T00:00:00.000Z",
      metadata: {
        email: "admin@t.co",
        generated_password: "pwd-123",
      },
    },
    {
      system: "product",
      external_id: "prod-1",
      provisioned_at: "2024-01-02T00:00:00.000Z",
      metadata: {
        tenant: "dpi",
      },
    },
  ] as const;

  const LOGS_SUCCESS = [
    {
      step: "portal_create",
      status: "success",
      error: null,
      created_at: "2024-01-03T00:00:00.000Z",
      details: { external_id: "portal-1" },
    },
    {
      step: "product_create",
      status: "success",
      error: null,
      created_at: "2024-01-04T00:00:00.000Z",
      details: { external_id: "prod-1" },
    },
  ] as const;

  const EXTERNAL_IDS_RESULT: QueryResolution = { data: EXTERNAL_IDS_SUCCESS, error: null };
  const LOGS_RESULT: QueryResolution = { data: LOGS_SUCCESS, error: null };
  const EMPTY_RESULT: QueryResolution = { data: [], error: null };
  const QUERY_ERROR_RESULT: QueryResolution = { data: null, error: { message: "x" } };

  const INVOKE_SUCCESS_RESULT: InvokeResolution = {
    data: {
      results: [
        {
          portal: "ok",
          product: "dpi",
        },
      ],
    },
    error: null,
  };

  const INVOKE_ERROR_RESULT: InvokeResolution = {
    data: null,
    error: { message: "boom" },
  };

  const tableResults: Record<string, QueryResolution> = {
    client_external_ids: EXTERNAL_IDS_RESULT,
    client_provisioning_log: LOGS_RESULT,
  };

  const CLIPBOARD = {
    writeText: vi.fn(),
  };

  return {
    USER_ROLE,
    EXTERNAL_IDS_RESULT,
    LOGS_RESULT,
    EMPTY_RESULT,
    QUERY_ERROR_RESULT,
    INVOKE_SUCCESS_RESULT,
    INVOKE_ERROR_RESULT,
    tableResults,
    mockFrom: vi.fn(),
    mockInvoke: vi.fn(),
    mockUseUserRole: vi.fn(() => USER_ROLE),
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
    CLIPBOARD,
  };
});

vi.mock("@/components/ui/card", async () => {
  const React = await import("react");

  const createDiv =
    (testId: string) =>
    ({ children, className }: HTMLAttributes<HTMLDivElement>) =>
      React.createElement("div", { className, "data-testid": testId }, children);

  return {
    Card: createDiv("card"),
    CardHeader: createDiv("card-header"),
    CardContent: createDiv("card-content"),
    CardTitle: createDiv("card-title"),
    CardDescription: createDiv("card-description"),
    CardFooter: createDiv("card-footer"),
  };
});

vi.mock("@/components/ui/button", async () => {
  const React = await import("react");

  const Button = (props: MockButtonProps) => {
    const { children, variant, size, asChild, ...buttonProps } = props;
    void variant;
    void size;
    void asChild;

    return React.createElement("button", buttonProps, children);
  };

  return {
    Button,
    buttonVariants: () => "",
  };
});

vi.mock("@/components/ui/badge", async () => {
  const React = await import("react");

  const Badge = (props: MockBadgeProps) => {
    const { children, variant, ...badgeProps } = props;

    return React.createElement("span", { ...badgeProps, "data-variant": variant }, children);
  };

  return {
    Badge,
    badgeVariants: () => "",
  };
});

vi.mock("lucide-react", async () => {
  const React = await import("react");

  const Icon = ({ className }: { className?: string }) =>
    React.createElement("span", { className, "data-testid": "icon" });

  return {
    CheckCircle2: Icon,
    Clock: Icon,
    AlertTriangle: Icon,
    RefreshCw: Icon,
    Copy: Icon,
  };
});

vi.mock("@/hooks/shared/useUserRole", () => ({
  useUserRole: hoisted.mockUseUserRole,
}));

vi.mock("sonner", () => ({
  toast: {
    success: hoisted.mockToastSuccess,
    error: hoisted.mockToastError,
  },
}));

vi.mock("@/integrations/supabase/client", () => {
  const resolveTable = (table: string): QueryResolution => hoisted.tableResults[table] ?? hoisted.EMPTY_RESULT;

  const createBuilder = (table: string): ChainBuilder => {
    let builder: ChainBuilder;

    builder = {
      select: vi.fn(() => builder) as ChainBuilder["select"],
      eq: vi.fn(() => builder) as ChainBuilder["eq"],
      gte: vi.fn(() => builder) as ChainBuilder["gte"],
      lte: vi.fn(() => builder) as ChainBuilder["lte"],
      in: vi.fn(() => builder) as ChainBuilder["in"],
      order: vi.fn(() => builder) as ChainBuilder["order"],
      limit: vi.fn(() => builder) as ChainBuilder["limit"],
      insert: vi.fn(() => builder) as ChainBuilder["insert"],
      update: vi.fn(() => builder) as ChainBuilder["update"],
      delete: vi.fn(() => builder) as ChainBuilder["delete"],
      upsert: vi.fn(() => builder) as ChainBuilder["upsert"],
      match: vi.fn(() => builder) as ChainBuilder["match"],
      range: vi.fn(() => builder) as ChainBuilder["range"],
      single: vi.fn(() => Promise.resolve(resolveTable(table))) as ChainBuilder["single"],
      maybeSingle: vi.fn(() => Promise.resolve(resolveTable(table))) as ChainBuilder["maybeSingle"],
      then: (<TResult1 = QueryResolution, TResult2 = never>(
        onfulfilled?: ((value: QueryResolution) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
      ) => Promise.resolve(resolveTable(table)).then(onfulfilled, onrejected)) as ChainBuilder["then"],
      catch: (<TResult = never>(
        onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null,
      ) => Promise.resolve(resolveTable(table)).catch(onrejected)) as ChainBuilder["catch"],
    };

    return builder;
  };

  hoisted.mockFrom.mockImplementation((table: string) => createBuilder(table));

  return {
    supabase: {
      from: hoisted.mockFrom,
      functions: {
        invoke: hoisted.mockInvoke,
      },
    },
  };
});

type ProvisioningCardProps = ComponentProps<typeof ProvisioningCard>;

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

const renderProvisioningCard = (props: Partial<ProvisioningCardProps> = {}) => {
  const queryClient = createQueryClient();

  const defaultProps: ProvisioningCardProps = {
    etablissementId: "etab-1",
    statut: "Production",
    backendUrl: null,
  };

  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <ProvisioningCard {...defaultProps} {...props} />
    </QueryClientProvider>,
  );

  return { queryClient, ...rendered };
};

describe("ProvisioningCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    hoisted.USER_ROLE.isAdmin = true;
    hoisted.tableResults.client_external_ids = hoisted.EXTERNAL_IDS_RESULT;
    hoisted.tableResults.client_provisioning_log = hoisted.LOGS_RESULT;
    hoisted.mockInvoke.mockResolvedValue(hoisted.INVOKE_SUCCESS_RESULT);
    hoisted.CLIPBOARD.writeText.mockResolvedValue(undefined);

    Object.defineProperty(navigator, "clipboard", {
      value: hoisted.CLIPBOARD,
      configurable: true,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("rend null pour un utilisateur non administrateur", () => {
    hoisted.USER_ROLE.isAdmin = false;

    renderProvisioningCard();

    expect(screen.queryByText("Provisionnement automatique")).toBeNull();
  });

  it("affiche l'état initial de chargement puis les données métier provisionnées", async () => {
    renderProvisioningCard({ statut: "Prospect", backendUrl: null });

    expect(screen.getByText("Provisionnement automatique")).toBeTruthy();
    expect(screen.getByText("En attente")).toBeTruthy();
    expect(screen.getByText("Action requise")).toBeTruthy();

    expect(await screen.findByText(/admin@t\.co/)).toBeTruthy();
    expect(screen.getByText("pwd-123")).toBeTruthy();
    expect(screen.getAllByText("Provisionné")).toHaveLength(2);
    expect(screen.getByText("Derniers logs (2)")).toBeTruthy();
    expect(screen.getByText(/n'est pas en statut/)).toBeTruthy();

    expect(hoisted.mockFrom).toHaveBeenCalledWith("client_external_ids");
    expect(hoisted.mockFrom).toHaveBeenCalledWith("client_provisioning_log");
  });

  it("reste sur les statuts d'attente quand les requêtes Supabase échouent", async () => {
    hoisted.tableResults.client_external_ids = hoisted.QUERY_ERROR_RESULT;
    hoisted.tableResults.client_provisioning_log = hoisted.QUERY_ERROR_RESULT;

    renderProvisioningCard({ backendUrl: null });

    await waitFor(() => {
      expect(hoisted.mockFrom).toHaveBeenCalledWith("client_external_ids");
      expect(hoisted.mockFrom).toHaveBeenCalledWith("client_provisioning_log");
    });

    expect(screen.getByText("En attente")).toBeTruthy();
    expect(screen.getByText("Action requise")).toBeTruthy();
    expect(screen.queryByText(/admin@t\.co/)).toBeNull();
    expect(screen.queryByText(/Derniers logs/)).toBeNull();
  });

  it("relance le provisionnement avec le bon payload et affiche le toast de succès", async () => {
    renderProvisioningCard();

    expect(await screen.findByText(/admin@t\.co/)).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Relancer/i }));
    });

    await waitFor(() => {
      expect(hoisted.mockInvoke).toHaveBeenCalledWith("provision-client-on-production", {
        body: { etablissement_id: "etab-1" },
      });
    });

    await waitFor(() => {
      expect(hoisted.mockToastSuccess).toHaveBeenCalledWith(
        "Provisionnement lancé — portail: ok, produit: dpi",
      );
    });
  });

  it("affiche un toast d'erreur quand la relance échoue", async () => {
    hoisted.mockInvoke.mockResolvedValue(hoisted.INVOKE_ERROR_RESULT);

    renderProvisioningCard();

    expect(await screen.findByText(/admin@t\.co/)).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Relancer/i }));
    });

    await waitFor(() => {
      expect(hoisted.mockToastError).toHaveBeenCalledWith("boom");
    });
  });

  it("copie le mot de passe temporaire du portail", async () => {
    renderProvisioningCard();

    expect(await screen.findByText("pwd-123")).toBeTruthy();

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);

    await act(async () => {
      fireEvent.click(buttons[1]);
    });

    expect(hoisted.CLIPBOARD.writeText).toHaveBeenCalledWith("pwd-123");
    expect(hoisted.mockToastSuccess).toHaveBeenCalledWith("Mot de passe copié");
  });
});