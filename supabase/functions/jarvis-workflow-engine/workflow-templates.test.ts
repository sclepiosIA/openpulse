import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { WORKFLOW_TEMPLATES } from "./workflow-templates.ts";
import type { WorkflowTemplate, WorkflowStep } from "./workflow-templates.ts";

function getTemplate(id: string): WorkflowTemplate {
  const template = WORKFLOW_TEMPLATES.find((workflow) => workflow.id === id);
  assertExists(template);
  return template;
}

function getStep(template: WorkflowTemplate, stepId: string): WorkflowStep {
  const step = template.steps.find((workflowStep) => workflowStep.id === stepId);
  assertExists(step);
  return step;
}

Deno.test("module exports workflow templates collection", () => {
  assertExists(WORKFLOW_TEMPLATES);
  assertEquals(Array.isArray(WORKFLOW_TEMPLATES), true);
  assertEquals(WORKFLOW_TEMPLATES.length >= 9, true);
});

Deno.test("all workflow templates have a valid base schema", () => {
  const allowedCategories = ["sales", "finance", "hr", "support", "operations", "management"];
  const allowedFailureStrategies = ["stop", "continue", "notify"];

  for (const template of WORKFLOW_TEMPLATES) {
    assertEquals(typeof template.id, "string");
    assertEquals(template.id.length > 0, true);
    assertEquals(typeof template.name, "string");
    assertEquals(template.name.length > 0, true);
    assertEquals(typeof template.description, "string");
    assertEquals(template.description.length > 0, true);
    assertEquals(allowedCategories.includes(template.category), true);
    assertEquals(typeof template.triggerCommand, "string");
    assertEquals(template.triggerCommand.length > 0, true);
    assertEquals(Array.isArray(template.steps), true);
    assertEquals(template.steps.length > 0, true);
    assertEquals(typeof template.estimatedDurationMs, "number");
    assertEquals(template.estimatedDurationMs > 0, true);
    assertEquals(Array.isArray(template.requiredPermissions), true);
    assertEquals(template.requiredPermissions.length > 0, true);
    assertEquals(Array.isArray(template.tags), true);
    assertEquals(template.tags.length > 0, true);

    for (const step of template.steps) {
      assertEquals(typeof step.id, "string");
      assertEquals(step.id.length > 0, true);
      assertEquals(typeof step.name, "string");
      assertEquals(step.name.length > 0, true);
      assertEquals(typeof step.tool, "string");
      assertEquals(step.tool.length > 0, true);
      assertEquals(typeof step.params, "object");
      assertEquals(step.params !== null, true);
      assertEquals(allowedFailureStrategies.includes(step.onFailure), true);

      if (step.timeout_ms !== undefined) {
        assertEquals(typeof step.timeout_ms, "number");
        assertEquals(step.timeout_ms > 0, true);
      }

      if (step.condition !== undefined) {
        assertEquals(typeof step.condition, "string");
        assertEquals(step.condition.length > 0, true);
      }
    }
  }
});

Deno.test("workflow template ids are unique", () => {
  const ids = WORKFLOW_TEMPLATES.map((template) => template.id);
  const uniqueIds = new Set(ids);

  assertEquals(uniqueIds.size, ids.length);
});

Deno.test("step ids are unique inside each workflow template", () => {
  for (const template of WORKFLOW_TEMPLATES) {
    const stepIds = template.steps.map((step) => step.id);
    const uniqueStepIds = new Set(stepIds);

    assertEquals(uniqueStepIds.size, stepIds.length);
  }
});

Deno.test("morning sales briefing template contains expected sales pipeline, tasks, meetings and AI summary steps", () => {
  const template = getTemplate("morning_sales_briefing");

  assertEquals(template.name, "Briefing Commercial du Matin");
  assertEquals(template.category, "sales");
  assertEquals(template.triggerCommand, "Génère mon briefing commercial du matin");
  assertEquals(template.estimatedDurationMs, 3000);
  assertEquals(template.requiredPermissions, ["read:etablissements", "read:taches", "read:calendar"]);
  assertEquals(template.tags, ["quotidien", "commercial", "briefing"]);
  assertEquals(template.steps.map((step) => step.id), [
    "check_pipeline",
    "check_tasks",
    "check_meetings",
    "generate_summary",
  ]);

  const pipelineStep = getStep(template, "check_pipeline");
  assertEquals(pipelineStep.tool, "query_database");
  assertEquals(pipelineStep.onFailure, "continue");
  assertEquals(pipelineStep.params.table, "etablissements");
  assertEquals(pipelineStep.params.select, "nom, statut, valeur_estimee, commercial_id, updated_at");
  assertEquals(pipelineStep.params.order_by, "valeur_estimee");
  assertEquals(pipelineStep.params.order_direction, "desc");
  assertEquals(pipelineStep.params.limit, 20);
  assertEquals(pipelineStep.params.filters, [
    { column: "statut", operator: "in", value: ["Prospect", "Qualification", "Proposition"] },
  ]);

  const tasksStep = getStep(template, "check_tasks");
  assertEquals(tasksStep.params.table, "taches");
  assertEquals(tasksStep.params.filters, [{ column: "echeance", operator: "eq", value: "TODAY" }]);

  const meetingsStep = getStep(template, "check_meetings");
  assertEquals(meetingsStep.params.table, "calendar_events");
  assertEquals(meetingsStep.params.order_by, "start_time");
  assertEquals(meetingsStep.params.limit, 10);

  const summaryStep = getStep(template, "generate_summary");
  assertEquals(summaryStep.tool, "generate_ai_summary");
  assertEquals(summaryStep.params, { type: "sales_briefing" });
  assertEquals(summaryStep.onFailure, "stop");
});

Deno.test("prospect follow-up sequence uses previous results only after cold prospects query", () => {
  const template = getTemplate("prospect_followup_sequence");

  assertEquals(template.category, "sales");
  assertEquals(template.estimatedDurationMs, 5000);
  assertEquals(template.requiredPermissions, ["read:etablissements", "write:taches", "send:email"]);
  assertEquals(template.steps.map((step) => step.id), [
    "find_cold_prospects",
    "generate_relance_emails",
    "create_followup_tasks",
  ]);

  const findColdProspects = getStep(template, "find_cold_prospects");
  assertEquals(findColdProspects.tool, "query_database");
  assertEquals(findColdProspects.onFailure, "stop");
  assertEquals(findColdProspects.params.table, "etablissements");
  assertEquals(findColdProspects.params.limit, 10);
  assertEquals(findColdProspects.params.filters, [
    { column: "statut", operator: "eq", value: "Prospect" },
    { column: "updated_at", operator: "lt", value: "DAYS_AGO_7" },
  ]);

  const emailStep = getStep(template, "generate_relance_emails");
  assertEquals(emailStep.tool, "generate_bulk_emails");
  assertEquals(emailStep.condition, "previous_result.count > 0");
  assertEquals(emailStep.onFailure, "notify");
  assertEquals(emailStep.params, { template: "prospect_relance", use_previous_result: true });

  const taskStep = getStep(template, "create_followup_tasks");
  assertEquals(taskStep.tool, "create_bulk_tasks");
  assertEquals(taskStep.condition, "previous_result.count > 0");
  assertEquals(taskStep.params, { template: "followup_call", days_due: 3 });
});

Deno.test("monthly closing workflow defines finance sync, reconciliation, reporting and notification sequence", () => {
  const template = getTemplate("monthly_closing");

  assertEquals(template.name, "Clôture Mensuelle");
  assertEquals(template.category, "finance");
  assertEquals(template.estimatedDurationMs, 45000);
  assertEquals(template.requiredPermissions, ["sync:qonto", "read:factures", "write:reports"]);
  assertEquals(template.steps.map((step) => step.id), [
    "sync_bank",
    "reconcile_invoices",
    "check_unpaid",
    "generate_report",
    "notify_team",
  ]);

  const syncStep = getStep(template, "sync_bank");
  assertEquals(syncStep.tool, "sync_qonto_transactions");
  assertEquals(syncStep.params, { days_back: 35 });
  assertEquals(syncStep.onFailure, "notify");
  assertEquals(syncStep.timeout_ms, 30000);

  const reconcileStep = getStep(template, "reconcile_invoices");
  assertEquals(reconcileStep.tool, "reconcile_transactions");
  assertEquals(reconcileStep.params, { auto_match: true });
  assertEquals(reconcileStep.onFailure, "continue");

  const unpaidStep = getStep(template, "check_unpaid");
  assertEquals(unpaidStep.params.table, "factures");
  assertEquals(unpaidStep.params.filters, [
    { column: "statut", operator: "eq", value: "En attente" },
    { column: "date_echeance", operator: "lt", value: "TODAY" },
  ]);

  const reportStep = getStep(template, "generate_report");
  assertEquals(reportStep.tool, "generate_treasury_report");
  assertEquals(reportStep.params, { period: "last_month", format: "pdf" });
  assertEquals(reportStep.onFailure, "stop");

  const notifyStep = getStep(template, "notify_team");
  assertEquals(notifyStep.tool, "send_notification");
  assertEquals(notifyStep.params, { recipients: "finance_team", template: "monthly_report_ready" });
});

Deno.test("invoice reminder batch finds invoices overdue for more than 15 days before generating reminders", () => {
  const template = getTemplate("invoice_reminder_batch");

  assertEquals(template.category, "finance");
  assertEquals(template.triggerCommand, "Envoie les relances de factures impayées");
  assertEquals(template.estimatedDurationMs, 8000);
  assertEquals(template.requiredPermissions, ["read:factures", "send:email"]);

  const findOverdue = getStep(template, "find_overdue");
  assertEquals(findOverdue.tool, "query_database");
  assertEquals(findOverdue.onFailure, "stop");
  assertEquals(findOverdue.params.table, "factures");
  assertEquals(findOverdue.params.select, "id, numero, etablissement_id, montant_ttc, date_echeance");
  assertEquals(findOverdue.params.filters, [
    { column: "statut", operator: "eq", value: "En attente" },
    { column: "date_echeance", operator: "lt", value: "DAYS_AGO_15" },
  ]);

  const generateReminders = getStep(template, "generate_reminders");
  assertEquals(generateReminders.tool, "generate_invoice_reminders");
  assertEquals(generateReminders.condition, "previous_result.count > 0");
  assertEquals(generateReminders.onFailure, "notify");
  assertEquals(generateReminders.params, { template: "relance_facture", use_previous_result: true });

  const logReminders = getStep(template, "log_reminders");
  assertEquals(logReminders.tool, "log_activity");
  assertEquals(logReminders.params, { type: "invoice_reminder_sent" });
  assertEquals(logReminders.onFailure, "continue");
});

Deno.test("support triage workflow selects only unassigned open tickets and balances assignments", () => {
  const template = getTemplate("support_triage");

  assertEquals(template.name, "Triage Support Automatique");
  assertEquals(template.category, "support");
  assertEquals(template.estimatedDurationMs, 5000);
  assertEquals(template.requiredPermissions, ["read:tickets", "write:tickets", "send:notification"]);
  assertEquals(template.steps.map((step) => step.id), [
    "fetch_new_tickets",
    "analyze_priority",
    "auto_assign",
    "notify_team",
  ]);

  const fetchStep = getStep(template, "fetch_new_tickets");
  assertEquals(fetchStep.tool, "query_database");
  assertEquals(fetchStep.onFailure, "stop");
  assertEquals(fetchStep.params.table, "support_tickets");
  assertEquals(fetchStep.params.order_by, "created_at");
  assertEquals(fetchStep.params.limit, 20);
  assertEquals(fetchStep.params.filters, [
    { column: "status", operator: "eq", value: "open" },
    { column: "assigned_to", operator: "is", value: null },
  ]);

  const analysisStep = getStep(template, "analyze_priority");
  assertEquals(analysisStep.tool, "ai_analyze_tickets");
  assertEquals(analysisStep.condition, "previous_result.count > 0");
  assertEquals(analysisStep.params, { classify_urgency: true, suggest_assignee: true });

  const assignStep = getStep(template, "auto_assign");
  assertEquals(assignStep.tool, "assign_tickets_balanced");
  assertEquals(assignStep.params, { respect_capacity: true });
  assertEquals(assignStep.onFailure, "notify");
});

Deno.test("employee onboarding workflow stops on profile creation failure and notifies on access or meeting setup failures", () => {
  const template = getTemplate("employee_onboarding");

  assertEquals(template.category, "hr");
  assertEquals(template.estimatedDurationMs, 10000);
  assertEquals(template.requiredPermissions, ["write:profiles", "write:taches", "write:calendar"]);
  assertEquals(template.tags, ["rh", "onboarding", "nouvel employé"]);

  const createProfile = getStep(template, "create_profile");
  assertEquals(createProfile.tool, "create_user_profile");
  assertEquals(createProfile.params, { send_welcome_email: true });
  assertEquals(createProfile.onFailure, "stop");

  const createTasks = getStep(template, "create_onboarding_tasks");
  assertEquals(createTasks.tool, "create_tasks_from_template");
  assertEquals(createTasks.params, { template: "onboarding_checklist" });
  assertEquals(createTasks.onFailure, "continue");

  const meetings = getStep(template, "schedule_intro_meetings");
  assertEquals(meetings.tool, "schedule_onboarding_meetings");
  assertEquals(meetings.params, { templates: ["meet_manager", "meet_team", "meet_hr"] });
  assertEquals(meetings.onFailure, "notify");

  const access = getStep(template, "grant_access");
  assertEquals(access.tool, "configure_user_access");
  assertEquals(access.params, { default_role: "user" });
  assertEquals(access.onFailure, "notify");
});

Deno.test("weekly team report consolidates task, sales and support metrics before sending an email", () => {
  const template = getTemplate("weekly_team_report");

  assertEquals(template.category, "operations");
  assertEquals(template.estimatedDurationMs, 15000);
  assertEquals(template.requiredPermissions, ["read:all", "send:email"]);
  assertEquals(template.steps.map((step) => step.id), [
    "collect_task_stats",
    "collect_sales_stats",
    "collect_support_stats",
    "generate_consolidated_report",
    "send_report",
  ]);

  assertEquals(getStep(template, "collect_task_stats").params, { period: "last_week" });
  assertEquals(getStep(template, "collect_sales_stats").params, { period: "last_week" });
  assertEquals(getStep(template, "collect_support_stats").params, { period: "last_week" });

  const report = getStep(template, "generate_consolidated_report");
  assertEquals(report.tool, "generate_team_report");
  assertEquals(report.params, { format: "html", include_charts: true });
  assertEquals(report.onFailure, "stop");

  const send = getStep(template, "send_report");
  assertEquals(send.tool, "send_email");
  assertEquals(send.params, { recipients: "all_team", template: "weekly_report" });
  assertEquals(send.onFailure, "notify");
});

Deno.test("complete new employee onboarding includes profile, email, team, checklist, training and access steps", () => {
  const template = getTemplate("new_employee_onboarding_complete");

  assertEquals(template.name, "Onboarding Complet Nouvel Employé");
  assertEquals(template.category, "hr");
  assertEquals(template.estimatedDurationMs, 15000);
  assertEquals(template.requiredPermissions, ["write:profiles", "write:taches", "write:calendar", "admin:access"]);
  assertEquals(template.tags, ["rh", "onboarding", "nouvel employé", "complet"]);
  assertEquals(template.steps.map((step) => step.id), [
    "create_profile",
    "configure_email",
    "assign_team",
    "create_onboarding_tasks",
    "schedule_training",
    "grant_access",
  ]);

  assertEquals(getStep(template, "create_profile").params, {
    send_welcome_email: true,
    set_temporary_password: true,
  });
  assertEquals(getStep(template, "configure_email").params, { template: "employee_email" });
  assertEquals(getStep(template, "assign_team").params, { notify_manager: true });
  assertEquals(getStep(template, "create_onboarding_tasks").params, {
    template: "onboarding_checklist_complete",
  });
  assertEquals(getStep(template, "schedule_training").params, { type: "new_employee", days_from_start: 3 });
  assertEquals(getStep(template, "grant_access").params, {
    default_role: "user",
    grant_basic_permissions: true,
  });
});

Deno.test("invoice reminder sequence separates soft, firm and late-stage reminder windows", () => {
  const template = getTemplate("invoice_reminder_sequence");

  assertEquals(template.category, "finance");
  assertEquals(template.triggerCommand, "Lance la séquence de relance factures impayées");
  assertEquals(template.requiredPermissions.includes("read:factures"), true);
  assertEquals(template.requiredPermissions.includes("send:email"), true);

  const overdue7 = getStep(template, "find_overdue_7days");
  assertEquals(overdue7.tool, "query_database");
  assertEquals(overdue7.params.table, "factures");
  assertEquals(overdue7.params.filters, [
    { column: "statut", operator: "in", value: ["Envoyée", "En attente"] },
    { column: "date_echeance", operator: "lt", value: "DAYS_AGO_7" },
    { column: "date_echeance", operator: "gte", value: "DAYS_AGO_15" },
  ]);

  const softReminder = getStep(template, "send_soft_reminder");
  assertEquals(softReminder.tool, "send_bulk_emails");
  assertEquals(softReminder.condition, "previous_result.count > 0");
  assertEquals(softReminder.params, { template: "invoice_reminder_soft", use_previous_result: true });
  assertEquals(softReminder.onFailure, "notify");

  const overdue15 = getStep(template, "find_overdue_15days");
  assertEquals(overdue15.params.filters, [
    { column: "statut", operator: "in", value: ["Envoyée", "En attente"] },
    { column: "date_echeance", operator: "lt", value: "DAYS_AGO_15" },
    { column: "date_echeance", operator: "gte", value: "DAYS_AGO_30" },
  ]);

  const firmReminder = getStep(template, "send_firm_reminder");
  assertEquals(firmReminder.tool, "send_bulk_emails");
  assertEquals(firmReminder.condition, "previous_result.count > 0");
  assertEquals(firmReminder.params, { template: "invoice_reminder_firm", use_previous_result: true });

  const overdue30 = getStep(template, "find_overdue_30days");
  assertEquals(overdue30.params.table, "factures");
  assertEquals(Array.isArray(overdue30.params.filters), true);
  assertEquals((overdue30.params.filters as unknown[]).some((filter) =>
    JSON.stringify(filter) === JSON.stringify({ column: "date_echeance", operator: "lt", value: "DAYS_AGO_30" })
  ), true);
});

Deno.test("business categories contain expected core workflow ids", () => {
  const idsByCategory = new Map<string, string[]>();

  for (const template of WORKFLOW_TEMPLATES) {
    idsByCategory.set(template.category, [...(idsByCategory.get(template.category) ?? []), template.id]);
  }

  assertEquals(idsByCategory.get("sales")?.includes("morning_sales_briefing"), true);
  assertEquals(idsByCategory.get("sales")?.includes("prospect_followup_sequence"), true);
  assertEquals(idsByCategory.get("finance")?.includes("monthly_closing"), true);
  assertEquals(idsByCategory.get("finance")?.includes("invoice_reminder_batch"), true);
  assertEquals(idsByCategory.get("finance")?.includes("invoice_reminder_sequence"), true);
  assertEquals(idsByCategory.get("support")?.includes("support_triage"), true);
  assertEquals(idsByCategory.get("hr")?.includes("employee_onboarding"), true);
  assertEquals(idsByCategory.get("hr")?.includes("new_employee_onboarding_complete"), true);
  assertEquals(idsByCategory.get("operations")?.includes("weekly_team_report"), true);
});

Deno.test("all conditional steps use previous_result.count guard", () => {
  const conditionalSteps = WORKFLOW_TEMPLATES.flatMap((template) =>
    template.steps
      .filter((step) => step.condition !== undefined)
      .map((step) => ({ templateId: template.id, stepId: step.id, condition: step.condition }))
  );

  assertEquals(conditionalSteps.length >= 5, true);

  for (const step of conditionalSteps) {
    assertEquals(step.condition, "previous_result.count > 0");
  }
});

Deno.test("lookup helper throws for an unknown workflow id", () => {
  assertThrows(
    () => getTemplate("workflow_id_that_does_not_exist"),
    Error,
  );
});

Deno.test("module can be imported dynamically without network or database access", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;

  globalThis.fetch = (() => {
    fetchCalled = true;
    return Promise.resolve(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  }) as typeof fetch;

  try {
    const module = await import("./workflow-templates.ts");
    assertExists(module.WORKFLOW_TEMPLATES);
    assertEquals(Array.isArray(module.WORKFLOW_TEMPLATES), true);
    assertEquals(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});