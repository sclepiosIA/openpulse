/**
 * JARVIS 10.5 - Autopilot Scheduler
 * 
 * Exécute automatiquement les règles d'automatisation configurées par les utilisateurs.
 * Déclencheurs supportés:
 * - schedule: exécution à heures fixes (ex: tous les jours à 9h)
 * - interval: exécution périodique (ex: toutes les 2 heures)
 * - event: déclenché par triggers PostgreSQL (géré ailleurs)
 * 
 * CRON: Toutes les 5 minutes
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";
import { requireInternalSecret } from "../_shared/internal-secret.ts";


import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

interface AutopilotRule {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  trigger_type: 'schedule' | 'interval' | 'event' | 'data_condition';
  trigger_config: {
    hour?: number;
    minute?: number;
    days?: number[];
    intervalMinutes?: number;
    eventType?: string;
    // Data condition config
    conditionType?: string;
    conditionParams?: Record<string, unknown>;
    checkIntervalMinutes?: number; // How often to check the condition (default: 60)
  };
  action_command: string;
  action_params: Record<string, unknown> | null;
  is_active: boolean;
  last_executed_at: string | null;
  execution_count: number;
  created_at: string;
}

interface ExecutionResult {
  rule_id: string;
  rule_name: string;
  success: boolean;
  execution_time_ms: number;
  error?: string;
  result?: unknown;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Internal/CRON only — reject any non-trusted caller
  const denied = requireInternalSecret(req, corsHeaders);
  if (denied) return denied;


  const startTime = Date.now();
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const now = new Date();
    const currentHour = now.getUTCHours();
    const currentMinute = now.getUTCMinutes();
    const currentDay = now.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
    
    console.log(`[Autopilot] Starting scheduler run at ${now.toISOString()}`);
    console.log(`[Autopilot] Current time: ${currentHour}:${currentMinute}, day: ${currentDay}`);
    
    // 1. Récupérer toutes les règles actives
    const { data: rules, error: rulesError } = await supabase
      .from('jarvis_autopilot_rules')
      .select('*')
      .eq('is_active', true);
    
    if (rulesError) {
      console.error('[Autopilot] Error fetching rules:', rulesError);
      throw rulesError;
    }
    
    if (!rules || rules.length === 0) {
      console.log('[Autopilot] No active rules found');
      return new Response(JSON.stringify({
        success: true,
        message: 'No active rules to execute',
        rules_evaluated: 0,
        executions: [],
        duration_ms: Date.now() - startTime,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log(`[Autopilot] Found ${rules.length} active rules`);
    
    const executionResults: ExecutionResult[] = [];
    
    // 2. Évaluer chaque règle
    for (const rule of rules as AutopilotRule[]) {
      let shouldExecute = false;
      const ruleStartTime = Date.now();
      
      try {
        // Évaluer les conditions de déclenchement
        switch (rule.trigger_type) {
          case 'schedule': {
            // Format trigger_config: { hour: 9, minute: 0, days: [1,2,3,4,5] }
            const schedule = rule.trigger_config;
            const hourMatch = schedule.hour === currentHour;
            const minuteMatch = Math.abs((schedule.minute || 0) - currentMinute) < 5; // Tolérance 5 min
            const dayMatch = !schedule.days || schedule.days.length === 0 || schedule.days.includes(currentDay);
            
            shouldExecute = hourMatch && minuteMatch && dayMatch;
            
            if (shouldExecute) {
              console.log(`[Autopilot] Rule "${rule.name}" matches schedule trigger`);
            }
            break;
          }
          
          case 'interval': {
            // Format trigger_config: { intervalMinutes: 60 }
            const intervalMs = (rule.trigger_config.intervalMinutes || 60) * 60 * 1000;
            const lastExec = rule.last_executed_at ? new Date(rule.last_executed_at) : null;
            
            if (!lastExec) {
              shouldExecute = true; // Never executed, run now
            } else {
              const elapsed = now.getTime() - lastExec.getTime();
              shouldExecute = elapsed >= intervalMs;
            }
            
            if (shouldExecute) {
              console.log(`[Autopilot] Rule "${rule.name}" matches interval trigger`);
            }
            break;
          }
          
          case 'data_condition': {
            // Format trigger_config: { conditionType: 'prospect_inactive_days', conditionParams: { days: 7 }, checkIntervalMinutes: 60 }
            const config = rule.trigger_config;
            const checkIntervalMs = (config.checkIntervalMinutes || 60) * 60 * 1000;
            const lastExec = rule.last_executed_at ? new Date(rule.last_executed_at) : null;
            
            // Only check condition if enough time has passed since last check
            const shouldCheck = !lastExec || (now.getTime() - lastExec.getTime() >= checkIntervalMs);
            
            if (shouldCheck && config.conditionType) {
              console.log(`[Autopilot] Evaluating data condition for rule "${rule.name}": ${config.conditionType}`);
              
              // Call the evaluate_jarvis_condition function
              const { data: conditionResult, error: conditionError } = await supabase.rpc(
                'evaluate_jarvis_condition',
                {
                  p_condition_type: config.conditionType,
                  p_user_id: rule.user_id,
                  p_params: config.conditionParams || {}
                }
              );
              
              if (conditionError) {
                console.error(`[Autopilot] Error evaluating condition for "${rule.name}":`, conditionError);
              } else if (conditionResult && conditionResult.length > 0) {
                const result = conditionResult[0];
                shouldExecute = result.condition_met === true;
                
                if (shouldExecute) {
                  console.log(`[Autopilot] Rule "${rule.name}" condition MET:`, {
                    currentValue: result.current_value,
                    threshold: result.threshold_value,
                    details: result.details
                  });
                  
                  // Add condition details to action_params for context
                  rule.action_params = {
                    ...(rule.action_params || {}),
                    _condition_result: {
                      current_value: result.current_value,
                      threshold_value: result.threshold_value,
                      details: result.details
                    }
                  };
                } else {
                  console.log(`[Autopilot] Rule "${rule.name}" condition NOT met (${result.current_value} vs threshold ${result.threshold_value})`);
                }
              }
            }
            break;
          }
          
          case 'event':
            // Event triggers are handled by PostgreSQL triggers, not this scheduler
            shouldExecute = false;
            break;
        }
        
        // 3. Exécuter la règle si les conditions sont remplies
        if (shouldExecute) {
          console.log(`[Autopilot] Executing rule: ${rule.name} (${rule.id})`);
          
          try {
            // Invoke jarvis-brain with the autopilot command
            const { data: brainResponse, error: brainError } = await supabase.functions.invoke('jarvis-brain', {
              body: {
                user_id: rule.user_id,
                message: rule.action_command,
                autonomous_mode: true,
                autopilot_execution: true,
                autopilot_rule_id: rule.id,
                action_params: rule.action_params,
              },
            });
            
            if (brainError) {
              throw brainError;
            }
            
            // Log successful execution
            await supabase.from('jarvis_autopilot_executions').insert({
              rule_id: rule.id,
              executed_at: now.toISOString(),
              success: true,
              result: brainResponse,
              execution_time_ms: Date.now() - ruleStartTime,
            });
            
            // Update rule's last_executed_at and increment counter
            await supabase
              .from('jarvis_autopilot_rules')
              .update({
                last_executed_at: now.toISOString(),
                execution_count: (rule.execution_count || 0) + 1,
              })
              .eq('id', rule.id);
            
            executionResults.push({
              rule_id: rule.id,
              rule_name: rule.name,
              success: true,
              execution_time_ms: Date.now() - ruleStartTime,
              result: brainResponse,
            });
            
            console.log(`[Autopilot] Rule "${rule.name}" executed successfully`);
            
          } catch (execError: unknown) {
            const errorMessage = execError instanceof Error ? execError.message : 'Unknown error';
            console.error(`[Autopilot] Rule "${rule.name}" execution failed:`, errorMessage);
            
            // Log failed execution
            await supabase.from('jarvis_autopilot_executions').insert({
              rule_id: rule.id,
              executed_at: now.toISOString(),
              success: false,
              error_message: errorMessage,
              execution_time_ms: Date.now() - ruleStartTime,
            });
            
            executionResults.push({
              rule_id: rule.id,
              rule_name: rule.name,
              success: false,
              execution_time_ms: Date.now() - ruleStartTime,
              error: errorMessage,
            });
          }
        }
        
      } catch (evalError) {
        console.error(`[Autopilot] Error evaluating rule "${rule.name}":`, evalError);
        executionResults.push({
          rule_id: rule.id,
          rule_name: rule.name,
          success: false,
          execution_time_ms: Date.now() - ruleStartTime,
          error: evalError instanceof Error ? evalError.message : 'Evaluation error',
        });
      }
    }
    
    const totalDuration = Date.now() - startTime;
    console.log(`[Autopilot] Scheduler run completed in ${totalDuration}ms`);
    console.log(`[Autopilot] Evaluated ${rules.length} rules, executed ${executionResults.length}`);

    return new Response(JSON.stringify({
      success: true,
      rules_evaluated: rules.length,
      executions: executionResults,
      duration_ms: totalDuration,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    return buildErrorResponse('jarvis-autopilot-scheduler', error, corsHeaders, 500);
  }
});

