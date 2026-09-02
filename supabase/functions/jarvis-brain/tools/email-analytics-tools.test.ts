import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { executeAnalyzeSenderEmails } from "./email-analytics-tools.ts";

Deno.test("module exports executeAnalyzeSenderEmails", () => {
  assertExists(executeAnalyzeSenderEmails);
  assertEquals(typeof executeAnalyzeSenderEmails, "function");
});

Deno.test("executeAnalyzeSenderEmails rejects empty or too short sender patterns without calling RPC", async () => {
  let rpcCallCount = 0;
  const ctx = {
    userId: "user-123",
    supabase: {
      rpc: () => {
        rpcCallCount++;
        return Promise.resolve({ data: null, error: null });
      },
    },
  };

  const emptyResult = await executeAnalyzeSenderEmails(ctx as never, { sender_pattern: "" });
  assertEquals(emptyResult.success, false);
  assertEquals(emptyResult.error, "Le pattern de recherche doit contenir au moins 2 caractères");
  assertEquals(rpcCallCount, 0);
  assertEquals(typeof emptyResult.execution_time_ms, "number");

  const shortTrimmedResult = await executeAnalyzeSenderEmails(ctx as never, { sender_pattern: " a " });
  assertEquals(shortTrimmedResult.success, false);
  assertEquals(shortTrimmedResult.error, "Le pattern de recherche doit contenir au moins 2 caractères");
  assertEquals(rpcCallCount, 0);
  assertEquals(typeof shortTrimmedResult.execution_time_ms, "number");
});

Deno.test("executeAnalyzeSenderEmails calls the expected RPC with trimmed pattern and enriches day labels", async () => {
  const rpcCalls: Array<{ name: string; params: Record<string, unknown> }> = [];

  const ctx = {
    userId: "profile-456",
    supabase: {
      rpc: async (name: string, params: Record<string, unknown>) => {
        rpcCalls.push({ name, params });
        return {
          data: {
            total: 3,
            sender_pattern: params.p_sender_pattern,
            day_of_week_distribution: [
              { dow: 1, count: 2 },
              { dow: 6, count: 1 },
              { dow: 9, count: 4 },
            ],
            hourly_distribution: [
              { hour: 8, count: 1 },
              { hour: 18, count: 2 },
            ],
            out_of_hours_count: 2,
            amplitude_hours: 10,
          },
          error: null,
        };
      },
    },
  };

  const result = await executeAnalyzeSenderEmails(ctx as never, {
    sender_pattern: "  alice@example.com  ",
  });

  assertEquals(rpcCalls.length, 1);
  assertEquals(rpcCalls[0].name, "jarvis_analyze_sender_emails");
  assertEquals(rpcCalls[0].params, {
    p_sender_pattern: "alice@example.com",
    p_profile_id: "profile-456",
  });

  assertEquals(result.success, true);
  assertExists(result.data);
  assertEquals(result.data.message, 'Analyse de 3 emails correspondant à "  alice@example.com  "');
  assertEquals(result.data.total, 3);
  assertEquals(result.data.sender_pattern, "alice@example.com");
  assertEquals(result.data.out_of_hours_count, 2);
  assertEquals(result.data.amplitude_hours, 10);
  assertEquals(result.data.day_of_week_distribution, [
    { dow: 1, count: 2, label: "Lundi" },
    { dow: 6, count: 1, label: "Samedi" },
    { dow: 9, count: 4, label: "Jour 9" },
  ]);
  assertEquals(typeof result.execution_time_ms, "number");
});

Deno.test("executeAnalyzeSenderEmails uses total 0 in message when RPC data has no total", async () => {
  const ctx = {
    userId: "profile-no-total",
    supabase: {
      rpc: async () => ({
        data: {
          day_of_week_distribution: [{ dow: 0, count: 5 }],
        },
        error: null,
      }),
    },
  };

  const result = await executeAnalyzeSenderEmails(ctx as never, {
    sender_pattern: "newsletter",
  });

  assertEquals(result.success, true);
  assertExists(result.data);
  assertEquals(result.data.message, 'Analyse de 0 emails correspondant à "newsletter"');
  assertEquals(result.data.day_of_week_distribution, [
    { dow: 0, count: 5, label: "Dimanche" },
  ]);
});

Deno.test("executeAnalyzeSenderEmails returns a formatted error when Supabase RPC returns an error", async () => {
  const ctx = {
    userId: "profile-789",
    supabase: {
      rpc: async () => ({
        data: null,
        error: { message: "database unavailable" },
      }),
    },
  };

  const result = await executeAnalyzeSenderEmails(ctx as never, {
    sender_pattern: "bob",
  });

  assertEquals(result.success, false);
  assertEquals(result.error, "Erreur lors de l'analyse: database unavailable");
  assertEquals(typeof result.execution_time_ms, "number");
});

Deno.test("executeAnalyzeSenderEmails returns the business error contained in RPC data", async () => {
  const ctx = {
    userId: "profile-business-error",
    supabase: {
      rpc: async () => ({
        data: { error: "Aucun email trouvé pour cet expéditeur" },
        error: null,
      }),
    },
  };

  const result = await executeAnalyzeSenderEmails(ctx as never, {
    sender_pattern: "unknown",
  });

  assertEquals(result.success, false);
  assertEquals(result.error, "Aucun email trouvé pour cet expéditeur");
  assertEquals(typeof result.execution_time_ms, "number");
});

Deno.test("executeAnalyzeSenderEmails catches thrown Error instances from RPC", async () => {
  const ctx = {
    userId: "profile-exception",
    supabase: {
      rpc: async () => {
        throw new Error("RPC exploded");
      },
    },
  };

  const result = await executeAnalyzeSenderEmails(ctx as never, {
    sender_pattern: "charlie",
  });

  assertEquals(result.success, false);
  assertEquals(result.error, "RPC exploded");
  assertEquals(typeof result.execution_time_ms, "number");
});

Deno.test("executeAnalyzeSenderEmails catches non-Error thrown values from RPC", async () => {
  const ctx = {
    userId: "profile-string-exception",
    supabase: {
      rpc: async () => {
        throw "raw failure";
      },
    },
  };

  const result = await executeAnalyzeSenderEmails(ctx as never, {
    sender_pattern: "david",
  });

  assertEquals(result.success, false);
  assertEquals(result.error, "Erreur inconnue");
  assertEquals(typeof result.execution_time_ms, "number");
});