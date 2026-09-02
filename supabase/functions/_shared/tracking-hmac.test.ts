import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

async function importFreshTrackingHmac() {
  return await import(`./tracking-hmac.ts?test=${crypto.randomUUID()}`);
}

function b64urlFromBytesForTest(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function expectedHmacSignature(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );

  return b64urlFromBytesForTest(new Uint8Array(sig));
}

function snapshotEnv(name: string): { existed: boolean; value?: string } {
  const value = Deno.env.get(name);
  return { existed: value !== undefined, value };
}

function restoreEnv(name: string, snapshot: { existed: boolean; value?: string }) {
  if (snapshot.existed) {
    Deno.env.set(name, snapshot.value!);
  } else {
    Deno.env.delete(name);
  }
}

Deno.test("buildOpenPayload formats thread and message identifiers", async () => {
  const mod = await importFreshTrackingHmac();

  assertEquals(
    mod.buildOpenPayload("thread-123", "message-456"),
    "open|thread-123|message-456",
  );
});

Deno.test("buildOpenPayload converts null values to empty payload fields", async () => {
  const mod = await importFreshTrackingHmac();

  assertEquals(mod.buildOpenPayload(null, "message-456"), "open||message-456");
  assertEquals(mod.buildOpenPayload("thread-123", null), "open|thread-123|");
  assertEquals(mod.buildOpenPayload(null, null), "open||");
});

Deno.test("buildOpenPayload preserves separators inside provided identifiers", async () => {
  const mod = await importFreshTrackingHmac();

  assertEquals(
    mod.buildOpenPayload("thread|with|pipes", "message/with/slashes"),
    "open|thread|with|pipes|message/with/slashes",
  );
});

Deno.test("isTrackingHmacConfigured returns false and signing returns null when secret is absent", async () => {
  const envName = "EMAIL_TRACKING_HMAC_SECRET";
  const before = snapshotEnv(envName);

  try {
    Deno.env.delete(envName);
    const mod = await importFreshTrackingHmac();

    assertEquals(mod.isTrackingHmacConfigured(), false);
    assertEquals(await mod.signOpenPayload("thread-123", "message-456"), null);
    assertEquals(
      await mod.verifyOpenSignature("thread-123", "message-456", "not-a-real-signature"),
      false,
    );
  } finally {
    restoreEnv(envName, before);
  }
});

Deno.test("isTrackingHmacConfigured returns false and signing returns null when secret is empty", async () => {
  const envName = "EMAIL_TRACKING_HMAC_SECRET";
  const before = snapshotEnv(envName);

  try {
    Deno.env.set(envName, "");
    const mod = await importFreshTrackingHmac();

    assertEquals(mod.isTrackingHmacConfigured(), false);
    assertEquals(await mod.signOpenPayload("thread-123", "message-456"), null);
  } finally {
    restoreEnv(envName, before);
  }
});

Deno.test("signOpenPayload returns the expected base64url HMAC-SHA256 signature", async () => {
  const envName = "EMAIL_TRACKING_HMAC_SECRET";
  const before = snapshotEnv(envName);
  const secret = `test-${crypto.randomUUID()}`;

  try {
    Deno.env.set(envName, secret);
    const mod = await importFreshTrackingHmac();

    const payload = "open|thread-123|message-456";
    const expected = await expectedHmacSignature(secret, payload);

    assertEquals(mod.isTrackingHmacConfigured(), true);
    assertEquals(await mod.signOpenPayload("thread-123", "message-456"), expected);
  } finally {
    restoreEnv(envName, before);
  }
});

Deno.test("signOpenPayload signs null values as empty fields", async () => {
  const envName = "EMAIL_TRACKING_HMAC_SECRET";
  const before = snapshotEnv(envName);
  const secret = `test-${crypto.randomUUID()}`;

  try {
    Deno.env.set(envName, secret);
    const mod = await importFreshTrackingHmac();

    assertEquals(
      await mod.signOpenPayload(null, null),
      await expectedHmacSignature(secret, "open||"),
    );
    assertEquals(
      await mod.signOpenPayload("thread-123", null),
      await expectedHmacSignature(secret, "open|thread-123|"),
    );
    assertEquals(
      await mod.signOpenPayload(null, "message-456"),
      await expectedHmacSignature(secret, "open||message-456"),
    );
  } finally {
    restoreEnv(envName, before);
  }
});

Deno.test("signOpenPayload produces URL-safe base64 without padding", async () => {
  const envName = "EMAIL_TRACKING_HMAC_SECRET";
  const before = snapshotEnv(envName);
  const secret = `test-${crypto.randomUUID()}`;

  try {
    Deno.env.set(envName, secret);
    const mod = await importFreshTrackingHmac();

    const signature = await mod.signOpenPayload("thread-123", "message-456");

    assertExists(signature);
    assertEquals(signature.includes("+"), false);
    assertEquals(signature.includes("/"), false);
    assertEquals(signature.includes("="), false);
    assertEquals(signature.length, 43);
  } finally {
    restoreEnv(envName, before);
  }
});

Deno.test("verifyOpenSignature accepts a valid signature for the same payload", async () => {
  const envName = "EMAIL_TRACKING_HMAC_SECRET";
  const before = snapshotEnv(envName);
  const secret = `test-${crypto.randomUUID()}`;

  try {
    Deno.env.set(envName, secret);
    const mod = await importFreshTrackingHmac();

    const signature = await mod.signOpenPayload("thread-123", "message-456");

    assertExists(signature);
    assertEquals(
      await mod.verifyOpenSignature("thread-123", "message-456", signature),
      true,
    );
  } finally {
    restoreEnv(envName, before);
  }
});

Deno.test("verifyOpenSignature rejects an empty signature", async () => {
  const envName = "EMAIL_TRACKING_HMAC_SECRET";
  const before = snapshotEnv(envName);
  const secret = `test-${crypto.randomUUID()}`;

  try {
    Deno.env.set(envName, secret);
    const mod = await importFreshTrackingHmac();

    assertEquals(
      await mod.verifyOpenSignature("thread-123", "message-456", ""),
      false,
    );
  } finally {
    restoreEnv(envName, before);
  }
});

Deno.test("verifyOpenSignature rejects a signature with different length", async () => {
  const envName = "EMAIL_TRACKING_HMAC_SECRET";
  const before = snapshotEnv(envName);
  const secret = `test-${crypto.randomUUID()}`;

  try {
    Deno.env.set(envName, secret);
    const mod = await importFreshTrackingHmac();

    assertEquals(
      await mod.verifyOpenSignature("thread-123", "message-456", "short"),
      false,
    );
  } finally {
    restoreEnv(envName, before);
  }
});

Deno.test("verifyOpenSignature rejects a tampered signature with the same length", async () => {
  const envName = "EMAIL_TRACKING_HMAC_SECRET";
  const before = snapshotEnv(envName);
  const secret = `test-${crypto.randomUUID()}`;

  try {
    Deno.env.set(envName, secret);
    const mod = await importFreshTrackingHmac();

    const signature = await mod.signOpenPayload("thread-123", "message-456");
    assertExists(signature);

    const first = signature[0] === "A" ? "B" : "A";
    const tampered = first + signature.slice(1);

    assertEquals(tampered.length, signature.length);
    assertEquals(
      await mod.verifyOpenSignature("thread-123", "message-456", tampered),
      false,
    );
  } finally {
    restoreEnv(envName, before);
  }
});

Deno.test("verifyOpenSignature rejects a valid signature for a different thread id", async () => {
  const envName = "EMAIL_TRACKING_HMAC_SECRET";
  const before = snapshotEnv(envName);
  const secret = `test-${crypto.randomUUID()}`;

  try {
    Deno.env.set(envName, secret);
    const mod = await importFreshTrackingHmac();

    const signature = await mod.signOpenPayload("thread-123", "message-456");
    assertExists(signature);

    assertEquals(
      await mod.verifyOpenSignature("thread-999", "message-456", signature),
      false,
    );
  } finally {
    restoreEnv(envName, before);
  }
});

Deno.test("verifyOpenSignature rejects a valid signature for a different message id", async () => {
  const envName = "EMAIL_TRACKING_HMAC_SECRET";
  const before = snapshotEnv(envName);
  const secret = `test-${crypto.randomUUID()}`;

  try {
    Deno.env.set(envName, secret);
    const mod = await importFreshTrackingHmac();

    const signature = await mod.signOpenPayload("thread-123", "message-456");
    assertExists(signature);

    assertEquals(
      await mod.verifyOpenSignature("thread-123", "message-999", signature),
      false,
    );
  } finally {
    restoreEnv(envName, before);
  }
});

Deno.test("verifyOpenSignature distinguishes null and non-null payload fields", async () => {
  const envName = "EMAIL_TRACKING_HMAC_SECRET";
  const before = snapshotEnv(envName);
  const secret = `test-${crypto.randomUUID()}`;

  try {
    Deno.env.set(envName, secret);
    const mod = await importFreshTrackingHmac();

    const nullMessageSignature = await mod.signOpenPayload("thread-123", null);
    assertExists(nullMessageSignature);

    assertEquals(
      await mod.verifyOpenSignature("thread-123", null, nullMessageSignature),
      true,
    );
    assertEquals(
      await mod.verifyOpenSignature("thread-123", "message-456", nullMessageSignature),
      false,
    );
  } finally {
    restoreEnv(envName, before);
  }
});