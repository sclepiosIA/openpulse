import { PLATFORM_CORS, preflight, jsonResponse } from "../_shared/platform-auth.ts";

Deno.serve((req) => {
  const pf = preflight(req);
  if (pf) return pf;
  return jsonResponse({
    status: "ok",
    version: "1.0.0",
    time: new Date().toISOString(),
  });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _cors = PLATFORM_CORS;
