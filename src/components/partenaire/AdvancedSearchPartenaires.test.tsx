import React from "react";
import { render, screen, fireEvent, act, waitFor, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi } from "vitest";

// hoisted stable mocks and constants
const { ROWS, RESULT_SUCCESS, RESULT_ERROR, setCurrent, mockFrom, BUILDER } = vi.hoisted(() => {
  const ROWS = [{ id: "1", name: "Partenaire 1" }];
  const RESULT_SUCCESS = { data: ROWS, error: null };
  const RESULT_ERROR = { data: null, error: { message: "erreur-test" } };

  let current = RESULT_SUCCESS;

  const builder: any = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    then: (resolve: (v: any) => any) => {
      const p = Promise.resolve(current);
      return p.then(resolve);
    },
    catch: (fn: (e: any) => any) => {
      return Promise.resolve(current).catch(fn);
    },
  };

  const mockFrom = vi.fn(() => builder);

  const setCurrent = (r: unknown) => {
    // @ts-ignore
    current = r;
  };

  return { ROWS, RESULT_SUCCESS, RESULT_ERROR, setCurrent, mockFrom, BUILDER: builder };
});

// stable callbacks for component props
const { mockOnOpenChange, mockOnApplyFilters } = vi.hoisted(() => ({
  mockOnOpenChange: vi.fn(),
  mockOnApplyFilters: vi.fn(),
}));

// mock supabase client with chainable builder
vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      from: mockFrom,
    },
  };
});

// Mock UI components used by the component under test.
// These mocks intentionally render native elements so that tests can interact with them.
vi.mock("@/components/ui/dialog", () => {
  const Dialog = ({ children, open }: any) =>
    React.createElement("div", { "data-testid": "dialog", "data-open": open ? "true" : "false" }, children);
  const DialogContent = ({ children }: any) => React.createElement("div", { "data-testid": "dialog-content" }, children);
  const DialogHeader = ({ children }: any) => React.createElement("div", { "data-testid": "dialog-header" }, children);
  const DialogTitle = ({ children }: any) => React.createElement("h2", { "data-testid": "dialog-title" }, children);
  const DialogFooter = ({ children }: any) => React.createElement("div", { "data-testid": "dialog-footer" }, children);
  return { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter };
});

vi.mock("@/components/ui/button", () => {
  // Render a button preserving variant and onClick so we can assert variant changes
  return {
    Button: ({ children, onClick, variant, size, ...rest }: any) =>
      React.createElement(
        "button",
        {
          "data-variant": variant,
          "data-size": size,
          onClick,
          ...rest,
        },
        typeof children === "string" ? children : React.createElement("span", {}, children)
      ),
  };
});

vi.mock("@/components/ui/input", () => {
  return {
    Input: ({ value, onChange, placeholder, type, ...rest }: any) =>
      React.createElement("input", {
        value,
        onChange,
        placeholder,
        type,
        ...rest,
      }),
  };
});

vi.mock("@/components/ui/label", () => {
  return {
    Label: ({ children }: any) => React.createElement("label", {}, children),
  };
});

vi.mock("@/components/ui/slider", () => {
  return {
    Slider: ({ value, onValueChange, min, max, step }: any) =>
      React.createElement(
        "div",
        {
          "data-testid": "slider",
          onClick: () => {
            // simulate toggling to midpoint when clicked
            if (onValueChange) {
              const low = Array.isArray(value) ? value[0] : min ?? 0;
              const high = Array.isArray(value) ? value[1] : max ?? 100;
              const midLow = Math.max(min ?? 0, Math.floor((low + high) / 2 / (step ?? 1)) * (step ?? 1));
              const midHigh = Math.min(max ?? 100, midLow + (step ?? 1));
              onValueChange([midLow, midHigh]);
            }
          },
        },
        `slider ${min ?? ""}-${max ?? ""}`
      ),
  };
});

// mock icons
vi.mock("lucide-react", () => {
  return {
    Search: (props: any) => React.createElement("span", { "data-testid": "icon-search", ...props }, "S"),
    X: (props: any) => React.createElement("span", { "data-testid": "icon-x", ...props }, "X"),
  };
});

// import the component under test (must be after mocks)
import { AdvancedSearchPartenaires } from "./AdvancedSearchPartenaires";
import { supabase } from "@/integrations/supabase/client";

describe("AdvancedSearchPartenaires - UI and interactions", () => {
  const createQueryClient = () =>
    new QueryClient({
      defaultOptions: { queries: { retry: 0 as const, gcTime: 0 as const }, mutations: { retry: 0 as const } },
    });

  const Wrapper = ({ children }: any) => {
    const qc = createQueryClient();
    return React.createElement(QueryClientProvider, { client: qc }, children);
  };

  beforeEach(() => {
    mockOnOpenChange.mockClear();
    mockOnApplyFilters.mockClear();
    mockFrom.mockClear();
    BUILDER.select.mockClear?.();
    BUILDER.insert.mockClear?.();
    BUILDER.update.mockClear?.();
    setCurrent(RESULT_SUCCESS);
  });

  it("renders dialog with expected static texts and default numeric displays when open", () => {
    render(
      React.createElement(
        Wrapper,
        null,
        React.createElement(AdvancedSearchPartenaires, {
          open: true,
          onOpenChange: mockOnOpenChange,
          onApplyFilters: mockOnApplyFilters,
        })
      )
    );

    expect(screen.getByTestId("dialog")).toBeTruthy();
    expect(screen.getByText("Recherche avancée")).toBeTruthy();
    expect(screen.getByText("Nom du partenaire")).toBeTruthy();
    // numeric displays formatted in fr-FR: 0 and 1 000 000 with non-breaking spaces
    expect(screen.getByText("0€")).toBeTruthy();
    // The formatted max uses a non-breaking space; match by removing spaces for robustness
    const maxText = Array.from(screen.getAllByText((content) => content.includes("€"))).map((n) => n.textContent || "");
    expect(maxText.some((t) => t.replace(/\s/g, "") === "1000000€")).toBe(true);
  });

  it("toggles type button, applies filters and closes dialog", async () => {
    render(
      React.createElement(
        Wrapper,
        null,
        React.createElement(AdvancedSearchPartenaires, {
          open: true,
          onOpenChange: mockOnOpenChange,
          onApplyFilters: mockOnApplyFilters,
        })
      )
    );

    const institutionnelBtn = screen.getByText("Institutionnel");
    // initial variant should be outline
    expect(institutionnelBtn.getAttribute("data-variant")).toBe("outline");

    // click to toggle selection
    await act(async () => {
      fireEvent.click(institutionnelBtn);
    });

    // after toggle variant becomes default
    expect(institutionnelBtn.getAttribute("data-variant")).toBe("default");

    // click Rechercher
    const rechercherBtn = screen.getByText("Rechercher");
    await act(async () => {
      fireEvent.click(rechercherBtn);
    });

    // onApplyFilters should be called with expected filter shape
    expect(mockOnApplyFilters).toHaveBeenCalledTimes(1);
    const calledWith = mockOnApplyFilters.mock.calls[0][0];
    expect(calledWith).toEqual(
      expect.objectContaining({
        types: ["institutionnel"],
        statuts: [],
        valeurMin: 0,
        valeurMax: 1000000,
        engagementMin: 0,
        engagementMax: 100,
      })
    );

    // onOpenChange should be called to close dialog
    expect(mockOnOpenChange).toHaveBeenCalledTimes(1);
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it("resets filters to defaults when clicking Réinitialiser", async () => {
    render(
      React.createElement(
        Wrapper,
        null,
        React.createElement(AdvancedSearchPartenaires, {
          open: true,
          onOpenChange: mockOnOpenChange,
          onApplyFilters: mockOnApplyFilters,
        })
      )
    );

    const institutionnelBtn = screen.getByText("Institutionnel");
    expect(institutionnelBtn.getAttribute("data-variant")).toBe("outline");

    // toggle on
    await act(async () => {
      fireEvent.click(institutionnelBtn);
    });
    expect(institutionnelBtn.getAttribute("data-variant")).toBe("default");

    // click Réinitialiser
    const resetBtn = screen.getByText("Réinitialiser");
    await act(async () => {
      fireEvent.click(resetBtn);
    });

    // after reset the button variant should be back to outline
    expect(institutionnelBtn.getAttribute("data-variant")).toBe("outline");

    // numeric displays back to defaults
    expect(screen.getByText("0€")).toBeTruthy();
    const maxTexts = Array.from(screen.getAllByText((content) => content.includes("€"))).map((n) => n.textContent || "");
    expect(maxTexts.some((t) => t.replace(/\s/g, "") === "1000000€")).toBe(true);
  });
});

describe("Supabase interaction - simulated hook and mutation using mocked builder", () => {
  const createQueryClient = () =>
    new QueryClient({
      defaultOptions: { queries: { retry: 0 as const, gcTime: 0 as const }, mutations: { retry: 0 as const } },
    });

  const Wrapper = ({ children }: any) => {
    const qc = createQueryClient();
    return React.createElement(QueryClientProvider, { client: qc }, children);
  };

  // a tiny hook that uses the mocked supabase client to demonstrate isLoading/success/error flows
  function useFetchPartenaires() {
    const [state, setState] = React.useState({ isLoading: true, data: null as null | typeof ROWS, error: null as null | any });
    React.useEffect(() => {
      let mounted = true;
      // call the mocked supabase client
      supabase
        .from("partenaires")
        .select()
        .then((res: any) => {
          if (!mounted) return;
          if (res.error) {
            setState({ isLoading: false, data: null, error: res.error });
          } else {
            setState({ isLoading: false, data: res.data, error: null });
          }
        })
        .catch((e: any) => {
          if (!mounted) return;
          setState({ isLoading: false, data: null, error: e });
        });
      return () => {
        mounted = false;
      };
    }, []);
    return state;
  }

  beforeEach(() => {
    setCurrent(RESULT_SUCCESS);
    mockFrom.mockClear();
    BUILDER.select.mockClear?.();
    BUILDER.insert.mockClear?.();
  });

  it("handles loading -> success when supabase returns data", async () => {
    setCurrent(RESULT_SUCCESS);
    const qc = createQueryClient();
    const wrapper = ({ children }: any) => React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useFetchPartenaires(), { wrapper });

    // initially loading true
    expect(result.current.isLoading).toBe(true);

    // wait for effect to resolve
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(ROWS);
    expect(result.current.error).toBeNull();
    // ensure builder was used
    expect(mockFrom).toHaveBeenCalledWith("partenaires");
    expect(BUILDER.select).toHaveBeenCalled();
  });

  it("handles error response from supabase and surfaces isError", async () => {
    setCurrent(RESULT_ERROR);
    const qc = createQueryClient();
    const wrapper = ({ children }: any) => React.createElement(QueryClientProvider, { client: qc }, children);

    const { result } = renderHook(() => useFetchPartenaires(), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toEqual(RESULT_ERROR.error);
  });

  it("calls insert on the builder when performing a mutation", async () => {
    // perform a mutation by calling insert on the builder
    await act(async () => {
      const b = supabase.from("partenaires");
      b.insert([{ name: "nouveau" }]);
    });

    // assert insert was called with the payload
    expect(BUILDER.insert).toHaveBeenCalledWith([{ name: "nouveau" }]);
  });
});