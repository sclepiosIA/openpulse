import {
  assertEquals,
  assertExists,
  assertThrows,
  assertRejects,
} from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { decryptToken, encryptToken } from './google-token-crypto.ts'

const ENV_KEYS = ['GOOGLE_TOKEN_ENCRYPTION_KEY', 'SUPABASE_SERVICE_ROLE_KEY'] as const

type EnvKey = (typeof ENV_KEYS)[number]

async function withEnv<T>(
  vars: Partial<Record<EnvKey, string | undefined>>,
  fn: () => T | Promise<T>
): Promise<T> {
  const previous = new Map<EnvKey, string | undefined>()

  for (const key of ENV_KEYS) {
    previous.set(key, Deno.env.get(key))

    if (Object.prototype.hasOwnProperty.call(vars, key)) {
      const value = vars[key]
      if (value === undefined) {
        Deno.env.delete(key)
      } else {
        Deno.env.set(key, value)
      }
    } else {
      Deno.env.delete(key)
    }
  }

  try {
    return await fn()
  } finally {
    for (const key of ENV_KEYS) {
      const value = previous.get(key)
      if (value === undefined) {
        Deno.env.delete(key)
      } else {
        Deno.env.set(key, value)
      }
    }
  }
}

function deriveAes256KeyMaterial(secret: string): Uint8Array {
  return new TextEncoder().encode(secret.padEnd(32, '0').slice(0, 32))
}

function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0))
}

async function encryptWithModuleCompatibleKey(
  plaintext: string,
  secret: string,
  iv = Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(deriveAes256KeyMaterial(secret)),
    'AES-GCM',
    false,
    ['encrypt']
  )

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext)
  )

  return `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(encrypted))}`
}

Deno.test('module exports the token crypto helpers', () => {
  assertExists(encryptToken)
  assertExists(decryptToken)
  assertEquals(typeof encryptToken, 'function')
  assertEquals(typeof decryptToken, 'function')
})

Deno.test(
  "encryptToken encrypts to '<iv-base64>.<ciphertext-base64>' and decryptToken restores the original token",
  async () => {
    await withEnv(
      {
        GOOGLE_TOKEN_ENCRYPTION_KEY: 'test-dedicated-google-token-key-material',
      },
      async () => {
        const token = 'ya29.test-refresh-token_émoji_🔐'
        const encrypted = await encryptToken(token)

        assertEquals(encrypted === token, false)

        const parts = encrypted.split('.')
        assertEquals(parts.length, 2)

        const [ivB64, ciphertextB64] = parts
        assertExists(ivB64)
        assertExists(ciphertextB64)

        const iv = base64ToBytes(ivB64)
        const ciphertext = base64ToBytes(ciphertextB64)

        assertEquals(iv.length, 12)
        assertEquals(ciphertext.length > token.length, true)

        const decrypted = await decryptToken(encrypted)
        assertEquals(decrypted, token)
      }
    )
  }
)

Deno.test(
  'encryptToken returns an empty token unchanged without requiring an encryption key',
  async () => {
    await withEnv({}, async () => {
      assertEquals(await encryptToken(''), '')
    })
  }
)

Deno.test('decryptToken returns null for null, undefined, and empty stored values', async () => {
  await withEnv({}, async () => {
    assertEquals(await decryptToken(null), null)
    assertEquals(await decryptToken(undefined), null)
    assertEquals(await decryptToken(''), null)
  })
})

Deno.test(
  'decryptToken returns legacy plaintext values unchanged without requiring keys',
  async () => {
    await withEnv({}, async () => {
      assertEquals(
        await decryptToken('legacy-plaintext-refresh-token'),
        'legacy-plaintext-refresh-token'
      )
    })
  }
)

Deno.test(
  'encryptToken requires GOOGLE_TOKEN_ENCRYPTION_KEY and does not use SUPABASE_SERVICE_ROLE_KEY for new encryption',
  async () => {
    await withEnv(
      {
        SUPABASE_SERVICE_ROLE_KEY: 'test-legacy-service-role-key-material',
      },
      async () => {
        await assertRejects(
          () => encryptToken('new-refresh-token'),
          Error,
          'GOOGLE_TOKEN_ENCRYPTION_KEY is not configured'
        )
      }
    )
  }
)

Deno.test(
  'decryptToken can decrypt ciphertext encrypted with the legacy service-role key when dedicated key is absent',
  async () => {
    const legacyKey = 'test-legacy-service-role-key-material'
    const stored = await encryptWithModuleCompatibleKey('legacy-encrypted-refresh-token', legacyKey)

    await withEnv(
      {
        SUPABASE_SERVICE_ROLE_KEY: legacyKey,
      },
      async () => {
        assertEquals(await decryptToken(stored), 'legacy-encrypted-refresh-token')
      }
    )
  }
)

Deno.test(
  'decryptToken returns the stored ciphertext when decryption fails with configured keys',
  async () => {
    const stored = await encryptWithModuleCompatibleKey(
      'refresh-token-encrypted-with-another-key',
      'test-original-key-material'
    )

    await withEnv(
      {
        GOOGLE_TOKEN_ENCRYPTION_KEY: 'test-wrong-dedicated-key-material',
      },
      async () => {
        const originalConsoleError = console.error
        const errors: unknown[][] = []
        console.error = (...args: unknown[]) => {
          errors.push(args)
        }

        try {
          assertEquals(await decryptToken(stored), stored)
          assertEquals(errors.length, 1)
          assertEquals(errors[0][0], '[google-token-crypto] Decrypt failed with all known keys')
        } finally {
          console.error = originalConsoleError
        }
      }
    )
  }
)

Deno.test('decryptToken rejects malformed base64 encrypted storage format', async () => {
  await withEnv(
    {
      GOOGLE_TOKEN_ENCRYPTION_KEY: 'test-dedicated-google-token-key-material',
    },
    async () => {
      assertThrows(() => atob('%%%'))

      await assertRejects(() => decryptToken('%%%.ciphertext'))
    }
  )
})
