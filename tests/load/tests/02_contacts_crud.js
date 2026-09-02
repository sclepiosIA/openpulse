/**
 * k6 Test 02 — Contacts CRUD load (CSM workflow)
 * Simule: liste 50 contacts → recherche → fiche détaillée.
 */
import { check, sleep } from 'k6';
import { getScenario } from '../config/scenarios.js';
import { setupSessions } from '../helpers/auth.js';
import { queryTable } from '../helpers/supabase.js';
import { assertQueryOk } from '../helpers/assertions.js';

export const options = {
  scenarios: { contacts_crud: getScenario(__ENV.K6_SCENARIO || 'smoke') },
  thresholds: { http_req_duration: ['p(95)<2000'], http_req_failed: ['rate<0.05'] },
};

export function setup() {
  return setupSessions(['admin', 'csm', 'sales']);
}

export default function (data) {
  const session = data?.sessions?.csm || data?.sessions?.admin;
  if (!session) return;

  // Liste 50 derniers contacts
  const r1 = queryTable('contacts', 'select=id,first_name,last_name,email&order=created_at.desc&limit=50', session.access_token);
  check(r1, assertQueryOk(r1, 'contacts_list'));
  sleep(0.4);

  // Recherche par nom (full-text)
  const r2 = queryTable('contacts', "or=(first_name.ilike.*Marie*,last_name.ilike.*Dupont*)&select=id&limit=20", session.access_token);
  check(r2, assertQueryOk(r2, 'contacts_search'));
  sleep(0.3);

  // Fiche détaillée d'un contact
  if (r1.status === 200) {
    try {
      const contacts = JSON.parse(r1.body);
      if (contacts.length > 0) {
        const id = contacts[Math.floor(Math.random() * contacts.length)].id;
        const r3 = queryTable('contacts', `id=eq.${id}&select=*`, session.access_token);
        check(r3, assertQueryOk(r3, 'contact_detail'));
      }
    } catch (e) { /* skip */ }
  }
  sleep(1);
}
