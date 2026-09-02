import {
  assertEquals,
  assertExists,
  assertRejects,
  assertThrows, assertNotEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'

const moduleUrl = new URL('./index.ts', import.meta.url)
const moduleDirUrl = new URL('.', import.meta.url)

function fileUrlToPath(url: URL): string {
  const path = decodeURIComponent(url.pathname)
  if (Deno.build.os === 'windows') {
    return path.replace(/^\/([A-Za-z]:)/, '$1').replace(/\//g, '\\')
  }
  return path
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function readModuleSource(): Promise<string> {
  return await Deno.readTextFile(moduleUrl)
}

async function waitForOutputMarker(
  stream: ReadableStream<Uint8Array>,
  marker: string
): Promise<{ found: boolean; output: string }> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let output = ''

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) {
        output += decoder.decode()
        return { found: output.includes(marker), output }
      }

      output += decoder.decode(value, { stream: true })
      if (output.includes(marker)) {
        try {
          await reader.cancel()
        } catch {
          // The subprocess may already have closed stdout.
        }
        return { found: true, output }
      }
    }
  } finally {
    try {
      reader.releaseLock()
    } catch {
      // The lock may already be released after cancel/close.
    }
  }
}

Deno.test('module source defines the expected request validation contract', async () => {
  const source = await readModuleSource()

  assertExists(source.match(/const\s+RequestSchema\s*=\s*z\.object\(\{/))
  assertExists(source.match(/account_id:\s*z\.string\(\)\.uuid\(\)/))
  assertExists(source.match(/historical_backfill:\s*z\.boolean\(\)\.default\(false\)/))
  assertExists(source.match(/RequestSchema\.safeParse\(body\)/))
  assertExists(source.match(/error:\s*'Invalid request'/))
  assertExists(source.match(/status:\s*400/))
})

Deno.test('module source declares Supabase Edge Function CORS headers', async () => {
  const source = await readModuleSource()
  // Le durcissement a sorti la declaration en ligne vers le socle partage. On
  // CHARGE le vrai module plutot que d'inspecter son texte : chercher '*' dans
  // la source rendait vrai sur un commentaire.
  const socle = await import(new URL('../_shared/cors.ts', import.meta.url).href)

  assertEquals(source.includes("import { corsHeaders } from '../_shared/cors.ts'"), true)
  assertEquals(
    typeof socle.corsHeaders['Access-Control-Allow-Headers'] === 'string' &&
      socle.corsHeaders['Access-Control-Allow-Headers'].includes('authorization'),
    true
  )
  // La propriete qui compte : le socle ne rend jamais le joker.
  assertNotEquals(socle.corsHeaders['Access-Control-Allow-Origin'], '*')
  assertEquals(source.includes("req.method === 'OPTIONS'"), true)
  assertEquals(source.includes('return new Response(null, { headers: corsHeaders })'), true)
})

Deno.test(
  'module source builds JMAP discovery with Basic auth and account extraction',
  async () => {
    const source = await readModuleSource()

    assertEquals(source.includes('class JMAPClient'), true)
    assertEquals(source.includes('this.apiUrl = `${stalwartUrl}/jmap`'), true)
    assertEquals(
      source.includes('this.authHeader = `Basic ${btoa(`${username}:${password}`)}`'),
      true
    )
    assertEquals(source.includes('fetch(`${stalwartUrl}/.well-known/jmap`'), true)
    assertEquals(source.includes("session.primaryAccounts?.['urn:ietf:params:jmap:mail']"), true)
    assertEquals(source.includes("throw new Error('No JMAP account found in session')"), true)
  }
)

Deno.test('module source builds JMAP mail API calls with expected protocol details', async () => {
  const source = await readModuleSource()

  assertEquals(source.includes("'urn:ietf:params:jmap:core'"), true)
  assertEquals(source.includes("'urn:ietf:params:jmap:mail'"), true)
  assertEquals(source.includes("'Email/changes'"), true)
  assertEquals(source.includes('sinceState: opts.sinceState'), true)
  assertEquals(source.includes('maxChanges: opts.limit || 50'), true)
  assertEquals(source.includes("'Email/query'"), true)
  assertEquals(source.includes("sort: [{ property: 'receivedAt', isAscending: false }]"), true)
  assertEquals(source.includes("'Email/get'"), true)
  assertEquals(source.includes('fetchTextBodyValues: true'), true)
  assertEquals(source.includes('fetchHTMLBodyValues: true'), true)
  assertEquals(source.includes('maxBodyValueBytes: 256000'), true)
})

Deno.test('module source maps JMAP email fields to database message fields', async () => {
  const source = await readModuleSource()

  assertEquals(source.includes('const messageId = email.messageId?.[0] || email.id'), true)
  assertEquals(source.includes("const subject = email.subject || '(sans sujet)'"), true)
  assertEquals(source.includes("const isRead = email.keywords?.['$seen'] || false"), true)
  assertEquals(source.includes("const isDraft = email.keywords?.['$draft'] || false"), true)
  assertEquals(
    source.includes('const isSent = !!(email.from?.[0]?.email === account.email_address)'),
    true
  )
  assertEquals(source.includes('body_text: bodyText'), true)
  assertEquals(source.includes('body_html: bodyHtml'), true)
  assertEquals(source.includes('attachments_count: attachmentsCount'), true)
  assertEquals(
    source.includes('reference_headers: references.length > 0 ? references : null'),
    true
  )
  assertEquals(source.includes('in_reply_to: inReplyTo'), true)
})

Deno.test('module source handles empty sync results and final sync response', async () => {
  const source = await readModuleSource()

  assertEquals(source.includes('if (emailIds.length === 0)'), true)
  assertEquals(source.includes('messages_synced: 0'), true)
  assertEquals(source.includes('has_more: false'), true)
  assertEquals(source.includes('jmap_sync_state: newState || lastSyncState'), true)
  assertEquals(source.includes('messages_synced: messagesSynced'), true)
  assertEquals(source.includes('has_more: hasMore'), true)
  assertEquals(source.includes("sync_method: 'jmap'"), true)
})

Deno.test(
  'module source uses offline-testable timeout and error paths for JMAP calls',
  async () => {
    const source = await readModuleSource()

    assertEquals(source.includes('new AbortController()'), true)
    assertEquals(source.includes('setTimeout(() => controller.abort(), 60000)'), true)
    assertEquals(source.includes("throw new Error('JMAP request timeout (60s)')"), true)
    assertEquals(source.includes('JMAP session discovery failed'), true)
    assertEquals(source.includes('JMAP call failed'), true)
    assertEquals(source.includes("throw new Error('Could not get JMAP state')"), true)
  }
)

Deno.test('module can be imported by relative path without immediate throw', async () => {
  const marker = 'MODULE_IMPORT_OK'
  const tempFileName = `.index-import-test-${crypto.randomUUID()}.ts`
  const tempFileUrl = new URL(tempFileName, moduleDirUrl)

  const code = `
try {
  await import("./index.ts");
  console.log("${marker}");
  await new Promise(() => {});
} catch (error) {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  Deno.exit(1);
}
`

  await Deno.writeTextFile(tempFileUrl, code)

  const child = new Deno.Command(Deno.execPath(), {
    args: ['run', '--no-lock', '--allow-all', '--no-check', tempFileName],
    cwd: fileUrlToPath(moduleDirUrl),
    stdout: 'piped',
    stderr: 'piped',
  }).spawn()

  const statusPromise = child.status
  const stderrPromise = new Response(child.stderr).text()
  const stdoutMarkerPromise = waitForOutputMarker(child.stdout, marker)

  let shouldKill = true
  let importTimeoutId: ReturnType<typeof setTimeout> | undefined

  try {
    const importTimeout = new Promise<{ type: 'timeout' }>((resolve) => {
      importTimeoutId = setTimeout(() => resolve({ type: 'timeout' }), 20_000)
    })
    const result = await Promise.race([
      stdoutMarkerPromise.then((value) => ({ type: 'marker' as const, value })),
      statusPromise.then((status) => ({ type: 'status' as const, status })),
      importTimeout,
    ])

    if (result.type === 'marker') {
      assertEquals(result.value.found, true)
      return
    }

    if (result.type === 'status') {
      shouldKill = false
      const [stderr, stdoutResult] = await Promise.all([
        stderrPromise,
        stdoutMarkerPromise.catch((error) => ({
          found: false,
          output: String(error),
        })),
      ])

      assertEquals(
        result.status.success && stdoutResult.found,
        true,
        `module import failed before registering the Edge Function handler\nstdout:\n${stdoutResult.output}\nstderr:\n${stderr}`
      )
      return
    }

    const stderr = await Promise.race([stderrPromise, delay(100).then(() => '')])

    assertEquals(
      false,
      true,
      `module import did not complete before timeout; this usually means dependency loading or top-level initialization blocked unexpectedly.\nstderr:\n${stderr}`
    )
  } finally {
    if (importTimeoutId !== undefined) clearTimeout(importTimeoutId)

    if (shouldKill) {
      try {
        child.kill('SIGTERM')
      } catch {
        // The subprocess may already have exited.
      }
    }

    await Promise.allSettled([statusPromise, stderrPromise, stdoutMarkerPromise])

    try {
      await Deno.remove(tempFileUrl)
    } catch {
      // Temporary file may already be absent if the test process cleaned it.
    }
  }
})

Deno.test('local test helpers fail on invalid assumptions', async () => {
  assertThrows(
    () => {
      throw new Error('expected synchronous failure')
    },
    Error,
    'expected synchronous failure'
  )

  await assertRejects(
    () => Promise.reject(new Error('expected asynchronous failure')),
    Error,
    'expected asynchronous failure'
  )
})
