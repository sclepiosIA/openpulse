import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const EXPECTED_PAYLOAD_ACTIONS = [
  "create-room",
  "join-room",
  "leave-room",
  "signal",
  "get-room",
  "update-participant",
];

const EXPECTED_SWITCH_CASES = [
  "create-room",
  "get-room",
  "join-room",
  "leave-room",
  "signal",
  "update-participant",
];

async function readIndexSource(): Promise<string> {
  return await Deno.readTextFile(new URL("./index.ts", import.meta.url));
}

function extractPayloadActions(source: string): string[] {
  const match = source.match(/action:\s*((?:'[^']+'\s*\|\s*)*'[^']+')\s*;/);
  if (!match) {
    throw new Error("SignalingPayload action union not found");
  }

  return [...match[1].matchAll(/'([^']+)'/g)].map((entry) => entry[1]);
}

function extractSwitchCases(source: string): string[] {
  return [...source.matchAll(/case\s+'([^']+)'\s*:/g)].map((entry) => entry[1]);
}

function createPendingFakeListener(): Deno.Listener {
  const pendingConn = () => new Promise<Deno.Conn>(() => {});
  const pendingIteratorResult = () => new Promise<IteratorResult<Deno.Conn>>(() => {});

  return {
    addr: { transport: "tcp", hostname: "127.0.0.1", port: 0 },
    accept: pendingConn,
    close: () => {},
    ref: () => {},
    unref: () => {},
    [Symbol.asyncIterator]() {
      return {
        next: pendingIteratorResult,
      };
    },
  } as unknown as Deno.Listener;
}

function stubDenoListen(): () => void {
  const originalDescriptor = Object.getOwnPropertyDescriptor(Deno, "listen");
  const originalListen = Deno.listen;

  Object.defineProperty(Deno, "listen", {
    configurable: true,
    writable: true,
    value: () => createPendingFakeListener(),
  });

  return () => {
    if (originalDescriptor) {
      Object.defineProperty(Deno, "listen", originalDescriptor);
    } else {
      Object.defineProperty(Deno, "listen", {
        configurable: true,
        writable: true,
        value: originalListen,
      });
    }
  };
}

Deno.test("module loads offline without opening a real listener", async () => {
  const restoreListen = stubDenoListen();

  try {
    const mod = await import("./index.ts");
    assertExists(mod);
  } finally {
    restoreListen();
  }
});

Deno.test("SignalingPayload exposes the expected WebRTC actions", async () => {
  const source = await readIndexSource();

  assertEquals(extractPayloadActions(source), EXPECTED_PAYLOAD_ACTIONS);
});

Deno.test("request switch handles every expected signaling action", async () => {
  const source = await readIndexSource();

  assertEquals(extractSwitchCases(source), EXPECTED_SWITCH_CASES);
});

Deno.test("CORS preflight is handled with the expected headers", async () => {
  const source = await readIndexSource();

  // La consolidation CORS a deporte les en-tetes dans ../_shared/cors.ts :
  // index.ts n'a plus d'objet en ligne, et les deux extractions par expression
  // reguliere ne trouvaient plus rien. On verifie que la fonction importe bien
  // le socle, puis on porte les memes assertions sur les en-tetes que ce socle
  // emet REELLEMENT. Le contrat est durci, pas relache : l'origine n'est plus
  // « * », et la liste acceptee gagne x-internal-secret.
  const enTetesSocle = getCorsHeaders(null);

  assertExists(source.match(/req\.method\s*===\s*'OPTIONS'/));
  assertEquals(source.includes("import { corsHeaders } from '../_shared/cors.ts'"), true);
  assertEquals(enTetesSocle["Access-Control-Allow-Origin"] === "*", false);
  assertEquals(
    enTetesSocle["Access-Control-Allow-Headers"].split(",").map((header) => header.trim()),
    ["authorization", "x-client-info", "apikey", "content-type", "x-internal-secret"],
  );
});

Deno.test("authentication and profile failures return explicit HTTP statuses", async () => {
  const source = await readIndexSource();

  assertExists(source.match(/Missing authorization header[\s\S]*?status:\s*401/));
  assertExists(source.match(/Invalid token[\s\S]*?status:\s*401/));
  assertExists(source.match(/Profile not found[\s\S]*?status:\s*404/));
});

Deno.test("room response builders expose stable public field names", async () => {
  const source = await readIndexSource();

  assertExists(source.match(/roomCode:\s*room\.room_code/));
  assertExists(source.match(/link:\s*`\/visio\/\$\{room\.room_code\}`/));
  assertExists(source.match(/createdBy:\s*room\.created_by_profile/));
  assertExists(source.match(/participants:\s*activeParticipants/));
  assertExists(source.match(/maxParticipants:\s*room\.max_participants/));
});

Deno.test("participant update maps camelCase payload fields to database columns", async () => {
  const source = await readIndexSource();

  assertExists(source.match(/payload\.isMuted[\s\S]*updates\.is_muted\s*=\s*payload\.isMuted/));
  assertExists(source.match(/payload\.isVideoOff[\s\S]*updates\.is_video_off\s*=\s*payload\.isVideoOff/));
  assertExists(source.match(/payload\.isScreenSharing[\s\S]*updates\.is_screen_sharing\s*=\s*payload\.isScreenSharing/));
});

Deno.test("unknown actions are rejected with a 400 response", async () => {
  const source = await readIndexSource();

  assertExists(source.match(/default:[\s\S]*error:\s*'Unknown action'[\s\S]*status:\s*400/));
});

Deno.test("source parser fails loudly when action union is absent", () => {
  assertThrows(
    () => extractPayloadActions("interface SignalingPayload { roomId?: string; }"),
    Error,
    "SignalingPayload action union not found",
  );
});