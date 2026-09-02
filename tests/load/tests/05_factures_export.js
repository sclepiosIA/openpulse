/**
 * k6 Test 05 — Factures : list + export PDF burst
 * Critique car export PDF peut saturer Edge Functions.
 */
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';
import { getScenario } from '../config/scenarios.js';
import { setupSessions } from '../helpers/auth.js';
import { queryTable, callEdgeFunction } from '../helpers/supabase.js';
import { assertQueryOk } from '../helpers/assertions.js';

const pdfExportLatency = new Trend('pdf_export_latency', true);

export const options = {
  scenarios: { factures: getScenario(__ENV.K6_SCENARIO || 'smoke') },
  thresholds: {
    http_req_duration: ['p(95)<5000'],
    http_req_failed: ['rate<0.05'],
    pdf_export_latency: ['p(95)<10000'],
  },
};

export function setup() {
  return setupSessions(['admin', 'finance']);
}

export default function (data) {
  const session = data?.sessions?.finance || data?.sessions?.admin;
  if (!session) return;

  // List factures
  const r1 = queryTable('factures',
    'select=id,numero,total_ttc,status&order=created_at.desc&limit=50',
    session.access_token);
  check(r1, assertQueryOk(r1, 'factures_list'));
  sleep(0.4);

  // Export PDF d'une facture
  if (r1.status === 200) {
    try {
      const factures = JSON.parse(r1.body);
      if (factures.length > 0) {
        const id = factures[0].id;
        const t0 = Date.now();
        const r2 = callEdgeFunction('generate-pdf', { facture_id: id }, session.access_token);
        pdfExportLatency.add(Date.now() - t0);
        check(r2, { 'pdf gen ok or 429': (r) => r.status === 200 || r.status === 429 });
      }
    } catch (e) {}
  }
  sleep(2);
}
