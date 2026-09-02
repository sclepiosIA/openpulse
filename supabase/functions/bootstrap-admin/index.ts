import { createClient } from '@supabase/supabase-js'
import { corsHeaders } from '../_shared/cors.ts'

interface CreationPayload {
  action: 'create'
  email: string
  password: string
  prenom: string
  nom: string
  installation_code: string
}

export interface BootstrapDependencies {
  installationRequired(): Promise<boolean>
  verifyInstallationCode(code: string): Promise<boolean>
  claimInstallation(): Promise<boolean>
  releaseInstallation(): Promise<void>
  completeInstallation(userId: string): Promise<void>
  createAdmin(
    payload: Omit<CreationPayload, 'action' | 'installation_code'>
  ): Promise<{ id: string }>
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })

const emailValide = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

export function createBootstrapHandler(deps: BootstrapDependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
    if (request.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return json({ error: 'Requête invalide' }, 400)
    }

    if (body.action === 'status') {
      return json({ installation_requise: await deps.installationRequired() })
    }

    const payload = body as unknown as CreationPayload
    if (
      payload.action !== 'create' ||
      !emailValide(payload.email || '') ||
      !payload.prenom?.trim() ||
      !payload.nom?.trim() ||
      typeof payload.password !== 'string' ||
      payload.password.length < 12 ||
      typeof payload.installation_code !== 'string' ||
      !payload.installation_code
    ) {
      return json({ error: 'Données d’installation invalides' }, 400)
    }

    if (!(await deps.installationRequired())) {
      return json({ error: 'Cette instance est déjà initialisée' }, 409)
    }
    if (!(await deps.verifyInstallationCode(payload.installation_code))) {
      return json({ error: "Code d'installation invalide" }, 403)
    }
    if (!(await deps.claimInstallation())) {
      return json({ error: 'Une installation est déjà en cours ou terminée' }, 409)
    }

    try {
      const admin = await deps.createAdmin({
        email: payload.email.trim().toLowerCase(),
        password: payload.password,
        prenom: payload.prenom.trim(),
        nom: payload.nom.trim(),
      })
      await deps.completeInstallation(admin.id)
      return json({ success: true })
    } catch (error) {
      await deps.releaseInstallation()
      console.error(
        'bootstrap-admin failed',
        error instanceof Error ? error.message : 'unknown error'
      )
      return json({ error: 'La création du compte administrateur a échoué' }, 500)
    }
  }
}

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))
}

async function constantTimeEqual(left: string, right: string): Promise<boolean> {
  const [a, b] = await Promise.all([digest(left), digest(right)])
  let difference = a.length ^ b.length
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0)
  }
  return difference === 0
}

function productionDependencies(): BootstrapDependencies {
  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const installationCode = Deno.env.get('OPENPULSE_INSTALLATION_CODE') ?? ''
  if (!url || !serviceKey || !installationCode)
    throw new Error('Configuration de bootstrap absente')
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  return {
    async installationRequired() {
      const { count, error } = await admin
        .from('user_roles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'admin')
      if (error) throw error
      return count === 0
    },
    verifyInstallationCode: (code) => constantTimeEqual(code, installationCode),
    async claimInstallation() {
      const { data, error } = await admin.rpc('claim_initial_installation')
      if (error) throw error
      return data === true
    },
    async releaseInstallation() {
      const { error } = await admin.rpc('release_initial_installation')
      if (error) console.error('bootstrap claim release failed', error.message)
    },
    async completeInstallation(userId) {
      const { error } = await admin.rpc('complete_initial_installation', { _user_id: userId })
      if (error) throw error
    },
    async createAdmin(payload) {
      const { data, error } = await admin.auth.admin.createUser({
        email: payload.email,
        password: payload.password,
        email_confirm: true,
        user_metadata: { prenom: payload.prenom, nom: payload.nom },
      })
      if (error || !data.user) throw error ?? new Error('Utilisateur non créé')

      const { error: roleError } = await admin.from('user_roles').insert({
        user_id: data.user.id,
        role: 'admin',
        assigned_by: data.user.id,
      })
      if (roleError) {
        await admin.auth.admin.deleteUser(data.user.id)
        throw roleError
      }
      return { id: data.user.id }
    },
  }
}

if (import.meta.main) {
  Deno.serve(createBootstrapHandler(productionDependencies()))
}
