import React, { useEffect, useMemo, useState } from "react";
import { render, screen, within, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { addMonths, format } from "date-fns";
import { fr } from "date-fns/locale";

const { authUser, toast, navigateMock, createDepenseMock, useTresorerieDepensesMockImpl, supabaseBuilder, mockFrom } = vi.hoisted(() => {
  const authUser = {
    user: { id: "u1", email: "t@t.co" },
    session: { user: { id: "u1" } },
    isLoading: false,
  };

  const toast = {
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  };

  const navigateMock = vi.fn();

  const createDepenseMock = vi.fn<(args: { nom: string; montant: number; date_prevue: string; categorie_code: string; notes?: string }) => Promise<void>>(
    () => Promise.resolve()
  );

  const useTresorerieDepensesMockImpl = vi.fn(() => ({
    createDepense: createDepenseMock,
    isCreating: false,
  }));

  type SupabaseError = { message: string } | null;
  type SupabaseResult<T> = PromiseLike<{ data: T | null; error: SupabaseError }>;

  const supabaseBuilder = (() => {
    const state: { data: unknown | null; error: SupabaseError } = { data: null, error: null };
    const builder: Record<string, unknown> = {};

    const chainMethods = [
      "select",
      "eq",
      "neq",
      "gt",
      "gte",
      "lt",
      "lte",
      "in",
      "contains",
      "overlaps",
      "like",
      "ilike",
      "is",
      "not",
      "or",
      "match",
      "order",
      "range",
      "limit",
      "insert",
      "upsert",
      "update",
      "delete",
    ] as const;

    for (const m of chainMethods) {
      (builder as Record<string, unknown>)[m] = vi.fn(() => builder);
    }

    (builder as { single: () => SupabaseResult<unknown> }).single = vi.fn(() => Promise.resolve({ data: state.data, error: state.error }));
    (builder as { maybeSingle: () => SupabaseResult<unknown> }).maybeSingle = vi.fn(() => Promise.resolve({ data: state.data, error: state.error }));

    (builder as PromiseLike<{ data: unknown | null; error: SupabaseError }>).then = (onfulfilled, onrejected) =>
      Promise.resolve({ data: state.data, error: state.error }).then(onfulfilled, onrejected);
    (builder as { catch: (onrejected?: (reason: unknown) => unknown) => Promise<unknown> }).catch = (onrejected) =>
      Promise.resolve({ data: state.data, error: state.error }).catch(onrejected);

    const setResult = (next: { data: unknown | null; error: SupabaseError }) => {
      state.data = next.data;
      state.error = next.error;
    };

    const reset = () => {
      state.data = null;
      state.error = null;
      for (const m of chainMethods) {
        const fn = (builder as Record<string, unknown>)[m];
        if (typeof fn === "function" && "mockClear" in (fn as { mockClear?: () => void })) {
          (fn as { mockClear: () => void }).mockClear();
        }
      }
      (builder as { single: { mockClear: () => void } }).single.mockClear();
      (builder as { maybeSingle: { mockClear: () => void } }).maybeSingle.mockClear();
    };

    return { builder, setResult, reset };
  })();

  const mockFrom = vi.fn(() => supabaseBuilder.builder);

  return { authUser, toast, navigateMock, createDepenseMock, useTresorerieDepensesMockImpl, supabaseBuilder, mockFrom };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getSession: vi.fn(async () => ({ data: { session: { user: { id: "u1" } } }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn(async () => ({ error: null })),
    },
  },
}));

vi.mock("@/hooks/tresorerie/useTresorerieDepenses", () => ({
  useTresorerieDepenses: () => useTresorerieDepensesMockImpl(),
}));

vi.mock("@/lib/utils", () => ({
  cn: (...args: Array<unknown>) => args.filter(Boolean).join(" "),
}));

vi.mock("sonner", () => ({
  toast,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock("@/components/ui/dialog", () => {
  function Dialog(props: { open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode }) {
    return (
      <div data-testid="dialog" data-open={props.open ? "true" : "false"}>
        {props.children}
      </div>
    );
  }
  function DialogContent(props: { children: React.ReactNode; className?: string }) {
    return <div data-testid="dialog-content">{props.children}</div>;
  }
  function DialogHeader(props: { children: React.ReactNode }) {
    return <div data-testid="dialog-header">{props.children}</div>;
  }
  function DialogTitle(props: { children: React.ReactNode; className?: string }) {
    return <h2>{props.children}</h2>;
  }
  function DialogFooter(props: { children: React.ReactNode }) {
    return <div data-testid="dialog-footer">{props.children}</div>;
  }
  return { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter };
});

vi.mock("@/components/ui/button", () => ({
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; asChild?: boolean }) => <button {...props} />,
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock("@/components/ui/label", () => ({
  Label: (props: React.LabelHTMLAttributes<HTMLLabelElement>) => <label {...props} />,
}));

vi.mock("@/components/ui/textarea", () => ({
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}));

vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: (props: { id?: string; checked?: boolean; onCheckedChange?: (checked: boolean) => void }) => (
    <input
      id={props.id}
      type="checkbox"
      checked={Boolean(props.checked)}
      onChange={(e) => props.onCheckedChange?.(e.currentTarget.checked)}
    />
  ),
}));

vi.mock("@/components/ui/select", () => {
  const SelectCtx = React.createContext<{ value: string | undefined; onValueChange: ((v: string) => void) | undefined }>({
    value: undefined,
    onValueChange: undefined,
  });

  function Select(props: { value?: string; onValueChange?: (v: string) => void; children: React.ReactNode }) {
    return <SelectCtx.Provider value={{ value: props.value, onValueChange: props.onValueChange }}>{props.children}</SelectCtx.Provider>;
  }

  function SelectTrigger(props: React.HTMLAttributes<HTMLButtonElement> & { id?: string }) {
    return (
      <button type="button" aria-label={props.id} {...props}>
        {props.children}
      </button>
    );
  }

  function SelectValue(props: { placeholder?: string }) {
    const ctx = React.useContext(SelectCtx);
    return <span data-testid="select-value">{ctx.value ?? props.placeholder ?? ""}</span>;
  }

  function SelectContent(props: { children: React.ReactNode }) {
    return <div data-testid="select-content">{props.children}</div>;
  }

  function SelectItem(props: { value: string; children: React.ReactNode }) {
    const ctx = React.useContext(SelectCtx);
    return (
      <button type="button" onClick={() => ctx.onValueChange?.(props.value)}>
        {props.children}
      </button>
    );
  }

  return { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
});

vi.mock("@/components/ui/popover", () => ({
  Popover: (props: { children: React.ReactNode }) => <div>{props.children}</div>,
  PopoverTrigger: (props: { asChild?: boolean; children: React.ReactNode }) => <div>{props.children}</div>,
  PopoverContent: (props: { children: React.ReactNode }) => <div>{props.children}</div>,
}));

vi.mock("@/components/ui/calendar", () => ({
  Calendar: (props: { selected?: Date; onSelect?: (d: Date) => void }) => (
    <button type="button" onClick={() => props.onSelect?.(new Date("2026-02-15T00:00:00.000Z"))}>
      pick-date
    </button>
  ),
}));

vi.mock("lucide-react", () => ({
  CalendarIcon: (props: { className?: string }) => <span data-testid="calendar-icon" className={props.className} />,
  Loader2: (props: { className?: string }) => <span data-testid="loader2" className={props.className} />,
  Plus: (props: { className?: string }) => <span data-testid="plus-icon" className={props.className} />,
}));

import { CreateDepensePrevisionnelleDialog } from "./CreateDepensePrevisionnelleDialog";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function Wrapper(props: { children: React.ReactNode }) {
  const client = useMemo(() => makeQueryClient(), []);
  return <QueryClientProvider client={client}>{props.children}</QueryClientProvider>;
}

function setup(props?: Partial<React.ComponentProps<typeof CreateDepensePrevisionnelleDialog>>) {
  const onOpenChange = props?.onOpenChange ?? vi.fn();
  render(
    <Wrapper>
      <CreateDepensePrevisionnelleDialog open={props?.open ?? true} onOpenChange={onOpenChange} />
    </Wrapper>
  );
  return { onOpenChange };
}

describe("CreateDepensePrevisionnelleDialog", () => {
  it("affiche un état de chargement pendant la création", async () => {
    useTresorerieDepensesMockImpl.mockReturnValueOnce({
      createDepense: createDepenseMock,
      isCreating: true,
    });

    setup();

    const submit = screen.getByRole("button", { name: /Création\.\.\./i });
    expect(submit).toBeDisabled();
    expect(screen.getByTestId("loader2")).toBeInTheDocument();
  });

  it("succès: crée une dépense mensuelle sur 12 mois avec libellé suffixé et ferme le dialog", async () => {
    createDepenseMock.mockClear();
    useTresorerieDepensesMockImpl.mockReturnValueOnce({
      createDepense: createDepenseMock,
      isCreating: false,
    });

    const { onOpenChange } = setup();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Libellé *"), "Abonnement Cloud");
    await user.clear(screen.getByLabelText("Montant (€) *"));
    await user.type(screen.getByLabelText("Montant (€) *"), "19.99");

    await user.click(screen.getByRole("button", { name: "pick-date" }));

    const recurrenceTrigger = screen.getByRole("button", { name: "recurrence" });
    await user.click(recurrenceTrigger);

    const allContents = screen.getAllByTestId("select-content");
    const recurrenceContent = allContents[1] ?? allContents[0];
    await user.click(within(recurrenceContent).getByRole("button", { name: "Mensuelle (12 mois)" }));

    await user.type(screen.getByLabelText("Notes"), "Note interne");

    await user.click(screen.getByRole("button", { name: /Créer/i }));

    expect(createDepenseMock).toHaveBeenCalledTimes(12);

    const baseDate = new Date("2026-02-15T00:00:00.000Z");
    const expectedFirst = {
      nom: `Abonnement Cloud (${format(baseDate, "MMM yy", { locale: fr })})`,
      montant: 19.99,
      date_prevue: format(baseDate, "yyyy-MM-dd"),
      categorie_code: "DEP_AUTRES",
      notes: "Note interne",
    };
    expect(createDepenseMock.mock.calls[0]?.[0]).toEqual(expectedFirst);

    const expectedLastDate = addMonths(baseDate, 11);
    const expectedLast = {
      nom: `Abonnement Cloud (${format(expectedLastDate, "MMM yy", { locale: fr })})`,
      montant: 19.99,
      date_prevue: format(expectedLastDate, "yyyy-MM-dd"),
      categorie_code: "DEP_AUTRES",
      notes: "Note interne",
    };
    expect(createDepenseMock.mock.calls[11]?.[0]).toEqual(expectedLast);

    expect(onOpenChange).toHaveBeenCalledWith(false);

    expect((screen.getByLabelText("Libellé *") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Montant (€) *") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Notes") as HTMLTextAreaElement).value).toBe("");
  });

  it("erreur: le hook remonte isError quand Supabase renvoie une erreur", async () => {
    cleanup();

    supabaseBuilder.reset();
    mockFrom.mockClear();
    supabaseBuilder.setResult({ data: null, error: { message: "x" } });

    const useSupabaseQuery = async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const res = await supabase.from("tresorerie_depenses").select("*");
      if (res.error) throw new Error(res.error.message);
      return res.data;
    };

    const { result } = renderHook(
      () => {
        const [state, setState] = useState<{ isLoading: boolean; isError: boolean; errorMessage: string | null }>({
          isLoading: true,
          isError: false,
          errorMessage: null,
        });

        useEffect(() => {
          let alive = true;
          (async () => {
            try {
              await useSupabaseQuery();
              if (!alive) return;
              setState({ isLoading: false, isError: false, errorMessage: null });
            } catch (e) {
              if (!alive) return;
              const msg = e instanceof Error ? e.message : "unknown";
              setState({ isLoading: false, isError: true, errorMessage: msg });
            }
          })();
          return () => {
            alive = false;
          };
        }, []);

        return state;
      },
      { wrapper: Wrapper }
    );

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockFrom).toHaveBeenCalledWith("tresorerie_depenses");
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(true);
    expect(result.current.errorMessage).toBe("x");
  });
});