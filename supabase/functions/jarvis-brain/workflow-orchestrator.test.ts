import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  executeWorkflowOrchestrated,
  WORKFLOW_TEMPLATES,
  type WorkflowDefinition,
} from "./workflow-orchestrator.ts";

const ctx = {
  userId: "user_test",
  organizationId: "org_test",
} as any;

Deno.test("WORKFLOW_TEMPLATES exposes expected business workflows and step metadata", () => {
  assertExists(WORKFLOW_TEMPLATES.onboarding_client);
  assertExists(WORKFLOW_TEMPLATES.devis_to_invoice);
  assertExists(WORKFLOW_TEMPLATES.support_escalation);
  assertExists(WORKFLOW_TEMPLATES.bilan_csm_mensuel);
  assertExists(WORKFLOW_TEMPLATES.cloture_sprint);
  assertExists(WORKFLOW_TEMPLATES.revue_hebdomadaire);
  assertExists(WORKFLOW_TEMPLATES.relance_impayes);
  assertExists(WORKFLOW_TEMPLATES.rapport_mensuel_direction);

  const onboarding = WORKFLOW_TEMPLATES.onboarding_client;
  assertEquals(onboarding.id, "onboarding_client");
  assertEquals(onboarding.name, "Onboarding Client Complet");
  assertEquals(onboarding.steps.length, 4);
  assertEquals(onboarding.steps[0], {
    id: "create_etab",
    toolName: "manage_etablissement",
    toolArgs: { action: "create" },
    label: "Créer l'établissement",
  });
  assertEquals(onboarding.steps[1].dependsOn, ["create_etab"]);
  assertEquals(onboarding.steps[1].useResultFrom, "create_etab");
  assertEquals(onboarding.steps[1].argMapping, { etablissement_id: "data.etablissement.id" });
  assertEquals(onboarding.steps[3].optional, true);

  const weeklyReview = WORKFLOW_TEMPLATES.revue_hebdomadaire;
  assertEquals(weeklyReview.steps.length, 6);
  assertEquals(weeklyReview.steps[5].dependsOn, [
    "pipeline",
    "treasury",
    "unpaid",
    "team_tasks",
    "support",
  ]);
  assertEquals(weeklyReview.steps[5].optional, true);

  const monthlyDirection = WORKFLOW_TEMPLATES.rapport_mensuel_direction;
  const rhStep = monthlyDirection.steps.find((step) => step.id === "rh");
  assertExists(rhStep);
  assertEquals(typeof rhStep.toolArgs.period, "string");
  assertEquals(/^\d{4}-\d{2}$/.test(rhStep.toolArgs.period as string), true);
});

Deno.test("executeWorkflowOrchestrated completes workflow, resolves dependencies, maps nested result data into later args", async () => {
  const definition: WorkflowDefinition = {
    id: "test_success_mapping",
    name: "Workflow de test avec mapping",
    description: "Crée une entité puis enrichit les étapes dépendantes",
    steps: [
      {
        id: "create",
        toolName: "create_entity",
        toolArgs: { name: "Acme" },
        label: "Créer entité",
      },
      {
        id: "enrich",
        toolName: "enrich_entity",
        toolArgs: { mode: "full" },
        dependsOn: ["create"],
        useResultFrom: "create",
        argMapping: {
          entityId: "entity.id",
          ownerEmail: "entity.owner.email",
        },
        label: "Enrichir entité",
      },
      {
        id: "audit",
        toolName: "audit_entity",
        toolArgs: { severity: "info" },
        dependsOn: ["create"],
        label: "Auditer entité",
      },
    ],
  };

  const calls: Array<{ toolName: string; args: Record<string, unknown> }> = [];
  const progress: Array<{ stepId: string; status: string; overallProgress: number }> = [];

  const result = await executeWorkflowOrchestrated(
    definition,
    ctx,
    async (_ctx, toolName, args) => {
      calls.push({ toolName, args });

      if (toolName === "create_entity") {
        return {
          success: true,
          data: {
            entity: {
              id: "etab_123",
              owner: { email: "ops@example.test" },
            },
          },
          execution_time_ms: 3,
        };
      }

      return {
        success: true,
        data: { receivedArgs: args },
        execution_time_ms: 1,
      };
    },
    (stepResult, overallProgress) => {
      progress.push({
        stepId: stepResult.stepId,
        status: stepResult.status,
        overallProgress,
      });
    },
  );

  assertEquals(result.workflowId, "test_success_mapping");
  assertEquals(result.workflowName, "Workflow de test avec mapping");
  assertEquals(result.status, "completed");
  assertEquals(result.steps.map((step) => step.status), ["completed", "completed", "completed"]);
  assertEquals(calls.length, 3);
  assertEquals(calls[0], {
    toolName: "create_entity",
    args: { name: "Acme" },
  });

  const enrichCall = calls.find((call) => call.toolName === "enrich_entity");
  assertExists(enrichCall);
  assertEquals(enrichCall.args, {
    mode: "full",
    entityId: "etab_123",
    ownerEmail: "ops@example.test",
  });

  const auditCall = calls.find((call) => call.toolName === "audit_entity");
  assertExists(auditCall);
  assertEquals(auditCall.args, { severity: "info" });

  assertEquals(progress[0], {
    stepId: "create",
    status: "running",
    overallProgress: 0,
  });
  assertEquals(progress.some((event) => event.stepId === "enrich" && event.status === "running"), true);
  assertEquals(progress.some((event) => event.stepId === "audit" && event.status === "completed"), true);
  assertEquals(progress[progress.length - 1].overallProgress, 1);
  assertEquals(result.summary.includes("✅ Créer entité"), true);
  assertEquals(result.summary.includes("📊 3/3 étapes réussies"), true);
});

Deno.test("executeWorkflowOrchestrated skips a step when a required dependency failed", async () => {
  const definition: WorkflowDefinition = {
    id: "test_required_failure_skip",
    name: "Workflow avec échec requis",
    description: "Une dépendance requise échoue et bloque l'étape suivante",
    steps: [
      {
        id: "required",
        toolName: "required_tool",
        toolArgs: { value: 1 },
        label: "Étape requise",
      },
      {
        id: "independent",
        toolName: "independent_tool",
        toolArgs: { value: 2 },
        label: "Étape indépendante",
      },
      {
        id: "dependent",
        toolName: "dependent_tool",
        toolArgs: { value: 3 },
        dependsOn: ["required"],
        label: "Étape dépendante",
      },
    ],
  };

  const calledTools: string[] = [];

  const result = await executeWorkflowOrchestrated(
    definition,
    ctx,
    async (_ctx, toolName) => {
      calledTools.push(toolName);

      if (toolName === "required_tool") {
        return {
          success: false,
          error: "Validation métier refusée",
          execution_time_ms: 4,
        };
      }

      return {
        success: true,
        data: { ok: true },
        execution_time_ms: 2,
      };
    },
  );

  assertEquals(calledTools.includes("required_tool"), true);
  assertEquals(calledTools.includes("independent_tool"), true);
  assertEquals(calledTools.includes("dependent_tool"), false);

  const required = result.steps.find((step) => step.stepId === "required");
  const independent = result.steps.find((step) => step.stepId === "independent");
  const dependent = result.steps.find((step) => step.stepId === "dependent");

  assertExists(required);
  assertExists(independent);
  assertExists(dependent);
  assertEquals(required.status, "failed");
  assertEquals(required.result?.error, "Validation métier refusée");
  assertEquals(independent.status, "completed");
  assertEquals(dependent.status, "skipped");

  assertEquals(result.status, "partial");
  assertEquals(result.summary.includes("✅ Étape indépendante"), true);
  assertEquals(result.summary.includes("❌ Étape requise"), true);
  assertEquals(result.summary.includes("⏭️ Étape dépendante"), true);
  assertEquals(result.summary.includes("1 échouée(s)"), true);
  assertEquals(result.summary.includes("1 sautée(s)"), true);
});

Deno.test("executeWorkflowOrchestrated lets dependent steps run when the failed dependency is optional", async () => {
  const definition: WorkflowDefinition = {
    id: "test_optional_failure",
    name: "Workflow avec échec optionnel",
    description: "Une étape optionnelle échoue sans bloquer la suite",
    steps: [
      {
        id: "optional_notify",
        toolName: "send_notification",
        toolArgs: { channel: "email" },
        label: "Notification optionnelle",
        optional: true,
      },
      {
        id: "after_optional",
        toolName: "continue_process",
        toolArgs: { action: "continue" },
        dependsOn: ["optional_notify"],
        label: "Continuer le processus",
      },
    ],
  };

  const calls: string[] = [];

  const result = await executeWorkflowOrchestrated(
    definition,
    ctx,
    async (_ctx, toolName) => {
      calls.push(toolName);

      if (toolName === "send_notification") {
        return {
          success: false,
          error: "Service de notification indisponible",
          execution_time_ms: 10,
        };
      }

      return {
        success: true,
        data: { continued: true },
        execution_time_ms: 5,
      };
    },
  );

  assertEquals(calls, ["send_notification", "continue_process"]);

  const optionalStep = result.steps.find((step) => step.stepId === "optional_notify");
  const afterStep = result.steps.find((step) => step.stepId === "after_optional");

  assertExists(optionalStep);
  assertExists(afterStep);
  assertEquals(optionalStep.status, "failed");
  assertEquals(optionalStep.result?.error, "Service de notification indisponible");
  assertEquals(afterStep.status, "completed");
  assertEquals(afterStep.result?.data, { continued: true });

  assertEquals(result.status, "partial");
  assertEquals(result.summary.includes("1/2 étapes réussies"), true);
  assertEquals(result.summary.includes("1 échouée(s)"), true);
});

Deno.test("executeWorkflowOrchestrated captures thrown tool errors as failed step results", async () => {
  const definition: WorkflowDefinition = {
    id: "test_throw_capture",
    name: "Workflow avec exception outil",
    description: "L'orchestrateur convertit une exception en résultat d'échec",
    steps: [
      {
        id: "explode",
        toolName: "throwing_tool",
        toolArgs: { id: "task_1" },
        label: "Outil qui lance une exception",
      },
    ],
  };

  const result = await executeWorkflowOrchestrated(
    definition,
    ctx,
    async () => {
      throw new Error("Erreur outil simulée");
    },
  );

  assertEquals(result.status, "failed");
  assertEquals(result.steps.length, 1);
  assertEquals(result.steps[0].status, "failed");
  assertEquals(result.steps[0].result?.success, false);
  assertEquals(result.steps[0].result?.error, "Erreur outil simulée");
  assertEquals(typeof result.steps[0].startedAt, "number");
  assertEquals(typeof result.steps[0].completedAt, "number");
  assertEquals(result.summary.includes("❌ Outil qui lance une exception"), true);
});

Deno.test("executeWorkflowOrchestrated rejects invalid workflow definitions", async () => {
  await assertRejects(
    async () => {
      await executeWorkflowOrchestrated(
        undefined as unknown as WorkflowDefinition,
        ctx,
        async () => ({
          success: true,
          data: {},
          execution_time_ms: 1,
        }),
      );
    },
    TypeError,
  );
});

Deno.test("local sanity checks for assertion helpers used by this suite", () => {
  assertThrows(
    () => {
      throw new TypeError("invalid workflow shape");
    },
    TypeError,
    "invalid workflow shape",
  );
});