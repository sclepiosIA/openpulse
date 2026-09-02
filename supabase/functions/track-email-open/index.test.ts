// `Deno.serve` est un accesseur en LECTURE SEULE depuis Deno 2 : les
// affectations de ce banc levaient « Cannot set property serve of #<Object>
// which has only a getter », et le banc entier tombait. On rend la propriete
// inscriptible une fois, sans toucher aux affectations elles-memes.
Object.defineProperty(Deno, 'serve', { configurable: true, writable: true, value: Deno.serve })

import { assertEquals, assertExists, assertThrows, assertRejects, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

type RegisteredHandler = (req: Request) => Response | Promise<Response>;

const EXPECTED_PIXEL = [
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00,
  0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00, 0x00, 0x00,
  0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02,
  0x44, 0x01, 0x00, 0x3b,
];

let importCounter = 0;

async function loadRegisteredHandler(): Promise<RegisteredHandler> {
  let registeredHandler: RegisteredHandler | undefined;
  const originalServe = Deno.serve;

  (Deno as unknown as { serve: (...args: unknown[]) => unknown }).serve = (...args: unknown[]) => {
    const handler = args.find((arg) => typeof arg === "function") as RegisteredHandler | undefined;
    assertExists(handler);
    registeredHandler = handler;

    return {
      addr: { transport: "tcp", hostname: "127.0.0.1", port: 0 },
      finished: Promise.resolve(),
      shutdown: () => {},
      ref: () => {},
      unref: () => {},
    };
  };

  try {
    await import(`./index.ts?deno-test=${++importCounter}`);
  } finally {
    (Deno as unknown as { serve: typeof Deno.serve }).serve = originalServe;
  }

  assertExists(registeredHandler);
  return registeredHandler;
}

Deno.test("module loads and registers a Deno.serve handler without starting a real server", async () => {
  const handler = await loadRegisteredHandler();

  assertExists(handler);
  assertEquals(typeof handler, "function");
});

Deno.test("OPTIONS request returns CORS headers and an empty response", async () => {
  const handler = await loadRegisteredHandler();

  const response = await handler(
    new Request("http://localhost/track-email-open", {
      method: "OPTIONS",
    }),
  );

  assertEquals(response.status, 200);
  assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
  assertEquals(
    response.headers.get("Access-Control-Allow-Headers"),
    "authorization, x-client-info, apikey, content-type, x-internal-secret",
  );
  assertEquals(await response.text(), "");
});

Deno.test("GET request serves the transparent 1x1 GIF pixel with no-cache headers", async () => {
  const handler = await loadRegisteredHandler();

  const response = await handler(
    new Request("http://localhost/track-email-open?t=thread-123&m=message-456&s=invalid-signature", {
      method: "GET",
      headers: {
        "user-agent": "UnitTestBot/1.0",
        "x-forwarded-for": "203.0.113.10, 10.0.0.1",
      },
    }),
  );

  assertEquals(response.status, 200);
  assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
  assertEquals(
    response.headers.get("Access-Control-Allow-Headers"),
    "authorization, x-client-info, apikey, content-type, x-internal-secret",
  );
  assertEquals(response.headers.get("Content-Type"), "image/gif");
  assertEquals(response.headers.get("Content-Length"), String(EXPECTED_PIXEL.length));
  assertEquals(response.headers.get("Cache-Control"), "no-store, no-cache, must-revalidate, max-age=0");
  assertEquals(response.headers.get("Pragma"), "no-cache");
  assertEquals(response.headers.get("Expires"), "0");

  const body = new Uint8Array(await response.arrayBuffer());
  assertEquals(Array.from(body), EXPECTED_PIXEL);
});

Deno.test("non-OPTIONS methods also receive the same GIF pixel response", async () => {
  const handler = await loadRegisteredHandler();

  const response = await handler(
    new Request("http://localhost/track-email-open?t=thread-abc&m=message-def", {
      method: "POST",
      headers: {
        "user-agent": "CrawlerBot/2.0",
      },
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(response.headers.get("Content-Type"), "image/gif");
  assertEquals(response.headers.get("Content-Length"), "43");

  const body = new Uint8Array(await response.arrayBuffer());
  assertEquals(body.byteLength, 43);
  assertEquals(body[0], 0x47);
  assertEquals(body[1], 0x49);
  assertEquals(body[2], 0x46);
  assertEquals(body[body.length - 1], 0x3b);
});