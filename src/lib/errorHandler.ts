import { debug } from './debug';

/**
 * Type guard to check if error is an Error instance
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Extract error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  
  return 'Une erreur inconnue est survenue';
}

/**
 * Log error with context
 */
export function logError(error: unknown, context: string): void {
  const message = getErrorMessage(error);
  debug.error(`[${context}]`, message, error);
}

/**
 * Handle error with logging and optional callback
 */
export function handleError(
  error: unknown, 
  context: string,
  onError?: (message: string) => void
): void {
  const message = getErrorMessage(error);
  logError(error, context);
  
  if (onError) {
    onError(message);
  }
}
