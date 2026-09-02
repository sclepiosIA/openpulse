import { consoleCapture } from './consoleCapture';
import { supabase } from '@/integrations/supabase/client';

/**
 * Filtered console.error patterns.
 * These are known non-actionable errors that are suppressed from the visible console
 * but still captured in the feedback buffer via consoleCapture.
 * 
 * Patterns:
 * - ip-validator 401: Expected for unauthenticated users
 * - supabase auth 401: Expected for unauthenticated users
 * - removeChild/appendChild: DOM manipulation errors handled by global error handler
 * - Unrecognized feature: Browser warnings, not actionable
 * - dev-sw.js ServiceWorker: Dev-only SW noise
 */
const SUPPRESSED_PATTERNS = [
  { test: (msg: string) => msg.includes('ip-validator') && msg.includes('401') },
  { test: (msg: string) => msg.includes('401') && msg.includes('supabase.co/auth/v1/user') },
  { test: (msg: string) => msg.includes('removeChild') || msg.includes('appendChild') },
  { test: (msg: string) => msg.includes('Unrecognized feature') },
  { test: (msg: string) => msg.includes('dev-sw.js') && msg.includes('ServiceWorker') },
  { test: (msg: string) => msg.includes('postMessage') && msg.includes('generation.example.org') },
  { test: (msg: string) => msg.includes('manifest.webmanifest') },
  { test: (msg: string) => msg.includes('StrategyHandler') && msg.includes('Failed to fetch') },
  { test: (msg: string) => msg.includes('Lock') && msg.includes('auth-token') && msg.includes('not released') },
  { test: (msg: string) => msg.includes('push_notification_preferences') && msg.includes('400') },
  { test: (msg: string) => msg.includes('Lock broken by another request') },
  { test: (msg: string) => msg.includes('Service worker') && msg.includes('timeout') },
  // CSP frame-ancestors via <meta>: navigateur ignore (doit être un header HTTP), non-actionnable côté code
  { test: (msg: string) => msg.includes('frame-ancestors') && (msg.includes('meta') || msg.includes('ignored')) },
  // Pulse presence orphan rows: avant migration certains anciens écrans envoyaient encore l'ancien schéma — silencieux le temps que les caches navigateur se vident
  { test: (msg: string) => msg.includes('pulse_presence') && (msg.includes('403') || msg.includes('409')) },
];

/**
 * Install a filtered console.error that suppresses known non-actionable errors
 * while still capturing them in the feedback buffer.
 */
export function installConsoleErrorFilter(): void {
  const originalConsoleError = console.error;

  console.error = (...args: unknown[]) => {
    const message = args.join(' ');

    // Always capture in the feedback buffer before filtering
    consoleCapture.captureExternal('error', args);

    // Suppress known non-actionable patterns
    if (SUPPRESSED_PATTERNS.some(p => p.test(message))) {
      return;
    }

    originalConsoleError.apply(console, args as Parameters<typeof console.error>);
  };
}
