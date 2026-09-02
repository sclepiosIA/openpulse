/**
 * k6 Auth Helper CRM Hospitalier — Pool 7 rôles (admin, csm, sales, rh, finance, dev, supervisor)
 *
 * Pattern : 1-to-1 avec POINT k6/helpers/auth.js
 */
import http from 'k6/http'

const BASE_URL = __ENV.SUPABASE_URL || __ENV.BASE_URL || 'https://gestion.exploitant.example.org'
const ANON_KEY = __ENV.SUPABASE_ANON_KEY || ''
const SKIP_AUTH = __ENV.K6_SKIP_AUTH === 'true'

// Mot de passe partagé des comptes de test, fourni UNIQUEMENT via variable
// d'environnement (jamais en clair dans le repo). Lancer avec :
//   k6 run -e TEST_PASSWORD_SHARED=... tests/load/k6-smoke.js
// ou définir K6_SKIP_AUTH=true pour les runs sans credentials (mode anon).
const SHARED_PASSWORD = __ENV.TEST_PASSWORD_SHARED || ''

if (!SKIP_AUTH && !SHARED_PASSWORD) {
  throw new Error(
    'TEST_PASSWORD_SHARED manquant. Fournissez-le via -e TEST_PASSWORD_SHARED=... ' +
      'ou activez le mode anonyme avec -e K6_SKIP_AUTH=true.'
  )
}

const TEST_USERS = [
  { email: 'admin@exploitant.example.org', password: SHARED_PASSWORD, role: 'admin' },
  { email: 'csm@exploitant.example.org', password: SHARED_PASSWORD, role: 'csm' },
  { email: 'sales@exploitant.example.org', password: SHARED_PASSWORD, role: 'sales' },
  { email: 'rh@exploitant.example.org', password: SHARED_PASSWORD, role: 'rh' },
  { email: 'finance@exploitant.example.org', password: SHARED_PASSWORD, role: 'finance' },
  { email: 'dev@exploitant.example.org', password: SHARED_PASSWORD, role: 'dev' },
  { email: 'supervisor@exploitant.example.org', password: SHARED_PASSWORD, role: 'supervisor' },
]

export function login(userIndex = 0) {
  const user = TEST_USERS[userIndex % TEST_USERS.length]
  if (SKIP_AUTH) {
    return { access_token: ANON_KEY, refresh_token: null, user_id: null, role: user.role }
  }
  const res = http.post(
    `${BASE_URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({ email: user.email, password: user.password }),
    { headers: { 'Content-Type': 'application/json', apikey: ANON_KEY } }
  )
  if (res.status === 200) {
    const body = JSON.parse(res.body)
    return {
      access_token: body.access_token,
      refresh_token: body.refresh_token,
      user_id: body.user?.id,
      role: user.role,
    }
  }
  console.warn(`⚠ Login failed for ${user.email}: HTTP ${res.status}`)
  return null
}

export function loginByRole(role) {
  const idx = TEST_USERS.findIndex((u) => u.role === role)
  return login(idx >= 0 ? idx : 0)
}

export function healthCheck() {
  return http.get(`${BASE_URL}/rest/v1/`, {
    headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
  })
}

export function refreshToken(refresh) {
  if (!refresh) return null
  const res = http.post(
    `${BASE_URL}/auth/v1/token?grant_type=refresh_token`,
    JSON.stringify({ refresh_token: refresh }),
    { headers: { 'Content-Type': 'application/json', apikey: ANON_KEY } }
  )
  if (res.status === 200) return JSON.parse(res.body).access_token
  return null
}

export function authHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    apikey: ANON_KEY,
  }
}

export function setupSessions(roles) {
  const targets = roles || ['admin', 'csm', 'sales', 'rh', 'finance']
  const sessions = {}
  for (const role of targets) {
    const session = loginByRole(role)
    if (session) sessions[role] = session
  }
  return { sessions }
}

export { TEST_USERS, BASE_URL, ANON_KEY, SKIP_AUTH }
