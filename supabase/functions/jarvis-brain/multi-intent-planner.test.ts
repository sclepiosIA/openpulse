import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  createExecutionPlan,
  enrichPromptWithPlan,
  getNextExecutableSteps,
  getParameterHints,
  getPlanSummary,
  isPlanComplete,
  updateStepStatus,
} from "./multi-intent-planner.ts";
import type { ExecutionPlan, ExecutionStep } from "./multi-intent-planner.ts";

function makeIntent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: "general",
    description: "Répondre à la demande",
    confidence: 0.9,
    ...overrides,
  };
}

function makeStep(overrides: Partial<ExecutionStep> = {}): ExecutionStep {
  return {
    id: "step_0_general",
    intent: makeIntent(),
    status: "pending",
    dependsOn: [],
    canRunParallel: false,
    ...overrides,
  } as ExecutionStep;
}

function makePlan(overrides: Partial<ExecutionPlan> = {}): ExecutionPlan {
  const steps = overrides.steps ?? [makeStep()];
  return {
    id: "plan_test_1",
    originalQuery: "Bonjour Jarvis",
    classification: {
      isMultiIntent: false,
      intents: steps.map((step) => step.intent),
      primaryIntent: steps[0]?.intent,
      suggestedParallelExecution: false,
      entities: [],
      emotionalContext: {
        tone: "neutral",
        urgencyLevel: 0,
        sentimentScore: 0,
        keywords: [],
      },
    },
    steps,
    strategy: "sequential",
    estimatedSteps: steps.length,
    entities: [],
    emotionalContext: {
      tone: "neutral",
      urgencyLevel: 0,
      sentimentScore: 0,
      keywords: [],
    },
    createdAt: 1234567890,
    ...overrides,
  } as ExecutionPlan;
}

Deno.test("createExecutionPlan creates a coherent offline execution plan", () => {
  const query = "Bonjour Jarvis";
  const before = Date.now();

  const plan = createExecutionPlan(query);

  const after = Date.now();

  assertEquals(plan.originalQuery, query);
  assertEquals(plan.id.startsWith("plan_"), true);
  assertExists(plan.classification);
  assertEquals(Array.isArray(plan.steps), true);
  assertEquals(plan.estimatedSteps, plan.steps.length);
  assertEquals(Array.isArray(plan.entities), true);
  assertExists(plan.emotionalContext);
  assertEquals(typeof plan.createdAt, "number");
  assertEquals(plan.createdAt >= before && plan.createdAt <= after, true);

  for (const [index, step] of plan.steps.entries()) {
    assertEquals(step.id, `step_${index}_${step.intent.type}`);
    assertEquals(step.status, "pending");
    assertEquals(Array.isArray(step.dependsOn), true);
    assertEquals(
      step.canRunParallel,
      Boolean(plan.classification.suggestedParallelExecution && !step.intent.dependsOn?.length),
    );
  }

  const parallelCount = plan.steps.filter((step) => step.canRunParallel).length;
  if (plan.classification.suggestedParallelExecution && plan.steps.length > 1) {
    if (parallelCount === plan.steps.length) {
      assertEquals(plan.strategy, "parallel");
    } else if (parallelCount > 0) {
      assertEquals(plan.strategy, "mixed");
    } else {
      assertEquals(plan.strategy, "sequential");
    }
  } else {
    assertEquals(plan.strategy, "sequential");
  }
});

Deno.test("enrichPromptWithPlan returns the original prompt for a single-intent plan", () => {
  const plan = makePlan({
    classification: {
      isMultiIntent: false,
      intents: [makeIntent({ type: "chat", description: "Discuter" })],
      suggestedParallelExecution: false,
      entities: [],
      emotionalContext: {
        tone: "neutral",
        urgencyLevel: 0,
        sentimentScore: 0,
        keywords: [],
      },
    } as any,
  });

  const prompt = "Réponds naturellement à l'utilisateur.";

  assertEquals(enrichPromptWithPlan(prompt, plan), prompt);
});

Deno.test("enrichPromptWithPlan prepends a multi-intent execution context with tools and strategy", () => {
  const steps = [
    makeStep({
      id: "step_0_weather",
      intent: makeIntent({
        type: "weather",
        description: "Consulter la météo",
        suggestedTool: "get_weather",
      }) as any,
      canRunParallel: true,
    }),
    makeStep({
      id: "step_1_email",
      intent: makeIntent({
        type: "email",
        description: "Lire les emails",
      }) as any,
      dependsOn: ["step_0_weather"],
      canRunParallel: false,
    }),
  ];

  const plan = makePlan({
    originalQuery: "Donne la météo et lis mes emails",
    steps,
    strategy: "mixed",
    classification: {
      isMultiIntent: true,
      intents: steps.map((step) => step.intent),
      suggestedParallelExecution: true,
      entities: [],
      emotionalContext: {
        tone: "neutral",
        urgencyLevel: 0,
        sentimentScore: 0,
        keywords: [],
      },
    } as any,
  });

  const prompt = "Construis la réponse finale.";
  const enriched = enrichPromptWithPlan(prompt, plan);

  assertEquals(enriched.startsWith("\n[DÉTECTION MULTI-INTENTIONS]"), true);
  assertEquals(enriched.includes("J'ai détecté 2 intentions dans cette requête:"), true);
  assertEquals(enriched.includes("1. weather (outil: get_weather)"), true);
  assertEquals(enriched.includes("2. email"), true);
  assertEquals(enriched.includes("Stratégie d'exécution: mixed"), true);
  assertEquals(enriched.includes("Certaines actions seront parallèles, d'autres séquentielles."), true);
  assertEquals(enriched.includes('Requête originale: "Donne la météo et lis mes emails"'), true);
  assertEquals(enriched.endsWith(prompt), true);
});

Deno.test("getPlanSummary returns an empty string for a single-intent plan", () => {
  const plan = makePlan({
    classification: {
      isMultiIntent: false,
      intents: [makeIntent()],
      suggestedParallelExecution: false,
      entities: [],
      emotionalContext: {
        tone: "neutral",
        urgencyLevel: 0,
        sentimentScore: 0,
        keywords: [],
      },
    } as any,
  });

  assertEquals(getPlanSummary(plan), "");
});

Deno.test("getPlanSummary formats all step statuses with the expected icons", () => {
  const steps = [
    makeStep({
      id: "step_done",
      status: "completed",
      intent: makeIntent({ type: "done", description: "Déjà fait" }) as any,
    }),
    makeStep({
      id: "step_failed",
      status: "failed",
      intent: makeIntent({ type: "failed", description: "En échec" }) as any,
    }),
    makeStep({
      id: "step_running",
      status: "running",
      intent: makeIntent({ type: "running", description: "En cours" }) as any,
    }),
    makeStep({
      id: "step_skipped",
      status: "skipped",
      intent: makeIntent({ type: "skipped", description: "Ignoré" }) as any,
    }),
    makeStep({
      id: "step_pending",
      status: "pending",
      intent: makeIntent({ type: "pending", description: "À faire" }) as any,
    }),
  ];

  const plan = makePlan({
    steps,
    classification: {
      isMultiIntent: true,
      intents: steps.map((step) => step.intent),
      suggestedParallelExecution: false,
      entities: [],
      emotionalContext: {
        tone: "neutral",
        urgencyLevel: 0,
        sentimentScore: 0,
        keywords: [],
      },
    } as any,
  });

  assertEquals(
    getPlanSummary(plan),
    "**Plan d'exécution (5 étapes):**\n✅ 1. Déjà fait\n❌ 2. En échec\n⏳ 3. En cours\n⏭️ 4. Ignoré\n⏸️ 5. À faire",
  );
});

Deno.test("updateStepStatus updates only the targeted step and preserves the original plan", () => {
  const plan = makePlan({
    steps: [
      makeStep({
        id: "step_target",
        status: "pending",
        intent: makeIntent({ type: "target", description: "Étape cible" }) as any,
      }),
      makeStep({
        id: "step_other",
        status: "pending",
        intent: makeIntent({ type: "other", description: "Autre étape" }) as any,
      }),
    ],
  });

  const result = { message: "fait" };
  const updated = updateStepStatus(plan, "step_target", "completed", result);

  assertEquals(plan.steps[0].status, "pending");
  assertEquals(plan.steps[0].result, undefined);
  assertEquals(updated.steps[0].status, "completed");
  assertEquals(updated.steps[0].result, result);
  assertEquals(updated.steps[0].error, undefined);
  assertEquals(updated.steps[1].status, "pending");
  assertEquals(updated.steps[1].id, "step_other");
});

Deno.test("updateStepStatus stores an error for failed steps", () => {
  const plan = makePlan({
    steps: [
      makeStep({
        id: "step_failing",
        status: "running",
        intent: makeIntent({ type: "failing", description: "Étape en erreur" }) as any,
      }),
    ],
  });

  const updated = updateStepStatus(plan, "step_failing", "failed", undefined, "Service indisponible");

  assertEquals(updated.steps[0].status, "failed");
  assertEquals(updated.steps[0].result, undefined);
  assertEquals(updated.steps[0].error, "Service indisponible");
});

Deno.test("updateStepStatus leaves the plan unchanged when the step id does not exist", () => {
  const plan = makePlan({
    steps: [
      makeStep({
        id: "step_existing",
        status: "pending",
        intent: makeIntent({ type: "existing", description: "Étape existante" }) as any,
      }),
    ],
  });

  const updated = updateStepStatus(plan, "step_missing", "completed", { ignored: true });

  assertEquals(updated.steps, plan.steps);
  assertEquals(updated.steps[0].status, "pending");
  assertEquals(updated.steps[0].result, undefined);
});

Deno.test("getNextExecutableSteps returns pending steps whose dependencies are completed", () => {
  const steps = [
    makeStep({
      id: "step_root",
      status: "pending",
      dependsOn: [],
      intent: makeIntent({ type: "root", description: "Sans dépendance" }) as any,
    }),
    makeStep({
      id: "step_done",
      status: "completed",
      dependsOn: [],
      intent: makeIntent({ type: "done", description: "Dépendance terminée" }) as any,
    }),
    makeStep({
      id: "step_after_completed",
      status: "pending",
      dependsOn: ["step_done"],
      intent: makeIntent({ type: "after_completed", description: "Après étape terminée" }) as any,
    }),
    makeStep({
      id: "step_unfinished",
      status: "running",
      dependsOn: [],
      intent: makeIntent({ type: "unfinished", description: "Dépendance non terminée" }) as any,
    }),
    makeStep({
      id: "step_after_unfinished",
      status: "pending",
      dependsOn: ["step_unfinished"],
      intent: makeIntent({ type: "after_unfinished", description: "Après étape non terminée" }) as any,
    }),
    makeStep({
      id: "step_missing_dependency",
      status: "pending",
      dependsOn: ["step_unknown"],
      intent: makeIntent({ type: "missing_dependency", description: "Dépendance absente" }) as any,
    }),
    makeStep({
      id: "step_running_root",
      status: "running",
      dependsOn: [],
      intent: makeIntent({ type: "running_root", description: "Déjà en cours" }) as any,
    }),
  ];

  const plan = makePlan({ steps });

  assertEquals(
    getNextExecutableSteps(plan).map((step) => step.id),
    ["step_root", "step_after_completed"],
  );
});

Deno.test("isPlanComplete returns true only when every step is terminal", () => {
  const completePlan = makePlan({
    steps: [
      makeStep({ id: "step_completed", status: "completed" }),
      makeStep({ id: "step_failed", status: "failed" }),
      makeStep({ id: "step_skipped", status: "skipped" }),
    ],
  });

  const incompletePlan = makePlan({
    steps: [
      makeStep({ id: "step_completed", status: "completed" }),
      makeStep({ id: "step_pending", status: "pending" }),
      makeStep({ id: "step_running", status: "running" }),
    ],
  });

  assertEquals(isPlanComplete(completePlan), true);
  assertEquals(isPlanComplete(incompletePlan), false);
});

Deno.test("getParameterHints merges extracted parameters and later steps override earlier values", () => {
  const plan = makePlan({
    steps: [
      makeStep({
        id: "step_weather",
        intent: makeIntent({
          type: "weather",
          description: "Chercher la météo",
          extractedParams: {
            city: "Paris",
            limit: 5,
          },
        }) as any,
      }),
      makeStep({
        id: "step_plain",
        intent: makeIntent({
          type: "plain",
          description: "Étape sans paramètres",
        }) as any,
      }),
      makeStep({
        id: "step_news",
        intent: makeIntent({
          type: "news",
          description: "Chercher les nouvelles",
          extractedParams: {
            limit: 10,
            topic: "technology",
          },
        }) as any,
      }),
    ],
  });

  assertEquals(getParameterHints(plan), {
    city: "Paris",
    limit: 10,
    topic: "technology",
  });
});