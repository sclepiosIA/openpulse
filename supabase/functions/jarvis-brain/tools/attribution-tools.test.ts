import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { executeGetAttributionAnalysis } from "./attribution-tools.ts";

function createContext(rpc: (name: string, params: Record<string, unknown>) => unknown) {
  return {
    userId: "user-test-1",
    supabase: {
      rpc,
    },
  } as any;
}

Deno.test("executeGetAttributionAnalysis uses time_decay by default and returns sorted top channels/users", async () => {
  const calls: Array<{ name: string; params: Record<string, unknown> }> = [];

  const ctx = createContext(async (name, params) => {
    calls.push({ name, params });
    return {
      data: {
        first_touch: "organic",
        last_touch: "email",
        by_channel: {
          paid: 0.25,
          organic: 0.4,
          email: 0.15,
          referral: 0.1,
          social: 0.07,
          direct: 0.03,
        },
        by_user: {
          user_1: 0.1,
          user_2: 0.5,
          user_3: 0.2,
          user_4: 0.05,
          user_5: 0.12,
          user_6: 0.03,
        },
      },
      error: null,
    };
  });

  const result = await executeGetAttributionAnalysis(ctx, {
    etablissement_id: "etab-123",
  });

  assertEquals(calls, [
    {
      name: "compute_attribution",
      params: {
        _etablissement_id: "etab-123",
        _model: "time_decay",
      },
    },
  ]);

  assertEquals(result.success, true);
  assertExists(result.execution_time_ms);
  assertEquals((result.data as any).etablissement_id, "etab-123");
  assertEquals((result.data as any).model, "time_decay");
  assertEquals((result.data as any).first_touch, "organic");
  assertEquals((result.data as any).last_touch, "email");

  assertEquals((result.data as any).top_channels, [
    { channel: "organic", weight: 0.4 },
    { channel: "paid", weight: 0.25 },
    { channel: "email", weight: 0.15 },
    { channel: "referral", weight: 0.1 },
    { channel: "social", weight: 0.07 },
  ]);

  assertEquals((result.data as any).top_users, [
    { user_id: "user_2", weight: 0.5 },
    { user_id: "user_3", weight: 0.2 },
    { user_id: "user_5", weight: 0.12 },
    { user_id: "user_1", weight: 0.1 },
    { user_id: "user_4", weight: 0.05 },
  ]);
});

Deno.test("executeGetAttributionAnalysis forwards explicit attribution model", async () => {
  let receivedName = "";
  let receivedParams: Record<string, unknown> | undefined;

  const ctx = createContext(async (name, params) => {
    receivedName = name;
    receivedParams = params;
    return {
      data: {
        first_touch: "ads",
        last_touch: "sales",
        by_channel: {
          ads: 1,
        },
        by_user: {
          closer: 1,
        },
      },
      error: null,
    };
  });

  const result = await executeGetAttributionAnalysis(ctx, {
    etablissement_id: "etab-linear",
    model: "linear",
  });

  assertEquals(receivedName, "compute_attribution");
  assertEquals(receivedParams, {
    _etablissement_id: "etab-linear",
    _model: "linear",
  });
  assertEquals(result.success, true);
  assertEquals((result.data as any).model, "linear");
  assertEquals((result.data as any).top_channels, [{ channel: "ads", weight: 1 }]);
  assertEquals((result.data as any).top_users, [{ user_id: "closer", weight: 1 }]);
});

Deno.test("executeGetAttributionAnalysis falls back to empty attribution maps when RPC returns null data", async () => {
  const ctx = createContext(async () => ({
    data: null,
    error: null,
  }));

  const result = await executeGetAttributionAnalysis(ctx, {
    etablissement_id: "etab-empty",
    model: "first_touch",
  });

  assertEquals(result.success, true);
  assertEquals((result.data as any).etablissement_id, "etab-empty");
  assertEquals((result.data as any).model, "first_touch");
  assertEquals((result.data as any).first_touch, undefined);
  assertEquals((result.data as any).last_touch, undefined);
  assertEquals((result.data as any).top_channels, []);
  assertEquals((result.data as any).top_users, []);
});

Deno.test("executeGetAttributionAnalysis handles missing by_channel and by_user fields", async () => {
  const ctx = createContext(async () => ({
    data: {
      first_touch: "webinar",
      last_touch: "demo",
    },
    error: null,
  }));

  const result = await executeGetAttributionAnalysis(ctx, {
    etablissement_id: "etab-partial",
    model: "last_touch",
  });

  assertEquals(result.success, true);
  assertEquals((result.data as any).first_touch, "webinar");
  assertEquals((result.data as any).last_touch, "demo");
  assertEquals((result.data as any).top_channels, []);
  assertEquals((result.data as any).top_users, []);
});

Deno.test("executeGetAttributionAnalysis returns validation error when etablissement_id is missing and does not call RPC", async () => {
  let rpcCalled = false;

  const ctx = createContext(async () => {
    rpcCalled = true;
    return { data: {}, error: null };
  });

  const result = await executeGetAttributionAnalysis(ctx, {
    etablissement_id: "",
    model: "time_decay",
  });

  assertEquals(rpcCalled, false);
  assertEquals(result.success, false);
  assertEquals(result.error, "etablissement_id requis");
  assertExists(result.execution_time_ms);
});

Deno.test("executeGetAttributionAnalysis returns Supabase RPC error message", async () => {
  const ctx = createContext(async () => ({
    data: null,
    error: new Error("RPC compute_attribution failed"),
  }));

  const result = await executeGetAttributionAnalysis(ctx, {
    etablissement_id: "etab-error",
    model: "time_decay",
  });

  assertEquals(result.success, false);
  assertEquals(result.error, "RPC compute_attribution failed");
  assertExists(result.execution_time_ms);
});

Deno.test("executeGetAttributionAnalysis returns generic error for non-Error thrown values", async () => {
  const ctx = createContext(async () => {
    throw "database unavailable";
  });

  const result = await executeGetAttributionAnalysis(ctx, {
    etablissement_id: "etab-throw-string",
  });

  assertEquals(result.success, false);
  assertEquals(result.error, "get_attribution_analysis failed");
  assertExists(result.execution_time_ms);
});

Deno.test("executeGetAttributionAnalysis awaits thenable RPC query objects", async () => {
  const ctx = createContext((name, params) => ({
    then(resolve: (value: unknown) => void) {
      resolve({
        data: {
          first_touch: params._model,
          last_touch: name,
          by_channel: { channel_a: 0.2, channel_b: 0.8 },
          by_user: { user_a: 0.6, user_b: 0.4 },
        },
        error: null,
      });
    },
  }));

  const result = await executeGetAttributionAnalysis(ctx, {
    etablissement_id: "etab-thenable",
    model: "time_decay",
  });

  assertEquals(result.success, true);
  assertEquals((result.data as any).first_touch, "time_decay");
  assertEquals((result.data as any).last_touch, "compute_attribution");
  assertEquals((result.data as any).top_channels, [
    { channel: "channel_b", weight: 0.8 },
    { channel: "channel_a", weight: 0.2 },
  ]);
  assertEquals((result.data as any).top_users, [
    { user_id: "user_a", weight: 0.6 },
    { user_id: "user_b", weight: 0.4 },
  ]);
});

Deno.test("assertion helpers are available in the Deno test environment", async () => {
  assertThrows(() => {
    throw new Error("expected sync failure");
  }, Error, "expected sync failure");

  await assertRejects(
    async () => {
      throw new Error("expected async failure");
    },
    Error,
    "expected async failure",
  );
});