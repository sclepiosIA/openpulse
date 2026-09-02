import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("request object for edge function style usage can be constructed offline", () => {
  const req = new Request("http://localhost", {
    method: "OPTIONS",
    headers: {
      origin: "http://example.com",
      "access-control-request-method": "POST",
      "content-type": "application/json",
    },
  });

  assertEquals(req.method, "OPTIONS");
  assertEquals(req.url, "http://localhost/");
  assertEquals(req.headers.get("content-type"), "application/json");
});

Deno.test("json request body for support ticket can be built and parsed offline", async () => {
  const payload = {
    titre: "Bug critique sur export PDF",
    description: "Le fichier généré est vide",
    tags: ["bug", "urgent"],
    type_probleme: "bug",
    priorite: "critique",
    contact_nom: "Jean Dupont",
    contact_email: "jean.dupont@example.com",
    etablissement_id: "550e8400-e29b-41d4-a716-446655440000",
  };

  const req = new Request("http://localhost/api-v1-tickets", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": "test-key" },
    body: JSON.stringify(payload),
  });

  const parsed = await req.json();

  assertEquals(parsed.titre, "Bug critique sur export PDF");
  assertEquals(parsed.priorite, "critique");
  assertEquals(parsed.tags, ["bug", "urgent"]);
  assertEquals(req.headers.get("x-api-key"), "test-key");
});

Deno.test("invalid json body parsing rejects as expected", async () => {
  const req = new Request("http://localhost/api-v1-tickets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{invalid json",
  });

  await assertRejects(() => req.json());
});

Deno.test("multipart form-data request for ticket attachments can be created offline", async () => {
  const form = new FormData();
  form.set("titre", "Incident impression");
  form.set("description", "Impossible d'imprimer les ordonnances");
  form.set("tags", JSON.stringify(["bug", "impression"]));
  form.set("priorite", "haute");
  form.set("type_probleme", "bug");
  form.set("contact_email", "support@example.com");
  form.append("attachments", new File(["demo"], "capture.txt", { type: "text/plain" }));

  const req = new Request("http://localhost/api-v1-tickets", {
    method: "POST",
    body: form,
  });

  const parsed = await req.formData();

  assertEquals(parsed.get("titre"), "Incident impression");
  assertEquals(parsed.get("priorite"), "haute");
  const attachment = parsed.get("attachments");
  assertExists(attachment);
  assertEquals((attachment as File).name, "capture.txt");
});

Deno.test("environment variables can be set and restored in offline test context", () => {
  const previous = Deno.env.get("X_API_KEY_TEST");

  try {
    Deno.env.set("X_API_KEY_TEST", "offline-value");
    assertEquals(Deno.env.get("X_API_KEY_TEST"), "offline-value");
  } finally {
    if (previous === undefined) {
      Deno.env.delete("X_API_KEY_TEST");
    } else {
      Deno.env.set("X_API_KEY_TEST", previous);
    }
  }
});

Deno.test("assertThrows works for explicit validation example mirroring API constraints", () => {
  const validateTitre = (titre: string) => {
    if (!titre || titre.trim().length === 0) {
      throw new Error("titre requis");
    }
    if (titre.length > 500) {
      throw new Error("titre trop long");
    }
    return titre.trim();
  };

  assertEquals(validateTitre("  Mon ticket  "), "Mon ticket");
  assertThrows(() => validateTitre(""), Error, "titre requis");
  assertThrows(() => validateTitre("a".repeat(501)), Error, "titre trop long");
});

Deno.test("module loads source text offline without executing serve side effects", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

  assertExists(source);
  assertEquals(source.includes('openapi: "3.0.3"'), true);
  assertEquals(source.includes('title: "OpenPulse API"'), true);
  assertEquals(source.includes('"/api-v1/etablissements"'), true);
  assertEquals(source.includes('"/api-v1-tickets"'), true);
  assertEquals(source.includes('"X-API-Key"'), true);
  assertEquals(source.includes("serve("), true);
});

Deno.test("module source declares expected security schemes and ticket constraints", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

  assertEquals(source.includes("bearerAuth"), true);
  assertEquals(source.includes("apiKey"), true);
  assertEquals(source.includes('maxLength: 500'), true);
  assertEquals(source.includes('maxItems: 5'), true);
  assertEquals(source.includes('"critique"'), true);
  assertEquals(source.includes('"multipart/form-data"'), true);
});

Deno.test("simple offline validation mirrors documented enums and limits", () => {
  const allowedPriorites = ["basse", "moyenne", "haute", "critique"];
  const allowedTypes = ["bug", "fonctionnalite", "question", "amelioration", "autre"];

  const validateTicketLikePayload = (payload: {
    titre?: string;
    priorite?: string;
    type_probleme?: string;
    tags?: string[];
    attachmentsCount?: number;
  }) => {
    if (!payload.titre || payload.titre.trim() === "") {
      throw new Error("titre requis");
    }
    if (payload.titre.length > 500) {
      throw new Error("titre trop long");
    }
    if (payload.priorite && !allowedPriorites.includes(payload.priorite)) {
      throw new Error("priorite invalide");
    }
    if (payload.type_probleme && !allowedTypes.includes(payload.type_probleme)) {
      throw new Error("type_probleme invalide");
    }
    if (payload.attachmentsCount !== undefined && payload.attachmentsCount > 5) {
      throw new Error("trop de fichiers");
    }
    return {
      titre: payload.titre.trim(),
      priorite: payload.priorite ?? "moyenne",
      type_probleme: payload.type_probleme ?? "autre",
      tags: payload.tags ?? [],
    };
  };

  assertEquals(
    validateTicketLikePayload({
      titre: "  Assistance connexion  ",
      priorite: "haute",
      type_probleme: "question",
      tags: ["support"],
      attachmentsCount: 1,
    }),
    {
      titre: "Assistance connexion",
      priorite: "haute",
      type_probleme: "question",
      tags: ["support"],
    },
  );

  assertThrows(() => validateTicketLikePayload({ titre: "" }), Error, "titre requis");
  assertThrows(() => validateTicketLikePayload({ titre: "x".repeat(501) }), Error, "titre trop long");
  assertThrows(() => validateTicketLikePayload({ titre: "ok", priorite: "urgent" }), Error, "priorite invalide");
  assertThrows(() => validateTicketLikePayload({ titre: "ok", type_probleme: "incident" }), Error, "type_probleme invalide");
  assertThrows(() => validateTicketLikePayload({ titre: "ok", attachmentsCount: 6 }), Error, "trop de fichiers");
});