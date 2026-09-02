import { assertEquals, assertExists, assertNotEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { importEdgeModuleOffline } from '../_shared/module-load-test-harness.ts'

const env = {
  ONLYOFFICE_DOCSPACE_URL: 'https://docspace.test',
  ONLYOFFICE_API_KEY: 'test-docspace-api-key',
  SUPABASE_URL: 'https://supabase.test',
  SUPABASE_ANON_KEY: 'test-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
}

type FetchCall = {
  url: string
  method: string
  headers: Headers
  body: BodyInit | null | undefined
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function callFrom(input: RequestInfo | URL, init?: RequestInit): FetchCall {
  const url = input instanceof Request ? input.url : input.toString()
  const headers = new Headers(input instanceof Request ? input.headers : undefined)
  new Headers(init?.headers).forEach((value, key) => headers.set(key, value))
  return {
    url,
    method: (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase(),
    body: init?.body ?? (input instanceof Request ? input.body : undefined),
    headers,
  }
}

function bodyJson(body: BodyInit | null | undefined): Promise<Record<string, unknown>> {
  if (typeof body === 'string') return JSON.parse(body)
  if (body instanceof ArrayBuffer) {
    return JSON.parse(new TextDecoder().decode(body))
  }
  throw new Error('Expected JSON body')
}

async function withEnv<T>(fn: () => Promise<T>): Promise<T> {
  const previous = new Map(Object.keys(env).map((key) => [key, Deno.env.get(key)]))
  for (const [key, value] of Object.entries(env)) Deno.env.set(key, value)
  try {
    return await fn()
  } finally {
    for (const [key, value] of previous) {
      value === undefined ? Deno.env.delete(key) : Deno.env.set(key, value)
    }
  }
}

async function invoke(request: Request, fetchImpl: typeof fetch): Promise<Response> {
  const originalFetch = globalThis.fetch
  globalThis.fetch = fetchImpl
  try {
    const { module, stats } = await importEdgeModuleOffline(new URL('./index.ts', import.meta.url))
    assertEquals(stats.listenCalls, 1)
    assertEquals(stats.fetchCalls, 0)
    return await (module.handler as (req: Request) => Promise<Response>)(request)
  } finally {
    globalThis.fetch = originalFetch
  }
}

const noFetch = (() => {
  throw new Error('Unexpected fetch call')
}) as typeof fetch
const request = (
  body: unknown,
  headers: HeadersInit = {
    authorization: 'Bearer user-jwt',
    'content-type': 'application/json',
  }
) =>
  new Request('http://localhost', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

Deno.test('OPTIONS preflight returns CORS headers without I/O', async () => {
  await withEnv(async () => {
    const response = await invoke(new Request('http://localhost', { method: 'OPTIONS' }), noFetch)
    assertEquals(response.status, 200)
    assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*')
    assertEquals(
      response.headers.get('Access-Control-Allow-Headers'),
      'authorization, x-client-info, apikey, content-type, x-internal-secret'
    )
  })
})

Deno.test('POST without bearer authorization returns 401', async () => {
  await withEnv(async () => {
    const response = await invoke(
      request(
        { documentId: 'doc-1', docSpaceFileId: 'file-42' },
        {
          'content-type': 'application/json',
        }
      ),
      noFetch
    )
    assertEquals(response.status, 401)
    assertEquals(await response.json(), { error: 'Unauthorized' })
  })
})

Deno.test('authenticated request missing document identifiers returns 400', async () => {
  await withEnv(async () => {
    const calls: FetchCall[] = []
    const response = await invoke(request({ documentId: 'doc-1' }), ((input, init) => {
      const call = callFrom(input, init)
      calls.push(call)
      if (call.url.includes('/auth/v1/user')) {
        return Promise.resolve(json({ id: 'user-123' }))
      }
      throw new Error(`Unexpected ${call.method} ${call.url}`)
    }) as typeof fetch)
    assertEquals(response.status, 400)
    assertEquals(await response.json(), {
      error: 'Missing documentId or docSpaceFileId',
    })
    assertEquals(calls.length, 1)
  })
})

Deno.test(
  'successful DocSpace download saves binary to storage, updates metadata, audits, and deletes temp file',
  async () => {
    await withEnv(async () => {
      const calls: FetchCall[] = []
      let uploaded = 0
      let update: Record<string, unknown> | undefined
      let audit: Record<string, unknown> | undefined
      const response = await invoke(
        request({
          documentId: 'doc-1',
          docSpaceFileId: 'file-42',
          deleteFromDocSpace: true,
        }),
        (async (input, init) => {
          const call = callFrom(input, init)
          calls.push(call)
          if (call.url.includes('/auth/v1/user')) return json({ id: 'user-123' })
          if (call.url.includes('/rest/v1/documents') && call.method === 'GET') {
            return json({
              id: 'doc-1',
              storage_bucket: 'documents-bucket',
              storage_path: 'contracts/contract.docx',
              mime_type: 'application/octet-stream',
            })
          }
          if (call.url === 'https://docspace.test/api/2.0/files/file-42/download')
            return new Response(new Uint8Array([10, 20, 30, 40, 50]))
          if (call.url.includes('/storage/v1/object/documents-bucket/contracts/contract.docx')) {
            uploaded = (call.body as ArrayBuffer).byteLength
            return json({ Key: 'contracts/contract.docx' })
          }
          if (call.url.includes('/rest/v1/documents') && call.method === 'PATCH') {
            update = await bodyJson(call.body)
            return new Response(null, { status: 204 })
          }
          if (call.url.includes('/rest/v1/document_audit_log') && call.method === 'POST') {
            audit = await bodyJson(call.body)
            return json([])
          }
          if (
            call.url === 'https://docspace.test/api/2.0/files/file/file-42' &&
            call.method === 'DELETE'
          )
            return json({ success: true })
          throw new Error(`Unexpected ${call.method} ${call.url}`)
        }) as typeof fetch
      )
      assertEquals(response.status, 200)
      assertEquals(await response.json(), { success: true, documentId: 'doc-1' })
      assertEquals(uploaded, 5)
      assertExists(update)
      assertEquals(update.file_size_bytes, 5)
      assertEquals(update.source_type, null)
      assertEquals(update.source_id, null)
      assertExists(audit)
      assertEquals(audit.document_id, 'doc-1')
      assertEquals(audit.action, 'edited_docspace')
      assertEquals(audit.performed_by, 'user-123')
      const deletion = calls.find((call) => call.method === 'DELETE')
      assertExists(deletion)
      assertEquals(deletion.headers.get('authorization'), 'Bearer test-docspace-api-key')
    })
  }
)

Deno.test(
  'DocSpace download failure returns a sanitized 500 response and does not upload to storage',
  async () => {
    await withEnv(async () => {
      const calls: FetchCall[] = []
      const response = await invoke(
        request({ documentId: 'doc-1', docSpaceFileId: 'missing-file' }),
        ((input, init) => {
          const call = callFrom(input, init)
          calls.push(call)
          if (call.url.includes('/auth/v1/user')) {
            return Promise.resolve(json({ id: 'user-123' }))
          }
          if (call.url.includes('/rest/v1/documents')) {
            return Promise.resolve(
              json({
                id: 'doc-1',
                storage_bucket: 'documents-bucket',
                storage_path: 'contracts/contract.docx',
                mime_type: 'application/octet-stream',
              })
            )
          }
          if (call.url === 'https://docspace.test/api/2.0/files/missing-file/download') {
            return Promise.resolve(new Response('file not found', { status: 404 }))
          }
          throw new Error(`Unexpected ${call.method} ${call.url}`)
        }) as typeof fetch
      )
      assertEquals(response.status, 500)
      assertEquals(await response.json(), {
        error: 'Failed to download from DocSpace',
        details: 'file not found',
        status: 404,
      })
      assertEquals(
        calls.some((call) => call.url.includes('/storage/v1/object/')),
        false
      )
      assertEquals(
        calls.some((call) => call.method === 'DELETE'),
        false
      )
    })
  }
)
