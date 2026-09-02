import React from "react";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { format } from "date-fns";

const { stableUser } = vi.hoisted(() => ({
  stableUser: { id: "u1", email: "t@t.co" },
}));

vi.mock("@/lib/utils", () => ({
  cn: (...classes: Array<unknown>) =>
    classes.filter(Boolean).map(String).join(" "),
}));

vi.mock("lucide-react", () => ({
  CalendarIcon: (props: Record<string, unknown>) => (
    <svg data-testid="calendar-icon" {...props} />
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    disabled,
    onClick,
    className,
    ...rest
  }: {
    children?: React.ReactNode;
    disabled?: boolean;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    className?: string;
  }) => (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={className}
      {...rest}
    >
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: ({
    value,
    onChange,
    onBlur,
    onKeyDown,
    placeholder,
    maxLength,
    className,
    type,
  }: {
    value?: string;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    onBlur?: React.FocusEventHandler<HTMLInputElement>;
    onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
    placeholder?: string;
    maxLength?: number;
    className?: string;
    type?: string;
  }) => (
    <input
      data-testid="date-input"
      type={type}
      value={value ?? ""}
      onChange={onChange}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      maxLength={maxLength}
      className={className}
    />
  ),
}));

vi.mock("@/components/ui/popover", async () => {
  const ReactMod = await import("react");
  const ReactLocal = ReactMod.default;

  const Ctx = ReactLocal.createContext<{
    open: boolean;
    onOpenChange: (open: boolean) => void;
  } | null>(null);

  function Popover({
    open,
    onOpenChange,
    children,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
  }) {
    return (
      <Ctx.Provider value={{ open, onOpenChange }}>
        <div data-testid="popover-root">{children}</div>
      </Ctx.Provider>
    );
  }

  function PopoverTrigger({
    asChild,
    children,
  }: {
    asChild?: boolean;
    children: React.ReactElement;
  }) {
    const ctx = ReactLocal.useContext(Ctx);
    if (!ctx) return children;

    const child = ReactLocal.Children.only(children);
    const existingOnClick = (child.props as { onClick?: unknown }).onClick as
      | ((e: React.MouseEvent) => void)
      | undefined;

    const onClick = (e: React.MouseEvent) => {
      if (typeof existingOnClick === "function") existingOnClick(e);
      ctx.onOpenChange(!ctx.open);
    };

    if (asChild) {
      return ReactLocal.cloneElement(child, { onClick });
    }
    return (
      <button type="button" onClick={onClick}>
        {child}
      </button>
    );
  }

  function PopoverContent({
    children,
    className,
  }: {
    children?: React.ReactNode;
    className?: string;
  }) {
    const ctx = ReactLocal.useContext(Ctx);
    if (!ctx?.open) return null;
    return (
      <div data-testid="popover-content" className={className}>
        {children}
      </div>
    );
  }

  return { Popover, PopoverTrigger, PopoverContent };
});

vi.mock("@/components/ui/calendar", () => ({
  Calendar: ({
    selected,
    month,
    onSelect,
  }: {
    selected?: Date;
    month: Date;
    onSelect: (date: Date | undefined) => void;
  }) => (
    <div
      data-testid="calendar"
      data-selected={selected ? format(selected, "yyyy-MM-dd") : ""}
      data-month={format(month, "yyyy-MM-dd")}
    >
      <button
        type="button"
        data-testid="calendar-select"
        onClick={() => onSelect(new Date(2024, 1, 10))}
      >
        select
      </button>
      <button
        type="button"
        data-testid="calendar-clear"
        onClick={() => onSelect(undefined)}
      >
        clear
      </button>
    </div>
  ),
}));

const { mockFrom } = vi.hoisted(() => {
  type Resolved = { data: unknown | null; error: { message: string } | null };
  type SupabaseResponse<T> = PromiseLike<Resolved>;
  type Builder = {
    select: (...args: unknown[]) => Builder;
    eq: (...args: unknown[]) => Builder;
    gte: (...args: unknown[]) => Builder;
    lte: (...args: unknown[]) => Builder;
    in: (...args: unknown[]) => Builder;
    order: (...args: unknown[]) => Builder;
    limit: (...args: unknown[]) => Builder;
    insert: (...args: unknown[]) => Builder;
    update: (...args: unknown[]) => Builder;
    delete: (...args: unknown[]) => Builder;
    single: () => Promise<Resolved>;
    maybeSingle: () => Promise<Resolved>;
    then: SupabaseResponse<unknown>["then"];
    catch: Promise<unknown>["catch"];
    __setResolved: (value: Resolved) => void;
    __getCalls: () => Array<{ method: string; args: unknown[] }>;
  };

  function createBuilder(): Builder {
    let resolved: Resolved = { data: null, error: null };
    const calls: Array<{ method: string; args: unknown[] }> = [];

    const builder: Partial<Builder> = {};

    const chain =
      (method: string) =>
      (...args: unknown[]) => {
        calls.push({ method, args });
        return builder as Builder;
      };

    builder.select = chain("select");
    builder.eq = chain("eq");
    builder.gte = chain("gte");
    builder.lte = chain("lte");
    builder.in = chain("in");
    builder.order = chain("order");
    builder.limit = chain("limit");
    builder.insert = chain("insert");
    builder.update = chain("update");
    builder.delete = chain("delete");

    builder.single = async () => resolved;
    builder.maybeSingle = async () => resolved;

    builder.then = ((onfulfilled?: (value: unknown) => unknown, onrejected?: (reason: unknown) => unknown) =>
      Promise.resolve(resolved).then(
        onfulfilled as (value: Resolved) => unknown,
        onrejected as (reason: unknown) => unknown
      )) as Builder["then"];

    builder.catch = ((onrejected?: (reason: unknown) => unknown) =>
      Promise.resolve(resolved).catch(onrejected as (reason: unknown) => unknown)) as Builder["catch"];

    builder.__setResolved = (value) => {
      resolved = value;
    };

    builder.__getCalls = () => calls;

    return builder as Builder;
  }

  const mockFrom = vi.fn((_table: string) => createBuilder());
  return { mockFrom };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { user: stableUser } },
        error: null,
      })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  },
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: "/" }),
  useParams: () => ({}),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: stableUser,
    session: { user: stableUser },
    isLoading: false,
  }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: stableUser,
    session: { user: stableUser },
    isLoading: false,
  }),
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function Wrapper({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(() => createQueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

import { DatePickerWithInput } from "./date-picker-input";

describe("date-picker-input.tsx", () => {
  it("affiche le placeholder puis synchronise l'input à l'ouverture quand value est définie (sans collision de boutons)", async () => {
    const onChange = vi.fn();

    const r1 = render(
      <Wrapper>
        <DatePickerWithInput value={null} onChange={onChange} placeholder="Choisir" />
      </Wrapper>
    );

    const trigger = screen.getByRole("button", { name: "Choisir" });
    expect(trigger).toBeTruthy();
    expect(screen.queryByTestId("popover-content")).toBeNull();

    fireEvent.click(trigger);
    const input = await screen.findByTestId("date-input");
    expect((input as HTMLInputElement).value).toBe("");

    r1.unmount();
    cleanup();

    render(
      <Wrapper>
        <DatePickerWithInput value="2024-01-15" onChange={onChange} placeholder="Choisir" />
      </Wrapper>
    );

    const trigger2 = screen.getByRole("button", { name: "15 janvier 2024" });
    fireEvent.click(trigger2);

    const input2 = await screen.findByTestId("date-input");
    expect((input2 as HTMLInputElement).value).toBe("15/01/2024");

    const calendar = screen.getByTestId("calendar");
    expect(calendar.getAttribute("data-month")).toBe("2024-01-15");
    expect(calendar.getAttribute("data-selected")).toBe("2024-01-15");
  });

  it("tape une date complète puis blur => appelle onChange avec YYYY-MM-DD", async () => {
    const onChange = vi.fn();
    render(
      <Wrapper>
        <DatePickerWithInput value={null} onChange={onChange} />
      </Wrapper>
    );

    fireEvent.click(screen.getByRole("button", { name: "Sélectionner une date" }));

    const input = await screen.findByTestId("date-input");
    await act(async () => {
      fireEvent.change(input, { target: { value: "10/02/2024" } });
    });
    expect((input as HTMLInputElement).value).toBe("10/02/2024");

    await act(async () => {
      fireEvent.blur(input);
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("2024-02-10");
  });

  it("Entrée invalide (année <= 1900) => n'appelle pas onChange", async () => {
    const onChange = vi.fn();
    render(
      <Wrapper>
        <DatePickerWithInput value={null} onChange={onChange} />
      </Wrapper>
    );

    fireEvent.click(screen.getByRole("button", { name: "Sélectionner une date" }));
    const input = await screen.findByTestId("date-input");

    await act(async () => {
      fireEvent.change(input, { target: { value: "01/01/1900" } });
    });
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
    });

    expect(onChange).toHaveBeenCalledTimes(0);
  });

  it("sélection calendrier => appelle onChange et ferme le popover ; clear => onChange(null)", async () => {
    const onChange = vi.fn();
    render(
      <Wrapper>
        <DatePickerWithInput value={null} onChange={onChange} />
      </Wrapper>
    );

    fireEvent.click(screen.getByRole("button", { name: "Sélectionner une date" }));
    await screen.findByTestId("popover-content");

    await act(async () => {
      fireEvent.click(screen.getByTestId("calendar-select"));
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("2024-02-10");
    expect(screen.queryByTestId("popover-content")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Sélectionner une date" }));
    await screen.findByTestId("popover-content");

    await act(async () => {
      fireEvent.click(screen.getByTestId("calendar-clear"));
    });

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(screen.queryByTestId("popover-content")).toBeNull();
  });

  it("disabled=true => le bouton est désactivé et n'ouvre pas le popover", async () => {
    const onChange = vi.fn();
    render(
      <Wrapper>
        <DatePickerWithInput value={null} onChange={onChange} disabled />
      </Wrapper>
    );

    const trigger = screen.getByRole("button", { name: "Sélectionner une date" }) as HTMLButtonElement;
    expect(trigger.disabled).toBe(true);

    fireEvent.click(trigger);
    expect(screen.queryByTestId("popover-content")).toBeNull();
  });
});
