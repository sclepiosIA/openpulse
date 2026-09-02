/**
 * k6 Test 04 — Pulse messaging (DM + group) sous charge
 * Vérifie que la messagerie interne tient avec N conversations en parallèle.
 */
import { check, sleep } from 'k6';
import { getScenario } from '../config/scenarios.js';
import { setupSessions } from '../helpers/auth.js';
import { queryTable } from '../helpers/supabase.js';
import { assertQueryOk } from '../helpers/assertions.js';

export const options = {
  scenarios: { pulse: getScenario(__ENV.K6_SCENARIO || 'smoke') },
  thresholds: { http_req_duration: ['p(95)<2000'], http_req_failed: ['rate<0.05'] },
};

export function setup() {
  return setupSessions(['admin', 'csm', 'sales']);
}

export default function (data) {
  const session = data?.sessions?.csm || data?.sessions?.admin;
  if (!session) return;

  // List conversations
  const r1 = queryTable('pulse_conversations',
    `participants=cs.[${session.user_id}]&select=id,name,last_message_at&order=last_message_at.desc&limit=30`,
    session.access_token);
  check(r1, assertQueryOk(r1, 'conversations'));
  sleep(0.3);

  // For first conversation, load messages
  if (r1.status === 200) {
    try {
      const convs = JSON.parse(r1.body);
      if (convs.length > 0) {
        const r2 = queryTable('pulse_messages',
          `conversation_id=eq.${convs[0].id}&select=id,content,created_at&order=created_at.desc&limit=50`,
          session.access_token);
        check(r2, assertQueryOk(r2, 'messages'));
      }
    } catch (e) {}
  }
  sleep(1);
}
