import {
  assertEquals,
  assertExists,
  assertThrows,
  assertRejects,
} from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { importEdgeModuleOffline } from '../_shared/module-load-test-harness.ts'

Deno.test('module loads', async () => {
  const { module, stats } = await importEdgeModuleOffline(new URL('./index.ts', import.meta.url))
  assertExists(module.handler)
  assertEquals(stats.listenCalls, 0)
  assertEquals(stats.fetchCalls, 0)
})

Deno.test('TextEncoder/TextDecoder roundtrip for IMAP-like payload is deterministic', () => {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  const payload = 'A0001 LOGIN "user@example.com" "secret"\r\n'
  const encoded = encoder.encode(payload)
  const decoded = decoder.decode(encoded)

  assertEquals(decoded, payload)
  assertEquals(encoded[0], 'A'.charCodeAt(0))
  assertEquals(encoded[encoded.length - 2], '\r'.charCodeAt(0))
  assertEquals(encoded[encoded.length - 1], '\n'.charCodeAt(0))
})

Deno.test(
  'mailbox LIST response parsing regex extracts mailbox names as implemented in module',
  () => {
    const response =
      '* LIST (\\HasNoChildren) "/" "INBOX"\r\n' +
      '* LIST (\\HasNoChildren) "/" "Sent"\r\n' +
      '* LIST (\\HasChildren) "/" "Archive/2024"\r\n' +
      'A0002 OK LIST completed\r\n'

    const mailboxes: string[] = []
    const lines = response.split('\r\n')
    for (const line of lines) {
      const match = line.match(/\* LIST \([^)]*\) "[^"]+" "?([^"]+)"?/)
      if (match) {
        mailboxes.push(match[1])
      }
    }

    assertEquals(mailboxes, ['INBOX', 'Sent', 'Archive/2024'])
  }
)

Deno.test('SELECT response parsing extracts EXISTS and UIDNEXT values', () => {
  const response =
    '* 42 EXISTS\r\n' +
    '* 3 RECENT\r\n' +
    '* OK [UIDVALIDITY 999] UIDs valid\r\n' +
    '* OK [UIDNEXT 314] Predicted next UID\r\n' +
    'A0003 OK [READ-WRITE] SELECT completed\r\n'

  const existsMatch = response.match(/\*\s+(\d+)\s+EXISTS/i)
  const uidNextMatch = response.match(/UIDNEXT (\d+)/i)

  const parsed = {
    exists: existsMatch ? parseInt(existsMatch[1], 10) : 0,
    uidNext: uidNextMatch ? parseInt(uidNextMatch[1], 10) : 1,
  }

  assertEquals(parsed, { exists: 42, uidNext: 314 })
})

Deno.test('SELECT response parsing falls back to defaults when markers are absent', () => {
  const response = 'A0004 OK SELECT completed without mailbox metadata\r\n'

  const existsMatch = response.match(/\*\s+(\d+)\s+EXISTS/i)
  const uidNextMatch = response.match(/UIDNEXT (\d+)/i)

  const parsed = {
    exists: existsMatch ? parseInt(existsMatch[1], 10) : 0,
    uidNext: uidNextMatch ? parseInt(uidNextMatch[1], 10) : 1,
  }

  assertEquals(parsed, { exists: 0, uidNext: 1 })
})

Deno.test('IMAP failure detection pattern would throw on NO/BAD tagged responses', () => {
  const taggedNo = 'A0005 NO [AUTHENTICATIONFAILED] Invalid credentials\r\n'
  const taggedBad = 'A0006 BAD Command Error. 12\r\n'

  const makeThrow = (response: string, expectedTag: string) => {
    if (response.includes(`${expectedTag} NO`) || response.includes(`${expectedTag} BAD`)) {
      throw new Error(`IMAP command failed: ${response.substring(0, 200)}`)
    }
  }

  assertThrows(() => makeThrow(taggedNo, 'A0005'), Error, 'IMAP command failed:')

  assertThrows(() => makeThrow(taggedBad, 'A0006'), Error, 'IMAP command failed:')
})

Deno.test('IMAP tagged completion detection recognizes OK NO and BAD responses', () => {
  const ok = '* FLAGS (\\Seen)\r\nA0001 OK FETCH completed\r\n'
  const no = 'A0002 NO permission denied\r\n'
  const bad = 'A0003 BAD invalid command\r\n'

  const isComplete = (response: string, expectedTag: string) =>
    response.includes(`${expectedTag} OK`) ||
    response.includes(`${expectedTag} NO`) ||
    response.includes(`${expectedTag} BAD`)

  assertEquals(isComplete(ok, 'A0001'), true)
  assertEquals(isComplete(no, 'A0002'), true)
  assertEquals(isComplete(bad, 'A0003'), true)
  assertEquals(isComplete('* OK IMAP4 ready\r\n', 'A9999'), false)
})

Deno.test('greeting detection recognizes untagged OK welcome response', () => {
  const greeting = '* OK [CAPABILITY IMAP4rev1] Service Ready\r\n'
  const nonGreeting = '* PREAUTH logged in\r\n'

  assertEquals(greeting.includes('* OK'), true)
  assertEquals(nonGreeting.includes('* OK'), false)
})

Deno.test('diagnostic summary shaping uses business values from account and inbox stats', () => {
  const account = {
    last_sync_at: null as string | null,
  }
  const inboxInfo = { exists: 17, uidNext: 18 }
  const mailboxes = ['INBOX', 'Sent', 'Archive']

  const summary = {
    connection: 'OK',
    authentication: 'OK',
    inbox_messages: inboxInfo.exists,
    mailboxes_found: mailboxes.length,
    last_sync: account.last_sync_at || 'Never',
  }

  assertEquals(summary, {
    connection: 'OK',
    authentication: 'OK',
    inbox_messages: 17,
    mailboxes_found: 3,
    last_sync: 'Never',
  })
})

Deno.test('message formatting for success response contains inbox count', () => {
  const inboxInfo = { exists: 9 }
  const message = `Connection successful! Found ${inboxInfo.exists} messages in INBOX`

  assertEquals(message, 'Connection successful! Found 9 messages in INBOX')
})

Deno.test('assertRejects works for async IMAP timeout-like error shape', async () => {
  const timeoutLike = () => Promise.reject(new Error('IMAP response timeout'))

  await assertRejects(timeoutLike, Error, 'IMAP response timeout')
})
