/**
 * JARVIS Core Tools - Database, Memory, Context operations
 * Extracted from tools-executor.ts for modularity
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { ALLOWED_TABLES } from "../tool-registry.ts";

// ============================================================
// Column alias mapping - fixes Jarvis guessing wrong column names
// ============================================================
const COLUMN_ALIASES: Record<string, Record<string, string>> = {
  taches: {
    date_echeance: 'echeance',
    assignee_id: 'responsable_id',
    assignee: 'responsable_id',
    assigned_to: 'responsable_id',
  },
  email_messages: {
    to_email: 'to_addresses',
    to_emails: 'to_addresses',
    to: 'to_addresses',
    from_email: 'from_address',
    from: 'from_address',
    extrait: 'body_text',
    snippet: 'body_text',
    status: 'is_draft',
    date: 'received_date',
    created_at: 'received_date',
  },
  email_threads: {
    titre: 'subject',
    title: 'subject',
    last_updated_at: 'updated_at',
  },
  calendar_events: {
    video_link: 'video_conference_url',
    attendees: '_unsupported_',
    organizer_email: '_unsupported_',
  },
};

/**
 * Resolve a column name using aliases for a given table.
 * Returns null if the column is explicitly unsupported.
 */
function resolveColumn(table: string, column: string): string | null {
  const aliases = COLUMN_ALIASES[table];
  if (!aliases) return column;
  const resolved = aliases[column];
  if (resolved === '_unsupported_') return null;
  return resolved || column;
}

export interface ToolExecutionContext {
  supabase: SupabaseClient;
  adminClient?: SupabaseClient;
  userId: string;
  authUserId?: string;
  conversationId?: string;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  execution_time_ms: number;
}

// ============================================================
// TOOL: query_database (Extended to 50+ tables)
// ============================================================
export async function executeQueryDatabase(
  ctx: ToolExecutionContext,
  args: {
    table: string;
    select?: string;
    filters?: Array<{ column: string; operator: string; value: string }>;
    order_by?: string;
    ascending?: boolean;
    limit?: number;
  }
): Promise<ToolResult> {
  const start = Date.now();
  
  try {
    if (!ALLOWED_TABLES.includes(args.table)) {
      return {
        success: false,
        error: `Table '${args.table}' not allowed. Allowed: ${ALLOWED_TABLES.slice(0, 10).join(', ')}...`,
        execution_time_ms: Date.now() - start
      };
    }

    let query = ctx.supabase.from(args.table).select(args.select || '*');

    // Apply filters with column alias resolution
    if (args.filters && args.filters.length > 0) {
      for (const filter of args.filters) {
        const resolvedCol = resolveColumn(args.table, filter.column);
        if (!resolvedCol) {
          console.warn(`[query_database] Skipping unsupported column '${filter.column}' for table '${args.table}'`);
          continue;
        }
        const { operator, value } = filter;
        
        switch (operator) {
          case 'eq': query = query.eq(resolvedCol, value); break;
          case 'neq': query = query.neq(resolvedCol, value); break;
          case 'gt': query = query.gt(resolvedCol, value); break;
          case 'lt': query = query.lt(resolvedCol, value); break;
          case 'gte': query = query.gte(resolvedCol, value); break;
          case 'lte': query = query.lte(resolvedCol, value); break;
          case 'like': query = query.like(resolvedCol, value); break;
          case 'ilike': {
            const cleanValue = String(value).replace(/^%|%$/g, '');
            query = query.ilike(resolvedCol, `%${cleanValue}%`);
            break;
          }
          case 'in': query = query.in(resolvedCol, value.split(',')); break;
          case 'is': query = query.is(resolvedCol, value === 'null' ? null : value); break;
          case 'contains': {
            let parsedValue;
            try {
              parsedValue = JSON.parse(value);
            } catch {
              // Non-JSON value (e.g. email address) → wrap in array for JSONB array columns
              parsedValue = [value];
            }
            query = query.contains(resolvedCol, parsedValue);
            break;
          }
        }
      }
    }

    // Order with column alias resolution
    if (args.order_by) {
      const resolvedOrderCol = resolveColumn(args.table, args.order_by) || args.order_by;
      query = query.order(resolvedOrderCol, { ascending: args.ascending ?? false });
    }

    // Limit (max 100 for security)
    const limit = Math.min(args.limit || 20, 100);
    query = query.limit(limit);

    const { data, error } = await query;

    console.log(`[query_database] table=${args.table}, rows=${data?.length ?? 0}`);

    if (error) {
      // V5.2 fix : PostgrestError n'étend pas Error, on extrait message + details + hint
      // pour ne plus retourner le fallback opaque "Query failed" qui masquait RLS deny,
      // colonnes inconnues, etc. (113 feedbacks Jarvis auto-signalés sur ce point).
      const pgMessage = (error as { message?: string }).message || 'Unknown PostgREST error';
      const pgDetails = (error as { details?: string }).details;
      const pgHint = (error as { hint?: string }).hint;
      const pgCode = (error as { code?: string }).code;
      const fullMessage = [
        pgMessage,
        pgCode ? `[code=${pgCode}]` : null,
        pgDetails ? `details=${pgDetails}` : null,
        pgHint ? `hint=${pgHint}` : null,
      ].filter(Boolean).join(' | ');
      console.error(`[query_database] Query failed on table=${args.table}:`, fullMessage);
      return {
        success: false,
        error: `Query on '${args.table}' failed: ${fullMessage}`,
        execution_time_ms: Date.now() - start
      };
    }

    return {
      success: true,
      data: {
        records: data,
        count: data?.length || 0,
        table: args.table
      },
      execution_time_ms: Date.now() - start
    };
  } catch (error) {
    const msg = error instanceof Error
      ? error.message
      : (typeof error === 'object' && error && 'message' in error)
        ? String((error as { message: unknown }).message)
        : 'Query failed (unknown error shape)';
    console.error(`[query_database] Exception on table=${args.table}:`, msg);
    return {
      success: false,
      error: msg,
      execution_time_ms: Date.now() - start
    };
  }
}


// ============================================================
// TOOL: manage_memory (Persistent user context)
// ============================================================
export async function executeManageMemory(
  ctx: ToolExecutionContext,
  args: {
    action: 'add' | 'get' | 'list' | 'delete';
    category?: 'preference' | 'fact' | 'instruction' | 'context';
    key?: string;
    value?: string;
    importance?: number;
  }
): Promise<ToolResult> {
  const start = Date.now();
  
  try {
    switch (args.action) {
      case 'add': {
        if (!args.key || !args.value) {
          return {
            success: false,
            error: 'Les paramètres "key" et "value" sont requis pour ajouter une mémoire',
            execution_time_ms: Date.now() - start
          };
        }
        
        const { data, error } = await ctx.supabase
          .from('jarvis_user_memory')
          .upsert({
            user_id: ctx.userId,
            category: args.category || 'fact',
            key: args.key,
            value: args.value,
            importance: args.importance || 3,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id,category,key' })
          .select()
          .single();
        
        if (error) throw error;
        
        return {
          success: true,
          data: { message: `Mémorisé: "${args.key}" = "${args.value}"`, memory: data },
          execution_time_ms: Date.now() - start
        };
      }
      
      case 'get': {
        if (!args.key) {
          return {
            success: false,
            error: 'Le paramètre "key" est requis pour récupérer une mémoire',
            execution_time_ms: Date.now() - start
          };
        }
        
        const { data, error } = await ctx.supabase
          .from('jarvis_user_memory')
          .select('*')
          .eq('user_id', ctx.userId)
          .eq('key', args.key)
          .single();
        
        if (error || !data) {
          return {
            success: true,
            data: { message: `Aucune mémoire trouvée pour la clé "${args.key}"`, found: false },
            execution_time_ms: Date.now() - start
          };
        }
        
        return {
          success: true,
          data: { memory: data, found: true },
          execution_time_ms: Date.now() - start
        };
      }
      
      case 'list': {
        let query = ctx.supabase
          .from('jarvis_user_memory')
          .select('*')
          .eq('user_id', ctx.userId)
          .order('importance', { ascending: false })
          .order('updated_at', { ascending: false });
        
        if (args.category) {
          query = query.eq('category', args.category);
        }
        
        const { data, error } = await query.limit(50);
        
        if (error) throw error;
        
        return {
          success: true,
          data: { 
            memories: data || [], 
            count: data?.length || 0
          },
          execution_time_ms: Date.now() - start
        };
      }
      
      case 'delete': {
        if (!args.key) {
          return {
            success: false,
            error: 'Le paramètre "key" est requis pour supprimer une mémoire',
            execution_time_ms: Date.now() - start
          };
        }
        
        const { error } = await ctx.supabase
          .from('jarvis_user_memory')
          .delete()
          .eq('user_id', ctx.userId)
          .eq('key', args.key);
        
        if (error) throw error;
        
        return {
          success: true,
          data: { message: `Oublié: "${args.key}"` },
          execution_time_ms: Date.now() - start
        };
      }
      
      default:
        return {
          success: false,
          error: `Action inconnue: ${args.action}`,
          execution_time_ms: Date.now() - start
        };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors de la gestion de la mémoire',
      execution_time_ms: Date.now() - start
    };
  }
}

// ============================================================
// TOOL: get_user_context
// ============================================================
export async function executeGetUserContext(
  ctx: ToolExecutionContext,
  args: {
    include_emails?: boolean;
    include_tasks?: boolean;
    include_calendar?: boolean;
    include_tickets?: boolean;
    days_back?: number;
  }
): Promise<ToolResult> {
  const start = Date.now();
  const context: Record<string, unknown> = {};
  const daysBack = args.days_back || 7;
  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - daysBack);

  try {
    const queries = [];

    // Recent emails
    if (args.include_emails !== false) {
      queries.push(
        ctx.supabase
          .from('email_threads')
          .select('id, subject, ai_generated_title, category, last_message_date')
          .gte('last_message_date', dateFrom.toISOString())
          .order('last_message_date', { ascending: false })
          .limit(10)
          .then(({ data }) => { context.recent_emails = data || []; })
      );
    }

    // Pending tasks
    if (args.include_tasks !== false) {
      queries.push(
        ctx.supabase
          .from('taches')
          .select('id, titre, priorite, statut, echeance')
          .in('statut', ['A faire', 'En cours'])
          .order('echeance', { ascending: true })
          .limit(15)
          .then(({ data }) => { context.pending_tasks = data || []; })
      );
    }

    // Upcoming events
    if (args.include_calendar !== false) {
      const now = new Date().toISOString();
      const weekLater = new Date();
      weekLater.setDate(weekLater.getDate() + 7);
      
      queries.push(
        ctx.supabase
          .from('calendar_events')
          .select('id, title, start_time, end_time, location')
          .gte('start_time', now)
          .lte('start_time', weekLater.toISOString())
          .order('start_time', { ascending: true })
          .limit(10)
          .then(({ data }) => { context.upcoming_events = data || []; })
      );
    }

    // Support tickets
    if (args.include_tickets !== false) {
      queries.push(
        ctx.supabase
          .from('support_tickets')
          .select('id, titre, priority, status, created_at')
          .in('status', ['open', 'in_progress'])
          .order('priority', { ascending: true })
          .limit(10)
          .then(({ data }) => { context.open_tickets = data || []; })
      );
    }

    // User profile
    queries.push(
      ctx.supabase
        .from('profiles')
        .select('id, nom, prenom, email')
        .eq('id', ctx.userId)
        .single()
        .then(({ data }) => { context.user = data; })
    );

    // Execute all queries in parallel
    await Promise.all(queries);

    return {
      success: true,
      data: context,
      execution_time_ms: Date.now() - start
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get context',
      execution_time_ms: Date.now() - start
    };
  }
}

// ============================================================
// TOOL: update_entity_status
// ============================================================
export async function executeUpdateEntityStatus(
  ctx: ToolExecutionContext,
  args: {
    entity_type: string;
    entity_id: string;
    new_status: string;
    note?: string;
  }
): Promise<ToolResult> {
  const start = Date.now();
  
  try {
    const tableMap: Record<string, { table: string; statusColumn: string }> = {
      'etablissement': { table: 'etablissements', statusColumn: 'statut' },
      'tache': { table: 'taches', statusColumn: 'statut' },
      'ticket': { table: 'support_tickets', statusColumn: 'status' }
    };

    const config = tableMap[args.entity_type];
    if (!config) {
      throw new Error(`Unknown entity type: ${args.entity_type}`);
    }

    const { data, error } = await ctx.supabase
      .from(config.table)
      .update({ [config.statusColumn]: args.new_status })
      .eq('id', args.entity_id)
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      data: { message: `Statut mis à jour: ${args.new_status}`, entity: data },
      execution_time_ms: Date.now() - start
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Update failed',
      execution_time_ms: Date.now() - start
    };
  }
}

// ============================================================
// Helper: Get or create default "Jarvis" category for tasks
// ============================================================
export async function getDefaultCategorieId(supabase: SupabaseClient): Promise<string> {
  const { data: existing } = await supabase
    .from('tache_categories')
    .select('id')
    .eq('nom', 'Jarvis')
    .limit(1)
    .single();
    
  if (existing?.id) return existing.id;
  
  const { data: created } = await supabase
    .from('tache_categories')
    .insert({ nom: 'Jarvis', couleur: '#6366f1', description: 'Tâches créées par Jarvis' })
    .select('id')
    .single();
    
  if (created?.id) return created.id;
  
  const { data: fallback } = await supabase
    .from('tache_categories')
    .select('id')
    .limit(1)
    .single();
    
  return fallback?.id || '00000000-0000-0000-0000-000000000000';
}

// ============================================================
// TOOL: create_task
// ============================================================
export async function executeCreateTask(
  ctx: ToolExecutionContext,
  args: {
    titre: string;
    description?: string;
    priorite?: string;
    etablissement_id?: string;
    assignee_id?: string;
    date_echeance?: string;
    categorie_id?: string;
  }
): Promise<ToolResult> {
  const start = Date.now();
  
  try {
    const categorieId = args.categorie_id || await getDefaultCategorieId(ctx.supabase);
    
    const { data, error } = await ctx.supabase
      .from('taches')
      .insert({
        titre: args.titre,
        description: args.description,
        priorite: args.priorite || 'moyenne',
        etablissement_id: args.etablissement_id,
        responsable_id: args.assignee_id || ctx.userId,
        echeance: args.date_echeance,
        statut: 'A faire',
        categorie_id: categorieId
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      data: { message: 'Tâche créée avec succès', task: data },
      execution_time_ms: Date.now() - start
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create task',
      execution_time_ms: Date.now() - start
    };
  }
}

// ============================================================
// TOOL: schedule_meeting
// ============================================================
export async function executeScheduleMeeting(
  ctx: ToolExecutionContext,
  args: {
    title: string;
    start_time: string;
    end_time: string;
    attendees?: string[];
    location?: string;
    description?: string;
    create_video_link?: boolean;
  }
): Promise<ToolResult> {
  const start = Date.now();
  
  try {
    // Use authUserId (auth.users.id) since calendars.owner_id stores the Auth UID
    const calendarOwnerId = ctx.authUserId || ctx.userId;

    // Try to find default calendar
    let { data: calendar } = await ctx.supabase
      .from('calendars')
      .select('id')
      .eq('owner_id', calendarOwnerId)
      .eq('is_default', true)
      .single();

    // Fallback: any calendar owned by this user
    if (!calendar) {
      const { data: anyCalendar } = await ctx.supabase
        .from('calendars')
        .select('id')
        .eq('owner_id', calendarOwnerId)
        .limit(1)
        .single();
      calendar = anyCalendar;
    }

    if (!calendar) {
      throw new Error('Aucun calendrier trouvé. Veuillez d\'abord créer un calendrier.');
    }

    const { data, error } = await ctx.supabase
      .from('calendar_events')
      .insert({
        calendar_id: calendar.id,
        title: args.title,
        start_time: args.start_time,
        end_time: args.end_time,
        location: args.location,
        description: args.description,
        created_by: ctx.userId,
        status: 'confirmed'
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      data: { message: 'Réunion planifiée avec succès', event: data },
      execution_time_ms: Date.now() - start
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to schedule meeting',
      execution_time_ms: Date.now() - start
    };
  }
}

