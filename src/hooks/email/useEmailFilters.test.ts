import React, { PropsWithChildren } from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EmailFiltersContext } from "@/contexts/EmailFiltersContext";
import { useEmailFilters } from "./useEmailFilters";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

describe("useEmailFilters", () => {
  it("initialise avec les filtres par défaut sans contexte global", async () => {
    const client = createQueryClient();

    const wrapper = ({ children }: PropsWithChildren) => {
      return React.createElement(QueryClientProvider, { client }, children as React.ReactNode);
    };

    const { result } = renderHook(() => useEmailFilters(false), { wrapper });

    expect(result.current.filters).toEqual({
      search: "",
      category: null,
      priority: null,
      unreadOnly: false,
      unprocessedOnly: false,
      dateFrom: null,
      dateTo: null,
      etablissementId: null,
      groupeId: null,
      partenaireId: null,
      mailbox: "inbox",
    });

    await act(async () => {
      result.current.updateFilter("search", "facture");
    });
    expect(result.current.filters.search).toBe("facture");
    expect(result.current.filters.mailbox).toBe("inbox");

    await act(async () => {
      result.current.updateFilter("unreadOnly", true);
    });
    expect(result.current.filters.unreadOnly).toBe(true);

    await act(async () => {
      result.current.resetFilters();
    });
    expect(result.current.filters).toEqual({
      search: "",
      category: null,
      priority: null,
      unreadOnly: false,
      unprocessedOnly: false,
      dateFrom: null,
      dateTo: null,
      etablissementId: null,
      groupeId: null,
      partenaireId: null,
      mailbox: "inbox",
    });
  });

  it("consomme et synchronise le contexte global quand activé + propage update/reset", async () => {
    const client = createQueryClient();

    const globalFilters = {
      search: "abc",
      category: "devis",
      priority: "high",
      unreadOnly: true,
      unprocessedOnly: false,
      dateFrom: new Date("2024-01-02T00:00:00.000Z"),
      dateTo: new Date("2024-02-03T00:00:00.000Z"),
      etablissementId: "et1",
      groupeId: "gr1",
      partenaireId: "pa1",
      mailbox: "sent" as const,
    };

    const updateGlobalFilter = vi.fn();
    const resetGlobalFilters = vi.fn();

    const wrapper = ({ children }: PropsWithChildren) => {
      return React.createElement(
        QueryClientProvider,
        { client },
        React.createElement(
          EmailFiltersContext.Provider,
          {
            value: {
              globalFilters,
              updateGlobalFilter,
              resetGlobalFilters,
            },
          },
          children as React.ReactNode
        )
      );
    };

    const { result } = renderHook(() => useEmailFilters(true), { wrapper });

    expect(result.current.filters).toEqual(globalFilters);

    await act(async () => {
      result.current.updateFilter("mailbox", "trash");
    });
    expect(result.current.filters.mailbox).toBe("trash");
    expect(updateGlobalFilter).toHaveBeenCalledTimes(1);
    expect(updateGlobalFilter).toHaveBeenCalledWith("mailbox", "trash");

    await act(async () => {
      result.current.updateFilter("priority", null);
    });
    expect(result.current.filters.priority).toBeNull();
    expect(updateGlobalFilter).toHaveBeenCalledTimes(2);
    expect(updateGlobalFilter).toHaveBeenLastCalledWith("priority", null);

    await act(async () => {
      result.current.resetFilters();
    });
    expect(result.current.filters).toEqual({
      search: "",
      category: null,
      priority: null,
      unreadOnly: false,
      unprocessedOnly: false,
      dateFrom: null,
      dateTo: null,
      etablissementId: null,
      groupeId: null,
      partenaireId: null,
      mailbox: "inbox",
    });
    expect(resetGlobalFilters).toHaveBeenCalledTimes(1);
  });

  it("met à jour silencieusement les filtres quand globalFilters change (sync useEffect)", async () => {
    const client = createQueryClient();

    const updateGlobalFilter = vi.fn();
    const resetGlobalFilters = vi.fn();

    const initialGlobalFilters = {
      search: "init",
      category: null,
      priority: null,
      unreadOnly: false,
      unprocessedOnly: false,
      dateFrom: null,
      dateTo: null,
      etablissementId: null,
      groupeId: null,
      partenaireId: null,
      mailbox: "inbox" as const,
    };

    const nextGlobalFilters = {
      ...initialGlobalFilters,
      search: "apres",
      unreadOnly: true,
      mailbox: "sent" as const,
    };

    const contextRef: { current: typeof initialGlobalFilters } = { current: initialGlobalFilters };

    const wrapper = ({ children }: PropsWithChildren) => {
      return React.createElement(
        QueryClientProvider,
        { client },
        React.createElement(
          EmailFiltersContext.Provider,
          {
            value: {
              get globalFilters() {
                return contextRef.current;
              },
              updateGlobalFilter,
              resetGlobalFilters,
            },
          } as unknown as React.ContextType<typeof EmailFiltersContext>,
          children as React.ReactNode
        )
      );
    };

    const { result, rerender } = renderHook(() => useEmailFilters(true), { wrapper });

    expect(result.current.filters.search).toBe("init");
    expect(result.current.filters.mailbox).toBe("inbox");

    contextRef.current = nextGlobalFilters;
    rerender();

    await waitFor(() => {
      expect(result.current.filters).toEqual(nextGlobalFilters);
    });
  });

  it("ne casse pas si le contexte est absent malgré useGlobalContext=true", async () => {
    const client = createQueryClient();

    const wrapper = ({ children }: PropsWithChildren) => {
      return React.createElement(QueryClientProvider, { client }, children as React.ReactNode);
    };

    const { result } = renderHook(() => useEmailFilters(true), { wrapper });

    expect(result.current.filters.mailbox).toBe("inbox");

    await act(async () => {
      result.current.updateFilter("search", "x");
    });
    expect(result.current.filters.search).toBe("x");

    await act(async () => {
      result.current.resetFilters();
    });
    expect(result.current.filters.search).toBe("");
    expect(result.current.filters.mailbox).toBe("inbox");
  });
});