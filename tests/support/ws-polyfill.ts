/**
 * WebSocket polyfill for Node < 22.
 *
 * `@supabase/supabase-js` uses Realtime, which requires a global `WebSocket`.
 * Node 22+ ships a native implementation, but on Node 20 (still the default
 * for many CI runners including Playwright's) it is missing and Realtime
 * throws `ReferenceError: WebSocket is not defined` on client instantiation.
 *
 * This polyfill installs the `ws` package as `globalThis.WebSocket` when
 * missing. **It MUST be imported before `@supabase/supabase-js`** so the
 * Realtime constructor picks it up.
 *
 * Usage (test file, first import):
 *   import '../support/ws-polyfill';
 *   import { createClient } from '@supabase/supabase-js';
 */

import WebSocket from 'ws'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = globalThis as any

if (typeof g.WebSocket === 'undefined') {
  g.WebSocket = WebSocket
}

export {}
