/**
 * Centralized Deno dependencies for Edge Functions.
 *
 * Action 180.6 (audit Fable 5 · 2026-07-06). Objective: bump versions
 * globally in one PR instead of touching 367 files.
 *
 * Migration path:
 *   1. New functions import from this file exclusively.
 *   2. Existing functions are migrated batch by batch (one domain at a time).
 *   3. Once all functions use these re-exports, `edge-deno-deps-audit.mjs`
 *      should report 0 fragmented packages.
 *
 * DO NOT add version drift here. If a function requires a different version,
 * it means a compat issue must be surfaced and resolved, not hidden.
 */

// Standard library — LTS-ish for Deno Deploy runtime.
export { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// Supabase JS client — align on 2.58.0 (latest tested with our RPCs).
export { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
