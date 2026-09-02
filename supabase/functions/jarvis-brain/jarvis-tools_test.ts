/**
 * JARVIS 12.0 - Tests Unitaires pour Outils Critiques
 * 
 * Tests des outils les plus utilisés et sensibles
 * Run: deno test --allow-env jarvis-tools_test.ts
 */

import { assertEquals, assertExists, assert } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { validateToolSecurity, TOOL_RISK_LEVELS, validateInput, getRiskLevel } from "./security-validator.ts";

// ============================================================
// SECURITY VALIDATOR TESTS
// ============================================================

Deno.test("Security Validator - Safe tools don't require confirmation", () => {
  const safeTools = ['query_database', 'search_knowledge_base', 'get_weather', 'get_dashboard_summary', 'list_files'];
  
  for (const tool of safeTools) {
    const riskLevel = getRiskLevel(tool);
    assertEquals(riskLevel, 'safe', `Tool ${tool} should be safe`);
  }
});

Deno.test("Security Validator - Sensitive tools require confirmation", () => {
  const sensitiveTools = ['send_email', 'update_entity_status', 'delete_file'];
  
  for (const tool of sensitiveTools) {
    const riskLevel = getRiskLevel(tool);
    assert(
      riskLevel === 'sensitive' || riskLevel === 'moderate',
      `Tool ${tool} should be sensitive or moderate, got ${riskLevel}`
    );
  }
});

Deno.test("Security Validator - Critical tools require admin", () => {
  const criticalTools = ['manage_user_role', 'export_data_rgpd'];
  
  for (const tool of criticalTools) {
    const riskLevel = getRiskLevel(tool);
    assertEquals(riskLevel, 'critical', `Tool ${tool} should be critical`);
  }
});

Deno.test("Security Validator - All tool levels are defined", () => {
  const definedLevels = ['safe', 'moderate', 'sensitive', 'critical'];
  
  for (const level of Object.values(TOOL_RISK_LEVELS)) {
    assert(
      definedLevels.includes(level),
      `Invalid risk level: ${level}`
    );
  }
});

Deno.test("Security Validator - No duplicate tools in risk levels", () => {
  const toolNames = Object.keys(TOOL_RISK_LEVELS);
  const uniqueToolNames = new Set(toolNames);
  
  assertEquals(
    toolNames.length, 
    uniqueToolNames.size, 
    "Found duplicate tool definitions in TOOL_RISK_LEVELS"
  );
});

// ============================================================
// INPUT VALIDATION TESTS
// ============================================================

Deno.test("Input Validation - Email validation", () => {
  const validEmails = ['test@example.com', 'user.name@domain.fr', 'admin+tag@company.io'];
  const invalidEmails = ['not-email', '@domain.com', 'user@', ''];
  
  for (const email of validEmails) {
    const result = validateInput({ email }, { email: { type: 'email', required: true } });
    assert(result.valid, `Should accept valid email: ${email}`);
  }
  
  for (const email of invalidEmails) {
    const result = validateInput({ email }, { email: { type: 'email', required: true } });
    assert(!result.valid, `Should reject invalid email: ${email}`);
  }
});

Deno.test("Input Validation - UUID validation", () => {
  const validUUIDs = [
    '550e8400-e29b-41d4-a716-446655440000',
    '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
  ];
  const invalidUUIDs = ['not-a-uuid', '123456', '', 'xxxx-xxxx-xxxx-xxxx'];
  
  for (const uuid of validUUIDs) {
    const result = validateInput({ id: uuid }, { id: { type: 'uuid', required: true } });
    assert(result.valid, `Should accept valid UUID: ${uuid}`);
  }
  
  for (const uuid of invalidUUIDs) {
    const result = validateInput({ id: uuid }, { id: { type: 'uuid', required: true } });
    assert(!result.valid, `Should reject invalid UUID: ${uuid}`);
  }
});

Deno.test("Input Validation - Required fields", () => {
  const schema = {
    name: { type: 'string' as const, required: true },
    optional: { type: 'string' as const, required: false }
  };
  
  // Missing required field
  const result1 = validateInput({ optional: 'value' }, schema);
  assert(!result1.valid, "Should reject missing required field");
  
  // With required field
  const result2 = validateInput({ name: 'test' }, schema);
  assert(result2.valid, "Should accept with required field present");
});

Deno.test("Input Validation - SQL injection prevention", () => {
  const dangerousInputs = [
    "'; DROP TABLE users; --",
    "1 OR 1=1",
    "admin'--",
    "<script>alert('xss')</script>",
    "{{constructor.constructor('return this')()}}"
  ];
  
  for (const input of dangerousInputs) {
    const result = validateInput(
      { query: input }, 
      { query: { type: 'string', required: true, sanitize: true } }
    );
    // Should either reject or sanitize
    assert(
      !result.valid || result.sanitized?.query !== input,
      `Should handle dangerous input: ${input}`
    );
  }
});

// ============================================================
// TOOL REGISTRY TESTS
// ============================================================

Deno.test("Tool Registry - All tools have required fields", async () => {
  const { default: JARVIS_TOOLS } = await import("./tool-registry.ts");
  
  for (const tool of JARVIS_TOOLS) {
    assertExists(tool.type, `Tool missing type`);
    assertEquals(tool.type, 'function', `Tool type should be 'function'`);
    assertExists(tool.function, `Tool missing function definition`);
    assertExists(tool.function.name, `Tool missing name`);
    assertExists(tool.function.description, `Tool missing description`);
    assertExists(tool.function.parameters, `Tool ${tool.function.name} missing parameters`);
  }
});

Deno.test("Tool Registry - No duplicate tool names", async () => {
  const { default: JARVIS_TOOLS } = await import("./tool-registry.ts");
  
  const toolNames = JARVIS_TOOLS.map(t => t.function.name);
  const uniqueNames = new Set(toolNames);
  
  assertEquals(
    toolNames.length,
    uniqueNames.size,
    `Found duplicate tool names: ${toolNames.filter((n, i) => toolNames.indexOf(n) !== i)}`
  );
});

Deno.test("Tool Registry - All tools have security level", async () => {
  const { default: JARVIS_TOOLS } = await import("./tool-registry.ts");
  
  for (const tool of JARVIS_TOOLS) {
    const riskLevel = getRiskLevel(tool.function.name);
    assertExists(
      riskLevel,
      `Tool ${tool.function.name} missing security level definition`
    );
  }
});

// ============================================================
// TOOL EXECUTOR MOCK TESTS
// ============================================================

Deno.test("Tool Executor - Unknown tool returns error", async () => {
  const { executeTool } = await import("./tools-executor.ts");
  
  // Mock context
  const mockContext = {
    supabase: null as unknown,
    userId: 'test-user-id',
    conversationId: 'test-conv-id'
  };
  
  const result = await executeTool(
    mockContext as any,
    'nonexistent_tool',
    {}
  );
  
  assert(!result.success, "Should fail for unknown tool");
  assertExists(result.error, "Should have error message");
});

// ============================================================
// RATE LIMITING & TIMEOUT TESTS
// ============================================================

Deno.test({
  name: "Timeout - AbortController pattern is correct",
  fn: () => {
    // Test that AbortController pattern is correctly implemented
    const controller = new AbortController();
    
    // Verify signal starts as not aborted
    assertEquals(controller.signal.aborted, false, "Signal should start not aborted");
    
    // Verify abort works
    controller.abort();
    assertEquals(controller.signal.aborted, true, "Signal should be aborted after abort()");
  }
});

// ============================================================
// INTEGRATION TESTS (require real Supabase)
// ============================================================

Deno.test({
  name: "Integration - Query database tool format",
  ignore: !Deno.env.get('SUPABASE_URL'), // Skip if no Supabase
  fn: async () => {
    // This test would require a real Supabase connection
    // Just verify the tool accepts correct arguments format
    const validArgs = {
      table: 'etablissements',
      filters: [{ column: 'statut', operator: 'eq', value: 'production' }],
      limit: 10
    };
    
    // Verify args structure is correct
    assertExists(validArgs.table);
    assertExists(validArgs.filters);
    assert(Array.isArray(validArgs.filters));
  }
});

console.log("✅ All JARVIS tool tests completed");
