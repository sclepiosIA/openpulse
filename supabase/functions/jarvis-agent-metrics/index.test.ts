import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

const INDEX_URL = new URL("./index.ts", import.meta.url);

async function importModuleUnderTest() {
  return await import("./index.ts");
}

async function readIndexSource(): Promise<string> {
  return await Deno.readTextFile(INDEX_URL);
}

function extractDefaultAgents(source: string): string[] {
  const match = source.match(/const\s+agentIds\s*=\s*agentId\s*\?\s*\[agentId\]\s*:\s*\[([\s\S]*?)\]\s*;/);
  if (!match) {
    throw new Error("Default agent list not found");
  }

  const agents = Array.from(match[1].matchAll(/'([^']+)'/g), (entry) => entry[1]);
  if (agents.length === 0) {
    throw new Error("Default agent list not found");
  }

  return agents;
}

function extractAgentCaseBlock(source: string, agentId: string): string {
  const escapedAgentId = agentId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`case '${escapedAgentId}': \\{([\\s\\S]*?)\\n\\s*break;`));
  if (!match) {
    throw new Error(`KPI block not found for ${agentId}`);
  }

  return match[1];
}

function extractObjectBlockAfter(source: string, marker: string): string {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error(`Marker not found: ${marker}`);
  }

  const openIndex = source.indexOf("{", markerIndex);
  if (openIndex === -1) {
    throw new Error(`Opening brace not found after marker: ${marker}`);
  }

  let depth = 0;
  for (let index = openIndex; index < source.length; index++) {
    if (source[index] === "{") depth++;
    if (source[index] === "}") depth--;

    if (depth === 0) {
      return source.slice(openIndex, index + 1);
    }
  }

  throw new Error(`Object block not closed after marker: ${marker}`);
}

Deno.test("module is referenced by relative import path and source declares Supabase Edge handler", async () => {
  const source = await readIndexSource();

  assertExists(importModuleUnderTest);
  assertEquals(source.includes('import { serve } from "https://deno.land/std@0.168.0/http/server.ts";'), true);
  assertEquals(source.includes('import { createClient } from "@supabase/supabase-js";'), true);
  assertEquals(source.includes("serve(async (req) => {"), true);
  assertEquals(source.includes("validateServiceOrUser(req)"), true);
  assertEquals(source.includes("buildErrorResponse('jarvis-agent-metrics', error, corsHeaders, 500)"), true);
});

Deno.test("OPTIONS branch returns CORS preflight response before auth and database logic", async () => {
  const source = await readIndexSource();
  const optionsIndex = source.indexOf("if (req.method === 'OPTIONS')");
  const authIndex = source.indexOf("const auth = await validateServiceOrUser(req)");
  const clientIndex = source.indexOf("const supabase = createClient");

  assertEquals(optionsIndex > -1, true);
  assertEquals(authIndex > -1, true);
  assertEquals(clientIndex > -1, true);
  assertEquals(optionsIndex < authIndex, true);
  assertEquals(authIndex < clientIndex, true);
  assertEquals(
    /if\s*\(\s*req\.method\s*===\s*'OPTIONS'\s*\)\s*\{\s*return\s+new\s+Response\s*\(\s*null\s*,\s*\{\s*headers:\s*corsHeaders\s*\}\s*\)\s*;/.test(source),
    true,
  );
  assertEquals(source.includes("'Access-Control-Allow-Origin': origineAutorisee()"), true);
  assertEquals(
    source.includes("'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret'"),
    true,
  );
});

Deno.test("default team metrics target the six specialized agents in dashboard order", async () => {
  const source = await readIndexSource();

  assertEquals(extractDefaultAgents(source), [
    "sophia",
    "marcus",
    "olivia",
    "noah",
    "emma",
    "alex",
  ]);
});

Deno.test("domain KPI blocks expose expected business metrics and tables per agent", async () => {
  const source = await readIndexSource();

  const expected: Record<string, { kpis: string[]; tables: string[] }> = {
    sophia: {
      kpis: ["nouveauxProspects", "contratsSignes"],
      tables: ["etablissements"],
    },
    marcus: {
      kpis: ["collaborateursActifs", "absencesEnAttente"],
      tables: ["profiles", "absences"],
    },
    olivia: {
      kpis: ["totalFacture", "facturesImpayees"],
      tables: ["factures"],
    },
    noah: {
      kpis: ["storiesCompletees", "velocite"],
      tables: ["rd_user_stories"],
    },
    emma: {
      kpis: ["ticketsResolus", "tempsResolutionMoyen"],
      tables: ["support_tickets"],
    },
    alex: {
      kpis: ["predictionsGenerees", "insightsDecouverts"],
      tables: ["jarvis_predictions", "ai_analysis_log"],
    },
  };

  for (const [agentId, contract] of Object.entries(expected)) {
    const block = extractAgentCaseBlock(source, agentId);

    for (const key of contract.kpis) {
      assertEquals(
        block.includes(`kpis.${key}`),
        true,
        `${agentId} should assign kpis.${key}`,
      );
    }

    for (const table of contract.tables) {
      assertEquals(
        block.includes(`.from('${table}')`),
        true,
        `${agentId} should query ${table}`,
      );
    }
  }
});

Deno.test("handler derives userId from JWT for non-service calls to prevent body userId override", async () => {
  const source = await readIndexSource();

  assertEquals(
    /const\s+userId\s*=\s*auth\.isServiceCall\s*\?\s*body\.userId\s*:\s*auth\.userId\s*;/.test(source),
    true,
  );
  assertEquals(source.includes("userId is required"), true);
  assertEquals(/if\s*\(\s*!auth\.authorized\s*\)/.test(source), true);
  assertEquals(source.includes("status: 401"), true);
  assertEquals(source.includes("status: 400"), true);
});

Deno.test("metric formulas keep rounded response time, success rate, and satisfaction values", async () => {
  const source = await readIndexSource();

  assertEquals(source.includes("avgResponseTimeMs: Math.round(avgResponseTimeMs)"), true);
  assertEquals(source.includes("successRate: Math.round(successRate * 100) / 100"), true);
  assertEquals(
    source.includes("satisfactionScore ? Math.round(satisfactionScore * 10) / 10 : null"),
    true,
  );
  assertEquals(
    source.includes("i.satisfaction_score === null || i.satisfaction_score >= 3"),
    true,
  );
  assertEquals(
    source.includes("const successRate = totalInteractions > 0 ? successfulInteractions / totalInteractions : 1"),
    true,
  );
});

Deno.test("tool and activity transformations sort, limit, and normalize interaction data", async () => {
  const source = await readIndexSource();

  assertEquals(source.includes("const toolCounts: Record<string, number> = {};"), true);
  assertEquals(source.includes("const calls = Array.isArray(i.tool_calls) ? i.tool_calls : [];"), true);
  assertEquals(source.includes("const toolName = tc.name || 'unknown';"), true);
  assertEquals(source.includes(".sort((a, b) => b.count - a.count)"), true);
  assertEquals(source.includes(".slice(0, 5)"), true);
  assertEquals(source.includes("const date = i.created_at.split('T')[0];"), true);
  assertEquals(source.includes(".sort((a, b) => a.date.localeCompare(b.date))"), true);
  assertEquals(source.includes(".slice(-7)"), true);
});

Deno.test("team totals aggregate interactions, response time, success rate, and rated satisfaction", async () => {
  const source = await readIndexSource();
  const teamTotalsBlock = extractObjectBlockAfter(source, "const teamTotals =");

  assertEquals(teamTotalsBlock.includes("totalInteractions: metrics.reduce((sum, m) => sum + m.totalInteractions, 0)"), true);
  assertEquals(teamTotalsBlock.includes("metrics.reduce((sum, m) => sum + m.avgResponseTimeMs, 0) / metrics.length"), true);
  assertEquals(teamTotalsBlock.includes("metrics.reduce((sum, m) => sum + m.successRate, 0) / metrics.length * 100"), true);
  assertEquals(teamTotalsBlock.includes("const rated = metrics.filter(m => m.satisfactionScore !== null);"), true);
  assertEquals(
    teamTotalsBlock.includes("Math.round(rated.reduce((sum, m) => sum + (m.satisfactionScore || 0), 0) / rated.length * 10) / 10"),
    true,
  );
});

Deno.test("metrics snapshot is stored with team or agent payload and requested period", async () => {
  const source = await readIndexSource();

  assertEquals(source.includes("await supabase.from('jarvis_agent_metrics').insert({"), true);
  assertEquals(source.includes("user_id: userId"), true);
  assertEquals(source.includes("agent_id: agentId || 'team'"), true);
  assertEquals(
    source.includes("metrics_data: agentId ? metrics[0] : { agents: metrics, totals: teamTotals }"),
    true,
  );
  assertEquals(source.includes("period_days: days"), true);
  assertEquals(
    source.includes("period: { days, startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString() }"),
    true,
  );
});

Deno.test("source parsers fail loudly when required structures are absent", async () => {
  assertThrows(
    () => extractDefaultAgents("const agentIds = agentId ? [agentId] : [];"),
    Error,
    "Default agent list not found",
  );

  assertThrows(
    () => extractObjectBlockAfter("const teamTotals = { totalInteractions: 0", "const teamTotals ="),
    Error,
    "Object block not closed",
  );

  await assertRejects(
    async () => {
      extractAgentCaseBlock("switch (agentId) { default: break; }", "sophia");
    },
    Error,
    "KPI block not found for sophia",
  );
});