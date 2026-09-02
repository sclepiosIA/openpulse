/**
 * k6 SMOKE — CRM Hospitalier (OpenPulse Gestion)
 *
 * Sanity check : 1-2 VUs pendant 30s. Vérifie que les routes critiques
 * répondent avant de lancer une charge plus lourde.
 *
 * Routes testées : /dashboard, /pulse, /etablissements, /tasks
 *
 * Run :
 *   source _outils/.env
 *   k6 run -e SUPABASE_URL=$MARQUE_BASE_URL \
 *          -e SUPABASE_ANON_KEY=$MARQUE_ANON_KEY \
 *          tests/load/k6-smoke.js
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { setupSessions, authHeaders, healthCheck, BASE_URL, SKIP_AUTH } from './helpers/auth.js';
import { queryTable } from './helpers/supabase.js';

export const options = {
  scenarios: {
    smoke: {
      executor: 'constant-vus',
      vus: 2,
      duration: '30s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1500'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.95'],
  },
};

export function setup() {
  return setupSessions(['admin', 'csm', 'sales']);
}

export default function (data) {
  if (SKIP_AUTH) {
    check(healthCheck(), { 'api reachable (skip-auth)': (r) => r.status < 500 });
    sleep(1);
    return;
  }

  const roles = ['admin', 'csm', 'sales'];
  const role = roles[__VU % roles.length];
  const session = data?.sessions?.[role];

  if (!session) {
    check(healthCheck(), { 'health fallback': (r) => r.status < 500 });
    sleep(1);
    return;
  }

  // /dashboard : profil + activité utilisateur
  group('dashboard', () => {
    const r = queryTable('users', `id=eq.${session.user_id}&select=id,email,role`, session.access_token);
    check(r, { 'dashboard.profile 2xx': (x) => x.status >= 200 && x.status < 300 });
  });
  sleep(0.3);

  // /pulse : conversations
  group('pulse', () => {
    const r = queryTable('pulse_conversations', 'select=id,title&limit=10', session.access_token);
    check(r, { 'pulse.conv 2xx/empty': (x) => x.status >= 200 && x.status < 400 });
  });
  sleep(0.3);

  // /etablissements : liste prospects/clients
  group('etablissements', () => {
    const r = queryTable('etablissements', 'select=id,nom,statut&limit=20', session.access_token);
    check(r, { 'etablissements 2xx/empty': (x) => x.status >= 200 && x.status < 400 });
  });
  sleep(0.3);

  // /tasks : to-do
  group('tasks', () => {
    const r = queryTable('tasks', 'select=id,title,status&limit=20', session.access_token);
    check(r, { 'tasks 2xx/empty': (x) => x.status >= 200 && x.status < 400 });
  });
  sleep(0.3);
}

export function handleSummary(data) {
  const m = data?.metrics || {};
  const p95 = m.http_req_duration?.values?.['p(95)'] ?? null;
  const fail = m.http_req_failed?.values?.rate ?? null;
  const checks = m.checks?.values?.rate ?? null;
  const lines = [
    '== k6 SMOKE CRM ==',
    `base_url   : ${BASE_URL}`,
    `p95 (ms)   : ${p95 !== null ? p95.toFixed(1) : 'n/a'}`,
    `error_rate : ${fail !== null ? (fail * 100).toFixed(2) + '%' : 'n/a'}`,
    `checks ok  : ${checks !== null ? (checks * 100).toFixed(2) + '%' : 'n/a'}`,
  ].join('\n');
  return { stdout: lines + '\n' };
}
