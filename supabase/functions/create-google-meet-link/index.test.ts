import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

const INDEX_URL = new URL("./index.ts", import.meta.url);
const sourcePromise = Deno.readTextFile(INDEX_URL);

Deno.test("module loads without opening a real HTTP listener", async () => {
  const originalDeno = globalThis.Deno;

  const fakeListener = {
    addr: { transport: "tcp", hostname: "127.0.0.1", port: 0 },
    accept() {
      return new Promise(() => {});
    },
    close() {},
    ref() {},
    unref() {},
    [Symbol.asyncIterator]() {
      return {
        next: async () => ({ done: true, value: undefined }),
      };
    },
  };

  const fakeDeno = Object.create(originalDeno);
  Object.defineProperty(fakeDeno, "listen", {
    configurable: true,
    value: () => fakeListener,
  });
  Object.defineProperty(fakeDeno, "listenTls", {
    configurable: true,
    value: () => fakeListener,
  });

  Object.defineProperty(globalThis, "Deno", {
    configurable: true,
    value: fakeDeno,
  });

  try {
    const mod = await import("./index.ts");
    assertExists(mod);
  } finally {
    Object.defineProperty(globalThis, "Deno", {
      configurable: true,
      value: originalDeno,
    });
  }
});

Deno.test("defines expected CORS headers for Supabase Edge Function responses", async () => {
  const source = await sourcePromise;
  const socle = await Deno.readTextFile(new URL("../_shared/cors.ts", import.meta.url));

  const importCors = source.match(/import \{ corsHeaders \} from '\.\.\/_shared\/cors\.ts'/);
  const allowHeaders = socle.match(/'(authorization[^']*x-internal-secret)'/);

  assertExists(importCors);
  assertExists(allowHeaders);
  assertEquals(source.includes("Access-Control-Allow-Origin"), false);
  assertEquals(
    allowHeaders[1],
    "authorization, x-client-info, apikey, content-type, x-internal-secret",
  );
  assertEquals(source.includes("if (req.method === 'OPTIONS')"), true);
  assertEquals(source.includes("return new Response(null, { headers: corsHeaders })"), true);
});

Deno.test("declares the expected Google OAuth and Calendar API endpoints", async () => {
  const source = await sourcePromise;

  const calendarApi = source.match(/const GOOGLE_CALENDAR_API = '([^']+)'/);
  const tokenUrl = source.match(/const GOOGLE_TOKEN_URL = '([^']+)'/);

  assertExists(calendarApi);
  assertExists(tokenUrl);
  assertEquals(
    calendarApi[1],
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
  );
  assertEquals(tokenUrl[1], "https://oauth2.googleapis.com/token");
  assertEquals(
    source.includes("`${GOOGLE_CALENDAR_API}?conferenceDataVersion=1`"),
    true,
  );
});

Deno.test("validates required request title and Google OAuth secrets", async () => {
  const source = await sourcePromise;

  assertEquals(source.includes("const { title, startTime, endTime } = await req.json()"), true);
  assertEquals(source.includes("if (!title)"), true);
  assertEquals(source.includes("throw new Error('Title is required')"), true);

  assertEquals(source.includes("Deno.env.get('GOOGLE_CLIENT_ID')"), true);
  assertEquals(source.includes("Deno.env.get('GOOGLE_CLIENT_SECRET')"), true);
  assertEquals(source.includes("Deno.env.get('GOOGLE_REFRESH_TOKEN')"), true);
  assertEquals(
    source.includes(
      "Google OAuth credentials not configured. Please configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
    ),
    true,
  );
  assertEquals(
    source.includes(
      "Google refresh token not configured. Please run oauth-google-setup to get the GOOGLE_REFRESH_TOKEN.",
    ),
    true,
  );
});

Deno.test("authenticates the caller with Supabase before calling Google APIs", async () => {
  const source = await sourcePromise;

  assertEquals(source.includes("createClient("), true);
  assertEquals(source.includes("Deno.env.get('SUPABASE_URL')!"), true);
  assertEquals(source.includes("Deno.env.get('SUPABASE_ANON_KEY')!"), true);
  assertEquals(
    source.includes("Authorization: req.headers.get('Authorization')!"),
    true,
  );
  assertEquals(source.includes("await supabase.auth.getUser()"), true);
  assertEquals(source.includes("if (authError || !user)"), true);
  assertEquals(source.includes("throw new Error('Unauthorized')"), true);
});

Deno.test("builds Google OAuth refresh-token request with the required form fields", async () => {
  const source = await sourcePromise;

  assertEquals(source.includes("fetch(GOOGLE_TOKEN_URL"), true);
  assertEquals(source.includes("method: 'POST'"), true);
  assertEquals(
    source.includes("'Content-Type': 'application/x-www-form-urlencoded'"),
    true,
  );
  assertEquals(source.includes("new URLSearchParams({"), true);
  assertEquals(source.includes("client_id: GOOGLE_CLIENT_ID"), true);
  assertEquals(source.includes("client_secret: GOOGLE_CLIENT_SECRET"), true);
  assertEquals(source.includes("refresh_token: GOOGLE_REFRESH_TOKEN"), true);
  assertEquals(source.includes("grant_type: 'refresh_token'"), true);
  assertEquals(
    source.includes(
      "Failed to refresh Google access token. The shared account may need to be re-authorized.",
    ),
    true,
  );
});

Deno.test("builds a Google Calendar event configured to create a Meet conference", async () => {
  const source = await sourcePromise;

  assertEquals(source.includes("summary: title"), true);
  assertEquals(source.includes("start: { dateTime: defaultStart, timeZone: 'Europe/Paris' }"), true);
  assertEquals(source.includes("end: { dateTime: defaultEnd, timeZone: 'Europe/Paris' }"), true);
  assertEquals(source.includes("requestId: crypto.randomUUID()"), true);
  assertEquals(source.includes("conferenceSolutionKey: { type: 'hangoutsMeet' }"), true);
  assertEquals(source.includes("new Date(now.getTime() + 60 * 60 * 1000).toISOString()"), true);
});

Deno.test("returns the expected successful response payload fields", async () => {
  const source = await sourcePromise;

  assertEquals(source.includes("const meetLink = event.hangoutLink"), true);
  assertEquals(source.includes("if (!meetLink)"), true);
  assertEquals(source.includes("throw new Error('No Meet link in response')"), true);
  assertEquals(source.includes("success: true"), true);
  assertEquals(source.includes("meetLink,"), true);
  assertEquals(source.includes("eventId: event.id"), true);
  assertEquals(source.includes("eventLink: event.htmlLink"), true);
  assertEquals(source.includes("'Content-Type': 'application/json'"), true);
});

Deno.test("delegates caught errors to the shared sanitized error response builder", async () => {
  const source = await sourcePromise;

  assertEquals(
    source.includes("buildErrorResponse('create-google-meet-link', error, corsHeaders, 500)"),
    true,
  );
});

Deno.test("local assertion helpers behave as expected for missing required source snippets", async () => {
  const source = await sourcePromise;

  const requireSnippet = (snippet: string) => {
    if (!source.includes(snippet)) {
      throw new Error(`Missing required snippet: ${snippet}`);
    }
    return snippet;
  };

  assertEquals(requireSnippet("serve(async (req) =>"), "serve(async (req) =>");
  assertThrows(
    () => requireSnippet("__definitely_missing_google_meet_snippet__"),
    Error,
    "__definitely_missing_google_meet_snippet__",
  );
  await assertRejects(
    async () => {
      requireSnippet("__definitely_missing_async_google_meet_snippet__");
    },
    Error,
    "__definitely_missing_async_google_meet_snippet__",
  );
});