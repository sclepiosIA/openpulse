/**
 * AES-256-GCM encryption for Google OAuth tokens at rest.
 * Mirrors the pattern used in qonto-auth.
 *
 * Key resolution: prefers GOOGLE_TOKEN_ENCRYPTION_KEY, falls back to
 * SUPABASE_SERVICE_ROLE_KEY so functions keep working if the dedicated
 * secret has not been provisioned yet. Operators should set
 * GOOGLE_TOKEN_ENCRYPTION_KEY in production for proper key separation.
 *
 * Storage format: "<iv-base64>.<ciphertext-base64>"
 * Plaintext legacy values (no '.') are returned as-is by decryptToken
 * so existing rows continue to work until naturally rotated.
 */

function getKeyMaterial(opts: { allowLegacyFallback?: boolean } = {}): Uint8Array {
  const dedicated = Deno.env.get('GOOGLE_TOKEN_ENCRYPTION_KEY')
  if (dedicated) {
    return new TextEncoder().encode(dedicated.padEnd(32, '0').slice(0, 32))
  }
  // Legacy fallback: only used for DECRYPTION of rows encrypted before
  // GOOGLE_TOKEN_ENCRYPTION_KEY was provisioned. Never used for new encryption.
  if (opts.allowLegacyFallback) {
    const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (legacy) {
      return new TextEncoder().encode(legacy.padEnd(32, '0').slice(0, 32))
    }
  }
  throw new Error(
    'GOOGLE_TOKEN_ENCRYPTION_KEY is not configured. Generate one with `openssl rand -hex 32` and set it as a Supabase secret.'
  )
}

export async function encryptToken(token: string): Promise<string> {
  if (!token) return token
  const keyData = getKeyMaterial()
  const key = await crypto.subtle.importKey('raw', new Uint8Array(keyData), 'AES-GCM', false, [
    'encrypt',
  ])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = new TextEncoder().encode(token)
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data)
  const ivB64 = btoa(String.fromCharCode(...iv))
  const encB64 = btoa(String.fromCharCode(...new Uint8Array(encrypted)))
  return `${ivB64}.${encB64}`
}

export async function decryptToken(stored: string | null | undefined): Promise<string | null> {
  if (!stored) return null
  // Legacy plaintext (no separator) — return unchanged for backward compatibility.
  if (!stored.includes('.')) return stored
  const [ivB64, encB64] = stored.split('.')
  const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0))
  const ciphertext = Uint8Array.from(atob(encB64), (c) => c.charCodeAt(0))

  // Try the dedicated key first, then fall back to the legacy service-role key
  // for rows encrypted before GOOGLE_TOKEN_ENCRYPTION_KEY was provisioned.
  for (const allowLegacyFallback of [false, true]) {
    try {
      const keyData = getKeyMaterial({ allowLegacyFallback })
      const key = await crypto.subtle.importKey('raw', new Uint8Array(keyData), 'AES-GCM', false, [
        'decrypt',
      ])
      const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
      return new TextDecoder().decode(decrypted)
    } catch {
      // try next key
    }
  }
  console.error('[google-token-crypto] Decrypt failed with all known keys')
  return stored
}
