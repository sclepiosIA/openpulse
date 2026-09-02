/**
 * Helper to create a Supabase client scoped to a visitor live-chat session.
 *
 * Visitor RLS on `live_chat_messages` and `live_chat_sessions` requires the
 * unguessable `session_token` (issued at session creation) to be presented
 * via the `x-session-token` request header. This client wires that header
 * into every PostgREST request the visitor makes for their session.
 */
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabaseBrowser';

const SUPABASE_PUBLISHABLE_KEY = SUPABASE_ANON_KEY;

export function createLiveChatVisitorClient(sessionToken: string) {
  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        'x-session-token': sessionToken,
      },
    },
  });
}
