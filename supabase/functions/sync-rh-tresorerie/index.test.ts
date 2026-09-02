import { assertEquals, assertExists, assertNotEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { handler } from './index.ts'

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

async function withEnv<T>(
  values: Record<string, string | undefined>,
  fn: () => Promise<T>
): Promise<T> {
  const previous = new Map<string, string | undefined>()

  for (const key of Object.keys(values)) {
    previous.set(key, Deno.env.get(key))
    const value = values[key]

    if (value === undefined) {
      Deno.env.delete(key)
    } else {
      Deno.env.set(key, value)
    }
  }

  try {
    return await fn()
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        Deno.env.delete(key)
      } else {
        Deno.env.set(key, value)
      }
    }
  }
}

async function withFetch<T>(fetchStub: typeof fetch, fn: () => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch
  globalThis.fetch = fetchStub

  try {
    return await fn()
  } finally {
    globalThis.fetch = originalFetch
  }
}

function requestInfo(input: string | URL | Request, init?: RequestInit) {
  const url = input instanceof Request ? new URL(input.url) : new URL(String(input))
  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
  const body = init?.body

  return {
    url,
    method,
    bodyText: typeof body === 'string' ? body : undefined,
  }
}

Deno.test('module exports an HTTP handler', () => {
  assertEquals(typeof handler, 'function')
})

Deno.test('OPTIONS request returns CORS headers without calling Supabase', async () => {
  let fetchCalled = false

  await withFetch(
    (() => {
      fetchCalled = true
      return Promise.resolve(jsonResponse({ unexpected: true }))
    }) as typeof fetch,
    async () => {
      const response = await handler(new Request('http://localhost', { method: 'OPTIONS' }))

      assertEquals(response.status, 200)
      assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*')
      assertEquals(
        response.headers.get('Access-Control-Allow-Headers'),
        'authorization, x-client-info, apikey, content-type, x-internal-secret'
      )
      assertEquals(fetchCalled, false)
      assertEquals(await response.text(), '')
    }
  )
})

Deno.test(
  'POST synchronizes one paid salary, creates expenses and corrects missing employee name',
  async () => {
    const calls: Array<{
      table: string
      method: string
      url: URL
      body?: Record<string, unknown>
    }> = []

    const fetchStub = (async (input: string | URL | Request, init?: RequestInit) => {
      await Promise.resolve()
      const { url, method, bodyText } = requestInfo(input, init)
      const table = url.pathname.split('/').pop() ?? ''
      const body = bodyText ? JSON.parse(bodyText) : undefined

      calls.push({ table, method, url, body })

      if (table === 'rh_salaires_mensuels' && method === 'GET') {
        assertEquals(url.searchParams.get('mois'), 'eq.2024-05-01')

        return jsonResponse([
          {
            id: 'sal-1',
            mois: '2024-05-01',
            salaire_brut: 3400,
            salaire_net: 2500,
            net_paye: 2450,
            cotisations_patronales: 900,
            statut: 'paye',
            profile_id: '12345678-aaaa-bbbb-cccc-123456789abc',
            profiles: {
              id: '12345678-aaaa-bbbb-cccc-123456789abc',
              prenom: 'Ada',
              nom: 'Lovelace',
              email: 'ada.lovelace@example.test',
            },
          },
        ])
      }

      if (table === 'tresorerie_depenses' && method === 'GET' && url.searchParams.has('or')) {
        return jsonResponse([
          {
            id: 'dep-old-name',
            nom: 'Salaire - Employé ID sal-1',
            source_id: 'sal-1',
          },
        ])
      }

      if (
        table === 'tresorerie_depenses' &&
        method === 'GET' &&
        url.searchParams.get('source') === 'eq.rh_salaires_net'
      ) {
        return jsonResponse([])
      }

      if (
        table === 'tresorerie_depenses' &&
        method === 'GET' &&
        url.searchParams.get('source') === 'eq.rh_cotisations'
      ) {
        return jsonResponse([])
      }

      if (table === 'tresorerie_depenses' && method === 'PATCH') {
        return jsonResponse([])
      }

      if (table === 'tresorerie_depenses' && method === 'POST') {
        return jsonResponse([], 201)
      }

      return jsonResponse({ message: `Unhandled ${method} ${url.href}` }, 500)
    }) as typeof fetch

    await withEnv(
      {
        SUPABASE_URL: 'http://supabase.test',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
        TZ: 'UTC',
      },
      async () => {
        await withFetch(fetchStub, async () => {
          const response = await handler(
            new Request('http://localhost', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ mois: '2024-05-01' }),
            })
          )

          assertEquals(response.status, 200)
          assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*')
          assertEquals(response.headers.get('Content-Type'), 'application/json')

          const payload = await response.json()

          assertEquals(payload.success, true)
          assertEquals(payload.salairesProcessed, 1)
          assertEquals(payload.depensesCreated, 1)
          assertEquals(payload.depensesUpdated, 0)
          assertEquals(payload.cotisationsCreated, 1)
          assertEquals(payload.nomsCorrigesCount, 1)
          assertEquals(payload.errors, [])
          assertEquals(
            payload.message,
            'Synchronisation terminée: 1 créées, 0 mises à jour, 1 noms corrigés'
          )

          const correctionUpdate = calls.find(
            (call) =>
              call.table === 'tresorerie_depenses' &&
              call.method === 'PATCH' &&
              call.url.searchParams.get('id') === 'eq.dep-old-name'
          )
          assertExists(correctionUpdate)
          assertEquals(correctionUpdate.body, {
            nom: 'Salaire - Ada Lovelace',
          })

          const inserts = calls.filter(
            (call) => call.table === 'tresorerie_depenses' && call.method === 'POST'
          )
          assertEquals(inserts.length, 2)

          const salaireInsert = inserts.find((call) => call.body?.source === 'rh_salaires_net')
          assertExists(salaireInsert)
          assertEquals(salaireInsert.body, {
            nom: 'Salaire - Ada Lovelace',
            montant: 2450,
            date_prevue: '2024-06-05',
            statut: 'paye',
            date_paiement_reel: '2024-06-05',
            categorie_code: 'DEP_SALAIRES_NETS',
            source: 'rh_salaires_net',
            source_id: 'sal-1',
            est_recurrent: false,
            notes: 'Synchronisé depuis RH - Mois: 2024-05-01 - Ada Lovelace',
          })

          const cotisationsInsert = inserts.find((call) => call.body?.source === 'rh_cotisations')
          assertExists(cotisationsInsert)
          assertEquals(cotisationsInsert.body, {
            nom: 'Cotisations patronales - Ada Lovelace',
            montant: 900,
            date_prevue: '2024-06-05',
            statut: 'paye',
            categorie_code: 'DEP_URSSAF',
            source: 'rh_cotisations',
            source_id: 'sal-1',
            est_recurrent: false,
            notes: 'Cotisations patronales - Mois: 2024-05-01 - Ada Lovelace',
          })
        })
      }
    )
  }
)

Deno.test(
  'POST uses email local-part fallback, updates existing salary expense and skips zero cotisations',
  async () => {
    const calls: Array<{
      table: string
      method: string
      url: URL
      body?: Record<string, unknown>
    }> = []

    const fetchStub = (async (input: string | URL | Request, init?: RequestInit) => {
      await Promise.resolve()
      const { url, method, bodyText } = requestInfo(input, init)
      const table = url.pathname.split('/').pop() ?? ''
      const body = bodyText ? JSON.parse(bodyText) : undefined

      calls.push({ table, method, url, body })

      if (table === 'rh_salaires_mensuels' && method === 'GET') {
        assertEquals(url.searchParams.has('mois'), false)

        return jsonResponse([
          {
            id: 'sal-email',
            mois: '2024-01-01',
            salaire_brut: 3000,
            salaire_net: 2200,
            net_paye: null,
            cotisations_patronales: 0,
            statut: 'brouillon',
            profile_id: 'abcdef12-0000-0000-0000-000000000000',
            profiles: {
              id: 'abcdef12-0000-0000-0000-000000000000',
              prenom: '',
              nom: '',
              email: 'marie.curie@example.test',
            },
          },
        ])
      }

      if (table === 'tresorerie_depenses' && method === 'GET' && url.searchParams.has('or')) {
        return jsonResponse([])
      }

      if (
        table === 'tresorerie_depenses' &&
        method === 'GET' &&
        url.searchParams.get('source') === 'eq.rh_salaires_net'
      ) {
        return jsonResponse([{ id: 'dep-existing-salary' }])
      }

      if (table === 'tresorerie_depenses' && method === 'PATCH') {
        return jsonResponse([])
      }

      return jsonResponse({ message: `Unhandled ${method} ${url.href}` }, 500)
    }) as typeof fetch

    await withEnv(
      {
        SUPABASE_URL: 'http://supabase.test',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
        TZ: 'UTC',
      },
      async () => {
        await withFetch(fetchStub, async () => {
          const response = await handler(
            new Request('http://localhost', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: '',
            })
          )

          assertEquals(response.status, 200)

          const payload = await response.json()

          assertEquals(payload.success, true)
          assertEquals(payload.salairesProcessed, 1)
          assertEquals(payload.depensesCreated, 0)
          assertEquals(payload.depensesUpdated, 1)
          assertEquals(payload.cotisationsCreated, 0)
          assertEquals(payload.nomsCorrigesCount, 0)
          assertEquals(payload.errors, [])

          const update = calls.find(
            (call) =>
              call.table === 'tresorerie_depenses' &&
              call.method === 'PATCH' &&
              call.url.searchParams.get('id') === 'eq.dep-existing-salary'
          )
          assertExists(update)
          assertEquals(update.body, {
            nom: 'Salaire - marie.curie',
            montant: 2200,
            statut: 'en_attente',
            date_paiement_reel: null,
          })

          const inserts = calls.filter(
            (call) => call.table === 'tresorerie_depenses' && call.method === 'POST'
          )
          assertEquals(inserts.length, 0)
        })
      }
    )
  }
)

Deno.test('POST returns an empty successful result when no salaries are found', async () => {
  const fetchStub = (async (input: string | URL | Request, init?: RequestInit) => {
    await Promise.resolve()
    const { url, method } = requestInfo(input, init)
    const table = url.pathname.split('/').pop() ?? ''

    if (table === 'rh_salaires_mensuels' && method === 'GET') {
      assertEquals(url.searchParams.get('mois'), 'eq.2024-12-01')
      return jsonResponse([])
    }

    return jsonResponse({ message: `Unexpected call: ${method} ${url.href}` }, 500)
  }) as typeof fetch

  await withEnv(
    {
      SUPABASE_URL: 'http://supabase.test',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    },
    async () => {
      await withFetch(fetchStub, async () => {
        const response = await handler(
          new Request('http://localhost', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ mois: '2024-12-01' }),
          })
        )

        assertEquals(response.status, 200)

        const payload = await response.json()

        assertEquals(payload.success, true)
        assertEquals(payload.salairesProcessed, 0)
        assertEquals(payload.depensesCreated, 0)
        assertEquals(payload.depensesUpdated, 0)
        assertEquals(payload.cotisationsCreated, 0)
        assertEquals(payload.nomsCorrigesCount, 0)
        assertEquals(payload.errors, [])
        assertEquals(
          payload.message,
          'Synchronisation terminée: 0 créées, 0 mises à jour, 0 noms corrigés'
        )
      })
    }
  )
})

Deno.test('POST reports salary retrieval errors without touching expenses', async () => {
  let expenseEndpointCalled = false

  const fetchStub = (async (input: string | URL | Request, init?: RequestInit) => {
    await Promise.resolve()
    const { url, method } = requestInfo(input, init)
    const table = url.pathname.split('/').pop() ?? ''

    if (table === 'rh_salaires_mensuels' && method === 'GET') {
      return jsonResponse(
        {
          message: 'select failed',
          details: 'database unavailable',
          hint: '',
          code: 'PGRST_TEST',
        },
        400
      )
    }

    if (table === 'tresorerie_depenses') {
      expenseEndpointCalled = true
    }

    return jsonResponse({ message: `Unexpected call: ${method} ${url.href}` }, 500)
  }) as typeof fetch

  await withEnv(
    {
      SUPABASE_URL: 'http://supabase.test',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    },
    async () => {
      await withFetch(fetchStub, async () => {
        const response = await handler(
          new Request('http://localhost', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ mois: '2024-02-01' }),
          })
        )

        assertEquals(response.status, 200)

        const payload = await response.json()

        assertEquals(payload.success, false)
        assertEquals(payload.salairesProcessed, 0)
        assertEquals(payload.depensesCreated, 0)
        assertEquals(payload.depensesUpdated, 0)
        assertEquals(payload.cotisationsCreated, 0)
        assertEquals(payload.nomsCorrigesCount, 0)
        assertEquals(payload.errors, ['Erreur récupération salaires: select failed'])
        assertEquals(expenseEndpointCalled, false)
      })
    }
  )
})
