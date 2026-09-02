import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { sanitizeErrorForClient } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { suggestion_id } = await req.json();

    // Fetch suggestion
    const { data: suggestion } = await supabase
      .from("ai_suggested_actions")
      .select("*")
      .eq("id", suggestion_id)
      .single();

    if (!suggestion) {
      return new Response(JSON.stringify({ error: "Suggestion not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (suggestion.status !== 'pending') {
      return new Response(JSON.stringify({ error: "Suggestion already processed" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Log suggestion details for debugging
    console.log(`🔍 Applying suggestion ${suggestion_id}:`, {
      action_type: suggestion.action_type,
      action_data: suggestion.action_data,
      etablissement_id: suggestion.etablissement_id,
      partenaire_id: suggestion.partenaire_id
    });

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    let result: any = { success: false };

    // Apply action based on type
    switch (suggestion.action_type) {
      // ===== ACTIONS ÉTABLISSEMENTS =====
        case 'update_task': {
          const { task_id: rawTaskId, new_status: rawNewStatus, status: statusAlias, task_title } = suggestion.action_data || {};
          let task_id = rawTaskId as string | undefined;
          let new_status = (rawNewStatus ?? statusAlias) as string | undefined;

          // Résolution par titre si task_id manquant
          if (!task_id && task_title) {
            console.log(`ℹ️ No task_id provided, trying to resolve by title "${task_title}" for etablissement ${suggestion.etablissement_id}`);
            // Essai correspondance exacte
            const { data: exactTask, error: exactError } = await supabase
              .from('taches')
              .select('id, titre, statut, etablissement_id')
              .eq('etablissement_id', suggestion.etablissement_id)
              .eq('titre', task_title)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (exactError) {
              console.error('Error fetching exact task by title:', exactError);
            }

            if (exactTask?.id) {
              task_id = exactTask.id;
            } else {
              // Repli: recherche partielle (ILIKE)
              const { data: likeTasks, error: likeError } = await supabase
                .from('taches')
                .select('id, titre, statut, etablissement_id, created_at')
                .eq('etablissement_id', suggestion.etablissement_id)
                .ilike('titre', `%${task_title}%`)
                .order('created_at', { ascending: false })
                .limit(1);

              if (likeError) {
                console.error('Error fetching task by ilike title:', likeError);
              }

              if (likeTasks && likeTasks.length > 0) {
                task_id = likeTasks[0].id;
              }
            }
          }
          
          if (!task_id) {
            console.error('❌ task_id introuvable et aucun titre correspondant:', JSON.stringify(suggestion.action_data));
            await supabase
              .from('ai_suggested_actions')
              .update({
                status: 'rejected',
                reviewed_at: new Date().toISOString(),
                reviewed_by: profile?.id
              })
              .eq('id', suggestion_id);
            
            return new Response(
              JSON.stringify({ 
                error: 'Impossible de trouver la tâche à mettre à jour',
                details: 'Aucun task_id fourni et aucun titre correspondant trouvé.'
              }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          if (!new_status) {
            console.error('❌ new_status manquant dans action_data:', JSON.stringify(suggestion.action_data));
            
            await supabase
              .from('ai_suggested_actions')
              .update({
                status: 'rejected',
                reviewed_at: new Date().toISOString(),
                reviewed_by: profile?.id
              })
              .eq('id', suggestion_id);
            
            return new Response(
              JSON.stringify({ 
                error: 'Suggestion invalide : nouveau statut manquant',
                details: 'Cette suggestion a été automatiquement rejetée.'
              }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          // Vérifier que la tâche existe et appartient bien à l'établissement
          const { data: existingTask, error: fetchError } = await supabase
            .from('taches')
            .select('id, titre, statut, etablissement_id')
            .eq('id', task_id)
            .single();
          
          if (fetchError || !existingTask) {
            throw new Error(`Tâche ${task_id} introuvable`);
          }
          
          if (existingTask.etablissement_id !== suggestion.etablissement_id) {
            throw new Error(`Tâche ${task_id} n'appartient pas à l'établissement ${suggestion.etablissement_id}`);
          }
          
          console.log(`✅ Updating task ${task_id}: ${existingTask.titre} → ${new_status}`);
          
          const { error: updateError } = await supabase
            .from('taches')
            .update({ 
              statut: new_status,
              date_realisation: new_status === 'Terminé' ? new Date().toISOString().split('T')[0] : null,
              updated_at: new Date().toISOString()
            })
            .eq('id', task_id);
          
          if (updateError) throw updateError;
          result = { success: true, action: 'task_updated', task_id, task_title: existingTask.titre };
          break;
        }

      case 'create_task': {
        // Contrainte taches_entity_check: exactement un des deux doit être non-null
        let resolvedEtablissementId = suggestion.etablissement_id as string | null;
        let resolvedPartenaireId = suggestion.partenaire_id as string | null;

        // Si la suggestion n'a pas d'entité, tenter une résolution automatique depuis le thread email
        if (!resolvedEtablissementId && !resolvedPartenaireId && suggestion.email_thread_id) {
          try {
            const { data: thread } = await supabase
              .from('email_threads')
              .select('id, etablissement_id, partenaire_id, participants')
              .eq('id', suggestion.email_thread_id)
              .maybeSingle();

            resolvedEtablissementId = (thread as any)?.etablissement_id ?? null;
            resolvedPartenaireId = (thread as any)?.partenaire_id ?? null;

            if (!resolvedEtablissementId && !resolvedPartenaireId && (thread as any)?.participants) {
              const participants = (thread as any).participants;

              const emails = new Set<string>();
              const domains = new Set<string>();

              const pushFromText = (text: string) => {
                const matches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
                for (const m of matches) {
                  const email = m.toLowerCase();
                  emails.add(email);
                  const domain = email.split('@')[1];
                  if (domain) domains.add(domain);
                }
              };

              const walk = (v: any) => {
                if (v == null) return;
                if (typeof v === 'string') return pushFromText(v);
                if (Array.isArray(v)) return v.forEach(walk);
                if (typeof v === 'object') {
                  for (const val of Object.values(v)) walk(val);
                }
              };

              walk(participants);

              const emailList = Array.from(emails).slice(0, 50);
              const domainList = Array.from(domains).slice(0, 50);

              // 1) Mapping email spécifique (prioritaire)
              if (!resolvedEtablissementId && !resolvedPartenaireId && emailList.length > 0) {
                const { data: specific } = await supabase
                  .from('email_specific_mappings')
                  .select('etablissement_id, partenaire_id, verified, created_at')
                  .in('email_address', emailList)
                  .order('verified', { ascending: false })
                  .order('created_at', { ascending: false })
                  .limit(1)
                  .maybeSingle();

                resolvedEtablissementId = (specific as any)?.etablissement_id ?? null;
                resolvedPartenaireId = (specific as any)?.partenaire_id ?? null;
              }

              // 2) Mapping par domaine
              if (!resolvedEtablissementId && !resolvedPartenaireId && domainList.length > 0) {
                const { data: domainMap } = await supabase
                  .from('email_domain_mappings')
                  .select('etablissement_id, partenaire_id, verified, last_seen_at, prevent_auto, is_excluded')
                  .in('domain', domainList)
                  .eq('is_excluded', false)
                  .or('prevent_auto.is.null,prevent_auto.eq.false')
                  .order('verified', { ascending: false })
                  .order('last_seen_at', { ascending: false })
                  .limit(1)
                  .maybeSingle();

                resolvedEtablissementId = (domainMap as any)?.etablissement_id ?? null;
                resolvedPartenaireId = (domainMap as any)?.partenaire_id ?? null;
              }
            }

            // Persister la résolution pour les prochaines actions
            if (resolvedEtablissementId || resolvedPartenaireId) {
              await supabase
                .from('ai_suggested_actions')
                .update({
                  etablissement_id: resolvedEtablissementId,
                  partenaire_id: resolvedPartenaireId,
                })
                .eq('id', suggestion_id);
            }
          } catch (e) {
            console.error('Error while resolving entity for create_task:', e);
          }
        }

        if (!resolvedEtablissementId && !resolvedPartenaireId) {
          console.error('❌ create_task sans etablissement_id ni partenaire_id:', JSON.stringify(suggestion));
          await supabase
            .from('ai_suggested_actions')
            .update({
              status: 'rejected',
              reviewed_at: new Date().toISOString(),
              reviewed_by: profile?.id
            })
            .eq('id', suggestion_id);

          return new Response(
            JSON.stringify({
              error: "Impossible de créer une tâche sans entité liée",
              details: "Veuillez associer cet email/conversation à un établissement ou un partenaire avant d'appliquer cette suggestion."
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Choisir l'entité cible (si les deux existent, on privilégie l'établissement sauf si action_data.entity_type=partenaire)
        const preferredEntity = (suggestion.action_data?.entity_type as string | undefined)?.toLowerCase();
        const usePartenaire = preferredEntity === 'partenaire' && !!resolvedPartenaireId;

        const taskEntity = usePartenaire
          ? { etablissement_id: null, partenaire_id: resolvedPartenaireId }
          : resolvedEtablissementId
            ? { etablissement_id: resolvedEtablissementId, partenaire_id: null }
            : { etablissement_id: null, partenaire_id: resolvedPartenaireId };

        // Résoudre la catégorie par nom
        let categoryId = suggestion.action_data.category_id;

        if (!categoryId && suggestion.action_data.category) {
          const { data: category } = await supabase
            .from("categories_taches")
            .select("id")
            .ilike("nom", suggestion.action_data.category)
            .maybeSingle();

          categoryId = category?.id;
        }

        // Si toujours pas de catégorie, utiliser la première catégorie disponible
        if (!categoryId) {
          const { data: defaultCategory } = await supabase
            .from("categories_taches")
            .select("id")
            .order("ordre", { ascending: true })
            .limit(1)
            .maybeSingle();

          categoryId = defaultCategory?.id;
        }

        if (!categoryId) {
          throw new Error("Aucune catégorie disponible pour créer la tâche");
        }

        // Calculer l'échéance si deadline_days est fourni
        let echeance = null;
        const deadlineDays = suggestion.action_data?.deadline_days ?? suggestion.action_data?.due_in_days;
        const parsedDays = typeof deadlineDays === 'string' ? parseInt(deadlineDays, 10) : deadlineDays;
        if (parsedDays && !Number.isNaN(parsedDays)) {
          const deadline = new Date();
          deadline.setDate(deadline.getDate() + parsedDays);
          echeance = deadline.toISOString().split('T')[0];
        }

        const { data: newTask, error: insertError } = await supabase
          .from("taches")
          .insert({
            ...taskEntity,
            titre: suggestion.action_data.title,
            description: suggestion.action_data.description || '',
            priorite: suggestion.action_data.priority || 'medium',
            statut: 'A faire',
            categorie_id: categoryId,
            echeance: echeance
          })
          .select()
          .single();

        if (insertError) throw insertError;
        result = { success: true, action: 'task_created', task_id: newTask?.id };
        break;
      }

      case 'change_status':
        const { new_status: newStatusValue } = suggestion.action_data;
        const { error: statusError } = await supabase
          .from("etablissements")
          .update({ 
            statut: newStatusValue,
            updated_at: new Date().toISOString()
          })
          .eq("id", suggestion.etablissement_id);
        
        if (statusError) throw statusError;
        result = { success: true, action: 'status_changed', new_status: newStatusValue };
        break;

      case 'update_summary':
        const { new_insights } = suggestion.action_data;
        const { error: summaryError } = await supabase
          .from("etablissements")
          .update({ 
            derniers_echanges_resume: new_insights,
            derniers_echanges_updated_at: new Date().toISOString()
          })
          .eq("id", suggestion.etablissement_id);
        
        if (summaryError) throw summaryError;
        result = { success: true, action: 'summary_updated' };
        break;

      // ===== ACTIONS CRM (PARTENAIRES ET ÉTABLISSEMENTS) =====
      case 'send_email_response':
        const { recipient, subject, draft_content, tone, key_points } = suggestion.action_data;
        
        const { data: draft, error: draftError } = await supabase
          .from("email_drafts")
          .insert({
            profile_id: profile?.id,
            etablissement_id: suggestion.etablissement_id,
            partenaire_id: suggestion.partenaire_id,
            recipient_email: recipient,
            subject: subject,
            content: draft_content,
            metadata: { tone, key_points, ai_generated: true }
          })
          .select()
          .single();
        
        if (draftError) throw draftError;
        result = { success: true, action: 'email_draft_created', draft_id: draft?.id };
        break;
      
       case 'schedule_follow_up': {
         const { follow_up_date, follow_up_reason, follow_up_type } = suggestion.action_data;

         if (suggestion.partenaire_id) {
           const { data: activity, error: activityError } = await supabase
             .from("partenaire_activities")
             .insert({
               partenaire_id: suggestion.partenaire_id,
               type: 'follow_up',
               scheduled_date: follow_up_date,
               description: follow_up_reason,
               created_by: profile?.id,
               status: 'scheduled'
             })
             .select()
             .single();

           if (activityError) throw activityError;
           result = { success: true, action: 'follow_up_scheduled', activity_id: activity?.id };
         } else {
           // Pour établissements : créer une tâche de suivi
           if (!suggestion.etablissement_id) {
             await supabase
               .from('ai_suggested_actions')
               .update({
                 status: 'rejected',
                 reviewed_at: new Date().toISOString(),
                 reviewed_by: profile?.id
               })
               .eq('id', suggestion_id);

             return new Response(
               JSON.stringify({
                 error: "Impossible de créer une tâche de suivi sans établissement lié",
                 details: "Veuillez associer cet email/conversation à un établissement."
               }),
               { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
             );
           }

           const { data: task, error: taskError } = await supabase
             .from("taches")
             .insert({
               etablissement_id: suggestion.etablissement_id,
               partenaire_id: null,
               titre: follow_up_reason || 'Suivi client',
               description: follow_up_reason,
               priorite: 'medium',
               echeance: follow_up_date,
               statut: 'A faire'
             })
             .select()
             .single();

           if (taskError) throw taskError;
           result = { success: true, action: 'follow_up_task_created', task_id: task?.id };
         }
         break;
       }
      
      case 'update_engagement_score':
        const { new_score, score_justification } = suggestion.action_data;
        
        const { error: scoreError } = await supabase
          .from("partenaires")
          .update({ 
            engagement_score: new_score,
            updated_at: new Date().toISOString()
          })
          .eq("id", suggestion.partenaire_id);
        
        if (scoreError) throw scoreError;
        result = { success: true, action: 'engagement_score_updated', new_score };
        break;
      
      case 'create_activity_note':
        const { note_content, note_type } = suggestion.action_data;
        
        const { data: note, error: noteError } = await supabase
          .from("partenaire_activities")
          .insert({
            partenaire_id: suggestion.partenaire_id,
            type: note_type || 'note',
            description: note_content,
            created_by: profile?.id,
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .select()
          .single();
        
        if (noteError) throw noteError;
        result = { success: true, action: 'activity_note_created', note_id: note?.id };
        break;
      
      case 'change_relation_status':
        const { new_relation_status } = suggestion.action_data;
        
        const { error: relationError } = await supabase
          .from("partenaires")
          .update({ 
            statut_relation: new_relation_status,
            updated_at: new Date().toISOString()
          })
          .eq("id", suggestion.partenaire_id);
        
        if (relationError) throw relationError;
        result = { success: true, action: 'relation_status_changed', new_status: new_relation_status };
        break;
      
      case 'suggest_meeting':
        const { meeting_date, meeting_objective, participants } = suggestion.action_data;
        
        const { data: meeting, error: meetingError } = await supabase
          .from("partenaire_activities")
          .insert({
            partenaire_id: suggestion.partenaire_id,
            type: 'meeting',
            scheduled_date: meeting_date,
            description: meeting_objective,
            metadata: { participants },
            created_by: profile?.id,
            status: 'scheduled'
          })
          .select()
          .single();
        
        if (meetingError) throw meetingError;
        result = { success: true, action: 'meeting_suggested', meeting_id: meeting?.id };
        break;
      
      case 'update_partnership_value':
        const { new_value, value_justification } = suggestion.action_data;
        
        const { error: valueError } = await supabase
          .from("partenaires")
          .update({ 
            valeur_partenariat: new_value,
            updated_at: new Date().toISOString()
          })
          .eq("id", suggestion.partenaire_id);
        
        if (valueError) throw valueError;
        result = { success: true, action: 'partnership_value_updated', new_value };
        break;

      default:
        throw new Error(`Unknown action type: ${suggestion.action_type}`);
    }

    // Mark suggestion as approved
    await supabase
      .from("ai_suggested_actions")
      .update({
        status: 'approved',
        reviewed_by: profile?.id,
        reviewed_at: new Date().toISOString()
      })
      .eq("id", suggestion_id);

    return new Response(JSON.stringify({
      success: true,
      result
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Error in apply-ai-suggestion:", error);
    return new Response(JSON.stringify({ error: sanitizeErrorForClient(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
