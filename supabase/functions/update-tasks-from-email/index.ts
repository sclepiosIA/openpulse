import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "https://gestion-marque-ia.apercu.example.org",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-function-secret",
};

// Input validation schema
const CompletedTaskSchema = z.object({
  task_category: z.string().max(100),
  task_title: z.string().min(1).max(500),
  confidence: z.number().min(0).max(1),
});

const UpdateTasksRequestSchema = z.object({
  thread_id: z.string().uuid(),
  etablissement_id: z.string().uuid().optional(),
  partenaire_id: z.string().uuid().optional(),
  completed_tasks: z.array(CompletedTaskSchema).max(50),
}).refine(
  data => (data.etablissement_id && !data.partenaire_id) || (!data.etablissement_id && data.partenaire_id),
  { message: "Exactly one of etablissement_id or partenaire_id must be provided" }
);

// Simple rate limiting (in-memory)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100;

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(identifier, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  record.count++;
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SECURITY: Validate internal function secret
    const requestSecret = req.headers.get("x-function-secret");
    const expectedSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET");
    
    if (!requestSecret || requestSecret !== expectedSecret) {
      console.error("Unauthorized: Invalid function secret");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SECURITY: Rate limiting
    const clientIp = req.headers.get("x-forwarded-for") || "unknown";
    if (!checkRateLimit(clientIp)) {
      console.warn(`Rate limit exceeded for IP: ${clientIp}`);
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceRoleKey
    );

    const body = await req.json();

    // SECURITY: Validate input with Zod
    const validationResult = UpdateTasksRequestSchema.safeParse(body);
    if (!validationResult.success) {
      console.error("Validation error:", validationResult.error);
      return new Response(
        JSON.stringify({ 
          error: "Invalid input", 
          details: validationResult.error.errors 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { thread_id, etablissement_id, partenaire_id, completed_tasks } = validationResult.data;

    console.log(`Processing ${completed_tasks.length} completed tasks for ${etablissement_id ? 'establishment' : 'partenaire'} ${etablissement_id || partenaire_id}`);

    const updatedTasks = [];

    for (const completedTask of completed_tasks) {
      // Only update tasks with high confidence (>= 0.7)
      if (completedTask.confidence < 0.7) {
        console.log(`Skipping task "${completedTask.task_title}" - confidence too low (${completedTask.confidence})`);
        continue;
      }

      // Find matching task
      let queryBuilder = supabase
        .from('taches')
        .select('id, titre, statut, categorie_id, categories_taches(nom)')
        .neq('statut', 'Terminé')
        .ilike('titre', `%${completedTask.task_title}%`);
      
      if (etablissement_id) {
        queryBuilder = queryBuilder.eq('etablissement_id', etablissement_id);
      } else if (partenaire_id) {
        queryBuilder = queryBuilder.eq('partenaire_id', partenaire_id);
      }
      
      const { data: tasks, error: tasksError } = await queryBuilder;

      if (tasksError) {
        console.error("Error fetching tasks:", tasksError);
        continue;
      }

      // Filter by category if specified
      const matchingTask = tasks?.find(t => 
        !completedTask.task_category || 
        (t.categories_taches as any)?.nom === completedTask.task_category
      );

      if (matchingTask) {
        const { error: updateError } = await supabase
          .from('taches')
          .update({
            statut: 'Terminé',
            date_realisation: new Date().toISOString().split('T')[0],
            updated_at: new Date().toISOString()
          })
          .eq('id', matchingTask.id);

        if (updateError) {
          console.error(`Error updating task ${matchingTask.id}:`, updateError);
        } else {
          console.log(`Task "${matchingTask.titre}" marked as completed`);
          updatedTasks.push({
            task_id: matchingTask.id,
            title: matchingTask.titre,
            confidence: completedTask.confidence
          });
        }
      }
    }

    // Log AI action
    await supabase.from('ai_processing_log').insert({
      thread_id,
      action_type: 'task_completion_detection',
      model_used: 'azure-openai',
      success: true,
      metadata: {
        etablissement_id: etablissement_id || null,
        partenaire_id: partenaire_id || null,
        entity_type: etablissement_id ? 'etablissement' : 'partenaire',
        tasks_detected: completed_tasks.length,
        tasks_updated: updatedTasks.length,
        timestamp: new Date().toISOString()
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        tasks_updated: updatedTasks.length,
        details: updatedTasks
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    return buildErrorResponse('update-tasks-from-email', error, corsHeaders, 500);
  }

});