/**
 * k6 Test 01 — Auth load CRM (7 rôles, 3 sessionsetup)
 */
import { check, sleep } from 'k6';
import { getScenario } from '../config/scenarios.js';
import { setupSessions, refreshToken, healthCheck, SKIP_AUTH } from '../helpers/auth.js';
import { queryTable } from '../helpers/supabase.js';
import { assertQueryOk } from '../helpers/assertions.js';

export const options = {
  scenarios: { auth_load: getScenario(__ENV.K6_SCENARIO || 'smoke') },
  thresholds: { http_req_duration: ['p(95)<1500'], http_req_failed: ['rate<0.05'] },
};

export function setup() {
  return setupSessions(['admin', 'csm', 'sales', 'rh', 'finance']);
}

export default function (data) {
  if (SKIP_AUTH) { check(healthCheck(), { 'api reachable': (r) => r.status < 500 }); return; }
  const roles = ['admin', 'csm', 'sales', 'rh', 'finance'];
  const role = roles[__VU % roles.length];
  const session = data?.sessions?.[role];
  if (!session) return;
  const r1 = queryTable('users', `id=eq.${session.user_id}&select=*`, session.access_token);
  check(r1, assertQueryOk(r1, 'users'));
  sleep(0.5);
  const t = refreshToken(session.refresh_token);
  check(t, { 'refresh ok': (x) => x !== null });
  sleep(0.3);
}
