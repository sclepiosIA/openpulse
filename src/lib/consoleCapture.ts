/**
 * Console Capture - Capture les logs console pour les feedbacks utilisateurs
 * Buffer circulaire pour conserver les N derniers logs
 * 
 * In production, only errors are captured to reduce noise.
 */

// Detect if we're in development mode
const isDevelopment = import.meta.env.DEV || 
  window.location.hostname === 'localhost' || 
  window.location.hostname.includes('previsualisation.example.org');

export interface LogEntry {
  level: 'log' | 'info' | 'warn' | 'error';
  timestamp: number;
  args: string[];
}

class ConsoleCapture {
  private buffer: LogEntry[] = [];
  private maxSize = 50; // Garder les 50 derniers logs
  private initialized = false;

  init() {
    if (this.initialized) return;
    this.initialized = true;

    const levels = ['log', 'info', 'warn', 'error'] as const;
    type ConsoleLevel = typeof levels[number];
    
    levels.forEach(level => {
      const original = console[level].bind(console);
      const consoleMutable = console as Record<ConsoleLevel, (...args: unknown[]) => void>;
      consoleMutable[level] = (...args: unknown[]) => {
        // In production, only capture errors
        // In development, capture everything
        const shouldCapture = isDevelopment || level === 'error';
        if (shouldCapture) {
          this.capture(level, args);
        }
        original(...args);
      };
    });

    if (isDevelopment) {
      console.info('[ConsoleCapture] Initialized - capturing all logs (dev mode)');
    }
  }

  private sanitize(text: string): string {
    // Strip potential JWT tokens, API keys, and passwords from captured logs
    return text
      .replace(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g, '[JWT_REDACTED]')
      .replace(/"(?:access_token|refresh_token|api[_-]?key|password|secret|authorization)"\s*:\s*"[^"]+"/gi, '"$1": "[REDACTED]"')
      .replace(/Bearer\s+[A-Za-z0-9._-]{20,}/gi, 'Bearer [REDACTED]');
  }

  private capture(level: LogEntry['level'], args: unknown[]) {
    const entry: LogEntry = {
      level,
      timestamp: Date.now(),
      args: args.map(arg => {
        try {
          if (arg instanceof Error) {
            return this.sanitize(`${arg.name}: ${arg.message}\n${arg.stack || ''}`);
          }
          if (typeof arg === 'object' && arg !== null) {
            return this.sanitize(JSON.stringify(arg, null, 2));
          }
          return this.sanitize(String(arg));
        } catch {
          return '[Non-serializable]';
        }
      })
    };

    this.buffer.push(entry);
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }
  }

  getLogs(): LogEntry[] {
    return [...this.buffer];
  }

  getFormattedLogs(): string {
    return this.buffer.map(entry => {
      const time = new Date(entry.timestamp).toLocaleTimeString('fr-FR');
      const levelIcon = {
        log: '📝',
        info: 'ℹ️',
        warn: '⚠️',
        error: '❌'
      }[entry.level];
      return `[${time}] ${levelIcon} ${entry.level.toUpperCase()}: ${entry.args.join(' ')}`;
    }).join('\n');
  }

  clear() {
    this.buffer = [];
  }

  getErrorLogs(): LogEntry[] {
    return this.buffer.filter(entry => entry.level === 'error' || entry.level === 'warn');
  }

  /**
   * Capture an external log entry (e.g., from filtered console.error wrappers)
   * This allows capturing logs that are suppressed from the visible console
   */
  captureExternal(level: LogEntry['level'], args: unknown[]) {
    this.capture(level, args);
  }
}

export const consoleCapture = new ConsoleCapture();
