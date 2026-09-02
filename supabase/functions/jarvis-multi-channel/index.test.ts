import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import type * as IndexModule from "./index.ts";

type _RelativeImportCheck = typeof IndexModule;

type ChannelResult = { success: boolean; message_id?: string; error?: string };

type HelpersModule = {
  sendSMS: (to: string, message: string) => Promise<ChannelResult>;
  sendSlack: (
    channel: string,
    message: string,
    metadata?: Record<string, unknown>,
  ) => Promise<ChannelResult>;
  sendTeams: (
    channel: string,
    message: string,
    title?: string,
  ) => Promise<ChannelResult>;
  sendWhatsApp: (to: string, message: string) => Promise<ChannelResult>;
};

const INDEX_URL = new URL("./index.ts", import.meta.url);

function buildHelperSource(source: string): string {
  const serveStart = source.indexOf("serve(async (req) => {");
  const firstHelper = source.indexOf("async function sendSMS", serveStart);

  if (serveStart === -1 || firstHelper === -1 || firstHelper <= serveStart) {
    throw new Error("Unable to locate serve boundary and helper functions in index.ts");
  }

  const preambleWithoutImports = source
    .slice(0, serveStart)
    // Le point-virgule final est FACULTATIF : l'import ajoute par la
    // consolidation CORS n'en porte pas, et echappait donc au retrait.
    .replace(/^import\s+[^\n]*?;?\s*$/gm, "");

  const helpers = source.slice(firstHelper);

  return `${preambleWithoutImports}
${helpers}
export { sendSMS, sendSlack, sendTeams, sendWhatsApp };
`;
}

async function loadHelpers(): Promise<HelpersModule> {
  const source = await Deno.readTextFile(INDEX_URL);
  const transformed = buildHelperSource(source);
  const specifier =
    `data:application/typescript;charset=utf-8,${encodeURIComponent(transformed)}#${crypto.randomUUID()}`;
  return await import(specifier) as HelpersModule;
}

async function withEnv<T>(
  values: Record<string, string | undefined>,
  fn: () => Promise<T> | T,
): Promise<T> {
  const previous = new Map<string, string | undefined>();

  for (const key of Object.keys(values)) {
    previous.set(key, Deno.env.get(key));
  }

  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) {
        Deno.env.delete(key);
      } else {
        Deno.env.set(key, value);
      }
    }

    return await fn();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        Deno.env.delete(key);
      } else {
        Deno.env.set(key, value);
      }
    }
  }
}

async function withFetchStub<T>(
  stub: typeof fetch,
  fn: () => Promise<T> | T,
): Promise<T> {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = stub;
    return await fn();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function withFixedDateNow<T>(
  timestamp: number,
  fn: () => Promise<T> | T,
): Promise<T> {
  const originalDateNow = Date.now;
  try {
    Date.now = () => timestamp;
    return await fn();
  } finally {
    Date.now = originalDateNow;
  }
}

Deno.test("helper extraction fails loudly if index.ts structure changes", () => {
  assertThrows(
    () => buildHelperSource("const nothingToExtract = true;"),
    Error,
    "Unable to locate serve boundary",
  );
});

Deno.test("private channel helper functions can be loaded from index.ts source without starting HTTP server", async () => {
  const helpers = await loadHelpers();

  assertExists(helpers.sendSMS);
  assertExists(helpers.sendSlack);
  assertExists(helpers.sendTeams);
  assertExists(helpers.sendWhatsApp);
  assertEquals(typeof helpers.sendSMS, "function");
  assertEquals(typeof helpers.sendSlack, "function");
  assertEquals(typeof helpers.sendTeams, "function");
  assertEquals(typeof helpers.sendWhatsApp, "function");
});

Deno.test("sendSMS returns a clear failure when Twilio is not configured and does not call fetch", async () => {
  const helpers = await loadHelpers();

  await withEnv(
    {
      TWILIO_ACCOUNT_SID: undefined,
      TWILIO_AUTH_TOKEN: undefined,
      TWILIO_PHONE_NUMBER: undefined,
    },
    async () => {
      await withFetchStub(
        (() => {
          throw new Error("fetch must not be called when Twilio is not configured");
        }) as typeof fetch,
        async () => {
          const result = await helpers.sendSMS("+33601020304", "Bonjour depuis Jarvis");
          assertEquals(result, {
            success: false,
            error: "Twilio not configured",
          });
        },
      );
    },
  );
});

Deno.test("sendSMS posts the expected Twilio form payload and returns the provider message id", async () => {
  const helpers = await loadHelpers();
  let capturedUrl: string | URL | Request | undefined;
  let capturedInit: RequestInit | undefined;

  await withEnv(
    {
      TWILIO_ACCOUNT_SID: "AC_TEST_ACCOUNT",
      TWILIO_AUTH_TOKEN: "twilio-token-test",
      TWILIO_PHONE_NUMBER: "+15551234567",
    },
    async () => {
      await withFetchStub(
        ((input: string | URL | Request, init?: RequestInit) => {
          capturedUrl = input;
          capturedInit = init;
          return Promise.resolve(
            new Response(JSON.stringify({ sid: "SM_TEST_123" }), {
              status: 200,
              headers: { "content-type": "application/json" },
            }),
          );
        }) as typeof fetch,
        async () => {
          const result = await helpers.sendSMS("+33601020304", "Votre rendez-vous est confirmé");

          assertEquals(result, {
            success: true,
            message_id: "SM_TEST_123",
          });
        },
      );
    },
  );

  assertEquals(
    String(capturedUrl),
    "https://api.twilio.com/2010-04-01/Accounts/AC_TEST_ACCOUNT/Messages.json",
  );
  assertEquals(capturedInit?.method, "POST");

  const headers = capturedInit?.headers as Record<string, string>;
  assertEquals(headers.Authorization, `Basic ${btoa("AC_TEST_ACCOUNT:twilio-token-test")}`);
  assertEquals(headers["Content-Type"], "application/x-www-form-urlencoded");

  const body = capturedInit?.body as URLSearchParams;
  assertEquals(body.get("To"), "+33601020304");
  assertEquals(body.get("From"), "+15551234567");
  assertEquals(body.get("Body"), "Votre rendez-vous est confirmé");
});

Deno.test("sendSlack prefixes a plain channel name, adds rich blocks from metadata, and returns a deterministic id", async () => {
  const helpers = await loadHelpers();
  let capturedUrl: string | URL | Request | undefined;
  let capturedInit: RequestInit | undefined;

  await withEnv(
    {
      SLACK_WEBHOOK_URL: "https://hooks.slack.test/services/T000/B000/XXX",
    },
    async () => {
      await withFixedDateNow(1710000000000, async () => {
        await withFetchStub(
          ((input: string | URL | Request, init?: RequestInit) => {
            capturedUrl = input;
            capturedInit = init;
            return Promise.resolve(
              new Response(JSON.stringify({ ok: true }), {
                status: 200,
                headers: { "content-type": "application/json" },
              }),
            );
          }) as typeof fetch,
          async () => {
            const result = await helpers.sendSlack(
              "general",
              "Déploiement terminé",
              { title: "Rapport Jarvis" },
            );

            assertEquals(result, {
              success: true,
              message_id: "slack_1710000000000",
            });
          },
        );
      });
    },
  );

  assertEquals(String(capturedUrl), "https://hooks.slack.test/services/T000/B000/XXX");
  assertEquals(capturedInit?.method, "POST");

  const headers = capturedInit?.headers as Record<string, string>;
  assertEquals(headers["Content-Type"], "application/json");

  const payload = JSON.parse(capturedInit?.body as string);
  assertEquals(payload.text, "Déploiement terminé");
  assertEquals(payload.channel, "#general");
  assertEquals(payload.blocks[0], {
    type: "header",
    text: { type: "plain_text", text: "Rapport Jarvis" },
  });
  assertEquals(payload.blocks[1], {
    type: "section",
    text: { type: "mrkdwn", text: "Déploiement terminé" },
  });
});

Deno.test("sendSlack returns response text when Slack webhook rejects the request", async () => {
  const helpers = await loadHelpers();

  await withEnv(
    {
      SLACK_WEBHOOK_URL: "https://hooks.slack.test/services/T000/B000/XXX",
    },
    async () => {
      await withFetchStub(
        (() =>
          Promise.resolve(
            new Response("invalid_payload", {
              status: 400,
              headers: { "content-type": "text/plain" },
            }),
          )) as typeof fetch,
        async () => {
          const result = await helpers.sendSlack("#alerts", "Message impossible à livrer");

          assertEquals(result, {
            success: false,
            error: "invalid_payload",
          });
        },
      );
    },
  );
});

Deno.test("sendTeams posts a MessageCard payload with the supplied title and message", async () => {
  const helpers = await loadHelpers();
  let capturedUrl: string | URL | Request | undefined;
  let capturedInit: RequestInit | undefined;

  await withEnv(
    {
      TEAMS_WEBHOOK_URL: "https://teams.test/webhook",
    },
    async () => {
      await withFixedDateNow(1710000000000, async () => {
        await withFetchStub(
          ((input: string | URL | Request, init?: RequestInit) => {
            capturedUrl = input;
            capturedInit = init;
            return Promise.resolve(
              new Response(JSON.stringify({ ok: true }), {
                status: 200,
                headers: { "content-type": "application/json" },
              }),
            );
          }) as typeof fetch,
          async () => {
            const result = await helpers.sendTeams(
              "ignored-by-implementation",
              "Le rapport hebdomadaire est prêt",
              "Rapport hebdomadaire",
            );

            assertEquals(result, {
              success: true,
              message_id: "teams_1710000000000",
            });
          },
        );
      });
    },
  );

  assertEquals(String(capturedUrl), "https://teams.test/webhook");
  assertEquals(capturedInit?.method, "POST");

  const headers = capturedInit?.headers as Record<string, string>;
  assertEquals(headers["Content-Type"], "application/json");

  const payload = JSON.parse(capturedInit?.body as string);
  assertEquals(payload["@type"], "MessageCard");
  assertEquals(payload["@context"], "http://schema.org/extensions");
  assertEquals(payload.themeColor, "6366f1");
  assertEquals(payload.summary, "Rapport hebdomadaire");
  assertEquals(payload.sections[0].activityTitle, "Rapport hebdomadaire");
  assertEquals(payload.sections[0].activityImage, "https://gestion-marque-ia.apercu.example.org/jarvis-icon.png");
  assertEquals(payload.sections[0].text, "Le rapport hebdomadaire est prêt");
});

Deno.test("sendWhatsApp sanitizes recipient phone number, posts Meta payload, and returns wamid", async () => {
  const helpers = await loadHelpers();
  let capturedUrl: string | URL | Request | undefined;
  let capturedInit: RequestInit | undefined;

  await withEnv(
    {
      WHATSAPP_TOKEN: "whatsapp-token-test",
      WHATSAPP_PHONE_NUMBER_ID: "PHONE_NUMBER_ID_TEST",
    },
    async () => {
      await withFetchStub(
        ((input: string | URL | Request, init?: RequestInit) => {
          capturedUrl = input;
          capturedInit = init;
          return Promise.resolve(
            new Response(JSON.stringify({ messages: [{ id: "wamid.TEST123" }] }), {
              status: 200,
              headers: { "content-type": "application/json" },
            }),
          );
        }) as typeof fetch,
        async () => {
          const result = await helpers.sendWhatsApp("+33 6-12 34", "Votre document est disponible");

          assertEquals(result, {
            success: true,
            message_id: "wamid.TEST123",
          });
        },
      );
    },
  );

  assertEquals(
    String(capturedUrl),
    "https://graph.facebook.com/v18.0/PHONE_NUMBER_ID_TEST/messages",
  );
  assertEquals(capturedInit?.method, "POST");

  const headers = capturedInit?.headers as Record<string, string>;
  assertEquals(headers.Authorization, "Bearer whatsapp-token-test");
  assertEquals(headers["Content-Type"], "application/json");

  const payload = JSON.parse(capturedInit?.body as string);
  assertEquals(payload.messaging_product, "whatsapp");
  assertEquals(payload.recipient_type, "individual");
  assertEquals(payload.to, "3361234");
  assertEquals(payload.type, "text");
  assertEquals(payload.text, { body: "Votre document est disponible" });
});

Deno.test("index.ts handler source defines expected offline-testable actions and logging fields", async () => {
  const source = await Deno.readTextFile(INDEX_URL);

  assertEquals(source.includes("case 'send':"), true);
  assertEquals(source.includes("case 'get_channels':"), true);
  assertEquals(source.includes("case 'get_history':"), true);
  assertEquals(source.includes("validateUserAuth(req)"), true);
  assertEquals(source.includes("msg.message.substring(0, 200)"), true);
  assertEquals(source.includes("jarvis_multi_channel_actions"), true);
  assertEquals(source.includes("sanitizeErrorForClient(error)"), true);
});