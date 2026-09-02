import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const hoisted = vi.hoisted(() => {
  type QueryResult = {
    data: readonly unknown[] | null;
    error: { message: string } | null;
  };

  type ChainBuilder = {
    select: (...args: unknown[]) => ChainBuilder;
    eq: (...args: unknown[]) => ChainBuilder;
    gte: (...args: unknown[]) => ChainBuilder;
    lte: (...args: unknown[]) => ChainBuilder;
    in: (...args: unknown[]) => ChainBuilder;
    order: (...args: unknown[]) => ChainBuilder;
    limit: (...args: unknown[]) => ChainBuilder;
    insert: (...args: unknown[]) => ChainBuilder;
    update: (...args: unknown[]) => ChainBuilder;
    delete: (...args: unknown[]) => ChainBuilder;
    upsert: (...args: unknown[]) => ChainBuilder;
    range: (...args: unknown[]) => ChainBuilder;
    or: (...args: unknown[]) => ChainBuilder;
    neq: (...args: unknown[]) => ChainBuilder;
    is: (...args: unknown[]) => ChainBuilder;
    not: (...args: unknown[]) => ChainBuilder;
    match: (...args: unknown[]) => ChainBuilder;
    contains: (...args: unknown[]) => ChainBuilder;
    throwOnError: (...args: unknown[]) => ChainBuilder;
    single: () => Promise<QueryResult>;
    maybeSingle: () => Promise<QueryResult>;
    then: <TResult1 = QueryResult, TResult2 = never>(
      onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) => Promise<TResult1 | TResult2>;
    catch: <TResult = never>(
      onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null,
    ) => Promise<QueryResult | TResult>;
  };

  const USERS = [
    {
      id: "user-1",
      nom: "Martin",
      prenom: "Alice",
      email: "alice@example.test",
      fonction: "Directrice",
      actif: true,
    },
    {
      id: "user-2",
      nom: "Durand",
      prenom: "Bob",
      email: "bob@example.test",
      fonction: "Formateur",
      actif: true,
    },
  ] as const;

  const CAMPAGNES = [
    {
      id: "campagne-1",
      type: "satisfaction",
      status: "responded",
      canal: "email",
      scheduled_at: "2024-01-09T08:00:00.000Z",
      sent_at: "2024-01-09T09:00:00.000Z",
      responded_at: "2024-01-10T10:00:00.000Z",
      email_destinataire: "alice@example.test",
      token_unique: "tok-a",
      user_id: "user-1",
      created_at: "2024-01-10T12:00:00.000Z",
    },
    {
      id: "campagne-2",
      type: "ces",
      status: "sent",
      canal: "email",
      scheduled_at: "2024-01-08T08:00:00.000Z",
      sent_at: "2024-01-08T09:00:00.000Z",
      responded_at: null,
      email_destinataire: "bob@example.test",
      token_unique: "tok-b",
      user_id: "user-2",
      created_at: "2024-01-08T12:00:00.000Z",
    },
    {
      id: "campagne-3",
      type: "suivi_csm",
      status: "expired",
      canal: "sms",
      scheduled_at: "2024-01-07T08:00:00.000Z",
      sent_at: "2024-01-07T09:00:00.000Z",
      responded_at: null,
      email_destinataire: "externe@example.test",
      token_unique: "tok-c",
      user_id: null,
      created_at: "2024-01-07T12:00:00.000Z",
    },
  ] as const;

  const EMPTY_ROWS = [] as const;
  const USERS_RESULT: QueryResult = { data: USERS, error: null };
  const CAMPAGNES_RESULT: QueryResult = { data: CAMPAGNES, error: null };
  const EMPTY_RESULT: QueryResult = { data: EMPTY_ROWS, error: null };
  const ERROR_RESULT: QueryResult = { data: null, error: { message: "x" } };
  const NEVER_RESULT = new Promise<QueryResult>(() => undefined);

  const EDGE_SUCCESS = { success: true, url: "https://example.test/u" } as const;
  const AUTH_SESSION = {
    data: {
      session: {
        user: {
          id: "u1",
          email: "t@example.test",
        },
      },
    },
    error: null,
  } as const;
  const AUTH_USER = {
    data: {
      user: {
        id: "u1",
        email: "t@example.test",
      },
    },
    error: null,
  } as const;
  const RPC_RESULT = { data: null, error: null } as const;

  const state: { mode: "success" | "error" | "loadingCampagnes" | "empty" } = {
    mode: "success",
  };

  const makeBuilder = (table: string): ChainBuilder => {
    const builder: Partial<ChainBuilder> = {};
    const chain = () => builder as ChainBuilder;
    const resolveResult = () => {
      if (state.mode === "loadingCampagnes" && table === "enquetes_campagnes") return NEVER_RESULT;
      if (state.mode === "error") return ERROR_RESULT;
      if (state.mode === "empty") return EMPTY_RESULT;
      if (table === "etablissement_users") return USERS_RESULT;
      if (table === "enquetes_campagnes") return CAMPAGNES_RESULT;
      return EMPTY_RESULT;
    };

    builder.select = chain;
    builder.eq = chain;
    builder.gte = chain;
    builder.lte = chain;
    builder.in = chain;
    builder.order = chain;
    builder.limit = chain;
    builder.insert = chain;
    builder.update = chain;
    builder.delete = chain;
    builder.upsert = chain;
    builder.range = chain;
    builder.or = chain;
    builder.neq = chain;
    builder.is = chain;
    builder.not = chain;
    builder.match = chain;
    builder.contains = chain;
    builder.throwOnError = chain;
    builder.single = () => Promise.resolve(resolveResult());
    builder.maybeSingle = () => Promise.resolve(resolveResult());
    builder.then = (onfulfilled, onrejected) => Promise.resolve(resolveResult()).then(onfulfilled, onrejected);
    builder.catch = (onrejected) => Promise.resolve(resolveResult()).catch(onrejected);

    return builder as ChainBuilder;
  };

  const usersBuilder = makeBuilder("etablissement_users");
  const campagnesBuilder = makeBuilder("enquetes_campagnes");
  const emptyBuilder = makeBuilder("other");

  const mockFrom = vi.fn((table: string) => {
    if (table === "etablissement_users") return usersBuilder;
    if (table === "enquetes_campagnes") return campagnesBuilder;
    return emptyBuilder;
  });

  const mockInvokeEdge = vi.fn();
  const mockToastSuccess = vi.fn();
  const mockToastError = vi.fn();
  const mockWriteText = vi.fn();
  const mockWindowOpen = vi.fn();
  const mockGetSession = vi.fn(() => Promise.resolve(AUTH_SESSION));
  const mockGetUser = vi.fn(() => Promise.resolve(AUTH_USER));
  const mockRpc = vi.fn(() => Promise.resolve(RPC_RESULT));

  return {
    state,
    EDGE_SUCCESS,
    mockFrom,
    mockInvokeEdge,
    mockToastSuccess,
    mockToastError,
    mockWriteText,
    mockWindowOpen,
    mockGetSession,
    mockGetUser,
    mockRpc,
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: hoisted.mockFrom,
    rpc: hoisted.mockRpc,
    auth: {
      getSession: hoisted.mockGetSession,
      getUser: hoisted.mockGetUser,
    },
  },
}));

vi.mock("@/services/edgeFunctions", () => ({
  invokeEdge: hoisted.mockInvokeEdge,
}));

vi.mock("sonner", () => ({
  toast: {
    success: hoisted.mockToastSuccess,
    error: hoisted.mockToastError,
  },
}));

vi.mock("@/components/ui/button", () => {
  type ButtonMockProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    asChild?: boolean;
    variant?: string;
    size?: string;
  };

  return {
    Button: ({ children, asChild: _asChild, variant: _variant, size: _size, type, ...props }: ButtonMockProps) => (
      <button type={type ?? "button"} {...props}>
        {children}
      </button>
    ),
    buttonVariants: () => "",
  };
});

vi.mock("@/components/ui/badge", () => {
  type BadgeMockProps = HTMLAttributes<HTMLDivElement> & {
    variant?: string;
  };

  return {
    Badge: ({ children, variant: _variant, ...props }: BadgeMockProps) => <div {...props}>{children}</div>,
    badgeVariants: () => "",
  };
});

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardDescription: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardFooter: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

vi.mock("@/components/ui/tabs", () => {
  type TabsProps = HTMLAttributes<HTMLDivElement> & {
    defaultValue?: string;
    value?: string;
  };

  type TabsTriggerProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    value: string;
  };

  type TabsContentProps = HTMLAttributes<HTMLDivElement> & {
    value: string;
  };

  return {
    Tabs: ({ children, defaultValue: _defaultValue, value: _value, ...props }: TabsProps) => <div {...props}>{children}</div>,
    TabsList: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
    TabsTrigger: ({ children, value, type, ...props }: TabsTriggerProps) => (
      <button type={type ?? "button"} data-value={value} {...props}>
        {children}
      </button>
    ),
    TabsContent: ({ children, value, ...props }: TabsContentProps) => (
      <div data-value={value} {...props}>
        {children}
      </div>
    ),
  };
});

vi.mock("@/components/ui/select", () => {
  type SelectProps = {
    children?: ReactNode;
    value?: string;
    onValueChange?: (value: string) => void;
  };

  type SelectItemProps = HTMLAttributes<HTMLDivElement> & {
    value: string;
  };

  return {
    Select: ({ children, value: _value, onValueChange: _onValueChange }: SelectProps) => <div>{children}</div>,
    SelectContent: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
    SelectTrigger: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
    SelectValue: () => <span>Type sélectionné</span>,
    SelectItem: ({ children, value, ...props }: SelectItemProps) => (
      <div data-value={value} {...props}>
        {children}
      </div>
    ),
  };
});

vi.mock("@/components/ui/table", () => ({
  Table: ({ children, ...props }: HTMLAttributes<HTMLTableElement>) => <table {...props}>{children}</table>,
  TableHeader: ({ children, ...props }: HTMLAttributes<HTMLTableSectionElement>) => <thead {...props}>{children}</thead>,
  TableBody: ({ children, ...props }: HTMLAttributes<HTMLTableSectionElement>) => <tbody {...props}>{children}</tbody>,
  TableRow: ({ children, ...props }: HTMLAttributes<HTMLTableRowElement>) => <tr {...props}>{children}</tr>,
  TableHead: ({ children, ...props }: ThHTMLAttributes<HTMLTableCellElement>) => <th {...props}>{children}</th>,
  TableCell: ({ children, ...props }: TdHTMLAttributes<HTMLTableCellElement>) => <td {...props}>{children}</td>,
}));

vi.mock("@/components/ui/checkbox", () => {
  type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "checked" | "onChange"> & {
    checked?: boolean | "indeterminate";
    onCheckedChange?: (checked: boolean) => void;
  };

  return {
    Checkbox: ({ checked, onCheckedChange, ...props }: CheckboxProps) => (
      <input
        type="checkbox"
        checked={checked === true}
        onChange={(event) => onCheckedChange?.(event.currentTarget.checked)}
        {...props}
      />
    ),
  };
});

import { EtablissementEnquetesTab } from "./EtablissementEnquetesTab";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 0,
        gcTime: 0,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

function renderTab(etablissementId = "etab-1") {
  const client = createQueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <EtablissementEnquetesTab etablissementId={etablissementId} />
    </QueryClientProvider>,
  );
  return { client, ...view };
}

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.state.mode = "success";
  hoisted.mockInvokeEdge.mockResolvedValue(hoisted.EDGE_SUCCESS);
  hoisted.mockWriteText.mockResolvedValue(undefined);

  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: hoisted.mockWriteText,
    },
  });

  Object.defineProperty(window, "open", {
    configurable: true,
    writable: true,
    value: hoisted.mockWindowOpen,
  });
});

afterEach(() => {
  cleanup();
  hoisted.state.mode = "success";
});

describe("EtablissementEnquetesTab", () => {
  it("affiche l'état de chargement de l'historique des campagnes", () => {
    hoisted.state.mode = "loadingCampagnes";

    renderTab();

    expect(screen.getByRole("heading", { name: "Enquêtes de satisfaction" }).textContent).toBe("Enquêtes de satisfaction");
    expect(screen.getByText("Chargement…").textContent).toBe("Chargement…");
    expect(screen.getByText("Campagnes envoyées").textContent).toBe("Campagnes envoyées");
    expect(screen.getByText("Historique (0)").textContent).toBe("Historique (0)");
  });

  it("affiche les utilisateurs, l'historique et les statistiques métier", async () => {
    renderTab();

    await waitFor(() => {
      expect(screen.getAllByText("Alice Martin").length).toBeGreaterThan(0);
    });

    expect(screen.getByText("Envoyer manuellement une enquête à un ou plusieurs utilisateurs.").textContent).toBe(
      "Envoyer manuellement une enquête à un ou plusieurs utilisateurs.",
    );
    expect(screen.getByText("Historique (3)").textContent).toBe("Historique (3)");
    expect(screen.getByText("33%").textContent).toBe("33%");
    expect(screen.getAllByText("Satisfaction + NPS").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("CES (effort)").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Suivi CSM").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Répondue").textContent).toBe("Répondue");
    expect(screen.getByText("Envoyée").textContent).toBe("Envoyée");
    expect(screen.getByText("Expirée").textContent).toBe("Expirée");
    expect(screen.getAllByText("alice@example.test").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("bob@example.test").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Directrice").textContent).toBe("Directrice");
    expect(screen.getByText("Formateur").textContent).toBe("Formateur");
    expect(hoisted.mockFrom).toHaveBeenCalledWith("etablissement_users");
    expect(hoisted.mockFrom).toHaveBeenCalledWith("enquetes_campagnes");
  });

  it("envoie une enquête aux utilisateurs sélectionnés via la mutation", async () => {
    renderTab();

    await waitFor(() => {
      expect(screen.getAllByText("Alice Martin").length).toBeGreaterThan(0);
    });

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(3);

    const aliceCheckbox = checkboxes.at(1);
    if (aliceCheckbox === undefined) {
      throw new Error("Checkbox utilisateur Alice introuvable");
    }

    await act(async () => {
      fireEvent.click(aliceCheckbox);
    });

    const sendButton = screen.getByRole("button", { name: /Envoyer à 1 utilisateur/ });

    await act(async () => {
      fireEvent.click(sendButton);
    });

    await waitFor(() => {
      expect(hoisted.mockInvokeEdge).toHaveBeenCalledTimes(1);
    });

    expect(hoisted.mockInvokeEdge).toHaveBeenCalledWith("send-enquete", {
      type: "satisfaction",
      etablissement_id: "etab-1",
      user_id: "user-1",
      email: "alice@example.test",
      canal: "email",
    });
    expect(hoisted.mockToastSuccess).toHaveBeenCalledWith("1 enquête(s) envoyée(s)");
  });

  it("renvoie une campagne email non répondue", async () => {
    renderTab();

    await waitFor(() => {
      expect(screen.getByText("Envoyée").textContent).toBe("Envoyée");
    });

    const resendButtons = screen.getAllByTitle("Renvoyer");
    expect(resendButtons).toHaveLength(1);

    const resendButton = resendButtons.at(0);
    if (resendButton === undefined) {
      throw new Error("Bouton de renvoi introuvable");
    }

    await act(async () => {
      fireEvent.click(resendButton);
    });

    await waitFor(() => {
      expect(hoisted.mockInvokeEdge).toHaveBeenCalledTimes(1);
    });

    expect(hoisted.mockInvokeEdge).toHaveBeenCalledWith("send-enquete", {
      type: "ces",
      etablissement_id: "etab-1",
      user_id: "user-2",
      email: "bob@example.test",
      canal: "email",
    });
    expect(hoisted.mockToastSuccess).toHaveBeenCalledWith("Enquête renvoyée");
  });

  it("copie le lien public d'une campagne", async () => {
    renderTab();

    await waitFor(() => {
      expect(screen.getByText("Répondue").textContent).toBe("Répondue");
    });

    const copyButtons = screen.getAllByTitle("Copier le lien");
    expect(copyButtons).toHaveLength(3);

    const copyButton = copyButtons.at(0);
    if (copyButton === undefined) {
      throw new Error("Bouton de copie introuvable");
    }

    await act(async () => {
      fireEvent.click(copyButton);
    });

    await waitFor(() => {
      expect(hoisted.mockWriteText).toHaveBeenCalledWith(`${window.location.origin}/enquete/satisfaction/tok-a`);
    });
    expect(hoisted.mockToastSuccess).toHaveBeenCalledWith("Lien copié");
  });

  it("ouvre le lien public d'une campagne dans un nouvel onglet", async () => {
    renderTab();

    await waitFor(() => {
      expect(screen.getByText("Répondue").textContent).toBe("Répondue");
    });

    const openButtons = screen.getAllByTitle("Ouvrir l'enquête");
    expect(openButtons).toHaveLength(3);

    const openButton = openButtons.at(1);
    if (openButton === undefined) {
      throw new Error("Bouton d'ouverture introuvable");
    }

    await act(async () => {
      fireEvent.click(openButton);
    });

    expect(hoisted.mockWindowOpen).toHaveBeenCalledWith("/enquete/ces/tok-b", "_blank");
  });

  it("met les requêtes en erreur quand Supabase retourne une erreur", async () => {
    hoisted.state.mode = "error";

    const { client } = renderTab();

    await waitFor(() => {
      const usersState = client.getQueryState(["etab-users", "etab-1"]);
      const campagnesState = client.getQueryState(["enquetes-campagnes", "etab-1"]);

      expect(usersState?.status).toBe("error");
      expect(campagnesState?.status).toBe("error");
    });

    expect(screen.getByText("Aucun utilisateur actif").textContent).toBe("Aucun utilisateur actif");
    expect(screen.getByText("Aucune campagne").textContent).toBe("Aucune campagne");
  });
});