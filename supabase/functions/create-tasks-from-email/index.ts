import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://gestion-marque-ia.apercu.example.org",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-function-secret",
};

// Input validation schema
const NewTaskNeededSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(2000),
  priority: z.enum(['basse', 'moyenne', 'haute']),
  category: z.string().max(100),
  deadline_days: z.number().int().min(0).max(365),
});

const CreateTasksRequestSchema = z.object({
  thread_id: z.string().uuid(),
  etablissement_id: z.string().uuid().optional(),
  partenaire_id: z.string().uuid().optional(),
  new_tasks_needed: z.array(NewTaskNeededSchema).max(20),
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
    const validationResult = CreateTasksRequestSchema.safeParse(body);
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

    const { thread_id, etablissement_id, partenaire_id, new_tasks_needed } = validationResult.data;

    console.log(`Creating ${new_tasks_needed.length} new tasks for ${etablissement_id ? 'establishment' : 'partenaire'} ${etablissement_id || partenaire_id}`);

    // Get entity info
    let responsable_id = null;
    
    if (etablissement_id) {
      const { data: etablissement, error: etabError } = await supabase
        .from('etablissements')
        .select('commercial_id, chef_projet_id, csm_id')
        .eq('id', etablissement_id)
        .single();

      if (etabError) {
        throw new Error(`Failed to fetch establishment: ${etabError.message}`);
      }
      
      // Assign based on category for etablissements
      responsable_id = etablissement.commercial_id;
    } else if (partenaire_id) {
      const { data: partenaire, error: partError } = await supabase
        .from('partenaires')
        .select('responsable_marque_id')
        .eq('id', partenaire_id)
        .single();

      if (partError) {
        throw new Error(`Failed to fetch partenaire: ${partError.message}`);
      }
      
      responsable_id = partenaire.responsable_marque_id;
    }

    const createdTasks = [];

    for (const taskNeeded of new_tasks_needed) {
      // Find or create category
      let { data: category, error: catError } = await supabase
        .from('categories_taches')
        .select('id')
        .eq('nom', taskNeeded.category)
        .single();

      if (catError || !category) {
        // Create new category if not found
        const { data: newCategory, error: createCatError } = await supabase
          .from('categories_taches')
          .insert({ nom: taskNeeded.category, description: `Catégorie créée automatiquement depuis email` })
          .select('id')
          .single();

        if (createCatError) {
          console.error("Error creating category:", createCatError);
          continue;
        }
        category = newCategory;
      }

      // Assign responsable - already set above based on entity type

      // Calculate deadline
      const echeance = taskNeeded.deadline_days > 0
        ? new Date(Date.now() + taskNeeded.deadline_days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        : null;

      // Create task
      const taskData: any = {
        categorie_id: category.id,
        titre: taskNeeded.title,
        description: taskNeeded.description,
        priorite: taskNeeded.priority,
        responsable_id,
        echeance,
        statut: 'A faire',
        niveau_tache: etablissement_id ? 'etablissement' : 'partenaire',
        notes: `Créée automatiquement depuis email (thread ${thread_id})`
      };
      
      if (etablissement_id) {
        taskData.etablissement_id = etablissement_id;
      } else {
        taskData.partenaire_id = partenaire_id;
      }
      
      const { data: newTask, error: taskError } = await supabase
        .from('taches')
        .insert(taskData)
        .select('id, titre')
        .single();

      if (taskError) {
        console.error("Error creating task:", taskError);
      } else {
        console.log(`Task "${newTask.titre}" created`);
        createdTasks.push({
          task_id: newTask.id,
          title: newTask.titre,
          category: taskNeeded.category,
          priority: taskNeeded.priority
        });
      }
    }

    // Log AI action
    await supabase.from('ai_processing_log').insert({
      thread_id,
      action_type: 'task_creation_from_needs',
      model_used: 'azure-openai',
      success: true,
      metadata: {
        etablissement_id: etablissement_id || null,
        partenaire_id: partenaire_id || null,
        entity_type: etablissement_id ? 'etablissement' : 'partenaire',
        tasks_needed: new_tasks_needed.length,
        tasks_created: createdTasks.length,
        timestamp: new Date().toISOString()
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        tasks_created: createdTasks.length,
        details: createdTasks
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    return buildErrorResponse('create-tasks-from-email', error, corsHeaders, 500);
  }
});