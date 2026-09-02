/**
 * Shared error sanitizer for Edge Functions
 * Maps internal errors to safe user-facing messages
 * Prevents leaking stack traces, file paths, and internal state
 */

const ERROR_MAPPINGS: Array<{ pattern: string; message: string }> = [
  { pattern: 'SMTP auth failed', message: 'Email authentication failed. Please check your credentials.' },
  { pattern: 'Azure OpenAI', message: 'AI service temporarily unavailable. Please try again.' },
  { pattern: 'rate limit', message: 'Too many requests. Please wait a moment and try again.' },
  { pattern: '429', message: 'Service rate limit reached. Please try again shortly.' },
  { pattern: 'timeout', message: 'Request timed out. Please try again.' },
  { pattern: 'AbortError', message: 'Request timed out. Please try again.' },
  { pattern: 'IMAP', message: 'Email server connection failed. Please check your settings.' },
  { pattern: 'storage', message: 'File storage error. Please try again.' },
  { pattern: 'JWT', message: 'Authentication error. Please sign in again.' },
  { pattern: 'Unauthorized', message: 'You are not authorized to perform this action.' },
  { pattern: 'not found', message: 'The requested resource was not found.' },
  { pattern: 'VAPID', message: 'Push notification configuration error.' },
  { pattern: 'encryption', message: 'Security configuration error. Contact support.' },
];

/**
 * Sanitize an error for client-facing responses.
 * Returns a safe, generic message instead of internal details.
 */
export function sanitizeErrorForClient(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    for (const mapping of ERROR_MAPPINGS) {
      if (msg.includes(mapping.pattern.toLowerCase())) {
        return mapping.message;
      }
    }
  }
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Create a safe error log object (no sensitive data).
 * Use this for console.error in edge functions.
 */
export function safeErrorLog(functionName: string, error: unknown): Record<string, unknown> {
  const log: Record<string, unknown> = {
    function: functionName,
    timestamp: new Date().toISOString(),
  };

  if (error instanceof Error) {
    log.errorName = error.name;
    log.errorMessage = error.message;
    // Only include stack in non-production for debugging
  } else {
    log.errorType = typeof error;
    log.errorString = String(error).substring(0, 200);
  }

  return log;
}

/**
 * Build a standardized error response for edge functions.
 */
export function buildErrorResponse(
  functionName: string,
  error: unknown,
  corsHeaders: Record<string, string>,
  statusCode: number = 500
): Response {
  // Log full details server-side (Supabase logs only)
  console.error(`[${functionName}] Error:`, safeErrorLog(functionName, error));

  // Return sanitized message to client
  return new Response(
    JSON.stringify({ error: sanitizeErrorForClient(error) }),
    {
      status: statusCode,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}
