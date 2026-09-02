/**
 * k6 Supabase Helper — Edge Functions + REST API + WRITE ops + custom Trends
 */
import http from 'k6/http';
import { Trend } from 'k6/metrics';
import { BASE_URL, ANON_KEY } from './auth.js';

// ── Custom business metrics ──────────────────────────────
export const pmsiCodingDuration = new Trend('pmsi_coding_duration', true);
export const aiResponseDuration = new Trend('ai_response_duration', true);
export const writeLatency = new Trend('write_latency', true);

// ── Helpers ──────────────────────────────────────────────

function baseHeaders(token) {
  const headers = {
    'Content-Type': 'application/json',
    apikey: ANON_KEY,
    Prefer: 'return=representation',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Appelle une Edge Function Supabase
 */
export function callEdgeFunction(name, payload, token) {
  const headers = {
    'Content-Type': 'application/json',
    apikey: ANON_KEY,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return http.post(
    `${BASE_URL}/functions/v1/${name}`,
    JSON.stringify(payload),
    { headers }
  );
}

/**
 * Requête GET sur une table via REST API
 */
export function queryTable(table, params = '', token) {
  return http.get(`${BASE_URL}/rest/v1/${table}?${params}`, {
    headers: baseHeaders(token),
  });
}

/**
 * Insère un enregistrement via REST API
 */
export function insertRecord(table, data, token) {
  const start = Date.now();
  const res = http.post(
    `${BASE_URL}/rest/v1/${table}`,
    JSON.stringify(data),
    { headers: baseHeaders(token) }
  );
  writeLatency.add(Date.now() - start);
  return res;
}

/**
 * Met à jour un enregistrement via REST API (PATCH)
 */
export function updateRecord(table, filters, data, token) {
  const start = Date.now();
  const res = http.patch(
    `${BASE_URL}/rest/v1/${table}?${filters}`,
    JSON.stringify(data),
    { headers: baseHeaders(token) }
  );
  writeLatency.add(Date.now() - start);
  return res;
}

/**
 * Supprime un enregistrement via REST API (DELETE)
 */
export function deleteRecord(table, filters, token) {
  const start = Date.now();
  const res = http.del(
    `${BASE_URL}/rest/v1/${table}?${filters}`,
    null,
    { headers: baseHeaders(token) }
  );
  writeLatency.add(Date.now() - start);
  return res;
}
