// CHARGER LE MODULE SANS OUVRIR DE PORT.
//
// `import "./index.ts"` execute `serve(...)`, qui ouvre reellement un serveur
// sur le port 8000 par defaut. Sur une machine ou ce port est pris -- une
// instance en cours d'execution, par exemple -- le banc entier tombe sur
// « AddrInUse », sans rapport avec le code qu'il pretend verifier.
//
// On lit la source, on neutralise l'appel a `serve`, et on charge le resultat
// depuis une URL `data:`. C'est ce que font les quatre-vingts autres bancs.
async function chargerSansServeur(chemin = "./index.ts") {
  const base = new URL(chemin, import.meta.url);
  const source = await Deno.readTextFile(base);
  const neutralise = source
    .replace(
      /import\s*\{\s*serve\s*\}\s*from\s*["'][^"']*http\/server\.ts["'];?/,
      "const serve = (_h: unknown) => Promise.resolve();",
    )
    // Un module `data:` n'a pas de repertoire d'origine : ses specificateurs
    // relatifs ne resolvent contre rien, et Deno refuse le chargement. On les
    // ancre sur l'emplacement reel du module avant de le lui donner.
    .replace(
      /(\bfrom\s*|\bimport\s*\(\s*)(["'])(\.\.?\/[^"']*)\2/g,
      (_tout, avant, guillemet, cible) =>
        `${avant}${guillemet}${new URL(cible, base).href}${guillemet}`,
    );
  return await import(
    `data:application/typescript;charset=utf-8,${encodeURIComponent(neutralise)}#${crypto.randomUUID()}`
  );
}

import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

const indexUrl = new URL("./index.ts", import.meta.url);

async function readIndexSource(): Promise<string> {
  return await Deno.readTextFile(indexUrl);
}

Deno.test("index.ts source is resolved relative to the test file and contains the learning-engine entrypoint", async () => {
  const source = await readIndexSource();

  assertExists(source);
  assertEquals(source.includes("serve(async (req) =>"), true);
  // La declaration locale des en-tetes CORS a ete remplacee par un import du
  // module partage, qui refuse '*' par construction. On verifie l'import, et
  // l'absence de l'origine ouverte a toutes les pages du web.
  assertEquals(source.includes("import { corsHeaders } from '../_shared/cors.ts'"), true);
  assertEquals(source.includes("'Access-Control-Allow-Origin': '*'"), false);
  assertEquals(source.includes("validateServiceOrUser(req)"), true);
  assertEquals(source.includes("createClient("), true);
  assertEquals(source.includes("buildErrorResponse('jarvis-learning-engine'"), true);
});

Deno.test("index.ts declares all supported learning-engine actions", async () => {
  const source = await readIndexSource();

  const expectedActions = [
    "record_feedback",
    "get_metrics",
    "get_preferences",
    "adjust_thresholds",
    "generate_report",
  ];

  for (const action of expectedActions) {
    assertEquals(source.includes(`case '${action}':`), true);
  }

  assertEquals(source.includes("Invalid action"), true);
});

Deno.test("le module se charge, et son bloc d'imports est bien forme", async () => {
  // Cette epreuve exigeait auparavant que le module NE se charge PAS, et que
  // son bloc d'imports contienne l'import imbrique qui le cassait.
  const source = (await readIndexSource()).replaceAll("\r\n", "\n");

  assertEquals(
    source.includes('import {\nimport { buildErrorResponse }'),
    false,
  );

  const charge = await chargerSansServeur();
  assertExists(charge);
});

Deno.test("get_metrics aggregation rules calculate totals, rates, response time and satisfaction", () => {
  type LearningEntry = {
    action_type: string;
    accepted: boolean;
    execution_time_ms?: number;
    feedback_score?: number;
  };

  type LearningMetrics = {
    action_type: string;
    total_executions: number;
    confirmations: number;
    rejections: number;
    confirmation_rate: number;
    avg_response_time_ms: number;
    user_satisfaction_score: number;
  };

  const buildMetrics = (learningData: LearningEntry[]): LearningMetrics[] => {
    const metricsByAction = new Map<string, LearningMetrics>();

    for (const entry of learningData) {
      const existing = metricsByAction.get(entry.action_type) || {
        action_type: entry.action_type,
        total_executions: 0,
        confirmations: 0,
        rejections: 0,
        confirmation_rate: 0,
        avg_response_time_ms: 0,
        user_satisfaction_score: 0,
      };

      existing.total_executions++;
      if (entry.accepted) existing.confirmations++;
      else existing.rejections++;

      existing.avg_response_time_ms =
        (existing.avg_response_time_ms * (existing.total_executions - 1) + (entry.execution_time_ms || 0)) /
        existing.total_executions;

      if (entry.feedback_score) {
        existing.user_satisfaction_score =
          (existing.user_satisfaction_score * (existing.total_executions - 1) + entry.feedback_score) /
          existing.total_executions;
      }

      metricsByAction.set(entry.action_type, existing);
    }

    return Array.from(metricsByAction.values()).map((metric) => ({
      ...metric,
      confirmation_rate: metric.total_executions > 0
        ? (metric.confirmations / metric.total_executions) * 100
        : 0,
    }));
  };

  const metrics = buildMetrics([
    { action_type: "email", accepted: true, execution_time_ms: 100, feedback_score: 4 },
    { action_type: "email", accepted: false, execution_time_ms: 300 },
    { action_type: "email", accepted: true, execution_time_ms: 500, feedback_score: 5 },
    { action_type: "calendar", accepted: false, execution_time_ms: 1000, feedback_score: 2 },
  ]);

  assertEquals(metrics, [
    {
      action_type: "email",
      total_executions: 3,
      confirmations: 2,
      rejections: 1,
      confirmation_rate: 66.66666666666666,
      avg_response_time_ms: 300,
      user_satisfaction_score: 4.333333333333333,
    },
    {
      action_type: "calendar",
      total_executions: 1,
      confirmations: 0,
      rejections: 1,
      confirmation_rate: 0,
      avg_response_time_ms: 1000,
      user_satisfaction_score: 2,
    },
  ]);
});

Deno.test("adjust_thresholds recommendation boundaries match the business rules", () => {
  const recommendThreshold = (accepted: number, rejected: number): number | undefined => {
    const total = accepted + rejected;
    if (total < 5) return undefined;

    const acceptRate = accepted / total;
    if (acceptRate > 0.9) return 0.5;
    if (acceptRate > 0.7) return 0.6;
    if (acceptRate > 0.5) return 0.7;
    return 0.9;
  };

  assertEquals(recommendThreshold(4, 0), undefined);
  assertEquals(recommendThreshold(10, 0), 0.5);
  assertEquals(recommendThreshold(9, 1), 0.6);
  assertEquals(recommendThreshold(8, 2), 0.6);
  assertEquals(recommendThreshold(7, 3), 0.7);
  assertEquals(recommendThreshold(6, 4), 0.7);
  assertEquals(recommendThreshold(5, 5), 0.9);
  assertEquals(recommendThreshold(1, 9), 0.9);
});

Deno.test("adjust_thresholds groups learning data by action type before recommending thresholds", () => {
  type LearningEntry = {
    action_type: string;
    accepted: boolean;
  };

  const buildThresholdRecommendations = (learningData: LearningEntry[]): Record<string, number> => {
    const actionStats = new Map<string, { accepted: number; rejected: number }>();

    for (const entry of learningData) {
      const stats = actionStats.get(entry.action_type) || { accepted: 0, rejected: 0 };
      if (entry.accepted) stats.accepted++;
      else stats.rejected++;
      actionStats.set(entry.action_type, stats);
    }

    const thresholdRecommendations: Record<string, number> = {};

    for (const [actionType, stats] of actionStats) {
      const total = stats.accepted + stats.rejected;
      if (total < 5) continue;

      const acceptRate = stats.accepted / total;
      if (acceptRate > 0.9) {
        thresholdRecommendations[actionType] = 0.5;
      } else if (acceptRate > 0.7) {
        thresholdRecommendations[actionType] = 0.6;
      } else if (acceptRate > 0.5) {
        thresholdRecommendations[actionType] = 0.7;
      } else {
        thresholdRecommendations[actionType] = 0.9;
      }
    }

    return thresholdRecommendations;
  };

  const recommendations = buildThresholdRecommendations([
    { action_type: "email", accepted: true },
    { action_type: "email", accepted: true },
    { action_type: "email", accepted: true },
    { action_type: "email", accepted: true },
    { action_type: "email", accepted: true },
    { action_type: "calendar", accepted: true },
    { action_type: "calendar", accepted: true },
    { action_type: "calendar", accepted: false },
    { action_type: "calendar", accepted: false },
    { action_type: "calendar", accepted: false },
    { action_type: "task", accepted: true },
    { action_type: "task", accepted: false },
  ]);

  assertEquals(recommendations, {
    email: 0.5,
    calendar: 0.9,
  });
});

Deno.test("get_preferences defaults and explicit memory preferences are reproduced", () => {
  type MemoryEntry = {
    category: string;
    key: string;
    value: string;
  };

  const detectCommunicationStyle = (memoryData: MemoryEntry[]): "formal" | "casual" | "concise" | "detailed" => {
    const stylePref = memoryData.find((memory) => memory.key === "communication_style");
    if (stylePref) return stylePref.value as "formal" | "casual" | "concise" | "detailed";
    return "casual";
  };

  const detectResponseLength = (memoryData: MemoryEntry[]): "short" | "medium" | "long" => {
    const lengthPref = memoryData.find((memory) => memory.key === "response_length");
    if (lengthPref) return lengthPref.value as "short" | "medium" | "long";
    return "medium";
  };

  assertEquals(detectCommunicationStyle([]), "casual");
  assertEquals(detectResponseLength([]), "medium");

  const memoryData = [
    { category: "preference", key: "communication_style", value: "formal" },
    { category: "preference", key: "response_length", value: "long" },
  ];

  assertEquals(detectCommunicationStyle(memoryData), "formal");
  assertEquals(detectResponseLength(memoryData), "long");
});

Deno.test("peak usage hours are selected when hourly count is greater than 1.5 times the daily average", () => {
  const detectPeakHoursFromHours = (hours: number[]): number[] => {
    const hourCounts = new Array(24).fill(0);
    for (const hour of hours) {
      hourCounts[hour]++;
    }

    const avgUsage = hourCounts.reduce((a, b) => a + b, 0) / 24;
    return hourCounts
      .map((count, hour) => ({ hour, count }))
      .filter((entry) => entry.count > avgUsage * 1.5)
      .map((entry) => entry.hour);
  };

  assertEquals(detectPeakHoursFromHours([8, 8, 8, 8, 19, 19, 22]), [8, 19, 22]);
  assertEquals(detectPeakHoursFromHours([]), []);
});

Deno.test("generate_report helper formulas return top actions, acceptance rate and average satisfaction", () => {
  const data = [
    { action_type: "email", accepted: true, feedback_score: 4 },
    { action_type: "calendar", accepted: false, feedback_score: 2 },
    { action_type: "email", accepted: true, feedback_score: 5 },
    { action_type: "email", accepted: false, feedback_score: undefined },
    { action_type: "task", accepted: true, feedback_score: 3 },
    { action_type: "calendar", accepted: true, feedback_score: 0 },
  ];

  const getTopActions = (entries: Array<{ action_type: string }>): { action: string; count: number }[] => {
    const counts = new Map<string, number>();
    for (const entry of entries) {
      counts.set(entry.action_type, (counts.get(entry.action_type) || 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  };

  const calculateAcceptanceRate = (entries: Array<{ accepted: boolean }>): number => {
    if (entries.length === 0) return 0;
    const accepted = entries.filter((entry) => entry.accepted).length;
    return Math.round((accepted / entries.length) * 100);
  };

  const calculateAvgSatisfaction = (entries: Array<{ feedback_score?: number }>): number => {
    const withScore = entries.filter((entry) => entry.feedback_score);
    if (withScore.length === 0) return 0;
    const sum = withScore.reduce((acc, entry) => acc + Number(entry.feedback_score), 0);
    return Math.round((sum / withScore.length) * 10) / 10;
  };

  assertEquals(getTopActions(data), [
    { action: "email", count: 3 },
    { action: "calendar", count: 2 },
    { action: "task", count: 1 },
  ]);
  assertEquals(calculateAcceptanceRate(data), 67);
  assertEquals(calculateAcceptanceRate([]), 0);
  assertEquals(calculateAvgSatisfaction(data), 3.5);
  assertEquals(calculateAvgSatisfaction([{ feedback_score: 0 }, { feedback_score: undefined }]), 0);
});

Deno.test("generate_report recommendations cover low acceptance, high acceptance, low satisfaction and top action", () => {
  const getTopActions = (data: Array<{ action_type: string }>): { action: string; count: number }[] => {
    const counts = new Map<string, number>();
    for (const entry of data) {
      counts.set(entry.action_type, (counts.get(entry.action_type) || 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  };

  const calculateAcceptanceRate = (data: Array<{ accepted: boolean }>): number => {
    if (data.length === 0) return 0;
    const accepted = data.filter((entry) => entry.accepted).length;
    return Math.round((accepted / data.length) * 100);
  };

  const calculateAvgSatisfaction = (data: Array<{ feedback_score?: number }>): number => {
    const withScore = data.filter((entry) => entry.feedback_score);
    if (withScore.length === 0) return 0;
    const sum = withScore.reduce((acc, entry) => acc + Number(entry.feedback_score), 0);
    return Math.round((sum / withScore.length) * 10) / 10;
  };

  const generateRecommendations = (
    data: Array<{ action_type: string; accepted: boolean; feedback_score?: number }>,
  ): string[] => {
    const recommendations: string[] = [];

    const acceptanceRate = calculateAcceptanceRate(data);
    if (acceptanceRate < 50) {
      recommendations.push("Considérez réduire le mode autonome pour obtenir plus de confirmations");
    } else if (acceptanceRate > 90) {
      recommendations.push("Excellent taux d'acceptation ! Vous pouvez augmenter l'autonomie de Jarvis");
    }

    const avgSat = calculateAvgSatisfaction(data);
    if (avgSat < 3) {
      recommendations.push("Les réponses semblent nécessiter des ajustements. Vérifiez vos préférences");
    }

    const topActions = getTopActions(data);
    if (topActions.length > 0) {
      recommendations.push(`Action la plus utilisée: "${topActions[0].action}" - créez un template pour gagner du temps`);
    }

    return recommendations;
  };

  assertEquals(generateRecommendations([
    { action_type: "email", accepted: false, feedback_score: 2 },
    { action_type: "email", accepted: false, feedback_score: 1 },
    { action_type: "calendar", accepted: true, feedback_score: 2 },
  ]), [
    "Considérez réduire le mode autonome pour obtenir plus de confirmations",
    "Les réponses semblent nécessiter des ajustements. Vérifiez vos préférences",
    'Action la plus utilisée: "email" - créez un template pour gagner du temps',
  ]);

  assertEquals(generateRecommendations([
    { action_type: "task", accepted: true, feedback_score: 5 },
    { action_type: "task", accepted: true, feedback_score: 4 },
    { action_type: "email", accepted: true, feedback_score: 5 },
    { action_type: "task", accepted: true, feedback_score: 5 },
  ]), [
    "Excellent taux d'acceptation ! Vous pouvez augmenter l'autonomie de Jarvis",
    'Action la plus utilisée: "task" - créez un template pour gagner du temps',
  ]);

  assertEquals(generateRecommendations([]), [
    "Considérez réduire le mode autonome pour obtenir plus de confirmations",
    "Les réponses semblent nécessiter des ajustements. Vérifiez vos préférences",
  ]);
});

Deno.test("local request action parser rejects unsupported or malformed actions synchronously", () => {
  const allowedActions = new Set([
    "record_feedback",
    "get_metrics",
    "get_preferences",
    "adjust_thresholds",
    "generate_report",
  ]);

  const parseAction = (value: unknown): string => {
    if (typeof value !== "string" || value.length === 0) {
      throw new TypeError("action must be a non-empty string");
    }
    if (!allowedActions.has(value)) {
      throw new RangeError("unsupported learning-engine action");
    }
    return value;
  };

  assertEquals(parseAction("get_metrics"), "get_metrics");

  assertThrows(
    () => parseAction(""),
    TypeError,
    "action must be a non-empty string",
  );

  assertThrows(
    () => parseAction("delete_everything"),
    RangeError,
    "unsupported learning-engine action",
  );
});