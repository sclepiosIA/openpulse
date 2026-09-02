import * as React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { ETABS, setResponse, mockFrom } = vi.hoisted(() => {
  const ETABS = [
    { id: "e1", nom: "Alpha Clinic" },
    { id: "e2", nom: "Beta Center" },
  ];
  const responseByTable = new Map<string, { data: unknown; error: unknown }>();
  responseByTable.set("etablissements", { data: ETABS, error: null });

  const baseBuilder = {
    _table: "",
    select() {
      return this;
    },
    order() {
      return this;
    },
    eq() {
      return this;
    },
    gte() {
      return this;
    },
    lte() {
      return this;
    },
    in() {
      return this;
    },
    limit() {
      return this;
    },
    insert() {
      return this;
    },
    update() {
      return this;
    },
    delete() {
      return this;
    },
    single() {
      const res = responseByTable.get(this._table) || { data: null, error: null };
      return Promise.resolve(res);
    },
    maybeSingle() {
      const res = responseByTable.get(this._table) || { data: null, error: null };
      return Promise.resolve(res);
    },
    then(onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
      const res = responseByTable.get(this._table) || { data: null, error: null };
      return Promise.resolve(res).then(onFulfilled, onRejected);
    },
    catch(onRejected?: (e: unknown) => unknown) {
      const res = responseByTable.get(this._table) || { data: null, error: null };
      return Promise.resolve(res).catch(onRejected);
    },
  };

  const mockFrom = vi.fn((table: string) => {
    const b = Object.create(baseBuilder);
    b._table = table;
    return b;
  });

  const setResponse = (table: string, res: { data: unknown; error: unknown }) => {
    responseByTable.set(table, res);
  };

  return { ETABS, setResponse, mockFrom };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock("@/hooks/email/useEmailFilters", () => ({
  EmailFilters: {},
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: any) => {
    const { children, ...rest } = props;
    return <input {...rest}>{children}</input>;
  },
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

vi.mock("@/components/ui/switch", () => ({
  Switch: ({ id, checked, onCheckedChange, ...rest }: any) => (
    <input
      type="checkbox"
      id={id}
      checked={checked}
      onChange={(e) => onCheckedChange && onCheckedChange(e.target.checked)}
      {...rest}
    />
  ),
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
}));

vi.mock("lucide-react", () => ({
  Search: (props: any) => <span data-icon="search" {...props} />,
}));

vi.mock("@/components/ui/accordion", () => ({
  Accordion: ({ children }: any) => <div>{children}</div>,
  AccordionItem: ({ children }: any) => <div>{children}</div>,
  AccordionTrigger: ({ children, ...props }: any) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  AccordionContent: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/ui/radio-group", () => {
  const Ctx = React.createContext<{ value: string; onChange?: (v: string) => void }>({ value: "all" });
  const RadioGroup = ({ value, onValueChange, children }: any) => (
    <Ctx.Provider value={{ value, onChange: onValueChange }}>{children}</Ctx.Provider>
  );
  const RadioGroupItem = ({ value, id }: any) => {
    const ctx = React.useContext(Ctx);
    return (
      <input
        type="radio"
        id={id}
        value={value}
        checked={ctx.value === value}
        onChange={() => ctx.onChange && ctx.onChange(value)}
      />
    );
  };
  return { RadioGroup, RadioGroupItem };
});

import { MobileEmailFilters } from "./MobileEmailFilters";

describe("MobileEmailFilters", () => {
  const baseFilters = {
    search: "",
    category: null as string | null,
    priority: null as string | null,
    unreadOnly: false,
    etablissementId: null as string | null,
  };

  beforeEach(() => {
    mockFrom.mockClear();
    setResponse("etablissements", { data: ETABS, error: null });
  });

  it("renders and allows updating search, unread switch, category and priority", async () => {
    const onChange = vi.fn();
    const onReset = vi.fn();
    const onClose = vi.fn();

    render(
      <MobileEmailFilters
        filters={{ ...baseFilters }}
        onChange={onChange}
        onReset={onReset}
        onClose={onClose}
      />
    );

    const resetBtn = screen.getByRole("button", { name: /réinitialiser/i });
    expect(resetBtn.disabled).toBe(true);

    const applyBtn = screen.getByRole("button", { name: /appliquer/i });
    expect(applyBtn.disabled).toBe(false);

    const searchInput = screen.getByPlaceholderText("Rechercher...") as HTMLInputElement;
    await userEvent.type(searchInput, "hello");

    const searchCalls = onChange.mock.calls.filter((c) => c[0] === "search").map((c) => c[1]);
    expect(searchCalls).toEqual(["h", "e", "l", "l", "o"]);

    const unreadSwitch = screen.getByLabelText("Non lus uniquement") as HTMLInputElement;
    expect(unreadSwitch.checked).toBe(false);
    await userEvent.click(unreadSwitch);
    expect(onChange).toHaveBeenCalledWith("unreadOnly", true);

    const catCommercial = screen.getByLabelText("Commercial") as HTMLInputElement;
    await userEvent.click(catCommercial);
    expect(onChange).toHaveBeenCalledWith("category", "Commercial");

    const priHigh = screen.getByLabelText("Haute") as HTMLInputElement;
    await userEvent.click(priHigh);
    expect(onChange).toHaveBeenCalledWith("priority", "high");

    await userEvent.click(applyBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onReset).not.toHaveBeenCalled();
  });

  it("loads établissements from supabase and allows selecting one", async () => {
    const onChange = vi.fn();
    const onReset = vi.fn();
    const onClose = vi.fn();

    render(
      <MobileEmailFilters
        filters={{ ...baseFilters }}
        onChange={onChange}
        onReset={onReset}
        onClose={onClose}
      />
    );

    expect(screen.queryByLabelText("Alpha Clinic")).toBeNull();
    expect(screen.queryByLabelText("Beta Center")).toBeNull();

    await waitFor(() => {
      expect(screen.getByLabelText("Alpha Clinic")).toBeTruthy();
      expect(screen.getByLabelText("Beta Center")).toBeTruthy();
    });

    const etabAlpha = screen.getByLabelText("Alpha Clinic") as HTMLInputElement;
    await userEvent.click(etabAlpha);
    expect(onChange).toHaveBeenCalledWith("etablissementId", "e1");
  });

  it("handles error response from supabase by not adding établissements options", async () => {
    setResponse("etablissements", { data: null, error: { message: "x" } });

    const onChange = vi.fn();
    const onReset = vi.fn();
    const onClose = vi.fn();

    render(
      <MobileEmailFilters
        filters={{ ...baseFilters }}
        onChange={onChange}
        onReset={onReset}
        onClose={onClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Interne OpenPulse")).toBeTruthy();
      expect(screen.getByLabelText("Non classés")).toBeTruthy();
    });

    expect(screen.queryByLabelText("Alpha Clinic")).toBeNull();
    expect(screen.queryByLabelText("Beta Center")).toBeNull();
  });

  it("enables reset when filters are active and triggers onReset and onClose", async () => {
    const onChange = vi.fn();
    const onReset = vi.fn();
    const onClose = vi.fn();

    render(
      <MobileEmailFilters
        filters={{ ...baseFilters, category: "Support" }}
        onChange={onChange}
        onReset={onReset}
        onClose={onClose}
      />
    );

    const resetBtn = screen.getByRole("button", { name: /réinitialiser/i });
    expect(resetBtn.disabled).toBe(false);

    await userEvent.click(resetBtn);
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
})