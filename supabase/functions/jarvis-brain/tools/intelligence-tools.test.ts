import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  executeCompareAnalysis,
  executeGenerateBriefing,
  executeSuggestActions,
} from "./intelligence-tools.ts";

type QueryOperation = {
  method: string;
  args: unknown[];
};

type MockQuery = {
  table: string;
  operations: QueryOperation[];
};

type SupabaseResponse = {
  data?: unknown;
  error?: unknown;
};

function createSupabaseMock(
  resolver: (query: MockQuery) => SupabaseResponse | Promise<SupabaseResponse>,
) {
  return {
    from(table: string) {
      const query: MockQuery = { table, operations: [] };
      const builder: Record<string, unknown> = {};

      const chainableMethods = [
        "select",
        "or",
        "order",
        "limit",
        "gte",
        "lte",
        "lt",
        "gt",
        "eq",
        "neq",
        "not",
        "in",
        "is",
        "single",
        "range",
        "ilike",
        "like",
      ];

      for (const method of chainableMethods) {
        builder[method] = (...args: unknown[]) => {
          query.operations.push({ method, args });
          return builder;
        };
      }

      builder.then = (
        onFulfilled?: (value: SupabaseResponse) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => {
        return Promise.resolve()
          .then(() => resolver(query))
          .then(onFulfilled, onRejected);
      };

      builder.catch = (onRejected?: (reason: unknown) => unknown) => {
        return Promise.resolve()
          .then(() => resolver(query))
          .catch(onRejected);
      };

      builder.finally = (onFinally?: () => void) => {
        return Promise.resolve()
          .then(() => resolver(query))
          .finally(onFinally);
      };

      return builder;
    },
  };
}

function findOperation(query: MockQuery, method: string, firstArg?: unknown) {
  return query.operations.find((operation) =>
    operation.method === method &&
    (firstArg === undefined || operation.args[0] === firstArg)
  );
}

Deno.test("module exports intelligence tool executors", () => {
  assertEquals(typeof executeGenerateBriefing, "function");
  assertEquals(typeof executeCompareAnalysis, "function");
  assertEquals(typeof executeSuggestActions, "function");
});

Deno.test("test harness assertions are available", async () => {
  assertThrows(() => {
    throw new Error("sync failure");
  }, Error, "sync failure");

  await assertRejects(
    () => Promise.reject(new Error("async failure")),
    Error,
    "async failure",
  );
});

Deno.test("executeGenerateBriefing builds a daily briefing with concrete metrics, insights and recommendations", async () => {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const todayAt1 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 1);
  const todayAt2 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 2);
  const todayAt3 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 3);
  const todayAt4 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 4);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const tasks = [
    ...Array.from({ length: 6 }, (_, index) => ({
      id: `done-${index}`,
      titre: `Tâche terminée ${index}`,
      statut: "Terminé",
      priorite: "normale",
      echeance: tomorrow.toISOString(),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    })),
    {
      id: "late-1",
      titre: "Contrat en retard",
      statut: "En cours",
      priorite: "critique",
      echeance: yesterday.toISOString(),
      created_at: twoDaysAgo.toISOString(),
      updated_at: now.toISOString(),
    },
    {
      id: "late-2",
      titre: "Relance en retard",
      statut: "À faire",
      priorite: "haute",
      echeance: twoDaysAgo.toISOString(),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    },
  ];

  const emails = Array.from({ length: 11 }, (_, index) => ({
    id: `email-${index}`,
    subject: `Email ${index}`,
    last_message_date: now.toISOString(),
    unread_count: 1,
    category: "inbox",
    sentiment_score: index === 0 ? -0.8 : 0.2,
  }));

  const tickets = [
    {
      id: "ticket-critical",
      titre: "Panne critique",
      status: "open",
      priority: "critical",
      created_at: now.toISOString(),
      resolved_at: null,
    },
    {
      id: "ticket-high",
      titre: "Incident important",
      status: "in_progress",
      priority: "high",
      created_at: now.toISOString(),
      resolved_at: null,
    },
    {
      id: "ticket-resolved",
      titre: "Question résolue",
      status: "resolved",
      priority: "medium",
      created_at: now.toISOString(),
      resolved_at: now.toISOString(),
    },
  ];

  const events = [
    { id: "event-1", title: "Réunion 1", start_time: todayAt1.toISOString(), end_time: todayAt1.toISOString(), status: "confirmed" },
    { id: "event-2", title: "Réunion 2", start_time: todayAt2.toISOString(), end_time: todayAt2.toISOString(), status: "confirmed" },
    { id: "event-3", title: "Réunion 3", start_time: todayAt3.toISOString(), end_time: todayAt3.toISOString(), status: "confirmed" },
    { id: "event-4", title: "Réunion 4", start_time: todayAt4.toISOString(), end_time: todayAt4.toISOString(), status: "confirmed" },
    { id: "event-5", title: "Demain", start_time: tomorrow.toISOString(), end_time: tomorrow.toISOString(), status: "confirmed" },
  ];

  const revenues = [
    { id: "rev-1", montant: 1000, date_reception: now.toISOString(), statut: "encaissé" },
    { id: "rev-2", montant: 500, date_reception: now.toISOString(), statut: "en attente" },
    { id: "rev-3", montant: 250, date_reception: now.toISOString(), statut: "prévu" },
  ];

  const etablissements = [
    { id: "client-1", nom: "Clinique A", statut: "production", updated_at: now.toISOString() },
    { id: "client-2", nom: "Clinique B", statut: "production", updated_at: now.toISOString() },
    { id: "prospect-1", nom: "Prospect C", statut: "prospect", updated_at: now.toISOString() },
  ];

  const supabase = createSupabaseMock((query) => {
    const dataByTable: Record<string, unknown[]> = {
      taches: tasks,
      email_threads: emails,
      support_tickets: tickets,
      calendar_events: events,
      tresorerie_revenus: revenues,
      etablissements,
    };

    assertExists(findOperation(query, "select"));
    return { data: dataByTable[query.table] ?? [], error: null };
  });

  const result = await executeGenerateBriefing(
    { supabase, userId: "user-1" } as never,
    {
      briefing_type: "daily",
      focus_areas: ["tasks", "finance"],
      include_recommendations: true,
    },
  );

  assertEquals(result.success, true);
  assertExists(result.data);

  const briefing = result.data as {
    period: string;
    summary: {
      tasks: { completed: number; created: number; overdue: number };
      emails: { unread: number; urgent: number; total: number };
      support: { open: number; resolved: number; critical: number };
      calendar: { today: number };
      revenue: { total: number; pending: number };
      clients: { active: number; new: number };
    };
    insights: string[];
    recommendations: string[];
    focus_areas: string[];
  };

  assertEquals(briefing.period, "daily");
  assertEquals(briefing.summary.tasks.completed, 6);
  assertEquals(briefing.summary.tasks.overdue, 2);
  assertEquals(briefing.summary.emails.unread, 11);
  assertEquals(briefing.summary.emails.urgent, 1);
  assertEquals(briefing.summary.emails.total, 11);
  assertEquals(briefing.summary.support.open, 2);
  assertEquals(briefing.summary.support.resolved, 1);
  assertEquals(briefing.summary.support.critical, 2);
  assertEquals(briefing.summary.calendar.today, 4);
  assertEquals(briefing.summary.revenue.total, 1750);
  assertEquals(briefing.summary.revenue.pending, 750);
  assertEquals(briefing.summary.clients.active, 3);
  assertEquals(briefing.summary.clients.new, 2);
  assertEquals(briefing.focus_areas, ["tasks", "finance"]);

  assertEquals(briefing.insights.includes("⚠️ 2 tâche(s) en retard nécessitent attention"), true);
  assertEquals(briefing.insights.includes("✅ Excellente productivité: 6 tâches terminées"), true);
  assertEquals(briefing.insights.includes("📧 11 emails non lus en attente"), true);
  assertEquals(briefing.insights.includes("🚨 1 email(s) avec sentiment négatif détecté"), true);
  assertEquals(briefing.insights.includes("🎫 2 ticket(s) critique(s) en cours"), true);
  assertEquals(briefing.insights.includes("📊 Taux de résolution: 33%"), true);
  assertEquals(briefing.insights.includes("📅 Journée chargée: 4 événements aujourd'hui"), true);
  assertEquals(briefing.insights.includes("💰 750€ de revenus en attente d'encaissement"), true);
  assertEquals(briefing.insights.includes("🏥 2 nouvel(aux) client(s) en production"), true);

  assertEquals(briefing.recommendations.includes("Prioriser les 2 tâches les plus urgentes"), true);
  assertEquals(briefing.recommendations.includes("Planifier 30 min pour traiter les emails prioritaires"), true);
  assertEquals(briefing.recommendations.includes("Vérifier les emails urgents en priorité"), true);
  assertEquals(briefing.recommendations.includes("Escalader les tickets critiques si nécessaire"), true);
  assertEquals(briefing.recommendations.includes("Prévoir des pauses entre les réunions"), true);
  assertEquals(briefing.recommendations.includes("Relancer les factures en attente de paiement"), true);
});

Deno.test("executeGenerateBriefing omits recommendations when include_recommendations is false", async () => {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const supabase = createSupabaseMock((query) => {
    if (query.table === "taches") {
      return {
        data: [{
          id: "late-task",
          titre: "Tâche en retard",
          statut: "En cours",
          priorite: "haute",
          echeance: yesterday.toISOString(),
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        }],
        error: null,
      };
    }

    return { data: [], error: null };
  });

  const result = await executeGenerateBriefing(
    { supabase, userId: "user-1" } as never,
    { briefing_type: "weekly", include_recommendations: false },
  );

  assertEquals(result.success, true);

  const briefing = result.data as {
    period: string;
    summary: { tasks: { overdue: number } };
    recommendations: string[];
    focus_areas: string[];
  };

  assertEquals(briefing.period, "weekly");
  assertEquals(briefing.summary.tasks.overdue, 1);
  assertEquals(briefing.recommendations, []);
  assertEquals(briefing.focus_areas, ["tasks", "emails", "support", "calendar"]);
});

Deno.test("executeGenerateBriefing returns a failure result when a Supabase query rejects", async () => {
  const supabase = createSupabaseMock((query) => {
    if (query.table === "email_threads") {
      throw new Error("database unavailable");
    }

    return { data: [], error: null };
  });

  const result = await executeGenerateBriefing(
    { supabase, userId: "user-1" } as never,
    { briefing_type: "daily" },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "database unavailable");
  assertEquals(typeof result.execution_time_ms, "number");
});

Deno.test("executeCompareAnalysis compares periods with rounded changes, trends and positive analysis", async () => {
  const calls: Record<string, number> = {
    taches: 0,
    tresorerie_revenus: 0,
  };

  const supabase = createSupabaseMock((query) => {
    if (query.table === "taches") {
      calls.taches += 1;
      return calls.taches === 1
        ? {
          data: [
            { statut: "Terminé" },
            { statut: "Terminé" },
            { statut: "Terminé" },
            { statut: "Terminé" },
            { statut: "Terminé" },
            { statut: "Terminé" },
            { statut: "En cours" },
          ],
          error: null,
        }
        : {
          data: [
            { statut: "Terminé" },
            { statut: "Terminé" },
            { statut: "Terminé" },
            { statut: "Terminé" },
            { statut: "À faire" },
          ],
          error: null,
        };
    }

    if (query.table === "tresorerie_revenus") {
      calls.tresorerie_revenus += 1;
      return calls.tresorerie_revenus === 1
        ? { data: [{ montant: 1000 }, { montant: 500 }], error: null }
        : { data: [{ montant: 1000 }], error: null };
    }

    return { data: [], error: null };
  });

  const result = await executeCompareAnalysis(
    { supabase, userId: "user-1" } as never,
    {
      compare_type: "periods",
      entity_a: "current",
      entity_b: "previous",
    },
  );

  assertEquals(result.success, true);

  const data = result.data as {
    compare_type: string;
    period_a: string;
    period_b: string;
    metrics: {
      tasks_completed: {
        current: number;
        previous: number;
        change_percent: number;
        trend: string;
      };
      revenue: {
        current: number;
        previous: number;
        change_percent: number;
        trend: string;
      };
    };
    analysis: string;
  };

  assertEquals(data.compare_type, "periods");
  assertEquals(data.period_a, "Mois en cours");
  assertEquals(data.period_b, "Mois dernier");
  assertEquals(data.metrics.tasks_completed.current, 6);
  assertEquals(data.metrics.tasks_completed.previous, 4);
  assertEquals(data.metrics.tasks_completed.change_percent, 50);
  assertEquals(data.metrics.tasks_completed.trend, "up");
  assertEquals(data.metrics.revenue.current, 1500);
  assertEquals(data.metrics.revenue.previous, 1000);
  assertEquals(data.metrics.revenue.change_percent, 50);
  assertEquals(data.metrics.revenue.trend, "up");
  assertEquals(data.analysis, "📈 Tendance positive sur tous les indicateurs");
});

Deno.test("executeCompareAnalysis compares two establishments and their completed tasks", async () => {
  const establishments: Record<string, unknown> = {
    "etab-a": {
      id: "etab-a",
      nom: "Clinique Alpha",
      statut: "production",
      ca_mensuel_moyen: 12000,
    },
    "etab-b": {
      id: "etab-b",
      nom: "Clinique Beta",
      statut: "pilote",
      ca_mensuel_moyen: 8000,
    },
  };

  const tasksByEstablishment: Record<string, unknown[]> = {
    "etab-a": [
      { statut: "Terminé" },
      { statut: "Terminé" },
      { statut: "En cours" },
    ],
    "etab-b": [
      { statut: "Terminé" },
      { statut: "À faire" },
    ],
  };

  const supabase = createSupabaseMock((query) => {
    if (query.table === "etablissements") {
      const id = findOperation(query, "eq", "id")?.args[1] as string;
      return { data: establishments[id], error: null };
    }

    if (query.table === "taches") {
      const id = findOperation(query, "eq", "etablissement_id")?.args[1] as string;
      return { data: tasksByEstablishment[id] ?? [], error: null };
    }

    return { data: [], error: null };
  });

  const result = await executeCompareAnalysis(
    { supabase, userId: "user-1" } as never,
    {
      compare_type: "entities",
      entity_a: "etab-a",
      entity_b: "etab-b",
    },
  );

  assertEquals(result.success, true);

  const data = result.data as {
    compare_type: string;
    entity_a: { id: string; name: string; statut: string };
    entity_b: { id: string; name: string; statut: string };
    comparison: {
      ca_mensuel: { a: number; b: number };
      tasks_completed: { a: number; b: number };
    };
  };

  assertEquals(data.compare_type, "entities");
  assertEquals(data.entity_a, { id: "etab-a", name: "Clinique Alpha", statut: "production" });
  assertEquals(data.entity_b, { id: "etab-b", name: "Clinique Beta", statut: "pilote" });
  assertEquals(data.comparison.ca_mensuel, { a: 12000, b: 8000 });
  assertEquals(data.comparison.tasks_completed, { a: 2, b: 1 });
});

Deno.test("executeCompareAnalysis returns a business error when an establishment is missing", async () => {
  const supabase = createSupabaseMock((query) => {
    if (query.table === "etablissements") {
      const id = findOperation(query, "eq", "id")?.args[1];
      if (id === "missing") {
        return { data: null, error: { message: "not found" } };
      }

      return {
        data: {
          id,
          nom: "Clinique existante",
          statut: "production",
          ca_mensuel_moyen: 5000,
        },
        error: null,
      };
    }

    return { data: [], error: null };
  });

  const result = await executeCompareAnalysis(
    { supabase, userId: "user-1" } as never,
    {
      compare_type: "entities",
      entity_a: "existing",
      entity_b: "missing",
    },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "Établissement(s) non trouvé(s)");
});

Deno.test("executeCompareAnalysis rejects unsupported comparison types with a stable error message", async () => {
  const supabase = createSupabaseMock(() => ({ data: [], error: null }));

  const result = await executeCompareAnalysis(
    { supabase, userId: "user-1" } as never,
    {
      compare_type: "metrics",
      entity_a: "a",
      entity_b: "b",
    },
  );

  assertEquals(result.success, false);
  assertEquals(result.error, "Type de comparaison non supporté");
});

Deno.test("executeSuggestActions prioritizes overdue critical tasks and unassigned high-priority tickets", async () => {
  const now = new Date();
  const overdueByAlmostThreeDays = new Date(now.getTime() - 49 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const threeWeeksAgo = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000);

  const supabase = createSupabaseMock((query) => {
    if (query.table === "taches") {
      return {
        data: [{
          id: "task-critical",
          titre: "Finaliser le dossier prioritaire",
          echeance: overdueByAlmostThreeDays.toISOString(),
          priorite: "critique",
          etablissement_id: "etab-1",
        }],
        error: null,
      };
    }

    if (query.table === "support_tickets") {
      return {
        data: [{
          id: "ticket-high",
          titre: "Incident production",
          priority: "high",
          created_at: now.toISOString(),
        }],
        error: null,
      };
    }

    if (query.table === "email_threads") {
      return {
        data: [{
          id: "email-old",
          subject: "Question client en attente",
          last_message_date: twoDaysAgo.toISOString(),
        }],
        error: null,
      };
    }

    if (query.table === "etablissements") {
      return {
        data: [{
          id: "prospect-cold",
          nom: "Prospect sans relance",
          updated_at: threeWeeksAgo.toISOString(),
        }],
        error: null,
      };
    }

    return { data: [], error: null };
  });

  const result = await executeSuggestActions(
    { supabase, userId: "user-1" } as never,
    {
      context_type: "global",
      max_suggestions: 2,
    },
  );

  assertEquals(result.success, true);
  assertExists(result.data);

  const data = result.data as {
    suggestions?: Array<{
      priority: string;
      category: string;
      action: string;
      reason: string;
      entity_id?: string;
      entity_type?: string;
    }>;
  };

  assertExists(data.suggestions);
  assertEquals(data.suggestions.length, 2);

  assertEquals(data.suggestions[0].priority, "critical");
  assertEquals(data.suggestions[0].category, "tasks");
  assertEquals(data.suggestions[0].action, 'Traiter la tâche "Finaliser le dossier prioritaire"');
  assertEquals(data.suggestions[0].reason, "En retard depuis 3 jour(s)");
  assertEquals(data.suggestions[0].entity_id, "task-critical");
  assertEquals(data.suggestions[0].entity_type, "tache");

  assertEquals(data.suggestions[1].priority, "high");
  assertEquals(data.suggestions[1].category, "support");
  assertEquals(data.suggestions[1].action, 'Assigner le ticket "Incident production"');
  assertEquals(data.suggestions[1].reason, "Ticket prioritaire sans responsable");
  assertEquals(data.suggestions[1].entity_id, "ticket-high");
  assertEquals(data.suggestions[1].entity_type, "ticket");
});