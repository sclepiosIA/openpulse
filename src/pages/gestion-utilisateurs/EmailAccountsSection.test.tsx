import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const {
  ACCOUNTS,
  SUCCESS_INVOKE_DATA,
  ERROR_INVOKE_SUPABASE,
  mockToast,
  mockInvoke,
  mockSanitize,
  mockDebugError,
  mockFromExtended,
} = vi.hoisted(() => {
  const ACCOUNTS = [
    {
      id: "acc1",
      email_address: "a@b.co",
      is_active: true,
      sync_enabled: true,
      last_sync_at: "2025-01-01T00:00:00Z",
    },
    {
      id: "acc2",
      email_address: "c@d.co",
      is_active: true,
      sync_enabled: false,
      last_sync_at: null,
    },
  ];

  const SUCCESS_INVOKE_DATA = { ok: true };
  const ERROR_INVOKE_SUPABASE = { message: "invoke failed" };

  return {
    ACCOUNTS,
    SUCCESS_INVOKE_DATA,
    ERROR_INVOKE_SUPABASE,
    mockToast: vi.fn(),
    mockInvoke: vi.fn(),
    mockSanitize: vi.fn(),
    mockDebugError: vi.fn(),
    mockFromExtended: vi.fn(),
  };
});

vi.mock("@/components/ui/collapsible", () => {
  const React = require("react");
  function Collapsible({
    open,
    onOpenChange,
    className,
    children,
  }: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    className?: string;
    children: React.ReactNode;
  }) {
    return (
      <div data-testid="collapsible" data-open={open ? "1" : "0"} className={className}>
        <CollapsibleContext.Provider value={{ open, onOpenChange }}>{children}</CollapsibleContext.Provider>
      </div>
    );
  }

  const CollapsibleContext = React.createContext<{ open: boolean; onOpenChange: (v: boolean) => void } | null>(null);

  function CollapsibleTrigger({ asChild, children }: { asChild?: boolean; children: React.ReactElement }) {
    const ctx = React.useContext(CollapsibleContext);
    if (!ctx) return children;
    const child = React.Children.only(children);
    const prevOnClick = (child.props as { onClick?: React.MouseEventHandler }).onClick;
    const nextProps = {
      onClick: (e: React.MouseEvent) => {
        prevOnClick?.(e);
        ctx.onOpenChange(!ctx.open);
      },
    };
    return asChild ? React.cloneElement(child, nextProps) : <button {...nextProps}>{child}</button>;
  }

  function CollapsibleContent({ className, children }: { className?: string; children: React.ReactNode }) {
    const ctx = React.useContext(CollapsibleContext);
    if (!ctx?.open) return null;
    return (
      <div data-testid="collapsible-content" className={className}>
        {children}
      </div>
    );
  }

  return { Collapsible, CollapsibleTrigger, CollapsibleContent };
});

vi.mock("@/components/ui/button", () => {
  const React = require("react");
  function Button({
    children,
    disabled,
    onClick,
    type,
    className,
    variant,
    size,
  }: {
    children: React.ReactNode;
    disabled?: boolean;
    onClick?: React.MouseEventHandler;
    type?: "button" | "submit" | "reset";
    className?: string;
    variant?: string;
    size?: string;
  }) {
    return (
      <button type={type ?? "button"} disabled={disabled} onClick={onClick} className={className} data-variant={variant} data-size={size}>
        {children}
      </button>
    );
  }
  return { Button };
});

vi.mock("@/components/ui/input", () => {
  const React = require("react");
  function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
    return <input {...props} />;
  }
  return { Input };
});

vi.mock("@/components/ui/label", () => {
  const React = require("react");
  function Label({ children, className }: { children: React.ReactNode; className?: string }) {
    return <label className={className}>{children}</label>;
  }
  return { Label };
});

vi.mock("@/components/ui/badge", () => {
  const React = require("react");
  function Badge({ children, className, variant }: { children: React.ReactNode; className?: string; variant?: string }) {
    return (
      <span className={className} data-variant={variant}>
        {children}
      </span>
    );
  }
  return { Badge };
});

vi.mock("lucide-react", () => {
  const React = require("react");
  const Icon =
    (name: string) =>
    ({ className }: { className?: string }) =>
      <svg data-testid={`icon-${name}`} className={className} />;
  return {
    Mail: Icon("mail"),
    ChevronDown: Icon("chevron-down"),
    Loader2: Icon("loader2"),
    CheckCircle: Icon("check-circle"),
  };
});

vi.mock("@/hooks/shared/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock("@/lib/debug", () => ({
  debug: {
    error: mockDebugError,
    log: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/lib/supabaseErrorSanitizer", () => ({
  sanitizeSupabaseError: mockSanitize,
}));

vi.mock("@/lib/supabaseBrowser", () => ({
  supabase: {
    functions: {
      invoke: mockInvoke,
    },
  },
}));

type ThenableResult<T> = PromiseLike<T> & {
  then: Promise<T>["then"];
  catch: Promise<T>["catch"];
};

function createStableThenable<T>(result: T): ThenableResult<T> {
  const p = Promise.resolve(result);
  return {
    then: p.then.bind(p),
    catch: p.catch.bind(p),
  };
}

function createFromExtendedBuilder(args: { data: unknown[] | null; error: { message: string } | null }) {
  const state = {
    data: args.data,
    error: args.error,
    eqCalls: [] as Array<[string, unknown]>,
    selectCalls: [] as string[],
  };

  const builder: Record<string, unknown> = {};

  const returnBuilder = () => builder;

  builder.select = (sel: string) => {
    state.selectCalls.push(sel);
    returnBuilder();
    return builder;
  };
  builder.eq = (k: string, v: unknown) => {
    state.eqCalls.push([k, v]);
    return builder;
  };
  builder.gte = returnBuilder;
  builder.lte = returnBuilder;
  builder.in = returnBuilder;
  builder.order = returnBuilder;
  builder.limit = returnBuilder;
  builder.insert = returnBuilder;
  builder.update = returnBuilder;
  builder.delete = returnBuilder;
  builder.single = () => Promise.resolve({ data: args.data?.[0] ?? null, error: args.error });
  builder.maybeSingle = () => Promise.resolve({ data: args.data?.[0] ?? null, error: args.error });

  const thenable = createStableThenable({ data: args.data, error: args.error });
  builder.then = thenable.then;
  builder.catch = thenable.catch;

  return { builder, state };
}

vi.mock("@/lib/supabaseTyped", () => ({
  fromExtended: (...a: unknown[]) => mockFromExtended(...a),
}));

import { EmailAccountsSection } from "./EmailAccountsSection";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function renderWithClient(ui: React.ReactElement) {
  const client = createQueryClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("EmailAccountsSection", () => {
  it("affiche l'état de chargement initial (pas de badge comptes) puis succès avec la liste", async () => {
    const deferred = {
      resolve: (_v: unknown) => {},
      promise: Promise.resolve({ data: ACCOUNTS, error: null } as { data: typeof ACCOUNTS; error: null }),
    };
    deferred.promise = new Promise((res) => {
      deferred.resolve = res;
    });

    const q = createFromExtendedBuilder({ data: null, error: null });
    const stableThenable = {
      then: ((onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
        deferred.promise.then(onFulfilled, onRejected)) as Promise<unknown>["then"],
      catch: ((onRejected: (e: unknown) => unknown) => deferred.promise.catch(onRejected)) as Promise<unknown>["catch"],
    };

    q.builder.then = stableThenable.then;
    q.builder.catch = stableThenable.catch;

    mockFromExtended.mockImplementationOnce(() => q.builder);

    renderWithClient(<EmailAccountsSection profileId="p1" prenom="Ada" nom="Lovelace" />);

    expect(screen.queryByText(/compte/i)).toBeNull();

    deferred.resolve({ data: ACCOUNTS, error: null });

    await waitFor(() => expect(screen.getByText(/configuration email/i)).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: /configuration email/i }));

    await waitFor(() => expect(screen.getByText(/comptes configurés/i)).toBeInTheDocument());

    expect(screen.getByText("a@b.co")).toBeInTheDocument();
    expect(screen.getByText("c@d.co")).toBeInTheDocument();
    expect(screen.getByText(/sync actif/i)).toBeInTheDocument();
    expect(screen.getByText(/sync désactivé/i)).toBeInTheDocument();

    expect(mockFromExtended).toHaveBeenCalledWith("user_email_accounts_safe");
    expect(q.state.selectCalls[0]).toContain("email_address");
    expect(q.state.eqCalls).toEqual([
      ["profile_id", "p1"],
      ["is_active", true],
    ]);
  });

  it("déclenche la mutation connect, appelle supabase.functions.invoke avec le body attendu et affiche le toast de succès", async () => {
    const fetch1 = createFromExtendedBuilder({ data: [], error: null });
    const fetch2 = createFromExtendedBuilder({ data: ACCOUNTS.slice(0, 1), error: null });
    mockFromExtended.mockImplementationOnce(() => fetch1.builder).mockImplementationOnce(() => fetch2.builder);

    mockInvoke.mockResolvedValueOnce({ data: SUCCESS_INVOKE_DATA, error: null });

    renderWithClient(<EmailAccountsSection profileId="p1" prenom="Ada" nom="Lovelace" />);
    await userEvent.click(screen.getByRole("button", { name: /configuration email/i }));

    const emailInput = screen.getByPlaceholderText("prenom.nom@exploitant.example.org");
    const pwdInput = screen.getByPlaceholderText("Mot de passe email");
    const connectBtn = screen.getByRole("button", { name: /configurer ce compte/i });

    await userEvent.type(emailInput, "new@b.co");
    await userEvent.type(pwdInput, "pw");

    await act(async () => {
      await userEvent.click(connectBtn);
    });

    expect(mockInvoke).toHaveBeenCalledWith("connect-email-account", {
      body: {
        email_address: "new@b.co",
        password: "pw",
        imap_host: "smtp.example.org",
        imap_port: 993,
        smtp_host: "smtp.example.org",
        smtp_port: 465,
        target_profile_id: "p1",
      },
    });

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith({
        title: "Compte email configuré",
        description: "Le compte new@b.co a été configuré pour Ada Lovelace",
      })
    );

    await waitFor(() => expect(screen.getByText("a@b.co")).toBeInTheDocument());
  });

  it("en cas d'erreur invoke, affiche un toast destructive et passe par sanitizeSupabaseError", async () => {
    const fetch1 = createFromExtendedBuilder({ data: [], error: null });
    mockFromExtended.mockImplementationOnce(() => fetch1.builder);

    mockInvoke.mockResolvedValueOnce({ data: null, error: ERROR_INVOKE_SUPABASE });
    mockSanitize.mockReturnValueOnce("sanitized");

    renderWithClient(<EmailAccountsSection profileId="p1" prenom="Ada" nom="Lovelace" />);
    await userEvent.click(screen.getByRole("button", { name: /configuration email/i }));

    await userEvent.type(screen.getByPlaceholderText("prenom.nom@exploitant.example.org"), "err@b.co");
    await userEvent.type(screen.getByPlaceholderText("Mot de passe email"), "pw");

    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: /configurer ce compte/i }));
    });

    await waitFor(() => expect(mockSanitize).toHaveBeenCalled());
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith({
        title: "Erreur",
        description: "sanitized",
        variant: "destructive",
      })
    );
    expect(mockDebugError).toHaveBeenCalled();
  });
});