/**
 * JARVIS 12.0 - Reporting & Export Tools
 * 
 * Génération de rapports, exports Excel/PDF, snapshots dashboards
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { ToolResult } from "../tools-executor.ts";

interface ToolContext { supabase: SupabaseClient; userId: string; }

interface ReportConfig {
  title: string;
  type: string;
  period_start?: string;
  period_end?: string;
  filters?: Record<string, string>;
  sections?: string[];
}

export async function executeGenerateReport(ctx: ToolContext, args: ReportConfig): Promise<ToolResult> {
  const start = Date.now();
  try {
    const periodStart = args.period_start ? new Date(args.period_start) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const periodEnd = args.period_end ? new Date(args.period_end) : new Date();

    const reportData: Record<string, unknown> = { 
      title: args.title,
      type: args.type,
      generated_at: new Date().toISOString(),
      period: { start: periodStart.toISOString(), end: periodEnd.toISOString() },
      sections: {}
    };

    // Générer les sections selon le type de rapport
    switch (args.type) {
      case 'crm_activity': {
        const { data: etabs } = await ctx.supabase.from('etablissements').select('statut').gte('created_at', periodStart.toISOString()).lte('created_at', periodEnd.toISOString());
        const { data: tasks } = await ctx.supabase.from('taches').select('statut').gte('created_at', periodStart.toISOString()).lte('created_at', periodEnd.toISOString());
        const { data: contacts } = await ctx.supabase.from('contacts').select('id').gte('created_at', periodStart.toISOString()).lte('created_at', periodEnd.toISOString());
        
        reportData.sections = {
          etablissements: {
            total: etabs?.length || 0,
            by_status: etabs?.reduce((acc: Record<string, number>, e) => { acc[e.statut] = (acc[e.statut] || 0) + 1; return acc; }, {})
          },
          tasks: {
            total: tasks?.length || 0,
            completed: tasks?.filter(t => t.statut === 'Termine').length || 0
          },
          contacts_created: contacts?.length || 0
        };
        break;
      }
      case 'financial': {
        const { data: revenus } = await ctx.supabase.from('tresorerie_revenus').select('montant, categorie').gte('date_reception', periodStart.toISOString()).lte('date_reception', periodEnd.toISOString());
        const { data: depenses } = await ctx.supabase.from('tresorerie_depenses').select('montant, categorie').gte('date_depense', periodStart.toISOString()).lte('date_depense', periodEnd.toISOString());
        
        const totalRevenue = revenus?.reduce((sum, r) => sum + (r.montant || 0), 0) || 0;
        const totalExpense = depenses?.reduce((sum, d) => sum + (d.montant || 0), 0) || 0;
        
        reportData.sections = {
          revenue: { total: totalRevenue, by_category: revenus?.reduce((acc: Record<string, number>, r) => { acc[r.categorie || 'other'] = (acc[r.categorie || 'other'] || 0) + r.montant; return acc; }, {}) },
          expenses: { total: totalExpense, by_category: depenses?.reduce((acc: Record<string, number>, d) => { acc[d.categorie || 'other'] = (acc[d.categorie || 'other'] || 0) + d.montant; return acc; }, {}) },
          profit: totalRevenue - totalExpense
        };
        break;
      }
      case 'hr_summary': {
        const { data: salaires } = await ctx.supabase.from('rh_salaires_mensuels').select('salaire_net, salaire_brut, cout_employeur').gte('created_at', periodStart.toISOString());
        const { data: absences } = await ctx.supabase.from('rh_absences').select('type, profile_id').gte('date_debut', periodStart.toISOString()).lte('date_fin', periodEnd.toISOString());
        
        reportData.sections = {
          payroll: {
            total_net: salaires?.reduce((sum, s) => sum + (s.salaire_net || 0), 0) || 0,
            total_brut: salaires?.reduce((sum, s) => sum + (s.salaire_brut || 0), 0) || 0,
            total_cost: salaires?.reduce((sum, s) => sum + (s.cout_employeur || 0), 0) || 0,
            employees: salaires?.length || 0
          },
          absences: {
            total: absences?.length || 0,
            by_type: absences?.reduce((acc: Record<string, number>, a) => { acc[a.type] = (acc[a.type] || 0) + 1; return acc; }, {})
          }
        };
        break;
      }
      case 'support': {
        const { data: tickets } = await ctx.supabase.from('support_tickets').select('status, priority, created_at, resolved_at').gte('created_at', periodStart.toISOString()).lte('created_at', periodEnd.toISOString());
        
        const resolved = tickets?.filter(t => t.resolved_at) || [];
        const avgResolutionTime = resolved.length > 0 
          ? resolved.reduce((sum, t) => sum + (new Date(t.resolved_at!).getTime() - new Date(t.created_at).getTime()), 0) / resolved.length / (1000 * 60 * 60)
          : 0;
        
        reportData.sections = {
          total: tickets?.length || 0,
          by_status: tickets?.reduce((acc: Record<string, number>, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {}),
          by_priority: tickets?.reduce((acc: Record<string, number>, t) => { acc[t.priority] = (acc[t.priority] || 0) + 1; return acc; }, {}),
          avg_resolution_hours: Math.round(avgResolutionTime * 10) / 10
        };
        break;
      }
      default:
        reportData.sections = { message: 'Type de rapport non reconnu' };
    }

    // Sauvegarder le rapport
    const { data: savedReport, error } = await ctx.supabase.from('ai_analysis_log').insert({
      user_id: ctx.userId,
      analysis_type: `report_${args.type}`,
      filters: args.filters,
      has_insights: true,
      insights_data: reportData
    }).select().single();

    if (error) console.warn('Failed to save report:', error);

    return { success: true, data: { message: `Rapport "${args.title}" généré`, report: reportData, report_id: savedReport?.id }, execution_time_ms: Date.now() - start };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Report generation failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeExportToExcel(ctx: ToolContext, args: { table: string; filters?: Array<{ column: string; operator: string; value: string }>; columns?: string[]; filename?: string }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const allowedTables = ['etablissements', 'contacts', 'taches', 'factures', 'support_tickets', 'rh_absences'];
    if (!allowedTables.includes(args.table)) {
      return { success: false, error: `Table '${args.table}' non autorisée pour l'export`, execution_time_ms: Date.now() - start };
    }

    let query = ctx.supabase.from(args.table).select(args.columns?.join(',') || '*');
    
    if (args.filters) {
      for (const filter of args.filters) {
        switch (filter.operator) {
          case 'eq': query = query.eq(filter.column, filter.value); break;
          case 'gte': query = query.gte(filter.column, filter.value); break;
          case 'lte': query = query.lte(filter.column, filter.value); break;
          case 'ilike': query = query.ilike(filter.column, `%${filter.value}%`); break;
        }
      }
    }

    const { data, error } = await query.limit(1000);
    if (error) throw error;

    // Retourner les données formatées (le frontend génèrera le fichier Excel)
    return { 
      success: true, 
      data: { 
        message: `Export préparé: ${data?.length || 0} lignes`,
        filename: args.filename || `export_${args.table}_${new Date().toISOString().split('T')[0]}.xlsx`,
        table: args.table,
        rows: data,
        row_count: data?.length || 0
      }, 
      execution_time_ms: Date.now() - start 
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Export failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeCreateDashboardSnapshot(ctx: ToolContext, args: { dashboard_type: string; save_to_storage?: boolean }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const snapshot: Record<string, unknown> = {
      type: args.dashboard_type,
      created_at: new Date().toISOString(),
      created_by: ctx.userId,
      metrics: {}
    };

    switch (args.dashboard_type) {
      case 'executive': {
        // KPIs exécutifs
        const [etabs, tasks, tickets, revenue] = await Promise.all([
          ctx.supabase.from('etablissements').select('statut'),
          ctx.supabase.from('taches').select('statut').eq('statut', 'termine'),
          ctx.supabase.from('support_tickets').select('status').in('status', ['open', 'in_progress']),
          ctx.supabase.from('tresorerie_revenus').select('montant').gte('date_reception', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
        ]);
        
        snapshot.metrics = {
          total_clients: etabs.data?.filter(e => e.statut === 'production').length || 0,
          prospects: etabs.data?.filter(e => ['prospect', 'prospection_active'].includes(e.statut)).length || 0,
          tasks_completed_month: tasks.data?.length || 0,
          open_tickets: tickets.data?.length || 0,
          mtd_revenue: revenue.data?.reduce((sum, r) => sum + (r.montant || 0), 0) || 0
        };
        break;
      }
      case 'sales': {
        const { data: pipeline } = await ctx.supabase.from('etablissements').select('statut, valeur_estimee').in('statut', ['prospect', 'prospection_active', 'negociation', 'proposition']);
        snapshot.metrics = {
          pipeline_count: pipeline?.length || 0,
          pipeline_value: pipeline?.reduce((sum, e) => sum + (e.valeur_estimee || 0), 0) || 0,
          by_stage: pipeline?.reduce((acc: Record<string, { count: number; value: number }>, e) => { 
            if (!acc[e.statut]) acc[e.statut] = { count: 0, value: 0 };
            acc[e.statut].count++;
            acc[e.statut].value += e.valeur_estimee || 0;
            return acc;
          }, {})
        };
        break;
      }
      case 'operations': {
        const today = new Date().toISOString().split('T')[0];
        const [tasks, events, tickets] = await Promise.all([
          ctx.supabase.from('taches').select('priorite, statut').in('statut', ['en_attente', 'en_cours']),
          ctx.supabase.from('calendar_events').select('id').gte('start_time', today).lte('start_time', today + 'T23:59:59'),
          ctx.supabase.from('support_tickets').select('priority').in('status', ['open', 'in_progress'])
        ]);
        
        snapshot.metrics = {
          pending_tasks: tasks.data?.length || 0,
          urgent_tasks: tasks.data?.filter(t => t.priorite === 'haute' || t.priorite === 'critique').length || 0,
          today_events: events.data?.length || 0,
          critical_tickets: tickets.data?.filter(t => t.priority === 'critical').length || 0
        };
        break;
      }
    }

    return { success: true, data: { message: `Snapshot ${args.dashboard_type} créé`, snapshot }, execution_time_ms: Date.now() - start };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Snapshot failed', execution_time_ms: Date.now() - start };
  }
}

export async function executeScheduleReport(ctx: ToolContext, args: { report_type: string; frequency: string; recipients: string[]; title: string }): Promise<ToolResult> {
  const start = Date.now();
  try {
    // Stocker la configuration du rapport programmé
    const { data, error } = await ctx.supabase.from('user_preferences').upsert({
      user_id: ctx.userId,
      preference_key: `scheduled_report_${args.report_type}`,
      preference_value: JSON.stringify({
        type: args.report_type,
        frequency: args.frequency,
        recipients: args.recipients,
        title: args.title,
        enabled: true,
        created_at: new Date().toISOString()
      })
    }).select().single();

    if (error) throw error;

    return { 
      success: true, 
      data: { 
        message: `Rapport "${args.title}" programmé (${args.frequency})`,
        schedule: {
          type: args.report_type,
          frequency: args.frequency,
          recipients: args.recipients
        }
      }, 
      execution_time_ms: Date.now() - start 
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Schedule failed', execution_time_ms: Date.now() - start };
  }
}
