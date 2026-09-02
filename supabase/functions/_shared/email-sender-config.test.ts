import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { getEmailSenderConfig } from "./email-sender-config.ts";

const DEFAULT_CONFIG = {
  default_from: "OpenPulse <noreply@exploitant.example.org>",
  notifications_from: "OpenPulse <notifications@exploitant.example.org>",
  formations_from: "OpenPulse <formations@exploitant.example.org>",
  support_from: "OpenPulse <support@exploitant.example.org>",
};

const ENV_KEYS = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;

function saveEnv(): Record<string, string | undefined> {
  const saved: Record<string, string | undefined> = {};
  for (const key of ENV_KEYS) {
    saved[key] = Deno.env.get(key);
  }
  return saved;
}

function restoreEnv(saved: Record<string, string | undefined>) {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) {
      Deno.env.delete(key);
    } else {
      Deno.env.set(key, saved[key]!);
    }
  }
}

function setValidSupabaseEnv() {
  Deno.env.set("SUPABASE_URL", "https://project.supabase.test");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function silenceConsole(): () => void {
  const originalWarn = console.warn;
  const originalError = console.error;
  console.warn = () => {};
  console.error = () => {};
  return () => {
    console.warn = originalWarn;
    console.error = originalError;
  };
}

Deno.test("getEmailSenderConfig returns default senders when Supabase client cannot be configured", async () => {
  const savedEnv = saveEnv();
  const originalFetch = globalThis.fetch;
  const restoreConsole = silenceConsole();

  try {
    Deno.env.delete("SUPABASE_URL");
    Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");

    globalThis.fetch = ((_input: RequestInfo | URL, _init?: RequestInit) => {
      return Promise.resolve(jsonResponse({ message: "unexpected fetch" }, 500));
    }) as typeof fetch;

    const config = await getEmailSenderConfig();

    assertEquals(config, DEFAULT_CONFIG);
  } finally {
    globalThis.fetch = originalFetch;
    restoreConsole();
    restoreEnv(savedEnv);
  }
});

Deno.test("getEmailSenderConfig returns defaults when app_config query fails", async () => {
  const savedEnv = saveEnv();
  const originalFetch = globalThis.fetch;
  const restoreConsole = silenceConsole();
  let fetchCalls = 0;
  const capturedUrls: string[] = [];

  try {
    setValidSupabaseEnv();

    globalThis.fetch = ((input: RequestInfo | URL, _init?: RequestInit) => {
      fetchCalls++;
      capturedUrls.push(requestUrl(input));
      return Promise.resolve(jsonResponse({
        code: "PGRST500",
        message: "app_config unavailable",
        details: null,
        hint: null,
      }, 500));
    }) as typeof fetch;

    const config = await getEmailSenderConfig();

    assertEquals(config, DEFAULT_CONFIG);
    assertEquals(fetchCalls, 1);
    assertExists(capturedUrls[0]);

    const url = new URL(capturedUrls[0]);
    assertEquals(url.origin, "https://project.supabase.test");
    assertEquals(url.pathname, "/rest/v1/app_config");
    assertEquals(url.searchParams.get("select"), "value");
    assertEquals(url.searchParams.get("key"), "eq.email_sender");
  } finally {
    globalThis.fetch = originalFetch;
    restoreConsole();
    restoreEnv(savedEnv);
  }
});

Deno.test("getEmailSenderConfig loads app_config values, applies field defaults, and caches the result", async () => {
  const savedEnv = saveEnv();
  const originalFetch = globalThis.fetch;
  const restoreConsole = silenceConsole();
  let fetchCalls = 0;
  const capturedUrls: string[] = [];

  try {
    setValidSupabaseEnv();

    globalThis.fetch = ((input: RequestInfo | URL, _init?: RequestInit) => {
      fetchCalls++;
      capturedUrls.push(requestUrl(input));
      return Promise.resolve(jsonResponse({
        value: {
          default_from: "Custom App <hello@example.test>",
          notifications_from: "",
          support_from: "Custom Support <support@example.test>",
        },
      }));
    }) as typeof fetch;

    const firstConfig = await getEmailSenderConfig();

    assertEquals(firstConfig, {
      default_from: "Custom App <hello@example.test>",
      notifications_from: DEFAULT_CONFIG.notifications_from,
      formations_from: DEFAULT_CONFIG.formations_from,
      support_from: "Custom Support <support@example.test>",
    });
    assertEquals(fetchCalls, 1);
    assertExists(capturedUrls[0]);

    const url = new URL(capturedUrls[0]);
    assertEquals(url.origin, "https://project.supabase.test");
    assertEquals(url.pathname, "/rest/v1/app_config");
    assertEquals(url.searchParams.get("select"), "value");
    assertEquals(url.searchParams.get("key"), "eq.email_sender");

    globalThis.fetch = ((_input: RequestInfo | URL, _init?: RequestInit) => {
      fetchCalls++;
      return Promise.resolve(jsonResponse({
        value: {
          default_from: "Changed <changed@example.test>",
          notifications_from: "Changed <notifications@example.test>",
          formations_from: "Changed <formations@example.test>",
          support_from: "Changed <support@example.test>",
        },
      }));
    }) as typeof fetch;

    const secondConfig = await getEmailSenderConfig();

    assertEquals(secondConfig, firstConfig);
    assertEquals(fetchCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    restoreConsole();
    restoreEnv(savedEnv);
  }
});