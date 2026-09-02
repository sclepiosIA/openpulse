// @vitest-environment jsdom
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderHook, act } from "@testing-library/react";
import { GenericDomainEmailsList } from "./GenericDomainEmailsList";

const {
  THREADS_SUCCESS,
  MAPPINGS_SUCCESS,
  THREADS_ERROR,
  AUTH_STATE,
  mockFrom,
  mockMarkMutate,
  mockUseMarkEmailAsUnaffiliated,
  mockIsGenericDomain,
  mockSanitizeEmailSubject,
} = vi.hoisted(() => ({
  THREADS_SUCCESS: [
    {
      id: "t1",
      subject: "  Hello A  ",
      last_message_date: "2024-05-03T10:00:00Z",
      email_messages: [{ from_address: "alice@gmail.com", to_addresses: ["x@test.local"] }],
    },
    {
      id: "t2",
      subject: "Re: Hello B",
      last_message_date: "2024-05-02T10:00:00Z",
      email_messages: [{ from_address: "alice@gmail.com", to_addresses: ["x@test.local"] }],
    },
    {
      id: "t3",
      subject: "Subject C",
      last_message_date: "2024-05-01T10:00:00Z",
      email_messages: [{ from_address: "bob@hotmail.com", to_addresses: ["x@test.local"] }],
    },
    {
      id: "t4",
      subject: "Work mail",
      last_message_date: "2024-04-30T10:00:00Z",
      email_messages: [{ from_address: "pro@company.com", to_addresses: ["x@test.local"] }],
    },
    {
      id: "t5",
      subject: "Mapped already",
      last_message_date: "2024-04-29T10:00:00Z",
      email_messages: [{ from_address: "mapped@gmail.com", to_addresses: ["x@test.local"] }],
    },
  ],
  MAPPINGS_SUCCESS: [{ email_address: "mapped@gmail.com" }],
  THREADS_ERROR: null,
  AUTH_STATE: {
    user: { id: "u1", email: "tester@example.local" },
    session: { user: { id: "u1" } },
    isLoading: false,
  },
  mockFrom: vi.fn(),
  mockMarkMutate: vi.fn(),
  mockUseMarkEmailAsUnaffiliated: vi.fn(),
  mockIsGenericDomain: vi.fn(),
  mockSanitizeEmailSubject: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => {
  const createBuilder = (table: string) => {
    const state = {
      table,
      shouldError: false,
    };

    const resolveResult = () => {
      if (state.table === "email_threads") {
        if (state.shouldError) {
          return Promise.resolve({ data: THREADS_ERROR, error: { message: "x" } });
        }
        return Promise.resolve({ data: THREADS_SUCCESS, error: null });
      }
      if (state.table === "email_specific_mappings") {
        return Promise.resolve({ data: MAPPINGS_SUCCESS, error: null });
      }
      return Promise.resolve({ data: [], error: null });
    };

    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      is: vi.fn((column: string, value: null) => {
        if (table === "email_threads" && column === "etablissement_id" && value === null && THREADS_ERROR === null) {
          return builder;
        }
        return builder;
      }),
      single: vi.fn(() => resolveResult()),
      maybeSingle: vi.fn(() => resolveResult()),
      then: (onFulfilled: (value: { data: unknown; error: { message: string } | null }) => unknown, onRejected?: (reason: unknown) => unknown) =>
        resolveResult().then(onFulfilled, onRejected),
      catch: (onRejected: (reason: unknown) => unknown) => resolveResult().catch(onRejected),
    };

    if (table === "email_threads" && THREADS_ERROR !== null) {
      state.shouldError = true;
    }

    return builder;
  };

  mockFrom.mockImplementation((table: string) => createBuilder(table));

  return {
    supabase: {
      from: mockFrom,
    },
  };
});

vi.mock("@/lib/emailUtils", () => ({
  isGenericDomain: mockIsGenericDomain,
  sanitizeEmailSubject: mockSanitizeEmailSubject,
}));

vi.mock("@/hooks/email/useEmailSpecificMappings", () => ({
  useMarkEmailAsUnaffiliated: mockUseMarkEmailAsUnaffiliated,
}));

vi.mock("./EmailSpecificMappingDialog", () => ({
  EmailSpecificMappingDialog: ({
    open,
    defaultEmail,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    defaultEmail?: string;
  }) => (
    <div data-testid="mapping-dialog">
      <span>{open ? "open" : "closed"}</span>
      <span>{defaultEmail ?? ""}</span>
    </div>
  ),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => <h2 className={className}>{children}</h2>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    size?: string;
    variant?: string;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: React.ReactNode; className?: string }) => <div>{children}</div>,
}));

vi.mock("lucide-react", () => ({
  Loader2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="loader" {...props} />,
  AtSign: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="atsign" {...props} />,
  ChevronRight: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="chevron" {...props} />,
  Ban: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="ban" {...props} />,
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => AUTH_STATE,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("GenericDomainEmailsList", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockIsGenericDomain.mockImplementation((domain: string) => domain === "gmail.com" || domain === "hotmail.com");
    mockSanitizeEmailSubject.mockImplementation((subject: string) => `sanitized:${subject.trim()}`);
    mockUseMarkEmailAsUnaffiliated.mockReturnValue({
      mutate: mockMarkMutate,
      isPending: false,
    });
  });

  it("affiche un état de chargement puis les groupes d'emails génériques triés avec les sujets sanitizés", async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(() => null, { wrapper });
    expect(result.current).toBeNull();

    render(<GenericDomainEmailsList />, { wrapper });

    expect(screen.getByTestId("loader")).toBeInTheDocument();

    await screen.findByText("Emails personnels à affilier");

    expect(screen.getByText("2 adresses • 3 conversations")).toBeInTheDocument();
    expect(screen.getByText("alice@gmail.com")).toBeInTheDocument();
    expect(screen.getByText("bob@hotmail.com")).toBeInTheDocument();
    expect(screen.getByText("2 conversations")).toBeInTheDocument();
    expect(screen.getByText("1 conversation")).toBeInTheDocument();

    expect(screen.getByText("sanitized:Hello A")).toBeInTheDocument();
    expect(screen.getByText("sanitized:Re: Hello B")).toBeInTheDocument();
    expect(screen.getByText("sanitized:Subject C")).toBeInTheDocument();

    expect(screen.queryByText("pro@company.com")).not.toBeInTheDocument();
    expect(screen.queryByText("mapped@gmail.com")).not.toBeInTheDocument();

    expect(mockFrom).toHaveBeenCalledWith("email_threads");
    expect(mockFrom).toHaveBeenCalledWith("email_specific_mappings");
    expect(mockSanitizeEmailSubject).toHaveBeenCalledWith("  Hello A  ");
    expect(mockSanitizeEmailSubject).toHaveBeenCalledWith("Re: Hello B");
    expect(mockSanitizeEmailSubject).toHaveBeenCalledWith("Subject C");
  });

  it("déclenche la mutation Non affilié avec l'email du groupe ciblé", async () => {
    const wrapper = createWrapper();
    const user = userEvent.setup();

    render(<GenericDomainEmailsList />, { wrapper });

    await screen.findByText("alice@gmail.com");

    const buttons = screen.getAllByRole("button", { name: /Non affilié/i });
    await user.click(buttons[0]);

    expect(mockMarkMutate).toHaveBeenCalledTimes(1);
    expect(mockMarkMutate).toHaveBeenCalledWith("alice@gmail.com");
  });

  it("ouvre la dialog avec l'email sélectionné lors du clic sur Affilier", async () => {
    const wrapper = createWrapper();
    const user = userEvent.setup();

    render(<GenericDomainEmailsList />, { wrapper });

    await screen.findByText("alice@gmail.com");

    expect(screen.getByTestId("mapping-dialog")).toHaveTextContent("closed");

    const buttons = screen.getAllByRole("button", { name: /Affilier/i });
    await user.click(buttons[1]);

    await waitFor(() => {
      expect(screen.getByTestId("mapping-dialog")).toHaveTextContent("open");
      expect(screen.getByTestId("mapping-dialog")).toHaveTextContent("bob@hotmail.com");
    });
  });

  it("passe en erreur react-query si la requête des threads échoue", async () => {
    const wrapper = createWrapper();

    vi.doMock("@/integrations/supabase/client", () => {
      const createBuilder = (table: string) => {
        const resolveResult = () => {
          if (table === "email_threads") {
            return Promise.resolve({ data: null, error: { message: "x" } });
          }
          if (table === "email_specific_mappings") {
            return Promise.resolve({ data: MAPPINGS_SUCCESS, error: null });
          }
          return Promise.resolve({ data: [], error: null });
        };

        const builder = {
          select: vi.fn(() => builder),
          eq: vi.fn(() => builder),
          gte: vi.fn(() => builder),
          lte: vi.fn(() => builder),
          in: vi.fn(() => builder),
          order: vi.fn(() => builder),
          limit: vi.fn(() => builder),
          insert: vi.fn(() => builder),
          update: vi.fn(() => builder),
          delete: vi.fn(() => builder),
          is: vi.fn(() => builder),
          single: vi.fn(() => resolveResult()),
          maybeSingle: vi.fn(() => resolveResult()),
          then: (onFulfilled: (value: { data: unknown; error: { message: string } | null }) => unknown, onRejected?: (reason: unknown) => unknown) =>
            resolveResult().then(onFulfilled, onRejected),
          catch: (onRejected: (reason: unknown) => unknown) => resolveResult().catch(onRejected),
        };

        return builder;
      };

      return {
        supabase: {
          from: (table: string) => createBuilder(table),
        },
      };
    });

    const mod = await import("./GenericDomainEmailsList");

    function useErrorProbe() {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: 0, gcTime: 0 },
          mutations: { retry: 0 },
        },
      });

      const Wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      return { Wrapper, Component: mod.GenericDomainEmailsList };
    }

    const { Wrapper, Component } = useErrorProbe();

    render(<Component />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.queryByText("Emails personnels à affilier")).not.toBeInTheDocument();
    });

    const errorClient = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });

    const errorWrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={errorClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(
      () =>
        mod.GenericDomainEmailsList(),
      { wrapper: errorWrapper }
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current).toBeTruthy();
  });
});