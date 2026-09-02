import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import type * as IndexModule from "./index.ts";

type _IndexModuleImportedByRelativePath = typeof IndexModule;

const INDEX_URL = new URL("./index.ts", import.meta.url);

async function readIndexSource(): Promise<string> {
  return await Deno.readTextFile(INDEX_URL);
}

function assertSourceIncludes(source: string, expected: string) {
  assertEquals(source.includes(expected), true, `Expected source to include: ${expected}`);
}

function assertSourceMatches(source: string, pattern: RegExp) {
  const match = source.match(pattern);
  assertExists(match, `Expected source to match: ${pattern}`);
  return match;
}

Deno.test("module source is an Edge Function entrypoint without exported pure helpers", async () => {
  const source = await readIndexSource();

  assertSourceMatches(source, /import\s+\{\s*serve\s*\}\s+from\s+["']https:\/\/deno\.land\/std@0\.168\.0\/http\/server\.ts["'];/);
  assertSourceMatches(source, /serve\s*\(\s*async\s*\(\s*req\s*\)\s*=>\s*\{/);
  assertSourceIncludes(source, 'import { createClient } from "@supabase/supabase-js";');

  assertEquals(/\bexport\s+(async\s+)?function\b/.test(source), false);
  assertEquals(/\bexport\s+(const|let|var|class)\b/.test(source), false);
});

Deno.test("CORS preflight returns the expected permissive headers", async () => {
  const source = await readIndexSource();

  assertSourceIncludes(source, "import { corsHeaders } from '../_shared/cors.ts'");
  assertEquals(source.includes("Access-Control-Allow-Origin"), false, "aucune origine ne doit etre declaree en ligne");
  assertSourceMatches(
    source,
    /if\s*\(\s*req\.method\s*===\s*["']OPTIONS["']\s*\)\s*return\s+new\s+Response\s*\(\s*null\s*,\s*\{\s*headers:\s*corsHeaders\s*\}\s*\)/s,
  );
});

Deno.test("authorization guard returns a 401 Unauthorized JSON response", async () => {
  const source = await readIndexSource();

  assertSourceMatches(source, /const\s+authHeader\s*=\s*req\.headers\.get\s*\(\s*["']Authorization["']\s*\)/);
  assertSourceMatches(source, /if\s*\(\s*!authHeader\s*\)\s*\{/);
  assertSourceIncludes(source, "JSON.stringify({ error: 'Unauthorized' })");
  assertSourceMatches(source, /status:\s*401/);
  assertSourceMatches(source, /['"]Content-Type['"]:\s*['"]application\/json['"]/);
});

Deno.test("request parsing defaults to non-test mode and test mode limits processing to 5 messages", async () => {
  const source = await readIndexSource();

  assertSourceMatches(
    source,
    /const\s+body\s*=\s*req\.method\s*===\s*['"]POST['"]\s*\?\s*await\s+req\.json\(\)\.catch\s*\(\s*\(\)\s*=>\s*\(\{\}\)\s*\)\s*:\s*\{\}\s*;/,
  );
  assertSourceMatches(source, /const\s*\{\s*test_mode\s*=\s*false\s*\}\s*=\s*body\s*;/);
  assertSourceMatches(source, /\.limit\s*\(\s*test_mode\s*\?\s*5\s*:\s*100\s*\)/);
  assertSourceIncludes(source, "TEST MODE - 5 emails only");
});

Deno.test("empty message query targets only messages with both body_html and body_text set to null", async () => {
  const source = await readIndexSource();

  assertSourceMatches(source, /\.from\s*\(\s*['"]email_messages['"]\s*\)\s*\.select\s*\(/s);
  assertSourceIncludes(source, "id,");
  assertSourceIncludes(source, "imap_uid,");
  assertSourceIncludes(source, "thread:email_threads!inner");
  assertSourceIncludes(source, "user_email_account_id");
  assertSourceMatches(source, /\.is\s*\(\s*['"]body_html['"]\s*,\s*null\s*\)/);
  assertSourceMatches(source, /\.is\s*\(\s*['"]body_text['"]\s*,\s*null\s*\)/);
  assertSourceMatches(source, /\.order\s*\(\s*['"]created_at['"]\s*,\s*\{\s*ascending:\s*false\s*\}\s*\)/);
});

Deno.test("no empty messages response reports zero processed and the expected French message", async () => {
  const source = await readIndexSource();

  assertSourceMatches(source, /if\s*\(\s*queryError\s*\|\|\s*!emptyMessages\s*\|\|\s*emptyMessages\.length\s*===\s*0\s*\)/);
  assertSourceIncludes(source, "messages_fixed: 0");
  assertSourceIncludes(source, "total_processed: 0");
  assertSourceIncludes(source, "message: 'Aucun email vide trouvé'");
  assertSourceMatches(source, /status:\s*200/);
});

Deno.test("EMAIL_ENCRYPTION_KEY is required before decrypting account credentials", async () => {
  const source = await readIndexSource();

  assertSourceIncludes(source, 'const encryptionKey = Deno.env.get("EMAIL_ENCRYPTION_KEY");');
  assertSourceIncludes(source, 'throw new Error("EMAIL_ENCRYPTION_KEY not configured");');
  assertSourceMatches(source, /\.rpc\s*\(\s*['"]get_email_account_with_password['"]\s*,\s*\{/);
  assertSourceIncludes(source, "account_uuid: accountId");
  assertSourceIncludes(source, "encryption_key: encryptionKey");
  assertSourceMatches(source, /\.maybeSingle\s*\(\s*\)/);
});

Deno.test("messages are grouped by email account before IMAP processing", async () => {
  const source = await readIndexSource();

  assertSourceMatches(source, /const\s+messagesByAccount\s*=\s*new\s+Map\s*<\s*string\s*,\s*typeof\s+emptyMessages\s*>\s*\(\s*\)/);
  assertSourceIncludes(source, "const accountId = msg.thread.user_email_account_id;");
  assertSourceIncludes(source, "messagesByAccount.set(accountId, []);");
  assertSourceIncludes(source, "messagesByAccount.get(accountId)!.push(msg);");
  assertSourceMatches(source, /for\s*\(\s*const\s+\[\s*accountId\s*,\s*messages\s*\]\s+of\s+messagesByAccount\s*\)/);
});

Deno.test("IMAP workflow fetches headers and a 200 KiB partial body before MIME parsing", async () => {
  const source = await readIndexSource();

  assertSourceIncludes(source, "const client = new SharedImapClient();");
  assertSourceMatches(source, /await\s+client\.connect\s*\(\s*account\.imap_host\s*,\s*account\.imap_port\s*\)/);
  assertSourceMatches(source, /await\s+client\.login\s*\(\s*account\.email_address\s*,\s*account\.password\s*\)/);
  assertSourceIncludes(source, 'await client.selectMailbox("INBOX");');
  assertSourceMatches(source, /await\s+client\.fetchHeaders\s*\(\s*msg\.imap_uid\s*\)/);
  assertSourceMatches(source, /await\s+client\.fetchBodyPartial\s*\(\s*msg\.imap_uid\s*,\s*200\s*\*\s*1024\s*\)/);
  assertSourceIncludes(source, "extractBodyContent(headerResponse, 'HEADER')");
  assertSourceIncludes(source, "extractBodyContent(bodyResponse, 'TEXT')");
  assertSourceIncludes(source, "const fullRawMessage = headers + '\\r\\n\\r\\n' + bodyRaw;");
  assertSourceIncludes(source, "const { text, html } = parseBody(fullRawMessage);");
});

Deno.test("parsed message content is written back to email_messages with nullable text and html fields", async () => {
  const source = await readIndexSource();

  assertSourceMatches(source, /if\s*\(\s*text\s*\|\|\s*html\s*\)\s*\{/);
  assertSourceMatches(source, /\.from\s*\(\s*['"]email_messages['"]\s*\)\s*\.update\s*\(\s*\{/s);
  assertSourceIncludes(source, "body_text: text || null");
  assertSourceIncludes(source, "body_html: html || null");
  assertSourceMatches(source, /\.eq\s*\(\s*['"]id['"]\s*,\s*msg\.id\s*\)/);
  assertSourceIncludes(source, "fixedCount++;");
  assertSourceIncludes(source, "No text or HTML content found");
});

Deno.test("IMAP client logout is protected by a finally block", async () => {
  const source = await readIndexSource();

  assertSourceMatches(
    source,
    /finally\s*\{\s*await\s+client\.logout\s*\(\s*\)\s*;\s*console\.log\s*\(\s*`✓ Disconnected from \$\{account\.email_address\}`\s*\)\s*;\s*\}/s,
  );
});

Deno.test("final success response exposes fixed count, total processed, capped error details and mode-aware message", async () => {
  const source = await readIndexSource();

  assertSourceMatches(source, /return\s+new\s+Response\s*\(\s*JSON\.stringify\s*\(\s*\{/s);
  assertSourceIncludes(source, "success: true");
  assertSourceIncludes(source, "messages_fixed: fixedCount");
  assertSourceIncludes(source, "total_processed: emptyMessages.length");
  assertSourceIncludes(source, "errors: errorCount");
  assertSourceIncludes(source, "error_details: errors.slice(0, 10)");
  assertSourceIncludes(source, "TEST: ${fixedCount} emails réparés sur ${emptyMessages.length}");
  assertSourceIncludes(source, "${fixedCount} emails réparés sur ${emptyMessages.length}");
});

Deno.test("top-level catch delegates sanitized errors to buildErrorResponse with function name and status 500", async () => {
  const source = await readIndexSource();

  assertSourceIncludes(source, 'import { buildErrorResponse } from "../_shared/error-sanitizer.ts";');
  assertSourceMatches(source, /catch\s*\(\s*error:\s*unknown\s*\)\s*\{\s*return\s+buildErrorResponse\s*\(\s*['"]resync-empty-emails['"]\s*,\s*error\s*,\s*corsHeaders\s*,\s*500\s*\)\s*;/s);
});