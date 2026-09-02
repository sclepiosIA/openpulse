/**
 * JARVIS - People/HR Tools (Employee dossier + profile update)
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { ToolResult } from "../tools-executor.ts";

interface ToolContext { supabase: SupabaseClient; userId: string; }

export async function executeGetEmployeeDossier(ctx: ToolContext, args: { profile_id: string }): Promise<ToolResult> {
  const start = Date.now();
  try {
    const [profileResult, salairesResult, absencesResult, competencesResult, certsResult, tasksResult] = await Promise.all([
      ctx.supabase.from('profiles').select('id, prenom, nom, email, fonction, telephone, date_embauche, type_contrat, actif, avatar_url, linkedin_url').eq('id', args.profile_id).single(),
      ctx.supabase.from('rh_salaires_mensuels').select('mois, annee, salaire_net, salaire_brut, cout_employeur').eq('profile_id', args.profile_id).order('annee', { ascending: false }).order('mois', { ascending: false }).limit(6),
      ctx.supabase.from('rh_absences').select('id, type, date_debut, date_fin, statut, nombre_jours').eq('profile_id', args.profile_id).order('date_debut', { ascending: false }).limit(10),
      ctx.supabase.from('employee_competences').select('id, niveau, referentiel_competences(nom, categorie)').eq('profile_id', args.profile_id),
      ctx.supabase.from('employee_certifications').select('id, nom, organisme, date_obtention, date_expiration, statut').eq('profile_id', args.profile_id),
      ctx.supabase.from('taches').select('id, titre, statut, priorite, echeance').eq('responsable_id', args.profile_id).in('statut', ['A faire', 'En cours']).order('echeance', { ascending: true }).limit(10),
    ]);

    if (profileResult.error) throw profileResult.error;

    return {
      success: true,
      data: {
        profile: profileResult.data,
        salaires: salairesResult.data || [],
        absences: absencesResult.data || [],
        competences: competencesResult.data || [],
        certifications: certsResult.data || [],
        taches_en_cours: tasksResult.data || [],
        summary: {
          derniers_salaires: (salairesResult.data || []).length,
          absences_total: (absencesResult.data || []).length,
          competences_count: (competencesResult.data || []).length,
          certifications_count: (certsResult.data || []).length,
          taches_actives: (tasksResult.data || []).length,
        }
      },
      execution_time_ms: Date.now() - start
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to get employee dossier', execution_time_ms: Date.now() - start };
  }
}

export async function executeUpdateProfile(ctx: ToolContext, args: { profile_id: string; data: Record<string, unknown> }): Promise<ToolResult> {
  const start = Date.now();
  try {
    // Only allow safe fields to be updated
    const allowedFields = ['fonction', 'telephone', 'email', 'linkedin_url', 'avatar_url', 'date_embauche', 'type_contrat'];
    const safeData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(args.data || {})) {
      if (allowedFields.includes(key)) safeData[key] = value;
    }

    if (Object.keys(safeData).length === 0) {
      return { success: false, error: `Aucun champ modifiable trouvé. Champs autorisés: ${allowedFields.join(', ')}`, execution_time_ms: Date.now() - start };
    }

    const { data, error } = await ctx.supabase.from('profiles').update(safeData).eq('id', args.profile_id).select().single();
    if (error) throw error;

    return { success: true, data: { message: 'Profil mis à jour', profile: data, updated_fields: Object.keys(safeData) }, execution_time_ms: Date.now() - start };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update profile', execution_time_ms: Date.now() - start };
  }
}
