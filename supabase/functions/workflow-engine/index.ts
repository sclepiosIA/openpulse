// Edge Function: workflow-engine
// Exécute un workflow depuis un payload de déclencheur ou manuel.
// Supporte le mode dry-run, conditions composées (all/any), retry + branche d'erreur,
// versioning soft (snapshot du graphe), et actions étendues (set_variables, update_etablissement_statut, assign_user).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { sanitizeErrorForClient } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface Node {
  id: string;
  type: 'trigger' | 'condition' | 'action' | 'delay';
  data: any;
}
interface Edge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
}
interface Graph { nodes: Node[]; edges: Edge[] }

function getValueByPath(obj: any, path: string): any {
  return path.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}

function interpolate(str: string, ctx: Record<string, any>): string {
  if (typeof str !== 'string') return str;
  return str.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, p) => {
    const v = getValueByPath(ctx, p);
    return v == null ? '' : String(v);
  });
}

// ============ Conditions composées : { all: [...] } | { any: [...] } | leaf ============
function evalLeaf(rule: any, ctx: Record<string, any>): boolean {
  // Cherche left dans {trigger, ai, vars}
  const left = getValueByPath(ctx, rule.field) ?? getValueByPath({ trigger: ctx.trigger }, `trigger.${rule.field}`);
  const right = typeof rule.value === 'string' ? interpolate(rule.value, ctx) : rule.value;
  switch (rule.operator) {
    case 'equals': return String(left) === String(right);
    case 'not_equals': return String(left) !== String(right);
    case 'contains': return String(left ?? '').toLowerCase().includes(String(right ?? '').toLowerCase());
    case 'not_contains': return !String(left ?? '').toLowerCase().includes(String(right ?? '').toLowerCase());
    case 'greater_than': return Number(left) > Number(right);
    case 'less_than': return Number(left) < Number(right);
    case 'in': return Array.isArray(right) && right.map(String).includes(String(left));
    case 'is_empty': return left == null || left === '';
    case 'is_not_empty': return left != null && left !== '';
    default: return false;
  }
}

function evalCondition(cfg: any, ctx: Record<string, any>): boolean {
  if (!cfg) return false;
  if (Array.isArray(cfg.all)) return cfg.all.every((r: any) => evalCondition(r, ctx));
  if (Array.isArray(cfg.any)) return cfg.any.some((r: any) => evalCondition(r, ctx));
  return evalLeaf(cfg, ctx);
}

function nextNodes(graph: Graph, nodeId: string, branch?: string): string[] {
  return graph.edges
    .filter(e => e.source === nodeId && (!branch || !e.sourceHandle || e.sourceHandle === branch))
    .map(e => e.target);
}

function findRoot(graph: Graph): Node | null {
  return graph.nodes.find(n => n.type === 'trigger') ?? null;
}

async function executeAction(supabase: any, node: Node, ctx: Record<string, any>, createdBy: string | null, dryRun: boolean) {
  const action = node.data.action_type as string;
  const cfg = node.data.config || {};
  const interpolated: Record<string, any> = {};
  for (const k of Object.keys(cfg)) {
    interpolated[k] = typeof cfg[k] === 'string' ? interpolate(cfg[k], ctx) : cfg[k];
  }

  // ============ MODE DRY-RUN ============
  if (dryRun) {
    switch (action) {
      case 'create_task':
        return { simulated: true, would_create_task: { titre: interpolated.titre, priorite: interpolated.priorite, etablissement_id: ctx.trigger?.etablissement_id } };
      case 'send_notification':
        return { simulated: true, would_notify: { user_id: interpolated.user_id, message: interpolated.message } };
      case 'send_email':
        return { simulated: true, would_send_email: { to: interpolated.to, subject: interpolated.subject } };
      case 'create_ticket':
        return { simulated: true, would_create_ticket: { sujet: interpolated.sujet, priorite: interpolated.priorite } };
      case 'update_field':
        return { simulated: true, would_update: { table: interpolated.table, record_id: interpolated.record_id, field: interpolated.field, value: interpolated.value } };
      case 'webhook':
      case 'http_request':
        return { simulated: true, would_call: { url: interpolated.url, method: interpolated.method || 'POST' } };
      case 'ai_write_email':
      case 'ai_summarize':
      case 'ai_classify':
      case 'ai_route':
      case 'ai_extract': {
        const outputKey = interpolated.ai_output_key || `${action}_${node.id}`;
        ctx.ai = ctx.ai || {};
        (ctx.ai as Record<string, unknown>)[outputKey] = '[DRY RUN] Sortie IA simulée';
        return { simulated: true, ai_action: action, output_key: outputKey };
      }
      case 'wait':
        return { simulated: true, would_wait: interpolated };
      case 'set_variables': {
        ctx.vars = ctx.vars || {};
        Object.assign(ctx.vars as object, interpolated.variables || {});
        return { simulated: true, would_set: interpolated.variables || {} };
      }
      case 'update_etablissement_statut':
        return { simulated: true, would_update_statut: { etablissement_id: interpolated.etablissement_id || ctx.trigger?.etablissement_id, statut: interpolated.statut } };
      case 'assign_user':
        return { simulated: true, would_assign: { table: interpolated.table, record_id: interpolated.record_id, user_id: interpolated.user_id } };
      case 'for_each':
        return { simulated: true, would_iterate: { items_path: interpolated.items_path, max: 100 } };
      case 'wait_until':
        return { simulated: true, would_wait_until: interpolated.until || interpolated.until_path };
      case 'create_event':
        return { simulated: true, would_create_event: { title: interpolated.title, start_time: interpolated.start_time } };
      case 'create_devis':
        return { simulated: true, would_create_devis: { etablissement_id: interpolated.etablissement_id || ctx.trigger?.etablissement_id, montant_ht: interpolated.montant_ht } };
      case 'start_email_sequence':
        return { simulated: true, would_enroll: { sequence_id: interpolated.sequence_id, contact_email: interpolated.contact_email } };
      case 'pulse_notify':
        return { simulated: true, would_pulse: { conversation_id: interpolated.conversation_id, recipient_user_id: interpolated.recipient_user_id, content: interpolated.content } };
      case 'update_csm_playbook':
        return { simulated: true, would_advance_playbook: { playbook_id: interpolated.playbook_id, step_order: interpolated.step_order } };
      case 'add_to_segment':
        return { simulated: true, would_tag: { etablissement_id: interpolated.etablissement_id || ctx.trigger?.etablissement_id, segment: interpolated.segment } };
      default:
        return { simulated: true, action };
    }
  }

  // ============ MODE RÉEL ============
  switch (action) {
    case 'create_task': {
      const echeance = interpolated.echeance_offset_days
        ? new Date(Date.now() + Number(interpolated.echeance_offset_days) * 86400000).toISOString().split('T')[0]
        : null;
      const { data, error } = await supabase.from('taches').insert({
        titre: interpolated.titre || 'Tâche workflow',
        description: interpolated.description || null,
        priorite: interpolated.priorite || 'medium',
        responsable_id: interpolated.responsable_id || createdBy,
        etablissement_id: ctx.trigger?.etablissement_id || null,
        echeance,
        statut: 'pending',
      }).select().single();
      if (error) throw error;
      return { task_id: data.id };
    }
    case 'send_notification': {
      const { error } = await supabase.from('notifications').insert({
        user_id: interpolated.user_id || createdBy,
        message: interpolated.message || 'Notification workflow',
        type: 'workflow',
        is_read: false,
      });
      if (error) throw error;
      return { delivered: true };
    }
    case 'send_email': {
      const { data, error } = await supabase.functions.invoke('send-email-reply', {
        body: {
          to: interpolated.to,
          subject: interpolated.subject,
          body: interpolated.body || '',
          template_id: interpolated.template_id || null,
        },
      });
      if (error) throw error;
      return { sent: true, response: data };
    }
    case 'create_ticket': {
      const { data, error } = await supabase.from('support_tickets').insert({
        sujet: interpolated.sujet || 'Ticket workflow',
        priorite: interpolated.priorite || 'medium',
        etablissement_id: ctx.trigger?.etablissement_id || null,
        statut: 'open',
        created_by: createdBy,
      }).select().single();
      if (error) throw error;
      return { ticket_id: data.id };
    }
    case 'update_field': {
      if (!interpolated.table || !interpolated.record_id || !interpolated.field) {
        throw new Error('update_field: table, record_id et field requis');
      }
      const { error } = await supabase
        .from(interpolated.table)
        .update({ [interpolated.field]: interpolated.value })
        .eq('id', interpolated.record_id);
      if (error) throw error;
      return { updated: true };
    }
    case 'webhook':
    case 'http_request': {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 15000);
      try {
        const res = await fetch(interpolated.url, {
          method: interpolated.method || 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(interpolated.payload || ctx.trigger || {}),
          signal: controller.signal,
        });
        clearTimeout(tid);
        if (!res.ok) throw new Error(`Webhook HTTP ${res.status}`);
        return { status: res.status };
      } catch (e: any) {
        clearTimeout(tid);
        if (e.name === 'AbortError') throw new Error('Webhook timeout (15s)');
        throw e;
      }
    }
    case 'ai_write_email':
    case 'ai_summarize':
    case 'ai_classify':
    case 'ai_route':
    case 'ai_extract': {
      const { data: aiResp, error: aiErr } = await supabase.functions.invoke('workflow-ai-action', {
        body: { action_type: action, config: interpolated, context: ctx },
      });
      if (aiErr) throw aiErr;
      if (!aiResp?.success) throw new Error(aiResp?.error || 'workflow-ai-action a échoué');

      const aiOutput = aiResp.output || {};
      const outputKey = interpolated.ai_output_key || `${action}_${node.id}`;
      ctx.ai = ctx.ai || {};
      (ctx.ai as Record<string, unknown>)[outputKey] = aiOutput;

      if (action === 'ai_write_email' && interpolated.ai_send_to) {
        const subject = (aiOutput as any).subject || interpolated.ai_subject_hint || 'Message';
        const body = (aiOutput as any).body_html || (aiOutput as any).raw || '';
        const { error: sendErr } = await supabase.functions.invoke('send-email-reply', {
          body: { to: interpolated.ai_send_to, subject, body },
        });
        if (sendErr) throw sendErr;
        return { ai: aiOutput, sent_to: interpolated.ai_send_to };
      }

      // ai_route : retourne un branch_key utilisé par le moteur pour router
      if (action === 'ai_route' && (aiOutput as any).branch) {
        return { ai: aiOutput, branch: (aiOutput as any).branch, output_key: outputKey };
      }

      return { ai: aiOutput, output_key: outputKey };
    }

    // ============ NOUVELLES ACTIONS LOT 1 ============
    case 'set_variables': {
      ctx.vars = ctx.vars || {};
      const vars = interpolated.variables || {};
      for (const [k, v] of Object.entries(vars)) {
        (ctx.vars as Record<string, unknown>)[k] = typeof v === 'string' ? interpolate(v, ctx) : v;
      }
      return { vars: ctx.vars };
    }
    case 'update_etablissement_statut': {
      const etabId = interpolated.etablissement_id || ctx.trigger?.etablissement_id;
      if (!etabId) throw new Error('update_etablissement_statut: etablissement_id requis');
      if (!interpolated.statut) throw new Error('update_etablissement_statut: statut requis');
      const { error } = await supabase
        .from('etablissements')
        .update({ statut: interpolated.statut })
        .eq('id', etabId);
      if (error) throw error;
      return { etablissement_id: etabId, statut: interpolated.statut };
    }
    case 'assign_user': {
      if (!interpolated.table || !interpolated.record_id || !interpolated.user_id) {
        throw new Error('assign_user: table, record_id et user_id requis');
      }
      const field = interpolated.field || 'responsable_id';
      const { error } = await supabase
        .from(interpolated.table)
        .update({ [field]: interpolated.user_id })
        .eq('id', interpolated.record_id);
      if (error) throw error;
      return { assigned: true, table: interpolated.table, user_id: interpolated.user_id };
    }

    // ============ NOUVELLES ACTIONS LOT 2 ============
    case 'for_each': {
      const itemsPath = interpolated.items_path || 'trigger.items';
      const items = getValueByPath(ctx, itemsPath);
      if (!Array.isArray(items)) throw new Error(`for_each: ${itemsPath} n'est pas un tableau`);
      const capped = items.slice(0, 100);
      return { _foreach: true, items: capped, total: items.length, capped: items.length > 100 };
    }
    case 'wait_until': {
      const target = interpolated.until || (interpolated.until_path ? getValueByPath(ctx, interpolated.until_path) : null);
      if (!target) throw new Error('wait_until: until ou until_path requis');
      const targetDate = new Date(target);
      if (isNaN(targetDate.getTime())) throw new Error('wait_until: date invalide');
      const maxFuture = Date.now() + 30 * 86400000;
      if (targetDate.getTime() > maxFuture) throw new Error('wait_until: 30 jours maximum');
      return { _schedule_at: targetDate.toISOString() };
    }
    case 'create_event': {
      // Choisir un calendrier par défaut de l'utilisateur créateur
      const { data: cal } = await supabase
        .from('calendars').select('id').eq('owner_id', createdBy).eq('is_default', true).limit(1).maybeSingle();
      const calendarId = interpolated.calendar_id || cal?.id;
      if (!calendarId) throw new Error('create_event: calendar_id ou calendrier par défaut requis');
      const { data, error } = await supabase.from('calendar_events').insert({
        calendar_id: calendarId,
        title: interpolated.title || 'Événement workflow',
        description: interpolated.description || null,
        location: interpolated.location || null,
        start_time: interpolated.start_time,
        end_time: interpolated.end_time,
        all_day: !!interpolated.all_day,
        etablissement_id: interpolated.etablissement_id || ctx.trigger?.etablissement_id || null,
        created_by: createdBy,
        status: 'confirmed',
        availability: 'busy',
        visibility: 'default',
      }).select().single();
      if (error) throw error;
      return { event_id: data.id };
    }
    case 'create_devis': {
      const etabId = interpolated.etablissement_id || ctx.trigger?.etablissement_id;
      if (!etabId) throw new Error('create_devis: etablissement_id requis');
      const numero = `DEV-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
      const montantHt = Number(interpolated.montant_ht || 0);
      const tvaTaux = Number(interpolated.tva_taux ?? 20);
      const montantTva = montantHt * tvaTaux / 100;
      const { data, error } = await supabase.from('devis').insert({
        numero,
        etablissement_id: etabId,
        client_nom: interpolated.client_nom || 'Client',
        date_emission: new Date().toISOString().split('T')[0],
        date_validite: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        statut: 'brouillon',
        montant_ht: montantHt,
        montant_tva: montantTva,
        montant_ttc: montantHt + montantTva,
        notes_client: interpolated.notes || null,
        created_by: createdBy,
      }).select().single();
      if (error) throw error;
      return { devis_id: data.id, numero };
    }
    case 'start_email_sequence': {
      if (!interpolated.sequence_id) throw new Error('start_email_sequence: sequence_id requis');
      if (!interpolated.contact_email) throw new Error('start_email_sequence: contact_email requis');
      const { data, error } = await supabase.from('email_sequence_enrollments').insert({
        sequence_id: interpolated.sequence_id,
        etablissement_id: interpolated.etablissement_id || ctx.trigger?.etablissement_id || null,
        contact_email: interpolated.contact_email,
        contact_name: interpolated.contact_name || null,
        etape_courante: 0,
        statut: 'active',
      }).select().single();
      if (error) throw error;
      return { enrollment_id: data.id };
    }
    case 'pulse_notify': {
      if (!interpolated.conversation_id && !interpolated.recipient_user_id) {
        throw new Error('pulse_notify: conversation_id ou recipient_user_id requis');
      }
      let convId = interpolated.conversation_id;
      // Si DM 1:1 demandé sans conv, on tente de retrouver/créer une conv
      if (!convId && interpolated.recipient_user_id && createdBy) {
        const { data: existing } = await supabase
          .from('pulse_conversations')
          .select('id')
          .eq('type', 'direct')
          .contains('participant_ids', [createdBy, interpolated.recipient_user_id])
          .limit(1).maybeSingle();
        if (existing?.id) {
          convId = existing.id;
        } else {
          const { data: created, error: cErr } = await supabase
            .from('pulse_conversations').insert({
              type: 'direct',
              participant_ids: [createdBy, interpolated.recipient_user_id],
              created_by: createdBy,
            }).select().single();
          if (cErr) throw cErr;
          convId = created.id;
        }
      }
      const { error } = await supabase.from('pulse_messages').insert({
        conversation_id: convId,
        sender_id: createdBy,
        content: interpolated.content || 'Notification workflow',
        message_type: 'text',
      });
      if (error) throw error;
      return { delivered: true, conversation_id: convId };
    }
    case 'update_csm_playbook': {
      if (!interpolated.playbook_id) throw new Error('update_csm_playbook: playbook_id requis');
      const { data: steps, error: sErr } = await supabase
        .from('csm_playbook_steps').select('id, step_order')
        .eq('playbook_id', interpolated.playbook_id).order('step_order', { ascending: true });
      if (sErr) throw sErr;
      const target = interpolated.step_order != null
        ? steps?.find((s: any) => s.step_order === Number(interpolated.step_order))
        : steps?.[0];
      if (!target) throw new Error('update_csm_playbook: étape introuvable');
      return { playbook_id: interpolated.playbook_id, advanced_to_step: target.step_order };
    }
    case 'add_to_segment': {
      const etabId = interpolated.etablissement_id || ctx.trigger?.etablissement_id;
      if (!etabId) throw new Error('add_to_segment: etablissement_id requis');
      if (!interpolated.segment) throw new Error('add_to_segment: segment requis');
      const { data: etab, error: eErr } = await supabase
        .from('etablissements').select('tags').eq('id', etabId).single();
      if (eErr) throw eErr;
      const existing: string[] = Array.isArray(etab?.tags) ? etab.tags : [];
      const next = Array.from(new Set([...existing, String(interpolated.segment)]));
      const { error } = await supabase
        .from('etablissements').update({ tags: next }).eq('id', etabId);
      if (error) throw error;
      return { etablissement_id: etabId, tags: next };
    }
    default:
      throw new Error(`Action inconnue: ${action}`);
  }
}

// Helper: exécute une action avec retry + backoff
async function executeActionWithRetry(supabase: any, node: Node, ctx: Record<string, any>, createdBy: string | null, dryRun: boolean) {
  const retry = (node.data?.retry || {}) as { max?: number; backoff_ms?: number };
  const maxAttempts = Math.max(1, Math.min(5, Number(retry.max ?? 1)));
  const backoff = Math.max(0, Math.min(30000, Number(retry.backoff_ms ?? 1000)));

  let lastErr: any;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const out = await executeAction(supabase, node, ctx, createdBy, dryRun);
      return { output: out, attempts: attempt };
    } catch (e) {
      lastErr = e;
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, backoff * attempt));
      }
    }
  }
  throw lastErr;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // ===== Auth guard =====
    const internalSecret = Deno.env.get('INTERNAL_FUNCTION_SECRET');
    const providedSecret = req.headers.get('x-function-secret');
    const authHeader = req.headers.get('authorization') || '';
    const isInternal = !!internalSecret && providedSecret === internalSecret;
    const isServiceRole = !!SERVICE_ROLE && authHeader === `Bearer ${SERVICE_ROLE}`;
    let isAuthedUser = false;
    if (!isInternal && !isServiceRole && authHeader.startsWith('Bearer ')) {
      try {
        const authClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
          global: { headers: { Authorization: authHeader } },
        });
        const token = authHeader.replace('Bearer ', '');
        const { data, error } = await authClient.auth.getClaims(token);
        isAuthedUser = !error && !!data?.claims?.sub;
      } catch (_) { /* ignore */ }
    }
    if (!isInternal && !isServiceRole && !isAuthedUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { workflow_id, trigger_payload, parent_run_id, resume_from_node, dry_run } = body;
    const isDryRun = !!dry_run;
    if (!workflow_id) throw new Error('workflow_id requis');

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);


    const { data: wf, error: wfErr } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', workflow_id)
      .single();
    if (wfErr) throw wfErr;
    if (!wf.is_active && !body.manual && !isDryRun) {
      return new Response(JSON.stringify({ skipped: true, reason: 'inactive' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ============ Snapshot du graphe ============
    let graph: Graph;
    let graphVersion: number = wf.graph_version || 1;
    if (resume_from_node && body.run_id) {
      const { data: existingRun } = await supabase
        .from('workflow_runs').select('graph_snapshot, graph_version').eq('id', body.run_id).single();
      graph = (existingRun?.graph_snapshot as Graph) || (wf.graph as Graph);
      graphVersion = existingRun?.graph_version || graphVersion;
    } else {
      graph = wf.graph as Graph;
    }

    if (!graph?.nodes?.length) throw new Error('Graphe vide');
    if (graph.nodes.length > 50) throw new Error('Limite 50 nœuds dépassée');

    // Anti-boucle (sauf en dry-run)
    if (!isDryRun && parent_run_id) {
      const { data: parent } = await supabase
        .from('workflow_runs').select('workflow_id').eq('id', parent_run_id).single();
      if (parent?.workflow_id === workflow_id) {
        throw new Error('Anti-boucle: workflow auto-déclenché');
      }
    }

    // Quota 1000 runs/jour (hors dry-run)
    if (!isDryRun) {
      const today = new Date().toISOString().split('T')[0];
      const { count } = await supabase
        .from('workflow_runs')
        .select('*', { count: 'exact', head: true })
        .gte('started_at', `${today}T00:00:00Z`)
        .eq('is_dry_run', false);
      if ((count || 0) > 1000) throw new Error('Quota journalier (1000 runs) atteint');
    }

    let runId: string;
    let stepsLog: any[] = [];
    if (resume_from_node) {
      runId = body.run_id;
      const { data: existing } = await supabase.from('workflow_runs').select('steps_log').eq('id', runId).single();
      stepsLog = (existing?.steps_log as any[]) || [];
    } else {
      const { data: run, error: runErr } = await supabase
        .from('workflow_runs')
        .insert({
          workflow_id,
          parent_run_id: parent_run_id || null,
          trigger_payload: trigger_payload || {},
          status: 'running',
          is_dry_run: isDryRun,
          graph_snapshot: graph,
          graph_version: graphVersion,
        })
        .select()
        .single();
      if (runErr) throw runErr;
      runId = run.id;
    }

    const ctx: Record<string, any> = {
      trigger: trigger_payload || {},
      workflow: { id: workflow_id, nom: wf.nom },
      vars: {},
      ai: {},
    };

    const startNode = resume_from_node
      ? graph.nodes.find(n => n.id === resume_from_node)
      : findRoot(graph);
    if (!startNode) throw new Error('Nœud de départ introuvable');

    const queue: Array<{ nodeId: string; branch?: string }> = [];
    if (resume_from_node) {
      queue.push(...nextNodes(graph, resume_from_node).map(id => ({ nodeId: id })));
    } else {
      queue.push(...nextNodes(graph, startNode.id).map(id => ({ nodeId: id })));
      stepsLog.push({
        node_id: startNode.id, node_type: 'trigger', status: 'success',
        started_at: new Date().toISOString(), finished_at: new Date().toISOString(),
        output: trigger_payload,
      });
    }

    let scheduled = false;
    let pausedRequested = false;
    const visited = new Set<string>();

    while (queue.length > 0) {
      // Vérification de pause manuelle (rafraîchissement léger toutes les N étapes)
      if (!isDryRun && stepsLog.length % 5 === 0) {
        const { data: cur } = await supabase
          .from('workflow_runs').select('status').eq('id', runId).single();
        if (cur?.status === 'paused') {
          pausedRequested = true;
          break;
        }
      }

      const { nodeId } = queue.shift()!;
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      const node = graph.nodes.find(n => n.id === nodeId);
      if (!node) continue;
      const stepStart = new Date().toISOString();

      try {
        if (node.type === 'condition') {
          const result = evalCondition(node.data.config, ctx);
          stepsLog.push({
            node_id: nodeId, node_type: 'condition', status: 'success',
            started_at: stepStart, finished_at: new Date().toISOString(),
            output: { result, branch: result ? 'true' : 'false' },
          });
          queue.push(...nextNodes(graph, nodeId, result ? 'true' : 'false').map(id => ({ nodeId: id })));
        } else if (node.type === 'delay') {
          const cfg = node.data.config || {};
          if (isDryRun) {
            stepsLog.push({
              node_id: nodeId, node_type: 'delay', status: 'simulated',
              started_at: stepStart, finished_at: new Date().toISOString(),
              output: { would_wait: { amount: cfg.amount, unit: cfg.unit } },
            });
            queue.push(...nextNodes(graph, nodeId).map(id => ({ nodeId: id })));
          } else {
            const ms = (cfg.amount || 0) * (cfg.unit === 'days' ? 86400000 : cfg.unit === 'hours' ? 3600000 : 60000);
            const executeAt = new Date(Date.now() + ms).toISOString();
            await supabase.from('workflow_scheduled_steps').insert({
              run_id: runId, workflow_id, node_id: nodeId,
              execute_at: executeAt, context: ctx,
            });
            stepsLog.push({
              node_id: nodeId, node_type: 'delay', status: 'scheduled',
              started_at: stepStart, output: { execute_at: executeAt },
            });
            scheduled = true;
            break;
          }
        } else if (node.type === 'action') {
          const { output, attempts } = await executeActionWithRetry(supabase, node, ctx, wf.created_by, isDryRun);

          // for_each : fan-out — exécute la branche enfant pour chaque item (max 100)
          if ((output as any)?._foreach) {
            const items = (output as any).items as any[];
            stepsLog.push({
              node_id: nodeId, node_type: 'action', status: isDryRun ? 'simulated' : 'success',
              started_at: stepStart, finished_at: new Date().toISOString(),
              output: { iterations: items.length, capped: (output as any).capped, _attempts: attempts },
            });
            const childTargets = nextNodes(graph, nodeId);
            for (let i = 0; i < items.length; i++) {
              ctx.item = items[i];
              ctx.item_index = i;
              for (const targetId of childTargets) {
                const virtId = `${targetId}#${nodeId}#${i}`;
                if (!visited.has(virtId)) {
                  visited.add(virtId);
                  queue.push({ nodeId: targetId });
                }
              }
            }
            continue;
          }

          // wait_until : planifie l'étape et stoppe la boucle
          if ((output as any)?._schedule_at) {
            const executeAt = (output as any)._schedule_at as string;
            if (!isDryRun) {
              await supabase.from('workflow_scheduled_steps').insert({
                run_id: runId, workflow_id, node_id: nodeId,
                execute_at: executeAt, context: ctx,
              });
            }
            stepsLog.push({
              node_id: nodeId, node_type: 'action', status: isDryRun ? 'simulated' : 'scheduled',
              started_at: stepStart, finished_at: new Date().toISOString(),
              output: { execute_at: executeAt, _attempts: attempts },
            });
            scheduled = true;
            break;
          }

          stepsLog.push({
            node_id: nodeId, node_type: 'action', status: isDryRun ? 'simulated' : 'success',
            started_at: stepStart, finished_at: new Date().toISOString(),
            output: { ...(output as object), _attempts: attempts },
          });
          // Routing IA : suit la branche dynamique si le nœud est ai_route
          const branch = (output as any)?.branch as string | undefined;
          queue.push(...nextNodes(graph, nodeId, branch).map(id => ({ nodeId: id })));
        }
      } catch (stepErr: any) {
        const errMsg = sanitizeErrorForClient(stepErr);
        stepsLog.push({
          node_id: nodeId, node_type: node.type, status: 'failed',
          started_at: stepStart, finished_at: new Date().toISOString(),
          error: errMsg,
        });
        // Branche d'erreur (sourceHandle === 'error') : si présente, on l'emprunte au lieu de continuer
        const errorTargets = nextNodes(graph, nodeId, 'error');
        if (errorTargets.length > 0) {
          queue.push(...errorTargets.map(id => ({ nodeId: id })));
        }
      }
    }

    const finalStatus = pausedRequested
      ? 'paused'
      : scheduled
        ? 'running'
        : (stepsLog.some(s => s.status === 'failed' && !nextNodes(graph, s.node_id, 'error').length) ? 'failed' : 'success');
    const finishedAt = (scheduled || pausedRequested) ? null : new Date().toISOString();

    await supabase.from('workflow_runs').update({
      status: finalStatus,
      steps_log: stepsLog,
      finished_at: finishedAt,
      duration_ms: finishedAt ? Date.now() - new Date(stepsLog[0]?.started_at || Date.now()).getTime() : null,
    }).eq('id', runId);

    // Stats workflow uniquement pour les vrais runs terminés
    if (!isDryRun && !scheduled && !pausedRequested) {
      const newStats = {
        runs: (wf.stats?.runs || 0) + (resume_from_node ? 0 : 1),
        success: (wf.stats?.success || 0) + (finalStatus === 'success' ? 1 : 0),
        failed: (wf.stats?.failed || 0) + (finalStatus === 'failed' ? 1 : 0),
      };
      await supabase.from('workflows').update({ stats: newStats, last_run_at: new Date().toISOString() }).eq('id', workflow_id);
    }

    return new Response(JSON.stringify({
      run_id: runId,
      status: finalStatus,
      steps: stepsLog.length,
      steps_log: stepsLog,
      is_dry_run: isDryRun,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[workflow-engine]', err);
    return new Response(JSON.stringify({ error: sanitizeErrorForClient(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
