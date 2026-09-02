import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

const indexUrl = new URL("./index.ts", import.meta.url);

async function readIndexSource(): Promise<string> {
  return await Deno.readTextFile(indexUrl);
}

function extractBetween(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  if (start === -1) {
    throw new Error(`Missing start marker: ${startMarker}`);
  }

  const end = source.indexOf(endMarker, start);
  if (end === -1) {
    throw new Error(`Missing end marker: ${endMarker}`);
  }

  return source.slice(start, end);
}

Deno.test("module source is present and wires Supabase Edge dependencies", async () => {
  const source = await readIndexSource();

  assertExists(source);
  assertExists(source.match(/import\s+\{\s*serve\s*\}\s+from\s+"https:\/\/deno\.land\/std@0\.168\.0\/http\/server\.ts";/));
  assertExists(source.match(/import\s+\{\s*createClient\s*\}\s+from\s+"@supabase\/supabase-js";/));
  assertExists(source.match(/import\s+\{\s*validateServiceOrUser\s*\}\s+from\s+"\.\.\/_shared\/auth-helpers\.ts";/));
  assertExists(source.match(/import\s+\{\s*buildErrorResponse\s*\}\s+from\s+"\.\.\/_shared\/error-sanitizer\.ts";/));
  assertEquals(source.includes("serve(async (req) =>"), true);
});

Deno.test("CORS headers allow expected Supabase client metadata headers", async () => {
  const source = await readIndexSource();
  const headerMatch = source.match(/'Access-Control-Allow-Headers':\s*'([^']+)'/);

  assertExists(headerMatch);

  const headers = headerMatch[1].split(",").map((header) => header.trim()).sort();

  assertEquals(headers, [
    "apikey",
    "authorization",
    "content-type",
    "x-client-info",
    "x-internal-secret",
    "x-supabase-client-platform",
    "x-supabase-client-platform-version",
    "x-supabase-client-runtime",
    "x-supabase-client-runtime-version",
  ].sort());
});

Deno.test("OPTIONS requests are handled before authentication", async () => {
  const source = await readIndexSource();
  const optionsBlock = extractBetween(source, "if (req.method === 'OPTIONS')", "const startTime = Date.now();");

  assertExists(optionsBlock.match(/return\s+new\s+Response\(null,\s*\{\s*headers:\s*corsHeaders\s*\}\);/));
  assertEquals(optionsBlock.includes("validateServiceOrUser"), false);
  assertEquals(optionsBlock.includes("createClient"), false);
});

Deno.test("action dispatcher supports the expected approved action types", async () => {
  const source = await readIndexSource();
  const dispatchBlock = extractBetween(source, "switch (actionType)", "default:");
  const cases = [...dispatchBlock.matchAll(/case '([^']+)':/g)].map((match) => match[1]);

  assertEquals(cases, [
    "send_email",
    "create_task",
    "update_status",
    "close_ticket",
    "schedule_meeting",
    "draft_response",
    "summarize",
    "analyze",
    "remind",
    "none",
  ]);
});

Deno.test("request and action validators expose the expected business error messages", async () => {
  const source = await readIndexSource();

  const expectedMessages = [
    "Missing required field: action_id",
    "Missing required field: user_id",
    "Action not found or unauthorized",
    "Action has expired",
    "Email requires \"to\" and \"body\" fields",
    "Task requires \"titre\" field",
    "Update requires entity_type, entity_id and new_status",
    "Close ticket requires ticket_id",
    "Meeting requires title, start_time and end_time",
    "Draft response requires content",
    "Summary action requires summary content",
    "Analysis action requires analysis content",
    "Remind action requires reminder_text",
  ];

  const presentMessages = expectedMessages.filter((message) => source.includes(message));

  assertEquals(presentMessages, expectedMessages);
});

Deno.test("JWT user id overrides request user id for non-service callers", async () => {
  const source = await readIndexSource();
  const authBlock = extractBetween(source, "const auth = await validateServiceOrUser(req);", "console.log(`[JARVIS-EXECUTE] Processing action:");

  assertExists(authBlock.match(/if\s*\(\s*!auth\.authorized\s*\)/));
  assertExists(authBlock.match(/status:\s*401/));
  assertExists(authBlock.match(/if\s*\(\s*!auth\.isServiceCall\s*&&\s*auth\.userId\s*\)\s*\{\s*request\.user_id\s*=\s*auth\.userId;\s*\}/));
});

Deno.test("pending action query scopes by action id and user id", async () => {
  const source = await readIndexSource();
  const fetchBlock = extractBetween(source, "// Récupérer l'action pending", "if (fetchError || !pendingAction)");

  assertExists(fetchBlock.match(/\.from\('jarvis_pending_actions'\)/));
  assertExists(fetchBlock.match(/\.select\('\*'\)/));
  assertExists(fetchBlock.match(/\.eq\('id',\s*request\.action_id\)/));
  assertExists(fetchBlock.match(/\.eq\('user_id',\s*request\.user_id\)/));
  assertExists(fetchBlock.match(/\.single\(\)/));
});

Deno.test("pending action status and expiration rules are enforced", async () => {
  const source = await readIndexSource();

  assertExists(source.match(/pendingAction\.status\s*!==\s*'pending'\s*&&\s*pendingAction\.status\s*!==\s*'approved'/));
  assertExists(source.match(/Action cannot be executed: status is \$\{pendingAction\.status\}/));
  assertExists(source.match(/new\s+Date\(pendingAction\.expires_at\)\s*<\s*new\s+Date\(\)/));
  assertExists(source.match(/\.update\(\{\s*status:\s*'expired'\s*\}\)/));
});

Deno.test("user modifications are merged into action data and persisted", async () => {
  const source = await readIndexSource();

  assertExists(source.match(/actionData\s*=\s*\{\s*\.\.\.actionData,\s*\.\.\.request\.modifications\s*\};/));
  assertExists(source.match(/user_modification:\s*request\.modifications\s*\?\s*JSON\.stringify\(request\.modifications\)\s*:\s*null/));
  assertExists(source.match(/was_modified:\s*!!request\.modifications/));
});

Deno.test("status update action maps supported entity types to the expected database tables", async () => {
  const source = await readIndexSource();
  const updateStatusBlock = extractBetween(
    source,
    "async function executeUpdateStatus",
    "async function executeCloseTicket",
  );

  assertExists(updateStatusBlock.match(/case 'etablissement':[\s\S]*?tableName\s*=\s*'etablissements';[\s\S]*?statusColumn\s*=\s*'statut';/));
  assertExists(updateStatusBlock.match(/case 'tache':[\s\S]*?tableName\s*=\s*'taches';[\s\S]*?statusColumn\s*=\s*'statut';/));
  assertExists(updateStatusBlock.match(/case 'task':[\s\S]*?tableName\s*=\s*'taches';[\s\S]*?statusColumn\s*=\s*'statut';/));
  assertExists(updateStatusBlock.match(/Unknown entity type:/));
  assertExists(updateStatusBlock.match(/\.update\(\{\s*\[statusColumn\]:\s*data\.new_status\s*\}\)/));
  assertExists(updateStatusBlock.match(/\.eq\('id',\s*data\.entity_id\)/));
});

Deno.test("send email action calls the internal function with the expected payload", async () => {
  const source = await readIndexSource();
  const sendEmailBlock = extractBetween(
    source,
    "async function executeSendEmail",
    "async function executeCreateTask",
  );

  assertExists(sendEmailBlock.match(/fetch\(`\$\{supabaseUrl\}\/functions\/v1\/send-email-reply`/));
  assertExists(sendEmailBlock.match(/method:\s*'POST'/));
  assertExists(sendEmailBlock.match(/'Content-Type':\s*'application\/json'/));
  assertExists(sendEmailBlock.match(/'Authorization':\s*`Bearer \$\{supabaseKey\}`/));
  assertExists(sendEmailBlock.match(/thread_id:\s*data\.thread_id/));
  assertExists(sendEmailBlock.match(/to:\s*data\.to/));
  assertExists(sendEmailBlock.match(/cc:\s*data\.cc/));
  assertExists(sendEmailBlock.match(/subject:\s*data\.subject/));
  assertExists(sendEmailBlock.match(/body:\s*data\.body/));
  assertExists(sendEmailBlock.match(/user_id:\s*userId/));
  assertExists(sendEmailBlock.match(/email_sent:\s*true/));
});

Deno.test("create task action applies Jarvis category and task defaults", async () => {
  const source = await readIndexSource();
  const createTaskBlock = extractBetween(
    source,
    "async function executeCreateTask",
    "async function executeUpdateStatus",
  );

  assertExists(createTaskBlock.match(/\.from\('profiles'\)/));
  assertExists(createTaskBlock.match(/\.from\('tache_categories'\)[\s\S]*?\.eq\('nom',\s*'Jarvis'\)/));
  assertExists(createTaskBlock.match(/nom:\s*'Jarvis'/));
  assertExists(createTaskBlock.match(/couleur:\s*'#6366f1'/));
  assertExists(createTaskBlock.match(/description:\s*'Tâches créées par Jarvis'/));
  assertExists(createTaskBlock.match(/priorite:\s*data\.priorite\s*\|\|\s*'moyenne'/));
  assertExists(createTaskBlock.match(/statut:\s*'a_faire'/));
  assertExists(createTaskBlock.match(/categorie_id:\s*categorieId/));
  assertExists(createTaskBlock.match(/task_created:\s*true/));
});

Deno.test("close ticket action stores resolution metadata", async () => {
  const source = await readIndexSource();
  const closeTicketBlock = extractBetween(
    source,
    "async function executeCloseTicket",
    "async function executeScheduleMeeting",
  );

  assertExists(closeTicketBlock.match(/\.from\('support_tickets'\)/));
  assertExists(closeTicketBlock.match(/status:\s*'resolu'/));
  assertExists(closeTicketBlock.match(/resolution_note:\s*data\.resolution_note\s*\|\|\s*'Clôturé via Jarvis'/));
  assertExists(closeTicketBlock.match(/resolved_at:\s*new\s+Date\(\)\.toISOString\(\)/));
  assertExists(closeTicketBlock.match(/resolved_by:\s*userId/));
  assertExists(closeTicketBlock.match(/ticket_closed:\s*true/));
});

Deno.test("schedule meeting action creates a default calendar when needed and confirms the event", async () => {
  const source = await readIndexSource();
  const meetingBlock = extractBetween(
    source,
    "async function executeScheduleMeeting",
    "// ============================================================\n// Nouvelles actions IA",
  );

  assertExists(meetingBlock.match(/let\s+calendarId\s*=\s*data\.calendar_id/));
  assertExists(meetingBlock.match(/\.from\('calendars'\)[\s\S]*?\.eq\('owner_id',\s*userId\)[\s\S]*?\.eq\('is_default',\s*true\)/));
  assertExists(meetingBlock.match(/owner_id:\s*userId/));
  assertExists(meetingBlock.match(/name:\s*'Mon calendrier'/));
  assertExists(meetingBlock.match(/is_default:\s*true/));
  assertExists(meetingBlock.match(/color:\s*'#3B82F6'/));
  assertExists(meetingBlock.match(/\.from\('calendar_events'\)/));
  assertExists(meetingBlock.match(/status:\s*'confirmed'/));
  assertExists(meetingBlock.match(/meeting_scheduled:\s*true/));
});

Deno.test("AI-only actions return the expected result contracts", async () => {
  const source = await readIndexSource();
  const draftBlock = extractBetween(source, "async function executeDraftResponse", "async function executeSummarize");
  const summarizeBlock = extractBetween(source, "async function executeSummarize", "async function executeAnalyze");
  const analyzeBlock = extractBetween(source, "async function executeAnalyze", "async function executeRemind");

  assertExists(draftBlock.match(/draft_created:\s*true/));
  assertExists(draftBlock.match(/content:\s*data\.content/));
  assertExists(draftBlock.match(/subject:\s*data\.subject\s*\|\|\s*null/));

  assertExists(summarizeBlock.match(/summary_generated:\s*true/));
  assertExists(summarizeBlock.match(/summary:\s*data\.summary/));
  assertExists(summarizeBlock.match(/source_type:\s*data\.source_type\s*\|\|\s*'unknown'/));
  assertExists(summarizeBlock.match(/source_id:\s*data\.source_id\s*\|\|\s*null/));

  assertExists(analyzeBlock.match(/analysis_completed:\s*true/));
  assertExists(analyzeBlock.match(/analysis:\s*data\.analysis/));
  assertExists(analyzeBlock.match(/source_type:\s*data\.source_type\s*\|\|\s*'unknown'/));
  assertExists(analyzeBlock.match(/source_id:\s*data\.source_id\s*\|\|\s*null/));
});

Deno.test("execution status response and persistence reflect success or failure", async () => {
  const source = await readIndexSource();

  assertExists(source.match(/let\s+success\s*=\s*true/));
  assertExists(source.match(/success\s*=\s*false/));
  assertExists(source.match(/errorMessage\s*=\s*execError\s+instanceof\s+Error\s*\?\s*execError\.message\s*:\s*'Execution failed'/));
  assertExists(source.match(/const\s+newStatus\s*=\s*success\s*\?\s*'executed'\s*:\s*'error'/));
  assertExists(source.match(/status:\s*success\s*\?\s*200\s*:\s*422/));
});

Deno.test("history logging stores confidence, timing and distinct KB base types", async () => {
  const source = await readIndexSource();
  const historyBlock = extractBetween(source, "// Logger dans l'historique", "console.log(`[JARVIS-EXECUTE]");

  assertExists(historyBlock.match(/\.from\('jarvis_action_history'\)/));
  assertExists(historyBlock.match(/user_id:\s*request\.user_id/));
  assertExists(historyBlock.match(/action_id:\s*request\.action_id/));
  assertExists(historyBlock.match(/action_type:\s*actionType/));
  assertExists(historyBlock.match(/confidence_score:\s*pendingAction\.proposed_action\.confidence_score/));
  assertExists(historyBlock.match(/execution_time_ms:\s*executionTime/));
  assertExists(historyBlock.match(/kb_articles_count:\s*kbSources\.length/));
  assertExists(historyBlock.match(/kb_base_types:\s*\[\.\.\.new\s+Set\(kbSources\.map\(s\s*=>\s*s\.base_type\)\)\]/));
});

Deno.test("module load helper reports missing source markers", () => {
  assertThrows(
    () => extractBetween("const value = 1;", "switch (actionType)", "default:"),
    Error,
    "Missing start marker: switch (actionType)",
  );

  assertThrows(
    () => extractBetween("switch (actionType) { case 'none': break; }", "switch (actionType)", "default:"),
    Error,
    "Missing end marker: default:",
  );
});

Deno.test("reading a missing sibling module rejects", async () => {
  await assertRejects(
    () => Deno.readTextFile(new URL("./index.ts.__missing_for_test__", import.meta.url)),
    Deno.errors.NotFound,
  );
});