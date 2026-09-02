/**
 * k6 STRESS — CRM Hospitalier
 *
 * Capacity test : ramp 0 → 200 VUs sur 10 min pour trouver le point de rupture.
 * Pas de threshold strict (on cherche jusqu'à quand ça tient).
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { setupSessions, healthCheck, BASE_URL, SKIP_AUTH } from './helpers/auth.js';
import { queryTable } from './helpers/supabase.js';

export const options = {
  scenarios: {
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 40 },
        { duration: '2m', target: 80 },
        { duration: '2m', target: 120 },
        { duration: '2m', target: 160 },
        { duration: '1m', target: 200 },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  // Pas de threshold : on observe la dégradation.
  thresholds: {},
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
    const r = queryTable('etablissements', 'select=id,nom,statut&limit=50', session.access_token);
    check(r, { 'etab response': (x) => x.status > 0 });
  });

  group('tasks', () => {
    const r = queryTable('tasks', 'select=id,title,status&limit=50', session.access_token);
    check(r, { 'tasks response': (x) => x.status > 0 });
  });

  sleep(0.5);
}

export function handleSummary(data) {
  const m = data?.metrics || {};
  const p95 = m.http_req_duration?.values?.['p(95)'] ?? null;
  const p99 = m.http_req_duration?.values?.['p(99)'] ?? null;
  const fail = m.http_req_failed?.values?.rate ?? null;
  const checks = m.checks?.values?.rate ?? null;
  const vusMax = m.vus_max?.values?.max ?? null;
  const lines = [
    '== k6 STRESS CRM ==',
    `base_url     : ${BASE_URL}`,
    `peak VUs     : ${vusMax !== null ? vusMax : '200 (target)'}`,
    `p95 (ms)     : ${p95 !== null ? p95.toFixed(1) : 'n/a'}`,
    `p99 (ms)     : ${p99 !== null ? p99.toFixed(1) : 'n/a'}`,
    `error_rate   : ${fail !== null ? (fail * 100).toFixed(2) + '%' : 'n/a'}`,
    `checks ok    : ${checks !== null ? (checks * 100).toFixed(2) + '%' : 'n/a'}`,
    '(stress test : pas de threshold strict — observer le point de rupture)',
  ].join('\n');
  return { stdout: lines + '\n' };
}
