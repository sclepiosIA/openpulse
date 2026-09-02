/**
 * JARVIS 10.0 - Tool Health Scoring & Timeouts
 *
 * Tracks tool performance and provides:
 * - Per-tool timeout configuration
 * - Health scoring based on success rate and latency
 * - Automatic tool disabling when unhealthy
 */

export interface ToolHealthMetrics {
  totalCalls: number
  successCount: number
  failureCount: number
  avgLatencyMs: number
  p95LatencyMs: number
  lastCallTime: number | null
  lastErrorTime: number | null
  lastError: string | null
  healthScore: number // 0-100
  isDisabled: boolean
  disabledReason: string | null
  disabledUntil: number | null
}

interface ToolHealthEntry {
  metrics: ToolHealthMetrics
  recentLatencies: number[]
  recentResults: boolean[]
}

// Per-tool timeout configuration (ms)
export const TOOL_TIMEOUTS: Record<string, number> = {
  // Fast tools (local/simple operations)
  query_database: 10000,
  create_task: 5000,
  update_entity_status: 5000,
  manage_memory: 3000,
  get_user_info: 3000,
  manage_user: 5000,
  manage_user_role: 5000,

  // Medium tools (some processing)
  schedule_meeting: 15000,
  create_calendar_event: 15000,
  detect_calendar_conflicts: 10000,
  manage_epic: 10000,
  manage_user_story: 10000,
  manage_sprint: 10000,
  create_support_ticket: 10000,
  manage_job_offer: 10000,
  manage_candidate: 10000,

  // Slow tools (external APIs)
  send_email: 30000,
  sync_qonto_transactions: 45000,
  sync_external_calendar: 30000,
  import_ics_calendar: 30000,
  web_search: 20000,

  // AI-heavy tools (may call Azure)
  translate_email: 25000,
  correct_email: 25000,
  reformulate_email: 25000,
  suggest_email_response: 25000,
  ai_assist_story: 30000,
  ai_assist_contract: 30000,
  summarize_content: 30000,
  analyze_with_ai: 30000,
  extract_data: 25000,
  parse_payslip: 45000,
  parse_cv: 30000,

  // Analytics tools
  get_dashboard_summary: 15000,
  get_daily_digest: 20000,
  get_performance_report: 20000,
  analyze_trends: 25000,
  predict_trend: 20000,
  detect_anomalies: 20000,

  // Batch tools (longer operations)
  batch_send_emails: 60000,
  batch_update_tasks: 30000,
  batch_create_tasks: 30000,
  bulk_email_classification: 60000,
  export_data: 45000,
  export_data_rgpd: 45000,
  generate_report: 45000,

  // File tools
  list_files: 10000,
  search_documents: 15000,
  manage_document: 20000,

  // Default for unlisted tools
  default: 20000,
}

// Health thresholds
const HEALTH_THRESHOLDS = {
  minSuccessRate: 0.7, // Below 70% = unhealthy
  maxAvgLatencyMs: 5000, // Above 5s avg = degraded
  disableAfterFailures: 5, // Disable after 5 consecutive failures
  disableDurationMs: 60000, // Disable for 1 minute
  reEnableThreshold: 0.8, // Re-enable if success rate > 80%
}

// In-memory health tracking
const toolHealth = new Map<string, ToolHealthEntry>()

/**
 * Get timeout for a specific tool
 */
export function getToolTimeout(toolName: string): number {
  return TOOL_TIMEOUTS[toolName] || TOOL_TIMEOUTS.default
}

/**
 * Get or initialize health metrics for a tool
 */
export function getToolHealth(toolName: string): ToolHealthMetrics {
  if (!toolHealth.has(toolName)) {
    toolHealth.set(toolName, {
      metrics: {
        totalCalls: 0,
        successCount: 0,
        failureCount: 0,
        avgLatencyMs: 0,
        p95LatencyMs: 0,
        lastCallTime: null,
        lastErrorTime: null,
        lastError: null,
        healthScore: 100,
        isDisabled: false,
        disabledReason: null,
        disabledUntil: null,
      },
      recentLatencies: [],
      recentResults: [],
    })
  }
  return toolHealth.get(toolName)!.metrics
}

/**
 * Record a tool execution result
 */
export function recordToolExecution(
  toolName: string,
  success: boolean,
  latencyMs: number,
  error?: string
): void {
  if (!toolHealth.has(toolName)) {
    getToolHealth(toolName) // Initialize
  }

  const entry = toolHealth.get(toolName)!
  const metrics = entry.metrics

  // Update basic counts
  metrics.totalCalls++
  if (success) {
    metrics.successCount++
  } else {
    metrics.failureCount++
    metrics.lastErrorTime = Date.now()
    metrics.lastError = error || 'Unknown error'
  }
  metrics.lastCallTime = Date.now()

  // Update recent tracking (keep last 50)
  entry.recentLatencies.push(latencyMs)
  entry.recentResults.push(success)
  if (entry.recentLatencies.length > 50) entry.recentLatencies.shift()
  if (entry.recentResults.length > 50) entry.recentResults.shift()

  // Calculate latency stats
  if (entry.recentLatencies.length > 0) {
    const sorted = [...entry.recentLatencies].sort((a, b) => a - b)
    metrics.avgLatencyMs = sorted.reduce((a, b) => a + b, 0) / sorted.length
    metrics.p95LatencyMs = sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1]
  }

  // Calculate health score
  metrics.healthScore = calculateHealthScore(entry)

  // Check if tool should be disabled
  checkAndUpdateDisabledState(toolName, entry)

  console.log(
    `[ToolHealth] ${toolName}: score=${metrics.healthScore}, success=${success}, latency=${latencyMs}ms`
  )
}

/**
 * Calculate health score (0-100) for a tool
 */
function calculateHealthScore(entry: ToolHealthEntry): number {
  const { metrics, recentResults, recentLatencies } = entry

  if (recentResults.length === 0) return 100

  // Success rate component (60% weight)
  const recentSuccessRate = recentResults.filter((r) => r).length / recentResults.length
  const successScore = recentSuccessRate * 60

  // Latency component (40% weight)
  let latencyScore = 40
  if (recentLatencies.length > 0) {
    const avgLatency = recentLatencies.reduce((a, b) => a + b, 0) / recentLatencies.length
    if (avgLatency > HEALTH_THRESHOLDS.maxAvgLatencyMs) {
      latencyScore = 40 * (HEALTH_THRESHOLDS.maxAvgLatencyMs / avgLatency)
    } else if (avgLatency > HEALTH_THRESHOLDS.maxAvgLatencyMs / 2) {
      latencyScore = 40 * 0.8 // Slight penalty for elevated latency
    }
  }

  return Math.round(Math.max(0, Math.min(100, successScore + latencyScore)))
}

/**
 * Check and update disabled state for a tool
 */
function checkAndUpdateDisabledState(toolName: string, entry: ToolHealthEntry): void {
  const metrics = entry.metrics
  const now = Date.now()

  // Check if currently disabled should be re-enabled
  if (metrics.isDisabled && metrics.disabledUntil) {
    if (now >= metrics.disabledUntil) {
      metrics.isDisabled = false
      metrics.disabledReason = null
      metrics.disabledUntil = null
      console.log(`[ToolHealth] ${toolName}: re-enabled after cooldown`)
    }
    return
  }

  // Check for consecutive failures
  const recentFailures = entry.recentResults.slice(-HEALTH_THRESHOLDS.disableAfterFailures)
  const consecutiveFailures = recentFailures.every((r) => !r)

  if (consecutiveFailures && recentFailures.length >= HEALTH_THRESHOLDS.disableAfterFailures) {
    metrics.isDisabled = true
    metrics.disabledReason = `${HEALTH_THRESHOLDS.disableAfterFailures} consecutive failures`
    metrics.disabledUntil = now + HEALTH_THRESHOLDS.disableDurationMs
    console.log(`[ToolHealth] ${toolName}: DISABLED - ${metrics.disabledReason}`)
    return
  }

  // Check for very low success rate
  if (entry.recentResults.length >= 10) {
    const recentSuccessRate =
      entry.recentResults.filter((r) => r).length / entry.recentResults.length
    if (recentSuccessRate < HEALTH_THRESHOLDS.minSuccessRate * 0.5) {
      // Below 35%
      metrics.isDisabled = true
      metrics.disabledReason = `Very low success rate: ${Math.round(recentSuccessRate * 100)}%`
      metrics.disabledUntil = now + HEALTH_THRESHOLDS.disableDurationMs
      console.log(`[ToolHealth] ${toolName}: DISABLED - ${metrics.disabledReason}`)
    }
  }
}

/**
 * Check if a tool is available for execution
 */
export function isToolAvailable(toolName: string): { available: boolean; reason?: string } {
  const metrics = getToolHealth(toolName)

  if (metrics.isDisabled) {
    const timeUntilReEnable = metrics.disabledUntil
      ? Math.ceil((metrics.disabledUntil - Date.now()) / 1000)
      : 'unknown'
    return {
      available: false,
      reason: `${metrics.disabledReason}. Re-enable in ${timeUntilReEnable}s`,
    }
  }

  return { available: true }
}

/**
 * Get health status for all tools
 */
export function getAllToolHealth(): Record<string, ToolHealthMetrics> {
  const health: Record<string, ToolHealthMetrics> = {}

  toolHealth.forEach((entry, name) => {
    health[name] = { ...entry.metrics }
  })

  return health
}

/**
 * Force re-enable a tool
 */
export function forceEnableTool(toolName: string): void {
  const metrics = getToolHealth(toolName)
  metrics.isDisabled = false
  metrics.disabledReason = null
  metrics.disabledUntil = null
  console.log(`[ToolHealth] ${toolName}: force re-enabled`)
}

/**
 * Get list of unhealthy tools
 */
export function getUnhealthyTools(): string[] {
  const unhealthy: string[] = []

  toolHealth.forEach((entry, name) => {
    if (entry.metrics.healthScore < 50 || entry.metrics.isDisabled) {
      unhealthy.push(name)
    }
  })

  return unhealthy
}

/**
 * Execute a tool with timeout and health tracking
 */
export async function executeToolWithHealth<T>(
  toolName: string,
  executor: () => Promise<T>
): Promise<{ success: boolean; data?: T; error?: string; latencyMs: number }> {
  const timeout = getToolTimeout(toolName)
  const startTime = Date.now()

  // Check if tool is available
  const availability = isToolAvailable(toolName)
  if (!availability.available) {
    return {
      success: false,
      error: `Tool ${toolName} is temporarily disabled: ${availability.reason}`,
      latencyMs: Date.now() - startTime,
    }
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined

  try {
    // Execute with timeout
    const result = await Promise.race([
      executor(),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout)
      }),
    ])

    const latencyMs = Date.now() - startTime
    recordToolExecution(toolName, true, latencyMs)

    return {
      success: true,
      data: result,
      latencyMs,
    }
  } catch (error) {
    const latencyMs = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    recordToolExecution(toolName, false, latencyMs, errorMessage)

    return {
      success: false,
      error: errorMessage,
      latencyMs,
    }
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
    }
  }
}
