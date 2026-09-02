import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { origineAutorisee } from './cors.ts'
import { requireInternalSecret } from "./internal-secret.ts";

const cors = { 'Access-Control-Allow-Origin': origineAutorisee() };

function setEnv(k: string, v: string | undefined) {
  if (v === undefined) Deno.env.delete(k);
  else Deno.env.set(k, v);
}

Deno.test("requireInternalSecret rejects when no secret provided", () => {
  setEnv("INTERNAL_INVOCATION_SECRET", "topsecret");
  setEnv("SUPABASE_SERVICE_ROLE_KEY", "srv-key");
  const req = new Request("https://x/", { method: "POST" });
  const res = requireInternalSecret(req, cors);
  assertEquals(res?.status, 401);
});

Deno.test("requireInternalSecret accepts x-internal-secret match", () => {
  setEnv("INTERNAL_INVOCATION_SECRET", "topsecret");
  const req = new Request("https://x/", {
    method: "POST",
    headers: { "x-internal-secret": "topsecret" },
  });
  assertEquals(requireInternalSecret(req, cors), null);
});

Deno.test("requireInternalSecret accepts service_role Bearer", () => {
  setEnv("INTERNAL_INVOCATION_SECRET", "");
  setEnv("SUPABASE_SERVICE_ROLE_KEY", "srv-key");
  const req = new Request("https://x/", {
    method: "POST",
    headers: { Authorization: "Bearer srv-key" },
  });
  assertEquals(requireInternalSecret(req, cors), null);
});

Deno.test("requireInternalSecret rejects wrong secret (timing-safe)", () => {
  setEnv("INTERNAL_INVOCATION_SECRET", "topsecret");
  const req = new Request("https://x/", {
    method: "POST",
    headers: { "x-internal-secret": "wrong" },
  });
  const res = requireInternalSecret(req, cors);
  assertEquals(res?.status, 401);
});

Deno.test("requireInternalSecret can disable Bearer fallback", () => {
  setEnv("SUPABASE_SERVICE_ROLE_KEY", "srv-key");
  const req = new Request("https://x/", {
    method: "POST",
    headers: { Authorization: "Bearer srv-key" },
  });
  const res = requireInternalSecret(req, cors, { allowServiceRoleBearer: false });
  assertEquals(res?.status, 401);
});
