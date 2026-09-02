// CSM Playbook Engine — exécute les étapes en attente toutes les 10 min
// Déclenché par pg_cron, pas d'auth utilisateur (verify_jwt = false)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface Step {
  id: string;
  step_order: number;
  step_type: string;
  config: Record<string, unknown>;
  delay_days: number;
}

interface Execution {
  id: string;
  playbook_id: string;
  etablissement_id: string;
  current_step_order: number;
  trigger_context: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Restrict to internal CRON callers via shared secret or service-role bearer
  const internalSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET");
  const providedSecret = req.headers.get("x-function-secret");
  const auth = req.headers.get("authorization") ?? "";
  const isServiceRole = auth === `Bearer ${SERVICE_ROLE}`;
  if (!isServiceRole && (!internalSecret || providedSecret !== internalSecret)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const startedAt = Date.now();
  const summary = { picked: 0, advanced: 0, completed: 0, failed: 0, errors: [] as string[] };

  try {
    // 1) Récupère les exécutions dont la prochaine action est due
    const { data: dueExecs, error: dueErr } = await supabase
      .from("csm_playbook_executions")
      .select("id, playbook_id, etablissement_id, current_step_order, trigger_context")
      .in("status", ["pending", "running"])
      .lte("next_action_at", new Date().toISOString())
      .order("next_action_at", { ascending: true })
      .limit(50);

    if (dueErr) throw dueErr;

    summary.picked = dueExecs?.length ?? 0;

    for (const exec of (dueExecs ?? []) as Execution[]) {
      try {
        // Récupère l'étape courante
        const { data: step, error: stepErr } = await supabase
          .from("csm_playbook_steps")
          .select("id, step_order, step_type, config, delay_days")
          .eq("playbook_id", exec.playbook_id)
          .eq("step_order", exec.current_step_order)
          .maybeSingle();

        if (stepErr) throw stepErr;
        if (!step) {
          // Plus d'étape : exécution terminée
          await supabase
            .from("csm_playbook_executions")
            .update({ status: "completed", completed_at: new Date().toISOString(), next_action_at: null })
            .eq("id", exec.id);
          summary.completed += 1;
          continue;
        }

        // Marque l'exécution en running
        await supabase
          .from("csm_playbook_executions")
          .update({ status: "running" })
          .eq("id", exec.id);

        // Exécute l'étape
        const result = await executeStep(supabase, exec, step as Step);

        // Log
        await supabase.from("csm_playbook_step_logs").insert({
          execution_id: exec.id,
          step_id: step.id,
          step_order: step.step_order,
          step_type: step.step_type,
          status: result.ok ? "success" : "error",
          result: result.data ?? {},
          error_message: result.error ?? null,
        });

        if (!result.ok) {
          await supabase
            .from("csm_playbook_executions")
            .update({ status: "failed", last_error: result.error, next_action_at: null })
            .eq("id", exec.id);
          summary.failed += 1;
          continue;
        }

        // Avance vers l'étape suivante
        const { data: nextStep } = await supabase
          .from("csm_playbook_steps")
          .select("step_order, delay_days")
          .eq("playbook_id", exec.playbook_id)
          .gt("step_order", step.step_order)
          .order("step_order", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (!nextStep) {
          await supabase
            .from("csm_playbook_executions")
            .update({ status: "completed", completed_at: new Date().toISOString(), next_action_at: null })
            .eq("id", exec.id);
          summary.completed += 1;
        } else {
          const nextAt = new Date(Date.now() + (nextStep.delay_days || 0) * 86400000).toISOString();
          await supabase
            .from("csm_playbook_executions")
            .update({
              current_step_order: nextStep.step_order,
              status: "pending",
              next_action_at: nextAt,
            })
            .eq("id", exec.id);
          summary.advanced += 1;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        summary.errors.push(`exec ${exec.id}: ${msg}`);
        await supabase
          .from("csm_playbook_executions")
          .update({ status: "failed", last_error: msg, next_action_at: null })
          .eq("id", exec.id);
        summary.failed += 1;
      }
    }

    return new Response(
      JSON.stringify({ success: true, duration_ms: Date.now() - startedAt, ...summary }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    return buildErrorResponse('csm-playbook-engine', err, corsHeaders, 500);
  }
});

async function executeStep(
  supabase: ReturnType<typeof createClient>,
  exec: Execution,
  step: Step,
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const cfg = step.config ?? {};
  try {
    switch (step.step_type) {
      case "create_task": {
        const { data, error } = await supabase
          .from("taches")
          .insert({
            titre: String(cfg.titre ?? "Action playbook CSM"),
            description: String(cfg.description ?? ""),
            etablissement_id: exec.etablissement_id,
            statut: "a_faire",
            priorite: String(cfg.priorite ?? "moyenne"),
            type: "playbook_csm",
            metadata: { playbook_execution_id: exec.id, step_order: step.step_order },
          })
          .select("id")
          .single();
        if (error) throw error;
        return { ok: true, data: { task_id: data.id } };
      }
      case "create_alert": {
        const { data, error } = await supabase
          .from("csm_alertes")
          .insert({
            etablissement_id: exec.etablissement_id,
            type: "playbook",
            severite: String(cfg.severity ?? "moyenne"),
            message: String(cfg.message ?? "Alerte déclenchée par playbook"),
            metadata: { playbook_execution_id: exec.id, step_order: step.step_order },
          })
          .select("id")
          .maybeSingle();
        // csm_alertes peut ne pas exister : on ne fail pas durement
        if (error && !error.message.includes("does not exist")) throw error;
        return { ok: true, data: { alert_id: data?.id ?? null } };
      }
      case "send_email": {
        // Délègue à send-transactional-email si template fourni
        const tmpl = cfg.template_name as string | undefined;
        const to = cfg.to as string | undefined;
        if (!tmpl || !to) return { ok: false, error: "send_email: template_name et to requis" };
        const { error } = await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: tmpl,
            recipientEmail: to,
            idempotencyKey: `playbook-${exec.id}-${step.step_order}`,
            templateData: cfg.template_data ?? {},
          },
        });
        if (error) throw error;
        return { ok: true, data: { sent_to: to } };
      }
      case "wait_days": {
        // No-op : le délai a déjà été appliqué via next_action_at
        return { ok: true, data: { waited_days: cfg.days ?? step.delay_days } };
      }
      case "assign_csm": {
        const userId = cfg.user_id as string | undefined;
        if (!userId) return { ok: false, error: "assign_csm: user_id requis" };
        const { error } = await supabase
          .from("etablissements")
          .update({ commercial_id: userId })
          .eq("id", exec.etablissement_id);
        if (error) throw error;
        return { ok: true, data: { assigned_to: userId } };
      }
      case "update_health_note": {
        const note = String(cfg.note ?? "");
        const { error } = await supabase
          .from("customer_health_metrics")
          .update({ notes: note })
          .eq("etablissement_id", exec.etablissement_id);
        if (error) throw error;
        return { ok: true, data: { note_updated: true } };
      }
      default:
        return { ok: false, error: `Type d'étape inconnu: ${step.step_type}` };
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
