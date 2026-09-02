/**
 * JARVIS Background Worker
 *
 * Exécute les jobs en arrière-plan de manière asynchrone.
 * - Récupère les jobs de la queue
 * - Exécute les actions via jarvis-execute
 * - Envoie des notifications push à la complétion
 * - Gère les retries en cas d'échec
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { validateServiceOrUser } from '../_shared/auth-helpers.ts'
import { buildErrorResponse } from '../_shared/error-sanitizer.ts'

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type

interface WorkerRequest {
  job_id?: string // Execute specific job
  process_queue?: boolean // Process all queued jobs
  user_id?: string // For auth context
}

interface BackgroundJob {
  id: string
  user_id: string
  action_type: string
  action_data: Record<string, unknown>
  status: string
  progress: number
  retry_count: number
  max_retries: number
}

// `ReturnType<typeof createClient>` resolves generic defaults to `never` under
// Deno's checker. Use the package's standard client defaults for worker helpers.
type WorkerSupabaseClient = SupabaseClient

export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const startTime = Date.now()

  try {
    const auth = await validateServiceOrUser(req)
    if (!auth.authorized || !auth.isServiceCall) {
      // Background worker is service/cron only
      return new Response(JSON.stringify({ error: 'Service-only endpoint' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const request: WorkerRequest = await req.json()

    // Initialize Supabase with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    })

    let processedJobs = 0
    let successCount = 0
    let failCount = 0

    // Process specific job or queue
    if (request.job_id) {
      // Execute single job
      const result = await processJob(supabase, supabaseUrl, supabaseKey, request.job_id)
      processedJobs = 1
      if (result.success) successCount++
      else failCount++
    } else if (request.process_queue) {
      // Process all queued jobs (batch)
      const { data: queuedJobs, error } = await supabase
        .from('jarvis_background_jobs')
        .select('id')
        .eq('status', 'queued')
        .order('created_at', { ascending: true })
        .limit(10) // Process max 10 at a time

      if (error) throw error

      for (const job of queuedJobs || []) {
        const result = await processJob(supabase, supabaseUrl, supabaseKey, job.id)
        processedJobs++
        if (result.success) successCount++
        else failCount++
      }
    }

    const processingTime = Date.now() - startTime
    console.log(
      `[JARVIS Worker] Processed ${processedJobs} jobs in ${processingTime}ms (${successCount} success, ${failCount} failed)`
    )

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedJobs,
        success_count: successCount,
        fail_count: failCount,
        processing_time_ms: processingTime,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[JARVIS Worker] Error:', errorMessage)

    return buildErrorResponse('jarvis-background-worker', error, corsHeaders, 500)
  }
}

serve(handler)

async function processJob(
  supabase: WorkerSupabaseClient,
  supabaseUrl: string,
  supabaseKey: string,
  jobId: string
): Promise<{ success: boolean; error?: string }> {
  console.log(`[JARVIS Worker] Processing job: ${jobId}`)

  // Fetch the job
  const { data: job, error: fetchError } = await supabase
    .from('jarvis_background_jobs')
    .select('*')
    .eq('id', jobId)
    .single()

  if (fetchError || !job) {
    console.error(`[JARVIS Worker] Job not found: ${jobId}`)
    return { success: false, error: 'Job not found' }
  }

  const typedJob = job as unknown as BackgroundJob

  // Skip if not queued
  if (typedJob.status !== 'queued') {
    console.log(`[JARVIS Worker] Job ${jobId} already processed (status: ${typedJob.status})`)
    return { success: true }
  }

  // Mark as processing
  await supabase
    .from('jarvis_background_jobs')
    .update({
      status: 'processing',
      started_at: new Date().toISOString(),
      progress: 10,
    })
    .eq('id', jobId)

  try {
    // Execute the action based on type
    const result = await executeBackgroundAction(supabase, supabaseUrl, supabaseKey, typedJob)

    // Update progress
    await supabase.from('jarvis_background_jobs').update({ progress: 90 }).eq('id', jobId)

    // Mark as completed
    await supabase
      .from('jarvis_background_jobs')
      .update({
        status: 'completed',
        result,
        progress: 100,
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId)

    // Also mark the action context as completed if exists
    await supabase
      .from('jarvis_action_context')
      .update({ status: 'completed' })
      .eq('user_id', typedJob.user_id)
      .eq('action_type', typedJob.action_type)
      .in('status', ['in_progress', 'paused'])

    // Send completion notification
    await sendCompletionNotification(supabase, supabaseUrl, supabaseKey, typedJob, result)

    console.log(`[JARVIS Worker] Job ${jobId} completed successfully`)
    return { success: true }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Execution failed'
    console.error(`[JARVIS Worker] Job ${jobId} failed:`, errorMessage)

    // Check retry count
    if (typedJob.retry_count < typedJob.max_retries) {
      // Queue for retry
      await supabase
        .from('jarvis_background_jobs')
        .update({
          status: 'queued',
          retry_count: typedJob.retry_count + 1,
          error_message: errorMessage,
          progress: 0,
        })
        .eq('id', jobId)
    } else {
      // Mark as failed
      await supabase
        .from('jarvis_background_jobs')
        .update({
          status: 'failed',
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId)

      // Mark action context as failed
      await supabase
        .from('jarvis_action_context')
        .update({ status: 'failed' })
        .eq('user_id', typedJob.user_id)
        .eq('action_type', typedJob.action_type)

      // Send failure notification
      await sendFailureNotification(supabase, supabaseUrl, supabaseKey, typedJob, errorMessage)
    }

    return { success: false, error: errorMessage }
  }
}

async function executeBackgroundAction(
  supabase: WorkerSupabaseClient,
  supabaseUrl: string,
  supabaseKey: string,
  job: BackgroundJob
): Promise<Record<string, unknown>> {
  const { action_type, action_data, user_id } = job

  // Call jarvis-execute with the action data
  const response = await fetch(`${supabaseUrl}/functions/v1/jarvis-execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({
      action_id: job.id,
      user_id: user_id,
      // Simulate pending action structure for jarvis-execute
      direct_execution: true,
      action_type: action_type,
      action_data: action_data,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Execution failed: ${errorText}`)
  }

  return await response.json()
}

async function sendCompletionNotification(
  supabase: WorkerSupabaseClient,
  supabaseUrl: string,
  supabaseKey: string,
  job: BackgroundJob,
  result: Record<string, unknown>
): Promise<void> {
  try {
    // Get user's push subscriptions
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_id', job.user_id)

    if (!subscriptions?.length) return

    const actionLabel = getActionLabel(job.action_type)

    // Send push notification via edge function
    await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        user_id: job.user_id,
        title: '✅ JARVIS - Action terminée',
        body: actionLabel,
        data: {
          type: 'jarvis_job_completed',
          job_id: job.id,
          action_type: job.action_type,
        },
      }),
    })

    console.log(`[JARVIS Worker] Notification sent for job ${job.id}`)
  } catch (error) {
    console.error('[JARVIS Worker] Failed to send notification:', error)
  }
}

async function sendFailureNotification(
  supabase: WorkerSupabaseClient,
  supabaseUrl: string,
  supabaseKey: string,
  job: BackgroundJob,
  errorMessage: string
): Promise<void> {
  try {
    await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        user_id: job.user_id,
        title: '❌ JARVIS - Échec',
        body: `L'action ${job.action_type} a échoué: ${errorMessage.substring(0, 50)}`,
        data: {
          type: 'jarvis_job_failed',
          job_id: job.id,
          error: errorMessage,
        },
      }),
    })
  } catch (error) {
    console.error('[JARVIS Worker] Failed to send failure notification:', error)
  }
}

function getActionLabel(actionType: string): string {
  const labels: Record<string, string> = {
    send_email: 'Email envoyé avec succès',
    create_task: 'Tâche créée avec succès',
    update_status: 'Statut mis à jour',
    close_ticket: 'Ticket clôturé',
    schedule_meeting: 'Réunion planifiée',
  }
  return labels[actionType] || `Action "${actionType}" terminée`
}
