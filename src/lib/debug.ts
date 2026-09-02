const isDevelopment = import.meta.env.DEV;

/**
 * Production-safe debug utility
 * - log/info: Only in development
 * - warn/error: Always (needed for debugging)
 * 
 * IMPORTANT: Never log sensitive data (tokens, passwords, sessions)
 */
export const debug = {
  log: (...args: unknown[]) => isDevelopment && console.log(...args),
  info: (...args: unknown[]) => isDevelopment && console.info(...args),
  warn: (...args: unknown[]) => {
    // In production, only log warnings without sensitive data
    if (isDevelopment) {
      console.warn(...args);
    } else {
      // Filter out potentially sensitive warnings in production
      const message = typeof args[0] === 'string' ? args[0] : '';
      if (!message.includes('session') && !message.includes('token')) {
        console.warn(...args);
      }
    }
  },
  error: (...args: unknown[]) => console.error(...args),
  
  /**
   * Mask sensitive identifiers for safe logging
   * Example: maskId('abc123-def456-ghi789') => 'abc123***'
   */
  maskId: (id: string | null | undefined): string => {
    if (!id) return '[null]';
    if (id.length <= 8) return '***';
    return `${id.substring(0, 8)}***`;
  },
};
