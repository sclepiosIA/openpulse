import React, { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";

const { THREADS, mockFrom, setQueryResult, resetQueryResult } = vi.hoisted(() => {
  type ThreadRow = {
    id: string;
    subject: string;
    last_message_date: string;
    ai_generated_title: string | null;
    etablissement_id: string;
    is_deleted?: boolean;
  };

  const THREADS: ThreadRow[] = [
    {
      id: "t1",
      subject: "Dernier message E1",
      last_message_date: "2025-01-02T10:00:00.000Z",
      ai_generated_title: "Titre IA E1",
      etablissement_id: "e1",
      is_deleted: false,
    },
    {
      id: "t2",
      subject: "Ancien message E1",
      last_message_date: "2024-12-31T09:00:00.000Z",
      ai_generated_title: null,
      etablissement_id: "e1",
      is_deleted: false,
    },
    {
      id: "t3",
      subject: "Dernier message E2",
      last_message_date: "2025-01-01T08:00:00.000Z",
      ai_generated_title: null,
      etablissement_id: "e2",
      is_deleted: false,
    },
  ];

  type SupabaseError = { message: string };
  type QueryResult = { data: ThreadRow[] | null; error: SupabaseError | null };

  let currentResult: QueryResult = { data: THREADS, error: null };

  function setQueryResult(next: QueryResult) {
    currentResult = next;
  }
  function resetQueryResult() {
    currentResult = { data: THREADS, error: null };
  }

  function createThenable(getResult: () => QueryResult) {
    return {
      then(
        onFulfilled: (value: QueryResult) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) {
        try {
          return Promise.resolve(onFulfilled(getResult()));
        } catch (e) {
          if (onRejected) return Promise.resolve(onRejected(e));
          return Promise.reject(e);
        }
      },
      catch(onRejected: (reason: unknown) => unknown) {
        return Promise.resolve(getResult()).catch(onRejected);
      },
      finally(onFinally: () => unknown) {
        return Promise.resolve(getResult()).finally(onFinally);
      },
    };
  }

  function buildSupabaseFromMock() {
    const builder: Record<string, unknown> = {};
    const chain = () => builder;

    builder.select = vi.fn(chain);
    builder.eq = vi.fn(chain);
    builder.gte = vi.fn(chain);
    builder.lte = vi.fn(chain);
    builder.in = vi.fn(chain);
    builder.order = vi.fn(chain);
    builder.limit = vi.fn(chain);
    builder.insert = vi.fn(chain);
    builder.update = vi.fn(chain);
    builder.delete = vi.fn(chain);
    builder.single = vi.fn(async () => currentResult);
    builder.maybeSingle = vi.fn(async () => currentResult);

    const thenable = createThenable(() => currentResult);
    builder.then = thenable.then;
    builder.catch = thenable.catch;
    builder.finally = thenable.finally;

    return builder as unknown as {
      select: ReturnType<typeof vi.fn>;
      eq: ReturnType<typeof vi.fn>;
      gte: ReturnType<typeof vi.fn>;
      lte: ReturnType<typeof vi.fn>;
      in: ReturnType<typeof vi.fn>;
      order: ReturnType<typeof vi.fn>;
      limit: ReturnType<typeof vi.fn>;
      insert: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
      single: ReturnType<typeof vi.fn>;
      maybeSingle: ReturnType<typeof vi.fn>;
      then: (
        onFulfilled: (value: QueryResult) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => Promise<unknown>;
      catch: (onRejected: (reason: unknown) => unknown) => Promise<unknown>;
      finally: (onFinally: () => unknown) => Promise<unknown>;
    };
  }

  const mockFrom = vi.fn(() => buildSupabaseFromMock());

  return { THREADS, mockFrom, setQueryResult, resetQueryResult };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock("@/lib/queryPresets", () => ({
  queryPresets: {
    standard: {
      staleTime: 0,
      refetchOnWindowFocus: false,
    },
  },
}));

import { useLastEmailByEtablissement } from "./useLastEmailByEtablissement";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  function Wrapper(props: PropsWithChildren<Record<string, never>>) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      props.children,
    );
  }

  return Wrapper;
}

describe("useLastEmailByEtablissement", () => {
  it("passe par isLoading puis retourne la dernière thread par établissement", async () => {
    resetQueryResult();

    const Wrapper = createWrapper();
    const { result } = renderHook(
      () => useLastEmailByEtablissement(["e1", "e2"]),
      { wrapper: Wrapper },
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isFetching).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data = result.current.data;
    expect(data).toBeInstanceOf(Map);
    expect(data?.size).toBe(2);

    const e1 = data?.get("e1");
    const e2 = data?.get("e2");

    expect(e1).toMatchObject({
      id: "t1",
      subject: "Dernier message E1",
      last_message_date: "2025-01-02T10:00:00.000Z",
      ai_generated_title: "Titre IA E1",
      etablissement_id: "e1",
    });

    expect(e2).toMatchObject({
      id: "t3",
      subject: "Dernier message E2",
      last_message_date: "2025-01-01T08:00:00.000Z",
      ai_generated_title: null,
      etablissement_id: "e2",
    });

    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith("email_threads");

    const builder = mockFrom.mock.results[0]?.value as unknown as {
      select: ReturnType<typeof vi.fn>;
      in: ReturnType<typeof vi.fn>;
      eq: ReturnType<typeof vi.fn>;
      order: ReturnType<typeof vi.fn>;
    };

    expect(builder.select).toHaveBeenCalledWith(
      "id, subject, last_message_date, ai_generated_title, etablissement_id",
    );
    expect(builder.in).toHaveBeenCalledWith("etablissement_id", ["e1", "e2"]);
    expect(builder.eq).toHaveBeenCalledWith("is_deleted", false);
    expect(builder.order).toHaveBeenCalledWith("last_message_date", {
      ascending: false,
    });
  });

  it("met isError si supabase renvoie une erreur", async () => {
    setQueryResult({ data: null, error: { message: "boom" } });

    const Wrapper = createWrapper();
    const { result } = renderHook(() => useLastEmailByEtablissement(["e1"]), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    const err = result.current.error as unknown as { message?: string };
    expect(err.message).toBe("boom");
  });

  it("n'exécute pas la requête si la liste est vide (enabled=false) et retourne undefined", async () => {
    resetQueryResult();
    mockFrom.mockClear();

    const Wrapper = createWrapper();
    const { result } = renderHook(() => useLastEmailByEtablissement([]), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
    expect(mockFrom).toHaveBeenCalledTimes(0);
  });

  it("retourne une Map vide si la queryFn s'exécute avec une liste vide", async () => {
    resetQueryResult();
    mockFrom.mockClear();

    const Wrapper = createWrapper();
    const { result, rerender } = renderHook(
      ({ ids }: { ids: string[] }) => useLastEmailByEtablissement(ids),
      { wrapper: Wrapper, initialProps: { ids: [] } },
    );

    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
    expect(mockFrom).toHaveBeenCalledTimes(0);

    rerender({ ids: ["e1"] });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFrom).toHaveBeenCalledTimes(1);
  });
});