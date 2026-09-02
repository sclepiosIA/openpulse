/**
 * k6 SPIKE — CRM Hospitalier
 *
 * Burst capacity : 0 → 100 VUs en 30s, hold 1 min, 100 → 0 en 30s.
 * Simule un pic brutal (campagne mass-mailing, sync Qonto déclenché).
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { setupSessions, healthCheck, BASE_URL, SKIP_AUTH } from './helpers/auth.js';
import { queryTable } from './helpers/supabase.js';

export const options = {
  scenarios: {
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 100 }, // ramp-up brutal
        { duration: '1m',  target: 100 }, // plateau
        { duration: '30s', target: 0 },   // ramp-down
      ],
      gracefulRampDown: '15s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<3000'],
    http_req_failed: ['rate<0.10'],
    checks: ['rate>0.85'],
  },
};

export function setup() {
  return setupSessions(['admin', 'csm', 'sales', 'rh', 'finance']);
}

export default function (data) {
  if (SKIP_AUTH) {
    check(healthCheck(), { 'api reachable (skip-auth)': (r) => r.status < 500 });
    sleep(0.5);
    return;
  }

  const roles = ['admin', 'csm', 'sales', 'rh', 'finance'];
  const role = roles[__VU % roles.length];
  const session = data?.sessions?.[role];
  if (!session) { sleep(0.5); return; }

  group('dashboard', () => {
    const r = queryTable('users', `id=eq.${session.user_id}&select=id,email,role`, session.access_token);
    check(r, { 'dashboard 2xx': (x) => x.status >= 200 && x.status < 300 });
  });

  group('etablissements', () => {
    const r = queryTable('etablissements', 'select=id,nom,statut&limit=20', session.access_token);
    check(r, { 'etab 2xx/empty': (x) => x.status >= 200 && x.status < 400 });
  });

  group('tasks', () => {
    const r = queryTable('tasks', 'select=id,title,status&limit=20', session.access_token);
    check(r, { 'tasks 2xx/empty': (x) => x.status >= 200 && x.status < 400 });
  });

  sleep(0.5);
}

export function handleSummary(data) {
  const m = data?.metrics || {};
  const p95 = m.http_req_duration?.values?.['p(95)'] ?? null;
  const fail = m.http_req_failed?.values?.rate ?? null;
  const checks = m.checks?.values?.rate ?? null;
  const lines = [
    '== k6 SPIKE CRM ==',
    `base_url   : ${BASE_URL}`,
    `peak VUs   : 100`,
    `p95 (ms)   : ${p95 !== null ? p95.toFixed(1) : 'n/a'}`,
    `error_rate : ${fail !== null ? (fail * 100).toFixed(2) + '%' : 'n/a'}`,
    `checks ok  : ${checks !== null ? (checks * 100).toFixed(2) + '%' : 'n/a'}`,
  ].join('\n');
  return { stdout: lines + '\n' };
}
