/**
 * Security utilities for Edge Functions V2
 * Provides input sanitization, prompt injection detection, and rate limiting for Azure GPT-5 calls
 */

// Patterns that may indicate prompt injection attempts
const INJECTION_PATTERNS = [
  /ignore\s+(previous|above|prior|all)\s+instructions/gi,
  /repeat\s+your\s+(system\s+)?prompt/gi,
  /you\s+are\s+(now|actually|really)/gi,
  /disregard\s+(all|previous|above)/gi,
  /new\s+instructions:/gi,
  /<\s*system\s*>/gi,
  /\[SYSTEM\]/gi,
  /forget\s+(everything|all|previous)/gi,
  /override\s+your\s+(instructions|rules)/gi,
  /pretend\s+(you\s+are|to\s+be)/gi,
  /act\s+as\s+if/gi,
  /roleplay\s+as/gi,
  /jailbreak/gi,
  /DAN\s+mode/gi,
  /developer\s+mode/gi,
  /bypass\s+(security|filter|safety)/gi,
  /reveal\s+(your|the)\s+(instructions|prompt|system)/gi,
  /output\s+(your|the)\s+(instructions|prompt)/gi,
];

// Rate limiting storage (in-memory for edge functions)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export interface InjectionDetectionResult {
  isDetected: boolean;
  patterns: string[];
  riskLevel: 'none' | 'low' | 'medium' | 'high';
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  keyPrefix?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterMs?: number;
}

/**
 * Rate limiter for Edge Functions
 * @param key Unique identifier (userId, IP, etc.)
 * @param config Rate limit configuration
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const { maxRequests, windowMs, keyPrefix = 'rl' } = config;
  const fullKey = `${keyPrefix}:${key}`;
  const now = Date.now();
  
  // Clean up expired entries periodically (1 in 10 chance)
  if (Math.random() < 0.1) {
    rateLimitStore.forEach((value, k) => {
      if (value.resetAt < now) {
        rateLimitStore.delete(k);
      }
    });
  }
  
  const existing = rateLimitStore.get(fullKey);
  
  if (!existing || existing.resetAt < now) {
    // New window
    rateLimitStore.set(fullKey, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }
  
  if (existing.count >= maxRequests) {
    // Rate limited
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfterMs: existing.resetAt - now
    };
  }
  
  // Increment counter
  existing.count++;
  return { allowed: true, remaining: maxRequests - existing.count, resetAt: existing.resetAt };
}

/**
 * Detects potential prompt injection patterns in text
 * @param text Text to analyze
 * @returns Detection result with matched patterns and risk level
 */
export function detectPromptInjection(text: string): InjectionDetectionResult {
  if (!text || typeof text !== 'string') {
    return { isDetected: false, patterns: [], riskLevel: 'none' };
  }

  const matchedPatterns: string[] = [];
  
  for (const pattern of INJECTION_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      matchedPatterns.push(pattern.source);
    }
  }

  const patternCount = matchedPatterns.length;
  let riskLevel: 'none' | 'low' | 'medium' | 'high' = 'none';
  
  if (patternCount === 0) {
    riskLevel = 'none';
  } else if (patternCount === 1) {
    riskLevel = 'low';
  } else if (patternCount <= 3) {
    riskLevel = 'medium';
  } else {
    riskLevel = 'high';
  }

  return {
    isDetected: patternCount > 0,
    patterns: matchedPatterns,
    riskLevel,
  };
}

export interface SanitizeOptions {
  maxLength?: number;
  strictMode?: boolean; // If true, throw on injection detection; if false, log warning
  functionName?: string; // For logging purposes
  stripHtml?: boolean; // Remove HTML tags
  normalizeWhitespace?: boolean; // Collapse multiple spaces
}

/**
 * Sanitizes text input for AI processing
 * - Enforces length limits
 * - Detects injection patterns
 * - Optionally strips HTML and normalizes whitespace
 * - Optionally rejects or logs suspicious content
 * 
 * @param text Text to sanitize
 * @param options Sanitization options
 * @returns Sanitized text
 * @throws Error if strictMode is true and injection is detected
 */
export function sanitizeForAI(
  text: string,
  options: SanitizeOptions = {}
): string {
  const {
    maxLength = 10000,
    strictMode = false,
    functionName = 'unknown',
    stripHtml = true,
    normalizeWhitespace = true,
  } = options;

  if (!text || typeof text !== 'string') {
    return '';
  }

  let sanitized = text;

  // 1. Strip HTML tags if enabled
  if (stripHtml) {
    sanitized = sanitized.replace(/<[^>]*>/g, ' ');
  }

  // 2. Normalize whitespace if enabled
  if (normalizeWhitespace) {
    sanitized = sanitized.replace(/\s+/g, ' ').trim();
  }

  // 3. Length limit
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
    console.log(`[Security] Content truncated from ${text.length} to ${maxLength} chars in ${functionName}`);
  }

  // 4. Check for injection patterns
  const detection = detectPromptInjection(sanitized);
  
  if (detection.isDetected) {
    const logMessage = `[Security Warning] Potential prompt injection detected in ${functionName}. Risk: ${detection.riskLevel}, Patterns: ${detection.patterns.join(', ')}`;
    console.warn(logMessage);
    
    if (strictMode && detection.riskLevel !== 'low') {
      throw new Error('Invalid input detected - request rejected for security reasons');
    }
  }

  return sanitized;
}

/**
 * Wraps user content with XML delimiters for enhanced prompt protection
 * This makes it harder for injection attempts to escape the content boundary
 * 
 * @param content User-provided content
 * @param label Label for the content block
 * @returns Wrapped content string
 */
export function wrapUserContent(content: string, label: string = 'USER_CONTENT'): string {
  // Use a random boundary to prevent predictable escaping
  const boundary = `__${label}_${Date.now().toString(36)}__`;
  return `<${boundary}>
${content}
</${boundary}>`;
}

/**
 * Validates request origin and authorization
 * @param req Request object
 * @param allowedOrigins List of allowed origins (or '*' for all)
 */
export function validateRequestOrigin(
  req: Request,
  allowedOrigins: string[] = ['*']
): { valid: boolean; origin: string | null } {
  const origin = req.headers.get('origin');
  
  if (allowedOrigins.includes('*')) {
    return { valid: true, origin };
  }
  
  if (!origin) {
    return { valid: false, origin: null };
  }
  
  const isAllowed = allowedOrigins.some(allowed => {
    if (allowed.includes('*')) {
      const pattern = new RegExp('^' + allowed.replace(/\*/g, '.*') + '$');
      return pattern.test(origin);
    }
    return origin === allowed;
  });
  
  return { valid: isAllowed, origin };
}

/**
 * Logs a security event for audit purposes
 * Can be extended to write to a security_logs table
 * 
 * @param event Security event details
 */
export function logSecurityEvent(event: {
  type: 'injection_attempt' | 'rate_limit' | 'validation_error' | 'suspicious_activity' | 'auth_failure';
  functionName: string;
  userId?: string;
  details: Record<string, unknown>;
  riskLevel: 'low' | 'medium' | 'high';
}): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    ...event,
    contentPreview: typeof event.details.content === 'string' 
      ? event.details.content.substring(0, 200) 
      : undefined,
  };
  
  // Remove full content from log to avoid exposing sensitive data
  const { content, ...safeDetails } = event.details as { content?: string };
  logEntry.details = safeDetails;
  
  console.warn('[Security Audit]', JSON.stringify(logEntry));
}

/**
 * Validates that a value is a non-empty string within length bounds
 */
export function validateStringInput(
  value: unknown,
  fieldName: string,
  options: { minLength?: number; maxLength?: number; required?: boolean; pattern?: RegExp } = {}
): string | null {
  const { minLength = 0, maxLength = 50000, required = false, pattern } = options;
  
  if (value === null || value === undefined) {
    if (required) {
      throw new Error(`${fieldName} is required`);
    }
    return null;
  }
  
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string`);
  }
  
  const trimmed = value.trim();
  
  if (trimmed.length < minLength) {
    throw new Error(`${fieldName} must be at least ${minLength} characters`);
  }
  
  if (trimmed.length > maxLength) {
    throw new Error(`${fieldName} must not exceed ${maxLength} characters`);
  }
  
  if (pattern && !pattern.test(trimmed)) {
    throw new Error(`${fieldName} has an invalid format`);
  }
  
  return trimmed;
}

/**
 * Validates UUID format
 */
export function validateUUID(value: unknown, fieldName: string, required = true): string | null {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  if (value === null || value === undefined || value === '') {
    if (required) {
      throw new Error(`${fieldName} is required`);
    }
    return null;
  }
  
  if (typeof value !== 'string' || !uuidPattern.test(value)) {
    throw new Error(`${fieldName} must be a valid UUID`);
  }
  
  return value;
}

/**
 * Validates email format
 */
export function validateEmail(value: unknown, fieldName: string, required = true): string | null {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (value === null || value === undefined || value === '') {
    if (required) {
      throw new Error(`${fieldName} is required`);
    }
    return null;
  }
  
  if (typeof value !== 'string' || !emailPattern.test(value)) {
    throw new Error(`${fieldName} must be a valid email address`);
  }
  
  return value.toLowerCase().trim();
}

/**
 * Create a standardized error response for Edge Functions
 */
/**
 * Strips boundary tags generated by wrapUserContent from AI responses
 * Removes patterns like <__LABEL_xxx__> and </__LABEL_xxx__>
 */
export function stripBoundaryTags(text: string): string {
  return text.replace(/<\/?__[A-Z_]+_[a-z0-9]+__>/g, '').trim();
}

export function createSecurityErrorResponse(
  message: string,
  status: number,
  corsHeaders: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({ 
      success: false, 
      error: message,
      timestamp: new Date().toISOString()
    }),
    { 
      status, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}
