import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  AGENTS,
  AGENT_LIST,
  ALL_AGENT_KEYWORDS,
  DOMAIN_TO_AGENT,
  SOPHIA,
  MARCUS,
  OLIVIA,
  NOAH,
  EMMA,
  ALEX,
  detectRequiredAgents,
  selectPrimaryAgent,
} from "./agent-definitions.ts";

const EXPECTED_AGENT_IDS = ["sophia", "marcus", "olivia", "noah", "emma", "alex"];

Deno.test("module exports the complete six-agent registry in expected order", () => {
  assertEquals(Object.keys(AGENTS), EXPECTED_AGENT_IDS);
  assertEquals(AGENT_LIST.map((agent) => agent.id), EXPECTED_AGENT_IDS);
  assertEquals(AGENT_LIST.length, 6);

  for (const id of EXPECTED_AGENT_IDS) {
    const agent = AGENTS[id as keyof typeof AGENTS];

    assertExists(agent);
    assertEquals(agent.id, id);
    assertEquals(agent.name, id.toUpperCase());
    assertEquals(agent.allowedTools.length > 0, true);
    assertEquals(agent.allowedTables.length > 0, true);
    assertEquals(agent.keywords.length > 0, true);
    assertEquals(agent.systemPrompt.includes("Tu es"), true);
    assertEquals(agent.color.startsWith("hsl("), true);
    assertEquals(agent.gradientFrom.startsWith("hsl("), true);
    assertEquals(agent.gradientTo.startsWith("hsl("), true);
  }
});

Deno.test("agent definitions contain expected domain-specific metadata and capabilities", () => {
  assertEquals(SOPHIA.displayName, "Sophia");
  assertEquals(SOPHIA.domain, "CRM & Commercial");
  assertEquals(SOPHIA.voice, "shimmer");
  assertEquals(SOPHIA.allowedTables.includes("etablissements"), true);
  assertEquals(SOPHIA.allowedTools.includes("schedule_meeting"), true);
  assertEquals(SOPHIA.keywords.includes("pipeline"), true);
  assertEquals(SOPHIA.systemPrompt.includes("alerter EMMA"), true);

  assertEquals(MARCUS.displayName, "Marcus");
  assertEquals(MARCUS.domain, "RH & People");
  assertEquals(MARCUS.voice, "echo");
  assertEquals(MARCUS.allowedTables.includes("rh_absences"), true);
  assertEquals(MARCUS.allowedTools.includes("calculate_payroll_kpis"), true);
  assertEquals(MARCUS.keywords.includes("recrutement"), true);
  assertEquals(MARCUS.systemPrompt.includes("confidentialité des données salariales"), true);

  assertEquals(OLIVIA.displayName, "Olivia");
  assertEquals(OLIVIA.domain, "Trésorerie & Finance");
  assertEquals(OLIVIA.voice, "alloy");
  assertEquals(OLIVIA.allowedTables.includes("factures"), true);
  assertEquals(OLIVIA.allowedTools.includes("sync_qonto_transactions"), true);
  assertEquals(OLIVIA.keywords.includes("impayé"), true);
  assertEquals(OLIVIA.systemPrompt.includes("formatage français (€)"), true);

  assertEquals(NOAH.displayName, "Noah");
  assertEquals(NOAH.domain, "R&D & Produit");
  assertEquals(NOAH.voice, "nova");
  assertEquals(NOAH.allowedTables.includes("rd_sprints"), true);
  assertEquals(NOAH.allowedTools.includes("manage_user_story"), true);
  assertEquals(NOAH.keywords.includes("vélocité"), true);
  assertEquals(NOAH.systemPrompt.includes("vocabulaire agile"), true);

  assertEquals(EMMA.displayName, "Emma");
  assertEquals(EMMA.domain, "Support & Clients");
  assertEquals(EMMA.voice, "fable");
  assertEquals(EMMA.allowedTables.includes("support_tickets"), true);
  assertEquals(EMMA.allowedTools.includes("search_knowledge_base"), true);
  assertEquals(EMMA.keywords.includes("sla"), true);
  assertEquals(EMMA.systemPrompt.includes("alerter NOAH"), true);

  assertEquals(ALEX.displayName, "Alex");
  assertEquals(ALEX.domain, "Analytics & BI");
  assertEquals(ALEX.voice, "onyx");
  assertEquals(ALEX.allowedTables.includes("ai_processing_log"), true);
  assertEquals(ALEX.allowedTools.includes("forecast_cashflow"), true);
  assertEquals(ALEX.keywords.includes("dashboard"), true);
  assertEquals(ALEX.systemPrompt.includes("comparaisons"), true);
});

Deno.test("agent definitions keep distinct identities, voices and domains", () => {
  assertEquals(new Set(AGENT_LIST.map((agent) => agent.id)).size, 6);
  assertEquals(new Set(AGENT_LIST.map((agent) => agent.voice)).size, 6);
  assertEquals(new Set(AGENT_LIST.map((agent) => agent.domain)).size, 6);

  assertEquals(AGENTS.sophia, SOPHIA);
  assertEquals(AGENTS.marcus, MARCUS);
  assertEquals(AGENTS.olivia, OLIVIA);
  assertEquals(AGENTS.noah, NOAH);
  assertEquals(AGENTS.emma, EMMA);
  assertEquals(AGENTS.alex, ALEX);
});

Deno.test("ALL_AGENT_KEYWORDS mirrors each agent keyword list", () => {
  assertEquals(ALL_AGENT_KEYWORDS.sophia, SOPHIA.keywords);
  assertEquals(ALL_AGENT_KEYWORDS.marcus, MARCUS.keywords);
  assertEquals(ALL_AGENT_KEYWORDS.olivia, OLIVIA.keywords);
  assertEquals(ALL_AGENT_KEYWORDS.noah, NOAH.keywords);
  assertEquals(ALL_AGENT_KEYWORDS.emma, EMMA.keywords);
  assertEquals(ALL_AGENT_KEYWORDS.alex, ALEX.keywords);
});

Deno.test("DOMAIN_TO_AGENT maps business domains to the expected specialized agents", () => {
  assertEquals(DOMAIN_TO_AGENT.crm, "sophia");
  assertEquals(DOMAIN_TO_AGENT.commercial, "sophia");
  assertEquals(DOMAIN_TO_AGENT.rh, "marcus");
  assertEquals(DOMAIN_TO_AGENT.people, "marcus");
  assertEquals(DOMAIN_TO_AGENT.tresorerie, "olivia");
  assertEquals(DOMAIN_TO_AGENT.finance, "olivia");
  assertEquals(DOMAIN_TO_AGENT.rd, "noah");
  assertEquals(DOMAIN_TO_AGENT.produit, "noah");
  assertEquals(DOMAIN_TO_AGENT.support, "emma");
  assertEquals(DOMAIN_TO_AGENT.client, "emma");
  assertEquals(DOMAIN_TO_AGENT.analytics, "alex");
  assertEquals(DOMAIN_TO_AGENT.bi, "alex");
});

Deno.test("detectRequiredAgents returns Sophia by default when no keyword matches", () => {
  assertEquals(detectRequiredAgents(""), ["sophia"]);
  assertEquals(detectRequiredAgents("zzz yyy xxx"), ["sophia"]);
  assertEquals(detectRequiredAgents("Quelle est la météo demain matin ?"), ["sophia"]);
});

Deno.test("detectRequiredAgents detects a single specialized agent from business keywords", () => {
  assertEquals(
    detectRequiredAgents("Relance le prospect de cet établissement pour avancer le pipeline"),
    ["sophia"],
  );

  assertEquals(
    detectRequiredAgents("Planifie les congés et absences du collaborateur en formation"),
    ["marcus"],
  );

  assertEquals(
    detectRequiredAgents("Quel est le solde Qonto et le montant des factures impayées ?"),
    ["olivia"],
  );

  assertEquals(
    detectRequiredAgents("Prépare le sprint, le backlog et les user stories de la prochaine release"),
    ["noah"],
  );

  assertEquals(
    detectRequiredAgents("Priorise les tickets support avec SLA à risque"),
    ["emma"],
  );

  assertEquals(
    detectRequiredAgents("Affiche le dashboard KPI avec les tendances de performance"),
    ["alex"],
  );
});

Deno.test("detectRequiredAgents is case-insensitive for matching keywords", () => {
  assertEquals(
    detectRequiredAgents("PIPELINE COMMERCIAL ET CONTRAT À SIGNER"),
    ["sophia"],
  );

  assertEquals(
    detectRequiredAgents("FACTURE QONTO BUDGET ET ENCAISSEMENT"),
    ["olivia"],
  );

  assertEquals(
    detectRequiredAgents("RAPPORT KPI PERFORMANCE OBJECTIF"),
    ["alex"],
  );
});

Deno.test("detectRequiredAgents detects multiple agents when a query crosses domains", () => {
  assertEquals(
    detectRequiredAgents("Factures impayées et tickets support à prioriser"),
    ["olivia", "emma"],
  );

  assertEquals(
    detectRequiredAgents("Prépare un bilan commercial financier"),
    ["sophia", "alex", "olivia"],
  );

  assertEquals(
    detectRequiredAgents("Un bug bloque un ticket support"),
    ["noah", "emma"],
  );
});

Deno.test("detectRequiredAgents applies generic meeting, report and briefing rules", () => {
  assertEquals(
    detectRequiredAgents("Organise une réunion avec toute l'équipe"),
    ["marcus", "sophia"],
  );

  assertEquals(
    detectRequiredAgents("Prépare un rapport financier commercial"),
    ["sophia", "alex", "olivia"],
  );

  assertEquals(
    detectRequiredAgents("Brief quotidien pour le standup du matin"),
    ["sophia", "marcus", "olivia", "noah", "emma", "alex"],
  );

  assertEquals(
    detectRequiredAgents("Point global pipeline, support, sprint et trésorerie"),
    ["sophia", "marcus", "olivia", "noah", "emma", "alex"],
  );
});

Deno.test("selectPrimaryAgent returns the first detected agent for regular requests", () => {
  assertEquals(
    selectPrimaryAgent("Relance le prospect principal du pipeline"),
    "sophia",
  );

  assertEquals(
    selectPrimaryAgent("Analyse les absences et les formations de l'équipe"),
    "marcus",
  );

  assertEquals(
    selectPrimaryAgent("Ticket support et facture impayée à traiter"),
    "olivia",
  );

  assertEquals(
    selectPrimaryAgent("Brief complet de la journée"),
    "sophia",
  );
});

Deno.test("selectPrimaryAgent prioritizes Alex for synthesis queries containing analytics intent", () => {
  assertEquals(
    selectPrimaryAgent("Fais une synthèse des KPI, tickets support et tendances"),
    "alex",
  );

  assertEquals(
    selectPrimaryAgent("Synthèse du dashboard de performance et des objectifs"),
    "alex",
  );
});

Deno.test("detectRequiredAgents throws for invalid non-string input", () => {
  assertThrows(
    () => detectRequiredAgents(undefined as unknown as string),
    TypeError,
  );

  assertThrows(
    () => detectRequiredAgents(42 as unknown as string),
    TypeError,
  );
});

Deno.test("detectRequiredAgents invalid input can be asserted through async rejection", async () => {
  await assertRejects(
    async () => {
      detectRequiredAgents(null as unknown as string);
    },
    TypeError,
  );
});

Deno.test("module can be dynamically imported without throwing", async () => {
  const imported = await import("./agent-definitions.ts");

  assertExists(imported.AGENTS);
  assertEquals(imported.AGENT_LIST.length, 6);
  assertEquals(imported.detectRequiredAgents("rapport kpi"), ["alex"]);
});

Deno.test("dynamic import resolves to expected pure exports", async () => {
  const imported = await import("./agent-definitions.ts");

  assertEquals(imported.selectPrimaryAgent("synthèse kpi"), "alex");
  assertEquals(imported.DOMAIN_TO_AGENT.finance, "olivia");
  assertEquals(imported.ALL_AGENT_KEYWORDS.emma.includes("support"), true);
});