import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  canExecute,
  executeWithCircuitBreaker,
  getAllCircuitStates,
  getCircuit,
  getOverallHealth,
  recordFailure,
  recordSuccess,
  resetCircuit,
} from "./circuit-breaker.ts";

const TEST_PREFIX = `circuit-breaker-test-${Date.now()}-${Math.random()}`;
let sequence = 0;

function uniqueName(kind = "external-api"): string {
  sequence++;
  return `${kind}-${TEST_PREFIX}-${sequence}`;
}

Deno.test("getCircuit crée un circuit CLOSED avec les valeurs par défaut external-api et la configuration custom", () => {
  const name = uniqueName("external-api");

  try {
    const circuit = getCircuit(name, {
      failureThreshold: 7,
      windowSize: 9,
      cooldownMs: 1234,
      successThreshold: 3,
    });

    assertEquals(circuit.state, "CLOSED");
    assertEquals(circuit.config.name, name);
    assertEquals(circuit.config.failureThreshold, 7);
    assertEquals(circuit.config.failureRateThreshold, 0.3);
    assertEquals(circuit.config.windowSize, 9);
    assertEquals(circuit.config.cooldownMs, 1234);
    assertEquals(circuit.config.successThreshold, 3);
    assertEquals(circuit.metrics.totalRequests, 0);
    assertEquals(circuit.metrics.successCount, 0);
    assertEquals(circuit.metrics.failureCount, 0);
    assertEquals(circuit.metrics.consecutiveFailures, 0);
    assertEquals(circuit.metrics.consecutiveSuccesses, 0);
    assertEquals(circuit.metrics.lastFailureTime, null);
    assertEquals(circuit.metrics.lastSuccessTime, null);
    assertEquals(circuit.metrics.avgLatencyMs, 0);
    assertEquals(circuit.metrics.p95LatencyMs, 0);
    assertExists(circuit.metrics.stateChangedAt);
  } finally {
    resetCircuit(name);
  }
});

Deno.test("getCircuit applique les profils par défaut azure-gpt52 et tool-*", () => {
  const toolName = uniqueName("tool-worker");

  try {
    const azure = getCircuit("azure-gpt52");
    const tool = getCircuit(toolName);

    assertEquals(azure.config.failureThreshold, 3);
    assertEquals(azure.config.cooldownMs, 20000);
    assertEquals(azure.config.failureRateThreshold, 0.4);
    assertEquals(azure.config.windowSize, 20);
    assertEquals(azure.config.successThreshold, 2);

    assertEquals(tool.config.failureThreshold, 5);
    assertEquals(tool.config.cooldownMs, 15000);
    assertEquals(tool.config.failureRateThreshold, 0.6);
    assertEquals(tool.config.windowSize, 20);
    assertEquals(tool.config.successThreshold, 2);
  } finally {
    resetCircuit("azure-gpt52");
    resetCircuit(toolName);
  }
});

Deno.test("recordSuccess met à jour les compteurs de succès et les métriques de latence", () => {
  const name = uniqueName("success-metrics");

  try {
    getCircuit(name);
    recordSuccess(name, 100);
    recordSuccess(name, 300);
    recordSuccess(name, 200);

    const circuit = getCircuit(name);

    assertEquals(circuit.state, "CLOSED");
    assertEquals(circuit.metrics.totalRequests, 3);
    assertEquals(circuit.metrics.successCount, 3);
    assertEquals(circuit.metrics.failureCount, 0);
    assertEquals(circuit.metrics.consecutiveFailures, 0);
    assertEquals(circuit.metrics.consecutiveSuccesses, 3);
    assertExists(circuit.metrics.lastSuccessTime);
    assertEquals(circuit.metrics.lastFailureTime, null);
    assertEquals(circuit.metrics.avgLatencyMs, 200);
    assertEquals(circuit.metrics.p95LatencyMs, 300);
    assertEquals(circuit.recentLatencies, [100, 300, 200]);
  } finally {
    resetCircuit(name);
  }
});

Deno.test("recordFailure ouvre le circuit après le seuil d'échecs consécutifs", () => {
  const name = uniqueName("consecutive-failures");

  try {
    getCircuit(name, {
      failureThreshold: 2,
      failureRateThreshold: 1,
      windowSize: 100,
      cooldownMs: 60_000,
    });

    assertEquals(canExecute(name), { allowed: true, state: "CLOSED" });

    recordFailure(name, 50, "first failure");
    assertEquals(getCircuit(name).state, "CLOSED");
    assertEquals(canExecute(name), { allowed: true, state: "CLOSED" });

    recordFailure(name, 75, "second failure");

    const circuit = getCircuit(name);
    const check = canExecute(name);

    assertEquals(circuit.state, "OPEN");
    assertEquals(circuit.metrics.totalRequests, 2);
    assertEquals(circuit.metrics.failureCount, 2);
    assertEquals(circuit.metrics.consecutiveFailures, 2);
    assertEquals(circuit.metrics.consecutiveSuccesses, 0);
    assertExists(circuit.metrics.lastFailureTime);
    assertEquals(check.allowed, false);
    assertEquals(check.state, "OPEN");
    assertExists(check.reason);
  } finally {
    resetCircuit(name);
  }
});

Deno.test("le taux d'échec ouvre le circuit quand la fenêtre minimale est atteinte", () => {
  const name = uniqueName("failure-rate");

  try {
    getCircuit(name, {
      failureThreshold: 10,
      failureRateThreshold: 0.5,
      windowSize: 4,
      cooldownMs: 60_000,
    });

    recordSuccess(name, 10);
    recordFailure(name, 20, "failure 1");
    recordSuccess(name, 30);

    assertEquals(getCircuit(name).state, "CLOSED");

    recordFailure(name, 40, "failure 2");

    const circuit = getCircuit(name);

    assertEquals(circuit.state, "OPEN");
    assertEquals(circuit.metrics.totalRequests, 4);
    assertEquals(circuit.metrics.successCount, 2);
    assertEquals(circuit.metrics.failureCount, 2);
    assertEquals(circuit.metrics.consecutiveFailures, 1);
    assertEquals(circuit.metrics.avgLatencyMs, 25);
    assertEquals(circuit.metrics.p95LatencyMs, 40);
  } finally {
    resetCircuit(name);
  }
});

Deno.test("canExecute passe de OPEN à HALF-OPEN après le cooldown puis referme après le seuil de succès", () => {
  const name = uniqueName("half-open-recovery");

  try {
    const circuit = getCircuit(name, {
      failureThreshold: 1,
      cooldownMs: 100,
      successThreshold: 2,
      failureRateThreshold: 1,
      windowSize: 100,
    });

    recordFailure(name, 25, "temporary outage");
    assertEquals(circuit.state, "OPEN");

    const blocked = canExecute(name);
    assertEquals(blocked.allowed, false);
    assertEquals(blocked.state, "OPEN");
    assertExists(blocked.reason);

    circuit.metrics.stateChangedAt = Date.now() - 101;

    const allowedAfterCooldown = canExecute(name);
    assertEquals(allowedAfterCooldown.allowed, true);
    assertEquals(allowedAfterCooldown.state, "HALF-OPEN");
    assertEquals(circuit.state, "HALF-OPEN");
    assertEquals(circuit.metrics.consecutiveSuccesses, 0);

    recordSuccess(name, 12);
    assertEquals(circuit.state, "HALF-OPEN");
    assertEquals(circuit.metrics.consecutiveSuccesses, 1);

    recordSuccess(name, 18);
    assertEquals(circuit.state, "CLOSED");
    assertEquals(circuit.metrics.totalRequests, 0);
    assertEquals(circuit.metrics.failureCount, 0);
    assertEquals(circuit.metrics.consecutiveFailures, 0);
    assertEquals(circuit.metrics.consecutiveSuccesses, 2);
  } finally {
    resetCircuit(name);
  }
});

Deno.test("un échec en HALF-OPEN repasse immédiatement le circuit en OPEN", () => {
  const name = uniqueName("half-open-failure");

  try {
    const circuit = getCircuit(name, {
      failureThreshold: 1,
      cooldownMs: 50,
      successThreshold: 2,
      failureRateThreshold: 1,
      windowSize: 100,
    });

    recordFailure(name, 10, "initial failure");
    assertEquals(circuit.state, "OPEN");

    circuit.metrics.stateChangedAt = Date.now() - 51;
    assertEquals(canExecute(name).state, "HALF-OPEN");
    assertEquals(circuit.state, "HALF-OPEN");

    recordFailure(name, 15, "probe failed");

    assertEquals(circuit.state, "OPEN");
    assertEquals(circuit.metrics.totalRequests, 2);
    assertEquals(circuit.metrics.failureCount, 2);
    assertEquals(circuit.metrics.consecutiveFailures, 2);
    assertEquals(circuit.metrics.consecutiveSuccesses, 0);
  } finally {
    resetCircuit(name);
  }
});

Deno.test("resetCircuit remet le circuit en CLOSED et nettoie compteurs et latences", () => {
  const name = uniqueName("manual-reset");

  getCircuit(name, {
    failureThreshold: 1,
    cooldownMs: 60_000,
  });

  recordSuccess(name, 100);
  recordFailure(name, 250, "reset me");

  assertEquals(getCircuit(name).state, "OPEN");
  assertEquals(getCircuit(name).recentLatencies, [100, 250]);

  resetCircuit(name);

  const circuit = getCircuit(name);

  assertEquals(circuit.state, "CLOSED");
  assertEquals(circuit.metrics.totalRequests, 0);
  assertEquals(circuit.metrics.successCount, 0);
  assertEquals(circuit.metrics.failureCount, 0);
  assertEquals(circuit.metrics.consecutiveFailures, 0);
  assertEquals(circuit.metrics.consecutiveSuccesses, 0);
  assertEquals(circuit.recentLatencies, []);
  assertEquals(canExecute(name), { allowed: true, state: "CLOSED" });
});

Deno.test("getAllCircuitStates retourne une copie des métriques sans exposer l'état mutable interne", () => {
  const name = uniqueName("states-copy");

  try {
    getCircuit(name);
    recordSuccess(name, 42);

    const firstSnapshot = getAllCircuitStates();

    assertExists(firstSnapshot[name]);
    assertEquals(firstSnapshot[name].state, "CLOSED");
    assertEquals(firstSnapshot[name].metrics.totalRequests, 1);
    assertEquals(firstSnapshot[name].metrics.successCount, 1);

    firstSnapshot[name].metrics.totalRequests = 999;
    firstSnapshot[name].metrics.successCount = 999;

    const secondSnapshot = getAllCircuitStates();

    assertEquals(secondSnapshot[name].metrics.totalRequests, 1);
    assertEquals(secondSnapshot[name].metrics.successCount, 1);
    assertEquals(getCircuit(name).metrics.totalRequests, 1);
    assertEquals(getCircuit(name).metrics.successCount, 1);
  } finally {
    resetCircuit(name);
  }
});

Deno.test("getOverallHealth retourne OFFLINE lorsque les deux circuits Azure critiques sont OPEN", () => {
  try {
    const gpt52 = getCircuit("azure-gpt52");
    const gpt5 = getCircuit("azure-gpt5");

    resetCircuit("azure-gpt52");
    resetCircuit("azure-gpt5");

    for (let i = 0; i < gpt52.config.failureThreshold; i++) {
      recordFailure("azure-gpt52", 100 + i, `azure-gpt52 failure ${i + 1}`);
    }

    for (let i = 0; i < gpt5.config.failureThreshold; i++) {
      recordFailure("azure-gpt5", 200 + i, `azure-gpt5 failure ${i + 1}`);
    }

    assertEquals(getCircuit("azure-gpt52").state, "OPEN");
    assertEquals(getCircuit("azure-gpt5").state, "OPEN");
    assertEquals(getOverallHealth(), "OFFLINE");
  } finally {
    resetCircuit("azure-gpt52");
    resetCircuit("azure-gpt5");
  }
});

Deno.test("executeWithCircuitBreaker retourne les données et enregistre un succès", async () => {
  const name = uniqueName("execute-success");

  try {
    const result = await executeWithCircuitBreaker(
      name,
      async () => ({ answer: 42, label: "ok" }),
      {
        failureThreshold: 1,
        cooldownMs: 60_000,
      },
    );

    assertEquals(result.success, true);
    if (result.success) {
      assertEquals(result.data, { answer: 42, label: "ok" });
    }

    const circuit = getCircuit(name);
    assertEquals(circuit.state, "CLOSED");
    assertEquals(circuit.metrics.totalRequests, 1);
    assertEquals(circuit.metrics.successCount, 1);
    assertEquals(circuit.metrics.failureCount, 0);
    assertEquals(circuit.metrics.consecutiveSuccesses, 1);
  } finally {
    resetCircuit(name);
  }
});

Deno.test("executeWithCircuitBreaker capture l'erreur, ouvre le circuit puis fast-fail sans appeler la fonction", async () => {
  const name = uniqueName("execute-failure");

  try {
    const first = await executeWithCircuitBreaker(
      name,
      async () => {
        throw new Error("upstream unavailable");
      },
      {
        failureThreshold: 1,
        failureRateThreshold: 1,
        windowSize: 100,
        cooldownMs: 60_000,
      },
    );

    assertEquals(first, {
      success: false,
      error: "upstream unavailable",
      circuitOpen: false,
    });
    assertEquals(getCircuit(name).state, "OPEN");

    let called = false;
    const second = await executeWithCircuitBreaker(name, async () => {
      called = true;
      return "should not run";
    });

    assertEquals(called, false);
    assertEquals(second.success, false);
    if (!second.success) {
      assertEquals(second.circuitOpen, true);
      assertExists(second.error);
    }
    assertEquals(getCircuit(name).metrics.totalRequests, 1);
  } finally {
    resetCircuit(name);
  }
});

Deno.test("executeWithCircuitBreaker transforme une exception non-Error en message Unknown error", async () => {
  const name = uniqueName("execute-non-error");

  try {
    const result = await executeWithCircuitBreaker(
      name,
      async () => {
        throw "plain string failure";
      },
      {
        failureThreshold: 2,
        cooldownMs: 60_000,
      },
    );

    assertEquals(result, {
      success: false,
      error: "Unknown error",
      circuitOpen: false,
    });
    assertEquals(getCircuit(name).state, "CLOSED");
    assertEquals(getCircuit(name).metrics.failureCount, 1);
  } finally {
    resetCircuit(name);
  }
});