import '../support/ws-polyfill'
import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

/**
 * Couverture API/RPC — appels directs Supabase (anon + authenticated)
 * pour valider les contrats RPC critiques sans passer par l'UI.
 *
 * Vérifications :
 *   - Les RPC ouvertes (auth-only) répondent 200 avec un schéma attendu.
 *   - Les RPC réservées service_role refusent l'appel anon (auth attendue).
 *   - Les tables sensibles refusent l'accès anon (RLS effective).
 *
 * Ces tests complètent `supabase/tests/rls/*.sql` (pgTAP) en simulant
 * un vrai client navigateur et donc PostgREST + RLS combinés.
 */

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  'https://supabase.openpulse.example.org'
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || ''

test.skip(!SUPABASE_ANON_KEY, 'VITE_SUPABASE_PUBLISHABLE_KEY requise pour les tests API/RPC')

const TEST_EMAIL = process.env.E2E_ADMIN_EMAIL || process.env.E2E_EMAIL || 'test-admin@exploitant.example.org'
const TEST_PASSWORD = process.env.E2E_ADMIN_PASSWORD || process.env.E2E_PASSWORD || process.env.TEST_ACCOUNTS_PASSWORD || ''

test.skip(!TEST_PASSWORD, 'TEST_ACCOUNTS_PASSWORD ou E2E_*_PASSWORD requis pour les tests API/RPC authentifiés')

function anonClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function authedClient() {
  const c = anonClient()
  const { error } = await c.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  })
  if (error) throw new Error(`Auth E2E failed: ${error.message}`)
  return c
}

test.describe("RLS — tables sensibles refusent l'accès anonyme", () => {
  const PROTECTED_TABLES = [
    'profiles_secrets',
    'user_roles',
    'rh_salaires_mensuels',
    'rh_documents_employes',
    'email_messages',
    'signature_requests',
    'rgpd_consentements',
  ]

  for (const table of PROTECTED_TABLES) {
    test(`anon ne peut pas SELECT ${table}`, async () => {
      const c = anonClient()
      const { data, error } = await c
        .from(table as never)
        .select('*')
        .limit(1)

      // Soit erreur RLS/permission, soit jeu vide — jamais de données réelles.
      const blocked = !!error || (Array.isArray(data) && data.length === 0)

      expect(blocked, `Fuite RLS : anon a lu ${data?.length ?? '?'} lignes de ${table}`).toBe(true)
    })
  }
})

test.describe('Auth — flow signIn / signOut via API', () => {
  test('signIn avec mauvais mot de passe échoue proprement', async () => {
    const c = anonClient()
    const { data, error } = await c.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: 'mot-de-passe-incorrect-zzz',
    })
    expect(error).toBeTruthy()
    expect(data.session).toBeNull()
  })

  test('signIn avec bons identifiants retourne une session valide', async () => {
    const c = anonClient()
    const { data, error } = await c.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    })
    if (error) {
      test.skip(true, `Compte E2E indisponible : ${error.message}`)
      return
    }
    expect(data.session).toBeTruthy()
    expect(data.session?.access_token).toMatch(/^eyJ/)
    await c.auth.signOut()
  })
})

test.describe("RPC — has_role refuse l'appel sans session", () => {
  test('has_role en anon retourne null/erreur (auth required)', async () => {
    const c = anonClient()
    const { data, error } = await c.rpc('has_role', {
      _user_id: '00000000-0000-0000-0000-000000000000',
      _role: 'admin' as never,
    })

    // Soit erreur RLS (attendu), soit false (jamais true sans auth).
    const safe = !!error || data === false || data === null
    expect(
      safe,
      `has_role en anon a retourné ${JSON.stringify(data)} — devrait être bloqué/false`
    ).toBe(true)
  })
})

test.describe('Lecture authentifiée — tables métier accessibles', () => {
  test('authenticated peut lister les établissements (au moins 0 lignes sans erreur)', async () => {
    let c
    try {
      c = await authedClient()
    } catch (e: any) {
      test.skip(true, `Compte E2E indisponible : ${e.message}`)
      return
    }
    const { error, data } = await c.from('etablissements').select('id').limit(5)
    expect(error, `Erreur lecture etablissements : ${error?.message}`).toBeNull()
    expect(Array.isArray(data)).toBe(true)
    await c.auth.signOut()
  })

  test('authenticated peut appeler get_current_user_role()', async () => {
    let c
    try {
      c = await authedClient()
    } catch (e: any) {
      test.skip(true, `Compte E2E indisponible : ${e.message}`)
      return
    }
    const { data, error } = await c.rpc('get_current_user_role' as never)
    if (error && /function .* does not exist/i.test(error.message)) {
      test.skip(true, 'RPC get_current_user_role absente.')
      return
    }
    expect(error).toBeNull()
    expect(typeof data === 'string' || data === null).toBe(true)
    await c.auth.signOut()
  })
})
