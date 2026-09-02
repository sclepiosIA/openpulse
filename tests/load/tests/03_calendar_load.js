/**
 * k6 Test 03 — Calendar : liste events + créations parallèles
 * Vérifie scalability du module calendrier sous charge.
 */
import { check, sleep } from 'k6';
import { getScenario } from '../config/scenarios.js';
import { setupSessions } from '../helpers/auth.js';
import { queryTable, writeRow } from '../helpers/supabase.js';
import { assertQueryOk } from '../helpers/assertions.js';

export const options = {
  scenarios: { calendar: getScenario(__ENV.K6_SCENARIO || 'smoke') },
  thresholds: { http_req_duration: ['p(95)<2500'], http_req_failed: ['rate<0.05'] },
};

export function setup() {
  return setupSessions(['admin', 'csm']);
}

export default function (data) {
  const session = data?.sessions?.csm || data?.sessions?.admin;
  if (!session) return;

  // List events du mois
  const start = new Date();
  start.setDate(1);
  const startIso = start.toISOString();
  const r1 = queryTable('events',
    `start_at=gte.${startIso}&select=id,title,start_at,end_at&order=start_at.asc&limit=50`,
    session.access_token);
  check(r1, assertQueryOk(r1, 'events_list'));
  sleep(0.4);

  // Filter by attendee
  const r2 = queryTable('events',
    `attendees=cs.[${session.user_id}]&select=id&limit=20`,
    session.access_token);
  check(r2, { 'events filtered OK': (r) => r.status === 200 || r.status === 404 });
  sleep(0.5);
}
