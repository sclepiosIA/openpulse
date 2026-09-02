const { cnMock, CVA_BASE, cvaMock, mockFrom, builder, authMock, toastMocks } = vi.hoisted(() => {
  const cnFn = vi.fn((...parts: Array<string | undefined | false>) => parts.filter(Boolean).join(" "));
  const BASE = "base-classes";
  const cvaFunction = (_input: unknown, opts?: { defaultVariants?: { variant?: string } }) => {
    return (params?: { variant?: string }) => {
      const variant = params?.variant ?? opts?.defaultVariants?.variant ?? "default";
      const variantClass = variant === "destructive" ? "destructive-classes" : "default-classes";
      return `${BASE} ${variantClass}`;
    };
  };

  // Minimal supabase builder mock with chainable methods and thenable behavior
  const builderObj: Record<string, unknown> = {};
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    lte: vi.fn(() => chain),
    "in": vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
    then: vi.fn(function (this: unknown, onFulfill: (v: unknown) => unknown) {
      // default resolution
      const value = { data: null, error: null };
      try {
        return Promise.resolve(onFulfill(value));
      } catch (e) {
        return Promise.reject(e);
      }
    }),
    catch: vi.fn(() => chain),
  };
  Object.assign(builderObj, chain);

  const mockFromFn = vi.fn(() => chain);

  // Stable auth/session mock
  const auth = {
    useAuth: vi.fn(() => ({
      user: { id: "u1", email: "user@example.com" },
      session: { user: { id: "u1" } },
      isLoading: false,
    })),
  };

  // sonner/toast mocks
  const toasts = { success: vi.fn(), error: vi.fn() };

  return {
    cnMock: cnFn,
    CVA_BASE: BASE,
    cvaMock: cvaFunction,
    mockFrom: mockFromFn,
    builder: builderObj,
    authMock: auth,
    toastMocks: toasts,
  };
});

// Mock class-variance-authority to return predictable classes
vi.mock("class-variance-authority", () => {
  return {
    cva: cvaMock,
  };
});

// Mock internal utils.cn
vi.mock("@/lib/utils", () => {
  return {
    cn: cnMock,
  };
});

// Mock supabase client integration (shape required by rules)
vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      from: mockFrom,
    },
  };
});

// Mock common auth hooks/contexts that tests might import elsewhere
vi.mock("@/hooks/useAuth", () => {
  return {
    useAuth: authMock.useAuth,
  };
});
vi.mock("@/contexts/AuthContext", () => {
  return {
    useAuth: authMock.useAuth,
  };
});

// Mock sonner toast module
vi.mock("sonner", () => {
  return {
    toast: toastMocks,
  };
});

// Mock react-router useNavigate if imported elsewhere
vi.mock("react-router-dom", () => {
  return {
    useNavigate: vi.fn(() => vi.fn()),
  };
});

// Ensure jest-dom matchers are available
import "@testing-library/jest-dom";
import React from "react";
import { render, screen } from "@testing-library/react";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Alert, AlertTitle, AlertDescription } from "./alert";

describe("Alert component suite", () => {
  const createQueryClient = () =>
    new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={createQueryClient()}>{children}</QueryClientProvider>
  );

  it("renders default Alert with role alert, children and cva-derived classes", () => {
    render(
      <Alert data-testid="alert-default">
        <span>Default content</span>
      </Alert>
    );

    const alert = screen.getByTestId("alert-default");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveAttribute("role", "alert");
    expect(alert).toHaveTextContent("Default content");
    // Our cva mock returns base + default-classes for default variant
    expect(alert.className).toContain(CVA_BASE);
    expect(alert.className).toContain("default-classes");
    // cn should have been used to merge classes at least once
    expect(cnMock).toHaveBeenCalled();
  });

  it("applies destructive variant classes when variant='destructive'", () => {
    render(
      <Alert variant="destructive" data-testid="alert-destructive">
        Dangerous
      </Alert>
    );
    const alert = screen.getByTestId("alert-destructive");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent("Dangerous");
    // destructive class should be present from our cva mock
    expect(alert.className).toContain("destructive-classes");
  });

  it("forwards ref to the underlying div element", () => {
    const ref = React.createRef<HTMLDivElement>();
    render(
      <Alert ref={ref} data-testid="alert-ref">
        With ref
      </Alert>
    );
    const alert = screen.getByTestId("alert-ref");
    // ref should be attached to the same DOM node rendered
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current).toBe(alert);
    expect(ref.current).toHaveAttribute("role", "alert");
  });

  it("renders AlertTitle as an h5 and AlertDescription as a div with expected utility classes", () => {
    render(
      <Alert data-testid="alert-composition">
        <AlertTitle data-testid="alert-title">My title</AlertTitle>
        <AlertDescription data-testid="alert-desc">Some description</AlertDescription>
      </Alert>
    );

    const title = screen.getByTestId("alert-title");
    const desc = screen.getByTestId("alert-desc");

    // Title should be an H5 element and contain the expected text and utility classes
    expect(title.tagName).toBe("H5");
    expect(title).toHaveTextContent("My title");
    expect(title.className).toContain("mb-1");
    expect(title.className).toContain("font-medium");

    // Description is rendered as a div with small text class present in its className
    expect(desc.tagName).toBe("DIV");
    expect(desc).toHaveTextContent("Some description");
    expect(desc.className).toContain("text-sm");
  });

  it("allows dynamic updates via a hook inside QueryClientProvider (renderHook with required wrapper)", async () => {
    const { result } = renderHook(
      () => {
        const [state, setState] = React.useState<{ status: "loading" | "success" | "error"; payload?: string; error?: string }>({
          status: "loading",
        });
        React.useEffect(() => {
          // no automatic changes; test will drive updates
        }, []);
        return { state, setState };
      },
      {
        wrapper: Wrapper,
      }
    );

    // initial state: loading
    expect(result.current.state.status).toBe("loading");

    // Transition to success and assert that a rendered Alert reflects the change
    await act(async () => {
      result.current.setState({ status: "success", payload: "Loaded" });
    });

    // Render an Alert based on the hook state and verify
    render(
      <Alert data-testid="alert-dynamic">
        {result.current.state.status === "loading" && <AlertTitle>Loading</AlertTitle>}
        {result.current.state.status === "success" && <AlertTitle>Success: {result.current.state.payload}</AlertTitle>}
        {result.current.state.status === "error" && <AlertTitle>Error: {result.current.state.error}</AlertTitle>}
      </Alert>
    );

    const dynamic = screen.getByTestId("alert-dynamic");
    expect(dynamic).toHaveTextContent("Success: Loaded");

    // Now transition to error and ensure the error view would show when re-rendered
    await act(async () => {
      result.current.setState({ status: "error", error: "Something went wrong" });
    });

    render(
      <Alert data-testid="alert-dynamic-err">
        {result.current.state.status === "loading" && <AlertTitle>Loading</AlertTitle>}
        {result.current.state.status === "success" && <AlertTitle>Success: {result.current.state.payload}</AlertTitle>}
        {result.current.state.status === "error" && <AlertTitle>Error: {result.current.state.error}</AlertTitle>}
      </Alert>
    );

    const dynamicErr = screen.getByTestId("alert-dynamic-err");
    expect(dynamicErr).toHaveTextContent("Error: Something went wrong");
  });
});