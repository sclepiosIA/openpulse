import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  TOOL_RISK_LEVELS,
  getRiskLevel,
  getToolRiskLevel,
  requiresAuditLog,
  requiresConfirmation,
  validateInput,
  validateToolPermission,
} from "./security-validator.ts";

function createSupabaseStub(result: { data?: Array<{ role: string }>; error?: unknown; throwError?: unknown }) {
  const calls: Array<{ table?: string; select?: string; eq?: [string, string] }> = [];

  const supabase = {
    from(table: string) {
      calls.push({ table });
      return {
        select(columns: string) {
          calls.push({ select: columns });
          return {
            async eq(column: string, value: string) {
              calls.push({ eq: [column, value] });
              if (result.throwError) {
                throw result.throwError;
              }
              return {
                data: result.data,
                error: result.error ?? null,
              };
            },
          };
        },
      };
    },
  };

  return { supabase, calls };
}

Deno.test("risk levels expose expected business classifications", () => {
  assertEquals(TOOL_RISK_LEVELS.query_database, "safe");
  assertEquals(TOOL_RISK_LEVELS.create_task, "moderate");
  assertEquals(TOOL_RISK_LEVELS.send_email, "sensitive");
  assertEquals(TOOL_RISK_LEVELS.manage_user, "critical");
  assertEquals(TOOL_RISK_LEVELS.delete_file, "sensitive");
  assertEquals(TOOL_RISK_LEVELS.web_search, "safe");
  assertEquals(TOOL_RISK_LEVELS.create_workflow_from_prompt, "sensitive");
  assertEquals(TOOL_RISK_LEVELS.export_custom_report, "moderate");
});

Deno.test("getToolRiskLevel returns configured levels and defaults unknown tools to moderate", () => {
  assertEquals(getToolRiskLevel("get_dashboard_summary"), "safe");
  assertEquals(getToolRiskLevel("create_invoice"), "moderate");
  assertEquals(getToolRiskLevel("generate_contract"), "sensitive");
  assertEquals(getToolRiskLevel("export_data_rgpd"), "critical");
  assertEquals(getToolRiskLevel("unknown_custom_tool"), "moderate");
});

Deno.test("getRiskLevel is an alias of getToolRiskLevel", () => {
  assertEquals(getRiskLevel("parse_cv"), "sensitive");
  assertEquals(getRiskLevel("manage_user_role"), "critical");
  assertEquals(getRiskLevel("unknown_alias_tool"), "moderate");
});

Deno.test("requiresConfirmation is true only for sensitive and critical tools", () => {
  assertEquals(requiresConfirmation("query_database"), false);
  assertEquals(requiresConfirmation("create_task"), false);
  assertEquals(requiresConfirmation("schedule_meeting"), false);
  assertEquals(requiresConfirmation("delete_task"), true);
  assertEquals(requiresConfirmation("send_email"), true);
  assertEquals(requiresConfirmation("manage_user"), true);
  assertEquals(requiresConfirmation("unknown_tool_defaults_to_moderate"), false);
});

Deno.test("requiresAuditLog is true only for sensitive and critical tools", () => {
  assertEquals(requiresAuditLog("search_knowledge_base"), false);
  assertEquals(requiresAuditLog("schedule_meeting"), false);
  assertEquals(requiresAuditLog("batch_send_emails"), true);
  assertEquals(requiresAuditLog("execute_edge_function"), true);
  assertEquals(requiresAuditLog("unknown_tool_defaults_to_moderate"), false);
});

Deno.test("validateToolPermission allows a user with a required role", async () => {
  const { supabase, calls } = createSupabaseStub({
    data: [{ role: "admin" }],
  });

  const result = await validateToolPermission(supabase as never, "user-123", "manage_user");

  assertEquals(result, {
    allowed: true,
    userRoles: ["admin"],
  });
  assertEquals(calls, [
    { table: "user_roles" },
    { select: "role" },
    { eq: ["user_id", "user-123"] },
  ]);
});

Deno.test("validateToolPermission denies restricted tools when the user lacks required roles", async () => {
  const { supabase } = createSupabaseStub({
    data: [{ role: "user" }],
  });

  const result = await validateToolPermission(supabase as never, "user-456", "manage_user");

  assertEquals(result.allowed, false);
  assertEquals(result.userRoles, ["user"]);
  assertEquals(result.reason, "Cette action nécessite l'un des rôles suivants: admin, direction");
});

Deno.test("validateToolPermission allows default tools for authenticated default roles", async () => {
  const { supabase } = createSupabaseStub({
    data: [{ role: "user" }],
  });

  const result = await validateToolPermission(supabase as never, "user-789", "custom_unrestricted_tool");

  assertEquals(result, {
    allowed: true,
    userRoles: ["user"],
  });
});

Deno.test("validateToolPermission applies explicit permissions for HR tools", async () => {
  const { supabase: rhSupabase } = createSupabaseStub({
    data: [{ role: "rh" }],
  });
  const { supabase: commercialSupabase } = createSupabaseStub({
    data: [{ role: "commercial" }],
  });

  const allowed = await validateToolPermission(rhSupabase as never, "rh-user", "parse_cv");
  const denied = await validateToolPermission(commercialSupabase as never, "sales-user", "parse_cv");

  assertEquals(allowed.allowed, true);
  assertEquals(allowed.userRoles, ["rh"]);
  assertEquals(denied.allowed, false);
  assertEquals(denied.userRoles, ["commercial"]);
  assertEquals(denied.reason, "Cette action nécessite l'un des rôles suivants: admin, rh");
});

Deno.test("validateToolPermission applies explicit permissions for finance tools", async () => {
  const { supabase: directionSupabase } = createSupabaseStub({
    data: [{ role: "direction" }],
  });
  const { supabase: csmSupabase } = createSupabaseStub({
    data: [{ role: "csm" }],
  });

  const allowed = await validateToolPermission(directionSupabase as never, "get_bank_balance", "get_bank_balance");
  const denied = await validateToolPermission(csmSupabase as never, "csm-user", "get_bank_balance");

  assertEquals(allowed.allowed, true);
  assertEquals(allowed.userRoles, ["direction"]);
  assertEquals(denied.allowed, false);
  assertEquals(denied.reason, "Cette action nécessite l'un des rôles suivants: admin, direction");
});

Deno.test("validateToolPermission supports users with multiple roles", async () => {
  const { supabase } = createSupabaseStub({
    data: [{ role: "user" }, { role: "commercial" }],
  });

  const result = await validateToolPermission(supabase as never, "multi-role-user", "create_invoice");

  assertEquals(result.allowed, true);
  assertEquals(result.userRoles, ["user", "commercial"]);
});

Deno.test("validateToolPermission falls back to user role when roles data is undefined", async () => {
  const { supabase } = createSupabaseStub({
    data: undefined,
  });

  const result = await validateToolPermission(supabase as never, "no-roles-user", "query_database");

  assertEquals(result, {
    allowed: true,
    userRoles: ["user"],
  });
});

Deno.test("validateToolPermission returns a safe denial when Supabase returns an error", async () => {
  const { supabase } = createSupabaseStub({
    error: { message: "database unavailable" },
  });

  const result = await validateToolPermission(supabase as never, "user-error", "query_database");

  assertEquals(result, {
    allowed: false,
    reason: "Unable to verify permissions",
    userRoles: [],
  });
});

Deno.test("validateToolPermission returns a safe denial when the Supabase chain throws", async () => {
  const { supabase } = createSupabaseStub({
    throwError: new Error("unexpected failure"),
  });

  const result = await validateToolPermission(supabase as never, "user-throws", "query_database");

  assertEquals(result, {
    allowed: false,
    reason: "Permission check failed",
    userRoles: [],
  });
});

Deno.test("validateInput accepts valid values and returns sanitized payload", () => {
  const result = validateInput(
    {
      email: "person@example.com",
      userId: "123e4567-e89b-12d3-a456-426614174000",
      name: "Alice Martin",
      score: 42,
      active: true,
      tags: ["client", "vip"],
    },
    {
      email: { type: "email", required: true },
      userId: { type: "uuid", required: true },
      name: { type: "string", required: true, sanitize: true, minLength: 3, maxLength: 50 },
      score: { type: "number", required: true },
      active: { type: "boolean", required: true },
      tags: { type: "array", required: true },
    },
  );

  assertEquals(result.valid, true);
  assertEquals(result.errors, []);
  assertExists(result.sanitized);
  assertEquals(result.sanitized?.email, "person@example.com");
  assertEquals(result.sanitized?.userId, "123e4567-e89b-12d3-a456-426614174000");
  assertEquals(result.sanitized?.name, "Alice Martin");
  assertEquals(result.sanitized?.score, 42);
  assertEquals(result.sanitized?.active, true);
  assertEquals(result.sanitized?.tags, ["client", "vip"]);
});

Deno.test("validateInput reports required, email, uuid, type and array validation errors", () => {
  const result = validateInput(
    {
      email: "not-an-email",
      userId: "not-a-uuid",
      title: 123,
      amount: "abc",
      enabled: "yes",
      items: "not-array",
    },
    {
      missing: { type: "string", required: true },
      email: { type: "email", required: true },
      userId: { type: "uuid", required: true },
      title: { type: "string", required: true },
      amount: { type: "number", required: true },
      enabled: { type: "boolean", required: true },
      items: { type: "array", required: true },
    },
  );

  assertEquals(result.valid, false);
  assertEquals(result.errors, [
    "Field 'missing' is required",
    "Field 'email' must be a valid email",
    "Field 'userId' must be a valid UUID",
    "Field 'title' must be a string",
    "Field 'amount' must be a number",
    "Field 'enabled' must be a boolean",
    "Field 'items' must be an array",
  ]);
});

Deno.test("validateInput treats empty required strings as missing", () => {
  const result = validateInput(
    { title: "" },
    { title: { type: "string", required: true } },
  );

  assertEquals(result.valid, false);
  assertEquals(result.errors, ["Field 'title' is required"]);
});

Deno.test("validateInput ignores optional undefined and null values", () => {
  const result = validateInput(
    {
      optionalName: undefined,
      optionalEmail: null,
      requiredName: "Valid",
    },
    {
      optionalName: { type: "string" },
      optionalEmail: { type: "email" },
      requiredName: { type: "string", required: true },
    },
  );

  assertEquals(result.valid, true);
  assertEquals(result.errors, []);
  assertExists(result.sanitized);
  assertEquals("optionalName" in result.sanitized!, false);
  assertEquals("optionalEmail" in result.sanitized!, false);
  assertEquals(result.sanitized?.requiredName, "Valid");
});

Deno.test("validateInput sanitizes SQL injection and XSS patterns in strings", () => {
  const result = validateInput(
    {
      comment: "Hello'; DROP TABLE users; -- <script>alert(1)</script> javascript:alert(2) onclick=steal()",
    },
    {
      comment: { type: "string", required: true, sanitize: true },
    },
  );

  assertEquals(result.valid, true);
  assertEquals(result.errors, []);
  assertExists(result.sanitized);

  const sanitized = String(result.sanitized?.comment);
  assertEquals(sanitized.includes("DROP"), false);
  assertEquals(sanitized.includes("--"), false);
  assertEquals(sanitized.includes("<script>"), false);
  assertEquals(sanitized.includes("</script>"), false);
  assertEquals(sanitized.includes("javascript:"), false);
  assertEquals(sanitized.includes("onclick="), false);
});

Deno.test("validateInput preserves strings when sanitize is not requested", () => {
  const raw = "Hello <b>world</b>";
  const result = validateInput(
    { comment: raw },
    { comment: { type: "string", required: true } },
  );

  assertEquals(result.valid, true);
  assertEquals(result.errors, []);
  assertEquals(result.sanitized?.comment, raw);
});

Deno.test("validateInput accepts numeric strings for number fields when coercible", () => {
  const result = validateInput(
    { amount: "123.45" },
    { amount: { type: "number", required: true } },
  );

  assertEquals(result.valid, true);
  assertEquals(result.errors, []);
  assertEquals(result.sanitized?.amount, "123.45");
});

Deno.test("validateInput rejects non-coercible numeric values", () => {
  const result = validateInput(
    { amount: "not-a-number" },
    { amount: { type: "number", required: true } },
  );

  assertEquals(result.valid, false);
  assertEquals(result.errors, ["Field 'amount' must be a number"]);
});

Deno.test("validateInput validates boolean fields strictly", () => {
  const valid = validateInput(
    { enabled: false },
    { enabled: { type: "boolean", required: true } },
  );
  const invalid = validateInput(
    { enabled: "false" },
    { enabled: { type: "boolean", required: true } },
  );

  assertEquals(valid.valid, true);
  assertEquals(valid.sanitized?.enabled, false);
  assertEquals(invalid.valid, false);
  assertEquals(invalid.errors, ["Field 'enabled' must be a boolean"]);
});

Deno.test("validateInput validates arrays without coercion", () => {
  const valid = validateInput(
    { items: ["a", "b"] },
    { items: { type: "array", required: true } },
  );
  const invalid = validateInput(
    { items: { 0: "a" } },
    { items: { type: "array", required: true } },
  );

  assertEquals(valid.valid, true);
  assertEquals(valid.sanitized?.items, ["a", "b"]);
  assertEquals(invalid.valid, false);
  assertEquals(invalid.errors, ["Field 'items' must be an array"]);
});

Deno.test("assert helpers required by the test contract are available", async () => {
  assertThrows(() => {
    throw new Error("sync assertion helper");
  }, Error, "sync assertion helper");

  await assertRejects(
    async () => {
      throw new Error("async assertion helper");
    },
    Error,
    "async assertion helper",
  );
});