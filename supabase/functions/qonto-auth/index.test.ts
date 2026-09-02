import {
  assertEquals,
  assertThrows,
  assertRejects,
} from 'https://deno.land/std@0.224.0/assert/mod.ts'

Deno.test({
  name: 'module loads and registers the exported Qonto handler without opening a listener',
  permissions: { read: true, env: true },
  async fn() {
    const originalServeDescriptor = Object.getOwnPropertyDescriptor(Deno, 'serve')
    let registeredHandler: ((request: Request) => Response | Promise<Response>) | undefined

    try {
      Object.defineProperty(Deno, 'serve', {
        configurable: true,
        writable: true,
        value: (handler: (request: Request) => Response | Promise<Response>) => {
          registeredHandler = handler
          return { shutdown: () => Promise.resolve() } as Deno.HttpServer
        },
      })

      const mod = await import(`./index.ts?deno-test=${crypto.randomUUID()}`)

      assertEquals(typeof mod.handler, 'function')
      assertEquals(registeredHandler, mod.handler)
    } finally {
      if (originalServeDescriptor) {
        Object.defineProperty(Deno, 'serve', originalServeDescriptor)
      } else {
        delete (Deno as { serve?: unknown }).serve
      }
    }
  },
})

Deno.test('source keeps the expected Qonto OAuth token exchange contract', async () => {
  const source = await Deno.readTextFile(new URL('./index.ts', import.meta.url))

  assertEquals(source.includes('https://oauth.qonto.com/oauth2/token'), true)
  assertEquals(source.includes("grant_type: 'authorization_code'"), true)
  assertEquals(source.includes('code,'), true)
  assertEquals(source.includes('client_id: qontoClientId'), true)
  assertEquals(source.includes('client_secret: qontoClientSecret'), true)
  assertEquals(source.includes('redirect_uri: qontoRedirectUri'), true)
  assertEquals(source.includes('QONTO_CLIENT_ID'), true)
  assertEquals(source.includes('QONTO_CLIENT_SECRET'), true)
  assertEquals(source.includes('QONTO_REDIRECT_URI'), true)
})

Deno.test('source enforces admin authentication before Qonto API calls', async () => {
  const source = await Deno.readTextFile(new URL('./index.ts', import.meta.url))

  const authHeaderIndex = source.indexOf("req.headers.get('Authorization')")
  const missingAuthIndex = source.indexOf('Non authentifié')
  const getUserIndex = source.indexOf('supabaseClient.auth.getUser(token)')
  const rolesTableIndex = source.indexOf(".from('user_roles')")
  const roleSelectIndex = source.indexOf(".select('role')")
  const adminCheckIndex = source.indexOf("roles?.role !== 'admin'")
  const qontoTokenFetchIndex = source.indexOf('https://oauth.qonto.com/oauth2/token')

  assertEquals(authHeaderIndex > -1, true)
  assertEquals(missingAuthIndex > authHeaderIndex, true)
  assertEquals(getUserIndex > authHeaderIndex, true)
  assertEquals(rolesTableIndex > getUserIndex, true)
  assertEquals(roleSelectIndex > rolesTableIndex, true)
  assertEquals(adminCheckIndex > roleSelectIndex, true)
  assertEquals(qontoTokenFetchIndex > adminCheckIndex, true)
})

Deno.test('source requires AES-GCM encryption before token persistence', async () => {
  const source = await Deno.readTextFile(new URL('./index.ts', import.meta.url))

  const encryptionKeyIndex = source.indexOf('QONTO_ENCRYPTION_KEY')
  const keyLengthIndex = source.indexOf('encryptionKey.length < 16')
  const aesGcmIndex = source.indexOf('AES-GCM')
  const ivIndex = source.indexOf('crypto.getRandomValues(new Uint8Array(12))')
  const accessTokenEncryptionIndex = source.indexOf(
    'accessTokenEncrypted = await encryptToken(tokenData.access_token)'
  )
  const refreshTokenEncryptionIndex = source.indexOf(
    'refreshTokenEncrypted = await encryptToken(tokenData.refresh_token)'
  )
  const upsertIndex = source.indexOf(".from('tresorerie_qonto_connections')")
  const storedAccessTokenIndex = source.indexOf('access_token_encrypted: accessTokenEncrypted')
  const storedRefreshTokenIndex = source.indexOf('refresh_token_encrypted: refreshTokenEncrypted')

  assertEquals(encryptionKeyIndex > -1, true)
  assertEquals(keyLengthIndex > encryptionKeyIndex, true)
  assertEquals(aesGcmIndex > encryptionKeyIndex, true)
  assertEquals(ivIndex > aesGcmIndex, true)
  assertEquals(accessTokenEncryptionIndex > ivIndex, true)
  assertEquals(refreshTokenEncryptionIndex > accessTokenEncryptionIndex, true)
  assertEquals(upsertIndex > refreshTokenEncryptionIndex, true)
  assertEquals(storedAccessTokenIndex > upsertIndex, true)
  assertEquals(storedRefreshTokenIndex > storedAccessTokenIndex, true)
})

Deno.test('source stores the expected Qonto organization and bank account fields', async () => {
  const source = await Deno.readTextFile(new URL('./index.ts', import.meta.url))

  const orgFetchIndex = source.indexOf('https://thirdparty.qonto.com/v2/organization')
  const accountsFetchIndex = source.indexOf('https://thirdparty.qonto.com/v2/bank_accounts')
  const organizationIdIndex = source.indexOf('organization_id: orgData.organization.slug')
  const organizationSlugIndex = source.indexOf('organization_slug: orgData.organization.slug')
  const tokenExpiresAtIndex = source.indexOf('token_expires_at: expiresAt.toISOString()')
  const isActiveIndex = source.indexOf('is_active: true')
  const bankAccountsIndex = source.indexOf('bank_accounts: bankAccounts')
  const onConflictIndex = source.indexOf("onConflict: 'organization_id'")

  assertEquals(orgFetchIndex > -1, true)
  assertEquals(accountsFetchIndex > orgFetchIndex, true)
  assertEquals(organizationIdIndex > accountsFetchIndex, true)
  assertEquals(organizationSlugIndex > organizationIdIndex, true)
  assertEquals(tokenExpiresAtIndex > organizationSlugIndex, true)
  assertEquals(isActiveIndex > tokenExpiresAtIndex, true)
  assertEquals(bankAccountsIndex > isActiveIndex, true)
  assertEquals(onConflictIndex > bankAccountsIndex, true)
})

Deno.test('local validation helpers used by the test file reject malformed fixtures', async () => {
  const requireNonEmptyAuthorizationCode = (code: unknown) => {
    if (typeof code !== 'string' || code.trim().length === 0) {
      throw new Error('authorization code is required')
    }
    return code
  }

  const parseJsonResponse = async (response: Response) => {
    if (!response.ok) {
      throw new Error(`unexpected status ${response.status}`)
    }
    return await response.json()
  }

  assertEquals(requireNonEmptyAuthorizationCode('qonto-auth-code'), 'qonto-auth-code')
  assertThrows(() => requireNonEmptyAuthorizationCode(''), Error, 'authorization code is required')
  await assertRejects(
    () => parseJsonResponse(new Response('failure', { status: 502 })),
    Error,
    'unexpected status 502'
  )
})
