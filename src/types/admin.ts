/**
 * Types for admin operations
 */

/**
 * Application error with additional context
 */
export interface ApplicationError extends Error {
  details?: string;
  isApplicationError: boolean;
}

/**
 * Create a typed application error
 */
export function createApplicationError(
  message: string, 
  details?: string
): ApplicationError {
  const error = new Error(message) as ApplicationError;
  error.details = details;
  error.isApplicationError = true;
  return error;
}

/**
 * Reset password request data
 */
export interface ResetPasswordData {
  userId: string;
  newPassword: string;
}

/**
 * Reset password response
 */
export interface ResetPasswordResult {
  success: boolean;
  message?: string;
  error?: string;
  details?: string;
}
