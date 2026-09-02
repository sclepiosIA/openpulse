/**
 * Sanitizer for Supabase/PostgREST error messages.
 * Prevents exposing table names, RLS policy names, and internal DB structure in toasts.
 */

const SANITIZATION_RULES: Array<{ pattern: RegExp; message: string }> = [
  // RLS violations
  { pattern: /new row violates row-level security policy/i, message: "Vous n'avez pas les permissions pour cette action." },
  { pattern: /violates row-level security/i, message: "Vous n'avez pas les permissions pour cette action." },
  
  // Foreign key violations
  { pattern: /violates foreign key constraint/i, message: "Cet élément est lié à d'autres données et ne peut pas être modifié." },
  { pattern: /is still referenced from table/i, message: "Cet élément est utilisé ailleurs et ne peut pas être supprimé." },
  
  // Unique violations
  { pattern: /violates unique constraint/i, message: "Un élément avec ces informations existe déjà." },
  { pattern: /duplicate key value/i, message: "Un élément avec ces informations existe déjà." },
  
  // Not null violations
  { pattern: /violates not-null constraint/i, message: "Un champ obligatoire n'a pas été renseigné." },
  { pattern: /null value in column/i, message: "Un champ obligatoire n'a pas été renseigné." },
  
  // Check constraint violations
  { pattern: /violates check constraint/i, message: "Les données saisies ne respectent pas les règles de validation." },
  
  // Permission errors
  { pattern: /permission denied for table/i, message: "Vous n'avez pas les permissions nécessaires." },
  { pattern: /permission denied/i, message: "Vous n'avez pas les permissions nécessaires." },
  
  // Auth errors
  { pattern: /JWT expired/i, message: "Votre session a expiré. Veuillez vous reconnecter." },
  { pattern: /invalid claim/i, message: "Erreur d'authentification. Veuillez vous reconnecter." },
  { pattern: /missing email or phone/i, message: "Veuillez renseigner votre email." },
  { pattern: /invalid login credentials/i, message: "Email ou mot de passe incorrect." },
  { pattern: /email not confirmed/i, message: "Votre email n'a pas encore été confirmé." },
  { pattern: /user not found/i, message: "Aucun compte trouvé avec cet email." },
  { pattern: /password.*(short|weak|requirement)/i, message: "Le mot de passe ne respecte pas les exigences de sécurité." },
  { pattern: /signup.*disabled|signups.*not allowed/i, message: "Les inscriptions sont désactivées." },
  
  // PostgREST specific
  { pattern: /Could not find a relationship between/i, message: "Erreur de configuration. Contactez le support." },
  { pattern: /function .+ does not exist/i, message: "Fonctionnalité temporairement indisponible." },
  { pattern: /relation .+ does not exist/i, message: "Erreur de configuration. Contactez le support." },
  
  // Supabase Auth / GoTrue incidents (504, DB unreachable) — MUST come before generic timeout
  { pattern: /Database error querying schema/i, message: "Le serveur d'authentification est temporairement indisponible. Réessayez dans quelques minutes — incident temporaire côté infrastructure." },
  { pattern: /context deadline exceeded|request_timeout|error finding user/i, message: "Le serveur d'authentification est temporairement indisponible. Réessayez dans quelques minutes — incident temporaire côté infrastructure." },
  { pattern: /\b504\b|gateway timeout|upstream.*(timeout|unavailable)/i, message: "Le serveur est temporairement indisponible (504). Réessayez dans quelques minutes." },
  { pattern: /\b503\b|service unavailable/i, message: "Service temporairement indisponible. Réessayez dans quelques instants." },
  { pattern: /La connexion au serveur a expir/i, message: "Le serveur met trop de temps à répondre. Réessayez dans quelques minutes — incident temporaire possible." },

  // Network/timeout (generic)
  { pattern: /FetchError|fetch failed|network/i, message: "Erreur réseau. Vérifiez votre connexion internet." },
  { pattern: /timeout|AbortError/i, message: "La requête a pris trop de temps. Réessayez." },
  
  // Rate limiting
  { pattern: /too many requests|rate limit/i, message: "Trop de requêtes. Veuillez patienter." },
  { pattern: /429/i, message: "Trop de requêtes. Veuillez patienter." },
];

/**
 * Sanitize a Supabase error message for user-facing display.
 * Strips table names, policy names, and internal details.
 */
export function sanitizeSupabaseError(error: unknown): string {
  const message = error instanceof Error 
    ? error.message 
    : (typeof error === 'object' && error !== null && 'message' in error)
      ? String((error as { message: unknown }).message)
      : String(error || '');
  
  for (const rule of SANITIZATION_RULES) {
    if (rule.pattern.test(message)) {
      return rule.message;
    }
  }
  
  // If the message contains "for table" or "on table", it's likely leaking a table name
  if (/for table|on table|from table/i.test(message)) {
    return "Une erreur est survenue lors de l'opération.";
  }
  
  // If the message looks like a raw PostgreSQL error, sanitize it
  if (/^(ERROR|FATAL|PANIC):/i.test(message) || /pg_/i.test(message)) {
    return "Une erreur technique est survenue. Réessayez ou contactez le support.";
  }
  
  // Return original message if it doesn't match any sensitive pattern
  // (it might be a legitimate user-facing error from our own code)
  return message || "Une erreur inconnue est survenue.";
}

/**
 * Create a sanitized error handler for toast notifications.
 * Usage: toast.error(sanitizeSupabaseError(error))
 */
export function getSafeErrorMessage(error: unknown, fallback?: string): string {
  const sanitized = sanitizeSupabaseError(error);
  return sanitized || fallback || "Une erreur est survenue.";
}
