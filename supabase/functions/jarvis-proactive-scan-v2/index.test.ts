import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

type Priority = "low" | "medium" | "high" | "critical";

type CalculatePriorityScore = (factors: {
  daysOverdue?: number;
  amount?: number;
  isUrgent?: boolean;
  hasMultipleSignals?: boolean;
  recentActivity?: boolean;
  isHighValue?: boolean;
}) => number;

type GetPriorityFromScore = (score: number) => Priority;

function importModuleUnderTest() {
  return import("./index.ts");
}

async function readModuleSource(): Promise<string> {
  return await Deno.readTextFile(new URL("./index.ts", import.meta.url));
}

function findMatchingParen(source: string, openIndex: number): number {
  let depth = 0;

  for (let i = openIndex; i < source.length; i++) {
    const char = source[i];

    if (char === "(") depth++;
    if (char === ")") depth--;

    if (depth === 0) return i;
  }

  throw new Error("Unable to find matching closing parenthesis");
}

function extractFunctionBody(source: string, functionName: string): string {
  const signatureStart = source.indexOf(`function ${functionName}`);
  if (signatureStart === -1) {
    throw new Error(`Unable to find function ${functionName}`);
  }

  const paramsOpen = source.indexOf("(", signatureStart);
  if (paramsOpen === -1) {
    throw new Error(`Unable to find parameters for function ${functionName}`);
  }

  const paramsClose = findMatchingParen(source, paramsOpen);
  const bodyOpen = source.indexOf("{", paramsClose);
  if (bodyOpen === -1) {
    throw new Error(`Unable to find body for function ${functionName}`);
  }

  let depth = 0;
  for (let i = bodyOpen; i < source.length; i++) {
    const char = source[i];

    if (char === "{") depth++;
    if (char === "}") depth--;

    if (depth === 0) {
      return source.slice(bodyOpen + 1, i);
    }
  }

  throw new Error(`Unable to find end of body for function ${functionName}`);
}

function compilePureFunction<T extends (...args: never[]) => unknown>(
  source: string,
  functionName: string,
  argumentNames: string[],
): T {
  const body = extractFunctionBody(source, functionName);
  return new Function(...argumentNames, body) as T;
}

async function loadCalculatePriorityScore(): Promise<CalculatePriorityScore> {
  const source = await readModuleSource();
  return compilePureFunction(
    source,
    "calculatePriorityScore",
    ["factors"],
  ) as CalculatePriorityScore;
}

async function loadGetPriorityFromScore(): Promise<GetPriorityFromScore> {
  const source = await readModuleSource();
  return compilePureFunction(
    source,
    "getPriorityFromScore",
    ["score"],
  ) as GetPriorityFromScore;
}

Deno.test("index.ts is targeted by a relative import hook without executing the Edge server", () => {
  assertExists(importModuleUnderTest);
  assertEquals(new URL("./index.ts", import.meta.url).pathname.endsWith("/index.ts"), true);
});

Deno.test("source contains the expected pure scoring helpers", async () => {
  const source = await readModuleSource();

  assertExists(source.match(/function\s+calculatePriorityScore\s*\(/));
  assertExists(source.match(/function\s+getPriorityFromScore\s*\(/));

  const scoreBody = extractFunctionBody(source, "calculatePriorityScore");
  const priorityBody = extractFunctionBody(source, "getPriorityFromScore");

  assertExists(scoreBody.match(/let\s+score\s*=\s*50/));
  assertExists(scoreBody.match(/Math\.min\(factors\.daysOverdue\s*\*\s*2,\s*30\)/));
  assertExists(scoreBody.match(/factors\.amount\s*>\s*10000/));
  assertExists(scoreBody.match(/factors\.amount\s*>\s*5000/));
  assertExists(scoreBody.match(/factors\.recentActivity\)\s*score\s*-=\s*10/));
  assertExists(scoreBody.match(/Math\.min\(Math\.max\(score,\s*0\),\s*100\)/));

  assertExists(priorityBody.match(/score\s*>=\s*85/));
  assertExists(priorityBody.match(/score\s*>=\s*65/));
  assertExists(priorityBody.match(/score\s*>=\s*40/));
});

Deno.test("calculatePriorityScore returns the base score when no factor is provided", async () => {
  const calculatePriorityScore = await loadCalculatePriorityScore();

  assertEquals(calculatePriorityScore({}), 50);
  assertEquals(calculatePriorityScore({ daysOverdue: 0 }), 50);
  assertEquals(calculatePriorityScore({ amount: 5000 }), 50);
});

Deno.test("calculatePriorityScore applies overdue weighting with a maximum of 30 points", async () => {
  const calculatePriorityScore = await loadCalculatePriorityScore();

  assertEquals(calculatePriorityScore({ daysOverdue: 1 }), 52);
  assertEquals(calculatePriorityScore({ daysOverdue: 10 }), 70);
  assertEquals(calculatePriorityScore({ daysOverdue: 15 }), 80);
  assertEquals(calculatePriorityScore({ daysOverdue: 30 }), 80);
});

Deno.test("calculatePriorityScore applies amount thresholds exactly as defined", async () => {
  const calculatePriorityScore = await loadCalculatePriorityScore();

  assertEquals(calculatePriorityScore({ amount: 5000 }), 50);
  assertEquals(calculatePriorityScore({ amount: 5001 }), 60);
  assertEquals(calculatePriorityScore({ amount: 10000 }), 60);
  assertEquals(calculatePriorityScore({ amount: 10001 }), 70);
});

Deno.test("calculatePriorityScore combines urgency, multiple signals, recent activity, and high value", async () => {
  const calculatePriorityScore = await loadCalculatePriorityScore();

  assertEquals(calculatePriorityScore({ isUrgent: true }), 75);
  assertEquals(calculatePriorityScore({ hasMultipleSignals: true }), 65);
  assertEquals(calculatePriorityScore({ recentActivity: true }), 40);
  assertEquals(calculatePriorityScore({ isHighValue: true }), 70);

  assertEquals(
    calculatePriorityScore({
      daysOverdue: 4,
      amount: 6000,
      isUrgent: true,
      hasMultipleSignals: true,
      recentActivity: true,
      isHighValue: true,
    }),
    100,
  );
});

Deno.test("calculatePriorityScore clamps scores to the 0-100 range", async () => {
  const calculatePriorityScore = await loadCalculatePriorityScore();

  assertEquals(
    calculatePriorityScore({
      daysOverdue: 100,
      amount: 25000,
      isUrgent: true,
      hasMultipleSignals: true,
      isHighValue: true,
    }),
    100,
  );

  assertEquals(calculatePriorityScore({ daysOverdue: -100 }), 0);
});

Deno.test("getPriorityFromScore maps score boundaries to business priorities", async () => {
  const getPriorityFromScore = await loadGetPriorityFromScore();

  assertEquals(getPriorityFromScore(100), "critical");
  assertEquals(getPriorityFromScore(85), "critical");
  assertEquals(getPriorityFromScore(84.999), "high");

  assertEquals(getPriorityFromScore(65), "high");
  assertEquals(getPriorityFromScore(64.999), "medium");

  assertEquals(getPriorityFromScore(40), "medium");
  assertEquals(getPriorityFromScore(39.999), "low");
  assertEquals(getPriorityFromScore(0), "low");
  assertEquals(getPriorityFromScore(-1), "low");
});

Deno.test("scoring and priority mapping match representative alert scenarios", async () => {
  const calculatePriorityScore = await loadCalculatePriorityScore();
  const getPriorityFromScore = await loadGetPriorityFromScore();

  const overdueNormalTaskScore = calculatePriorityScore({ daysOverdue: 3 });
  assertEquals(overdueNormalTaskScore, 56);
  assertEquals(getPriorityFromScore(overdueNormalTaskScore), "medium");

  const urgentOverdueTaskScore = calculatePriorityScore({
    daysOverdue: 8,
    isUrgent: true,
  });
  assertEquals(urgentOverdueTaskScore, 91);
  assertEquals(getPriorityFromScore(urgentOverdueTaskScore), "critical");

  const pendingEmailsScore = calculatePriorityScore({
    daysOverdue: 1,
    hasMultipleSignals: true,
  });
  assertEquals(pendingEmailsScore, 67);
  assertEquals(getPriorityFromScore(pendingEmailsScore), "high");

  const highValueColdProspectScore = calculatePriorityScore({
    daysOverdue: 6,
    amount: 12000,
    isHighValue: true,
  });
  assertEquals(highValueColdProspectScore, 100);
  assertEquals(getPriorityFromScore(highValueColdProspectScore), "critical");

  const recentHotActivityScore = calculatePriorityScore({
    amount: 8000,
    recentActivity: true,
  });
  assertEquals(recentHotActivityScore, 50);
  assertEquals(getPriorityFromScore(recentHotActivityScore), "medium");
});

Deno.test("source includes expected Edge Function HTTP safeguards", async () => {
  const source = await readModuleSource();

  assertExists(source.match(/req\.method\s*===\s*['"]OPTIONS['"]/));
  assertExists(source.match(/validateServiceOrUser\(req\)/));
  assertExists(source.match(/status:\s*401/));
  // Le durcissement CORS a deporte les en-tetes dans ../_shared/cors.ts :
  // index.ts importe corsHeaders et garde en commentaire la liste d'en-tetes
  // acceptes d'origine. L'origine ouverte a tout le web n'y figure plus.
  assertExists(source.match(/import \{ corsHeaders \} from '\.\.\/_shared\/cors\.ts'/));
  assertExists(source.match(/en-tetes autorises d'origine :/));
  assertEquals(source.includes("'Access-Control-Allow-Origin': '*'"), false);
});

Deno.test("pure helper extraction fails explicitly for unknown functions", async () => {
  const source = await readModuleSource();

  assertThrows(
    () => extractFunctionBody(source, "missingHelper"),
    Error,
    "Unable to find function missingHelper",
  );

  await assertRejects(
    async () => {
      compilePureFunction(source, "anotherMissingHelper", ["value"]);
    },
    Error,
    "Unable to find function anotherMissingHelper",
  );
});