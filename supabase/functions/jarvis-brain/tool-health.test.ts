import {
  assertEquals,
  assertExists,
  assertThrows,
  assertRejects,
} from 'https://deno.land/std@0.224.0/assert/mod.ts'
import {
  TOOL_TIMEOUTS,
  getToolTimeout,
  getToolHealth,
  recordToolExecution,
  isToolAvailable,
  getAllToolHealth,
  forceEnableTool,
  getUnhealthyTools,
  executeToolWithHealth,
} from './tool-health.ts'

function uniqueToolName(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

Deno.test('getToolTimeout returns specific timeout for known tools', () => {
  assertEquals(getToolTimeout('query_database'), 10000)
  assertEquals(getToolTimeout('send_email'), 30000)
  assertEquals(getToolTimeout('batch_send_emails'), 60000)
})

Deno.test('getToolTimeout returns default timeout for unknown tool', () => {
  const unknown = uniqueToolName('unknown-timeout')
  assertEquals(getToolTimeout(unknown), TOOL_TIMEOUTS.default)
  assertEquals(getToolTimeout('totally_nonexistent_tool'), 20000)
})

Deno.test('getToolHealth initializes default metrics for a new tool', () => {
  const tool = uniqueToolName('init-health')
  const metrics = getToolHealth(tool)

  assertEquals(metrics.totalCalls, 0)
  assertEquals(metrics.successCount, 0)
  assertEquals(metrics.failureCount, 0)
  assertEquals(metrics.avgLatencyMs, 0)
  assertEquals(metrics.p95LatencyMs, 0)
  assertEquals(metrics.lastCallTime, null)
  assertEquals(metrics.lastErrorTime, null)
  assertEquals(metrics.lastError, null)
  assertEquals(metrics.healthScore, 100)
  assertEquals(metrics.isDisabled, false)
  assertEquals(metrics.disabledReason, null)
  assertEquals(metrics.disabledUntil, null)
})

Deno.test('getToolHealth returns same underlying metrics object for same tool', () => {
  const tool = uniqueToolName('same-ref')
  const first = getToolHealth(tool)
  const second = getToolHealth(tool)

  assertEquals(first, second)
})

Deno.test('recordToolExecution updates success counters and latency stats', () => {
  const tool = uniqueToolName('record-success')

  recordToolExecution(tool, true, 100)
  recordToolExecution(tool, true, 200)
  recordToolExecution(tool, true, 300)

  const metrics = getToolHealth(tool)

  assertEquals(metrics.totalCalls, 3)
  assertEquals(metrics.successCount, 3)
  assertEquals(metrics.failureCount, 0)
  assertEquals(metrics.avgLatencyMs, 200)
  assertEquals(metrics.p95LatencyMs, 300)
  assertExists(metrics.lastCallTime)
  assertEquals(metrics.lastErrorTime, null)
  assertEquals(metrics.lastError, null)
  assertEquals(metrics.healthScore, 100)
  assertEquals(metrics.isDisabled, false)
})

Deno.test('recordToolExecution updates failure details on error', () => {
  const tool = uniqueToolName('record-failure')

  recordToolExecution(tool, false, 450, 'Service unavailable')
  const metrics = getToolHealth(tool)

  assertEquals(metrics.totalCalls, 1)
  assertEquals(metrics.successCount, 0)
  assertEquals(metrics.failureCount, 1)
  assertEquals(metrics.avgLatencyMs, 450)
  assertEquals(metrics.p95LatencyMs, 450)
  assertExists(metrics.lastCallTime)
  assertExists(metrics.lastErrorTime)
  assertEquals(metrics.lastError, 'Service unavailable')
  assertEquals(metrics.healthScore, 40)
})

Deno.test('recordToolExecution uses default error message when none is provided', () => {
  const tool = uniqueToolName('default-error')

  recordToolExecution(tool, false, 123)

  const metrics = getToolHealth(tool)
  assertEquals(metrics.lastError, 'Unknown error')
  assertExists(metrics.lastErrorTime)
})

Deno.test(
  'health score applies latency penalty when average latency is elevated but below max threshold',
  () => {
    const tool = uniqueToolName('latency-penalty')

    recordToolExecution(tool, true, 3000)

    const metrics = getToolHealth(tool)
    assertEquals(metrics.successCount, 1)
    assertEquals(metrics.avgLatencyMs, 3000)
    assertEquals(metrics.healthScore, 92)
  }
)

Deno.test('health score drops with very high latency above threshold', () => {
  const tool = uniqueToolName('high-latency')

  recordToolExecution(tool, true, 10000)

  const metrics = getToolHealth(tool)
  assertEquals(metrics.avgLatencyMs, 10000)
  assertEquals(metrics.healthScore, 80)
})

Deno.test('tool is disabled after 5 consecutive failures and becomes unavailable', () => {
  const tool = uniqueToolName('disable-consecutive')

  for (let i = 0; i < 5; i++) {
    recordToolExecution(tool, false, 100, `failure-${i}`)
  }

  const metrics = getToolHealth(tool)
  assertEquals(metrics.totalCalls, 5)
  assertEquals(metrics.failureCount, 5)
  assertEquals(metrics.isDisabled, true)
  assertEquals(metrics.disabledReason, '5 consecutive failures')
  assertExists(metrics.disabledUntil)

  const availability = isToolAvailable(tool)
  assertEquals(availability.available, false)
  assertExists(availability.reason)
})

Deno.test(
  'tool can be disabled for very low success rate after at least 10 calls without 5 consecutive final failures',
  () => {
    const tool = uniqueToolName('disable-low-success')

    const pattern = [false, true, false, true, false, false, false, true, false, false]
    for (let i = 0; i < pattern.length; i++) {
      recordToolExecution(tool, pattern[i], 100, pattern[i] ? undefined : `err-${i}`)
    }

    const metrics = getToolHealth(tool)
    assertEquals(metrics.totalCalls, 10)
    assertEquals(metrics.successCount, 3)
    assertEquals(metrics.failureCount, 7)
    assertEquals(metrics.isDisabled, true)
    assertEquals(metrics.disabledReason, 'Very low success rate: 30%')
    assertExists(metrics.disabledUntil)
  }
)

Deno.test('isToolAvailable returns available true for healthy tool', () => {
  const tool = uniqueToolName('available-healthy')

  recordToolExecution(tool, true, 50)

  const availability = isToolAvailable(tool)
  assertEquals(availability.available, true)
  assertEquals(availability.reason, undefined)
})

Deno.test('getAllToolHealth returns shallow copies of metrics, not live references', () => {
  const tool = uniqueToolName('all-health-copy')
  recordToolExecution(tool, true, 120)

  const snapshot = getAllToolHealth()
  assertExists(snapshot[tool])
  assertEquals(snapshot[tool].totalCalls, 1)

  snapshot[tool].totalCalls = 999

  const fresh = getToolHealth(tool)
  assertEquals(fresh.totalCalls, 1)
})

Deno.test('forceEnableTool re-enables a disabled tool and clears disable metadata', () => {
  const tool = uniqueToolName('force-enable')

  for (let i = 0; i < 5; i++) {
    recordToolExecution(tool, false, 100, `boom-${i}`)
  }

  let metrics = getToolHealth(tool)
  assertEquals(metrics.isDisabled, true)
  assertExists(metrics.disabledUntil)

  forceEnableTool(tool)

  metrics = getToolHealth(tool)
  assertEquals(metrics.isDisabled, false)
  assertEquals(metrics.disabledReason, null)
  assertEquals(metrics.disabledUntil, null)

  const availability = isToolAvailable(tool)
  assertEquals(availability.available, true)
})

Deno.test('getUnhealthyTools includes tools with low health score and disabled tools', () => {
  const lowScoreTool = uniqueToolName('unhealthy-score')
  const disabledTool = uniqueToolName('unhealthy-disabled')
  const healthyTool = uniqueToolName('healthy-ok')

  recordToolExecution(lowScoreTool, false, 1000, 'bad')
  for (let i = 0; i < 5; i++) {
    recordToolExecution(disabledTool, false, 100, `fail-${i}`)
  }
  recordToolExecution(healthyTool, true, 100)

  const unhealthy = getUnhealthyTools()

  assertEquals(unhealthy.includes(lowScoreTool), true)
  assertEquals(unhealthy.includes(disabledTool), true)
  assertEquals(unhealthy.includes(healthyTool), false)
})

Deno.test('executeToolWithHealth returns success result and records execution', async () => {
  const tool = uniqueToolName('execute-success')

  const result = await executeToolWithHealth(tool, () =>
    Promise.resolve({ message: 'ok', count: 42 })
  )

  assertEquals(result.success, true)
  assertEquals(result.data, { message: 'ok', count: 42 })
  assertEquals(typeof result.latencyMs, 'number')
  assertEquals(result.latencyMs >= 0, true)
  assertEquals(result.error, undefined)

  const metrics = getToolHealth(tool)
  assertEquals(metrics.totalCalls, 1)
  assertEquals(metrics.successCount, 1)
  assertEquals(metrics.failureCount, 0)
})

Deno.test('executeToolWithHealth captures thrown Error message and records failure', async () => {
  const tool = uniqueToolName('execute-error')

  const result = await executeToolWithHealth(tool, () =>
    Promise.reject(new Error('executor failed'))
  )

  assertEquals(result.success, false)
  assertEquals(result.error, 'executor failed')
  assertEquals(typeof result.latencyMs, 'number')
  assertEquals(result.latencyMs >= 0, true)

  const metrics = getToolHealth(tool)
  assertEquals(metrics.totalCalls, 1)
  assertEquals(metrics.successCount, 0)
  assertEquals(metrics.failureCount, 1)
  assertEquals(metrics.lastError, 'executor failed')
})

Deno.test('executeToolWithHealth handles non-Error thrown values as Unknown error', async () => {
  const tool = uniqueToolName('execute-non-error')

  const result = await executeToolWithHealth(tool, () => Promise.reject('plain-string-failure'))

  assertEquals(result.success, false)
  assertEquals(result.error, 'Unknown error')

  const metrics = getToolHealth(tool)
  assertEquals(metrics.failureCount, 1)
  assertEquals(metrics.lastError, 'Unknown error')
})

Deno.test('executeToolWithHealth short-circuits when tool is disabled', async () => {
  const tool = uniqueToolName('execute-disabled')

  for (let i = 0; i < 5; i++) {
    recordToolExecution(tool, false, 100, `disable-${i}`)
  }

  let executed = false
  const result = await executeToolWithHealth(tool, async () => {
    executed = true
    return 'should-not-run'
  })

  assertEquals(executed, false)
  assertEquals(result.success, false)
  assertExists(result.error)
  assertEquals(result.error!.includes(`Tool ${tool} is temporarily disabled`), true)

  const metrics = getToolHealth(tool)
  assertEquals(metrics.totalCalls, 5)
})

Deno.test('disabled tool is automatically re-enabled after cooldown on next record attempt', () => {
  const tool = uniqueToolName('auto-reenable')
  const originalNow = Date.now

  try {
    let now = 1_000_000
    Date.now = () => now

    for (let i = 0; i < 5; i++) {
      recordToolExecution(tool, false, 100, `f-${i}`)
    }

    let metrics = getToolHealth(tool)
    assertEquals(metrics.isDisabled, true)
    const disabledUntil = metrics.disabledUntil!
    assertExists(disabledUntil)

    now = disabledUntil + 1
    recordToolExecution(tool, true, 100)

    metrics = getToolHealth(tool)
    assertEquals(metrics.isDisabled, false)
    assertEquals(metrics.disabledReason, null)
    assertEquals(metrics.disabledUntil, null)
  } finally {
    Date.now = originalNow
  }
})

Deno.test('recent windows are capped at 50 executions for health calculations', () => {
  const tool = uniqueToolName('recent-window')

  for (let i = 1; i <= 60; i++) {
    recordToolExecution(tool, true, i)
  }

  const metrics = getToolHealth(tool)

  assertEquals(metrics.totalCalls, 60)
  assertEquals(metrics.successCount, 60)
  assertEquals(metrics.failureCount, 0)
  assertEquals(metrics.avgLatencyMs, 35.5)
  assertEquals(metrics.p95LatencyMs, 58)
  assertEquals(metrics.healthScore, 100)
})

Deno.test('assert std imports are available and usable', async () => {
  assertThrows(() => {
    throw new Error('boom')
  })

  await assertRejects(async () => {
    throw new Error('async boom')
  })
})
