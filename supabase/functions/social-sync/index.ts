// Edge Function: social-sync
// Synchronise pour chaque connexion active :
//   1. Comptes/pages (social_accounts)
//   2. Posts récents + métriques (social_posts + social_metric_points)
// Appelable manuellement (auth user) ou via CRON (header x-cron-secret).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import { safeErrorLog, sanitizeErrorForClient } from "../_shared/error-sanitizer.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ENC_KEY = Deno.env.get("EMAIL_ENCRYPTION_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET");

interface Conn {
  id: string;
  brand_id: string;
  platform: "facebook" | "instagram" | "linkedin" | "tiktok";
  external_user_id: string | null;
  external_user_name: string | null;
}

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

async function upsertAccount(admin: any, row: any) {
  await admin.from("social_accounts").upsert(row, { onConflict: "platform,external_id" });
}

async function upsertPost(admin: any, row: any): Promise<string | null> {
  await admin.from("social_posts").upsert(row, { onConflict: "platform,external_id" });
  // Snapshot metric
  await admin.from("social_metric_points").upsert(
    [
      { account_id: row.account_id, brand_id: row.brand_id, platform: row.platform, metric: "likes", value: row.likes_count || 0 },
      { account_id: row.account_id, brand_id: row.brand_id, platform: row.platform, metric: "comments", value: row.comments_count || 0 },
      { account_id: row.account_id, brand_id: row.brand_id, platform: row.platform, metric: "shares", value: row.shares_count || 0 },
      { account_id: row.account_id, brand_id: row.brand_id, platform: row.platform, metric: "views", value: row.views_count || 0 },
    ],
    { onConflict: "account_id,metric,captured_at", ignoreDuplicates: true },
  );
  const { data: postRow } = await admin
    .from("social_posts")
    .select("id")
    .eq("platform", row.platform)
    .eq("external_id", row.external_id)
    .maybeSingle();
  return postRow?.id ?? null;
}

async function syncMetaCommentsForPost(
  admin: any,
  brandId: string,
  postId: string,
  platform: "facebook" | "instagram",
  externalPostId: string,
  pageToken: string,
) {
  try {
    const url = `https://graph.facebook.com/v21.0/${externalPostId}/comments?fields=id,from,message,created_time,like_count,parent&limit=25&access_token=${encodeURIComponent(pageToken)}`;
    const res = await fetch(url);
    if (!res.ok) return;
    const items = (await res.json()).data || [];
    for (const c of items) {
      await admin.from("social_comments").upsert(
        {
          post_id: postId,
          brand_id: brandId,
          platform,
          external_id: c.id,
          parent_external_id: c.parent?.id || null,
          author_name: c.from?.name || c.from?.username || null,
          author_id: c.from?.id || null,
          message: c.message || null,
          created_time: c.created_time || null,
          likes_count: c.like_count || 0,
          raw: c,
        },
        { onConflict: "platform,external_id", ignoreDuplicates: false },
      );
    }
  } catch (_) {
    // best-effort
  }
}

// ============ FACEBOOK / INSTAGRAM (Meta Graph API) ============
async function syncMeta(admin: any, conn: Conn, token: string): Promise<number> {
  let items = 0;
  // 1. Récupérer pages
  const pagesRes = await fetch(
    `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,username,picture,access_token,instagram_business_account&access_token=${encodeURIComponent(token)}`,
  );
  if (!pagesRes.ok) throw new Error(`Meta pages fetch failed: ${pagesRes.status}`);
  const pagesJson = await pagesRes.json();
  const pages = pagesJson.data || [];

  for (const page of pages) {
    const pageToken = page.access_token || token;

    if (conn.platform === "facebook") {
      const accountRow = {
        connection_id: conn.id,
        brand_id: conn.brand_id,
        platform: "facebook",
        external_id: page.id,
        display_name: page.name,
        username: page.username || null,
        avatar_url: page.picture?.data?.url || null,
        profile_url: `https://facebook.com/${page.id}`,
        account_type: "page",
      };
      await upsertAccount(admin, accountRow);

      const { data: acc } = await admin
        .from("social_accounts")
        .select("id")
        .eq("platform", "facebook")
        .eq("external_id", page.id)
        .maybeSingle();
      if (!acc) continue;

      const postsRes = await fetch(
        `https://graph.facebook.com/v21.0/${page.id}/posts?fields=id,message,permalink_url,created_time,full_picture,likes.summary(true),comments.summary(true),shares,insights.metric(post_impressions)&limit=25&access_token=${encodeURIComponent(pageToken)}`,
      );
      if (!postsRes.ok) continue;
      const posts = (await postsRes.json()).data || [];
      for (const p of posts) {
        const impressions =
          p.insights?.data?.find((i: any) => i.name === "post_impressions")?.values?.[0]?.value || 0;
        const fbPostId = await upsertPost(admin, {
          account_id: acc.id,
          brand_id: conn.brand_id,
          platform: "facebook",
          external_id: p.id,
          permalink: p.permalink_url || null,
          message: p.message || null,
          media_urls: p.full_picture ? [p.full_picture] : [],
          media_type: p.full_picture ? "image" : "text",
          published_at: p.created_time || null,
          likes_count: p.likes?.summary?.total_count || 0,
          comments_count: p.comments?.summary?.total_count || 0,
          shares_count: p.shares?.count || 0,
          views_count: impressions,
          raw: p,
          last_synced_at: new Date().toISOString(),
        });
        if (fbPostId && (p.comments?.summary?.total_count ?? 0) > 0) {
          await syncMetaCommentsForPost(admin, conn.brand_id, fbPostId, "facebook", p.id, pageToken);
        }
        items++;
      }
    }

    if (conn.platform === "instagram" && page.instagram_business_account?.id) {
      const igId = page.instagram_business_account.id;
      const igProfileRes = await fetch(
        `https://graph.facebook.com/v21.0/${igId}?fields=id,username,name,profile_picture_url,followers_count&access_token=${encodeURIComponent(pageToken)}`,
      );
      if (!igProfileRes.ok) continue;
      const igProfile = await igProfileRes.json();
      const accountRow = {
        connection_id: conn.id,
        brand_id: conn.brand_id,
        platform: "instagram",
        external_id: igId,
        display_name: igProfile.name || igProfile.username,
        username: igProfile.username,
        avatar_url: igProfile.profile_picture_url || null,
        profile_url: `https://instagram.com/${igProfile.username}`,
        account_type: "business",
        followers_count: igProfile.followers_count || 0,
      };
      await upsertAccount(admin, accountRow);

      const { data: acc } = await admin
        .from("social_accounts")
        .select("id")
        .eq("platform", "instagram")
        .eq("external_id", igId)
        .maybeSingle();
      if (!acc) continue;

      const mediaRes = await fetch(
        `https://graph.facebook.com/v21.0/${igId}/media?fields=id,caption,media_url,media_type,permalink,timestamp,like_count,comments_count&limit=25&access_token=${encodeURIComponent(pageToken)}`,
      );
      if (!mediaRes.ok) continue;
      const media = (await mediaRes.json()).data || [];
      for (const m of media) {
        const igPostId = await upsertPost(admin, {
          account_id: acc.id,
          brand_id: conn.brand_id,
          platform: "instagram",
          external_id: m.id,
          permalink: m.permalink || null,
          message: m.caption || null,
          media_urls: m.media_url ? [m.media_url] : [],
          media_type: m.media_type?.toLowerCase() || "image",
          published_at: m.timestamp || null,
          likes_count: m.like_count || 0,
          comments_count: m.comments_count || 0,
          raw: m,
          last_synced_at: new Date().toISOString(),
        });
        if (igPostId && (m.comments_count ?? 0) > 0) {
          await syncMetaCommentsForPost(admin, conn.brand_id, igPostId, "instagram", m.id, pageToken);
        }
        items++;
      }
    }
  }
  return items;
}

// ============ LINKEDIN ============
async function syncLinkedIn(admin: any, conn: Conn, token: string): Promise<number> {
  let items = 0;
  // Organisations administrées
  const orgsRes = await fetch(
    "https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&projection=(elements*(organization~(id,vanityName,localizedName,logoV2)))",
    { headers: { Authorization: `Bearer ${token}`, "X-Restli-Protocol-Version": "2.0.0" } },
  );
  if (!orgsRes.ok) {
    // Fallback : compte personnel (userinfo)
    const me = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (me.ok) {
      const j = await me.json();
      await upsertAccount(admin, {
        connection_id: conn.id,
        brand_id: conn.brand_id,
        platform: "linkedin",
        external_id: j.sub,
        display_name: j.name,
        avatar_url: j.picture || null,
        profile_url: "https://linkedin.com/in/me",
        account_type: "member",
      });
    }
    return items;
  }
  const orgsJson = await orgsRes.json();
  const elements = orgsJson.elements || [];
  for (const el of elements) {
    const org = el["organization~"];
    if (!org) continue;
    const orgUrn = `urn:li:organization:${org.id}`;
    await upsertAccount(admin, {
      connection_id: conn.id,
      brand_id: conn.brand_id,
      platform: "linkedin",
      external_id: String(org.id),
      display_name: org.localizedName || org.vanityName || `Org ${org.id}`,
      username: org.vanityName || null,
      profile_url: org.vanityName ? `https://linkedin.com/company/${org.vanityName}` : null,
      account_type: "organization",
    });

    const { data: acc } = await admin
      .from("social_accounts")
      .select("id")
      .eq("platform", "linkedin")
      .eq("external_id", String(org.id))
      .maybeSingle();
    if (!acc) continue;

    // Posts récents
    const postsRes = await fetch(
      `https://api.linkedin.com/v2/posts?q=author&author=${encodeURIComponent(orgUrn)}&count=20`,
      { headers: { Authorization: `Bearer ${token}`, "X-Restli-Protocol-Version": "2.0.0" } },
    );
    if (!postsRes.ok) continue;
    const posts = (await postsRes.json()).elements || [];
    for (const p of posts) {
      await upsertPost(admin, {
        account_id: acc.id,
        brand_id: conn.brand_id,
        platform: "linkedin",
        external_id: p.id,
        permalink: `https://linkedin.com/feed/update/${p.id}`,
        message: p.commentary || null,
        media_urls: [],
        media_type: "text",
        published_at: p.publishedAt ? new Date(p.publishedAt).toISOString() : null,
        raw: p,
        last_synced_at: new Date().toISOString(),
      });
      items++;
    }
  }
  return items;
}

// ============ TIKTOK ============
async function syncTikTok(admin: any, conn: Conn, token: string): Promise<number> {
  let items = 0;
  const userRes = await fetch(
    "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url,username,follower_count",
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!userRes.ok) return items;
  const u = (await userRes.json()).data?.user;
  if (!u) return items;
  await upsertAccount(admin, {
    connection_id: conn.id,
    brand_id: conn.brand_id,
    platform: "tiktok",
    external_id: u.open_id,
    display_name: u.display_name,
    username: u.username || null,
    avatar_url: u.avatar_url || null,
    profile_url: u.username ? `https://tiktok.com/@${u.username}` : null,
    account_type: "creator",
    followers_count: u.follower_count || 0,
  });

  const { data: acc } = await admin
    .from("social_accounts")
    .select("id")
    .eq("platform", "tiktok")
    .eq("external_id", u.open_id)
    .maybeSingle();
  if (!acc) return items;

  const videosRes = await fetch(
    "https://open.tiktokapis.com/v2/video/list/?fields=id,title,video_description,create_time,cover_image_url,share_url,view_count,like_count,comment_count,share_count",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ max_count: 20 }),
    },
  );
  if (!videosRes.ok) return items;
  const videos = (await videosRes.json()).data?.videos || [];
  for (const v of videos) {
    await upsertPost(admin, {
      account_id: acc.id,
      brand_id: conn.brand_id,
      platform: "tiktok",
      external_id: v.id,
      permalink: v.share_url || null,
      message: v.title || v.video_description || null,
      media_urls: v.cover_image_url ? [v.cover_image_url] : [],
      media_type: "video",
      published_at: v.create_time ? new Date(v.create_time * 1000).toISOString() : null,
      likes_count: v.like_count || 0,
      comments_count: v.comment_count || 0,
      shares_count: v.share_count || 0,
      views_count: v.view_count || 0,
      raw: v,
      last_synced_at: new Date().toISOString(),
    });
    items++;
  }
  return items;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: getCorsHeaders(req.headers.get('origin')) });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const isCron = CRON_SECRET && req.headers.get("x-cron-secret") === CRON_SECRET;

  try {
    if (!isCron) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...getCorsHeaders(req.headers.get('origin')), "Content-Type": "application/json" },
        });
      }
      const sbUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userRes } = await sbUser.auth.getUser();
      if (!userRes?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...getCorsHeaders(req.headers.get('origin')), "Content-Type": "application/json" },
        });
      }
      const { data: isViewer } = await admin.rpc("is_social_viewer", { _user_id: userRes.user.id });
      if (!isViewer) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...getCorsHeaders(req.headers.get('origin')), "Content-Type": "application/json" },
        });
      }
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const brandFilter = body.brand_id || null;
    const platformFilter = body.platform || null;

    let q = admin.from("social_connections").select("id, brand_id, platform, external_user_id, external_user_name").eq("status", "active");
    if (brandFilter) q = q.eq("brand_id", brandFilter);
    if (platformFilter) q = q.eq("platform", platformFilter);
    const { data: conns, error: cErr } = await q;
    if (cErr) throw cErr;

    const results: Array<{ connection_id: string; platform: string; items: number; ok: boolean; error?: string }> = [];
    for (const conn of (conns || []) as Conn[]) {
      const started = Date.now();
      let items = 0;
      let ok = true;
      let errMsg: string | undefined;
      try {
        const token = await decryptToken(admin, conn.id);
        if (!token) throw new Error("Token missing");
        if (conn.platform === "facebook" || conn.platform === "instagram") items = await syncMeta(admin, conn, token);
        else if (conn.platform === "linkedin") items = await syncLinkedIn(admin, conn, token);
        else if (conn.platform === "tiktok") items = await syncTikTok(admin, conn, token);
      } catch (e: any) {
        ok = false;
        errMsg = (e?.message || "").slice(0, 500);
        await admin.from("social_connections").update({ last_error: errMsg, status: "error" }).eq("id", conn.id);
      }
      await admin.from("social_sync_runs").insert({
        connection_id: conn.id,
        brand_id: conn.brand_id,
        platform: conn.platform,
        kind: isCron ? "cron" : "manual",
        status: ok ? "success" : "error",
        items_processed: items,
        duration_ms: Date.now() - started,
        error_message: errMsg || null,
        ended_at: new Date().toISOString(),
      });
      results.push({ connection_id: conn.id, platform: conn.platform, items, ok, error: errMsg });
    }

    return new Response(JSON.stringify({ ok: true, connections: results.length, results }), {
      headers: { ...getCorsHeaders(req.headers.get('origin')), "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(JSON.stringify(safeErrorLog("social-sync", e)));
    return new Response(JSON.stringify({ error: sanitizeErrorForClient(e) }), {
      status: 500,
      headers: { ...getCorsHeaders(req.headers.get('origin')), "Content-Type": "application/json" },
    });
  }
});
