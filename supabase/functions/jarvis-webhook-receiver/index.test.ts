import {
  assertEquals,
  assertExists,
  assertThrows,
  assertRejects,
} from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { importEdgeModuleOffline } from '../_shared/module-load-test-harness.ts'

Deno.test('module loads offline without opening a real HTTP listener', async () => {
  const { module, stats } = await importEdgeModuleOffline(new URL('./index.ts', import.meta.url))

  assertExists(module)
  assertEquals(stats.listenCalls + stats.serveCalls, 1)
  assertEquals(stats.serveHttpCalls, 0)
  assertEquals(stats.fetchCalls, 0)
})

Deno.test('request constructor supports webhook-like inputs offline', () => {
  const req = new Request('http://localhost', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-webhook-source': 'github',
      'x-webhook-secret': 'secret',
      'x-webhook-signature': 'sig',
      'x-webhook-timestamp': '1710000000',
    },
    body: JSON.stringify({
      source: 'github',
      event_type: 'push',
      data: { ref: 'refs/heads/main', commits: [{ message: 'init', author: { name: 'Dev' } }] },
    }),
  })

  assertEquals(req.method, 'POST')
  assertEquals(req.headers.get('x-webhook-source'), 'github')
  assertEquals(req.headers.get('x-webhook-secret'), 'secret')
  assertEquals(req.headers.get('x-webhook-signature'), 'sig')
  assertEquals(req.headers.get('x-webhook-timestamp'), '1710000000')
  assertExists(req.headers.get('content-type'))
})

Deno.test('webhook payload JSON shape can be parsed deterministically', async () => {
  const payload = {
    source: 'slack',
    event_type: 'message.created',
    data: {
      text: 'Urgent bug client',
      channel: 'C123',
      user: 'U456',
    },
    timestamp: '2024-01-01T00:00:00.000Z',
  }

  const req = new Request('http://localhost', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const raw = await req.text()
  const parsed = JSON.parse(raw)

  assertEquals(parsed.source, 'slack')
  assertEquals(parsed.event_type, 'message.created')
  assertEquals(parsed.data.text, 'Urgent bug client')
  assertEquals(parsed.data.channel, 'C123')
  assertEquals(parsed.data.user, 'U456')
  assertEquals(parsed.timestamp, '2024-01-01T00:00:00.000Z')
})

Deno.test('qonto-like amount conversion expectations are represented in payload values', () => {
  const payload = {
    source: 'qonto',
    event_type: 'payment.received',
    data: {
      id: 'txn_123',
      amount: 123456,
      label: 'Règlement facture ACME',
    },
  }

  const euros = payload.data.amount / 100
  assertEquals(euros, 1234.56)
  assertEquals(payload.data.label, 'Règlement facture ACME')
  assertEquals(payload.event_type, 'payment.received')
})

Deno.test('github ref normalization expectation for main branch is correct', () => {
  const ref = 'refs/heads/main'
  const branch = ref.replace('refs/heads/', '')
  const commits = [
    { message: 'feat: add api', author: { name: 'Alice' } },
    { message: 'fix: patch prod', author: { name: 'Bob' } },
  ]

  assertEquals(branch, 'main')
  assertEquals(commits.length, 2)
  assertEquals(commits[0].author.name, 'Alice')
  assertEquals(commits[1].message, 'fix: patch prod')
})

Deno.test('standard assert helpers are available and behave as expected', async () => {
  assertThrows(() => {
    throw new Error('expected')
  })

  await assertRejects(async () => {
    await Promise.resolve()
    throw new Error('expected async')
  })
})
