// @vitest-environment jsdom
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { useCatalogueStats } from "./useCatalogueStats";

const {
  RPC_ROWS,
  rpcMock,
} = vi.hoisted(() => ({
  RPC_ROWS: [
    {
      produit_id: "p1",
      nb_devis: 3,
      nb_factures: 2,
      ca_cumule_ht: 1250,
      derniere_utilisation: "2024-03-10",
    },
    {
      produit_id: "p2",
      nb_devis: 0,
      nb_factures: 1,
      ca_cumule_ht: 499.99,
      derniere_utilisation: null,
    },
  ],
  rpcMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: 0,
        gcTime: 0,
      },
      mutations: {
        retry: 0,
      },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("useCatalogueStats", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("expose un état de chargement puis retourne une Map de statistiques métier", async () => {
    rpcMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({ data: RPC_ROWS, error: null });
          }, 0);
        }),
    );

    const { result } = renderHook(() => useCatalogueStats(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(rpcMock).toHaveBeenCalledWith("get_catalogue_stats");

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeInstanceOf(Map);
    expect(result.current.data?.size).toBe(2);

    const p1 = result.current.data?.get("p1");
    const p2 = result.current.data?.get("p2");

    expect(p1).toEqual({
      produit_id: "p1",
      nb_devis: 3,
      nb_factures: 2,
      ca_cumule_ht: 1250,
      derniere_utilisation: "2024-03-10",
    });
    expect(p2).toEqual({
      produit_id: "p2",
      nb_devis: 0,
      nb_factures: 1,
      ca_cumule_ht: 499.99,
      derniere_utilisation: null,
    });
    expect(result.current.data?.has("inexistant")).toBe(false);
  });

  it("retourne une Map vide quand la rpc renvoie data null sans erreur", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useCatalogueStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(rpcMock).toHaveBeenCalledWith("get_catalogue_stats");
    expect(result.current.data).toBeInstanceOf(Map);
    expect(result.current.data?.size).toBe(0);
  });

  it("passe en erreur quand la rpc renvoie une erreur", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "x" },
    });

    const { result } = renderHook(() => useCatalogueStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(rpcMock).toHaveBeenCalledWith("get_catalogue_stats");
    expect(result.current.error).toEqual({ message: "x" });
    expect(result.current.data).toBeUndefined();
  });
});