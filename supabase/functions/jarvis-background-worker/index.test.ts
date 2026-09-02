import {
  assertEquals,
  assertExists,
  assertThrows,
  assertRejects, assertNotEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'

const INDEX_URL = new URL('./index.ts', import.meta.url)

function replaceProperty(
  target: Record<PropertyKey, unknown>,
  key: PropertyKey,
  value: unknown
): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(target, key)
  Object.defineProperty(target, key, {
    configurable: true,
    writable: true,
    value,
  })

  return () => {
    if (descriptor) {
      Object.defineProperty(target, key, descriptor)
    } else {
      delete target[key]
    }
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs = 2_000): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  const timeout = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('Timed out waiting for worker response'))
    }, timeoutMs)
  })

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId !== undefined) clearTimeout(timeoutId)
  })
}

function extractActionLabels(source: string): Record<string, string> {
  const match = source.match(/const labels:\s*Record<string,\s*string>\s*=\s*\{([\s\S]*?)\};?\n/)
  if (!match) {
    throw new Error('Unable to find labels mapping')
  }

  const labels: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const entry = line.match(/^\s*([a-z_]+):\s*'([^']*)',?\s*$/)
    if (entry) {
      labels[entry[1]] = entry[2]
    }
  }

  return labels
}

async function readIndexSource(): Promise<string> {
  return await Deno.readTextFile(INDEX_URL)
}

Deno.test(
  'OPTIONS request is handled by the exported handler without starting an accept retry',
  async () => {
    const originalFetch = globalThis.fetch
    const request = new Request('http://localhost/jarvis-background-worker', {
      method: 'OPTIONS',
    })
    let listenerCreated = false
    const fakeAddr = {
      transport: 'tcp',
      hostname: '127.0.0.1',
      port: 8000,
    }

    const fakeListener = {
      rid: 1,
      addr: fakeAddr,
      close() {},
      accept() {
        listenerCreated = true
        return new Promise<never>(() => {})
      },
    }

    const restoreFns: Array<() => void> = []

    try {
      globalThis.fetch = () => Promise.reject(new Error('OPTIONS must not fetch'))

      restoreFns.push(
        replaceProperty(
          Deno as unknown as Record<PropertyKey, unknown>,
          'listen',
          () => fakeListener
        )
      )

      const moduleNamespace = await import(`./index.ts?module-load-test=${crypto.randomUUID()}`)
      assertExists(moduleNamespace.handler)
      const handler = moduleNamespace.handler as (request: Request) => Promise<Response>

      const response = await withTimeout(handler(request))
      assertEquals(response.status, 200)
      assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*')
      assertEquals(
        response.headers.get('Access-Control-Allow-Headers'),
        'authorization, x-client-info, apikey, content-type, x-internal-secret'
      )
      assertEquals(await response.text(), '')
      assertEquals(listenerCreated, true)
    } finally {
      for (const restore of restoreFns.reverse()) {
        restore()
      }

      globalThis.fetch = originalFetch
    }
  }
)

Deno.test('worker endpoint remains service-only and rejects non service calls', async () => {
  const source = await readIndexSource()

  assertEquals(source.includes('validateServiceOrUser(req)'), true)
  assertEquals(source.includes('!auth.authorized || !auth.isServiceCall'), true)
  assertEquals(source.includes('Service-only endpoint'), true)
  assertEquals(source.includes('status: 401'), true)
})

Deno.test('queued job processing is bounded and ordered', async () => {
  const source = await readIndexSource()

  assertEquals(source.includes(".from('jarvis_background_jobs')"), true)
  assertEquals(source.includes(".eq('status', 'queued')"), true)
  assertEquals(source.includes(".order('created_at', { ascending: true })"), true)
  assertEquals(source.includes('.limit(10)'), true)
  assertEquals(source.includes('processedJobs++'), true)
})

Deno.test('jarvis-execute request contains expected background execution payload', async () => {
  const source = await readIndexSource()

  assertEquals(source.includes('/functions/v1/jarvis-execute'), true)
  assertEquals(source.includes('Authorization: `Bearer ${supabaseKey}`'), true)
  assertEquals(source.includes('action_id: job.id'), true)
  assertEquals(source.includes('user_id: user_id'), true)
  assertEquals(source.includes('direct_execution: true'), true)
  assertEquals(source.includes('action_type: action_type'), true)
  assertEquals(source.includes('action_data: action_data'), true)
  assertEquals(source.includes('throw new Error(`Execution failed: ${errorText}`)'), true)
})

Deno.test(
  'completion and failure notifications use expected titles and payload types',
  async () => {
    const source = await readIndexSource()

    assertEquals(source.includes('/functions/v1/send-push-notification'), true)
    assertEquals(source.includes('✅ JARVIS - Action terminée'), true)
    assertEquals(source.includes('❌ JARVIS - Échec'), true)
    assertEquals(source.includes("type: 'jarvis_job_completed'"), true)
    assertEquals(source.includes("type: 'jarvis_job_failed'"), true)
    assertEquals(source.includes('errorMessage.substring(0, 50)'), true)
  }
)

Deno.test('action labels map known action types to business messages', async () => {
  const source = await readIndexSource()
  const labels = extractActionLabels(source)

  assertEquals(labels.send_email, 'Email envoyé avec succès')
  assertEquals(labels.create_task, 'Tâche créée avec succès')
  assertEquals(labels.update_status, 'Statut mis à jour')
  assertEquals(labels.close_ticket, 'Ticket clôturé')
  assertEquals(labels.schedule_meeting, 'Réunion planifiée')
  assertEquals(
    source.includes('return labels[actionType] || `Action "${actionType}" terminée`'),
    true
  )
})

Deno.test('source parsing helper fails explicitly when label mapping is absent', () => {
  assertThrows(
    () => extractActionLabels('function getActionLabel(actionType: string) { return actionType; }'),
    Error,
    'Unable to find labels mapping'
  )
})

Deno.test('timeout helper rejects if an async worker response never arrives', async () => {
  await assertRejects(
    () => withTimeout(new Promise<Response>(() => {}), 1),
    Error,
    'Timed out waiting for worker response'
  )
})
