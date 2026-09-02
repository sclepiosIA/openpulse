// Public booking proxy — exposes safe, anon-callable read & create endpoints
// for the external "Site Web OpenPulse" project.
// - No user_id is ever returned to the public.
// - Uses the service role internally; RLS is bypassed by design and replaced
//   by tight server-side filtering (is_active = true, slug match, etc.).
// - JWT is NOT verified (anonymous public access).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { origineAutorisee } from '../_shared/cors.ts'
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";
import { checkRateLimit, extractClientIp, rateLimitedResponse } from "../_shared/rate-limit.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': origineAutorisee(),
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Strip user_id and any other internal identifiers from a record
function sanitizePage(page: any) {
  if (!page) return null;
  const { user_id, ...safe } = page;
  return safe;
}

function sanitizeSlot(slot: any) {
  if (!slot) return null;
  const { user_id, ...safe } = slot;
  return safe;
}

function sanitizeHost(h: any) {
  if (!h) return null;
  // Expose only display info needed for UI (name, avatar)
  return {
    id: h.id,
    role: h.role,
    is_required: h.is_required,
    profile: h.profile
      ? {
          nom: h.profile.nom,
          prenom: h.profile.prenom,
          avatar_url: h.profile.avatar_url ?? null,
        }
      : null,
  };
}

function badRequest(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Basic input validation helpers
function isUuid(v: unknown): v is string {
  return typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}
function isIsoDate(v: unknown): v is string {
  return typeof v === "string" && !isNaN(Date.parse(v));
}
function isEmail(v: unknown): v is string {
  return typeof v === "string" && /.+@.+\..+/.test(v) && v.length <= 254;
}
function clean(v: unknown, max = 500): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

async function handleGetPage(body: any) {
  const slug = clean(body?.slug, 200);
  if (!slug) return badRequest("slug requis");

  const { data: page, error: pageErr } = await admin
    .from("booking_pages")
    .select(
      "id, slug, title, description, welcome_message, logo_url, cover_image_url, theme_color, default_video_provider, is_active, require_phone, require_company, custom_questions, timezone, success_redirect_url, user_id",
    )
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (pageErr) return badRequest(pageErr.message, 500);
  if (!page) {
    return new Response(JSON.stringify({ page: null }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const hostUserId = page.user_id as string;

  // Visible types for this page
  const { data: pageTypes } = await admin
    .from("booking_page_types")
    .select(
      "order_index, is_visible, booking_type:booking_types(id, name, description, duration_minutes, category, color, location_type, video_provider, is_active, requires_approval, min_notice_hours, max_future_days, buffer_before_minutes, buffer_after_minutes)",
    )
    .eq("booking_page_id", page.id)
    .eq("is_visible", true)
    .order("order_index", { ascending: true });

  const booking_types = (pageTypes || [])
    .map((pt: any) => pt.booking_type)
    .filter((t: any) => t && t.is_active);

  // Hosts (display info only)
  const { data: hostsRaw } = await admin
    .from("booking_page_hosts")
    .select(
      "id, role, is_required, user_id, profile:profiles!booking_page_hosts_user_id_fkey(nom, prenom, avatar_url)",
    )
    .eq("booking_page_id", page.id);

  const primaryHostProfile = hostsRaw?.find((h: any) => h.user_id === hostUserId)?.profile;
  let host = primaryHostProfile
    ? {
        nom: primaryHostProfile.nom,
        prenom: primaryHostProfile.prenom,
        avatar_url: primaryHostProfile.avatar_url ?? null,
      }
    : null;

  if (!host) {
    const { data: hostProfile } = await admin
      .from("profiles")
      .select("nom, prenom, avatar_url")
      .eq("id", hostUserId)
      .maybeSingle();
    if (hostProfile) {
      host = {
        nom: hostProfile.nom,
        prenom: hostProfile.prenom,
        avatar_url: hostProfile.avatar_url ?? null,
      };
    }
  }

  const hosts = (hostsRaw || []).map(sanitizeHost);

  // Weekly availability shape (no user_id)
  const { data: avail } = await admin
    .from("booking_availability_slots")
    .select("id, day_of_week, start_time, end_time, is_active, booking_type_id")
    .eq("user_id", hostUserId)
    .eq("is_active", true);

  return new Response(
    JSON.stringify({
      page: {
        ...sanitizePage(page),
        booking_types,
        host,
        hosts,
        availability: (avail || []).map((a: any) => ({
          id: a.id,
          day_of_week: a.day_of_week,
          start_time: a.start_time,
          end_time: a.end_time,
          booking_type_id: a.booking_type_id,
        })),
        // opaque token used in subsequent calls instead of leaking the user_id
        host_token: page.id,
      },
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

// Convert a wall-clock time in Europe/Paris (YYYY-MM-DD HH:mm) to a UTC Date.
// DST-safe: derives the actual Paris offset for the given instant.
function parisWallClockToUtc(dateStr: string, hours: number, minutes: number): Date {
  const naiveUtc = new Date(`${dateStr}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00Z`);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts = fmt.formatToParts(naiveUtc).reduce((acc: any, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});
  const parisAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour === "24" ? "0" : parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  const offsetMs = parisAsUtc - naiveUtc.getTime();
  return new Date(naiveUtc.getTime() - offsetMs);
}

// Monday=0..Sunday=6 day-of-week in Europe/Paris for a YYYY-MM-DD date
function parisDayOfWeek(dateStr: string): number {
  const noonUtc = new Date(`${dateStr}T12:00:00Z`);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    weekday: "short",
  }).format(noonUtc);
  const map: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  return map[weekday] ?? 0;
}

async function handleGetSlots(body: any) {
  const slug = clean(body?.slug, 200);
  const bookingTypeId = body?.booking_type_id;
  const dateStr = body?.date; // YYYY-MM-DD
  if (!slug) return badRequest("slug requis");
  if (!isUuid(bookingTypeId)) return badRequest("booking_type_id invalide");
  if (typeof dateStr !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return badRequest("date invalide (attendu YYYY-MM-DD)");
  }

  const { data: page } = await admin
    .from("booking_pages")
    .select("id, user_id")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (!page) return badRequest("page introuvable", 404);

  const hostUserId = page.user_id as string;

  const { data: bookingType } = await admin
    .from("booking_types")
    .select(
      "id, duration_minutes, buffer_before_minutes, buffer_after_minutes, min_notice_hours, max_future_days, is_active",
    )
    .eq("id", bookingTypeId)
    .maybeSingle();
  if (!bookingType || !bookingType.is_active) {
    return badRequest("type de RDV introuvable", 404);
  }

  // Day of week in Europe/Paris (0 = Monday … 6 = Sunday) — matches DB convention
  const dayOfWeek = parisDayOfWeek(dateStr);

  // Min notice / max future
  const now = new Date();
  const minNoticeMs = (bookingType.min_notice_hours || 0) * 3600_000;
  const maxFutureMs = (bookingType.max_future_days || 60) * 86_400_000;
  const dayRefUtc = parisWallClockToUtc(dateStr, 0, 0);
  if (dayRefUtc.getTime() > now.getTime() + maxFutureMs) {
    return new Response(JSON.stringify({ slots: [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: weekly } = await admin
    .from("booking_availability_slots")
    .select("start_time, end_time, booking_type_id")
    .eq("user_id", hostUserId)
    .eq("is_active", true)
    .eq("day_of_week", dayOfWeek);

  const applicableWindows = (weekly || []).filter(
    (w: any) => !w.booking_type_id || w.booking_type_id === bookingTypeId,
  );
  if (applicableWindows.length === 0) {
    return new Response(JSON.stringify({ slots: [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Exceptions for that day
  const { data: exceptions } = await admin
    .from("booking_exceptions")
    .select("is_available, start_time, end_time")
    .eq("user_id", hostUserId)
    .eq("date", dateStr);

  const fullDayBlocked = (exceptions || []).some(
    (e: any) => e.is_available === false && !e.start_time && !e.end_time,
  );
  if (fullDayBlocked) {
    return new Response(JSON.stringify({ slots: [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Existing bookings that day (UTC range covering the full Paris day)
  const dayStartUtc = parisWallClockToUtc(dateStr, 0, 0).toISOString();
  const dayEndUtc = parisWallClockToUtc(dateStr, 23, 59).toISOString();
  const { data: existingBookings } = await admin
    .from("bookings")
    .select("start_time, end_time, status")
    .eq("host_user_id", hostUserId)
    .gte("start_time", dayStartUtc)
    .lte("start_time", dayEndUtc)
    .in("status", ["pending", "confirmed"]);

  const duration = bookingType.duration_minutes;
  const bufferBefore = bookingType.buffer_before_minutes || 0;
  const bufferAfter = bookingType.buffer_after_minutes || 0;
  const totalSlot = duration + bufferBefore + bufferAfter;

  const slots: { start: string; end: string }[] = [];

  for (const win of applicableWindows) {
    const [sh, sm] = win.start_time.split(":").map(Number);
    const [eh, em] = win.end_time.split(":").map(Number);
    // Interpret window times as Europe/Paris wall clock → real UTC instants
    const winStart = parisWallClockToUtc(dateStr, sh, sm);
    const winEnd = parisWallClockToUtc(dateStr, eh, em);

    let cursorMs = winStart.getTime();
    while (cursorMs + totalSlot * 60_000 <= winEnd.getTime()) {
      const slotStartMs = cursorMs + bufferBefore * 60_000;
      const slotEndMs = slotStartMs + duration * 60_000;

      if (slotStartMs < now.getTime() + minNoticeMs) {
        cursorMs += 15 * 60_000;
        continue;
      }

      const conflicts = (existingBookings || []).some((b: any) => {
        const bs = new Date(b.start_time).getTime();
        const be = new Date(b.end_time).getTime();
        return slotStartMs < be && slotEndMs > bs;
      });
      if (!conflicts) {
        slots.push({
          start: new Date(slotStartMs).toISOString(),
          end: new Date(slotEndMs).toISOString(),
        });
      }
      cursorMs += 15 * 60_000; // 15 min granularity
    }
  }

  return new Response(JSON.stringify({ slots }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Variant of get_slots that takes host_user_id directly (used by authenticated
// reschedule UI). Also supports exclude_booking_id to ignore the booking being
// reprogrammed when computing conflicts.
async function handleGetSlotsAuthenticated(body: any, req: Request) {
  // Require authenticated caller — this endpoint exposes per-user availability
  // and must not be reachable anonymously.
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return badRequest("Unauthorized", 401);
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) return badRequest("Unauthorized", 401);

  const hostUserId = body?.host_user_id;
  const bookingTypeId = body?.booking_type_id;
  const dateStr = body?.date;
  const excludeId = body?.exclude_booking_id;

  if (!isUuid(hostUserId)) return badRequest("host_user_id invalide");
  if (!isUuid(bookingTypeId)) return badRequest("booking_type_id invalide");
  if (typeof dateStr !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return badRequest("date invalide (attendu YYYY-MM-DD)");
  }

  const { data: bookingType } = await admin
    .from("booking_types")
    .select(
      "id, duration_minutes, buffer_before_minutes, buffer_after_minutes, min_notice_hours, max_future_days, is_active",
    )
    .eq("id", bookingTypeId)
    .maybeSingle();
  if (!bookingType || !bookingType.is_active) {
    return badRequest("type de RDV introuvable", 404);
  }

  const dayOfWeek = parisDayOfWeek(dateStr);
  const now = new Date();
  const minNoticeMs = (bookingType.min_notice_hours || 0) * 3600_000;

  const { data: weekly } = await admin
    .from("booking_availability_slots")
    .select("start_time, end_time, booking_type_id")
    .eq("user_id", hostUserId)
    .eq("is_active", true)
    .eq("day_of_week", dayOfWeek);

  const applicableWindows = (weekly || []).filter(
    (w: any) => !w.booking_type_id || w.booking_type_id === bookingTypeId,
  );
  if (applicableWindows.length === 0) {
    return new Response(JSON.stringify({ slots: [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: exceptions } = await admin
    .from("booking_exceptions")
    .select("is_available, start_time, end_time")
    .eq("user_id", hostUserId)
    .eq("date", dateStr);
  const fullDayBlocked = (exceptions || []).some(
    (e: any) => e.is_available === false && !e.start_time && !e.end_time,
  );
  if (fullDayBlocked) {
    return new Response(JSON.stringify({ slots: [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const dayStartUtc = parisWallClockToUtc(dateStr, 0, 0).toISOString();
  const dayEndUtc = parisWallClockToUtc(dateStr, 23, 59).toISOString();
  let bookingsQ = admin
    .from("bookings")
    .select("id, start_time, end_time, status")
    .eq("host_user_id", hostUserId)
    .gte("start_time", dayStartUtc)
    .lte("start_time", dayEndUtc)
    .in("status", ["pending", "confirmed"]);
  if (isUuid(excludeId)) bookingsQ = bookingsQ.neq("id", excludeId);
  const { data: existingBookings } = await bookingsQ;

  const duration = bookingType.duration_minutes;
  const bufferBefore = bookingType.buffer_before_minutes || 0;
  const bufferAfter = bookingType.buffer_after_minutes || 0;
  const totalSlot = duration + bufferBefore + bufferAfter;

  const slots: { start: string; end: string }[] = [];
  for (const win of applicableWindows) {
    const [sh, sm] = win.start_time.split(":").map(Number);
    const [eh, em] = win.end_time.split(":").map(Number);
    const winStart = parisWallClockToUtc(dateStr, sh, sm);
    const winEnd = parisWallClockToUtc(dateStr, eh, em);

    let cursorMs = winStart.getTime();
    while (cursorMs + totalSlot * 60_000 <= winEnd.getTime()) {
      const slotStartMs = cursorMs + bufferBefore * 60_000;
      const slotEndMs = slotStartMs + duration * 60_000;
      if (slotStartMs < now.getTime() + minNoticeMs) {
        cursorMs += 15 * 60_000;
        continue;
      }
      const conflicts = (existingBookings || []).some((b: any) => {
        const bs = new Date(b.start_time).getTime();
        const be = new Date(b.end_time).getTime();
        return slotStartMs < be && slotEndMs > bs;
      });
      if (!conflicts) {
        slots.push({
          start: new Date(slotStartMs).toISOString(),
          end: new Date(slotEndMs).toISOString(),
        });
      }
      cursorMs += 15 * 60_000;
    }
  }

  return new Response(JSON.stringify({ slots }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleCreateBooking(body: any, req: Request) {
  // Rate-limit anti-spam: 10 créations / 10 min par IP (best-effort, par isolat).
  const ip = extractClientIp(req);
  const rl = checkRateLimit(`public-booking-proxy:create:${ip}`, { limit: 10, windowSec: 600 });
  if (!rl.allowed) return rateLimitedResponse(rl.retryAfterSec ?? 60, corsHeaders);

  const slug = clean(body?.slug, 200);
  const bookingTypeId = body?.booking_type_id;
  const startTime = body?.start_time;
  const endTime = body?.end_time;
  const guestName = clean(body?.guest_name, 200);
  const guestEmail = clean(body?.guest_email, 254);
  const guestPhone = clean(body?.guest_phone, 50);
  const guestCompany = clean(body?.guest_company, 200);
  const guestNotes = clean(body?.guest_notes, 2000);
  const timezone = clean(body?.timezone, 100);

  if (!slug) return badRequest("slug requis");
  if (!isUuid(bookingTypeId)) return badRequest("booking_type_id invalide");
  if (!isIsoDate(startTime) || !isIsoDate(endTime)) return badRequest("start_time/end_time invalides");
  if (!guestName) return badRequest("guest_name requis");
  if (!isEmail(guestEmail)) return badRequest("guest_email invalide");

  const { data: page } = await admin
    .from("booking_pages")
    .select("id, user_id, require_phone, require_company")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (!page) return badRequest("page introuvable", 404);
  if (page.require_phone && !guestPhone) return badRequest("guest_phone requis");
  if (page.require_company && !guestCompany) return badRequest("guest_company requis");

  // Verify type belongs to page
  const { data: pageType } = await admin
    .from("booking_page_types")
    .select("id")
    .eq("booking_page_id", page.id)
    .eq("booking_type_id", bookingTypeId)
    .eq("is_visible", true)
    .maybeSingle();
  if (!pageType) return badRequest("type de RDV non disponible pour cette page", 400);

  // Final overlap check (defense in depth)
  const { data: overlap } = await admin
    .from("bookings")
    .select("id")
    .eq("host_user_id", page.user_id)
    .in("status", ["pending", "confirmed"])
    .lt("start_time", endTime)
    .gt("end_time", startTime)
    .limit(1);
  if (overlap && overlap.length > 0) {
    return badRequest("Ce créneau n'est plus disponible", 409);
  }

  // `ip` already computed above for rate-limit; reuse it for the insert.
  const ua = req.headers.get("user-agent");

  const { data: created, error: insertErr } = await admin
    .from("bookings")
    .insert([{
      booking_type_id: bookingTypeId,
      booking_page_id: page.id,
      host_user_id: page.user_id,
      guest_name: guestName,
      guest_email: guestEmail,
      guest_phone: guestPhone,
      guest_company: guestCompany,
      guest_notes: guestNotes,
      start_time: startTime,
      end_time: endTime,
      timezone: timezone,
      status: "pending",
      source: "booking_page",
      ip_address: ip,
      user_agent: ua,
    }])
    .select("id, start_time, end_time, status, confirmation_token")
    .single();

  if (insertErr) return badRequest(insertErr.message, 500);

  return new Response(JSON.stringify({ booking: created }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return badRequest("Méthode non supportée", 405);
  }
  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    switch (action) {
      case "get_page":
        return await handleGetPage(body);
      case "get_slots":
        return await handleGetSlots(body);
      case "get_slots_authenticated":
        return await handleGetSlotsAuthenticated(body, req);
      case "create_booking":
        return await handleCreateBooking(body, req);
      default:
        return badRequest("action inconnue");
    }
  } catch (e: any) {
    console.error("public-booking-proxy error:", e);
    return badRequest("Erreur interne", 500);
  }
});
