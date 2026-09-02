// Session 11 — item 7: pixel transparent 1x1 GIF qui enregistre l'ouverture d'un email
// puis répond avec l'image. Alimente prospect_behavioral_events ('email_opened', weight=1).
//
// Sécurité: chaque URL de pixel est signée HMAC-SHA256 (param `s`) par
// `_shared/tracking-hmac.ts` au moment de l'envoi de l'email. Toute requête
// sans signature valide est silencieusement ignorée côté logging (mais le pixel
// est toujours servi pour ne pas casser l'affichage chez le destinataire).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { safeErrorLog } from "../_shared/error-sanitizer.ts";
import { verifyOpenSignature, isTrackingHmacConfigured } from "../_shared/tracking-hmac.ts";


import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

// GIF 1x1 transparent (43 octets)
const PIXEL = Uint8Array.from([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00,
  0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00, 0x00, 0x00,
  0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02,
  0x44, 0x01, 0x00, 0x3b,
]);

const pixelResponse = () =>
  new Response(PIXEL, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "image/gif",
      "Content-Length": String(PIXEL.byteLength),
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const threadId = url.searchParams.get("t");
  const messageIdParam = url.searchParams.get("m");
  const sig = url.searchParams.get("s") ?? "";

  // Fire-and-forget — l'image se sert immédiatement
  (async () => {
    try {
      const ua = req.headers.get("user-agent") ?? "";
      // Filtrage : ignorer prefetch googleimageproxy + bots évidents
      if (/googleimageproxy|preview|bot|crawler|spider/i.test(ua) && !/mail/i.test(ua)) {
        // googleimageproxy = Gmail proxy (légitime), on garde
        // bots purs : on skippe
        return;
      }

      // 🔒 HMAC verification — required to prevent forged open events.
      // If the secret is configured but the signature is missing/invalid,
      // we silently drop the event (the pixel is still served to the recipient).
      if (isTrackingHmacConfigured()) {
        const valid = await verifyOpenSignature(threadId, messageIdParam, sig);
        if (!valid) {
          return;
        }
      }


      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      let etablissementId: string | null = null;
      if (threadId) {
        const { data: thread } = await supabase
          .from("email_threads")
          .select("etablissement_id")
          .eq("id", threadId)
          .maybeSingle();
        etablissementId = thread?.etablissement_id ?? null;
      }

      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

      const { data: inserted, error: insErr } = await supabase
        .from("email_opens")
        .insert({
          thread_id: threadId,
          message_id: messageIdParam,
          etablissement_id: etablissementId,
          ip,
          user_agent: ua,
        })
        .select("id")
        .single();

      if (insErr) {
        console.error("[track-email-open] insert error", insErr.message);
        return;
      }

      if (etablissementId) {
        await supabase.rpc("record_behavioral_event", {
          _etablissement_id: etablissementId,
          _event_type: "email_opened",
          _occurred_at: new Date().toISOString(),
          _weight: 1,
          _source_id: inserted?.id ?? null,
          _source_type: "email_open",
          _metadata: { thread_id: threadId },
        });
      }
    } catch (err) {
      console.error("[track-email-open] log failure", (err as Error).message);
    }
  })();

  return pixelResponse();
});
