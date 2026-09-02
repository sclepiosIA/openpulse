import { createElement, type ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEnqueteContext, useSubmitEnquete } from "./useEnquete";

type SupabaseQueryResult = {
  data: readonly { readonly id: string }[];
  error: null;
};

type ChainMethod = (...args: readonly unknown[]) => SupabaseBuilder;

type SupabaseBuilder = {
  select: ChainMethod;
  eq: ChainMethod;
  gte: ChainMethod;
  lte: ChainMethod;
  in: ChainMethod;
  order: ChainMethod;
  limit: ChainMethod;
  insert: ChainMethod;
  update: ChainMethod;
  delete: ChainMethod;
  upsert: ChainMethod;
  match: ChainMethod;
  single: () => Promise<SupabaseQueryResult>;
  maybeSingle: () => Promise<SupabaseQueryResult>;
  then: Promise<SupabaseQueryResult>["then"];
  catch: Promise<SupabaseQueryResult>["catch"];
};

type RpcResponse =
  | { data: unknown; error: null }
  | { data: null; error: { message: string } };

const {
  CONTEXT_TOKEN,
  SUBMIT_TOKEN,
  ENQUETE_TYPE,
  ENQUETE_CONTEXT,
  CONTEXT_RESPONSE,
  RPC_ERROR,
  RPC_ERROR_RESPONSE,
  SUBMIT_PAYLOAD,
  SUBMIT_RESULT,
  SUBMIT_RESPONSE,
  FAILED_SUBMIT_RESPONSE,
  mockFrom,
  mockRpc,
} = vi.hoisted(() => {
  const ROWS = Object.freeze([{ id: "row1" }] as const);
  const QUERY_RESULT = Object.freeze({ data: ROWS, error: null });

  let builder: SupabaseBuilder;

  const resolveQuery = () => Promise.resolve(QUERY_RESULT);

  builder = {
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
    upsert: vi.fn(() => builder),
    match: vi.fn(() => builder),
    single: vi.fn(resolveQuery),
    maybeSingle: vi.fn(resolveQuery),
    then: (onfulfilled, onrejected) => resolveQuery().then(onfulfilled, onrejected),
    catch: (onrejected) => resolveQuery().catch(onrejected),
  };

  const ENQUETE_CONTEXT = Object.freeze({
    success: true,
    type: "session",
    etablissement: Object.freeze({ id: "etab1", nom: "Clinique Nord" }),
    user: Object.freeze({ id: "u1", nom: "Alice Martin" }),
    csm: Object.freeze({ id: "csm1", nom: "CSM Ouest" }),
    session: Object.freeze({ id: "sess1", titre: "Accueil", date: "2024-05-10" }),
  });

  const RPC_ERROR = Object.freeze({ message: "rpc_failed" });

  const SUBMIT_PAYLOAD = Object.freeze({
    score: 5,
    commentaire: "clair",
  });

  const SUBMIT_RESULT = Object.freeze({
    success: true,
    id: "ans1",
  });

  return {
    CONTEXT_TOKEN: "tok",
    SUBMIT_TOKEN: "sub",
    ENQUETE_TYPE: "satisfaction",
    ENQUETE_CONTEXT,
    CONTEXT_RESPONSE: Object.freeze({ data: ENQUETE_CONTEXT, error: null }),
    RPC_ERROR,
    RPC_ERROR_RESPONSE: Object.freeze({ data: null, error: RPC_ERROR }),
    SUBMIT_PAYLOAD,
    SUBMIT_RESULT,
    SUBMIT_RESPONSE: Object.freeze({ data: SUBMIT_RESULT, error: null }),
    FAILED_SUBMIT_RESPONSE: Object.freeze({
      data: Object.freeze({ success: false, error: "submit_refused" }),
      error: null,
    }),
    mockFrom: vi.fn(() => builder),
    mockRpc: vi.fn(),
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("useEnquete", () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockFrom.mockClear();
  });

  describe("useEnqueteContext", () => {
    it("expose un état de chargement pendant la récupération du contexte", async () => {
      let resolveRpc: (value: RpcResponse) => void = () => undefined;
      const pendingRpc = new Promise<RpcResponse>((resolve) => {
        resolveRpc = resolve;
      });

      mockRpc.mockReturnValueOnce(pendingRpc);

      const rendered = renderHook(() => useEnqueteContext(CONTEXT_TOKEN), {
        wrapper: createWrapper(),
      });

      expect(rendered.result.current.isLoading).toBe(true);
      expect(rendered.result.current.data).toBeUndefined();

      await waitFor(() => {
        expect(mockRpc).toHaveBeenCalledWith("get_enquete_context", { p_token: CONTEXT_TOKEN });
      });

      await act(async () => {
        resolveRpc(CONTEXT_RESPONSE);
        await pendingRpc;
      });

      await waitFor(() => {
        expect(rendered.result.current.isSuccess).toBe(true);
      });

      rendered.unmount();
    });

    it("retourne les valeurs métier du contexte d'enquête en succès", async () => {
      mockRpc.mockResolvedValueOnce(CONTEXT_RESPONSE);

      const { result } = renderHook(() => useEnqueteContext(CONTEXT_TOKEN), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockRpc).toHaveBeenCalledTimes(1);
      expect(mockRpc).toHaveBeenCalledWith("get_enquete_context", { p_token: CONTEXT_TOKEN });
      expect(result.current.data).toEqual(ENQUETE_CONTEXT);
      expect(result.current.data?.success).toBe(true);
      expect(result.current.data?.type).toBe("session");
      expect(result.current.data?.etablissement).toEqual({ id: "etab1", nom: "Clinique Nord" });
      expect(result.current.data?.user).toEqual({ id: "u1", nom: "Alice Martin" });
      expect(result.current.data?.csm).toEqual({ id: "csm1", nom: "CSM Ouest" });
      expect(result.current.data?.session).toEqual({
        id: "sess1",
        titre: "Accueil",
        date: "2024-05-10",
      });
    });

    it("passe en erreur quand la RPC de contexte échoue", async () => {
      mockRpc.mockResolvedValueOnce(RPC_ERROR_RESPONSE);

      const { result } = renderHook(() => useEnqueteContext(CONTEXT_TOKEN), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(mockRpc).toHaveBeenCalledTimes(1);
      expect(mockRpc).toHaveBeenCalledWith("get_enquete_context", { p_token: CONTEXT_TOKEN });
      expect(result.current.error?.message).toBe(RPC_ERROR.message);
      expect(result.current.data).toBeUndefined();
    });

    it("ne lance pas de RPC quand le token est absent", () => {
      const { result } = renderHook(() => useEnqueteContext(undefined), {
        wrapper: createWrapper(),
      });

      expect(mockRpc).not.toHaveBeenCalled();
      expect(result.current.fetchStatus).toBe("idle");
      expect(result.current.data).toBeUndefined();
    });
  });

  describe("useSubmitEnquete", () => {
    it("soumet le payload avec le token et le type puis retourne le résultat", async () => {
      mockRpc.mockResolvedValueOnce(SUBMIT_RESPONSE);

      const { result } = renderHook(() => useSubmitEnquete(SUBMIT_TOKEN, ENQUETE_TYPE), {
        wrapper: createWrapper(),
      });

      let mutationResult: unknown;

      await act(async () => {
        mutationResult = await result.current.mutateAsync(SUBMIT_PAYLOAD);
      });

      expect(mockRpc).toHaveBeenCalledTimes(1);
      expect(mockRpc).toHaveBeenCalledWith("submit_enquete", {
        p_token: SUBMIT_TOKEN,
        p_type: ENQUETE_TYPE,
        p_payload: SUBMIT_PAYLOAD,
      });
      expect(mutationResult).toEqual(SUBMIT_RESULT);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(SUBMIT_RESULT);
      expect(result.current.error).toBeNull();
    });

    it("rejette la mutation quand la RPC de soumission échoue", async () => {
      mockRpc.mockResolvedValueOnce(RPC_ERROR_RESPONSE);

      const { result } = renderHook(() => useSubmitEnquete(SUBMIT_TOKEN, ENQUETE_TYPE), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await expect(result.current.mutateAsync(SUBMIT_PAYLOAD)).rejects.toEqual(RPC_ERROR);
      });

      expect(mockRpc).toHaveBeenCalledTimes(1);
      expect(mockRpc).toHaveBeenCalledWith("submit_enquete", {
        p_token: SUBMIT_TOKEN,
        p_type: ENQUETE_TYPE,
        p_payload: SUBMIT_PAYLOAD,
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toBe(RPC_ERROR.message);
      expect(result.current.data).toBeUndefined();
    });

    it("rejette la mutation quand la RPC retourne success false", async () => {
      mockRpc.mockResolvedValueOnce(FAILED_SUBMIT_RESPONSE);

      const { result } = renderHook(() => useSubmitEnquete(SUBMIT_TOKEN, ENQUETE_TYPE), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await expect(result.current.mutateAsync(SUBMIT_PAYLOAD)).rejects.toThrow("submit_refused");
      });

      expect(mockRpc).toHaveBeenCalledTimes(1);
      expect(mockRpc).toHaveBeenCalledWith("submit_enquete", {
        p_token: SUBMIT_TOKEN,
        p_type: ENQUETE_TYPE,
        p_payload: SUBMIT_PAYLOAD,
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toBe("submit_refused");
    });

    it("rejette la mutation sans appeler Supabase quand le token est absent", async () => {
      const { result } = renderHook(() => useSubmitEnquete(undefined, ENQUETE_TYPE), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await expect(result.current.mutateAsync(SUBMIT_PAYLOAD)).rejects.toThrow("token_invalide");
      });

      expect(mockRpc).not.toHaveBeenCalled();

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toBe("token_invalide");
      expect(result.current.data).toBeUndefined();
    });
  });
});