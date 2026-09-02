/**
 * POST /platform-clients-link?etab_id=<uuid>
 * Body: { system: "site_web"|"product", external_id: string }
 * Registers the external ID mapping for an etablissement.
 */
import {
  withApiKey,
  jsonResponse,
  errorResponse,
  serviceClient,
  checkIdempotency,
  storeIdempotency,
} from '../_shared/platform-auth.ts'

type PlatformAuthDependencies = {
  withApiKey: typeof withApiKey
  jsonResponse: typeof jsonResponse
  errorResponse: typeof errorResponse
  serviceClient: typeof serviceClient
  checkIdempotency: typeof checkIdempotency
  storeIdempotency: typeof storeIdempotency
}

const platformAuth: PlatformAuthDependencies = {
  withApiKey,
  jsonResponse,
  errorResponse,
  serviceClient,
  checkIdempotency,
  storeIdempotency,
}

/** Builds a testable request handler without changing production dependencies. */
export function createHandler(deps: PlatformAuthDependencies = platformAuth) {
  return (req: Request): Promise<Response> =>
    deps.withApiKey(req, async (ctx) => {
      if (req.method !== 'POST') return deps.errorResponse('Method not allowed', 405, 'method')
      const url = new URL(req.url)
      const etabId = url.searchParams.get('etab_id')
      if (!etabId || !/^[0-9a-f-]{36}$/i.test(etabId)) {
        return deps.errorResponse('Invalid etab_id', 400, 'invalid_param')
      }

      const { key, cached } = await deps.checkIdempotency(req, `clients-link:${etabId}`)
      if (cached) return cached

      let body: { system?: string; external_id?: string; metadata?: Record<string, unknown> }
      try {
        body = await req.json()
      } catch {
        return deps.errorResponse('Invalid JSON', 400, 'invalid_body')
      }
      if (!body.system || !['site_web', 'product'].includes(body.system)) {
        return deps.errorResponse('Invalid system', 400, 'invalid_system')
      }
      if (!body.external_id || typeof body.external_id !== 'string') {
        return deps.errorResponse('Invalid external_id', 400, 'invalid_external_id')
      }

      // Scope check: the caller's API key scope must match the system being linked.
      // e.g. platform:site_web can only link system=site_web; platform:product for product, etc.
      if (!ctx.scope || !ctx.scope.endsWith(`:${body.system}`)) {
        return deps.errorResponse('Forbidden — scope mismatch', 403, 'scope_mismatch')
      }

      const sb = deps.serviceClient()
      const { error } = await sb.from('client_external_ids').upsert(
        {
          etablissement_id: etabId,
          system: body.system,
          external_id: body.external_id,
          metadata: body.metadata ?? {},
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'etablissement_id,system' }
      )

      if (error) {
        console.error('[platform-clients-link]', error)
        return deps.errorResponse('Link failed', 500, 'db_error')
      }
      const result = { ok: true, etablissement_id: etabId, system: body.system }
      if (key) await deps.storeIdempotency(key, `clients-link:${etabId}`, result, 200)
      return deps.jsonResponse(result)
    })
}

export const handler = createHandler()

Deno.serve(handler)
