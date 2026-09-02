import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  SVGProps,
} from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const hoisted = vi.hoisted(() => {
  const ROWS = [{ id: "1" }];

  const WEBHOOKS_DATA = {
    endpoints: [
      {
        id: "wh1",
        system: "site_web",
        url: "https://example.test/platform-webhook",
        active: true,
        created_at: "2024-01-01T10:00:00.000Z",
        updated_at: "2024-01-02T11:00:00.000Z",
      },
    ],
  };

  const KEYS_DATA = {
    keys: [
      {
        id: "key1",
        nom: "Site Web prod",
        key_prefix: "pk_demo",
        permissions: ["platform:site_web"],
        total_requests: 7,
        last_used_at: "2024-01-03T12:00:00.000Z",
        est_active: true,
        revoked_at: null,
      },
    ],
  };

  const EVENTS_DATA = {
    events: [
      {
        id: "evt1",
        event_type: "tenant.created",
        status: "dead",
        attempts: 5,
        target: "site_web",
        last_error: "boom",
        created_at: "2024-01-04T13:00:00.000Z",
      },
    ],
  };

  const MAPPINGS_DATA = {
    mappings: [
      {
        id: "map1",
        etablissement_id: "etab1",
        etablissement_nom: "Clinique Démo",
        etablissement_name: "Clinique Démo",
        etablissements: { nom: "Clinique Démo", name: "Clinique Démo" },
        system: "product",
        external_system: "product",
        external_id: "ext-42",
        provisioned_at: "2024-01-05T14:00:00.000Z",
        created_at: "2024-01-05T14:00:00.000Z",
      },
    ],
  };

  const UNIVERSAL_GET_DATA = {
    endpoints: WEBHOOKS_DATA.endpoints,
    keys: KEYS_DATA.keys,
    events: EVENTS_DATA.events,
    mappings: MAPPINGS_DATA.mappings,
  };

  const ERROR_DATA = { error: "x" };
  const SESSION_DATA = { data: { session: { access_token: "tok" } } };
  const INVOKE_GET_DATA = { data: null, error: null };
  const CREATED_KEY_DATA = { key: "new-key", prefix: "new" };
  const ROTATED_SECRET_DATA = { system: "site_web", hmac_secret: "hmac-1" };
  const UPSERT_DATA = { system: "site_web", hmac_secret: "hmac-2" };
  const POST_OK_DATA = { ok: true };
  const SITE_WEB_SETUP_DATA = {
    secrets: {
      PLATFORM_API_URL: "https://project.test/functions/v1/platform-admin",
      PLATFORM_API_KEY: "pk_site_web",
      PLATFORM_WEBHOOK_HMAC_SECRET: "hmac_site_web",
    },
    webhook_url: "https://example.test/platform-webhook",
    api_key_prefix: "pk_site",
  };

  const fetchState = { mode: "success" as "success" | "error" | "pending" };
  const pendingFetchPromise = new Promise<Response>(() => undefined);

  const successResponse = {
    ok: true,
    statusText: "OK",
    text: vi.fn(() => Promise.resolve(JSON.stringify(UNIVERSAL_GET_DATA))),
    json: vi.fn(() => Promise.resolve(UNIVERSAL_GET_DATA)),
  };

  const errorResponse = {
    ok: false,
    statusText: "Bad Request",
    text: vi.fn(() => Promise.resolve(JSON.stringify(ERROR_DATA))),
    json: vi.fn(() => Promise.resolve(ERROR_DATA)),
  };

  const queryResult = { data: ROWS, error: null };

  const createBuilder = () => {
    const builder: Record<string, unknown> = {};
    const chain = () => builder;

    for (const method of [
      "select",
      "eq",
      "neq",
      "gte",
      "lte",
      "gt",
      "lt",
      "in",
      "is",
      "not",
      "or",
      "order",
      "limit",
      "range",
      "insert",
      "update",
      "upsert",
      "delete",
      "match",
      "contains",
      "filter",
    ]) {
      builder[method] = vi.fn(chain);
    }

    builder.single = vi.fn(() => Promise.resolve(queryResult));
    builder.maybeSingle = vi.fn(() => Promise.resolve(queryResult));
    builder.then = vi.fn(
      (
        onFulfilled?: (value: typeof queryResult) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => Promise.resolve(queryResult).then(onFulfilled, onRejected),
    );
    builder.catch = vi.fn((onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(queryResult).catch(onRejected),
    );
    builder.finally = vi.fn((onFinally?: () => void) => Promise.resolve(queryResult).finally(onFinally));

    return builder;
  };

  const mockFrom = vi.fn(() => createBuilder());
  const mockInvoke = vi.fn();
  const mockGetSession = vi.fn();
  const mockFetch = vi.fn();

  return {
    WEBHOOKS_DATA,
    KEYS_DATA,
    EVENTS_DATA,
    MAPPINGS_DATA,
    UNIVERSAL_GET_DATA,
    ERROR_DATA,
    SESSION_DATA,
    INVOKE_GET_DATA,
    CREATED_KEY_DATA,
    ROTATED_SECRET_DATA,
    UPSERT_DATA,
    POST_OK_DATA,
    SITE_WEB_SETUP_DATA,
    fetchState,
    pendingFetchPromise,
    successResponse,
    errorResponse,
    mockFrom,
    mockInvoke,
    mockGetSession,
    mockFetch,
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: hoisted.mockFrom,
    functions: {
      invoke: hoisted.mockInvoke,
    },
    auth: {
      getSession: hoisted.mockGetSession,
    },
  },
}));

vi.mock("@/components/ui/card", () => {
  type DivProps = HTMLAttributes<HTMLDivElement> & { children?: ReactNode };
  const Div = ({ children, ...props }: DivProps) => <div {...props}>{children}</div>;

  return {
    Card: Div,
    CardHeader: Div,
    CardFooter: Div,
    CardTitle: ({ children, ...props }: DivProps) => <h2 {...props}>{children}</h2>,
    CardDescription: Div,
    CardContent: Div,
  };
});

vi.mock("@/components/ui/tabs", () => {
  type DivProps = HTMLAttributes<HTMLDivElement> & {
    children?: ReactNode;
    value?: string;
    defaultValue?: string;
  };

  return {
    Tabs: ({ children, value, defaultValue, ...props }: DivProps) => <div {...props}>{children}</div>,
    TabsList: ({ children, ...props }: DivProps) => <div {...props}>{children}</div>,
    TabsTrigger: ({ children, value, ...props }: DivProps) => (
      <button type="button" {...props}>
        {children}
      </button>
    ),
    TabsContent: ({ children, value, ...props }: DivProps) => <div {...props}>{children}</div>,
  };
});

vi.mock("@/components/ui/button", () => {
  type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    children?: ReactNode;
    variant?: string;
    size?: string;
    asChild?: boolean;
  };

  return {
    Button: ({ children, variant, size, asChild, type, ...props }: ButtonProps) => (
      <button type={type ?? "button"} {...props}>
        {children}
      </button>
    ),
    buttonVariants: vi.fn(() => ""),
  };
});

vi.mock("@/components/ui/input", () => {
  type InputProps = InputHTMLAttributes<HTMLInputElement>;

  return {
    Input: (props: InputProps) => <input {...props} />,
  };
});

vi.mock("@/components/ui/label", () => {
  type LabelProps = LabelHTMLAttributes<HTMLLabelElement> & { children?: ReactNode };

  return {
    Label: ({ children, ...props }: LabelProps) => <label {...props}>{children}</label>,
  };
});

vi.mock("@/components/ui/badge", () => {
  type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
    children?: ReactNode;
    variant?: string;
  };

  return {
    Badge: ({ children, variant, ...props }: BadgeProps) => (
      <span data-variant={variant ?? "default"} {...props}>
        {children}
      </span>
    ),
  };
});

vi.mock("@/components/ui/select", () => {
  type DivProps = HTMLAttributes<HTMLDivElement> & {
    children?: ReactNode;
    value?: string;
    onValueChange?: (value: string) => void;
  };

  return {
    Select: ({ children, value, onValueChange, ...props }: DivProps) => <div {...props}>{children}</div>,
    SelectContent: ({ children, ...props }: DivProps) => <div {...props}>{children}</div>,
    SelectTrigger: ({ children, ...props }: DivProps) => <div {...props}>{children}</div>,
    SelectValue: ({ children, ...props }: DivProps) => <span {...props}>{children}</span>,
    SelectItem: ({ children, value, ...props }: DivProps) => (
      <div role="option" data-value={value} {...props}>
        {children}
      </div>
    ),
  };
});

vi.mock("@/components/ui/dialog", () => {
  type DivProps = HTMLAttributes<HTMLDivElement> & {
    children?: ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  };

  return {
    Dialog: ({ children, open }: DivProps) => (open ? <div data-testid="dialog">{children}</div> : null),
    DialogContent: ({ children, ...props }: DivProps) => <div {...props}>{children}</div>,
    DialogDescription: ({ children, ...props }: DivProps) => <p {...props}>{children}</p>,
    DialogFooter: ({ children, ...props }: DivProps) => <div {...props}>{children}</div>,
    DialogHeader: ({ children, ...props }: DivProps) => <div {...props}>{children}</div>,
    DialogTitle: ({ children, ...props }: DivProps) => <h3 {...props}>{children}</h3>,
  };
});

vi.mock("@/components/ui/table", () => {
  type TableProps = HTMLAttributes<HTMLTableElement> & { children?: ReactNode };
  type SectionProps = HTMLAttributes<HTMLTableSectionElement> & { children?: ReactNode };
  type RowProps = HTMLAttributes<HTMLTableRowElement> & { children?: ReactNode };
  type CellProps = HTMLAttributes<HTMLTableCellElement> & { children?: ReactNode; colSpan?: number };

  return {
    Table: ({ children, ...props }: TableProps) => <table {...props}>{children}</table>,
    TableHeader: ({ children, ...props }: SectionProps) => <thead {...props}>{children}</thead>,
    TableBody: ({ children, ...props }: SectionProps) => <tbody {...props}>{children}</tbody>,
    TableRow: ({ children, ...props }: RowProps) => <tr {...props}>{children}</tr>,
    TableHead: ({ children, ...props }: CellProps) => <th {...props}>{children}</th>,
    TableCell: ({ children, ...props }: CellProps) => <td {...props}>{children}</td>,
  };
});

vi.mock("@/components/layout/ImmersivePageHeader", () => {
  type HeaderProps = {
    title?: ReactNode;
    description?: ReactNode;
    children?: ReactNode;
  };

  return {
    ImmersivePageHeader: ({ title, description, children }: HeaderProps) => (
      <header>
        {title ? <h1>{title}</h1> : null}
        {description ? <p>{description}</p> : null}
        {children}
      </header>
    ),
  };
});

vi.mock("@/components/common/PageDataState", () => {
  type PageDataStateProps = {
    isLoading?: boolean;
    isError?: boolean;
    onRetry?: () => void;
    children?: ReactNode;
  };

  return {
    PageDataState: ({ isLoading, isError, onRetry, children }: PageDataStateProps) => {
      if (isLoading) {
        return <div data-testid="page-loading">Chargement</div>;
      }

      if (isError) {
        return (
          <div data-testid="page-error">
            Erreur de chargement
            <button type="button" onClick={onRetry}>
              Réessayer
            </button>
          </div>
        );
      }

      return <>{children}</>;
    },
  };
});

vi.mock("lucide-react", () => {
  type IconProps = SVGProps<SVGSVGElement>;
  const Icon = (props: IconProps) => <svg aria-hidden="true" {...props} />;

  return {
    Plug: Icon,
    Key: Icon,
    Webhook: Icon,
    Activity: Icon,
    Link: Icon,
    RotateCw: Icon,
    Copy: Icon,
    Plus: Icon,
    Trash2: Icon,
  };
});

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const { default: ParametresPlatformApi } = await import("./ParametresPlatformApi");

const queryClients: QueryClient[] = [];

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  queryClients.push(queryClient);

  return render(
    <QueryClientProvider client={queryClient}>
      <ParametresPlatformApi />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();

  hoisted.fetchState.mode = "success";

  vi.stubEnv("VITE_SUPABASE_URL", "https://project.test");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "pub");

  hoisted.mockGetSession.mockResolvedValue(hoisted.SESSION_DATA);

  hoisted.mockInvoke.mockImplementation((_functionName: string, options: { method?: string; body?: unknown }) => {
    const body = typeof options.body === "object" && options.body !== null ? (options.body as Record<string, unknown>) : {};

    if (options.method === "POST" && body.action === "create_api_key") {
      return Promise.resolve({ data: hoisted.CREATED_KEY_DATA, error: null });
    }

    if (options.method === "POST" && body.action === "rotate_webhook_secret") {
      return Promise.resolve({ data: hoisted.ROTATED_SECRET_DATA, error: null });
    }

    if (options.method === "POST" && body.action === "upsert_webhook") {
      return Promise.resolve({ data: hoisted.UPSERT_DATA, error: null });
    }

    if (options.method === "POST" && body.action === "setup_site_web") {
      return Promise.resolve({ data: hoisted.SITE_WEB_SETUP_DATA, error: null });
    }

    if (options.method === "POST") {
      return Promise.resolve({ data: hoisted.POST_OK_DATA, error: null });
    }

    return Promise.resolve(hoisted.INVOKE_GET_DATA);
  });

  hoisted.mockFetch.mockImplementation(() => {
    if (hoisted.fetchState.mode === "pending") {
      return hoisted.pendingFetchPromise;
    }

    if (hoisted.fetchState.mode === "error") {
      return Promise.resolve(hoisted.errorResponse as unknown as Response);
    }

    return Promise.resolve(hoisted.successResponse as unknown as Response);
  });

  vi.stubGlobal("fetch", hoisted.mockFetch);
});

afterEach(() => {
  cleanup();

  for (const queryClient of queryClients) {
    queryClient.clear();
  }

  queryClients.length = 0;
  vi.restoreAllMocks();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals?.();
  vi.unstubAllEnvs?.();
});

describe("ParametresPlatformApi", () => {
  it("affiche les états de chargement pendant les requêtes GET des onglets", async () => {
    hoisted.fetchState.mode = "pending";

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByTestId("page-loading")).toHaveLength(4);
    });

    await waitFor(() => {
      expect(hoisted.mockFetch).toHaveBeenCalled();
      expect(hoisted.mockGetSession).toHaveBeenCalled();
    });
  });

  it("affiche les données métier retournées par l'administration plateforme", async () => {
    renderPage();

    expect(await screen.findByText("https://example.test/platform-webhook")).not.toBeNull();
    expect(screen.getByText("Oui")).not.toBeNull();

    expect(await screen.findByText("Site Web prod")).not.toBeNull();
    expect(screen.getByText("pk_demo…")).not.toBeNull();
    expect(screen.getByText("Active")).not.toBeNull();

    const eventCell = await screen.findByText("tenant.created");
    const eventRow = eventCell.closest("tr");
    if (!(eventRow instanceof HTMLElement)) {
      throw new Error("event row missing");
    }
    expect(within(eventRow).getByText("dead")).not.toBeNull();
    expect(within(eventRow).getByText("5")).not.toBeNull();
    expect(within(eventRow).getByText("boom")).not.toBeNull();
    expect(within(eventRow).getByRole("button", { name: /Rejouer/i })).not.toBeNull();

    const mappingCell = await screen.findByText("ext-42");
    const mappingRow = mappingCell.closest("tr");
    if (!(mappingRow instanceof HTMLElement)) {
      throw new Error("mapping row missing");
    }
    expect(within(mappingRow).getByText("etab1")).not.toBeNull();
    expect(within(mappingRow).getByText("product")).not.toBeNull();

    await waitFor(() => {
      expect(hoisted.mockFetch).toHaveBeenCalledTimes(4);
      expect(hoisted.mockGetSession).toHaveBeenCalledTimes(4);
    });
  });

  it("affiche une erreur lorsque l'edge function GET renvoie une erreur", async () => {
    hoisted.fetchState.mode = "error";

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByTestId("page-error")).toHaveLength(4);
    });

    expect(screen.getAllByText("Erreur de chargement")).toHaveLength(4);

    await waitFor(() => {
      expect(hoisted.errorResponse.text).toHaveBeenCalled();
    });
  });

  it("déclenche la mutation de création de clé API avec le nom et le scope attendus", async () => {
    renderPage();

    expect(await screen.findByText("pk_demo…")).not.toBeNull();

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText("Site Web prod"), {
        target: { value: "Demo" },
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Créer/i }));
    });

    await waitFor(
      () => {
        expect(hoisted.mockInvoke).toHaveBeenCalledWith(
          "platform-admin",
          expect.objectContaining({
            method: "POST",
            body: {
              action: "create_api_key",
              name: "Demo",
              scope: "platform:site_web",
            },
          }),
        );
      },
      { timeout: 3000 },
    );

    expect(await screen.findByText("Clé API créée")).not.toBeNull();
    expect(screen.getByText("new-key")).not.toBeNull();
  });
});