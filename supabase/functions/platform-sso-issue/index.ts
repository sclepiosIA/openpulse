/**
 * POST /platform-sso-issue
 * Body: { etablissement_id, user_email, target_path? }
 * Returns short-lived (5 min) JWT to be exchanged at the Product backend.
 * Caller must have scope `platform:site_web`.
 */
import {
  errorResponse,
  issueSsoJwt,
  jsonResponse,
  serviceClient,
  withApiKey,
} from '../_shared/platform-auth.ts'

type Etablissement = { id: string; statut: string }
type EtablissementQuery = {
  select(columns: string): EtablissementQuery
  eq(column: string, value: string): EtablissementQuery
  maybeSingle(): Promise<{ data: Etablissement | null; error: unknown }>
}

type ServiceClient = {
  from(table: 'etablissements'): EtablissementQuery
}

export type PlatformSsoIssueDeps = {
  withApiKey: (
    req: Request,
    handler: (ctx: { api_key_id: string; scope: string }) => Promise<Response>
  ) => Promise<Response>
  jsonResponse: (body: unknown, status?: number) => Response
  errorResponse: (message: string, status: number, code?: string) => Response
  issueSsoJwt: (payload: Record<string, unknown>) => Promise<{ token: string; exp: number }>
  serviceClient: () => ServiceClient
  getProductApiUrl: () => string | undefined
}

const DEFAULT_PRODUCT_API_URL = 'https://produit.exploitant.example.org'
const UUID_RE = /^[0-9a-f-]{36}$/i
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/**
 * Builds the request handler with explicit boundaries so validation can be
 * tested without mutating process-wide Deno, Supabase, or JWT state.
 */
export function createPlatformSsoIssueHandler(
  deps: PlatformSsoIssueDeps
): (req: Request) => Promise<Response> {
  return async (req) =>
    await deps.withApiKey(req, async (ctx) => {
      if (req.method !== 'POST') {
        return deps.errorResponse('Method not allowed', 405, 'method')
      }
      if (ctx.scope !== 'platform:site_web') {
        return deps.errorResponse('Forbidden — site_web scope required', 403, 'forbidden_scope')
      }

      let body: {
        etablissement_id?: string
        user_email?: string
        target_path?: string
      }
      try {
        body = await req.json()
      } catch {
        return deps.errorResponse('Invalid JSON', 400, 'invalid_body')
      }
      if (!body || typeof body !== 'object') {
        return deps.errorResponse('Invalid JSON', 400, 'invalid_body')
      }
      if (!body.etablissement_id || !UUID_RE.test(body.etablissement_id)) {
        return deps.errorResponse('Invalid etablissement_id', 400, 'invalid_param')
      }
      if (!body.user_email || !EMAIL_RE.test(body.user_email)) {
        return deps.errorResponse('Invalid user_email', 400, 'invalid_param')
      }

      const { data: etab } = await deps
        .serviceClient()
        .from('etablissements')
        .select('id, statut')
        .eq('id', body.etablissement_id)
        .maybeSingle()
      if (!etab) {
        return deps.errorResponse('Etablissement not found', 404, 'not_found')
      }
      if (etab.statut !== 'production') {
        return deps.errorResponse('Etablissement not in production', 422, 'not_in_production')
      }

      const { token, exp } = await deps.issueSsoJwt({
        etablissement_id: body.etablissement_id,
        user_email: body.user_email,
        target_path: body.target_path ?? '/',
      })
      const productUrl = (deps.getProductApiUrl() ?? DEFAULT_PRODUCT_API_URL).replace(/\/+$/, '')

      return deps.jsonResponse({
        token,
        url: `${productUrl}/v1/product/sso/exchange?token=${encodeURIComponent(token)}`,
        expires_at: new Date(exp * 1000).toISOString(),
      })
    })
}

const handler = createPlatformSsoIssueHandler({
  withApiKey: async (req, next) => await withApiKey(req, next),
  jsonResponse,
  errorResponse,
  issueSsoJwt,
  serviceClient: () => serviceClient() as unknown as ServiceClient,
  getProductApiUrl: () => Deno.env.get('PRODUCT_API_URL'),
})

if (import.meta.main) Deno.serve(handler)
