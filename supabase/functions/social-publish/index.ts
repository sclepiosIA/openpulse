// Edge Function: social-publish
// Publie un post (texte + media optionnels) vers une liste de comptes sociaux.
// Appelable directement (compose immédiat) OU via social-scheduler (CRON, header x-cron-secret).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import { safeErrorLog, sanitizeErrorForClient } from "../_shared/error-sanitizer.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ENC_KEY = Deno.env.get("EMAIL_ENCRYPTION_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET");

async function decryptToken(admin: any, connectionId: string): Promise<string | null> {
  const { data: sec } = await admin
    .from("social_connection_secrets")
    .select("access_token_enc")
    .eq("connection_id", connectionId)
    .maybeSingle();
  if (!sec?.access_token_enc) return null;
  const { data, error } = await admin.rpc("decrypt_social_secret", {
    ciphertext: sec.access_token_enc,
    encryption_key: ENC_KEY,
  });
  if (error) return null;
  return data as string;
}

async function publishFacebook(pageId: string, token: string, message: string, mediaUrl?: string) {
  const url = mediaUrl
    ? `https://graph.facebook.com/v21.0/${pageId}/photos`
    : `https://graph.facebook.com/v21.0/${pageId}/feed`;
  const body = new URLSearchParams({
    [mediaUrl ? "caption" : "message"]: message,
    access_token: token,
  });
  if (mediaUrl) body.set("url", mediaUrl);
  const r = await fetch(url, { method: "POST", body });
  if (!r.ok) throw new Error(`FB publish failed: ${await r.text()}`);
  const j = await r.json();
  return { external_id: String(j.id || j.post_id), permalink: null };
}

async function publishInstagram(igUserId: string, token: string, message: string, mediaUrl: string) {
  // Étape 1 : créer container
  const c = await fetch(
    `https://graph.facebook.com/v21.0/${igUserId}/media?image_url=${encodeURIComponent(mediaUrl)}&caption=${encodeURIComponent(message)}&access_token=${encodeURIComponent(token)}`,
    { method: "POST" },
  );
  if (!c.ok) throw new Error(`IG container failed: ${await c.text()}`);
  const { id: containerId } = await c.json();
  // Étape 2 : publier
  const p = await fetch(
    `https://graph.facebook.com/v21.0/${igUserId}/media_publish?creation_id=${containerId}&access_token=${encodeURIComponent(token)}`,
    { method: "POST" },
  );
  if (!p.ok) throw new Error(`IG publish failed: ${await p.text()}`);
  const j = await p.json();
  return { external_id: String(j.id), permalink: null };
}

async function publishLinkedIn(orgId: string, token: string, message: string) {
  const authorUrn = `urn:li:organization:${orgId}`;
  const r = await fetch("https://api.linkedin.com/v2/posts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
      "LinkedIn-Version": "202405",
    },
    body: JSON.stringify({
      author: authorUrn,
      commentary: message,
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
  });
  if (!r.ok) throw new Error(`LinkedIn publish failed: ${await r.text()}`);
  const postId = r.headers.get("x-restli-id") || (await r.json()).id;
  return { external_id: String(postId), permalink: `https://linkedin.com/feed/update/${postId}` };
}

async function publishTikTok(token: string, message: string, mediaUrl?: string) {
  // TikTok Content Posting API — direct video init via PULL_FROM_URL
  if (!mediaUrl) throw new Error("TikTok requires a video media URL");
  const r = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      post_info: { title: message.slice(0, 150), privacy_level: "PUBLIC_TO_EVERYONE", disable_duet: false, disable_comment: false, disable_stitch: false },
      source_info: { source: "PULL_FROM_URL", video_url: mediaUrl },
    }),
  });
  if (!r.ok) throw new Error(`TikTok publish failed: ${await r.text()}`);
  const j = await r.json();
  return { external_id: String(j.data?.publish_id || "pending"), permalink: null };
}

interface AccountRow {
  id: string;
  brand_id: string;
  connection_id: string;
  platform: string;
  external_id: string;
}

async function publishToAccount(admin: any, account: AccountRow, message: string, mediaUrl: string | undefined) {
  const token = await decryptToken(admin, account.connection_id);
  if (!token) throw new Error("Token unavailable");
  if (account.platform === "facebook") return await publishFacebook(account.external_id, token, message, mediaUrl);
  if (account.platform === "instagram") {
    if (!mediaUrl) throw new Error("Instagram requires a media URL");
    return await publishInstagram(account.external_id, token, message, mediaUrl);
  }
  if (account.platform === "linkedin") return await publishLinkedIn(account.external_id, token, message);
  if (account.platform === "tiktok") return await publishTikTok(token, message, mediaUrl);
  throw new Error(`Unsupported platform ${account.platform}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: getCorsHeaders(req.headers.get('origin')) });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const isCron = CRON_SECRET && req.headers.get("x-cron-secret") === CRON_SECRET;

  try {
    let userId: string | null = null;
    if (!isCron) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...getCorsHeaders(req.headers.get('origin')), "Content-Type": "application/json" } });
      }
      const sbUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userRes } = await sbUser.auth.getUser();
      if (!userRes?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...getCorsHeaders(req.headers.get('origin')), "Content-Type": "application/json" } });
      }
      userId = userRes.user.id;
      const { data: isPub } = await admin.rpc("is_social_publisher", { _user_id: userId });
      if (!isPub) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...getCorsHeaders(req.headers.get('origin')), "Content-Type": "application/json" } });
      }
    }

    const body = await req.json();
    const scheduledId: string | undefined = body.scheduled_id;
    let message: string;
    let mediaUrl: string | undefined;
    let accountIds: string[];

    if (scheduledId) {
      const { data: sched, error } = await admin.from("social_scheduled_posts").select("*").eq("id", scheduledId).maybeSingle();
      if (error || !sched) throw new Error("Scheduled post not found");
      message = sched.message;
      mediaUrl = sched.media_paths?.[0];
      accountIds = sched.target_account_ids || [];
      await admin.from("social_scheduled_posts").update({ status: "processing", last_attempt_at: new Date().toISOString(), attempt_count: (sched.attempt_count || 0) + 1 }).eq("id", scheduledId);
    } else {
      message = String(body.message || "").trim();
      mediaUrl = body.media_url || undefined;
      accountIds = body.account_ids || [];
      if (!message || accountIds.length === 0) {
        return new Response(JSON.stringify({ error: "message + account_ids required" }), { status: 400, headers: { ...getCorsHeaders(req.headers.get('origin')), "Content-Type": "application/json" } });
      }
    }

    const { data: accounts } = await admin.from("social_accounts").select("id, brand_id, connection_id, platform, external_id").in("id", accountIds);
    const published: Record<string, { external_id: string; permalink: string | null }> = {};
    const errors: Record<string, string> = {};

    for (const acc of (accounts || []) as AccountRow[]) {
      try {
        const res = await publishToAccount(admin, acc, message, mediaUrl);
        published[acc.id] = res;
        await admin.from("social_posts").upsert({
          account_id: acc.id,
          brand_id: acc.brand_id,
          platform: acc.platform,
          external_id: res.external_id,
          permalink: res.permalink,
          message,
          media_urls: mediaUrl ? [mediaUrl] : [],
          media_type: mediaUrl ? "image" : "text",
          published_at: new Date().toISOString(),
          last_synced_at: new Date().toISOString(),
        }, { onConflict: "platform,external_id" });
      } catch (e: any) {
        errors[acc.id] = (e?.message || "").slice(0, 500);
      }
    }

    if (scheduledId) {
      const allOk = Object.keys(errors).length === 0;
      await admin.from("social_scheduled_posts").update({
        status: allOk ? "published" : "failed",
        published_post_ids: published,
        error_message: allOk ? null : JSON.stringify(errors).slice(0, 1000),
      }).eq("id", scheduledId);
    }

    return new Response(JSON.stringify({ ok: true, published, errors }), {
      headers: { ...getCorsHeaders(req.headers.get('origin')), "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(JSON.stringify(safeErrorLog("social-publish", e)));
    return new Response(JSON.stringify({ error: sanitizeErrorForClient(e) }), {
      status: 500,
      headers: { ...getCorsHeaders(req.headers.get('origin')), "Content-Type": "application/json" },
    });
  }
});
