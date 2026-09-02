import React, { PropsWithChildren } from "react";
import { render, screen, waitFor, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const {
  PROFILE,
  TOAST_API,
  toastFn,
  sanitizeSupabaseError,
  ACCOUNTS,
  mockFrom,
  builderState,
  invokeMock,
} = vi.hoisted(() => {
  const PROFILE = { id: "p1" };

  const toastFn = vi.fn();
  const TOAST_API = { toast: toastFn };

  const sanitizeSupabaseError = vi.fn((err: unknown) => {
    if (err && typeof err === "object" && "message" in err) return String((err as { message?: unknown }).message);
    return "unknown error";
  });

  const ACCOUNTS = [
    {
      id: "a1",
      email_address: "a@exploitant.example.org",
      last_sync_at: null as string | null,
      is_active: true,
      sync_enabled: true,
      is_shared: false,
      profile_id: "p1",
    },
    {
      id: "a2",
      email_address: "b@exploitant.example.org",
      last_sync_at: "2024-01-02T03:04:05.000Z",
      is_active: true,
      sync_enabled: true,
      is_shared: true,
      profile_id: "other",
    },
  ];

  type Res<T> = { data: T | null; error: { message: string } | null };

  const builderState = {
    selectResult: { data: ACCOUNTS as unknown, error: null } as Res<unknown>,
    updateError: null as { message: string } | null,
    updateCalledWith: [] as Array<{ table: string; values: unknown; eq: { col: string; val: string } }>,
  };

  const createThenableBuilder = (table: string) => {
    const b: Record<string, unknown> = {};
    const chain = () => b;

    (b as { _table: string })._table = table;

    (b as { select: (q?: string) => unknown }).select = (_q?: string) => chain();
    (b as { eq: (col: string, val: unknown) => unknown }).eq = (col: string, val: unknown) => {
      (b as { _eq?: { col: string; val: unknown } })._eq = { col, val };
      return chain();
    };
    (b as { or: (expr: string) => unknown }).or = (_expr: string) => chain();
    (b as { gte: (col: string, val: unknown) => unknown }).gte = (_col: string, _val: unknown) => chain();
    (b as { lte: (col: string, val: unknown) => unknown }).lte = (_col: string, _val: unknown) => chain();
    (b as { in: (col: string, val: unknown[]) => unknown }).in = (_col: string, _val: unknown[]) => chain();
    (b as { order: (col: string, opts?: unknown) => unknown }).order = (_col: string, _opts?: unknown) => chain();
    (b as { limit: (count: number) => unknown }).limit = (_count: number) => chain();
    (b as { insert: (values: unknown) => unknown }).insert = (_values: unknown) => chain();
    (b as { delete: () => unknown }).delete = () => chain();

    (b as { update: (values: unknown) => unknown }).update = (values: unknown) => {
      (b as { _update?: unknown })._update = values;
      return chain();
    };

    const resolveAwait = (): Res<unknown> => {
      if (table === "user_email_accounts" && (b as { _update?: unknown })._update) {
        builderState.updateCalledWith.push({
          table,
          values: (b as { _update?: unknown })._update,
          eq: {
            col: (b as { _eq?: { col: string; val: unknown } })._eq?.col ?? "",
            val: String((b as { _eq?: { col: string; val: unknown } })._eq?.val ?? ""),
          },
        });
        return { data: null, error: builderState.updateError };
      }
      return builderState.selectResult;
    };

    (b as { single: () => Promise<Res<unknown>> }).single = () => Promise.resolve(resolveAwait());
    (b as { maybeSingle: () => Promise<Res<unknown>> }).maybeSingle = () => Promise.resolve(resolveAwait());

    (b as { then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => unknown }).then = (
      onFulfilled: (v: unknown) => unknown,
      onRejected?: (e: unknown) => unknown,
    ) => Promise.resolve(resolveAwait()).then(onFulfilled, onRejected);

    (b as { catch: (onRejected: (e: unknown) => unknown) => unknown }).catch = (onRejected: (e: unknown) => unknown) =>
      Promise.resolve(resolveAwait()).catch(onRejected);

    return b;
  };

  const mockFrom = vi.fn((table: string) => createThenableBuilder(table));

  const invokeMock = vi.fn<
    (name: string, args: { body: unknown }) => Promise<{ data: unknown; error: { message?: string } | null }>
  >();

  return {
    PROFILE,
    TOAST_API,
    toastFn,
    sanitizeSupabaseError,
    ACCOUNTS,
    mockFrom,
    builderState,
    invokeMock,
  };
});

vi.mock("@/components/ui/button", () => {
  const React = require("react") as typeof import("react");
  return {
    Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) =>
      React.createElement("button", { type: "button", ...props }, children),
  };
});

vi.mock("@/components/ui/input", () => {
  const React = require("react") as typeof import("react");
  return {
    Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => React.createElement("input", props),
  };
});

vi.mock("@/components/ui/label", () => {
  const React = require("react") as typeof import("react");
  return {
    Label: ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) =>
      React.createElement("label", props, children),
  };
});

vi.mock("@/components/ui/card", () => {
  const React = require("react") as typeof import("react");
  return {
    Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) =>
      React.createElement("div", props, children),
    CardHeader: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) =>
      React.createElement("div", props, children),
    CardTitle: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) =>
      React.createElement("h2", props, children),
    CardDescription: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) =>
      React.createElement("p", props, children),
    CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) =>
      React.createElement("div", props, children),
  };
});

vi.mock("lucide-react", () => {
  const React = require("react") as typeof import("react");
  const Icon = (props: Record<string, unknown>) => React.createElement("svg", props);
  return { Mail: Icon, Trash2: Icon, Loader2: Icon, RefreshCw: Icon };
});

vi.mock("@/hooks/shared/use-toast", () => ({ useToast: () => TOAST_API }));
vi.mock("@/lib/supabaseErrorSanitizer", () => ({ sanitizeSupabaseError }));
vi.mock("@/lib/debug", () => ({
  debug: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/hooks/profile/useProfiles", () => ({
  useCurrentProfile: () => ({ data: PROFILE, isLoading: false, isError: false }),
}));

vi.mock("@/lib/supabaseTyped", () => ({
  fromExtended: (table: string) => mockFrom(table),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
    functions: {
      invoke: invokeMock,
    },
  },
}));

import { EmailAccountConnection } from "./EmailAccountConnection";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function Wrapper({ children }: PropsWithChildren) {
  const client = createQueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function getAccountRowForEmail(email: string) {
  const emailEl = screen.getByText(email);
  const row = emailEl.closest("div.flex.items-center.justify-between");
  if (!row) throw new Error("account row not found");
  return row;
}

/**
 * Renseigne les serveurs.
 *
 * Ils sont désormais obligatoires : le formulaire les préremplissait avec un
 * gabarit qui ne résout pas, et postait donc une configuration inutilisable
 * sans que rien ne le signale.
 */
async function remplirServeurs(
  user: ReturnType<typeof userEvent.setup>,
): Promise<void> {
  await user.clear(screen.getByLabelText("Serveur IMAP (réception)"));
  await user.type(
    screen.getByLabelText("Serveur IMAP (réception)"),
    "imap.fournisseur.example",
  );
  await user.clear(screen.getByLabelText("Serveur SMTP (envoi)"));
  await user.type(
    screen.getByLabelText("Serveur SMTP (envoi)"),
    "smtp.fournisseur.example",
  );
}

describe("EmailAccountConnection", () => {
  it("charge et affiche les comptes connectés (fetchAccounts)", async () => {
    builderState.selectResult = { data: ACCOUNTS, error: null };

    render(<EmailAccountConnection />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("Comptes connectés")).toBeTruthy();
    });

    expect(screen.getByText("a@exploitant.example.org")).toBeTruthy();
    expect(screen.getByText("b@exploitant.example.org")).toBeTruthy();
    expect(screen.getAllByText(/Dernière sync:/).length).toBe(2);

    expect(mockFrom).toHaveBeenCalledWith("user_email_accounts_safe");
  });

  it("connecte un compte avec succès (invoke) et affiche un toast, puis recharge la liste", async () => {
    builderState.selectResult = { data: ACCOUNTS, error: null };
    invokeMock.mockResolvedValueOnce({ data: { ok: true }, error: null });

    render(<EmailAccountConnection />, { wrapper: Wrapper });

    const emailInput = await screen.findByLabelText("Adresse email");
    const passwordInput = screen.getByLabelText("Mot de passe");
    const connectBtn = screen.getByRole("button", { name: "Connecter mon compte" });

    const user = userEvent.setup();
    await user.clear(emailInput);
    await user.type(emailInput, "new@exploitant.example.org");
    await user.clear(passwordInput);
    await user.type(passwordInput, "pw");
    await remplirServeurs(user);

    await user.click(connectBtn);

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledTimes(1);
    });

    expect(invokeMock).toHaveBeenCalledWith("connect-email-account", {
      body: {
        email_address: "new@exploitant.example.org",
        password: "pw",
        imap_host: "imap.fournisseur.example",
        imap_port: 993,
        imap_use_ssl: true,
        smtp_host: "smtp.fournisseur.example",
        smtp_port: 465,
        smtp_use_ssl: true,
      },
    });

    await waitFor(() => {
      expect(toastFn).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Compte connecté",
          description: "Votre compte new@exploitant.example.org a été connecté avec succès",
        }),
      );
    });

    expect((emailInput as HTMLInputElement).value).toBe("");
    expect((passwordInput as HTMLInputElement).value).toBe("");

    expect(mockFrom).toHaveBeenCalledWith("user_email_accounts_safe");
  });

  it("refuse de connecter tant que les serveurs ne sont pas renseignés", async () => {
    builderState.selectResult = { data: ACCOUNTS, error: null };
    // Ce fichier n'a pas de beforeEach : les espions cumulent d'une épreuve à
    // l'autre. On les remet à zéro ici pour compter ce que fait CETTE épreuve.
    invokeMock.mockClear();
    toastFn.mockClear();

    render(<EmailAccountConnection />, { wrapper: Wrapper });

    const emailInput = await screen.findByLabelText("Adresse email");
    const passwordInput = screen.getByLabelText("Mot de passe");
    const connectBtn = screen.getByRole("button", { name: "Connecter mon compte" });

    const user = userEvent.setup();
    await user.type(emailInput, "new@exploitant.example.org");
    await user.type(passwordInput, "pw");

    // Les serveurs restent vides : rien ne doit partir. Avant la correction, le
    // formulaire postait « smtp.example.org » et la connexion échouait côté
    // serveur, sur un message qui parlait du port.
    await user.click(connectBtn);

    await waitFor(() => {
      expect(toastFn).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Serveurs manquants",
          variant: "destructive",
        }),
      );
    });

    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("accepte STARTTLS et transmet le port et le chiffrement correspondants", async () => {
    builderState.selectResult = { data: ACCOUNTS, error: null };
    invokeMock.mockClear();
    invokeMock.mockResolvedValueOnce({ data: { ok: true }, error: null });

    render(<EmailAccountConnection />, { wrapper: Wrapper });

    const emailInput = await screen.findByLabelText("Adresse email");
    const user = userEvent.setup();
    await user.type(emailInput, "new@exploitant.example.org");
    await user.type(screen.getByLabelText("Mot de passe"), "pw");
    await remplirServeurs(user);

    // Un serveur en STARTTLS était inatteignable : la liaison était promue en
    // TLS d'emblée, alors que 143 et 587 exigent la promotion explicite.
    await user.selectOptions(screen.getByLabelText("Chiffrement IMAP"), "starttls");
    await user.selectOptions(screen.getByLabelText("Chiffrement SMTP"), "starttls");

    await user.click(screen.getByRole("button", { name: "Connecter mon compte" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledTimes(1);
    });

    expect(invokeMock).toHaveBeenCalledWith("connect-email-account", {
      body: expect.objectContaining({
        imap_port: 143,
        imap_use_ssl: false,
        smtp_port: 587,
        smtp_use_ssl: false,
      }),
    });
  });

  it("gère une erreur de connexion (invoke error) et affiche un toast destructif", async () => {
    builderState.selectResult = { data: ACCOUNTS, error: null };
    invokeMock.mockResolvedValueOnce({ data: null, error: { message: "x" } });

    render(<EmailAccountConnection />, { wrapper: Wrapper });

    const emailInput = await screen.findByLabelText("Adresse email");
    const passwordInput = screen.getByLabelText("Mot de passe");
    const connectBtn = screen.getByRole("button", { name: "Connecter mon compte" });

    const user = userEvent.setup();
    await user.clear(emailInput);
    await user.type(emailInput, "bad@exploitant.example.org");
    await user.clear(passwordInput);
    await user.type(passwordInput, "pw");
    await remplirServeurs(user);

    await user.click(connectBtn);

    await waitFor(() => {
      expect(sanitizeSupabaseError).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(toastFn).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Erreur de connexion",
          description: "x",
          variant: "destructive",
        }),
      );
    });
  });

  it("déconnecte un compte (update is_active=false) puis recharge", async () => {
    builderState.selectResult = { data: ACCOUNTS, error: null };
    builderState.updateError = null;

    render(<EmailAccountConnection />, { wrapper: Wrapper });

    await screen.findByText("Comptes connectés");

    const accountRow = getAccountRowForEmail("a@exploitant.example.org");
    const buttons = within(accountRow).getAllByRole("button");
    expect(buttons.length).toBe(2);

    const deleteBtn = buttons[1];

    const user = userEvent.setup();
    await user.click(deleteBtn);

    await waitFor(() => {
      expect(builderState.updateCalledWith.length).toBe(1);
    });

    expect(builderState.updateCalledWith[0]).toEqual({
      table: "user_email_accounts",
      values: { is_active: false },
      eq: { col: "id", val: "a1" },
    });

    await waitFor(() => {
      expect(toastFn).toHaveBeenCalledWith(expect.objectContaining({ title: "Compte déconnecté" }));
    });

    expect(mockFrom).toHaveBeenCalledWith("user_email_accounts_safe");
  });

  it("déclenche une synchronisation (sync-emails) et affiche un toast de succès", async () => {
    builderState.selectResult = { data: ACCOUNTS, error: null };
    invokeMock.mockResolvedValueOnce({
      data: { messages_synced: 2, has_more: false, remaining_estimate: 0 },
      error: null,
    });

    render(<EmailAccountConnection />, { wrapper: Wrapper });

    await screen.findByText("Comptes connectés");

    const accountRow = getAccountRowForEmail("a@exploitant.example.org");
    const buttons = within(accountRow).getAllByRole("button");
    expect(buttons.length).toBe(2);
    const syncBtn = buttons[0];

    const user = userEvent.setup();
    await act(async () => {
      await user.click(syncBtn);
    });

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("sync-emails", {
        body: { account_id: "a1", full_resync: true },
      });
    });

    await waitFor(() => {
      expect(toastFn).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Synchronisation terminée",
          description: "2 nouveaux messages synchronisés",
        }),
      );
    });

    expect(mockFrom).toHaveBeenCalledWith("user_email_accounts_safe");
  });
});