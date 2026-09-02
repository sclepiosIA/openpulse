import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { classifyIntents } from "./intent-classifier.ts";

function findIntent(result: ReturnType<typeof classifyIntents>, type: string) {
  return result.intents.find((intent) => intent.type === type);
}

function findEntity(result: ReturnType<typeof classifyIntents>, type: string, value?: string) {
  return result.entities.find((entity) =>
    entity.type === type && (value === undefined || entity.value === value)
  );
}

function tomorrowIso(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().split("T")[0];
}

Deno.test("module exports classifyIntents", () => {
  assertExists(classifyIntents);
  assertEquals(typeof classifyIntents, "function");
});

Deno.test("classifyIntents detects a translation intent", () => {
  const result = classifyIntents("Traduis ce texte en anglais");

  assertEquals(result.intents.length, 1);
  assertEquals(result.intents[0].type, "translate");
  assertEquals(result.intents[0].suggestedTool, "translate_email");
  assertEquals(result.isMultiIntent, false);
  assertEquals(result.complexity, "moderate");
  assertEquals(result.suggestedParallelExecution, false);
  assertEquals(result.emotionalContext.tone, "neutral");
  assertEquals(result.emotionalContext.urgencyLevel, 0);
});

Deno.test("classifyIntents extracts email, phone, amount and explicit date entities", () => {
  const result = classifyIntents(
    "Envoie un email à pierre@example.com avec un budget de 1250,50 € pour le 15/06/2025 et note le téléphone 06 12 34 56 78",
  );

  const sendEmail = findIntent(result, "send_email");
  assertExists(sendEmail);
  assertEquals(sendEmail.suggestedTool, "send_email");

  const email = findEntity(result, "email", "pierre@example.com");
  assertExists(email);
  assertEquals(email.confidence, 0.95);

  const amount = findEntity(result, "amount", "1250,50 €");
  assertExists(amount);
  assertEquals(amount.normalized, "1250.50");

  const date = findEntity(result, "date", "15/06/2025");
  assertExists(date);
  assertEquals(date.normalized, "2025-06-15");

  const phone = findEntity(result, "phone", "06 12 34 56 78");
  assertExists(phone);
  assertEquals(phone.normalized, "0612345678");
});

Deno.test("classifyIntents detects multi-intent task request with urgency and implicit prioritization", () => {
  const result = classifyIntents(
    "Crée une tâche urgente pour relancer le client demain et liste mes tâches",
  );

  assertExists(findIntent(result, "create_task"));

  const listTasks = findIntent(result, "list_tasks");
  assertExists(listTasks);
  assertEquals(listTasks.suggestedTool, "query_database");
  assertEquals((listTasks.extractedParams as Record<string, unknown>).table, "taches");

  const prioritize = findIntent(result, "prioritize");
  assertExists(prioritize);
  assertEquals(prioritize.isImplicit, true);

  const date = findEntity(result, "date", "demain");
  assertExists(date);
  assertEquals(date.normalized, tomorrowIso());

  assertEquals(result.isMultiIntent, true);
  assertEquals(result.emotionalContext.tone, "urgent");
  assertEquals(result.emotionalContext.urgencyLevel >= 8, true);
});

Deno.test("classifyIntents extracts meeting intent, person name and relative date", () => {
  const result = classifyIntents(
    "Planifie une réunion avec Jean Dupont demain",
  );

  const meeting = findIntent(result, "schedule_meeting");
  assertExists(meeting);
  assertEquals(meeting.suggestedTool, "schedule_meeting");

  const person = findEntity(result, "person", "Jean Dupont");
  assertExists(person);
  assertEquals(person.confidence, 0.7);

  const date = findEntity(result, "date", "demain");
  assertExists(date);
  assertEquals(date.normalized, tomorrowIso());
});

Deno.test("classifyIntents detects frustrated urgent support context", () => {
  const result = classifyIntents(
    "Impossible, ce bug critique ne fonctionne pas !!!",
  );

  const support = findIntent(result, "support");
  assertExists(support);
  assertEquals(support.suggestedTool, "create_support_ticket");

  const prioritize = findIntent(result, "prioritize");
  assertExists(prioritize);
  assertEquals(prioritize.isImplicit, true);

  assertEquals(result.emotionalContext.tone, "frustrated");
  assertEquals(result.emotionalContext.urgencyLevel, 10);
  assertEquals(result.emotionalContext.sentimentScore, -0.5);
  assertEquals(result.emotionalContext.keywords.includes("critique"), true);
});

Deno.test("classifyIntents suggests contact lookup when email action has no explicit email address", () => {
  const result = classifyIntents(
    "Envoie un mail à Marie au sujet du contrat",
  );

  const sendEmail = findIntent(result, "send_email");
  assertExists(sendEmail);
  assertEquals(sendEmail.suggestedTool, "send_email");

  const lookupContact = findIntent(result, "lookup_contact");
  assertExists(lookupContact);
  assertEquals(lookupContact.isImplicit, true);
  assertEquals(lookupContact.suggestedTool, "query_database");
  assertEquals((lookupContact.extractedParams as Record<string, unknown>).table, "contacts");
});

Deno.test("classifyIntents suggests payment reminder when amount and date are present in an invoice context", () => {
  const result = classifyIntents(
    "Facture de 980 euros à payer demain",
  );

  const treasury = findIntent(result, "treasury");
  assertExists(treasury);
  assertEquals(treasury.suggestedTool, "sync_qonto_transactions");

  const reminder = findIntent(result, "create_reminder");
  assertExists(reminder);
  assertEquals(reminder.isImplicit, true);
  assertEquals(reminder.suggestedTool, "create_task");

  const amount = findEntity(result, "amount", "980 euros");
  assertExists(amount);
  assertEquals(amount.normalized, "980");

  const date = findEntity(result, "date", "demain");
  assertExists(date);
  assertEquals(date.normalized, tomorrowIso());
});

Deno.test("classifyIntents resets global regexp state between calls", () => {
  const first = classifyIntents("Facture de 10 € à payer aujourd'hui");
  const second = classifyIntents("Facture de 20 € à payer demain");

  const firstAmount = findEntity(first, "amount", "10 €");
  assertExists(firstAmount);
  assertEquals(firstAmount.normalized, "10");

  const secondAmount = findEntity(second, "amount", "20 €");
  assertExists(secondAmount);
  assertEquals(secondAmount.normalized, "20");

  const secondDate = findEntity(second, "date", "demain");
  assertExists(secondDate);
  assertEquals(secondDate.normalized, tomorrowIso());
});

Deno.test("classifyIntents detects database query table for task listing", () => {
  const result = classifyIntents("Affiche mes tâches");

  const listTasks = findIntent(result, "list_tasks");
  assertExists(listTasks);
  assertEquals(listTasks.type, "list_tasks");
  assertEquals(listTasks.suggestedTool, "query_database");
  assertEquals((listTasks.extractedParams as Record<string, unknown>).table, "taches");
  assertEquals(result.isMultiIntent, false);
});

Deno.test("classifyIntents detects positive emotional context", () => {
  const result = classifyIntents("Merci, super travail, génial ! Résume le rapport");

  const summary = findIntent(result, "summary");
  assertExists(summary);
  assertEquals(summary.suggestedTool, "generate_report");

  assertEquals(result.emotionalContext.tone, "positive");
  assertEquals(result.emotionalContext.sentimentScore, 0.7);
  assertEquals(result.emotionalContext.keywords.includes("Merci"), true);
});

Deno.test("classifyIntents throws synchronously for non-string input", () => {
  assertThrows(
    () => classifyIntents(null as unknown as string),
    TypeError,
  );
});

Deno.test("classifyIntents rejects through async boundary for invalid input", async () => {
  await assertRejects(
    async () => {
      classifyIntents(undefined as unknown as string);
    },
    TypeError,
  );
});