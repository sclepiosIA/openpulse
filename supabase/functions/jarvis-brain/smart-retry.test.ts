import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { executeWithSmartRetry, getAllCircuitStates } from "./smart-retry.ts";

async function runWithImmediateTimers<T>(
  fn: (delays: number[]) => Promise<T>,
): Promise<{ result: T; delays: number[] }> {
  const delays: number[] = [];
  const originalSetTimeout = globalThis.setTimeout;
  const originalRandom = Math.random;
  const originalLog = console.log;

  (globalThis as any).setTimeout = (
    callback: (...args: unknown[]) => void,
    delay = 0,
    ...args: unknown[]
  ) => {
    delays.push(Number(delay));
    callback(...args);
    return 0;
  };
  Math.random = () => 0;
  console.log = () => {};

  try {
    const result = await fn(delays);
    return { result, delays };
  } finally {
    (globalThis as any).setTimeout = originalSetTimeout;
    Math.random = originalRandom;
    console.log = originalLog;
  }
}

Deno.test("module exports the smart retry public API", () => {
  assertExists(executeWithSmartRetry);
  assertExists(getAllCircuitStates);
  assertEquals(typeof executeWithSmartRetry, "function");
  assertEquals(typeof getAllCircuitStates, "function");
});

Deno.test("executeWithSmartRetry returns successful tool result without retry", async () => {
  const { result, delays } = await runWithImmediateTimers(async () => {
    let calls = 0;

    const result = await executeWithSmartRetry("unit_success_first_attempt", async () => {
      calls++;
      return {
        success: true,
        data: { message: "ok" },
        execution_time_ms: 12,
      };
    });

    assertEquals(calls, 1);
    return result;
  });

  assertEquals(result, {
    success: true,
    data: { message: "ok" },
    execution_time_ms: 12,
  });
  assertEquals(delays, []);
});

Deno.test("executeWithSmartRetry retries retryable result errors with default exponential backoff", async () => {
  const toolName = "unit_retry_then_success_default";

  const { result, delays } = await runWithImmediateTimers(async () => {
    let calls = 0;

    const result = await executeWithSmartRetry(toolName, async () => {
      calls++;
      if (calls === 1) {
        return {
          success: false,
          error: "timeout while contacting upstream service",
          execution_time_ms: 25,
        };
      }

      return {
        success: true,
        data: { attempt: calls },
        execution_time_ms: 31,
      };
    });

    assertEquals(calls, 2);
    return result;
  });

  assertEquals(result, {
    success: true,
    data: { attempt: 2 },
    execution_time_ms: 31,
  });
  assertEquals(delays, [500]);

  const states = getAllCircuitStates();
  assertEquals(states[toolName], { state: "closed", failures: 0 });
});

Deno.test("executeWithSmartRetry retries retryable exceptions and resolves on later success", async () => {
  const toolName = "unit_retry_exception_then_success";

  const { result, delays } = await runWithImmediateTimers(async () => {
    let calls = 0;

    const result = await executeWithSmartRetry(toolName, async () => {
      calls++;
      if (calls === 1) {
        throw new Error("fetch failed: socket hang up");
      }

      return {
        success: true,
        data: { recovered: true },
        execution_time_ms: 44,
      };
    });

    assertEquals(calls, 2);
    return result;
  });

  assertEquals(result, {
    success: true,
    data: { recovered: true },
    execution_time_ms: 44,
  });
  assertEquals(delays, [500]);

  const states = getAllCircuitStates();
  assertEquals(states[toolName], { state: "closed", failures: 0 });
});

Deno.test("executeWithSmartRetry does not retry non-retryable tool errors", async () => {
  const toolName = "unit_non_retryable_business_error";

  const { result, delays } = await runWithImmediateTimers(async () => {
    let calls = 0;

    const result = await executeWithSmartRetry(toolName, async () => {
      calls++;
      return {
        success: false,
        error: "invalid invoice payload",
        execution_time_ms: 18,
      };
    });

    assertEquals(calls, 1);
    return result;
  });

  assertEquals(result, {
    success: false,
    error: "invalid invoice payload",
    execution_time_ms: 18,
  });
  assertEquals(delays, []);

  const states = getAllCircuitStates();
  assertEquals(states[toolName], { state: "closed", failures: 1 });
});

Deno.test("executeWithSmartRetry converts non-retryable thrown errors to failed tool results", async () => {
  const toolName = "unit_non_retryable_exception";

  const { result, delays } = await runWithImmediateTimers(async () => {
    let calls = 0;

    const result = await executeWithSmartRetry(toolName, async () => {
      calls++;
      throw new Error("permission denied for this action");
    });

    assertEquals(calls, 1);
    return result;
  });

  assertEquals(result, {
    success: false,
    error: "permission denied for this action",
    execution_time_ms: 0,
  });
  assertEquals(delays, []);

  const states = getAllCircuitStates();
  assertEquals(states[toolName], { state: "closed", failures: 1 });
});

Deno.test("executeWithSmartRetry returns a clear failure after default retries are exhausted", async () => {
  const toolName = "unit_retry_exhausted_default";

  const { result, delays } = await runWithImmediateTimers(async () => {
    let calls = 0;

    const result = await executeWithSmartRetry(toolName, async () => {
      calls++;
      return {
        success: false,
        error: "timeout while calling upstream",
        execution_time_ms: 10,
      };
    });

    assertEquals(calls, 3);
    return result;
  });

  assertEquals(result, {
    success: false,
    error: `⚠️ L'outil "${toolName}" a échoué après 3 tentatives: timeout while calling upstream`,
    execution_time_ms: 0,
  });
  assertEquals(delays, [500, 1000]);

  const states = getAllCircuitStates();
  assertEquals(states[toolName], { state: "closed", failures: 1 });
});

Deno.test("executeWithSmartRetry applies send_email custom retry configuration", async () => {
  const toolName = "send_email";

  const { result, delays } = await runWithImmediateTimers(async () => {
    let calls = 0;

    const result = await executeWithSmartRetry(toolName, async () => {
      calls++;
      return {
        success: false,
        error: "503 service unavailable",
        execution_time_ms: 20,
      };
    });

    assertEquals(calls, 4);
    return result;
  });

  assertEquals(result, {
    success: false,
    error: `⚠️ L'outil "${toolName}" a échoué après 4 tentatives: 503 service unavailable`,
    execution_time_ms: 0,
  });
  assertEquals(delays, [1000, 2000, 4000]);

  const states = getAllCircuitStates();
  assertEquals(states[toolName], { state: "closed", failures: 1 });
});

Deno.test("executeWithSmartRetry applies no-retry configuration for sensitive delete_task operation", async () => {
  const toolName = "delete_task";

  const { result, delays } = await runWithImmediateTimers(async () => {
    let calls = 0;

    const result = await executeWithSmartRetry(toolName, async () => {
      calls++;
      return {
        success: false,
        error: "timeout while deleting task",
        execution_time_ms: 19,
      };
    });

    assertEquals(calls, 1);
    return result;
  });

  assertEquals(result, {
    success: false,
    error: `⚠️ L'outil "${toolName}" a échoué après 1 tentatives: timeout while deleting task`,
    execution_time_ms: 0,
  });
  assertEquals(delays, []);

  const states = getAllCircuitStates();
  assertEquals(states[toolName], { state: "closed", failures: 1 });
});

Deno.test("circuit breaker opens after three consecutive non-retryable failures and skips execution", async () => {
  const toolName = "unit_circuit_opens_after_three_failures";

  const { result } = await runWithImmediateTimers(async () => {
    let calls = 0;

    for (let i = 0; i < 3; i++) {
      const failure = await executeWithSmartRetry(toolName, async () => {
        calls++;
        return {
          success: false,
          error: "invalid request payload",
          execution_time_ms: 5,
        };
      });

      assertEquals(failure.success, false);
      assertEquals(failure.error, "invalid request payload");
    }

    assertEquals(calls, 3);

    const skipped = await executeWithSmartRetry(toolName, async () => {
      calls++;
      return {
        success: true,
        data: "should not run",
        execution_time_ms: 1,
      };
    });

    assertEquals(calls, 3);
    return skipped;
  });

  assertEquals(result, {
    success: false,
    error: `⚠️ L'outil "${toolName}" est temporairement indisponible (trop d'échecs récents). Réessayez dans quelques secondes.`,
    execution_time_ms: 0,
  });

  const states = getAllCircuitStates();
  assertEquals(states[toolName], { state: "open", failures: 3 });
});

Deno.test("circuit breaker transitions to half-open after reset timeout and closes on success", async () => {
  const toolName = "unit_circuit_half_open_then_closed";
  const originalNow = Date.now;
  let now = 1_700_000_000_000;

  Date.now = () => now;

  try {
    await runWithImmediateTimers(async () => {
      let calls = 0;

      for (let i = 0; i < 3; i++) {
        const failure = await executeWithSmartRetry(toolName, async () => {
          calls++;
          return {
            success: false,
            error: "invalid request payload",
            execution_time_ms: 7,
          };
        });

        assertEquals(failure.success, false);
      }

      assertEquals(calls, 3);
      assertEquals(getAllCircuitStates()[toolName], { state: "open", failures: 3 });

      const blocked = await executeWithSmartRetry(toolName, async () => {
        calls++;
        return {
          success: true,
          data: "blocked",
          execution_time_ms: 1,
        };
      });

      assertEquals(calls, 3);
      assertEquals(blocked, {
        success: false,
        error: `⚠️ L'outil "${toolName}" est temporairement indisponible (trop d'échecs récents). Réessayez dans quelques secondes.`,
        execution_time_ms: 0,
      });

      now += 30_000;

      const recovered = await executeWithSmartRetry(toolName, async () => {
        calls++;
        return {
          success: true,
          data: { status: "recovered" },
          execution_time_ms: 9,
        };
      });

      assertEquals(calls, 4);
      assertEquals(recovered, {
        success: true,
        data: { status: "recovered" },
        execution_time_ms: 9,
      });

      return recovered;
    });

    const states = getAllCircuitStates();
    assertEquals(states[toolName], { state: "closed", failures: 0 });
  } finally {
    Date.now = originalNow;
  }
});