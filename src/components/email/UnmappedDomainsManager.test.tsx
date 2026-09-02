import React from "react";
import { renderHook, render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { UnmappedDomainsManager } from "./UnmappedDomainsManager";

const {
  THREADS,
  ETABS,
  PARTS,
  RESULTS,
  addMappingMock,
  mockFrom,
  mockToastSuccess,
  mockToastError,
  debugError,
  invokeEdgeMock
} = vi.hoisted(() => {
  const THREADS = [
    { participants: [{ email: "a@example.com" }, { email: "b@example.com" }] },
    { participants: [{ email: "c@example.com" }] },
    { participants: [{ email: "d@other.org" }] },
    { participants: [{ email: "spam@gmail.com" }] }, // generic should be filtered
    { participants: [{ email: "bot@marque.ai" }] } // internal should be filtered
  ];

  const ETABS = [{ id: "e1", nom: "Etablissement 1" }];
  const PARTS = [{ id: "p1", nom: "Partenaire 1" }];

  // RESULTS object used by the mock builder to return per-table results; can be mutated in tests
  const RESULTS: Record<string, any> = {
    email_threads: { data: THREADS, error: null },
    etablissements: { data: ETABS, error: null },
    partenaires: { data: PARTS, error: null }
  };

  const addMappingMutate = vi.fn(async () => ({}));
  const addMappingMock = { mutateAsync: addMappingMutate };

  const mockToastSuccess = vi.fn();
  const mockToastError = vi.fn();
  const debugError = vi.fn();

  const invokeEdgeMock = vi.fn(async () => ({ matched: 0 }));

  // Create a chainable builder that is thenable and returns RESULTS[table] when awaited
  const createBuilder = (table: string) => {
    const builder: any = {};
    const chain = ["select", "is", "eq", "gte", "lte", "in", "order", "limit", "insert", "update", "delete", "or"];
    chain.forEach((fn) => {
      builder[fn] = (..._args: any[]) => builder;
    });
    builder.single = () => Promise.resolve(RESULTS[table] || { data: null, error: null });
    builder.maybeSingle = () => Promise.resolve(RESULTS[table] || { data: null, error: null });
    builder.then = (onFulfilled: any, onRejected: any) => {
      return Promise.resolve(RESULTS[table] || { data: null, error: null }).then(onFulfilled, onRejected);
    };
    builder.catch = (_cb: any) => builder;
    return builder;
  };

  const mockFrom = vi.fn((table: string) => createBuilder(table));

  return {
    THREADS,
    ETABS,
    PARTS,
    RESULTS,
    addMappingMock,
    mockFrom,
    mockToastSuccess,
    mockToastError,
    debugError,
    invokeEdgeMock
  };
});

// Mock supabase client
vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      from: mockFrom
    }
  };
});

// Mock debug
vi.mock("@/lib/debug", () => {
  return {
    debug: {
      error: debugError
    }
  };
});

// Mock sonner toast
vi.mock("sonner", () => {
  return {
    toast: {
      success: mockToastSuccess,
      error: mockToastError
    }
  };
});

// Mock edge functions
vi.mock("@/services/edgeFunctions", () => {
  return {
    invokeEdge: invokeEdgeMock
  };
});

// Mock email mapping hook
vi.mock("@/hooks/email/useEmailDomainMappings", () => {
  return {
    useAddDomainMapping: () => addMappingMock
  };
});

// Mock UI components as simple pass-throughs
vi.mock("@/components/ui/card", () => {
  return {
    Card: ({ children }: any) => React.createElement("div", null, children)
  };
});
vi.mock("@/components/ui/button", () => {
  return {
    Button: ({ children, onClick, disabled, variant, className, size }: any) =>
      React.createElement(
        "button",
        { onClick, disabled, "data-variant": variant, className, "data-size": size, type: "button" },
        children
      )
  };
});
vi.mock("@/components/ui/badge", () => {
  return {
    Badge: ({ children }: any) => React.createElement("span", null, children)
  };
});
vi.mock("@/components/ui/input", () => {
  return {
    Input: ({ value, onChange, placeholder, className }: any) =>
      React.createElement("input", { value, onChange, placeholder, className, "data-testid": "input" })
  };
});
vi.mock("@/components/ui/scroll-area", () => {
  return {
    ScrollArea: ({ children, className }: any) => React.createElement("div", { className }, children)
  };
});
vi.mock("@/components/ui/select", () => {
  return {
    Select: ({ children }: any) => React.createElement("div", null, children),
    SelectContent: ({ children }: any) => React.createElement("div", null, children),
    SelectItem: ({ children, value }: any) => React.createElement("div", { "data-value": value }, children),
    SelectTrigger: ({ children }: any) => React.createElement("div", null, children),
    SelectValue: ({ children, placeholder }: any) =>
      children ? React.createElement("span", null, children) : React.createElement("span", null, placeholder)
  };
});

// Mock lucide-react icons to simple spans
vi.mock("lucide-react", () => {
  const FakeIcon = ({ "data-icon": name }: any) => React.createElement("span", null, null);
  return {
    AlertCircle: FakeIcon,
    Plus: FakeIcon,
    Loader2: FakeIcon,
    Search: FakeIcon,
    TrendingUp: FakeIcon
  };
});

describe("UnmappedDomainsManager", () => {
  const createQueryClient = () =>
    new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } }
    });

  const Wrapper = ({ children }: any) => {
    return React.createElement(QueryClientProvider, { client: createQueryClient() }, children);
  };

  beforeEach(() => {
    // Reset mocks and ensure default RESULTS restored
    vi.clearAllMocks();
    // Reset RESULTS to initial stable values
    // @ts-ignore
    RESULTS.email_threads = { data: THREADS, error: null };
    // @ts-ignore
    RESULTS.etablissements = { data: ETABS, error: null };
    // @ts-ignore
    RESULTS.partenaires = { data: PARTS, error: null };
  });

  it("shows loading then displays domains and counts (success path)", async () => {
    // Render component inside QueryClientProvider via renderHook as required
    renderHook(
      () => {
        render(React.createElement(UnmappedDomainsManager));
        return {};
      },
      { wrapper: Wrapper }
    );

    // Initially should show loading indicator (state initial true)
    expect(screen.getByText("Chargement des domaines...")).toBeInTheDocument();

    // Wait for the component to finish loading and display results
    await waitFor(() => expect(screen.getByText("Domaines Non Mappés")).toBeInTheDocument());

    // Badge shows number of domains (we expect example.com and other.org -> 2 domaines)
    expect(screen.getByText("2 domaines")).toBeInTheDocument();

    // Domain entries should be present with correct thread counts
    expect(screen.getByText("example.com")).toBeInTheDocument();
    expect(screen.getByText("3 threads")).toBeInTheDocument();
    expect(screen.getByText("other.org")).toBeInTheDocument();
    expect(screen.getByText("1 threads")).toBeInTheDocument();

    // Sample emails line should contain examples from example.com
    const sampleLine = Array.from(screen.getAllByText((content) => content.includes("Exemples:")))[0];
    expect(sampleLine).toBeTruthy();
    expect(sampleLine.textContent).toContain("a@example.com");
    expect(sampleLine.textContent).toContain("b@example.com");
    expect(sampleLine.textContent).toContain("c@example.com");
  });

  it("handles supabase error when loading unmapped domains and shows toast error", async () => {
    // Simulate supabase returning an error for email_threads
    // @ts-ignore
    RESULTS.email_threads = { data: null, error: { message: "boom" } };

    renderHook(
      () => {
        render(React.createElement(UnmappedDomainsManager));
        return {};
      },
      { wrapper: Wrapper }
    );

    // Initially shows loading
    expect(screen.getByText("Chargement des domaines...")).toBeInTheDocument();

    // Wait for toast.error to be called due to loading error
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Erreur lors du chargement des domaines");
    });

    // The UI should have finished loading and show "Aucun domaine non mappé trouvé"
    await waitFor(() => expect(screen.getByText("Aucun domaine non mappé trouvé")).toBeInTheDocument());
  });

  it("creates an exclude mapping when clicking 'Créer le mapping' and calls mutateAsync with correct payload", async () => {
    // Ensure addMappingMock is reset
    addMappingMock.mutateAsync.mockReset();
    addMappingMock.mutateAsync.mockImplementation(async () => ({}));

    renderHook(
      () => {
        render(React.createElement(UnmappedDomainsManager));
        return {};
      },
      { wrapper: Wrapper }
    );

    // Wait for domains to load
    await waitFor(() => expect(screen.getByText("example.com")).toBeInTheDocument());

    // Select the domain by clicking its name (the parent div has the domain text)
    const domainElement = screen.getByText("example.com");
    fireEvent.click(domainElement);

    // Find the create mapping button and click it inside act
    const createButton = screen.getByText("Créer le mapping");
    await act(async () => {
      fireEvent.click(createButton);
    });

    // Expect the mutateAsync to have been called with exclude payload
    await waitFor(() =>
      expect(addMappingMock.mutateAsync).toHaveBeenCalledWith({
        domain: "example.com",
        isExcluded: true,
        confidenceLevel: "high"
      })
    );

    // And toast.success should have been called with the expected message
    expect(mockToastSuccess).toHaveBeenCalledWith("Domaine example.com exclu");
  });
});