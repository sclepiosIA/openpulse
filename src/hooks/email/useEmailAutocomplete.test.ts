import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEmailAutocomplete } from "./useEmailAutocomplete";

const { CONTACTS, PROFILES, MESSAGES, mockFrom, debugMock, setReject } = vi.hoisted(() => {
  const CONTACTS = [
    { email: "c@c.com", prenom: "Carl", nom: "C", etablissement: { nom: "Etab C" } },
  ];
  const PROFILES = [
    { email: "a@p.com", prenom: "Alice", nom: "P" },
    { email: "b@p.com", prenom: "Bob", nom: "" },
  ];
  const MESSAGES = [
    { from_address: "d@h.com", from_name: "Dan" },
  ];

  let rejectMode = false;
  const setReject = (v: boolean) => {
    rejectMode = v;
  };

  const debugMock = { error: vi.fn() };

  const mockFrom = vi.fn((table: string) => {
    const builder: Record<string, unknown> = {
      table,
      select(..._args: unknown[]) {
        return builder;
      },
      not(..._args: unknown[]) {
        return builder;
      },
      ilike(..._args: unknown[]) {
        return builder;
      },
      limit(..._args: unknown[]) {
        return builder;
      },
      then(onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
        if (rejectMode) {
          return Promise.reject(new Error("supabase failure")).then(onFulfilled, onRejected);
        }
        const map: Record<string, unknown> = {
          contacts: CONTACTS,
          profiles: PROFILES,
          email_messages: MESSAGES,
        };
        const payload = { data: map[table as keyof typeof map] ?? null };
        return Promise.resolve(payload).then(onFulfilled, onRejected);
      },
      catch(onRejected?: (e: unknown) => unknown) {
        // forward to then's rejection
        return (this as any).then(undefined, onRejected);
      },
    };
    return builder;
  });

  return { CONTACTS, PROFILES, MESSAGES, mockFrom, debugMock, setReject };
});

vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      from: mockFrom,
    },
  };
});

vi.mock("@/lib/debug", () => {
  return {
    debug: debugMock,
  };
});

describe("useEmailAutocomplete", () => {
  const createClient = () =>
    new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });

  const wrapper = ({ children }: { children: React.ReactNode }) => {
    const client = createClient();
    return React.createElement(QueryClientProvider, { client }, children);
  };

  beforeEach(() => {
    setReject(false);
    mockFrom.mockClear();
    debugMock.error.mockClear();
    debugMock.error.mockImplementation(() => {});
  });

  it("is loading initially and returns sorted suggestions on success", async () => {
    setReject(false);
    debugMock.error.mockImplementation(() => {});

    const { result } = renderHook(() => useEmailAutocomplete("te"), { wrapper });

    // Immediately after mount, the query should be loading
    expect(result.current.isLoading).toBe(true);

    // Wait for the query to finish
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Ensure supabase.from was called for each table
    expect(mockFrom).toHaveBeenCalledWith("contacts");
    expect(mockFrom).toHaveBeenCalledWith("profiles");
    expect(mockFrom).toHaveBeenCalledWith("email_messages");

    // Expected suggestions: profiles first, then contacts, then history
    const expected = [
      {
        email: "a@p.com",
        name: "Alice P",
        source: "profile",
      },
      {
        email: "b@p.com",
        name: "Bob",
        source: "profile",
      },
      {
        email: "c@c.com",
        name: "Carl C",
        source: "contact",
        etablissement: "Etab C",
      },
      {
        email: "d@h.com",
        name: "Dan",
        source: "history",
      },
    ];

    expect(result.current.data).toEqual(expected);
    expect(result.current.isError).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("goes into error state when supabase fails and debug.error throws", async () => {
    setReject(true);
    debugMock.error.mockImplementation(() => {
      throw new Error("debug failure");
    });

    const { result } = renderHook(() => useEmailAutocomplete("te"), { wrapper });

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    // Wait for an error state
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(debugMock.error).toHaveBeenCalled();
  });

  it("does not run the query when searchQuery length < 2 (disabled)", async () => {
    const { result } = renderHook(() => useEmailAutocomplete("a"), { wrapper });

    // Query should be idle/disabled and not loading
    expect(result.current.isLoading).toBe(false);
    // When disabled the data should be undefined
    expect(result.current.data).toBeUndefined();
    // supabase should not have been called
    expect(mockFrom).not.toHaveBeenCalled();
  });
});